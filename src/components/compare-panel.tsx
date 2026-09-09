"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { ComparisonWithAnalyses } from "@/types/comparison";
import type { RecentAnalysis } from "@/db/analyses";
import { validateUrl } from "@/lib/crawler/url-utils";
import { Badge, Card, Empty, Spinner } from "./ui";

interface Side { mode: "url" | "id"; url: string; id: string }

export function ComparePanel({ initialA, initialB, embedded = false }: { initialA?: { id?: string; url?: string }; initialB?: { id?: string; url?: string }; embedded?: boolean }) {
  const [a, setA] = useState<Side>({ mode: initialA?.id ? "id" : "url", url: initialA?.url ?? "", id: initialA?.id ?? "" });
  const [b, setB] = useState<Side>({ mode: initialB?.id ? "id" : "url", url: initialB?.url ?? "", id: initialB?.id ?? "" });
  const [recent, setRecent] = useState<RecentAnalysis[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ComparisonWithAnalyses | null>(null);

  useEffect(() => {
    fetch("/api/analyses").then((r) => r.json()).then((d) => setRecent(d.items ?? [])).catch(() => undefined);
  }, []);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    setError(null);
    const payload: { a: Record<string, string>; b: Record<string, string> } = { a: {}, b: {} };
    for (const [side, key] of [[a, "a"], [b, "b"]] as const) {
      if (side.mode === "id") {
        if (!side.id) return setError(`Select a stored analysis for site ${key.toUpperCase()}.`);
        payload[key] = { id: side.id };
      } else {
        const v = validateUrl(side.url);
        if (!v.ok) return setError(`Site ${key.toUpperCase()}: ${v.error}`);
        payload[key] = { url: v.normalized! };
      }
    }
    setBusy(true);
    setData(null);
    try {
      const res = await fetch("/api/compare", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Comparison failed (${res.status})`);
      setData(json);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const groups = useMemo(() => {
    if (!data) return [];
    const m = new Map<string, typeof data.comparison.metrics>();
    for (const x of data.comparison.metrics) m.set(x.group, [...(m.get(x.group) ?? []), x]);
    return [...m.entries()];
  }, [data]);

  const renderSide = (side: Side, set: (s: Side) => void, label: string) => (
    <div className="panel space-y-2 p-3">
      <div className="flex items-center justify-between"><span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Website {label}</span>
        <div className="flex gap-1 text-[11px]">
          <button type="button" onClick={() => set({ ...side, mode: "url" })} className={`rounded px-2 py-0.5 ${side.mode === "url" ? "bg-accent/20 text-white" : "text-muted"}`}>URL</button>
          <button type="button" onClick={() => set({ ...side, mode: "id" })} className={`rounded px-2 py-0.5 ${side.mode === "id" ? "bg-accent/20 text-white" : "text-muted"}`} disabled={!recent.length}>Stored</button>
        </div>
      </div>
      {side.mode === "url" ? (
        <input value={side.url} onChange={(e) => set({ ...side, url: e.target.value })} placeholder="https://example.com" className="mono w-full rounded border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
      ) : (
        <select value={side.id} onChange={(e) => set({ ...side, id: e.target.value })} className="mono w-full rounded border border-line bg-bg px-2 py-2 text-xs">
          <option value="">Select a stored analysis…</option>
          {recent.map((r) => <option key={r.id} value={r.id}>{r.hostname} — {new Date(r.createdAt).toLocaleString()} (score {r.overallScore ?? "?"})</option>)}
        </select>
      )}
    </div>
  );

  return (
    <div className={`space-y-4 fade-in ${embedded ? "" : "mx-auto max-w-6xl"}`}>
      <form onSubmit={submit} className="grid gap-3 md:grid-cols-[1fr_auto_1fr]">
        {renderSide(a, setA, "A")}
        <div className="flex items-center justify-center text-2xl text-muted">⇄</div>
        {renderSide(b, setB, "B")}
        <div className="md:col-span-3 flex items-center gap-3">
          <button type="submit" disabled={busy} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy ? <span className="flex items-center gap-2"><Spinner /> Analyzing both sites…</span> : "Compare"}</button>
          {error && <span className="text-sm text-bad">{error}</span>}
          <span className="ml-auto text-[11px] text-muted">Fresh URLs are fetched and analyzed live; stored analyses are reused.</span>
        </div>
      </form>

      {data && (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <Card title="Site A"><div className="mono truncate text-sm text-white">{data.comparison.a.hostname}</div><div className="mono truncate text-[11px] text-muted">{data.comparison.a.url}</div>{data.comparison.a.id && <a href={`/analyze?id=${data.comparison.a.id}`} className="text-xs text-accent hover:underline">open full analysis →</a>}</Card>
            <Card title="Summary"><div className="flex items-center justify-around text-center"><div><div className="mono text-2xl text-ok">{data.comparison.summary.aWins}</div><div className="text-[10px] uppercase text-muted">A better</div></div><div><div className="mono text-2xl text-muted">{data.comparison.summary.ties}</div><div className="text-[10px] uppercase text-muted">ties</div></div><div><div className="mono text-2xl text-ok">{data.comparison.summary.bWins}</div><div className="text-[10px] uppercase text-muted">B better</div></div></div></Card>
            <Card title="Site B"><div className="mono truncate text-sm text-white">{data.comparison.b.hostname}</div><div className="mono truncate text-[11px] text-muted">{data.comparison.b.url}</div>{data.comparison.b.id && <a href={`/analyze?id=${data.comparison.b.id}`} className="text-xs text-accent hover:underline">open full analysis →</a>}</Card>
          </div>
          <Card title="Metrics">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[10px] uppercase tracking-wider text-muted"><th className="py-1">Metric</th><th className="py-1 text-right">Site A</th><th className="py-1 text-right">Site B</th><th className="py-1 pl-4 text-[10px]">better</th></tr></thead>
              {groups.map(([g, items]) => (
                <tbody key={g}>
                  <tr><td colSpan={4} className="pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-accent">{g}</td></tr>
                  {items.map((m) => (
                    <tr key={m.key} className="border-t border-line/60">
                      <td className="py-1.5 text-fg">{m.label}</td>
                      <td className={`mono py-1.5 text-right ${m.better === "a" ? "text-ok" : ""}`}>{fmt(m.a)}</td>
                      <td className={`mono py-1.5 text-right ${m.better === "b" ? "text-ok" : ""}`}>{fmt(m.b)}</td>
                      <td className="py-1.5 pl-4 text-[10px] text-muted">{m.better === "tie" ? "tie" : m.better ? m.better.toUpperCase() : m.direction === "neutral" ? "—" : ""}</td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </Card>
          <Card title="Technologies">
            {data.comparison.technologies.length === 0 ? <Empty>No technologies detected on either site.</Empty> : (
              <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                {data.comparison.technologies.map((t) => (
                  <div key={t.name} className="flex items-center justify-between rounded border border-line bg-bg px-2 py-1 text-xs"><span>{t.name}</span><span className="flex gap-1"><Badge tone={t.inA ? "ok" : "neutral"}>A {t.inA ? "✓" : "–"}</Badge><Badge tone={t.inB ? "ok" : "neutral"}>B {t.inB ? "✓" : "–"}</Badge></span></div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function fmt(v: number | string | null): string {
  if (v === null || v === undefined) return "n/a";
  return typeof v === "number" ? v.toLocaleString() : v;
}
