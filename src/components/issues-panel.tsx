"use client";
import { useMemo, useState } from "react";
import type { AnalysisResult, IssueCategory, IssueSeverity } from "@/types/analysis";
import { Badge, Card, Empty, NodeLink, Spinner, Toggle } from "./ui";
import { askAI, renderMarkdown } from "@/lib/ai/client";

const CATS: IssueCategory[] = ["SEO", "Accessibility", "Structure", "Assets", "Links", "Metadata", "Performance"];

export function IssuesPanel({ result, onSelect, aiAvailable }: { result: AnalysisResult; onSelect: (id: number) => void; aiAvailable: boolean }) {
  const [sev, setSev] = useState("all");
  const [cat, setCat] = useState("all");
  const [explanations, setExplanations] = useState<Record<string, { text?: string; error?: string; loading: boolean }>>({});
  const issues = result.issues;
  const counts = useMemo(() => ({ critical: issues.filter((i) => i.severity === "critical").length, warning: issues.filter((i) => i.severity === "warning").length, suggestion: issues.filter((i) => i.severity === "suggestion").length }), [issues]);
  const rows = issues.filter((i) => (sev === "all" || i.severity === sev) && (cat === "all" || i.category === cat));

  const explain = async (issueId: string) => {
    if (!result.id) return;
    setExplanations((e) => ({ ...e, [issueId]: { loading: true } }));
    try {
      const r = await askAI(result.id, "explain-issue", { issueId });
      setExplanations((e) => ({ ...e, [issueId]: { loading: false, text: r.text } }));
    } catch (err) {
      setExplanations((e) => ({ ...e, [issueId]: { loading: false, error: (err as Error).message } }));
    }
  };

  return (
    <div className="space-y-4 fade-in">
      <div className="grid grid-cols-3 gap-3">
        {(["critical", "warning", "suggestion"] as IssueSeverity[]).map((s) => (
          <button key={s} onClick={() => setSev(sev === s ? "all" : s)} className={`panel p-3 text-left transition ${sev === s ? "border-accent" : ""}`}>
            <div className={`mono text-2xl ${s === "critical" ? "text-bad" : s === "warning" ? "text-warn" : "text-info"}`}>{s === "critical" ? "🔴" : s === "warning" ? "🟠" : "🔵"} {counts[s]}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted">{s === "suggestion" ? "Suggestions" : s === "warning" ? "Warnings" : "Critical"}</div>
          </button>
        ))}
      </div>
      <Card title={`Issues (${rows.length})`}>
        <div className="mb-3"><Toggle value={cat} onChange={setCat} options={[{ value: "all", label: "All", count: issues.length }, ...CATS.map((c) => ({ value: c, label: c, count: issues.filter((i) => i.category === c).length }))]} /></div>
        {rows.length === 0 ? <Empty>{issues.length === 0 ? "No issues detected by the static analyzers." : "No issues match the current filter."}</Empty> : (
          <div className="divide-y divide-line/60">
            {rows.map((i) => {
              const ex = explanations[i.id];
              return (
                <div key={i.id} className="py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={i.severity === "critical" ? "bad" : i.severity === "warning" ? "warn" : "info"}>{i.severity}</Badge>
                    <Badge>{i.category}</Badge>
                    <span className="font-medium text-white">{i.title}</span>
                    <div className="ml-auto flex items-center gap-2">
                      {i.nodeId !== null && <NodeLink nodeId={i.nodeId} label="inspect element" onSelect={onSelect} />}
                      {aiAvailable && result.id && !ex?.text && (
                        <button type="button" onClick={() => explain(i.id)} disabled={ex?.loading} className="rounded border border-line px-2 py-0.5 text-[11px] text-accent hover:border-accent/50 disabled:opacity-60">
                          {ex?.loading ? <Spinner /> : "✦ Explain this issue"}
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-muted">{i.description}</p>
                  <div className="mono mt-1 break-all rounded bg-bg px-2 py-1 text-[11px] text-fg/80">Evidence: {i.evidence}</div>
                  {ex?.error && <div className="mt-2 text-xs text-bad">{ex.error}</div>}
                  {ex?.text && <div className="prose-ai mt-2 rounded-lg border border-accent/30 bg-accent/5 p-3 text-xs text-fg" dangerouslySetInnerHTML={{ __html: renderMarkdown(ex.text) }} />}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
