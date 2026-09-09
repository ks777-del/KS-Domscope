"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DomDocument } from "@/types/dom";
import type { GraphMode } from "@/lib/graph/graph-types";
import { buildGraph, GRAPH_NODE_H, GRAPH_NODE_W } from "@/lib/graph/graph-builder";
import { Toggle } from "./ui";

const TAG_FILL: Record<string, string> = { html: "#3b2f5c", head: "#3b2f5c", body: "#3b2f5c", header: "#0f3d4a", nav: "#0f3d4a", main: "#0f3d4a", footer: "#0f3d4a", section: "#123a3f", article: "#123a3f", aside: "#123a3f", form: "#0f3d2e", ul: "#2a2f3a", ol: "#2a2f3a", div: "#1a2232", a: "#1c2f52", img: "#4a1f3a", svg: "#4a1f3a", h1: "#4a2f14", h2: "#4a2f14", h3: "#4a2f14" };

export function ArchitectureGraph({ dom, selectedId, onSelect, large = false }: { dom: DomDocument; selectedId: number | null; onSelect: (id: number) => void; large?: boolean }) {
  const [mode, setMode] = useState<GraphMode>("overview");
  const [view, setView] = useState({ x: 20, y: 20, k: 1 });
  const [drag, setDrag] = useState<{ nodeId: number | null; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [offsets, setOffsets] = useState<Record<number, { dx: number; dy: number }>>({});
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 600, h: 400 });

  const layout = useMemo(() => buildGraph(dom, { mode, selectedId, maxNodes: large ? 220 : 120, maxChildren: large ? 10 : 7, maxDepth: mode === "subtree" ? 4 : large ? 5 : 4 }), [dom, mode, selectedId, large]);

  useEffect(() => {
    const el = svgRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const fit = useCallback(() => {
    const k = Math.min(1.2, Math.max(0.15, (size.w - 40) / Math.max(layout.width, 1), (size.h - 40) / Math.max(layout.height, 1)));
    setView({ x: (size.w - layout.width * k) / 2, y: 24, k });
    setOffsets({});
  }, [layout.width, layout.height, size]);

  useEffect(() => {
    fit();
  }, [fit, mode]);

  useEffect(() => {
    if (selectedId !== null && mode === "overview" && !layout.nodes.some((n) => n.id === selectedId)) {
      // selection outside overview → switch to focused so the user sees it
      setMode("focused");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => onWheel(e);
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const rect = svgRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    setView((v) => {
      const k = Math.min(3, Math.max(0.1, v.k * factor));
      return { k, x: mx - (mx - v.x) * (k / v.k), y: my - (my - v.y) * (k / v.k) };
    });
  };
  const onPointerDown = (e: React.PointerEvent, nodeId: number | null) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const o = nodeId !== null ? offsets[nodeId] ?? { dx: 0, dy: 0 } : { dx: view.x, dy: view.y };
    setDrag({ nodeId, startX: e.clientX, startY: e.clientY, origX: o.dx, origY: o.dy });
  };
  const moved = useRef(false);
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 3) moved.current = true;
    if (drag.nodeId === null) setView((v) => ({ ...v, x: drag.origX + dx, y: drag.origY + dy }));
    else setOffsets((o) => ({ ...o, [drag.nodeId!]: { dx: drag.origX + dx / view.k, dy: drag.origY + dy / view.k } }));
  };
  const onPointerUp = (e: React.PointerEvent, nodeId: number | null) => {
    if (drag && nodeId !== null && !moved.current) onSelect(nodeId);
    setDrag(null);
    moved.current = false;
    void e;
  };

  const pos = (id: number) => {
    const n = layout.nodes.find((x) => x.id === id)!;
    const o = offsets[id] ?? { dx: 0, dy: 0 };
    return { x: n.x + o.dx, y: n.y + o.dy };
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-2">
        <Toggle value={mode} onChange={(v) => setMode(v as GraphMode)} options={[{ value: "overview", label: "Overview" }, { value: "focused", label: "Focused" }, { value: "subtree", label: "Subtree" }]} />
        <span className="mono ml-auto text-[11px] text-muted">{layout.totalShown} nodes shown · zoom {Math.round(view.k * 100)}%</span>
        <button type="button" onClick={fit} className="rounded border border-line px-2 py-1 text-[11px] text-muted hover:text-fg">Reset view</button>
      </div>
      <div className="relative min-h-0 flex-1 grid-bg" style={{ touchAction: "none" }}>
        <svg ref={svgRef} width={size.w} height={size.h} className={`block ${drag ? "cursor-grabbing" : "cursor-grab"}`} onPointerDown={(e) => onPointerDown(e, null)} onPointerMove={onPointerMove} onPointerUp={(e) => onPointerUp(e, null)} onPointerLeave={() => setDrag(null)}>
          <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
            {layout.edges.map((e) => {
              const a = pos(e.from);
              const b = pos(e.to);
              const x1 = a.x + GRAPH_NODE_W / 2, y1 = a.y + GRAPH_NODE_H, x2 = b.x + GRAPH_NODE_W / 2, y2 = b.y;
              const my = (y1 + y2) / 2;
              const target = layout.nodes.find((n) => n.id === e.to);
              return <path key={`${e.from}-${e.to}`} d={`M${x1} ${y1} C${x1} ${my} ${x2} ${my} ${x2} ${y2}`} fill="none" stroke={target?.isSelected || target?.isAncestor ? "#4f8cff" : "#2b3648"} strokeWidth={target?.isSelected ? 2 : 1.2} />;
            })}
            {layout.nodes.map((n) => {
              const p = pos(n.id);
              const fill = TAG_FILL[n.tag] ?? "#1a2232";
              return (
                <g key={n.id} transform={`translate(${p.x} ${p.y})`} onPointerDown={(e) => { e.stopPropagation(); onPointerDown(e, n.id); }} onPointerUp={(e) => { e.stopPropagation(); onPointerUp(e, n.id); }} onDoubleClick={() => { onSelect(n.id); setMode("subtree"); }} className="cursor-pointer">
                  <rect width={GRAPH_NODE_W} height={GRAPH_NODE_H} rx={8} fill={fill} stroke={n.isSelected ? "#4f8cff" : n.isAncestor ? "#4f8cff88" : "#2b3648"} strokeWidth={n.isSelected ? 2 : 1} />
                  <text x={10} y={17} fill="#fff" fontSize={12} fontFamily="ui-monospace, monospace" fontWeight={600}>{n.label.length > 19 ? n.label.slice(0, 18) + "…" : n.label}</text>
                  <text x={10} y={31} fill="#8b97ab" fontSize={10} fontFamily="ui-monospace, monospace">d{n.depth} · {n.descendants} desc{n.hiddenChildren ? ` · +${n.hiddenChildren} hidden` : ""}</text>
                  {n.hiddenChildren > 0 && <circle cx={GRAPH_NODE_W - 8} cy={8} r={4} fill="#fbbf24" />}
                </g>
              );
            })}
          </g>
        </svg>
        <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-panel/80 px-2 py-1 text-[10px] text-muted">Scroll to zoom · drag background to pan · drag nodes · click to inspect · double-click to focus subtree · ● = pruned children</div>
      </div>
    </div>
  );
}
