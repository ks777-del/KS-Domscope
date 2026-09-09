import type { AnalysisResult } from "@/types/analysis";
import { describeNode } from "@/lib/parser/dom-parser";

/**
 * Build a compact, structured context for the model. We never send raw HTML —
 * only the derived analysis, capped to keep prompts small (~6–8k chars).
 */
export function buildAnalysisContext(r: AnalysisResult): string {
  const s = r.statistics;
  const body = r.dom.nodes.find((n) => n.tag === "body");
  const outline: string[] = [];
  if (body) {
    const walk = (id: number, depth: number) => {
      const n = r.dom.nodes[id];
      if (!n || depth > 3 || outline.length > 60) return;
      if (["script", "style", "link", "meta", "noscript", "svg", "path", "br"].includes(n.tag)) return;
      if (depth > 1 && n.descendantCount < 3) return;
      outline.push(`${"  ".repeat(depth)}${describeNode(n)} (${n.descendantCount} desc${n.textPreview && n.textLength < 80 ? `, "${n.textPreview.slice(0, 40)}"` : ""})`);
      for (const c of n.children) walk(c, depth + 1);
    };
    walk(body.id, 0);
  }
  const lines = [
    `URL: ${r.url}`,
    `Fetched: HTTP ${r.fetch.status}, ${(r.fetch.size / 1024).toFixed(1)} KB, ${r.fetch.redirects.length} redirects, robots.txt: ${r.fetch.robots.status}`,
    `Title: ${r.metadata.title ?? "none"} | Description: ${r.metadata.description?.slice(0, 160) ?? "none"} | Lang: ${r.metadata.lang ?? "none"} | Canonical: ${r.metadata.canonical ?? "none"} | Generator: ${r.metadata.generator ?? "none"}`,
    `Open Graph keys: ${Object.keys(r.metadata.openGraph).join(", ") || "none"} | Twitter keys: ${Object.keys(r.metadata.twitter).join(", ") || "none"} | JSON-LD: ${r.metadata.jsonLdTypes.join(", ") || "none"}`,
    "",
    `STATISTICS: ${s.elements} elements, max depth ${s.maxDepth}, ${s.textNodes} text nodes, ${s.links} links, ${s.images} images, ${s.forms} forms, ${s.scripts} scripts, ${s.stylesheets} stylesheets, ${s.uniqueTags} unique tags, ${s.uniqueClasses} unique classes, ${s.uniqueIds} ids, headings h1:${s.headings.h1} h2:${s.headings.h2} h3:${s.headings.h3}`,
    `Top tags: ${s.tagFrequency.slice(0, 12).map((t) => `${t.tag}:${t.count}`).join(", ")}`,
    "",
    "DOM OUTLINE (body, depth ≤ 3, pruned):",
    ...outline,
    "",
    `HEADINGS: ${r.seo.headings.slice(0, 15).map((h) => `${h.tag}:"${h.text.slice(0, 50)}"`).join(" | ") || "none"}`,
    `LINKS: internal ${r.links.counts.internal}, external ${r.links.counts.external}, anchor ${r.links.counts.anchor}, mailto ${r.links.counts.mailto}, tel ${r.links.counts.tel}; external domains: ${r.links.externalDomains.slice(0, 8).map((d) => `${d.domain}(${d.count})`).join(", ") || "none"}`,
    `NAV LINKS: ${r.links.links.filter((l) => isInsideTag(r, l.nodeId, "nav")).slice(0, 15).map((l) => `"${l.text.slice(0, 30)}"→${l.href.slice(0, 40)}`).join(", ") || "no <nav> links"}`,
    `ASSETS: ${Object.entries(r.assets.counts).filter(([, v]) => v).map(([k, v]) => `${k}:${v}`).join(", ")}; ${r.assets.lazyImages} lazy images, ${r.assets.imagesWithoutDimensions} images without dimensions; domains: ${r.assets.assetDomains.slice(0, 8).map((d) => d.domain).join(", ")}`,
    `SCRIPTS: ${r.scripts.external} external, ${r.scripts.inline} inline, ${r.scripts.async} async, ${r.scripts.defer} defer, ${r.scripts.module} module, ${r.scripts.blockingInHead} blocking in head; sources: ${r.scripts.scripts.filter((x) => x.src).slice(0, 12).map((x) => x.src!.slice(0, 70)).join(", ")}`,
    `STYLES: ${r.styles.externalStylesheets} stylesheets, ${r.styles.inlineStyleBlocks} style blocks, ${r.styles.elementsWithStyle} elements with inline style, top classes: ${r.styles.topClasses.slice(0, 15).map((c) => `${c.name}(${c.count})`).join(", ")}`,
    "",
    `TECHNOLOGIES: ${r.technologies.map((t) => `${t.name} [${t.confidence}: ${t.evidence[0]}]`).join("; ") || "none detected"}`,
    `SEO (score ${r.seo.score}): ${r.seo.checks.map((c) => `${c.label}=${c.status}`).join(", ")}`,
    `ACCESSIBILITY (score ${r.accessibility.score}, static): images alt ${r.accessibility.images.withAlt}/${r.accessibility.images.total} (${r.accessibility.images.missing} missing), inputs labelled ${r.accessibility.forms.labelled}/${r.accessibility.forms.inputs}, buttons named ${r.accessibility.buttons.named}/${r.accessibility.buttons.total}, generic links ${r.accessibility.links.generic}, empty links ${r.accessibility.links.empty}, landmarks: ${r.accessibility.landmarks.join(",") || "none"}, heading issues: ${r.accessibility.headingIssues.join("; ") || "none"}`,
    `COMPLEXITY (score ${r.complexity.score}): ${r.complexity.explanation} Largest branches: ${r.complexity.largestBranches.slice(0, 5).map((b) => `${b.label}(${b.descendants})`).join(", ")}. Deepest: ${r.complexity.deepestPaths[0]?.path.slice(-200) ?? "n/a"}`,
    `REPEATED PATTERNS (inferred): ${r.patterns.slice(0, 10).map((p) => `${p.signature}×${p.count}`).join(", ") || "none"}`,
    `SCORES: overall ${r.scores.overall}, seo ${r.scores.seo}, a11y ${r.scores.accessibility}, structure ${r.scores.structure}, metadata ${r.scores.metadata}, complexity ${r.scores.complexity}, technology ${r.scores.technology}`,
    `ISSUES (${r.issues.length}): ${r.issues.slice(0, 25).map((i) => `[${i.severity}/${i.category}] ${i.title}`).join("; ")}`,
  ];
  return lines.join("\n").slice(0, 9000);
}

function isInsideTag(r: AnalysisResult, id: number, tag: string): boolean {
  let cur = r.dom.nodes[id]?.parent ?? null;
  while (cur !== null) {
    if (r.dom.nodes[cur].tag === tag) return true;
    cur = r.dom.nodes[cur].parent;
  }
  return false;
}

export const SYSTEM_PROMPT = `You are DOMScope, a website anatomy assistant. You answer questions about ONE analyzed web page using ONLY the structured analysis context provided. Rules:
- Ground every statement in the context (cite element names, counts, technologies, evidence).
- If the context does not contain the information, say it is not available in the analysis. Never invent elements, features, technologies, or numbers.
- The accessibility results are static heuristics, and technology detections are evidence-based inferences; say so when relevant.
- Be concise, technical and concrete. Use short paragraphs or bullet lists. No marketing language.`;
