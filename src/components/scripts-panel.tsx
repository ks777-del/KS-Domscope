"use client";
import { useMemo, useState } from "react";
import type { AnalysisResult } from "@/types/analysis";
import { Badge, Card, Empty, NodeLink, SearchInput, Stat, Toggle, formatBytes } from "./ui";

export function ScriptsPanel({ result, onSelect }: { result: AnalysisResult; onSelect: (id: number) => void }) {
  const s = result.scripts;
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const rows = useMemo(() => s.scripts.filter((x) => {
    if (filter === "external" && x.inline) return false;
    if (filter === "inline" && !x.inline) return false;
    if (filter === "async" && !x.async) return false;
    if (filter === "defer" && !x.defer) return false;
    if (filter === "module" && !x.module) return false;
    if (filter === "blocking" && !(x.inHead && !x.inline && !x.async && !x.defer && !x.module)) return false;
    return !q || (x.src ?? x.preview ?? "").toLowerCase().includes(q.toLowerCase());
  }), [s.scripts, filter, q]);
  return (
    <div className="space-y-4 fade-in">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <Stat label="External" value={s.external} sub={`${s.scriptDomains.length} domains`} />
        <Stat label="Inline" value={s.inline} sub={formatBytes(s.inlineBytes)} />
        <Stat label="Async" value={s.async} />
        <Stat label="Defer" value={s.defer} />
        <Stat label="Module" value={s.module} />
        <Stat label="JSON-LD" value={s.jsonLd} />
        <Stat label="Blocking in head" value={s.blockingInHead} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <Card title={`Scripts (${rows.length})`} right={<span className="text-[10px] text-muted">scripts are never executed</span>}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Toggle value={filter} onChange={setFilter} options={[{ value: "all", label: "All", count: s.total }, { value: "external", label: "External", count: s.external }, { value: "inline", label: "Inline", count: s.inline }, { value: "async", label: "Async", count: s.async }, { value: "defer", label: "Defer", count: s.defer }, { value: "module", label: "Module", count: s.module }, { value: "blocking", label: "Blocking", count: s.blockingInHead }]} />
            <div className="ml-auto w-64"><SearchInput value={q} onChange={setQ} placeholder="Search script URLs…" /></div>
          </div>
          {rows.length === 0 ? <Empty>No scripts match.</Empty> : (
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-panel text-left text-[10px] uppercase tracking-wider text-muted"><tr><th className="py-1 pr-2">Source</th><th className="py-1 pr-2">Flags</th><th className="py-1 pr-2">Type</th><th className="py-1 pr-2">Location</th><th className="py-1">Element</th></tr></thead>
                <tbody>
                  {rows.map((x) => (
                    <tr key={x.nodeId} className="border-t border-line/60 align-top">
                      <td className="mono max-w-[460px] break-all py-1 pr-2 text-fg">{x.src ?? <span className="text-muted">inline ({formatBytes(x.inlineSize)}): <span className="text-fg/70">{x.preview}</span></span>}</td>
                      <td className="py-1 pr-2"><div className="flex flex-wrap gap-1">{x.async && <Badge tone="ok">async</Badge>}{x.defer && <Badge tone="ok">defer</Badge>}{x.module && <Badge tone="accent">module</Badge>}{x.nomodule && <Badge>nomodule</Badge>}{x.external && <Badge tone="info">third-party</Badge>}{x.inHead && !x.inline && !x.async && !x.defer && !x.module && <Badge tone="warn">blocking</Badge>}</div></td>
                      <td className="mono py-1 pr-2 text-muted">{x.type ?? "text/javascript"}</td>
                      <td className="mono py-1 pr-2 text-muted">{x.inHead ? "head" : "body"}{x.sourceLine ? ` · L${x.sourceLine}` : ""}</td>
                      <td className="py-1"><NodeLink nodeId={x.nodeId} label="inspect" onSelect={onSelect} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card title="Script domains">
          {s.scriptDomains.length === 0 && <Empty>No external scripts.</Empty>}
          {s.scriptDomains.map((d) => (
            <div key={d.domain} className="flex justify-between text-xs"><span className="mono truncate text-fg">{d.domain}</span><span className="mono text-muted">{d.count}</span></div>
          ))}
        </Card>
      </div>
    </div>
  );
}
