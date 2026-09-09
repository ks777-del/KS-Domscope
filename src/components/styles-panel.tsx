"use client";
import type { AnalysisResult } from "@/types/analysis";
import { Card, Empty, NodeLink, Stat, formatBytes } from "./ui";

export function StylesPanel({ result, onSelect }: { result: AnalysisResult; onSelect: (id: number) => void }) {
  const st = result.styles;
  return (
    <div className="space-y-4 fade-in">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <Stat label="External stylesheets" value={st.externalStylesheets} />
        <Stat label="Inline style blocks" value={st.inlineStyleBlocks} sub={formatBytes(st.styleBlockBytes)} />
        <Stat label="Elements with style" value={st.elementsWithStyle} sub={formatBytes(st.inlineStyleBytes)} />
        <Stat label="Class usages" value={st.totalClassUsages.toLocaleString()} sub={`${st.uniqueClasses} unique`} />
        <Stat label="@font-face" value={st.fontFaces} />
        <Stat label="@media" value={st.mediaQueries} sub="in style blocks" />
        <Stat label="!important" value={st.importantCount} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Stylesheets">
          {st.stylesheets.length === 0 && <Empty>No external stylesheets.</Empty>}
          {st.stylesheets.map((s) => (
            <div key={s.nodeId} className="border-t border-line/60 py-1.5 text-xs first:border-0">
              <div className="mono break-all text-fg">{s.href}</div>
              <div className="text-muted">{s.media ? `media=${s.media} · ` : ""}<NodeLink nodeId={s.nodeId} label="inspect" onSelect={onSelect} /></div>
            </div>
          ))}
        </Card>
        <Card title="Style blocks">
          {st.styleBlocks.length === 0 && <Empty>No &lt;style&gt; blocks.</Empty>}
          {st.styleBlocks.map((s) => (
            <div key={s.nodeId} className="border-t border-line/60 py-1.5 text-xs first:border-0">
              <div className="flex justify-between"><span className="mono text-muted">{formatBytes(s.size)}</span><NodeLink nodeId={s.nodeId} label="inspect" onSelect={onSelect} /></div>
              <div className="mono truncate text-fg/70">{s.preview}</div>
            </div>
          ))}
        </Card>
        <Card title="Most used classes">
          {st.topClasses.length === 0 && <Empty>No classes used.</Empty>}
          <div className="space-y-1">
            {st.topClasses.slice(0, 30).map((c) => (
              <div key={c.name} className="flex items-center gap-2 text-xs">
                <span className="mono truncate text-fg">.{c.name}</span>
                <div className="h-1.5 flex-1 rounded bg-panel2"><div className="h-1.5 rounded bg-accent2/60" style={{ width: `${(c.count / st.topClasses[0].count) * 100}%` }} /></div>
                <span className="mono w-10 text-right text-muted">{c.count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
