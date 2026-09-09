import Link from "next/link";
import { UrlInput } from "@/components/url-input";
import { listRecent, type RecentAnalysis } from "@/db/analyses";

export const dynamic = "force-dynamic";

const FEATURES = [
  ["🌳", "Interactive DOM tree", "Virtualized explorer with search, depth and element highlighting."],
  ["🕸️", "Visual DOM graph", "Overview, focused and subtree modes with zoom, pan and drag."],
  ["🔗", "Links & assets", "Internal/external/anchor links, images, fonts, CSS, scripts, media."],
  ["🔍", "SEO & metadata", "Title, description, canonical, headings, Open Graph, Twitter, robots."],
  ["♿", "Accessibility signals", "Static checks: alt text, labels, button names, lang, heading order."],
  ["🧠", "Technology detection", "Evidence-based detection of frameworks, CMSs, CDNs and libraries."],
  ["🧬", "Complexity & patterns", "Transparent complexity score and repeated component-like structures."],
  ["✦", "Ask the website", "Optional AI grounded in the analysis — OpenAI, Gemini, OpenRouter or custom."],
];

export default async function Home() {
  let recent: RecentAnalysis[] = [];
  try {
    recent = await listRecent(8);
  } catch {
    recent = [];
  }
  return (
    <main className="grid-bg min-h-screen">
      <div className="mx-auto flex max-w-5xl flex-col items-center px-6 pb-20 pt-24 text-center">
        <div className="mb-4 flex items-center gap-3 text-5xl">🔬</div>
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">DOMScope</h1>
        <p className="mt-3 text-lg text-muted">Inspect the anatomy of any website.</p>
        <p className="mt-1 max-w-xl text-sm text-muted/80">Real HTML, real DOM, real links, assets, scripts, styles, metadata, SEO and accessibility signals, technologies and complexity — visualized for developers.</p>
        <div className="mt-8 flex w-full justify-center"><UrlInput /></div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-muted">
          <span>Try:</span>
          {["https://example.com", "https://developer.mozilla.org", "https://news.ycombinator.com", "https://nextjs.org"].map((u) => (
            <Link key={u} href={`/analyze?url=${encodeURIComponent(u)}`} className="mono rounded-full border border-line bg-panel px-3 py-1 hover:border-accent/50 hover:text-fg">{u.replace("https://", "")}</Link>
          ))}
          <Link href="/compare" className="rounded-full border border-line bg-panel px-3 py-1 hover:border-accent/50 hover:text-fg">⇄ Compare two sites</Link>
        </div>

        <div className="mt-16 grid w-full gap-3 text-left sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(([icon, title, desc]) => (
            <div key={title} className="panel p-4">
              <div className="text-xl">{icon}</div>
              <div className="mt-2 text-sm font-semibold text-white">{title}</div>
              <div className="mt-1 text-xs text-muted">{desc}</div>
            </div>
          ))}
        </div>

        {recent.length > 0 && (
          <div className="mt-14 w-full text-left">
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Recent analyses</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {recent.map((r) => (
                <Link key={r.id} href={`/analyze?id=${r.id}`} className="panel flex items-center gap-3 p-3 transition hover:border-accent/50">
                  <div className="min-w-0 flex-1">
                    <div className="mono truncate text-sm text-white">{r.hostname}</div>
                    <div className="truncate text-xs text-muted">{r.title ?? r.url}</div>
                  </div>
                  <div className="text-right">
                    <div className={`mono text-lg ${(r.overallScore ?? 0) >= 80 ? "text-ok" : (r.overallScore ?? 0) >= 55 ? "text-warn" : "text-bad"}`}>{r.overallScore ?? "—"}</div>
                    <div className="text-[10px] text-muted">{r.elements?.toLocaleString()} el · {new Date(r.createdAt).toLocaleDateString()}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <p className="mt-16 max-w-2xl text-[11px] leading-relaxed text-muted/70">DOMScope performs one server-side GET request per analysis with a clearly identified user agent. It never executes page scripts, submits forms, bypasses access controls, or reaches private networks. Accessibility results are static heuristics, not a full audit.</p>
      </div>
    </main>
  );
}
