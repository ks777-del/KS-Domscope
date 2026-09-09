"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { AnalysisResult, AnalyzeEvent } from "@/types/analysis";
import { CrawlProgress, type StageState } from "./crawl-progress";
import { Workspace } from "./workspace";

export function AnalyzeClient({ url, id }: { url: string | null; id: string | null }) {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [stages, setStages] = useState<StageState>({});
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const ac = new AbortController();

    const loadStored = async () => {
      setStages({ fetch: { status: "running", detail: "loading stored snapshot" } });
      const res = await fetch(`/api/analyze?id=${encodeURIComponent(id!)}`, { signal: ac.signal });
      if (!res.ok) {
        setError({ message: res.status === 404 ? "This stored analysis was not found." : `Could not load analysis (HTTP ${res.status}).` });
        return;
      }
      setResult(await res.json());
    };

    const run = async () => {
      const res = await fetch("/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }), signal: ac.signal });
      if (!res.ok || !res.body) {
        let msg = `Request failed (HTTP ${res.status}).`;
        try {
          msg = (await res.json()).error ?? msg;
        } catch {
          /* ignore */
        }
        setError({ message: msg, code: String(res.status) });
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      const handle = (ev: AnalyzeEvent) => {
        if (ev.type === "stage") setStages((s) => ({ ...s, [ev.stage]: { status: ev.status === "done" ? "done" : "running", detail: ev.detail } }));
        else if (ev.type === "error") setError({ message: ev.message, code: ev.code });
        else if (ev.type === "result") {
          setResult(ev.result);
          if (ev.result.id) window.history.replaceState(null, "", `/analyze?id=${ev.result.id}`);
        }
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 1);
          if (line) handle(JSON.parse(line) as AnalyzeEvent);
        }
      }
      if (buf.trim()) handle(JSON.parse(buf) as AnalyzeEvent);
    };

    (id ? loadStored() : run()).catch((err) => {
      if ((err as Error).name !== "AbortError") setError({ message: (err as Error).message || "Unexpected error." });
    });
    return () => ac.abort();
  }, [url, id]);

  if (result) return <Workspace result={result} />;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 grid-bg">
      <CrawlProgress url={url ?? `stored analysis ${id}`} stages={stages} error={error} />
      {error && <Link href="/" className="rounded-lg border border-line bg-panel px-4 py-2 text-sm hover:border-accent/50">← Try another URL</Link>}
    </div>
  );
}
