import { describe, it, expect } from "vitest";
import { validateUrl, normalizeUrl, sameSite } from "@/lib/crawler/url-utils";
import { isPrivateIP, isBlockedHostname, assertPublicTarget, rateLimit } from "@/lib/crawler/security";
import { isPathAllowed } from "@/lib/crawler/robots";

describe("URL validation", () => {
  it("accepts http/https URLs", () => {
    expect(validateUrl("https://example.com").ok).toBe(true);
    expect(validateUrl("http://example.com/page?x=1").ok).toBe(true);
  });
  it("adds https when the scheme is missing", () => {
    const v = validateUrl("example.com/path");
    expect(v.ok).toBe(true);
    expect(v.normalized).toBe("https://example.com/path");
  });
  it("rejects unsupported protocols", () => {
    expect(validateUrl("ftp://example.com").ok).toBe(false);
    expect(validateUrl("file:///etc/passwd").ok).toBe(false);
    expect(validateUrl("javascript:alert(1)").ok).toBe(false);
  });
  it("rejects malformed input", () => {
    expect(validateUrl("").ok).toBe(false);
    expect(validateUrl("http://").ok).toBe(false);
    expect(validateUrl("not a url").ok).toBe(false);
    expect(validateUrl("https://user:pw@example.com").ok).toBe(false);
    expect(validateUrl("https://nodots").ok).toBe(false);
  });
});

describe("URL normalization", () => {
  it("lowercases host, strips fragment and default port", () => {
    expect(normalizeUrl("HTTPS://Example.COM:443/A?b=1#frag")).toBe("https://example.com/A?b=1");
    expect(normalizeUrl("http://example.com:80")).toBe("http://example.com/");
  });
  it("treats www and apex as same site", () => {
    expect(sameSite("www.example.com", "example.com")).toBe(true);
    expect(sameSite("cdn.example.com", "example.com")).toBe(false);
  });
});

describe("SSRF protection", () => {
  it("flags private and reserved IPs", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "0.0.0.0", "100.64.0.1", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) expect(isPrivateIP(ip), ip).toBe(true);
    for (const ip of ["8.8.8.8", "1.1.1.1", "93.184.216.34", "2606:4700::1111"]) expect(isPrivateIP(ip), ip).toBe(false);
  });
  it("blocks internal hostnames", () => {
    expect(isBlockedHostname("localhost")).toBe(true);
    expect(isBlockedHostname("router.local")).toBe(true);
    expect(isBlockedHostname("metadata.google.internal")).toBe(true);
    expect(isBlockedHostname("intranet")).toBe(true);
    expect(isBlockedHostname("example.com")).toBe(false);
  });
  it("rejects literal private IP targets without DNS", async () => {
    expect((await assertPublicTarget(new URL("http://127.0.0.1:8080/"))).ok).toBe(false);
    expect((await assertPublicTarget(new URL("http://169.254.169.254/latest/meta-data"))).ok).toBe(false);
    expect((await assertPublicTarget(new URL("http://[::1]/"))).ok).toBe(false);
    expect((await assertPublicTarget(new URL("http://8.8.8.8/"))).ok).toBe(true);
  });
  it("rate limits", () => {
    for (let i = 0; i < 3; i++) expect(rateLimit("t", 3, 1000).allowed).toBe(true);
    expect(rateLimit("t", 3, 1000).allowed).toBe(false);
  });
});

describe("robots.txt", () => {
  const txt = `User-agent: *\nDisallow: /private/\nAllow: /private/public\n\nUser-agent: domscope\nDisallow: /secret`;
  it("applies specific and wildcard groups", () => {
    expect(isPathAllowed(txt, "/", "domscope")).toBe(true);
    expect(isPathAllowed(txt, "/secret/x", "domscope")).toBe(false);
    expect(isPathAllowed(txt, "/private/a", "otherbot")).toBe(false);
    expect(isPathAllowed(txt, "/private/public/a", "otherbot")).toBe(true);
  });
});
