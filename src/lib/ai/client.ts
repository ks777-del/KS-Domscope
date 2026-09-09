"use client";
import type { AIMode, AIProviderConfig, AIStatus } from "@/types/ai";

const KEY = "domscope.ai.config";

export function loadAIConfig(): Partial<AIProviderConfig> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Partial<AIProviderConfig>) : null;
  } catch {
    return null;
  }
}

export function saveAIConfig(cfg: Partial<AIProviderConfig> | null) {
  if (cfg) sessionStorage.setItem(KEY, JSON.stringify(cfg));
  else sessionStorage.removeItem(KEY);
}

export async function fetchAIStatus(): Promise<AIStatus> {
  const res = await fetch("/api/ai");
  return res.json();
}

export async function askAI(analysisId: string, mode: AIMode, extra: { question?: string; issueId?: string } = {}): Promise<{ text: string; model: string }> {
  const config = loadAIConfig() ?? undefined;
  const res = await fetch("/api/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ analysisId, mode, ...extra, config }) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `AI request failed (${res.status})`);
  return data;
}

/** Minimal markdown → HTML (headings, bold, code, lists, paragraphs). Escapes HTML first. */
export function renderMarkdown(md: string): string {
  const esc = md.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
  const blocks = esc.split(/```/);
  let html = "";
  blocks.forEach((b, i) => {
    if (i % 2 === 1) {
      html += `<pre><code>${b.replace(/^\w+\n/, "")}</code></pre>`;
      return;
    }
    const lines = b.split("\n");
    let inList: "ul" | "ol" | null = null;
    let para: string[] = [];
    const flush = () => {
      if (para.length) {
        html += `<p>${inline(para.join(" "))}</p>`;
        para = [];
      }
    };
    const closeList = () => {
      if (inList) {
        html += `</${inList}>`;
        inList = null;
      }
    };
    for (const line of lines) {
      const t = line.trim();
      if (!t) { flush(); closeList(); continue; }
      const h = t.match(/^(#{1,4})\s+(.*)/);
      if (h) { flush(); closeList(); html += `<p><strong>${inline(h[2])}</strong></p>`; continue; }
      const ul = t.match(/^[-*•]\s+(.*)/);
      const ol = t.match(/^\d+[.)]\s+(.*)/);
      if (ul || ol) {
        flush();
        const kind = ul ? "ul" : "ol";
        if (inList !== kind) { closeList(); html += `<${kind}>`; inList = kind; }
        html += `<li>${inline((ul ?? ol)![1])}</li>`;
        continue;
      }
      closeList();
      para.push(t);
    }
    flush();
    closeList();
  });
  return html;
}
function inline(s: string): string {
  return s.replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/(^|\s)\*([^*]+)\*(?=\s|$|[.,])/g, "$1<em>$2</em>");
}
