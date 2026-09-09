"use client";
import type { AnalysisResult } from "@/types/analysis";
import { Badge, Card } from "./ui";

const NA = <span className="text-muted">Not detected</span>;

export function MetadataPanel({ result }: { result: AnalysisResult }) {
  const m = result.metadata;
  const f = result.fetch;
  const row = (k: string, v: React.ReactNode) => (
    <tr key={k} className="border-t border-line/60 align-top">
      <td className="w-36 py-1.5 pr-2 text-muted">{k}</td>
      <td className="mono break-all py-1.5 text-xs text-fg">{v}</td>
    </tr>
  );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Page metadata">
        <table className="w-full text-sm">
          <tbody>
            {row("Title", m.title || NA)}
            {row("Description", m.description || NA)}
            {row("Canonical", m.canonical || NA)}
            {row("Language", m.lang || NA)}
            {row("Charset", m.charset || NA)}
            {row("Viewport", m.viewport || NA)}
            {row("Robots meta", m.robots || <span className="text-muted">Not set</span>)}
            {row("Generator", m.generator || NA)}
            {row("Theme color", m.themeColor || NA)}
            {row("Favicon", m.favicon || NA)}
            {row("Open Graph", Object.keys(m.openGraph).length ? Object.entries(m.openGraph).map(([k, v]) => <div key={k}><span className="text-accent">og:{k}</span> = {v.slice(0, 120)}</div>) : NA)}
            {row("Twitter", Object.keys(m.twitter).length ? Object.entries(m.twitter).map(([k, v]) => <div key={k}><span className="text-accent">twitter:{k}</span> = {v.slice(0, 120)}</div>) : NA)}
            {row("JSON-LD", m.jsonLdCount ? `${m.jsonLdCount} block(s): ${m.jsonLdTypes.join(", ") || "no @type"}` : NA)}
            {row("Hreflang", m.hreflang.length ? m.hreflang.map((h) => h.lang).join(", ") : NA)}
            {row("Meta tags", `${m.metaTags.length} named meta tags`)}
          </tbody>
        </table>
      </Card>
      <Card title="Fetch details">
        <table className="w-full text-sm">
          <tbody>
            {row("Requested", f.requestedUrl)}
            {row("Final URL", f.finalUrl)}
            {row("Status", <span><Badge tone={f.status < 300 ? "ok" : "warn"}>HTTP {f.status}</Badge> {f.statusText}</span>)}
            {row("Redirects", f.redirects.length ? f.redirects.map((r) => <div key={r.url}>{r.status} → {r.url}</div>) : "none")}
            {row("Content type", f.contentType ?? "Unknown")}
            {row("Size", `${(f.size / 1024).toFixed(1)} KB in ${f.fetchDurationMs} ms`)}
            {row("Fetched at", new Date(f.fetchedAt).toLocaleString())}
            {row("robots.txt", <span><Badge tone={f.robots.status === "allowed" ? "ok" : f.robots.status === "disallowed" ? "warn" : "neutral"}>{f.robots.status}</Badge> <span className="text-muted">{f.robots.detail}</span></span>)}
            {row("Response headers", Object.keys(f.headers).length ? Object.entries(f.headers).map(([k, v]) => <div key={k}><span className="text-accent">{k}</span>: {v.length > 140 ? v.slice(0, 140) + "…" : v}</div>) : "none captured")}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
