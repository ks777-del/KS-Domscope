"use client";
import type { AnalysisResult } from "@/types/analysis";
import { Badge, Card, Empty } from "./ui";

export function TechnologyPanel({ result }: { result: AnalysisResult }) {
  const techs = result.technologies;
  const groups = new Map<string, typeof techs>();
  for (const t of techs) groups.set(t.category, [...(groups.get(t.category) ?? []), t]);
  return (
    <div className="space-y-4 fade-in">
      <div className="rounded-lg border border-line bg-panel px-3 py-2 text-xs text-muted">Detections are inferred from observable evidence in the HTML and response headers (markers, asset paths, headers, class patterns). Nothing is executed. Confidence reflects how many independent signals were found.</div>
      {techs.length === 0 && <Empty>Not detected — no known technology markers were found in the HTML or headers.</Empty>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[...groups.entries()].map(([cat, items]) => (
          <Card key={cat} title={cat}>
            <div className="space-y-3">
              {items.map((t) => (
                <div key={t.name} className="rounded-lg border border-line bg-bg p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{t.name}</span>
                    {t.version && <span className="mono text-xs text-muted">v{t.version}</span>}
                    <Badge tone={t.confidence === "High" ? "ok" : t.confidence === "Medium" ? "warn" : "neutral"} className="ml-auto">{t.confidence}</Badge>
                  </div>
                  <div className="mt-1.5 text-[10px] uppercase tracking-wider text-muted">Evidence</div>
                  <ul className="mt-0.5 space-y-0.5">{t.evidence.map((e) => <li key={e} className="mono break-all text-[11px] text-fg/80">· {e}</li>)}</ul>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
      <Card title="Technology practice score">
        <div className="mono text-[11px] text-fg/80">{result.scores.notes.technology.map((n) => <div key={n}>{n}</div>)}</div>
      </Card>
    </div>
  );
}
