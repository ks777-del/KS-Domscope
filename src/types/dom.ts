/** Flat, serializable DOM representation produced by the parser. */
export interface DomNode {
  /** Index in the flat node array. */
  id: number;
  tag: string;
  attributes: Record<string, string>;
  idAttr: string | null;
  classes: string[];
  parent: number | null;
  children: number[];
  depth: number;
  /** Number of element descendants (not counting self). */
  descendantCount: number;
  /** Length of direct text content (own text nodes only). */
  textLength: number;
  /** Trimmed preview of direct text. */
  textPreview: string;
  /** Number of direct text nodes. */
  textNodeCount: number;
  /** 1-based source line/column if determinable. */
  sourceLine: number | null;
  sourceColumn: number | null;
}

export interface DomDocument {
  nodes: DomNode[];
  root: number;
  /** Total element nodes (before any truncation). */
  totalElements: number;
  totalTextNodes: number;
  totalComments: number;
  maxDepth: number;
  /** True when the node list was truncated for transport. */
  truncated: boolean;
}
