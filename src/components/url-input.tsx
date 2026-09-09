"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { validateUrl } from "@/lib/crawler/url-utils";

export function UrlInput({ compact = false, initial = "" }: { compact?: boolean; initial?: string }) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = validateUrl(value);
    if (!v.ok) {
      setError(v.error ?? "Invalid URL");
      return;
    }
    setError(null);
    setBusy(true);
    router.push(`/analyze?url=${encodeURIComponent(v.normalized!)}`);
  };

  return (
    <form onSubmit={submit} className={`w-full ${compact ? "" : "max-w-2xl"}`}>
      <div className={`flex items-stretch gap-2 rounded-xl border bg-panel p-1.5 ${error ? "border-bad/60" : "border-line focus-within:border-accent focus-within:glow"}`}>
        <span className="mono hidden items-center pl-3 text-xs text-muted sm:flex">URL</span>
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          placeholder="https://example.com"
          autoFocus={!compact}
          spellCheck={false}
          autoCapitalize="off"
          className="mono min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted/60"
          aria-label="Website URL"
        />
        <button type="submit" disabled={busy} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:opacity-60">
          {busy ? "Starting…" : compact ? "Analyze" : "Analyze Website"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-bad">{error}</p>}
      {!compact && <p className="mt-2 text-xs text-muted">Public http/https URLs only. DOMScope fetches the page once, server-side, and never executes its scripts.</p>}
    </form>
  );
}
