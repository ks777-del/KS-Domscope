"use client";
import { Spinner } from "./ui";

export const STAGES: { key: string; start: string; done: string }[] = [
  { key: "fetch", start: "Fetching page…", done: "HTML received" },
  { key: "parse", start: "Parsing DOM…", done: "DOM parsed" },
  { key: "metadata", start: "Extracting metadata…", done: "Metadata extracted" },
  { key: "links", start: "Analyzing links…", done: "Links analyzed" },
  { key: "assets", start: "Analyzing assets, scripts & styles…", done: "Assets analyzed" },
  { key: "seo", start: "Running SEO checks…", done: "SEO analysis complete" },
  { key: "a11y", start: "Running accessibility checks…", done: "Accessibility checks complete" },
  { key: "tech", start: "Detecting technologies…", done: "Technologies detected" },
  { key: "complexity", start: "Measuring complexity & patterns…", done: "Complexity measured" },
  { key: "issues", start: "Building issue center & scores…", done: "Issues compiled" },
  { key: "save", start: "Storing snapshot…", done: "Snapshot stored" },
];

export type StageState = Record<string, { status: "pending" | "running" | "done"; detail?: string }>;

export function CrawlProgress({ url, stages, error }: { url: string; stages: StageState; error: { message: string; code?: string } | null }) {
  return (
    <div className="panel mx-auto w-full max-w-xl p-6 fade-in">
      <div className="mb-4 flex items-center gap-3">
        <span className="text-2xl">🔬</span>
        <div className="min-w-0">
          <div className="text-sm font-semibold">{error ? "Analysis failed" : "Analyzing website"}</div>
          <div className="mono truncate text-xs text-muted">{url}</div>
        </div>
      </div>
      <ol className="space-y-1.5">
        {STAGES.map((s) => {
          const st = stages[s.key];
          if (!st || st.status === "pending") {
            return (
              <li key={s.key} className="flex items-center gap-2 text-sm text-muted/50">
                <span className="inline-block h-3.5 w-3.5 rounded-full border border-line" /> {s.start}
              </li>
            );
          }
          return (
            <li key={s.key} className={`flex items-start gap-2 text-sm ${st.status === "done" ? "text-fg" : "text-white"}`}>
              {st.status === "running" ? <Spinner className="mt-0.5" /> : <span className="mt-0.5 text-ok">✓</span>}
              <span>
                {st.status === "running" ? s.start : s.done}
                {st.detail && <span className="mono ml-2 text-xs text-muted">{st.detail}</span>}
              </span>
            </li>
          );
        })}
      </ol>
      {error && (
        <div className="mt-5 rounded-lg border border-bad/40 bg-bad/10 p-4 text-sm">
          <div className="font-semibold text-bad">Reason{error.code ? ` (${error.code})` : ""}:</div>
          <div className="mt-1 text-fg">{error.message}</div>
          <div className="mt-2 text-xs text-muted">No result was generated. DOMScope never fabricates analysis for failed requests.</div>
        </div>
      )}
    </div>
  );
}
