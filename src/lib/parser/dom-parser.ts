import type { HTMLElement, Node } from "node-html-parser";
import type { DomDocument, DomNode } from "@/types/dom";
import { offsetToPosition, decodeEntities, type ParsedHtml } from "./html-parser";

export const MAX_TRANSPORT_NODES = 25_000;
const PREVIEW_LENGTH = 140;

/** Server-side document: serializable DOM plus raw inline content for script/style nodes. */
export interface ParsedDocument {
  dom: DomDocument;
  /** nodeId -> raw inline content (script/style/noscript/template) */
  inlineContent: Map<number, string>;
  html: string;
}

const NODE_ELEMENT = 1;
const NODE_TEXT = 3;
const NODE_COMMENT = 8;
const RAW_TEXT_TAGS = new Set(["script", "style", "noscript", "template"]);

/** Build the flat DOM representation from a parsed HTML tree. */
export function buildDomDocument(parsed: ParsedHtml): ParsedDocument {
  const nodes: DomNode[] = [];
  const inlineContent = new Map<number, string>();
  let totalTextNodes = 0;
  let totalComments = 0;
  let maxDepth = 0;

  // Find the <html> element, or synthesize a root from the fragment.
  const topElements = parsed.root.childNodes.filter((n) => n.nodeType === NODE_ELEMENT) as HTMLElement[];
  let rootEl = topElements.find((el) => el.rawTagName?.toLowerCase() === "html") ?? null;
  const synthetic = !rootEl;

  const stack: { el: HTMLElement; parent: number | null; depth: number }[] = [];
  let rootId = 0;

  if (rootEl) {
    stack.push({ el: rootEl, parent: null, depth: 0 });
  } else {
    // Synthetic root when the document lacks <html>.
    nodes.push(makeNode(0, "html", {}, null, 0, null, null));
    rootId = 0;
    for (let i = topElements.length - 1; i >= 0; i--) stack.push({ el: topElements[i], parent: 0, depth: 1 });
    // count stray top-level text/comments
    for (const n of parsed.root.childNodes) {
      if (n.nodeType === NODE_TEXT && n.rawText.trim()) totalTextNodes++;
      if (n.nodeType === NODE_COMMENT) totalComments++;
    }
  }

  // Iterative pre-order traversal.
  while (stack.length) {
    const { el, parent, depth } = stack.pop()!;
    const id = nodes.length;
    const tag = (el.rawTagName || "unknown").toLowerCase();
    const attrs = readAttributes(el);
    let line: number | null = null;
    let col: number | null = null;
    const range = (el as unknown as { range?: [number, number] }).range;
    if (range && typeof range[0] === "number") {
      const pos = offsetToPosition(parsed.lineStarts, range[0]);
      line = pos.line;
      col = pos.column;
    }
    const node = makeNode(id, tag, attrs, parent, depth, line, col);
    nodes.push(node);
    if (parent !== null) nodes[parent].children.push(id);
    if (depth > maxDepth) maxDepth = depth;

    const childElements: HTMLElement[] = [];
    let ownText = "";
    let ownTextNodes = 0;
    for (const child of el.childNodes as Node[]) {
      if (child.nodeType === NODE_ELEMENT) {
        childElements.push(child as HTMLElement);
      } else if (child.nodeType === NODE_TEXT) {
        const raw = child.rawText;
        if (RAW_TEXT_TAGS.has(tag)) {
          ownText += raw;
        } else if (raw.trim()) {
          ownTextNodes++;
          totalTextNodes++;
          ownText += decodeEntities(raw);
        }
      } else if (child.nodeType === NODE_COMMENT) {
        totalComments++;
      }
    }

    if (RAW_TEXT_TAGS.has(tag)) {
      inlineContent.set(id, ownText);
      node.textLength = ownText.length;
      node.textPreview = ownText.trim().slice(0, PREVIEW_LENGTH);
      node.textNodeCount = ownText.trim() ? 1 : 0;
      if (ownText.trim()) totalTextNodes++;
    } else {
      const collapsed = ownText.replace(/\s+/g, " ").trim();
      node.textLength = collapsed.length;
      node.textPreview = collapsed.slice(0, PREVIEW_LENGTH);
      node.textNodeCount = ownTextNodes;
    }

    for (let i = childElements.length - 1; i >= 0; i--) {
      stack.push({ el: childElements[i], parent: id, depth: depth + 1 });
    }
  }

  // Descendant counts (children have larger ids than parents in pre-order).
  for (let i = nodes.length - 1; i > 0; i--) {
    const p = nodes[i].parent;
    if (p !== null) nodes[p].descendantCount += nodes[i].descendantCount + 1;
  }

  const totalElements = nodes.length;
  let truncated = false;
  let out = nodes;
  if (nodes.length > MAX_TRANSPORT_NODES) {
    truncated = true;
    out = nodes.slice(0, MAX_TRANSPORT_NODES).map((n) => ({
      ...n,
      children: n.children.filter((c) => c < MAX_TRANSPORT_NODES),
    }));
  }

  void synthetic;
  return {
    dom: { nodes: out, root: rootId, totalElements, totalTextNodes, totalComments, maxDepth, truncated },
    inlineContent,
    html: parsed.html,
  };
}

function makeNode(
  id: number,
  tag: string,
  attributes: Record<string, string>,
  parent: number | null,
  depth: number,
  line: number | null,
  col: number | null,
): DomNode {
  const classAttr = attributes.class ?? "";
  return {
    id,
    tag,
    attributes,
    idAttr: attributes.id?.trim() || null,
    classes: classAttr.split(/\s+/).filter(Boolean),
    parent,
    children: [],
    depth,
    descendantCount: 0,
    textLength: 0,
    textPreview: "",
    textNodeCount: 0,
    sourceLine: line,
    sourceColumn: col,
  };
}

function readAttributes(el: HTMLElement): Record<string, string> {
  const out: Record<string, string> = {};
  const attrs = el.attributes ?? {};
  for (const key of Object.keys(attrs)) {
    out[key.toLowerCase()] = decodeEntities(String(attrs[key] ?? ""));
  }
  return out;
}

/* ---------- Query helpers on the flat DOM (isomorphic) ---------- */

export function nodesByTag(dom: DomDocument, tag: string): DomNode[] {
  return dom.nodes.filter((n) => n.tag === tag);
}

export function describeNode(n: DomNode): string {
  let s = n.tag;
  if (n.idAttr) s += `#${n.idAttr}`;
  if (n.classes.length) s += "." + n.classes.slice(0, 3).join(".");
  return s;
}

export function nodePath(dom: DomDocument, id: number): string {
  const parts: string[] = [];
  let cur: number | null = id;
  let guard = 0;
  while (cur !== null && guard++ < 500) {
    const n: DomNode | undefined = dom.nodes[cur];
    if (!n) break;
    parts.unshift(describeNode(n));
    cur = n.parent;
  }
  return parts.join(" > ");
}

export function ancestors(dom: DomDocument, id: number): number[] {
  const out: number[] = [];
  let cur = dom.nodes[id]?.parent ?? null;
  while (cur !== null) {
    out.push(cur);
    cur = dom.nodes[cur]?.parent ?? null;
  }
  return out;
}

/** Full (deep) text of a node from the flat representation. */
export function deepText(dom: DomDocument, id: number, limit = 400): string {
  let out = "";
  const stack = [id];
  while (stack.length && out.length < limit) {
    const n = dom.nodes[stack.pop()!];
    if (!n) continue;
    if (n.tag === "script" || n.tag === "style" || n.tag === "noscript" || n.tag === "template") continue;
    if (n.textPreview) out += (out ? " " : "") + n.textPreview;
    for (let i = n.children.length - 1; i >= 0; i--) stack.push(n.children[i]);
  }
  return out.slice(0, limit);
}

export function isInside(dom: DomDocument, id: number, ancestorTag: string): boolean {
  let cur = dom.nodes[id]?.parent ?? null;
  while (cur !== null) {
    if (dom.nodes[cur].tag === ancestorTag) return true;
    cur = dom.nodes[cur].parent;
  }
  return false;
}
