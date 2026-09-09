import { describe, it, expect } from "vitest";
import { SAMPLE_HTML, MINIMAL_HTML } from "./fixtures/sample-page";
import { parse } from "./helpers";
import { extractMetadata } from "@/lib/parser/metadata-parser";
import { nodePath, describeNode, deepText } from "@/lib/parser/dom-parser";
import { offsetToPosition, computeLineStarts } from "@/lib/parser/html-parser";

describe("HTML parsing & DOM construction", () => {
  const doc = parse(SAMPLE_HTML);
  it("builds a rooted tree with parent/child links and depths", () => {
    const root = doc.dom.nodes[doc.dom.root];
    expect(root.tag).toBe("html");
    expect(root.depth).toBe(0);
    const body = doc.dom.nodes.find((n) => n.tag === "body")!;
    expect(body.parent).toBe(root.id);
    expect(body.depth).toBe(1);
    for (const n of doc.dom.nodes) {
      if (n.parent !== null) {
        expect(doc.dom.nodes[n.parent].children).toContain(n.id);
        expect(n.depth).toBe(doc.dom.nodes[n.parent].depth + 1);
      }
    }
  });
  it("extracts ids, classes, attributes and text", () => {
    const hero = doc.dom.nodes.find((n) => n.idAttr === "hero")!;
    expect(hero.tag).toBe("section");
    expect(hero.classes).toEqual(["hero", "container"]);
    expect(hero.depth).toBe(3);
    const h1 = doc.dom.nodes.find((n) => n.tag === "h1")!;
    expect(h1.textPreview).toBe("Widgets you can trust");
    expect(describeNode(hero)).toBe("section#hero.hero.container");
    expect(nodePath(doc.dom, h1.id)).toBe("html > body > main > section#hero.hero.container > h1");
  });
  it("counts descendants and text nodes and captures source positions", () => {
    const main = doc.dom.nodes.find((n) => n.tag === "main")!;
    expect(main.descendantCount).toBeGreaterThan(20);
    expect(doc.dom.totalTextNodes).toBeGreaterThan(15);
    expect(main.sourceLine).toBeGreaterThan(30);
    expect(doc.dom.maxDepth).toBeGreaterThanOrEqual(6);
  });
  it("keeps inline script/style content out of the tree but available", () => {
    const ld = doc.dom.nodes.find((n) => n.tag === "script" && n.attributes.type === "application/ld+json")!;
    expect(doc.inlineContent.get(ld.id)).toContain("Organization");
    expect(deepText(doc.dom, doc.dom.root)).not.toContain("dataLayer");
  });
  it("handles fragments without <html>", () => {
    const d = parse("<div><p>hi</p></div>");
    expect(d.dom.nodes[d.dom.root].tag).toBe("html");
    expect(d.dom.nodes.some((n) => n.tag === "p")).toBe(true);
  });
  it("maps offsets to lines", () => {
    const ls = computeLineStarts("ab\ncd\nef");
    expect(offsetToPosition(ls, 0)).toEqual({ line: 1, column: 1 });
    expect(offsetToPosition(ls, 4)).toEqual({ line: 2, column: 2 });
  });
  it("minimal doc depth", () => {
    expect(parse(MINIMAL_HTML).dom.maxDepth).toBe(5);
  });
});

describe("Metadata extraction", () => {
  const doc = parse(SAMPLE_HTML);
  const m = extractMetadata(doc, "https://acme.test/");
  it("extracts core metadata", () => {
    expect(m.title).toBe("Acme Widgets — Quality widgets for everyone");
    expect(m.description).toMatch(/best widgets/);
    expect(m.canonical).toBe("https://acme.test/");
    expect(m.lang).toBe("en");
    expect(m.charset).toBe("utf-8");
    expect(m.viewport).toContain("width=device-width");
    expect(m.favicon).toBe("https://acme.test/favicon.ico");
  });
  it("extracts social and structured data", () => {
    expect(m.openGraph.title).toBe("Acme Widgets");
    expect(Object.keys(m.openGraph)).toHaveLength(4);
    expect(m.twitter.card).toBe("summary_large_image");
    expect(m.jsonLdCount).toBe(1);
    expect(m.jsonLdTypes).toEqual(["Organization"]);
  });
  it("reports missing values as null", () => {
    const m2 = extractMetadata(parse(MINIMAL_HTML), "https://x.test/");
    expect(m2.title).toBeNull();
    expect(m2.description).toBeNull();
    expect(m2.lang).toBeNull();
  });
});
