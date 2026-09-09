export type GraphMode = "overview" | "focused" | "subtree";

export interface GraphNode {
  id: number;
  label: string;
  tag: string;
  depth: number;
  descendants: number;
  x: number;
  y: number;
  /** Number of children hidden by pruning. */
  hiddenChildren: number;
  isSelected: boolean;
  isAncestor: boolean;
}

export interface GraphEdge {
  from: number;
  to: number;
}

export interface GraphLayout {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
  mode: GraphMode;
  totalShown: number;
  rootId: number;
}
