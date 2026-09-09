"use client";
import { useMemo, useState } from "react";
import type { AnalysisResult } from "@/types/analysis";
import { Badge, Card, Empty, NodeLink, ScoreRing, Stat, Toggle } from "./ui";

export function AccessibilityPanel({ result, onSelect }: { result: AnalysisResult; onSelect: (id: number) => void }) {
  const a = result.accessibility;
  const [rule, setRule] = useState("all");
  const rules = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of a.issues) m.set(i.rule, (m.get(i.rule) ?? 0) + 1);
    return [...m.entries()];
  }, [a.issues]);
  const rows = a.issues.filter((i) => rule === "all" || i.rule === rule).slice(0, 300);
  const ratio = (x: number, t: number) => (t ? `${x} / ${t}` : "n/a");
  return (
    <div className="space-y-4 fade-in">
      <div className="rounded-lg border border-warn/30 bg-warn/5 px-3 py-2 text-xs text-warn">Static analysis of server-delivered HTML only. This is not a complete accessibility audit — contrast, keyboard behaviour, focus management and dynamically rendered content are not evaluated.</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="panel flex items-center justify-center p-2"><ScoreRing value={a.score} label="Score" size={64} /></div>
        <Stat label="Images with alt" value={ratio(a.images.withAlt + a.images.decorative, a.images.total)} sub={`${a.images.decorative} decorative · ${a.images.missing} missing`} />
        <Stat label="Labelled inputs" value={ratio(a.forms.labelled, a.forms.inputs)} sub={`${a.forms.unlabelled} unlabelled`} />
        <Stat label="Named buttons" value={ratio(a.buttons.named, a.buttons.total)} sub={`${a.buttons.unnamed} unnamed`} />
        <Stat label="Descriptive links" value={ratio(a.links.meaningful, a.links.total)} sub={`${a.links.generic} generic · ${a.links.empty} empty`} />
        <Stat label="Findings" value={a.issues.length} sub={`${a.issues.filter((i) => i.severity === "critical").length} critical`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Card title={`Findings (${rows.length})`}>
          <div className="mb-3"><Toggle value={rule} onChange={setRule} options={[{ value: "all", label: "All", count: a.issues.length }, ...rules.map(([r, n]) => ({ value: r, label: r, count: n }))]} /></div>
          {rows.length === 0 ? <Empty>No findings for the selected rule.</Empty> : (
            <div className="max-h-[60vh] divide-y divide-line/60 overflow-auto">
              {rows.map((i) => (
                <div key={i.id} className="flex gap-3 py-2 text-xs">
                  <Badge tone={i.severity === "critical" ? "bad" : i.severity === "warning" ? "warn" : "info"} className="h-fit shrink-0">{i.severity}</Badge>
                  <div className="min-w-0 flex-1">
                    <div className="text-fg">{i.message}</div>
                    <div className="mono break-all text-muted">{i.evidence}</div>
                  </div>
                  <NodeLink nodeId={i.nodeId} label="inspect" onSelect={onSelect} />
                </div>
              ))}
            </div>
          )}
        </Card>
        <div className="space-y-4">
          <Card title="Document">
            <table className="w-full text-xs"><tbody>
              <tr><td className="py-1 text-muted">lang</td><td className="mono">{a.lang ?? <span className="text-bad">missing</span>}</td></tr>
              <tr><td className="py-1 text-muted">Landmarks</td><td className="mono">{a.landmarks.join(", ") || "none"}</td></tr>
              <tr><td className="py-1 text-muted">ARIA attributes</td><td className="mono">{a.ariaAttributes}</td></tr>
              <tr><td className="py-1 text-muted">role attributes</td><td className="mono">{a.roles}</td></tr>
              <tr><td className="py-1 text-muted">Positive tabindex</td><td className="mono">{a.positiveTabindex}</td></tr>
              <tr><td className="py-1 text-muted">iframes w/o title</td><td className="mono">{a.iframesWithoutTitle}</td></tr>
            </tbody></table>
          </Card>
          <Card title="Heading hierarchy">
            {a.headingIssues.length === 0 ? <p className="text-xs text-ok">No heading order problems detected.</p> : a.headingIssues.map((h) => <div key={h} className="text-xs text-warn">⚠ {h}</div>)}
            <div className="mono mt-2 break-all text-[11px] text-muted">{a.headingOrder.slice(0, 60).join(" → ") || "no headings"}{a.headingOrder.length > 60 ? " …" : ""}</div>
          </Card>
          <Card title="Scoring">
            <div className="mono space-y-0.5 text-[11px] text-fg/80">{a.scoring.map((s) => <div key={s}>{s}</div>)}</div>
          </Card>
        </div>
      </div>
    </div>
  );
}
