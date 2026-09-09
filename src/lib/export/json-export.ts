import type { AnalysisResult } from "@/types/analysis";

/** Structured JSON snapshot (DOM trimmed to keep exports portable). */
export function buildJsonExport(r: AnalysisResult, includeDom = true): string {
  const payload = {
    tool: "DOMScope",
    version: 1,
    exportedAt: new Date().toISOString(),
    url: r.url,
    hostname: r.hostname,
    analyzedAt: r.analyzedAt,
    fetch: r.fetch,
    metadata: r.metadata,
    statistics: r.statistics,
    scores: r.scores,
    dom: includeDom ? r.dom : { totalElements: r.dom.totalElements, maxDepth: r.dom.maxDepth, note: "DOM nodes omitted" },
    links: r.links,
    assets: r.assets,
    scripts: r.scripts,
    styles: r.styles,
    seo: r.seo,
    accessibility: r.accessibility,
    technologies: r.technologies,
    complexity: r.complexity,
    patterns: r.patterns,
    issues: r.issues,
  };
  return JSON.stringify(payload, null, 2);
}

export function exportFilename(r: AnalysisResult, ext: string): string {
  const host = r.hostname.replace(/[^a-z0-9.-]/gi, "_");
  const stamp = r.analyzedAt.replace(/[:.]/g, "-").slice(0, 19);
  return `domscope-${host}-${stamp}.${ext}`;
}
