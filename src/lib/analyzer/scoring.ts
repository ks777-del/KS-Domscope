import type { AnalysisResult, ScoreBreakdown } from "@/types/analysis";

type Partial = Omit<AnalysisResult, "scores" | "id" | "analysisDurationMs" | "analyzedAt">;

/**
 * DOMScope scoring model (documented in README):
 *  SEO            = seo analyzer weighted checks
 *  Accessibility  = accessibility analyzer penalties
 *  Structure      = 100 − structural issue penalties (critical 15, warning 8, suggestion 3) − div-heaviness
 *  Metadata       = share of metadata signals present (title, description, canonical, OG, twitter, favicon, viewport, charset, lang, JSON-LD)
 *  Complexity     = 100 − complexity score (higher = simpler)
 *  Technology     = modern-practice signals (defer/async/module scripts, lazy images, no blocking scripts, https assets, preload hints)
 *  Overall        = weighted mean: SEO 25%, Accessibility 25%, Structure 15%, Metadata 15%, Complexity 10%, Technology 10%
 */
export function computeScores(r: Partial): ScoreBreakdown {
  const notes: Record<string, string[]> = {};
  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

  const seo = r.seo.score;
  notes.seo = r.seo.scoring;
  const accessibility = r.accessibility.score;
  notes.accessibility = r.accessibility.scoring;

  let structure = 100;
  const sNotes: string[] = [];
  for (const i of r.issues) {
    if (i.category !== "Structure") continue;
    const p = i.severity === "critical" ? 15 : i.severity === "warning" ? 8 : 3;
    structure -= p;
    sNotes.push(`${i.title}: -${p}`);
  }
  const semantic = ["header", "nav", "main", "footer", "section", "article", "aside"].filter((t) => r.dom.nodes.some((n) => n.tag === t));
  if (semantic.length >= 4) sNotes.push(`Semantic landmarks present (${semantic.join(", ")}): +0`);
  else {
    const p = (4 - semantic.length) * 4;
    structure -= p;
    sNotes.push(`Few semantic elements (${semantic.join(", ") || "none"}): -${p}`);
  }
  notes.structure = sNotes.length ? sNotes : ["No structural penalties"];

  const m = r.metadata;
  const signals: [string, boolean][] = [
    ["title", Boolean(m.title)],
    ["description", Boolean(m.description)],
    ["canonical", Boolean(m.canonical)],
    ["open graph (≥3 tags)", Object.keys(m.openGraph).length >= 3],
    ["twitter card", Boolean(m.twitter.card)],
    ["favicon", Boolean(m.favicon)],
    ["viewport", Boolean(m.viewport)],
    ["charset", Boolean(m.charset)],
    ["lang", Boolean(m.lang)],
    ["structured data", m.jsonLdCount > 0],
  ];
  const present = signals.filter(([, ok]) => ok).length;
  const metadata = clamp((present / signals.length) * 100);
  notes.metadata = signals.map(([name, ok]) => `${ok ? "✓" : "✗"} ${name}`);

  const complexity = clamp(100 - r.complexity.score);
  notes.complexity = [`100 − complexity score (${r.complexity.score})`, ...r.complexity.breakdown.map((b) => `${b.metric}: -${b.penalty}`)];

  let technology = 100;
  const tNotes: string[] = [];
  const s = r.scripts;
  if (s.external > 0) {
    const nonBlocking = s.scripts.filter((x) => !x.inline && (x.async || x.defer || x.module)).length;
    const share = nonBlocking / s.external;
    const p = Math.round((1 - share) * 25);
    technology -= p;
    tNotes.push(`${nonBlocking}/${s.external} external scripts are async/defer/module: -${p}`);
  }
  if (s.blockingInHead) {
    const p = Math.min(20, s.blockingInHead * 5);
    technology -= p;
    tNotes.push(`${s.blockingInHead} blocking scripts in head: -${p}`);
  }
  if (r.statistics.images > 5) {
    const share = r.assets.lazyImages / r.statistics.images;
    const p = Math.round((1 - Math.min(1, share * 2)) * 15);
    technology -= p;
    tNotes.push(`${r.assets.lazyImages}/${r.statistics.images} images lazy-loaded: -${p}`);
  }
  const httpAssets = r.assets.assets.filter((a) => a.url?.startsWith("http://")).length;
  if (httpAssets) {
    const p = Math.min(15, httpAssets * 3);
    technology -= p;
    tNotes.push(`${httpAssets} assets over plain http: -${p}`);
  }
  const hints = r.assets.assets.filter((a) => /preload|preconnect|modulepreload/.test(a.detail ?? "")).length + r.dom.nodes.filter((n) => n.tag === "link" && /preconnect|dns-prefetch/.test(n.attributes.rel ?? "")).length;
  if (!hints && (s.external > 3 || r.assets.assetDomains.length > 3)) {
    technology -= 10;
    tNotes.push("No preload/preconnect resource hints: -10");
  }
  if (r.assets.imagesWithoutDimensions > 3) {
    const p = Math.min(15, r.assets.imagesWithoutDimensions * 2);
    technology -= p;
    tNotes.push(`${r.assets.imagesWithoutDimensions} images without dimensions: -${p}`);
  }
  notes.technology = tNotes.length ? tNotes : ["No technology penalties"];

  const st = clamp(structure);
  const te = clamp(technology);
  const overall = clamp(seo * 0.25 + accessibility * 0.25 + st * 0.15 + metadata * 0.15 + complexity * 0.1 + te * 0.1);
  notes.overall = ["SEO 25% · Accessibility 25% · Structure 15% · Metadata 15% · Complexity 10% · Technology 10%"];
  return { seo, accessibility, structure: st, metadata, complexity, technology: te, overall, notes };
}
