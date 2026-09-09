import { describe, it, expect } from "vitest";
import { SAMPLE_HTML, MINIMAL_HTML } from "./fixtures/sample-page";
import { makePage } from "./helpers";
import { analyzeFetchedPage } from "@/lib/analyzer/pipeline";
import { compareSites } from "@/lib/comparison/site-comparator";
import { buildJsonExport } from "@/lib/export/json-export";
import { buildHtmlReport } from "@/lib/export/html-export";
import { buildAnalysisContext } from "@/lib/ai/context-builder";

describe("Pipeline, comparison and export", async () => {
  const a = await analyzeFetchedPage(makePage(SAMPLE_HTML, "https://acme.test/", { server: "nginx/1.25.0" }));
  const b = await analyzeFetchedPage(makePage(MINIMAL_HTML, "https://tiny.test/"));

  it("produces a complete analysis result", () => {
    expect(a.statistics.elements).toBeGreaterThan(40);
    expect(a.scores.overall).toBeGreaterThan(0);
    expect(a.issues.length).toBeGreaterThan(0);
    expect(a.issues.every((i) => i.evidence.length > 0)).toBe(true);
    expect(a.technologies.map((t) => t.name)).toContain("Nginx");
    expect(a.scores.overall).toBeGreaterThan(b.scores.overall);
  });

  it("compares two sites without fabricating values", () => {
    const c = compareSites(a, b);
    const el = c.metrics.find((m) => m.key === "elements")!;
    expect(el.a).toBe(a.statistics.elements);
    expect(el.b).toBe(b.statistics.elements);
    expect(el.better).toBe("b");
    const labelled = c.metrics.find((m) => m.key === "labelled")!;
    expect(labelled.b).toBeNull(); // no inputs on B → n/a, not 0 or 100
    expect(c.technologies.find((t) => t.name === "Nginx")).toMatchObject({ inA: true, inB: false });
    expect(c.summary.aWins + c.summary.bWins + c.summary.ties).toBeLessThanOrEqual(c.metrics.length);
  });

  it("exports JSON with structured sections", () => {
    const json = JSON.parse(buildJsonExport(a));
    expect(json.url).toBe("https://acme.test/");
    for (const k of ["statistics", "dom", "links", "assets", "seo", "accessibility", "technologies", "issues", "scores"]) expect(json).toHaveProperty(k);
    expect(json.dom.nodes.length).toBe(a.dom.nodes.length);
    expect(JSON.parse(buildJsonExport(a, false)).dom.nodes).toBeUndefined();
  });

  it("exports an HTML report without scripts", () => {
    const html = buildHtmlReport(a);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("acme.test");
    expect(html).toContain(String(a.statistics.elements));
    expect(html).not.toMatch(/<script/i);
  });

  it("builds a compact AI context", () => {
    const ctx = buildAnalysisContext(a);
    expect(ctx.length).toBeLessThanOrEqual(9000);
    expect(ctx).toContain("STATISTICS");
    expect(ctx).toContain("section#hero");
  });
});
