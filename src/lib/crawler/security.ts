import { promises as dns } from "node:dns";
import { isIP } from "node:net";

export const MAX_RESPONSE_BYTES = 3 * 1024 * 1024; // 3 MB
export const FETCH_TIMEOUT_MS = 15_000;
export const MAX_REDIRECTS = 5;
export const USER_AGENT =
  "Mozilla/5.0 (compatible; DOMScope/1.0; +https://github.com/domscope) DOMScope website analyzer";

const BLOCKED_HOST_SUFFIXES = [".local", ".localhost", ".internal", ".intranet", ".lan", ".home", ".corp", ".arpa"];
const BLOCKED_HOSTS = new Set(["localhost", "0.0.0.0", "metadata.google.internal", "metadata", "instance-data"]);

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

function inCidr4(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split("/");
  const bits = Number(bitsStr);
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(range) & mask);
}

const PRIVATE_V4 = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.0.0.0/24",
  "192.0.2.0/24",
  "192.88.99.0/24",
  "192.168.0.0/16",
  "198.18.0.0/15",
  "198.51.100.0/24",
  "203.0.113.0/24",
  "224.0.0.0/4",
  "240.0.0.0/4",
  "255.255.255.255/32",
];

export function isPrivateIPv4(ip: string): boolean {
  return PRIVATE_V4.some((cidr) => inCidr4(ip, cidr));
}

export function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (lower === "::" || lower === "::1") return true;
  // IPv4-mapped ::ffff:a.b.c.d
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  const mappedHex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const hi = parseInt(mappedHex[1], 16);
    const lo = parseInt(mappedHex[2], 16);
    return isPrivateIPv4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // fc00::/7 unique local
  if (/^fe[89ab]/.test(lower)) return true; // fe80::/10 link local
  if (lower.startsWith("ff")) return true; // multicast
  if (lower.startsWith("2001:db8")) return true; // documentation
  if (lower.startsWith("64:ff9b")) return true; // NAT64 — could map to private
  return false;
}

export function isPrivateIP(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateIPv4(ip);
  if (version === 6) return isPrivateIPv6(ip);
  return true; // unknown → treat as unsafe
}

export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTS.has(host)) return true;
  if (BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s))) return true;
  if (!host.includes(".") && isIP(host) === 0) return true; // bare intranet names
  return false;
}

export interface TargetCheck {
  ok: boolean;
  reason?: string;
  addresses?: string[];
}

/**
 * Resolve the hostname and verify that every resolved address is public.
 * Literal IPs are checked directly. This runs for every redirect hop too.
 */
export async function assertPublicTarget(url: URL): Promise<TargetCheck> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: `Protocol ${url.protocol} is not allowed.` };
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (isBlockedHostname(hostname)) {
    return { ok: false, reason: `Host "${hostname}" is not a public internet host.` };
  }
  if (isIP(hostname)) {
    if (isPrivateIP(hostname)) return { ok: false, reason: `IP address ${hostname} is in a private or reserved range.` };
    return { ok: true, addresses: [hostname] };
  }
  let records: { address: string; family: number }[];
  try {
    records = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    return { ok: false, reason: `DNS lookup failed for ${hostname}${code ? ` (${code})` : ""}.` };
  }
  if (!records.length) return { ok: false, reason: `DNS returned no addresses for ${hostname}.` };
  const bad = records.find((r) => isPrivateIP(r.address));
  if (bad) {
    return { ok: false, reason: `${hostname} resolves to ${bad.address}, which is a private or reserved address.` };
  }
  return { ok: true, addresses: records.map((r) => r.address) };
}

/** Very small in-memory rate limiter (per key, sliding window). */
const buckets = new Map<string, number[]>();
export function rateLimit(key: string, limit = 20, windowMs = 60_000): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    buckets.set(key, arr);
    return { allowed: false, retryAfterSec: Math.ceil((windowMs - (now - arr[0])) / 1000) };
  }
  arr.push(now);
  buckets.set(key, arr);
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
  }
  return { allowed: true, retryAfterSec: 0 };
}
