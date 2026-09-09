import type { ComplexityAnalysis } from "@/types/analysis";
import type { DomDocument } from "@/types/dom";
import { describeNode, nodePath } from "@/lib/parser/dom-parser";

export const DEEP_THRESHOLD = 15;

/**
 * Complexity score (0 = simple, 100 = extremely complex). Sum of transparent penalties:
 *   elements:      0–35  (linear up to 3000 elements)
 *   max depth:     0–25  (linear from depth 8 to 32)
 *   deep branches: 0–15  (leaf nodes deeper than DEEP_THRESHOLD, relative share)
 *   class diversity: 0–10 (unique classes / elements)
 *   average children: 0–10 (wide containers, >12 children average penalised)
 *   id diversity:  0–5
 */
export function analyzeComplexity(dom: DomDocument): ComplexityAnalysis {
  const nodes = dom.nodes;
  const elements = dom.totalElements;
  const maxDepth = dom.maxDepth;
  let depthSum = 0;
  let deepLeaves = 0;
  let leaves = 0;
  const classes = new Set<string>();
  const ids = new Set<string>();
  let parentCount = 0;
  let childSum = 0;
  let maxChildren: ComplexityAnalysis["maxChildren"] = null;
  const deepestCandidates: { id: number; depth: number }[] = [];
  for (const n of nodes) {
    depthSum += n.depth;
    for (const c of n.classes) classes.add(c);
    if (n.idAttr) ids.add(n.idAttr);
    if (n.children.length === 0) {
      leaves++;
      if (n.depth > DEEP_THRESHOLD) deepLeaves++;
      if (n.depth >= maxDepth - 2) deepestCandidates.push({ id: n.id, depth: n.depth });
    } else {
      parentCount++;
      childSum += n.children.length;
      if (!maxChildren || n.children.length > maxChildren.count) maxChildren = { nodeId: n.id, label: describeNode(n), count: n.children.length };
    }
  }
  const averageDepth = nodes.length ? depthSum / nodes.length : 0;
  const averageChildren = parentCount ? childSum / parentCount : 0;
  const classDiversity = elements ? classes.size / elements : 0;
  const idDiversity = elements ? ids.size / elements : 0;

  // Largest branches: children of body (or depth 2 nodes) ranked by descendants.
  const body = nodes.find((n) => n.tag === "body");
  const candidates = body ? body.children.map((c) => nodes[c]).filter(Boolean) : nodes.filter((n) => n.depth === 2);
  const largestBranches = candidates
    .map((n) => ({ nodeId: n.id, label: describeNode(n), descendants: n.descendantCount, depth: n.depth }))
    .sort((a, b) => b.descendants - a.descendants)
    .slice(0, 8);
  const deepestPaths = deepestCandidates
    .sort((a, b) => b.depth - a.depth)
    .slice(0, 5)
    .map((d) => ({ nodeId: d.id, path: nodePath(dom, d.id), depth: d.depth }));

  const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));
  const breakdown: ComplexityAnalysis["breakdown"] = [
    { metric: "Element count", value: String(elements), penalty: Math.round(clamp((elements / 3000) * 35, 35)), explanation: "Linear up to 3,000 elements (max 35)." },
    { metric: "Maximum depth", value: String(maxDepth), penalty: Math.round(clamp(((maxDepth - 8) / 24) * 25, 25)), explanation: "Depth 8 = 0 penalty, depth 32+ = 25." },
    { metric: "Deep branches", value: `${deepLeaves} leaves deeper than ${DEEP_THRESHOLD}`, penalty: Math.round(clamp(leaves ? (deepLeaves / leaves) * 30 : 0, 15)), explanation: `Share of leaf nodes nested deeper than ${DEEP_THRESHOLD} (max 15).` },
    { metric: "Class diversity", value: `${classes.size} unique / ${elements} elements`, penalty: Math.round(clamp(classDiversity * 20, 10)), explanation: "Unique classes per element ×20 (max 10)." },
    { metric: "Average children", value: averageChildren.toFixed(1), penalty: Math.round(clamp(((averageChildren - 3) / 9) * 10, 10)), explanation: "3 children = 0 penalty, 12+ = 10." },
    { metric: "ID diversity", value: `${ids.size} unique IDs`, penalty: Math.round(clamp(idDiversity * 25, 5)), explanation: "Unique IDs per element ×25 (max 5)." },
  ];
  const score = clamp(breakdown.reduce((s, b) => s + b.penalty, 0), 100);
  const level = score < 30 ? "simple" : score < 55 ? "moderately complex" : score < 75 ? "complex" : "very complex";
  const explanation = `The DOM is ${level} (${score}/100). It has ${elements.toLocaleString()} elements with a maximum nesting depth of ${maxDepth}; ${deepLeaves} leaf nodes sit deeper than level ${DEEP_THRESHOLD}. The score is the sum of the penalties below.`;
  return {
    score,
    elements,
    maxDepth,
    averageDepth: Math.round(averageDepth * 10) / 10,
    deepBranches: deepLeaves,
    deepThreshold: DEEP_THRESHOLD,
    largestBranches,
    deepestPaths,
    classDiversity: Math.round(classDiversity * 1000) / 1000,
    idDiversity: Math.round(idDiversity * 1000) / 1000,
    averageChildren: Math.round(averageChildren * 10) / 10,
    maxChildren,
    breakdown,
    explanation,
  };
}
