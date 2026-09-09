"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AnalysisResult } from "@/types/analysis";
import type { TabId } from "./sidebar";
import { describeNode } from "@/lib/parser/dom-parser";

export interface SearchHit {
  group: string;
  label: string;
  detail?: string;
  tab: TabId;
  nodeId: number | null;
}

export function searchAnalysis(r: AnalysisResult, q: string): SearchHit[] {
  const query = q.trim().toLowerCase();
  if (query.length < 2) return [];
  const hits: SearchHit[] = [];
  const push = (h: SearchHit) => hits.length < 80 && hits.push(h);
  let domHits = 0;
  for (const n of r.dom.nodes) {
    if (domHits >= 20) break;
    const hay = `${n.tag} #${n.idAttr ?? ""} ${n.classes.map((c) => "." + c).join(" ")}`.toLowerCase();
    if (hay.includes(query) || (n.textPreview && n.textLength < 200 && n.textPreview.toLowerCase().includes(query))) {
      push({ group: "DOM", label: describeNode(n), detail: n.textPreview ? `"${n.textPreview.slice(0, 50)}"` : `depth ${n.depth}`, tab: "dom", nodeId: n.id });
      domHits++;
    }
  }
  let c = 0;
  for (const l of r.links.links) {
    if (c >= 12) break;
    if ((l.resolved ?? l.href).toLowerCase().includes(query) || l.text.toLowerCase().includes(query)) {
      push({ group: "Links", label: l.text || l.href, detail: l.resolved ?? l.href, tab: "links", nodeId: l.nodeId });
      c++;
    }
  }
  c = 0;
  for (const a of r.assets.assets) {
    if (c >= 12) break;
    if (a.url?.toLowerCase().includes(query)) {
      push({ group: "Assets", label: a.url, detail: a.type, tab: "assets", nodeId: a.nodeId });
      c++;
    }
  }
  c = 0;
  for (const s of r.scripts.scripts) {
    if (c >= 10) break;
    if ((s.src ?? s.preview ?? "").toLowerCase().includes(query)) {
      push({ group: "Scripts", label: s.src ?? `inline: ${s.preview?.slice(0, 50)}`, detail: s.inline ? "inline" : "external", tab: "scripts", nodeId: s.nodeId });
      c++;
    }
  }
  for (const i of r.issues) if (i.title.toLowerCase().includes(query) || i.evidence.toLowerCase().includes(query)) push({ group: "Issues", label: i.title, detail: `${i.severity} · ${i.category}`, tab: "issues", nodeId: i.nodeId });
  for (const t of r.technologies) if (t.name.toLowerCase().includes(query) || t.category.toLowerCase().includes(query)) push({ group: "Technologies", label: t.name, detail: `${t.category} · ${t.confidence}`, tab: "technologies", nodeId: null });
  for (const chk of r.seo.checks) if (chk.label.toLowerCase().includes(query)) push({ group: "SEO", label: chk.label, detail: chk.status, tab: "seo", nodeId: null });
  return hits;
}

export function SearchBar({ result, onNavigate }: { result: AnalysisResult; onNavigate: (tab: TabId, nodeId: number | null) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [debounced, setDebounced] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 120);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ref.current?.focus();
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const hits = useMemo(() => searchAnalysis(result, debounced), [result, debounced]);
  const groups = useMemo(() => {
    const m = new Map<string, SearchHit[]>();
    for (const h of hits) m.set(h.group, [...(m.get(h.group) ?? []), h]);
    return [...m.entries()];
  }, [hits]);
  return (
    <div className="relative w-full max-w-md">
      <div className="flex items-center gap-2 rounded-md border border-line bg-bg px-2.5 py-1.5 focus-within:border-accent">
        <span className="text-xs text-muted">🔍</span>
        <input ref={ref} value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="Search nodes, ids, classes, links, assets, issues…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/60" />
        <kbd>⌘K</kbd>
      </div>
      {open && debounced.trim().length >= 2 && (
        <div className="absolute left-0 right-0 z-40 mt-1 max-h-[60vh] overflow-auto rounded-lg border border-line bg-panel p-1 shadow-2xl" onMouseDown={(e) => e.preventDefault()}>
          {groups.length === 0 && <div className="px-3 py-3 text-sm text-muted">No matches in this analysis.</div>}
          {groups.map(([g, items]) => (
            <div key={g}>
              <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted">{g} · {items.length}</div>
              {items.map((h, i) => (
                <button key={i} type="button" onClick={() => { onNavigate(h.tab, h.nodeId); setOpen(false); }} className="block w-full rounded px-3 py-1.5 text-left hover:bg-panel2">
                  <div className="mono truncate text-xs text-fg">{h.label}</div>
                  {h.detail && <div className="truncate text-[11px] text-muted">{h.detail}</div>}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
