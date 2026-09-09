"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { AnalysisResult } from "@/types/analysis";
import type { AIStatus } from "@/types/ai";
import { Sidebar, type TabId } from "./sidebar";
import { SearchBar } from "./search-bar";
import { ExportMenu } from "./export-menu";
import { DomTree } from "./dom-tree";
import { ElementInspector } from "./element-inspector";
import { ArchitectureGraph } from "./architecture-graph";
import { StatsDashboard } from "./stats-dashboard";
import { LinksPanel } from "./links-panel";
import { AssetsPanel } from "./assets-panel";
import { ScriptsPanel } from "./scripts-panel";
import { StylesPanel } from "./styles-panel";
import { SeoPanel } from "./seo-panel";
import { AccessibilityPanel } from "./accessibility-panel";
import { TechnologyPanel } from "./technology-panel";
import { IssuesPanel } from "./issues-panel";
import { AIPanel } from "./ai-panel";
import { ComparePanel } from "./compare-panel";
import { UrlInput } from "./url-input";
import { fetchAIStatus, loadAIConfig } from "@/lib/ai/client";
import { scoreColor } from "./ui";

export function Workspace({ result }: { result: AnalysisResult }) {
  const [tab, setTab] = useState<TabId>("overview");
  const [selected, setSelected] = useState<number | null>(null);
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  const [showInput, setShowInput] = useState(false);

  useEffect(() => {
    fetchAIStatus().then(setAiStatus).catch(() => setAiStatus({ configured: false, provider: null, model: null }));
  }, []);

  const selectNode = useCallback((id: number) => {
    setSelected(id);
    setTab((t) => (t === "dom" || t === "graph" ? t : "dom"));
  }, []);
  const navigate = useCallback((t: TabId, nodeId: number | null) => {
    if (nodeId !== null) setSelected(nodeId);
    setTab(t);
  }, []);

  const counts = useMemo<Partial<Record<TabId, number | string>>>(() => ({
    dom: result.statistics.elements,
    links: result.links.total,
    assets: result.assets.total,
    scripts: result.scripts.total,
    styles: result.styles.externalStylesheets + result.styles.inlineStyleBlocks,
    seo: result.scores.seo,
    accessibility: result.accessibility.issues.length,
    technologies: result.technologies.length,
    issues: result.issues.length,
  }), [result]);

  const aiAvailable = Boolean(aiStatus?.configured) || Boolean(typeof window !== "undefined" && loadAIConfig());

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line bg-panel px-3 py-2">
        <Link href="/" className="flex items-center gap-2 font-semibold text-white"><span>🔬</span> DOMScope</Link>
        <button type="button" onClick={() => setShowInput((s) => !s)} className="mono max-w-[260px] truncate rounded-md border border-line bg-bg px-2.5 py-1 text-xs text-fg hover:border-accent/50" title={result.url}>{result.hostname}<span className="ml-1 text-muted">▾</span></button>
        <div className="min-w-0 flex-1"><SearchBar result={result} onNavigate={navigate} /></div>
        <Link href={`/compare${result.id ? `?a=${result.id}` : ""}`} className="rounded-md border border-line bg-panel2 px-2.5 py-1.5 text-xs hover:border-accent/50">⇄ Compare</Link>
        <ExportMenu result={result} />
      </header>
      {showInput && <div className="border-b border-line bg-panel px-3 py-2"><UrlInput compact initial={result.url} /></div>}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <Sidebar active={tab} onChange={setTab} counts={counts} />
        <main className="min-h-0 flex-1 overflow-hidden">
          {tab === "dom" && (
            <div className="grid h-full grid-cols-1 lg:grid-cols-[minmax(280px,30%)_1fr_minmax(280px,26%)]">
              <div className="min-h-[300px] border-b border-line lg:border-b-0 lg:border-r"><DomTree dom={result.dom} selectedId={selected} onSelect={setSelected} /></div>
              <div className="hidden min-h-0 lg:block"><ArchitectureGraph dom={result.dom} selectedId={selected} onSelect={setSelected} /></div>
              <div className="min-h-[300px] overflow-auto border-t border-line lg:border-l lg:border-t-0"><ElementInspector result={result} nodeId={selected} onSelect={setSelected} /></div>
            </div>
          )}
          {tab === "graph" && (
            <div className="grid h-full grid-cols-1 lg:grid-cols-[1fr_minmax(280px,26%)]">
              <div className="min-h-[400px]"><ArchitectureGraph dom={result.dom} selectedId={selected} onSelect={setSelected} large /></div>
              <div className="overflow-auto border-t border-line lg:border-l lg:border-t-0"><ElementInspector result={result} nodeId={selected} onSelect={setSelected} /></div>
            </div>
          )}
          {tab !== "dom" && tab !== "graph" && (
            <div className="h-full overflow-auto p-4">
              {tab === "overview" && <StatsDashboard result={result} onTab={setTab} onSelect={selectNode} />}
              {tab === "links" && <LinksPanel result={result} onSelect={selectNode} />}
              {tab === "assets" && <AssetsPanel result={result} onSelect={selectNode} />}
              {tab === "scripts" && <ScriptsPanel result={result} onSelect={selectNode} />}
              {tab === "styles" && <StylesPanel result={result} onSelect={selectNode} />}
              {tab === "seo" && <SeoPanel result={result} onSelect={selectNode} />}
              {tab === "accessibility" && <AccessibilityPanel result={result} onSelect={selectNode} />}
              {tab === "technologies" && <TechnologyPanel result={result} />}
              {tab === "issues" && <IssuesPanel result={result} onSelect={selectNode} aiAvailable={aiAvailable} />}
              {tab === "ai" && <AIPanel result={result} status={aiStatus} onStatusChange={setAiStatus} />}
              {tab === "compare" && <ComparePanel initialA={result.id ? { id: result.id } : { url: result.url }} embedded />}
            </div>
          )}
        </main>
      </div>

      <footer className="mono flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1 border-t border-line bg-panel px-4 py-1.5 text-[11px] text-muted">
        <span>Elements <b className="text-fg">{result.statistics.elements.toLocaleString()}</b></span>
        <span>Depth <b className="text-fg">{result.statistics.maxDepth}</b></span>
        <span>Links <b className="text-fg">{result.links.total}</b></span>
        <span>Scripts <b className="text-fg">{result.scripts.total}</b></span>
        <span>Images <b className="text-fg">{result.statistics.images}</b></span>
        <span>Issues <b className="text-fg">{result.issues.length}</b></span>
        <span>Score <b className={scoreColor(result.scores.overall)}>{result.scores.overall}</b></span>
        <span className="ml-auto">analyzed in {result.analysisDurationMs} ms · {new Date(result.analyzedAt).toLocaleTimeString()}{result.id ? "" : " · not stored"}</span>
      </footer>
    </div>
  );
}
