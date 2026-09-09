import type { AnalysisResult } from "@/types/analysis";
import type { ComparisonMetric, ComparisonResult } from "@/types/comparison";

type Dir = "lower" | "higher" | "neutral";

export function compareSites(a: AnalysisResult, b: AnalysisResult): ComparisonResult {
  const metrics: ComparisonMetric[] = [];
  const add = (group: string, key: string, label: string, va: number | string | null, vb: number | string | null, direction: Dir) => {
    let better: ComparisonMetric["better"] = null;
    if (direction !== "neutral" && typeof va === "number" && typeof vb === "number") {
      if (va === vb) better = "tie";
      else if (direction === "lower") better = va < vb ? "a" : "b";
      else better = va > vb ? "a" : "b";
    }
    metrics.push({ key, label, group, a: va, b: vb, better, direction });
  };

  add("DOM", "elements", "DOM elements", a.statistics.elements, b.statistics.elements, "lower");
  add("DOM", "depth", "Max depth", a.statistics.maxDepth, b.statistics.maxDepth, "lower");
  add("DOM", "textNodes", "Text nodes", a.statistics.textNodes, b.statistics.textNodes, "neutral");
  add("DOM", "uniqueTags", "Unique tags", a.statistics.uniqueTags, b.statistics.uniqueTags, "neutral");
  add("DOM", "uniqueClasses", "Unique classes", a.statistics.uniqueClasses, b.statistics.uniqueClasses, "neutral");
  add("DOM", "htmlSize", "HTML size (KB)", Math.round(a.statistics.htmlSize / 1024), Math.round(b.statistics.htmlSize / 1024), "lower");
  add("Resources", "scripts", "Scripts", a.scripts.total, b.scripts.total, "lower");
  add("Resources", "externalScripts", "External scripts", a.scripts.external, b.scripts.external, "lower");
  add("Resources", "blocking", "Blocking scripts in head", a.scripts.blockingInHead, b.scripts.blockingInHead, "lower");
  add("Resources", "stylesheets", "Stylesheets", a.styles.externalStylesheets, b.styles.externalStylesheets, "lower");
  add("Resources", "images", "Images", a.statistics.images, b.statistics.images, "neutral");
  add("Resources", "lazyImages", "Lazy-loaded images", a.assets.lazyImages, b.assets.lazyImages, "higher");
  add("Resources", "fonts", "Fonts", a.assets.counts.font, b.assets.counts.font, "lower");
  add("Resources", "assetDomains", "Asset domains", a.assets.assetDomains.length, b.assets.assetDomains.length, "lower");
  add("Links", "links", "Links", a.links.total, b.links.total, "neutral");
  add("Links", "internal", "Internal links", a.links.counts.internal, b.links.counts.internal, "neutral");
  add("Links", "external", "External links", a.links.counts.external, b.links.counts.external, "neutral");
  add("SEO", "title", "Title", a.metadata.title ? "✓" : "✗", b.metadata.title ? "✓" : "✗", "neutral");
  add("SEO", "description", "Meta description", a.metadata.description ? "✓" : "✗", b.metadata.description ? "✓" : "✗", "neutral");
  add("SEO", "canonical", "Canonical", a.metadata.canonical ? "✓" : "✗", b.metadata.canonical ? "✓" : "✗", "neutral");
  add("SEO", "h1", "H1 count", a.statistics.headings.h1, b.statistics.headings.h1, "neutral");
  add("SEO", "og", "Open Graph tags", Object.keys(a.metadata.openGraph).length, Object.keys(b.metadata.openGraph).length, "higher");
  add("SEO", "jsonld", "JSON-LD blocks", a.metadata.jsonLdCount, b.metadata.jsonLdCount, "higher");
  add("Accessibility", "imgAlt", "Images with alt", pct(a.accessibility.images.withAlt + a.accessibility.images.decorative, a.accessibility.images.total), pct(b.accessibility.images.withAlt + b.accessibility.images.decorative, b.accessibility.images.total), "higher");
  add("Accessibility", "labelled", "Labelled inputs", pct(a.accessibility.forms.labelled, a.accessibility.forms.inputs), pct(b.accessibility.forms.labelled, b.accessibility.forms.inputs), "higher");
  add("Accessibility", "a11yIssues", "Accessibility findings", a.accessibility.issues.length, b.accessibility.issues.length, "lower");
  add("Accessibility", "landmarks", "Landmarks", a.accessibility.landmarks.length, b.accessibility.landmarks.length, "higher");
  add("Issues", "critical", "Critical issues", a.issues.filter((i) => i.severity === "critical").length, b.issues.filter((i) => i.severity === "critical").length, "lower");
  add("Issues", "warnings", "Warnings", a.issues.filter((i) => i.severity === "warning").length, b.issues.filter((i) => i.severity === "warning").length, "lower");
  add("Scores", "seoScore", "SEO score", a.scores.seo, b.scores.seo, "higher");
  add("Scores", "a11yScore", "Accessibility score", a.scores.accessibility, b.scores.accessibility, "higher");
  add("Scores", "structureScore", "Structure score", a.scores.structure, b.scores.structure, "higher");
  add("Scores", "metadataScore", "Metadata score", a.scores.metadata, b.scores.metadata, "higher");
  add("Scores", "complexity", "DOM complexity", a.complexity.score, b.complexity.score, "lower");
  add("Scores", "overall", "Overall score", a.scores.overall, b.scores.overall, "higher");

  const names = new Set([...a.technologies.map((t) => t.name), ...b.technologies.map((t) => t.name)]);
  const technologies = [...names].sort().map((name) => ({ name, inA: a.technologies.some((t) => t.name === name), inB: b.technologies.some((t) => t.name === name) }));
  const summary = { aWins: metrics.filter((m) => m.better === "a").length, bWins: metrics.filter((m) => m.better === "b").length, ties: metrics.filter((m) => m.better === "tie").length };
  return { a: { url: a.url, id: a.id, hostname: a.hostname }, b: { url: b.url, id: b.id, hostname: b.hostname }, metrics, technologies, summary };
}

function pct(part: number, total: number): number | null {
  if (!total) return null;
  return Math.round((part / total) * 100);
}
