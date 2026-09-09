"use client";
import { memo } from "react";
import type { DomNode } from "@/types/dom";

export const ROW_HEIGHT = 24;

const TAG_COLORS: Record<string, string> = {
  html: "text-purple-300", head: "text-purple-300", body: "text-purple-300",
  header: "text-cyan-300", nav: "text-cyan-300", main: "text-cyan-300", footer: "text-cyan-300", section: "text-cyan-300", article: "text-cyan-300", aside: "text-cyan-300",
  a: "text-blue-300", img: "text-pink-300", svg: "text-pink-300", picture: "text-pink-300", video: "text-pink-300",
  script: "text-amber-300", style: "text-amber-300", link: "text-amber-300", meta: "text-amber-300/70", title: "text-amber-300",
  form: "text-emerald-300", input: "text-emerald-300", button: "text-emerald-300", select: "text-emerald-300", textarea: "text-emerald-300", label: "text-emerald-300",
  h1: "text-orange-300", h2: "text-orange-300", h3: "text-orange-300", h4: "text-orange-300",
};

export const DomNodeRow = memo(function DomNodeRow({ node, expanded, selected, match, onToggle, onSelect, style }: {
  node: DomNode;
  expanded: boolean;
  selected: boolean;
  match: boolean;
  onToggle: (id: number) => void;
  onSelect: (id: number) => void;
  style: React.CSSProperties;
}) {
  const hasChildren = node.children.length > 0;
  return (
    <div
      style={{ ...style, paddingLeft: 6 + node.depth * 14 }}
      className={`mono group flex cursor-pointer items-center gap-1 whitespace-nowrap pr-2 text-[12px] leading-6 ${selected ? "bg-accent/20" : match ? "bg-warn/10" : "hover:bg-panel2"}`}
      onClick={() => onSelect(node.id)}
      role="treeitem"
      aria-expanded={hasChildren ? expanded : undefined}
      aria-selected={selected}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (hasChildren) onToggle(node.id);
        }}
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded text-[10px] text-muted ${hasChildren ? "hover:bg-line hover:text-fg" : "opacity-0"}`}
        aria-label={expanded ? "Collapse" : "Expand"}
        tabIndex={-1}
      >
        {expanded ? "▾" : "▸"}
      </button>
      <span className={TAG_COLORS[node.tag] ?? "text-fg"}>{node.tag}</span>
      {node.idAttr && <span className="text-yellow-200/90">#{node.idAttr}</span>}
      {node.classes.length > 0 && <span className="text-sky-200/70">.{node.classes.slice(0, 3).join(".")}{node.classes.length > 3 ? `…+${node.classes.length - 3}` : ""}</span>}
      {node.textPreview && !hasChildren && <span className="ml-1 truncate text-muted/70">“{node.textPreview.slice(0, 40)}”</span>}
      <span className="ml-auto pl-2 text-[10px] text-muted/60 opacity-0 group-hover:opacity-100">{hasChildren ? `${node.children.length}c · ` : ""}d{node.depth}</span>
    </div>
  );
});
