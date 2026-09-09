"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DomDocument } from "@/types/dom";
import { DomNodeRow, ROW_HEIGHT } from "./dom-node";
import { ancestors } from "@/lib/parser/dom-parser";

const OVERSCAN = 12;

export function DomTree({ dom, selectedId, onSelect }: { dom: DomDocument; selectedId: number | null; onSelect: (id: number) => void }) {
  const [expanded, setExpanded] = useState<Set<number>>(() => {
    const s = new Set<number>();
    for (const n of dom.nodes) if (n.depth <= 1 || (n.depth === 2 && n.tag !== "head")) s.add(n.id);
    return s;
  });
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(400);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim().toLowerCase()), 150);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.clientHeight));
    ro.observe(el);
    setHeight(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  // Search: nodes matching + set of nodes with a matching descendant (ids are pre-order so reverse pass works).
  const { matches, visibleInSearch } = useMemo(() => {
    const matches = new Set<number>();
    if (!debounced) return { matches, visibleInSearch: null as Set<number> | null };
    const nodes = dom.nodes;
    for (const n of nodes) {
      const hay = `${n.tag}${n.idAttr ? "#" + n.idAttr : ""}${n.classes.map((c) => "." + c).join("")}`.toLowerCase();
      if (hay.includes(debounced) || (n.textLength > 0 && n.textLength < 300 && n.textPreview.toLowerCase().includes(debounced))) matches.add(n.id);
    }
    const visible = new Set<number>(matches);
    for (let i = nodes.length - 1; i >= 0; i--) {
      if (visible.has(nodes[i].id) && nodes[i].parent !== null) visible.add(nodes[i].parent!);
    }
    return { matches, visibleInSearch: visible };
  }, [dom, debounced]);

  // Flatten the visible rows.
  const rows = useMemo(() => {
    const out: number[] = [];
    const nodes = dom.nodes;
    const stack: number[] = [dom.root];
    while (stack.length) {
      const id = stack.pop()!;
      const n = nodes[id];
      if (!n) continue;
      if (visibleInSearch && !visibleInSearch.has(id)) continue;
      out.push(id);
      const open = visibleInSearch ? true : expanded.has(id);
      if (open) for (let i = n.children.length - 1; i >= 0; i--) stack.push(n.children[i]);
    }
    return out;
  }, [dom, expanded, visibleInSearch]);

  // Reveal selected node (state adjustment during render, keyed on the selection).
  const [revealedFor, setRevealedFor] = useState<number | null>(null);
  if (selectedId !== revealedFor) {
    setRevealedFor(selectedId);
    if (selectedId !== null && dom.nodes[selectedId]) {
      const next = new Set(expanded);
      let changed = false;
      for (const a of ancestors(dom, selectedId)) if (!next.has(a)) { next.add(a); changed = true; }
      if (changed) setExpanded(next);
    }
  }

  useEffect(() => {
    if (selectedId === null) return;
    const idx = rows.indexOf(selectedId);
    const el = containerRef.current;
    if (idx === -1 || !el) return;
    const top = idx * ROW_HEIGHT;
    if (top < el.scrollTop || top > el.scrollTop + el.clientHeight - ROW_HEIGHT) el.scrollTo({ top: Math.max(0, top - el.clientHeight / 2) });
  }, [selectedId, rows]);

  const toggle = useCallback((id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = (depth: number) => {
    const s = new Set<number>();
    for (const n of dom.nodes) if (n.depth <= depth) s.add(n.id);
    setExpanded(s);
  };

  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const end = Math.min(rows.length, Math.ceil((scrollTop + height) / ROW_HEIGHT) + OVERSCAN);
  const slice = rows.slice(start, end);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-line p-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tag, #id, .class, text…" className="mono min-w-0 flex-1 rounded-md border border-line bg-bg px-2 py-1 text-xs outline-none focus:border-accent" />
        {debounced && <span className="mono text-[11px] text-muted">{matches.size}</span>}
        <button type="button" onClick={() => expandAll(3)} className="rounded border border-line px-1.5 py-1 text-[10px] text-muted hover:text-fg" title="Expand to depth 3">+3</button>
        <button type="button" onClick={() => expandAll(99)} className="rounded border border-line px-1.5 py-1 text-[10px] text-muted hover:text-fg" title="Expand all">All</button>
        <button type="button" onClick={() => expandAll(0)} className="rounded border border-line px-1.5 py-1 text-[10px] text-muted hover:text-fg" title="Collapse all">−</button>
      </div>
      <div ref={containerRef} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)} className="min-h-0 flex-1 overflow-auto" role="tree">
        <div style={{ height: rows.length * ROW_HEIGHT, position: "relative", minWidth: "max-content", width: "100%" }}>
          {slice.map((id, i) => {
            const n = dom.nodes[id];
            return <DomNodeRow key={id} node={n} expanded={visibleInSearch ? true : expanded.has(id)} selected={id === selectedId} match={matches.has(id)} onToggle={toggle} onSelect={onSelect} style={{ position: "absolute", top: (start + i) * ROW_HEIGHT, left: 0, right: 0, height: ROW_HEIGHT }} />;
          })}
        </div>
      </div>
      <div className="mono flex items-center justify-between border-t border-line px-2 py-1 text-[10px] text-muted">
        <span>{rows.length.toLocaleString()} rows · {dom.nodes.length.toLocaleString()} nodes{dom.truncated ? ` (of ${dom.totalElements.toLocaleString()}, truncated)` : ""}</span>
        <span>depth {dom.maxDepth}</span>
      </div>
    </div>
  );
}
