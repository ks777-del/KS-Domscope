import type { SeoAnalysis, SeoCheck, CheckStatus } from "@/types/analysis";
import type { PageMetadata } from "@/types/page";
import type { DomDocument } from "@/types/dom";
import { deepText } from "@/lib/parser/dom-parser";

/**
 * SEO scoring: each check has a weight. Score = passed weight / total weight * 100.
 * "warn" earns half credit. Informational checks carry no weight.
 */
const WEIGHTS: Record<string, number> = {
  title: 15,
  "title-length": 5,
  description: 12,
  "description-length": 4,
  canonical: 8,
  h1: 12,
  "single-h1": 4,
  h2: 4,
  "og-basic": 8,
  twitter: 5,
  robots: 6,
  lang: 6,
  favicon: 3,
  viewport: 5,
  "structured-data": 3,
};

export function analyzeSeo(dom: DomDocument, meta: PageMetadata, finalUrl: string): SeoAnalysis {
  const checks: SeoCheck[] = [];
  const add = (id: string, label: string, status: CheckStatus, value: string | null, detail: string) => checks.push({ id, label, status, value, detail });

  const title = meta.title ?? "";
  add("title", "Title", title ? "pass" : "fail", title || null, title ? `Title present (${title.length} chars).` : "No <title> element found in <head>.");
  if (title) {
    const ok = title.length >= 10 && title.length <= 60;
    add("title-length", "Title length", ok ? "pass" : "warn", `${title.length} chars`, ok ? "Within the recommended 10–60 character range." : title.length < 10 ? "Title is very short; consider a more descriptive title." : "Title is longer than 60 characters and may be truncated in search results.");
  }
  const desc = meta.description ?? "";
  add("description", "Meta description", desc ? "pass" : "fail", desc ? desc.slice(0, 200) : null, desc ? `Description present (${desc.length} chars).` : 'No <meta name="description"> found.');
  if (desc) {
    const ok = desc.length >= 50 && desc.length <= 160;
    add("description-length", "Description length", ok ? "pass" : "warn", `${desc.length} chars`, ok ? "Within the recommended 50–160 character range." : desc.length < 50 ? "Description is short; search engines may generate their own snippet." : "Description exceeds 160 characters and may be truncated.");
  }
  if (meta.canonical) {
    const matches = meta.canonical.replace(/\/$/, "") === finalUrl.replace(/\/$/, "");
    add("canonical", "Canonical", "pass", meta.canonical, matches ? "Canonical URL matches the analyzed URL." : "Canonical URL differs from the analyzed URL (may be intentional).");
  } else add("canonical", "Canonical", "warn", null, 'No <link rel="canonical"> found.');

  const headings = dom.nodes.filter((n) => /^h[1-6]$/.test(n.tag)).map((n) => ({ tag: n.tag, text: deepText(dom, n.id, 120), nodeId: n.id }));
  const h1s = headings.filter((h) => h.tag === "h1");
  add("h1", "H1", h1s.length ? "pass" : "fail", h1s[0]?.text ?? null, h1s.length ? `${h1s.length} <h1> element(s) found.` : "No <h1> element found.");
  if (h1s.length) add("single-h1", "Single H1", h1s.length === 1 ? "pass" : "warn", `${h1s.length}`, h1s.length === 1 ? "Exactly one H1." : `Multiple H1 elements (${h1s.length}). Usually one primary heading is recommended.`);
  const h2s = headings.filter((h) => h.tag === "h2");
  add("h2", "H2 structure", h2s.length ? "pass" : "warn", `${h2s.length} H2`, h2s.length ? `${h2s.length} <h2> element(s) found.` : "No <h2> elements; content sections may lack sub-headings.");

  const og = meta.openGraph;
  const ogMissing = ["title", "description", "image", "url"].filter((k) => !og[k]);
  const ogCount = Object.keys(og).length;
  add("og-basic", "Open Graph", ogCount === 0 ? "fail" : ogMissing.length ? "warn" : "pass", ogCount ? `${ogCount} og: tags` : null, ogCount === 0 ? "No Open Graph tags found." : ogMissing.length ? `Missing og:${ogMissing.join(", og:")}.` : "og:title, og:description, og:image and og:url present.");

  const tw = meta.twitter;
  const twCount = Object.keys(tw).length;
  add("twitter", "Twitter card", twCount === 0 ? "warn" : tw.card ? "pass" : "warn", twCount ? `${twCount} twitter: tags` : null, twCount === 0 ? "No twitter: meta tags found (Open Graph is used as fallback by some platforms)." : tw.card ? `twitter:card = ${tw.card}` : "twitter:card is missing.");

  const robots = meta.robots?.toLowerCase() ?? "";
  if (/noindex/.test(robots)) add("robots", "Robots meta", "fail", meta.robots, "The page is marked noindex and will be excluded from search indexes.");
  else if (/nofollow/.test(robots)) add("robots", "Robots meta", "warn", meta.robots, "Robots meta contains nofollow.");
  else add("robots", "Robots meta", "pass", meta.robots ?? "not set", meta.robots ? "Robots meta permits indexing." : "No robots meta tag; indexing is allowed by default.");

  add("lang", "Language", meta.lang ? "pass" : "fail", meta.lang, meta.lang ? `<html lang="${meta.lang}">` : "The <html> element has no lang attribute.");
  add("favicon", "Favicon", meta.favicon ? "pass" : "warn", meta.favicon, meta.favicon ? "Favicon link found." : 'No <link rel="icon"> found (browsers may fall back to /favicon.ico, which was not verified).');
  add("viewport", "Viewport", meta.viewport ? "pass" : "fail", meta.viewport, meta.viewport ? "Viewport meta present (mobile friendly signal)." : "No viewport meta tag; page may not render well on mobile devices.");
  add("structured-data", "Structured data", meta.jsonLdCount ? "pass" : "info", meta.jsonLdCount ? `${meta.jsonLdCount} JSON-LD block(s): ${meta.jsonLdTypes.join(", ") || "no @type"}` : null, meta.jsonLdCount ? "JSON-LD structured data detected." : "No JSON-LD structured data (optional).");
  if (meta.hreflang.length) add("hreflang", "Hreflang", "info", `${meta.hreflang.length} alternates`, meta.hreflang.map((h) => h.lang).join(", "));
  add("charset", "Charset", meta.charset ? "pass" : "info", meta.charset, meta.charset ? "Character encoding declared." : "No <meta charset> found in the HTML (may be provided by HTTP headers).");

  let total = 0;
  let earned = 0;
  const scoring: string[] = [];
  for (const c of checks) {
    const w = WEIGHTS[c.id];
    if (!w) continue;
    total += w;
    const credit = c.status === "pass" ? w : c.status === "warn" ? w / 2 : 0;
    earned += credit;
    scoring.push(`${c.label}: ${credit}/${w}`);
  }
  const score = total ? Math.round((earned / total) * 100) : 0;
  return { score, checks, headings, scoring };
}
