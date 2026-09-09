import type { StyleAnalysis } from "@/types/analysis";
import type { ParsedDocument } from "@/lib/parser/dom-parser";

export function analyzeStyles(doc: ParsedDocument): StyleAnalysis {
  const { dom } = doc;
  const stylesheets: StyleAnalysis["stylesheets"] = [];
  const styleBlocks: StyleAnalysis["styleBlocks"] = [];
  const classCounts = new Map<string, number>();
  let elementsWithStyle = 0, inlineStyleBytes = 0, styleBlockBytes = 0, fontFaces = 0, importantCount = 0, mediaQueries = 0, totalClassUsages = 0;

  for (const n of dom.nodes) {
    if (n.attributes.style !== undefined) {
      elementsWithStyle++;
      inlineStyleBytes += n.attributes.style.length;
      importantCount += (n.attributes.style.match(/!important/g) ?? []).length;
    }
    for (const c of n.classes) {
      totalClassUsages++;
      classCounts.set(c, (classCounts.get(c) ?? 0) + 1);
    }
    if (n.tag === "link" && n.attributes.href && (n.attributes.rel ?? "").toLowerCase().split(/\s+/).includes("stylesheet")) {
      stylesheets.push({ href: n.attributes.href, media: n.attributes.media ?? null, nodeId: n.id });
    }
    if (n.tag === "style") {
      const css = doc.inlineContent.get(n.id) ?? "";
      styleBlockBytes += css.length;
      fontFaces += (css.match(/@font-face/gi) ?? []).length;
      importantCount += (css.match(/!important/g) ?? []).length;
      mediaQueries += (css.match(/@media/gi) ?? []).length;
      styleBlocks.push({ size: css.length, nodeId: n.id, preview: css.trim().slice(0, 120).replace(/\s+/g, " ") });
    }
  }
  return {
    externalStylesheets: stylesheets.length,
    inlineStyleBlocks: styleBlocks.length,
    elementsWithStyle,
    inlineStyleBytes,
    styleBlockBytes,
    stylesheets,
    styleBlocks,
    topClasses: [...classCounts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 40),
    totalClassUsages,
    uniqueClasses: classCounts.size,
    fontFaces,
    importantCount,
    mediaQueries,
  };
}
