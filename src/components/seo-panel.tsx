"use client";
import type { AnalysisResult } from "@/types/analysis";
import { Badge, Card, NodeLink, ScoreRing } from "./ui";

const ICON = { pass: "✓", warn: "⚠", fail: "✗", info: "ℹ" } as const;
const TONE = { pass: "text-ok", warn: "text-warn", fail: "text-bad", info: "text-info" } as const;

export function SeoPanel({ result, onSelect }: { result: AnalysisResult; onSelect: (id: number) => void }) {
  const seo = result.seo;
  return (
    <div className="space-y-4 fade-in">
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card title="SEO checks" right={<ScoreRing value={seo.score} label="score" size={56} />}>
          <ul className="divide-y divide-line/60">
            {seo.checks.map((c) => (
              <li key={c.id} className="flex gap-3 py-2 text-sm">
                <span className={`mono w-4 shrink-0 ${TONE[c.status]}`}>{ICON[c.status]}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="text-fg">{c.label}</span>{c.value && <span className="mono truncate text-xs text-muted" title={c.value}>{c.value}</span>}</div>
                  <div className="text-xs text-muted">{c.detail}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <div className="space-y-4">
          <Card title="Scoring">
            <p className="mb-2 text-xs text-muted">Weighted checks; warnings earn half credit.</p>
            <div className="mono space-y-0.5 text-[11px] text-fg/80">{seo.scoring.map((s) => <div key={s}>{s}</div>)}</div>
          </Card>
          <Card title={`Heading outline (${seo.headings.length})`}>
            {seo.headings.length === 0 && <p className="text-xs text-muted">No headings found.</p>}
            <div className="max-h-96 space-y-0.5 overflow-auto">
              {seo.headings.map((h) => (
                <div key={h.nodeId} style={{ paddingLeft: (Number(h.tag[1]) - 1) * 12 }} className="flex items-center gap-2 text-xs">
                  <Badge tone={h.tag === "h1" ? "accent" : "neutral"}>{h.tag}</Badge>
                  <NodeLink nodeId={h.nodeId} label={<span className="truncate">{h.text || "(empty heading)"}</span>} onSelect={onSelect} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
