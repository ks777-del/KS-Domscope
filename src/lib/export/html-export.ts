import type { AnalysisResult } from "@/types/analysis";

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Standalone HTML report (no external resources, no scripts). */
export function buildHtmlReport(r: AnalysisResult): string {
  const s = r.statistics;
  const row = (k: string, v: unknown) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`;
  const scoreRow = (k: string, v: number) => `<tr><th>${esc(k)}</th><td><span class="bar"><span style="width:${v}%"></span></span> ${v}</td></tr>`;
  const sevIcon = { critical: "🔴", warning: "🟠", suggestion: "🔵" } as const;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>DOMScope report — ${esc(r.hostname)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body{font-family:ui-sans-serif,system-ui,sans-serif;background:#0b0f17;color:#dfe6f2;margin:0;padding:32px;line-height:1.5}
h1{font-size:24px;margin:0 0 4px}h2{font-size:16px;margin:32px 0 8px;color:#8fb3ff;text-transform:uppercase;letter-spacing:.08em}
.muted{color:#8b95a7}table{border-collapse:collapse;width:100%;max-width:960px;font-size:14px}th,td{text-align:left;padding:6px 10px;border-bottom:1px solid #1e2636;vertical-align:top}th{color:#a8b3c7;font-weight:500;width:240px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;max-width:960px}.card{background:#121826;border:1px solid #1e2636;border-radius:10px;padding:14px}.card b{display:block;font-size:22px}.card span{font-size:12px;color:#8b95a7}
.bar{display:inline-block;width:160px;height:8px;background:#1e2636;border-radius:4px;vertical-align:middle;margin-right:8px}.bar span{display:block;height:100%;background:#4f8cff;border-radius:4px}
code{font-family:ui-monospace,monospace;font-size:12px;color:#c9d4e6;word-break:break-all}.pill{display:inline-block;padding:2px 8px;border-radius:999px;background:#1e2636;font-size:12px;margin:2px}
ul{padding-left:18px}li{margin:4px 0}footer{margin-top:40px;font-size:12px;color:#6b7588}
</style></head><body>
<h1>🔬 DOMScope report</h1>
<div class="muted"><code>${esc(r.url)}</code> · analyzed ${esc(new Date(r.analyzedAt).toUTCString())} · HTTP ${r.fetch.status}</div>

<h2>Scores</h2><table>${scoreRow("Overall", r.scores.overall)}${scoreRow("SEO", r.scores.seo)}${scoreRow("Accessibility", r.scores.accessibility)}${scoreRow("Structure", r.scores.structure)}${scoreRow("Metadata", r.scores.metadata)}${scoreRow("Complexity (higher = simpler)", r.scores.complexity)}${scoreRow("Technology", r.scores.technology)}</table>

<h2>Page statistics</h2><div class="grid">
${[["HTML elements", s.elements], ["DOM depth", s.maxDepth], ["Links", s.links], ["Images", s.images], ["Forms", s.forms], ["Scripts", s.scripts], ["Stylesheets", s.stylesheets], ["Text nodes", s.textNodes], ["HTML size", `${(s.htmlSize / 1024).toFixed(1)} KB`], ["Text size", `${(s.textSize / 1024).toFixed(1)} KB`], ["Attributes", s.attributeCount], ["Unique tags", s.uniqueTags], ["Unique classes", s.uniqueClasses], ["Unique IDs", s.uniqueIds]].map(([k, v]) => `<div class="card"><b>${esc(v)}</b><span>${esc(k)}</span></div>`).join("")}
</div>

<h2>Metadata</h2><table>${row("Title", r.metadata.title ?? "Not detected")}${row("Description", r.metadata.description ?? "Not detected")}${row("Canonical", r.metadata.canonical ?? "Not detected")}${row("Language", r.metadata.lang ?? "Not detected")}${row("Viewport", r.metadata.viewport ?? "Not detected")}${row("Robots", r.metadata.robots ?? "Not set")}${row("Generator", r.metadata.generator ?? "Not detected")}${row("Open Graph", Object.keys(r.metadata.openGraph).length ? Object.entries(r.metadata.openGraph).map(([k, v]) => `og:${k}=${v}`).join(" · ") : "Not detected")}${row("Twitter", Object.keys(r.metadata.twitter).length ? Object.entries(r.metadata.twitter).map(([k, v]) => `twitter:${k}=${v}`).join(" · ") : "Not detected")}${row("JSON-LD", r.metadata.jsonLdCount ? `${r.metadata.jsonLdCount} block(s): ${r.metadata.jsonLdTypes.join(", ")}` : "Not detected")}</table>

<h2>SEO checks</h2><table>${r.seo.checks.map((c) => row(`${c.status === "pass" ? "✓" : c.status === "fail" ? "✗" : c.status === "warn" ? "⚠" : "ℹ"} ${c.label}`, `${c.value ? c.value + " — " : ""}${c.detail}`)).join("")}</table>

<h2>Accessibility (static analysis)</h2><table>${row("Images with alt", `${r.accessibility.images.withAlt} / ${r.accessibility.images.total} (${r.accessibility.images.decorative} decorative, ${r.accessibility.images.missing} missing)`)}${row("Labelled inputs", `${r.accessibility.forms.labelled} / ${r.accessibility.forms.inputs}`)}${row("Named buttons", `${r.accessibility.buttons.named} / ${r.accessibility.buttons.total}`)}${row("Links", `${r.accessibility.links.meaningful} meaningful, ${r.accessibility.links.generic} generic, ${r.accessibility.links.empty} empty`)}${row("Landmarks", r.accessibility.landmarks.join(", ") || "None")}${row("ARIA attributes", r.accessibility.ariaAttributes)}${row("Findings", r.accessibility.issues.length)}</table>

<h2>Technologies</h2>${r.technologies.length ? `<table>${r.technologies.map((t) => row(`${t.name} (${t.confidence})`, `${t.category} — ${t.evidence.join("; ")}`)).join("")}</table>` : '<p class="muted">Not detected</p>'}

<h2>Links (${r.links.total})</h2><p>${Object.entries(r.links.counts).map(([k, v]) => `<span class="pill">${esc(k)}: ${v}</span>`).join("")}</p>
<h2>Assets (${r.assets.total})</h2><p>${Object.entries(r.assets.counts).map(([k, v]) => `<span class="pill">${esc(k)}: ${v}</span>`).join("")}</p>
<h2>Scripts</h2><table>${row("External", r.scripts.external)}${row("Inline", r.scripts.inline)}${row("Async", r.scripts.async)}${row("Defer", r.scripts.defer)}${row("Module", r.scripts.module)}${row("Blocking in head", r.scripts.blockingInHead)}</table>
<h2>Styles</h2><table>${row("External stylesheets", r.styles.externalStylesheets)}${row("Inline style blocks", r.styles.inlineStyleBlocks)}${row("Elements with style attr", r.styles.elementsWithStyle)}${row("!important", r.styles.importantCount)}</table>

<h2>DOM complexity</h2><p>${esc(r.complexity.explanation)}</p><table>${r.complexity.breakdown.map((b) => row(b.metric, `${b.value} → −${b.penalty} (${b.explanation})`)).join("")}</table>
${r.patterns.length ? `<h2>Repeated structures (inferred)</h2><table>${r.patterns.slice(0, 15).map((p) => row(p.signature, `× ${p.count}`)).join("")}</table>` : ""}

<h2>Issues (${r.issues.length})</h2><ul>${r.issues.map((i) => `<li>${sevIcon[i.severity]} <b>[${esc(i.category)}]</b> ${esc(i.title)} — <span class="muted">${esc(i.description)}</span><br><code>${esc(i.evidence)}</code></li>`).join("")}</ul>

<footer>Generated by DOMScope. Accessibility results are static heuristics and not a complete audit. Technology detections are based on observable markup and headers only.</footer>
</body></html>`;
}
