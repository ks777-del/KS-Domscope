import type { AnalysisResult, Issue, IssueSeverity } from "@/types/analysis";
import { describeNode } from "@/lib/parser/dom-parser";

type Partial = Omit<AnalysisResult, "issues" | "scores" | "id" | "analysisDurationMs" | "analyzedAt">;

/** Build the unified issue list from all analyzers. Every issue references real evidence. */
export function buildIssues(r: Partial): Issue[] {
  const issues: Issue[] = [];
  let seq = 0;
  const add = (category: Issue["category"], severity: IssueSeverity, title: string, description: string, evidence: string, nodeId: number | null = null) =>
    issues.push({ id: `issue-${++seq}`, category, severity, title, description, evidence, nodeId });

  // SEO / Metadata from checks
  for (const c of r.seo.checks) {
    if (c.status === "pass" || c.status === "info") continue;
    const metadataIds = new Set(["og-basic", "twitter", "favicon", "charset", "viewport", "structured-data"]);
    const category = metadataIds.has(c.id) ? "Metadata" : "SEO";
    const severity: IssueSeverity = c.status === "fail" ? (["title", "h1", "description", "lang"].includes(c.id) ? "critical" : "warning") : c.id.endsWith("length") || c.id === "h2" || c.id === "twitter" || c.id === "favicon" ? "suggestion" : "warning";
    add(category, severity, `${c.status === "fail" ? "Missing" : "Weak"}: ${c.label}`, c.detail, c.value ? `Value: ${c.value}` : `No ${c.label.toLowerCase()} detected in the HTML.`);
  }

  // Accessibility (cap noisy duplicates per rule)
  const perRule = new Map<string, number>();
  for (const a of r.accessibility.issues) {
    const n = (perRule.get(a.rule) ?? 0) + 1;
    perRule.set(a.rule, n);
    if (n > 15) continue;
    add("Accessibility", a.severity, a.message, ruleDescription(a.rule), a.evidence, a.nodeId);
  }
  for (const [rule, n] of perRule) if (n > 15) add("Accessibility", "warning", `${n - 15} more "${rule}" occurrences not listed`, "Only the first 15 occurrences of this rule are shown individually.", `${n} total occurrences`);

  // Structure
  const { complexity, statistics, dom } = r;
  if (complexity.maxDepth > 24) add("Structure", "warning", `Very deep DOM (${complexity.maxDepth} levels)`, "Deep nesting increases style recalculation cost and makes the markup harder to maintain.", `Deepest path: ${complexity.deepestPaths[0]?.path.slice(-160) ?? "n/a"}`, complexity.deepestPaths[0]?.nodeId ?? null);
  else if (complexity.maxDepth > 16) add("Structure", "suggestion", `Deep DOM (${complexity.maxDepth} levels)`, "Nesting beyond ~16 levels is a sign of wrapper-heavy markup.", `Deepest path: ${complexity.deepestPaths[0]?.path.slice(-160) ?? "n/a"}`, complexity.deepestPaths[0]?.nodeId ?? null);
  if (statistics.elements > 1500) add("Structure", statistics.elements > 3000 ? "warning" : "suggestion", `Large DOM (${statistics.elements.toLocaleString()} elements)`, "Lighthouse flags documents with more than ~1,500 elements; large DOMs slow down layout and memory usage.", `${statistics.elements} elements, ${statistics.textNodes} text nodes`);
  if (complexity.maxChildren && complexity.maxChildren.count > 60) add("Structure", "suggestion", `Element with ${complexity.maxChildren.count} direct children`, "Very wide containers can indicate lists that should be paginated or virtualized.", complexity.maxChildren.label, complexity.maxChildren.nodeId);
  const dupIds = findDuplicateIds(dom.nodes);
  if (dupIds.length) add("Structure", "warning", `Duplicate id attributes (${dupIds.length})`, "IDs must be unique; duplicates break anchor links, label associations and scripts.", dupIds.slice(0, 6).map((d) => `#${d.id} ×${d.count}`).join(", "), dupIds[0].nodeId);
  if (!dom.nodes.some((n) => n.tag === "main")) add("Structure", "suggestion", "No <main> element", "A <main> landmark helps assistive tech and readers locate primary content.", "No <main> found in body");
  if (statistics.headings.h1 === 0 && statistics.elements > 30) add("Structure", "suggestion", "Page has no H1", "Heading structure gives the document an outline.", `H2: ${statistics.headings.h2}, H3: ${statistics.headings.h3}`);
  const divCount = statistics.tagFrequency.find((t) => t.tag === "div")?.count ?? 0;
  if (statistics.elements > 100 && divCount / statistics.elements > 0.55) add("Structure", "suggestion", `Div-heavy markup (${Math.round((divCount / statistics.elements) * 100)}% divs)`, "A high share of <div> suggests low semantic HTML usage (header/nav/section/article).", `${divCount} of ${statistics.elements} elements are <div>`);
  if (dom.truncated) add("Structure", "suggestion", "DOM tree truncated for display", `Only the first ${dom.nodes.length.toLocaleString()} elements are shown in the tree; statistics cover the full document.`, `${dom.totalElements} elements total`);

  // Assets
  if (r.assets.imagesWithoutDimensions > 0) add("Assets", r.assets.imagesWithoutDimensions > 5 ? "warning" : "suggestion", `${r.assets.imagesWithoutDimensions} image(s) without width/height`, "Explicit dimensions prevent layout shift (CLS) while images load.", `${r.assets.imagesWithoutDimensions} of ${statistics.images} <img> lack width or height`);
  if (statistics.images > 8 && r.assets.lazyImages === 0) add("Performance", "suggestion", "No lazy-loaded images", 'Images below the fold can use loading="lazy" to defer network work.', `${statistics.images} images, 0 with loading="lazy"`);
  const iframes = r.assets.assets.filter((a) => a.type === "iframe" && a.loading !== "lazy");
  if (iframes.length) add("Performance", "suggestion", `${iframes.length} iframe(s) without lazy loading`, "Third-party iframes are expensive; consider loading=\"lazy\".", iframes.map((i) => i.url ?? "(no src)").slice(0, 3).join(", "), iframes[0].nodeId);
  if (r.assets.assetDomains.length > 12) add("Performance", "suggestion", `Assets loaded from ${r.assets.assetDomains.length} domains`, "Each additional origin needs DNS, TCP and TLS setup.", r.assets.assetDomains.slice(0, 6).map((d) => d.domain).join(", "));

  // Scripts / performance
  if (r.scripts.blockingInHead > 0) add("Performance", r.scripts.blockingInHead > 2 ? "warning" : "suggestion", `${r.scripts.blockingInHead} render-blocking script(s) in <head>`, "External scripts in <head> without async/defer block HTML parsing.", r.scripts.scripts.filter((s) => s.inHead && !s.inline && !s.async && !s.defer && !s.module).map((s) => s.src).slice(0, 3).join(", "), r.scripts.scripts.find((s) => s.inHead && !s.inline && !s.async && !s.defer && !s.module)?.nodeId ?? null);
  if (r.scripts.external > 25) add("Performance", "warning", `${r.scripts.external} external scripts`, "A large number of script files increases network overhead and main-thread work.", `${r.scripts.scriptDomains.length} script domains`);
  if (r.scripts.inlineBytes > 150_000) add("Performance", "suggestion", `Large inline scripts (${Math.round(r.scripts.inlineBytes / 1024)} KB)`, "Big inline scripts cannot be cached separately from the document.", `${r.scripts.inline} inline scripts`);
  if (r.styles.elementsWithStyle > 50) add("Assets", "suggestion", `${r.styles.elementsWithStyle} elements with inline style attributes`, "Heavy inline styling hinders caching and consistent theming.", `${Math.round(r.styles.inlineStyleBytes / 1024)} KB of inline style`);
  if (r.styles.importantCount > 20) add("Assets", "suggestion", `${r.styles.importantCount} uses of !important`, "Frequent !important indicates specificity conflicts.", "Counted in inline styles and <style> blocks");
  if (statistics.htmlSize > 1_000_000) add("Performance", "warning", `Large HTML document (${(statistics.htmlSize / 1024 / 1024).toFixed(2)} MB)`, "Documents above ~1 MB delay first render.", `${statistics.htmlSize.toLocaleString()} bytes`);

  // Links
  if (r.links.counts.javascript > 0) add("Links", "warning", `${r.links.counts.javascript} javascript: link(s)`, "javascript: URLs are not real navigations and are inaccessible without JS; use <button>.", r.links.links.filter((l) => l.kind === "javascript").slice(0, 3).map((l) => l.text || l.href).join(", "), r.links.links.find((l) => l.kind === "javascript")?.nodeId ?? null);
  if (r.links.emptyHrefs > 0) add("Links", "warning", `${r.links.emptyHrefs} link(s) with empty href`, "Empty hrefs reload the page and confuse assistive technologies.", `${r.links.emptyHrefs} <a href="">`, r.links.links.find((l) => !l.href.trim())?.nodeId ?? null);
  const blankNoRel = r.links.links.filter((l) => l.target === "_blank" && l.kind === "external" && !/noopener|noreferrer/.test(l.rel ?? ""));
  if (blankNoRel.length) add("Links", "suggestion", `${blankNoRel.length} target="_blank" link(s) without rel="noopener"`, "Modern browsers imply noopener, but older ones expose window.opener to the target page.", blankNoRel.slice(0, 3).map((l) => l.resolved ?? l.href).join(", "), blankNoRel[0].nodeId);
  if (r.links.total > 300) add("Links", "suggestion", `${r.links.total} links on the page`, "Very link-dense pages dilute crawl focus and are harder to navigate.", `${r.links.counts.internal} internal, ${r.links.counts.external} external`);
  if (r.links.total === 0 && statistics.elements > 20) add("Links", "warning", "No links found", "Pages without links are dead ends for users and crawlers.", "0 <a href> elements");

  // Metadata extras
  if (r.fetch.robots.status === "disallowed") add("Metadata", "suggestion", "robots.txt disallows crawlers on this path", "Search engines respecting robots.txt will not crawl this URL.", r.fetch.robots.detail);
  if (r.fetch.redirects.length > 2) add("Performance", "suggestion", `${r.fetch.redirects.length} redirects before the final document`, "Each redirect adds a round trip.", r.fetch.redirects.map((h) => `${h.status} ${h.url}`).join(" → "));

  const order: Record<IssueSeverity, number> = { critical: 0, warning: 1, suggestion: 2 };
  return issues.sort((a, b) => order[a.severity] - order[b.severity]);
}

function ruleDescription(rule: string): string {
  switch (rule) {
    case "img-alt": return "Screen readers cannot describe images without alternative text. Use alt=\"\" for purely decorative images.";
    case "input-label": return "Form controls need a programmatically associated label (<label for>, aria-label or aria-labelledby).";
    case "button-name": return "Buttons must expose a name via text content, aria-label or a labelled icon.";
    case "link-name": return "Links without text are announced as 'link' with no destination information.";
    case "link-generic": return "Generic phrases like 'click here' don't convey the destination when navigating by links list.";
    case "iframe-title": return "A title lets assistive technology users know what an embedded frame contains.";
    case "heading-order": return "Skipping heading levels breaks the document outline used for navigation.";
    case "html-lang": return "The document language enables correct pronunciation and hyphenation.";
    case "positive-tabindex": return "Positive tabindex values create an unpredictable focus order.";
    case "landmark-main": return "Landmarks let users skip directly to the primary content.";
    default: return "Static accessibility heuristic.";
  }
}

function findDuplicateIds(nodes: AnalysisResult["dom"]["nodes"]): { id: string; count: number; nodeId: number }[] {
  const seen = new Map<string, { count: number; nodeId: number }>();
  for (const n of nodes) {
    if (!n.idAttr) continue;
    const e = seen.get(n.idAttr);
    if (e) e.count++;
    else seen.set(n.idAttr, { count: 1, nodeId: n.id });
  }
  return [...seen.entries()].filter(([, v]) => v.count > 1).map(([id, v]) => ({ id, count: v.count, nodeId: v.nodeId })).sort((a, b) => b.count - a.count);
}

export { describeNode };
