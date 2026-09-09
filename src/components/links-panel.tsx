"use client";
import { useMemo, useState } from "react";
import type { AnalysisResult, LinkKind } from "@/types/analysis";
import { Badge, Card, Empty, NodeLink, SearchInput, Stat, Toggle } from "./ui";

const KINDS: LinkKind[] = ["internal", "external", "anchor", "mailto", "tel", "javascript", "other"];

export function LinksPanel({ result, onSelect }: { result: AnalysisResult; onSelect: (id: number) => void }) {
  const [kind, setKind] = useState<string>("all");
  const [q, setQ] = useState("");
  const l = result.links;
  const rows = useMemo(() => {
    const query = q.toLowerCase();
    return l.links.filter((x) => (kind === "all" || x.kind === kind) && (!query || (x.resolved ?? x.href).toLowerCase().includes(query) || x.text.toLowerCase().includes(query))).slice(0, 500);
  }, [l.links, kind, q]);
  return (
    <div className="space-y-4 fade-in">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <Stat label="Total" value={l.total} sub={`${l.uniqueDestinations} unique`} />
        {KINDS.slice(0, 6).map((k) => <Stat key={k} label={k} value={l.counts[k]} />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <Card title={`Links (${rows.length}${rows.length === 500 ? "+" : ""})`}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Toggle value={kind} onChange={setKind} options={[{ value: "all", label: "All", count: l.total }, ...KINDS.map((k) => ({ value: k, label: k, count: l.counts[k] }))]} />
            <div className="ml-auto w-64"><SearchInput value={q} onChange={setQ} placeholder="Search URLs or text…" /></div>
          </div>
          {rows.length === 0 ? <Empty>No links match.</Empty> : (
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-panel text-left text-[10px] uppercase tracking-wider text-muted"><tr><th className="py-1 pr-2">Kind</th><th className="py-1 pr-2">Text</th><th className="py-1 pr-2">URL</th><th className="py-1">Flags</th></tr></thead>
                <tbody>
                  {rows.map((x, i) => (
                    <tr key={i} className="border-t border-line/60 align-top">
                      <td className="py-1 pr-2"><Badge tone={x.kind === "internal" ? "accent" : x.kind === "external" ? "info" : x.kind === "javascript" ? "warn" : "neutral"}>{x.kind}</Badge></td>
                      <td className="max-w-[220px] truncate py-1 pr-2 text-fg" title={x.text}><NodeLink nodeId={x.nodeId} label={x.text || "(no text)"} onSelect={onSelect} /></td>
                      <td className="mono max-w-[420px] break-all py-1 pr-2 text-muted">{x.resolved ?? (x.href || "(empty)")}</td>
                      <td className="py-1 text-muted">{[x.target, x.nofollow ? "nofollow" : null, x.rel && !x.nofollow ? `rel=${x.rel}` : null].filter(Boolean).join(" · ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card title="External domains">
          {l.externalDomains.length === 0 && <Empty>No external links.</Empty>}
          {l.externalDomains.slice(0, 30).map((d) => (
            <div key={d.domain} className="flex justify-between text-xs"><span className="mono truncate text-fg">{d.domain}</span><span className="mono text-muted">{d.count}</span></div>
          ))}
          {l.emptyHrefs > 0 && <p className="mt-3 text-xs text-warn">{l.emptyHrefs} link(s) have an empty href.</p>}
        </Card>
      </div>
    </div>
  );
}
