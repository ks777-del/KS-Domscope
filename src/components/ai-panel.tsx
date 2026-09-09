"use client";
import { useEffect, useState } from "react";
import type { AnalysisResult } from "@/types/analysis";
import type { AIProviderConfig, AIStatus } from "@/types/ai";
import { askAI, fetchAIStatus, loadAIConfig, renderMarkdown, saveAIConfig } from "@/lib/ai/client";
import { Badge, Card, Spinner } from "./ui";

const SUGGESTIONS = ["How is this page structured?", "What framework does it appear to use, and what is the evidence?", "Why is the DOM complex?", "Explain the navigation structure.", "What are the most important issues to fix first?", "Which third-party scripts are loaded and what are they for?"];

interface Turn { role: "user" | "assistant"; text: string; model?: string; error?: boolean }

export function AIPanel({ result, status, onStatusChange }: { result: AnalysisResult; status: AIStatus | null; onStatusChange: (s: AIStatus) => void }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [pageExplanation, setPageExplanation] = useState<{ text?: string; error?: string; loading: boolean } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [cfg, setCfg] = useState<Partial<AIProviderConfig>>({ provider: "openai", model: "", apiKey: "", baseUrl: "" });
  const [hasLocal, setHasLocal] = useState(false);

  useEffect(() => {
    const local = loadAIConfig();
    if (local) {
      setCfg({ provider: "openai", model: "", apiKey: "", baseUrl: "", ...local });
      setHasLocal(true);
    }
  }, []);

  const available = Boolean(status?.configured || hasLocal);
  const stored = Boolean(result.id);

  const ask = async (question: string) => {
    if (!question.trim() || !result.id || busy) return;
    setTurns((t) => [...t, { role: "user", text: question }]);
    setQ("");
    setBusy(true);
    try {
      const r = await askAI(result.id, "ask", { question });
      setTurns((t) => [...t, { role: "assistant", text: r.text, model: r.model }]);
    } catch (err) {
      setTurns((t) => [...t, { role: "assistant", text: (err as Error).message, error: true }]);
    } finally {
      setBusy(false);
    }
  };

  const explainPage = async () => {
    if (!result.id) return;
    setPageExplanation({ loading: true });
    try {
      const r = await askAI(result.id, "explain-page");
      setPageExplanation({ loading: false, text: r.text });
    } catch (err) {
      setPageExplanation({ loading: false, error: (err as Error).message });
    }
  };

  const saveSettings = () => {
    if (cfg.apiKey || cfg.provider === "custom") {
      saveAIConfig(cfg);
      setHasLocal(true);
    } else {
      saveAIConfig(null);
      setHasLocal(false);
    }
    setShowSettings(false);
    fetchAIStatus().then(onStatusChange).catch(() => undefined);
  };

  return (
    <div className="grid gap-4 fade-in lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <Card title="Ask this website" right={<span className="text-[10px] text-muted">answers are grounded in the DOMScope analysis only</span>}>
          {!available && (
            <div className="mb-3 rounded-lg border border-warn/30 bg-warn/5 p-3 text-xs text-warn">
              AI is unavailable: no provider is configured. Set <code className="mono">AI_PROVIDER</code>, <code className="mono">AI_MODEL</code> and <code className="mono">AI_API_KEY</code> on the server, or add provider settings for this session on the right. Everything else in DOMScope works without AI.
            </div>
          )}
          {available && !stored && <div className="mb-3 rounded-lg border border-warn/30 bg-warn/5 p-3 text-xs text-warn">This analysis could not be stored, so the AI cannot reference it. Re-run the analysis with the database available.</div>}
          <div className="mb-3 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" disabled={!available || !stored || busy} onClick={() => ask(s)} className="rounded-full border border-line bg-panel2 px-3 py-1 text-xs text-fg hover:border-accent/50 disabled:opacity-50">{s}</button>
            ))}
          </div>
          <div className="max-h-[50vh] space-y-3 overflow-auto">
            {turns.length === 0 && <p className="text-xs text-muted">Ask DOMScope about this website… The model receives a compact structured context (metadata, DOM outline, links, assets, scripts, findings, technologies) — never the raw HTML.</p>}
            {turns.map((t, i) => (
              <div key={i} className={`rounded-lg p-3 text-sm ${t.role === "user" ? "ml-8 bg-accent/10 text-white" : t.error ? "mr-8 border border-bad/40 bg-bad/5 text-bad" : "mr-8 border border-line bg-bg"}`}>
                {t.role === "assistant" && !t.error ? <div className="prose-ai text-[13px]" dangerouslySetInnerHTML={{ __html: renderMarkdown(t.text) }} /> : t.text}
                {t.model && <div className="mono mt-1 text-[10px] text-muted">{t.model}</div>}
              </div>
            ))}
            {busy && <div className="flex items-center gap-2 text-xs text-muted"><Spinner /> Thinking…</div>}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); ask(q); }} className="mt-3 flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} disabled={!available || !stored || busy} placeholder="Ask a free-form question about this page…" className="flex-1 rounded-md border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-50" />
            <button type="submit" disabled={!available || !stored || busy || !q.trim()} className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Ask</button>
          </form>
        </Card>
        <Card title="Page architecture" right={<button type="button" onClick={explainPage} disabled={!available || !stored || pageExplanation?.loading} className="rounded border border-line px-2 py-1 text-xs text-accent hover:border-accent/50 disabled:opacity-50">{pageExplanation?.loading ? <Spinner /> : "✦ Generate explanation"}</button>}>
          {!pageExplanation && <p className="text-xs text-muted">Optional AI-written summary of how the page is built, referencing the actual elements, patterns and technologies found by the analyzers.</p>}
          {pageExplanation?.error && <p className="text-xs text-bad">{pageExplanation.error}</p>}
          {pageExplanation?.text && <div className="prose-ai text-[13px]" dangerouslySetInnerHTML={{ __html: renderMarkdown(pageExplanation.text) }} />}
        </Card>
      </div>
      <div className="space-y-4">
        <Card title="Provider" right={<button type="button" onClick={() => setShowSettings((s) => !s)} className="text-xs text-accent">{showSettings ? "close" : "configure"}</button>}>
          <div className="flex items-center gap-2 text-xs">
            <Badge tone={available ? "ok" : "neutral"}>{available ? "available" : "not configured"}</Badge>
            {status?.provider && <span className="mono text-muted">server: {status.provider}{status.model ? ` / ${status.model}` : ""}</span>}
            {hasLocal && <span className="mono text-muted">session: {cfg.provider}{cfg.model ? ` / ${cfg.model}` : ""}</span>}
          </div>
          {showSettings && (
            <div className="mt-3 space-y-2 text-xs">
              <label className="block">Provider
                <select value={cfg.provider} onChange={(e) => setCfg({ ...cfg, provider: e.target.value as AIProviderConfig["provider"] })} className="mt-1 w-full rounded border border-line bg-bg px-2 py-1.5">
                  <option value="openai">OpenAI</option><option value="gemini">Google Gemini</option><option value="openrouter">OpenRouter</option><option value="custom">Custom (OpenAI-compatible)</option>
                </select>
              </label>
              <label className="block">Model <input value={cfg.model} onChange={(e) => setCfg({ ...cfg, model: e.target.value })} placeholder={cfg.provider === "gemini" ? "gemini-2.0-flash" : cfg.provider === "openrouter" ? "openai/gpt-4o-mini" : "gpt-4o-mini"} className="mono mt-1 w-full rounded border border-line bg-bg px-2 py-1.5" /></label>
              <label className="block">API key <input type="password" value={cfg.apiKey} onChange={(e) => setCfg({ ...cfg, apiKey: e.target.value })} placeholder="sk-…" className="mono mt-1 w-full rounded border border-line bg-bg px-2 py-1.5" /></label>
              <label className="block">Base URL <span className="text-muted">(custom / proxy)</span> <input value={cfg.baseUrl} onChange={(e) => setCfg({ ...cfg, baseUrl: e.target.value })} placeholder="https://host/v1" className="mono mt-1 w-full rounded border border-line bg-bg px-2 py-1.5" /></label>
              <p className="text-[11px] text-muted">Settings live in this browser session only and are sent to the DOMScope server per request; the key is never returned to the client or stored server-side.</p>
              <div className="flex gap-2">
                <button type="button" onClick={saveSettings} className="rounded bg-accent px-3 py-1.5 font-semibold text-white">Save</button>
                <button type="button" onClick={() => { saveAIConfig(null); setHasLocal(false); setCfg({ provider: "openai", model: "", apiKey: "", baseUrl: "" }); }} className="rounded border border-line px-3 py-1.5 text-muted">Clear</button>
              </div>
            </div>
          )}
        </Card>
        <Card title="What the model sees">
          <ul className="space-y-1 text-xs text-muted">
            <li>· Page metadata & fetch details</li><li>· Pruned DOM outline (body, 3 levels)</li><li>· Heading & navigation summary</li><li>· Link / asset / script / style statistics</li><li>· SEO checks, accessibility findings</li><li>· Technology evidence, complexity, patterns</li><li>· Issue list and scores</li>
          </ul>
          <p className="mt-2 text-[11px] text-muted">The prompt instructs the model to only use this context and to say when something is not available.</p>
        </Card>
      </div>
    </div>
  );
}
