import type { DomDocument, DomNode } from "@/types/dom";
import type { GraphLayout, GraphMode, GraphNode, GraphEdge } from "./graph-types";
import { describeNode } from "@/lib/parser/dom-parser";

const NODE_W = 150;
const NODE_H = 40;
const H_GAP = 22;
const V_GAP = 70;
const SKIP_TAGS = new Set(["script", "style", "link", "meta", "noscript", "template", "br", "path", "g", "defs", "use", "symbol", "clippath", "lineargradient", "stop", "title"]);

export interface BuildOptions {
  mode: GraphMode;
  selectedId: number | null;
  /** Max children to expand per node in overview. */
  maxChildren?: number;
  /** Max nodes total. */
  maxNodes?: number;
  maxDepth?: number;
}

/**
 * Build a pruned, laid-out tree for the visual graph.
 *  overview: root → depth-limited, top-N children by descendant count
 *  focused:  ancestors of selected + selected + its children + siblings
 *  subtree:  selected node as root, depth-limited
 */
export function buildGraph(dom: DomDocument, opts: BuildOptions): GraphLayout {
  const nodes = dom.nodes;
  const sel = opts.selectedId !== null && nodes[opts.selectedId] ? opts.selectedId : null;
  const maxNodes = opts.maxNodes ?? 140;
  const maxChildren = opts.maxChildren ?? 8;
  const maxDepth = opts.maxDepth ?? (opts.mode === "subtree" ? 4 : 4);

  const ancestorSet = new Set<number>();
  if (sel !== null) {
    let cur = nodes[sel].parent;
    while (cur !== null) {
      ancestorSet.add(cur);
      cur = nodes[cur].parent;
    }
  }

  let rootId = dom.root;
  if (opts.mode === "subtree" && sel !== null) rootId = sel;

  interface TreeItem { id: number; children: TreeItem[]; hidden: number; }
  let count = 0;
  const build = (id: number, relDepth: number): TreeItem => {
    const n = nodes[id];
    count++;
    const item: TreeItem = { id, children: [], hidden: 0 };
    let kids = n.children.map((c) => nodes[c]).filter((c): c is DomNode => Boolean(c) && !SKIP_TAGS.has(c.tag));
    if (opts.mode === "focused" && sel !== null) {
      // Only expand along the path to the selected node, then show its children.
      if (ancestorSet.has(id)) {
        const onPath = kids.filter((k) => k.id === sel || ancestorSet.has(k.id));
        const others = kids.filter((k) => k.id !== sel && !ancestorSet.has(k.id)).slice(0, 3);
        kids = [...onPath, ...others];
      } else if (id === sel) {
        kids = kids.slice(0, 12);
      } else {
        item.hidden = kids.length;
        kids = [];
      }
    } else {
      if (relDepth >= maxDepth) {
        item.hidden = kids.length;
        kids = [];
      } else if (kids.length > maxChildren) {
        // keep biggest branches, preserve document order
        const keep = new Set([...kids].sort((a, b) => b.descendantCount - a.descendantCount).slice(0, maxChildren).map((k) => k.id));
        item.hidden = kids.length - maxChildren;
        kids = kids.filter((k) => keep.has(k.id));
      }
    }
    for (const k of kids) {
      if (count >= maxNodes) {
        item.hidden++;
        continue;
      }
      item.children.push(build(k.id, relDepth + 1));
    }
    return item;
  };
  const tree = build(rootId, 0);

  // Layout: leaves get consecutive x slots; parents centered over children.
  const out: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  let nextX = 0;
  let maxY = 0;
  const place = (item: TreeItem, level: number): number => {
    const n = nodes[item.id];
    let x: number;
    if (!item.children.length) {
      x = nextX;
      nextX += NODE_W + H_GAP;
    } else {
      const xs = item.children.map((c) => place(c, level + 1));
      x = (xs[0] + xs[xs.length - 1]) / 2;
    }
    const y = level * (NODE_H + V_GAP);
    if (y > maxY) maxY = y;
    out.push({ id: item.id, label: describeNode(n), tag: n.tag, depth: n.depth, descendants: n.descendantCount, x, y, hiddenChildren: item.hidden, isSelected: item.id === sel, isAncestor: ancestorSet.has(item.id) });
    for (const c of item.children) edges.push({ from: item.id, to: c.id });
    return x;
  };
  place(tree, 0);
  return { nodes: out, edges, width: Math.max(nextX, NODE_W), height: maxY + NODE_H, mode: opts.mode, totalShown: out.length, rootId };
}

export const GRAPH_NODE_W = NODE_W;
export const GRAPH_NODE_H = NODE_H;
