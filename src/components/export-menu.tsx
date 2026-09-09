"use client";
import { useState } from "react";
import type { AnalysisResult } from "@/types/analysis";
import { buildJsonExport, exportFilename } from "@/lib/export/json-export";
import { buildHtmlReport } from "@/lib/export/html-export";

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ExportMenu({ result }: { result: AnalysisResult }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="rounded-md border border-line bg-panel2 px-2.5 py-1.5 text-xs text-fg hover:border-accent/50">
        Export ▾
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-56 rounded-lg border border-line bg-panel p-1 shadow-xl" onMouseLeave={() => setOpen(false)}>
          <button type="button" className="block w-full rounded px-3 py-2 text-left text-xs hover:bg-panel2" onClick={() => { download(exportFilename(result, "json"), buildJsonExport(result, true), "application/json"); setOpen(false); }}>
            JSON snapshot <span className="text-muted">(full DOM)</span>
          </button>
          <button type="button" className="block w-full rounded px-3 py-2 text-left text-xs hover:bg-panel2" onClick={() => { download(exportFilename(result, "json"), buildJsonExport(result, false), "application/json"); setOpen(false); }}>
            JSON summary <span className="text-muted">(no DOM nodes)</span>
          </button>
          <button type="button" className="block w-full rounded px-3 py-2 text-left text-xs hover:bg-panel2" onClick={() => { download(exportFilename(result, "html"), buildHtmlReport(result), "text/html"); setOpen(false); }}>
            HTML report
          </button>
          {result.id && (
            <button type="button" className="block w-full rounded px-3 py-2 text-left text-xs hover:bg-panel2" onClick={() => { navigator.clipboard?.writeText(`${location.origin}/analyze?id=${result.id}`); setOpen(false); }}>
              Copy share link
            </button>
          )}
        </div>
      )}
    </div>
  );
}
