import { describe, it, expect } from "vitest";
import { SAMPLE_HTML, MINIMAL_HTML } from "./fixtures/sample-page";
import { parse } from "./helpers";
import { analyzeSeo } from "@/lib/analyzer/seo-analyzer";
import { extractMetadata } from "@/lib/parser/metadata-parser";

describe("SEO analysis", () => {
  it("passes checks when signals are present", () => {
    const doc = parse(SAMPLE_HTML);
    const seo = analyzeSeo(doc.dom, extractMetadata(doc, "https://acme.test/"), "https://acme.test/");
    const st = Object.fromEntries(seo.checks.map((c) => [c.id, c.status]));
    expect(st.title).toBe("pass");
    expect(st.description).toBe("pass");
    expect(st.canonical).toBe("pass");
    expect(st.h1).toBe("pass");
    expect(st["og-basic"]).toBe("pass");
    expect(st.twitter).toBe("pass");
    expect(st.lang).toBe("pass");
    expect(st.viewport).toBe("pass");
    expect(st["structured-data"]).toBe("pass");
    expect(st.h2).toBe("warn"); // no h2 present
    expect(seo.score).toBeGreaterThan(80);
    expect(seo.headings[0]).toMatchObject({ tag: "h1", text: "Widgets you can trust" });
  });
  it("fails checks only with evidence of absence", () => {
    const doc = parse(MINIMAL_HTML);
    const seo = analyzeSeo(doc.dom, extractMetadata(doc, "https://x.test/"), "https://x.test/");
    const st = Object.fromEntries(seo.checks.map((c) => [c.id, c.status]));
    expect(st.title).toBe("fail");
    expect(st.description).toBe("fail");
    expect(st.h1).toBe("fail");
    expect(st.lang).toBe("fail");
    expect(st["og-basic"]).toBe("fail");
    expect(seo.score).toBeLessThan(20);
    expect(seo.checks.find((c) => c.id === "title-length")).toBeUndefined();
  });
  it("detects noindex", () => {
    const doc = parse('<html><head><title>t</title><meta name="robots" content="noindex,nofollow"></head><body></body></html>');
    const seo = analyzeSeo(doc.dom, extractMetadata(doc, "https://x.test/"), "https://x.test/");
    expect(seo.checks.find((c) => c.id === "robots")?.status).toBe("fail");
  });
});
