import type { PageStatistics, RepeatedPattern } from "@/types/analysis";
import type { ParsedDocument } from "@/lib/parser/dom-parser";
import type { DomDocument } from "@/types/dom";

const VOID_TEXT = new Set(["script", "style", "noscript", "template"]);

export function analyzeDom(doc: ParsedDocument, htmlSize: number): PageStatistics {
  const { dom } = doc;
  const tagCounts = new Map<string, number>();
  const classes = new Set<string>();
  const ids = new Set<string>();
  let attributeCount = 0;
  let textSize = 0;
  const headings = { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 };
  let links = 0,
    images = 0,
    forms = 0,
    scripts = 0,
    stylesheets = 0,
    iframes = 0,
    tables = 0,
    buttons = 0,
    inputs = 0;

  for (const n of dom.nodes) {
    tagCounts.set(n.tag, (tagCounts.get(n.tag) ?? 0) + 1);
    for (const c of n.classes) classes.add(c);
    if (n.idAttr) ids.add(n.idAttr);
    attributeCount += Object.keys(n.attributes).length;
    if (!VOID_TEXT.has(n.tag)) textSize += n.textLength;
    switch (n.tag) {
      case "a":
        if (n.attributes.href !== undefined) links++;
        break;
      case "img":
        images++;
        break;
      case "form":
        forms++;
        break;
      case "script":
        scripts++;
        break;
      case "link":
        if ((n.attributes.rel ?? "").toLowerCase().split(/\s+/).includes("stylesheet")) stylesheets++;
        break;
      case "iframe":
        iframes++;
        break;
      case "table":
        tables++;
        break;
      case "button":
        buttons++;
        break;
      case "input":
      case "select":
      case "textarea":
        inputs++;
        break;
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6":
        headings[n.tag]++;
        break;
    }
  }

  const tagFrequency = [...tagCounts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);

  return {
    elements: dom.totalElements,
    maxDepth: dom.maxDepth,
    textNodes: dom.totalTextNodes,
    comments: dom.totalComments,
    links,
    images,
    forms,
    scripts,
    stylesheets,
    htmlSize,
    textSize,
    attributeCount,
    uniqueTags: tagCounts.size,
    uniqueClasses: classes.size,
    uniqueIds: ids.size,
    tagFrequency,
    headings,
    iframes,
    tables,
    buttons,
    inputs,
  };
}

/**
 * Detect repeated, component-like structures.
 * 1) Class-based: identical (tag + sorted class list) appearing >= 3 times with children.
 * 2) Structure-based: identical shallow child-tag signature appearing >= 3 times.
 * These are inferred patterns, not guaranteed framework components.
 */
export function detectRepeatedPatterns(dom: DomDocument, limit = 25): RepeatedPattern[] {
  const byClass = new Map<string, { tag: string; ids: number[]; children: number }>();
  const byStructure = new Map<string, { tag: string; ids: number[]; children: number }>();
  const skipTags = new Set(["html", "head", "body", "script", "style", "link", "meta", "br", "hr", "span", "b", "i", "strong", "em", "path", "g", "tspan", "circle", "rect", "line", "polygon", "use", "stop", "defs", "linearGradient"]);
  for (const n of dom.nodes) {
    if (skipTags.has(n.tag)) continue;
    if (n.classes.length) {
      const meaningful = n.classes.filter((c) => !/^\d|^(is|has)-/.test(c)).sort();
      if (meaningful.length && n.children.length > 0) {
        const key = `${n.tag}|.${meaningful.join(".")}`;
        const e = byClass.get(key) ?? { tag: n.tag, ids: [], children: 0 };
        e.ids.push(n.id);
        e.children += n.children.length;
        byClass.set(key, e);
      }
    }
    if (n.children.length >= 2 && n.children.length <= 12) {
      const sig = n.children.map((c) => dom.nodes[c]?.tag ?? "?").join(">");
      const key = `${n.tag}[${sig}]`;
      const e = byStructure.get(key) ?? { tag: n.tag, ids: [], children: 0 };
      e.ids.push(n.id);
      e.children += n.children.length;
      byStructure.set(key, e);
    }
  }
  const out: RepeatedPattern[] = [];
  for (const [key, e] of byClass) {
    if (e.ids.length >= 3) {
      out.push({
        signature: key.split("|")[1],
        kind: "class",
        count: e.ids.length,
        tag: e.tag,
        exampleNodeIds: e.ids.slice(0, 5),
        averageChildren: Math.round((e.children / e.ids.length) * 10) / 10,
      });
    }
  }
  for (const [key, e] of byStructure) {
    if (e.ids.length >= 3) {
      out.push({
        signature: key,
        kind: "structure",
        count: e.ids.length,
        tag: e.tag,
        exampleNodeIds: e.ids.slice(0, 5),
        averageChildren: Math.round((e.children / e.ids.length) * 10) / 10,
      });
    }
  }
  return out.sort((a, b) => b.count - a.count || a.signature.localeCompare(b.signature)).slice(0, limit);
}
