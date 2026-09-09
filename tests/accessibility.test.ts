import { describe, it, expect } from "vitest";
import { SAMPLE_HTML } from "./fixtures/sample-page";
import { parse } from "./helpers";
import { analyzeAccessibility } from "@/lib/analyzer/accessibility-analyzer";

describe("Accessibility analysis (static)", () => {
  const a = analyzeAccessibility(parse(SAMPLE_HTML).dom);
  it("evaluates images", () => {
    expect(a.images.total).toBe(3);
    expect(a.images.withAlt).toBe(1);
    expect(a.images.decorative).toBe(1);
    expect(a.images.missing).toBe(1);
  });
  it("evaluates form labels", () => {
    expect(a.forms.inputs).toBe(2);
    expect(a.forms.labelled).toBe(1);
    expect(a.forms.unlabelled).toBe(1);
    expect(a.issues.some((i) => i.rule === "input-label" && i.evidence.includes('name="name"'))).toBe(true);
  });
  it("evaluates buttons and links", () => {
    expect(a.buttons.total).toBe(2);
    expect(a.buttons.named).toBe(1);
    expect(a.buttons.unnamed).toBe(1);
    expect(a.links.generic).toBe(1); // "Click here"
    expect(a.links.empty).toBe(0);
  });
  it("evaluates document-level signals", () => {
    expect(a.lang).toBe("en");
    expect(a.landmarks).toEqual(expect.arrayContaining(["banner", "navigation", "main", "contentinfo", "form"]));
    expect(a.headingIssues.some((h) => h.includes("skipped"))).toBe(true); // h1 -> h3
    expect(a.iframesWithoutTitle).toBe(1);
    expect(a.score).toBeLessThan(100);
    expect(a.score).toBeGreaterThan(30);
  });
  it("penalizes a missing lang attribute", () => {
    const b = analyzeAccessibility(parse("<html><body><p>x</p></body></html>").dom);
    expect(b.lang).toBeNull();
    expect(b.issues.some((i) => i.rule === "html-lang")).toBe(true);
  });
});
