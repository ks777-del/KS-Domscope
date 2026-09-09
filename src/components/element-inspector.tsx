"use client";
import { useMemo } from "react";
import type { AnalysisResult } from "@/types/analysis";
import { describeNode, nodePath } from "@/lib/parser/dom-parser";
import { Badge, Empty } from "./ui";

export function ElementInspector({ result, nodeId, onSelect }: { result: AnalysisResult; nodeId: number | null; onSelect: (id: number) => void }) {
  const dom = result.dom;
  const node = nodeId !== null ? dom.nodes[nodeId] : null;

  const subtree = useMemo(() => {
    if (!node) return null;
    let links = 0, images = 0, forms = 0, inputs = 0, text = 0, scripts = 0, maxDepth = node.depth;
    const stack = [node.id];
    while (stack.length) {
      const n = dom.nodes[stack.pop()!];
      if (!n) continue;
      if (n.tag === "a" && n.attributes.href !== undefined) links++;
      else if (n.tag === "img") images++;
      else if (n.tag === "form") forms++;
      else if (n.tag === "input" || n.tag === "select" || n.tag === "textarea") inputs++;
      else if (n.tag === "script") scripts++;
      if (n.tag !== "script" && n.tag !== "style") text += n.textLength;
      if (n.depth > maxDepth) maxDepth = n.depth;
      for (const c of n.children) stack.push(c);
    }
    return { links, images, forms, inputs, text, scripts, relDepth: maxDepth - node.depth };
  }, [node, dom]);

  const issues = useMemo(() => (node ? result.issues.filter((i) => i.nodeId === node.id) : []), [node, result.issues]);

  if (!node || !subtree) {
    return (
      <div className="p-4">
        <Empty>Select an element in the DOM tree or graph to inspect it.</Empty>
      </div>
    );
  }
  const parent = node.parent !== null ? dom.nodes[node.parent] : null;
  const attrs = Object.entries(node.attributes);

  return (
    <div className="flex h-full flex-col overflow-auto p-3 text-sm fade-in">
      <div className="mono break-all text-base text-white">&lt;{describeNode(node)}&gt;</div>
      <div className="mono mt-1 break-all text-[11px] leading-relaxed text-muted">{nodePath(dom, node.id)}</div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
        <Field k="Tag" v={node.tag} />
        <Field k="Depth" v={node.depth} />
        <Field k="ID" v={node.idAttr ?? <span className="text-muted">none</span>} />
        <Field k="Children" v={node.children.length} />
        <Field k="Descendants" v={node.descendantCount} />
        <Field k="Subtree depth" v={subtree.relDepth} />
        <Field k="Text (direct)" v={`${node.textLength} chars · ${node.textNodeCount} nodes`} />
        <Field k="Text (subtree)" v={`${subtree.text.toLocaleString()} chars`} />
        <Field k="Links" v={subtree.links} />
        <Field k="Images" v={subtree.images} />
        <Field k="Forms" v={`${subtree.forms} (${subtree.inputs} inputs)`} />
        <Field k="Source" v={node.sourceLine ? `line ${node.sourceLine}:${node.sourceColumn}` : <span className="text-muted">Unknown</span>} />
      </dl>

      <Section title={`Classes (${node.classes.length})`}>
        {node.classes.length ? <div className="flex flex-wrap gap-1">{node.classes.map((c) => <Badge key={c} className="mono">.{c}</Badge>)}</div> : <span className="text-xs text-muted">none</span>}
      </Section>

      <Section title={`Attributes (${attrs.length})`}>
        {attrs.length ? (
          <table className="mono w-full text-[11px]">
            <tbody>
              {attrs.map(([k, v]) => (
                <tr key={k} className="border-t border-line/60 align-top">
                  <td className="py-1 pr-2 text-yellow-200/90">{k}</td>
                  <td className="break-all py-1 text-fg/90">{v.length > 300 ? v.slice(0, 300) + "…" : v || <span className="text-muted">(empty)</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <span className="text-xs text-muted">none</span>}
      </Section>

      {node.textPreview && (
        <Section title="Text">
          <p className="rounded bg-bg p-2 text-xs text-fg/90">{node.textPreview}{node.textLength > node.textPreview.length ? "…" : ""}</p>
        </Section>
      )}

      <Section title="Parent">
        {parent ? <button type="button" onClick={() => onSelect(parent.id)} className="mono text-xs text-accent hover:underline">&lt;{describeNode(parent)}&gt;</button> : <span className="text-xs text-muted">root</span>}
      </Section>

      <Section title={`Children (${node.children.length})`}>
        <div className="max-h-48 space-y-0.5 overflow-auto">
          {node.children.slice(0, 200).map((c) => {
            const ch = dom.nodes[c];
            return ch ? (
              <button key={c} type="button" onClick={() => onSelect(c)} className="mono block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] text-fg/80 hover:bg-panel2 hover:text-accent">
                &lt;{describeNode(ch)}&gt; <span className="text-muted">{ch.descendantCount ? `${ch.descendantCount} desc` : ""}</span>
              </button>
            ) : null;
          })}
          {node.children.length > 200 && <div className="text-[11px] text-muted">…{node.children.length - 200} more</div>}
        </div>
      </Section>

      {issues.length > 0 && (
        <Section title={`Issues on this element (${issues.length})`}>
          {issues.map((i) => (
            <div key={i.id} className="mb-1 rounded border border-line bg-bg p-2 text-xs">
              <Badge tone={i.severity === "critical" ? "bad" : i.severity === "warning" ? "warn" : "info"}>{i.severity}</Badge> <span className="ml-1">{i.title}</span>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}

function Field({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted">{k}</dt>
      <dd className="mono text-xs text-fg">{v}</dd>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">{title}</div>
      {children}
    </div>
  );
}
