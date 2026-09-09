import { describe, it, expect } from "vitest";
import { SAMPLE_HTML } from "./fixtures/sample-page";
import { parse } from "./helpers";
import { analyzeDom, detectRepeatedPatterns } from "@/lib/analyzer/dom-analyzer";
import { analyzeLinks, classifyHref } from "@/lib/analyzer/link-analyzer";
import { analyzeAssets } from "@/lib/analyzer/asset-analyzer";
import { analyzeScripts } from "@/lib/analyzer/script-analyzer";
import { analyzeStyles } from "@/lib/analyzer/style-analyzer";
import { analyzeComplexity } from "@/lib/analyzer/complexity-analyzer";
import { detectTechnologies } from "@/lib/analyzer/technology-detector";
import { extractMetadata } from "@/lib/parser/metadata-parser";
import { buildGraph } from "@/lib/graph/graph-builder";

const doc = parse(SAMPLE_HTML);
const base = "https://acme.test/";

describe("DOM statistics", () => {
  const s = analyzeDom(doc, SAMPLE_HTML.length);
  it("counts elements accurately", () => {
    expect(s.elements).toBe(doc.dom.nodes.length);
    expect(s.links).toBe(10);
    expect(s.images).toBe(3);
    expect(s.forms).toBe(1);
    expect(s.scripts).toBe(6);
    expect(s.stylesheets).toBe(2);
    expect(s.headings.h1).toBe(1);
    expect(s.headings.h3).toBe(1);
    expect(s.headings.h4).toBe(3);
    expect(s.uniqueIds).toBe(4);
    expect(s.tagFrequency[0].count).toBeGreaterThan(0);
  });
  it("detects repeated patterns", () => {
    const p = detectRepeatedPatterns(doc.dom);
    expect(p.find((x) => x.signature === ".card.col-md-4")?.count).toBe(3);
  });
});

describe("Link extraction", () => {
  const l = analyzeLinks(doc.dom, base);
  it("classifies links", () => {
    expect(l.counts.internal).toBe(5);
    expect(l.counts.external).toBe(1);
    expect(l.counts.anchor).toBe(1);
    expect(l.counts.mailto).toBe(1);
    expect(l.counts.tel).toBe(1);
    expect(l.counts.javascript).toBe(1);
    expect(l.externalDomains[0].domain).toBe("twitter.com");
  });
  it("resolves relative URLs and keeps text", () => {
    const products = l.links.find((x) => x.href === "/products")!;
    expect(products.resolved).toBe("https://acme.test/products");
    expect(products.text).toBe("Products");
  });
  it("classifyHref edge cases", () => {
    expect(classifyHref("https://www.acme.test/x", base).kind).toBe("internal");
    expect(classifyHref("//cdn.other.com/x", base).kind).toBe("external");
    expect(classifyHref("", base).kind).toBe("anchor");
  });
});

describe("Asset extraction", () => {
  const a = analyzeAssets(doc, base);
  it("detects asset types", () => {
    expect(a.counts.svg).toBeGreaterThanOrEqual(2); // logo.svg + inline svg
    expect(a.counts.image).toBe(2);
    expect(a.counts.stylesheet).toBe(2);
    expect(a.counts.script).toBe(4);
    expect(a.counts.favicon).toBe(1);
    expect(a.counts.iframe).toBe(1);
    expect(a.counts.font).toBeGreaterThanOrEqual(1);
    expect(a.lazyImages).toBe(1);
    expect(a.imagesWithoutDimensions).toBe(2);
    expect(a.assets.find((x) => x.url?.includes("bootstrap"))?.external).toBe(true);
  });
});

describe("Scripts & styles", () => {
  const s = analyzeScripts(doc, base);
  const st = analyzeStyles(doc);
  it("classifies scripts", () => {
    expect(s.total).toBe(6);
    expect(s.external).toBe(4);
    expect(s.inline).toBe(2);
    expect(s.async).toBe(1);
    expect(s.defer).toBe(1);
    expect(s.module).toBe(1);
    expect(s.jsonLd).toBe(1);
    expect(s.blockingInHead).toBe(1);
    expect(s.scriptDomains.map((d) => d.domain)).toContain("code.jquery.com");
  });
  it("analyzes styles", () => {
    expect(st.externalStylesheets).toBe(2);
    expect(st.inlineStyleBlocks).toBe(1);
    expect(st.fontFaces).toBe(1);
    expect(st.mediaQueries).toBe(1);
    expect(st.importantCount).toBe(1);
    expect(st.topClasses.find((c) => c.name === "card")?.count).toBe(3);
  });
});

describe("Technology detection", () => {
  const meta = extractMetadata(doc, base);
  it("detects technologies from evidence only", () => {
    const t = detectTechnologies(doc, { server: "cloudflare", "cf-ray": "abc" }, meta);
    const names = t.map((x) => x.name);
    expect(names).toContain("jQuery");
    expect(names).toContain("Bootstrap");
    expect(names).toContain("Google Analytics");
    expect(names).toContain("Cloudflare");
    expect(names).not.toContain("React");
    expect(names).not.toContain("WordPress");
    expect(t.find((x) => x.name === "jQuery")?.version).toBe("3.7.1");
    for (const x of t) expect(x.evidence.length).toBeGreaterThan(0);
  });
  it("reports nothing for a plain document", () => {
    const d = parse("<html><head><title>x</title></head><body><p>hi</p></body></html>");
    expect(detectTechnologies(d, {}, extractMetadata(d, base))).toHaveLength(0);
  });
});

describe("Complexity & graph", () => {
  it("computes a transparent complexity score", () => {
    const c = analyzeComplexity(doc.dom);
    expect(c.score).toBeGreaterThanOrEqual(0);
    expect(c.score).toBeLessThanOrEqual(100);
    expect(c.breakdown.reduce((s, b) => s + b.penalty, 0)).toBe(c.score);
    expect(c.largestBranches[0].label).toBe("main");
    expect(c.maxDepth).toBe(doc.dom.maxDepth);
  });
  it("builds a pruned graph layout", () => {
    const g = buildGraph(doc.dom, { mode: "overview", selectedId: null, maxNodes: 30 });
    expect(g.nodes.length).toBeLessThanOrEqual(30);
    expect(g.nodes[g.nodes.length - 1].tag).toBe("html");
    expect(g.edges.every((e) => g.nodes.some((n) => n.id === e.from) && g.nodes.some((n) => n.id === e.to))).toBe(true);
    const hero = doc.dom.nodes.find((n) => n.idAttr === "hero")!.id;
    const sub = buildGraph(doc.dom, { mode: "subtree", selectedId: hero });
    expect(sub.rootId).toBe(hero);
  });
});
