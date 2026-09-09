"use client";
import { useMemo, useState } from "react";
import type { AnalysisResult, AssetType } from "@/types/analysis";
import { Badge, Card, Empty, NodeLink, SearchInput, Stat, Toggle } from "./ui";

const TYPES: AssetType[] = ["image", "svg", "font", "stylesheet", "script", "favicon", "video", "audio", "iframe", "preload", "other"];

export function AssetsPanel({ result, onSelect }: { result: AnalysisResult; onSelect: (id: number) => void }) {
  const [type, setType] = useState("all");
  const [q, setQ] = useState("");
  const a = result.assets;
  const rows = useMemo(() => a.assets.filter((x) => (type === "all" || x.type === type) && (!q || (x.url ?? "").toLowerCase().includes(q.toLowerCase()))).slice(0, 500), [a.assets, type, q]);
  return (
    <div className="space-y-4 fade-in">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <Stat label="Images" value={a.counts.image} sub={`${a.lazyImages} lazy · ${a.imagesWithoutDimensions} no size`} />
        <Stat label="SVG" value={a.counts.svg} />
        <Stat label="Fonts" value={a.counts.font} sub={`${result.styles.fontFaces} @font-face`} />
        <Stat label="CSS" value={a.counts.stylesheet} />
        <Stat label="JavaScript" value={a.counts.script} />
        <Stat label="Media / other" value={a.counts.video + a.counts.audio + a.counts.iframe + a.counts.favicon + a.counts.preload + a.counts.other} sub={`${a.counts.video} video · ${a.counts.iframe} iframe`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <Card title={`Assets (${rows.length}${rows.length === 500 ? "+" : ""})`}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Toggle value={type} onChange={setType} options={[{ value: "all", label: "All", count: a.total }, ...TYPES.filter((t) => a.counts[t]).map((t) => ({ value: t, label: t, count: a.counts[t] }))]} />
            <div className="ml-auto w-64"><SearchInput value={q} onChange={setQ} placeholder="Search asset URLs…" /></div>
          </div>
          {rows.length === 0 ? <Empty>No assets match.</Empty> : (
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-panel text-left text-[10px] uppercase tracking-wider text-muted"><tr><th className="py-1 pr-2">Type</th><th className="py-1 pr-2">URL</th><th className="py-1 pr-2">Source</th><th className="py-1 pr-2">Loading</th><th className="py-1">Detail</th></tr></thead>
                <tbody>
                  {rows.map((x, i) => (
                    <tr key={i} className="border-t border-line/60 align-top">
                      <td className="py-1 pr-2"><Badge tone={x.external ? "info" : "accent"}>{x.type}</Badge></td>
                      <td className="mono max-w-[440px] break-all py-1 pr-2 text-fg">{x.url ?? <span className="text-muted">{x.inline ? "inline" : "no src"}</span>}</td>
                      <td className="py-1 pr-2"><NodeLink nodeId={x.nodeId} label={`<${x.sourceTag}>`} onSelect={onSelect} /></td>
                      <td className="mono py-1 pr-2 text-muted">{x.loading ?? "—"}</td>
                      <td className="py-1 text-muted">{x.detail ?? ""}{x.external === true ? " · third-party" : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card title="Asset domains">
          {a.assetDomains.length === 0 && <Empty>No remote assets.</Empty>}
          {a.assetDomains.slice(0, 30).map((d) => (
            <div key={d.domain} className="flex justify-between text-xs"><span className="mono truncate text-fg">{d.domain}</span><span className="mono text-muted">{d.count}</span></div>
          ))}
        </Card>
      </div>
    </div>
  );
}
