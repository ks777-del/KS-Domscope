"use client";
import type { AnalysisResult } from "@/types/analysis";
import type { TabId } from "./sidebar";
import { Badge, Card, ScoreRing, Stat, formatBytes, NodeLink } from "./ui";
import { MetadataPanel } from "./metadata-panel";

export function StatsDashboard({ result, onTab, onSelect }: { result: AnalysisResult; onTab: (t: TabId) => void; onSelect: (id: number) => void }) {
  const s = result.statistics;
  const sc = result.scores;
  const crit = result.issues.filter((i) => i.severity === "critical").length;
  const warn = result.issues.filter((i) => i.severity === "warning").length;
  const sugg = result.issues.filter((i) => i.severity === "suggestion").length;
  return (
    <div className="space-y-4 fade-in">
      <Card title="DOMScope score" right={<span className="text-[11px] text-muted">rule-based · see README for the model</span>}>
        <div className="flex flex-wrap items-center gap-6">
          <ScoreRing value={sc.overall} label="Overall" size={96} />
          <div className="flex flex-wrap gap-5">
            <ScoreRing value={sc.seo} label="SEO" onClick={() => onTab("seo")} />
            <ScoreRing value={sc.accessibility} label="Accessibility" onClick={() => onTab("accessibility")} />
            <ScoreRing value={sc.structure} label="Structure" onClick={() => onTab("issues")} />
            <ScoreRing value={sc.metadata} label="Metadata" onClick={() => onTab("seo")} />
            <ScoreRing value={sc.complexity} label="Simplicity" />
            <ScoreRing value={sc.technology} label="Technology" onClick={() => onTab("technologies")} />
          </div>
          <div className="ml-auto flex gap-2">
            <button onClick={() => onTab("issues")} className="panel px-3 py-2 text-left hover:border-bad/50"><div className="mono text-lg text-bad">{crit}</div><div className="text-[10px] uppercase text-muted">Critical</div></button>
            <button onClick={() => onTab("issues")} className="panel px-3 py-2 text-left hover:border-warn/50"><div className="mono text-lg text-warn">{warn}</div><div className="text-[10px] uppercase text-muted">Warnings</div></button>
            <button onClick={() => onTab("issues")} className="panel px-3 py-2 text-left hover:border-info/50"><div className="mono text-lg text-info">{sugg}</div><div className="text-[10px] uppercase text-muted">Suggestions</div></button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        <Stat label="HTML elements" value={s.elements.toLocaleString()} onClick={() => onTab("dom")} />
        <Stat label="DOM depth" value={s.maxDepth} sub={`avg ${result.complexity.averageDepth}`} onClick={() => onTab("graph")} />
        <Stat label="Links" value={s.links} sub={`${result.links.counts.internal} int · ${result.links.counts.external} ext`} onClick={() => onTab("links")} />
        <Stat label="Images" value={s.images} sub={`${result.assets.counts.svg} svg`} onClick={() => onTab("assets")} />
        <Stat label="Forms" value={s.forms} sub={`${s.inputs} inputs`} />
        <Stat label="Scripts" value={s.scripts} sub={`${result.scripts.external} ext · ${result.scripts.inline} inline`} onClick={() => onTab("scripts")} />
        <Stat label="Stylesheets" value={s.stylesheets} sub={`${result.styles.inlineStyleBlocks} style blocks`} onClick={() => onTab("styles")} />
        <Stat label="Text nodes" value={s.textNodes.toLocaleString()} />
        <Stat label="HTML size" value={formatBytes(s.htmlSize)} sub={`fetched in ${result.fetch.fetchDurationMs} ms`} />
        <Stat label="Text size" value={formatBytes(s.textSize)} sub={`${Math.round((s.textSize / Math.max(1, s.htmlSize)) * 100)}% of HTML`} />
        <Stat label="Attributes" value={s.attributeCount.toLocaleString()} />
        <Stat label="Unique tags" value={s.uniqueTags} />
        <Stat label="Unique classes" value={s.uniqueClasses.toLocaleString()} onClick={() => onTab("styles")} />
        <Stat label="Unique IDs" value={s.uniqueIds} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Tag frequency">
          <div className="space-y-1">
            {s.tagFrequency.slice(0, 14).map((t) => (
              <div key={t.tag} className="flex items-center gap-2 text-xs">
                <span className="mono w-20 text-fg">{t.tag}</span>
                <div className="h-2 flex-1 rounded bg-panel2"><div className="h-2 rounded bg-accent/70" style={{ width: `${(t.count / s.tagFrequency[0].count) * 100}%` }} /></div>
                <span className="mono w-12 text-right text-muted">{t.count}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title="DOM complexity" right={<Badge tone={result.complexity.score < 40 ? "ok" : result.complexity.score < 70 ? "warn" : "bad"}>{result.complexity.score} / 100</Badge>}>
          <p className="text-xs leading-relaxed text-muted">{result.complexity.explanation}</p>
          <table className="mt-3 w-full text-xs">
            <tbody>
              {result.complexity.breakdown.map((b) => (
                <tr key={b.metric} className="border-t border-line/60">
                  <td className="py-1 text-fg" title={b.explanation}>{b.metric}</td>
                  <td className="mono py-1 text-muted">{b.value}</td>
                  <td className="mono py-1 text-right text-warn">+{b.penalty}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-muted">Largest branches</div>
          {result.complexity.largestBranches.slice(0, 6).map((b) => (
            <div key={b.nodeId} className="flex justify-between text-xs"><NodeLink nodeId={b.nodeId} label={`<${b.label}>`} onSelect={onSelect} /><span className="mono text-muted">{b.descendants}</span></div>
          ))}
          {result.complexity.deepestPaths[0] && (
            <>
              <div className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-muted">Deepest path (depth {result.complexity.deepestPaths[0].depth})</div>
              <NodeLink nodeId={result.complexity.deepestPaths[0].nodeId} label={<span className="break-all">{result.complexity.deepestPaths[0].path.length > 180 ? "…" + result.complexity.deepestPaths[0].path.slice(-180) : result.complexity.deepestPaths[0].path}</span>} onSelect={onSelect} />
            </>
          )}
        </Card>
        <Card title="Repeated structures (inferred)" right={<span className="text-[10px] text-muted">not guaranteed components</span>}>
          {result.patterns.length === 0 && <p className="text-xs text-muted">No repeated structures detected.</p>}
          <div className="space-y-1">
            {result.patterns.slice(0, 14).map((p) => (
              <div key={p.signature} className="flex items-center gap-2 text-xs">
                <NodeLink nodeId={p.exampleNodeIds[0]} label={<span className="break-all">{p.signature.length > 46 ? p.signature.slice(0, 45) + "…" : p.signature}</span>} onSelect={onSelect} />
                <Badge tone={p.kind === "class" ? "accent" : "neutral"} className="ml-auto">{p.kind}</Badge>
                <span className="mono w-10 text-right text-white">× {p.count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <MetadataPanel result={result} />
    </div>
  );
}
