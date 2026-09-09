"use client";
import type { ReactNode } from "react";

export function Card({ title, children, className = "", right }: { title?: ReactNode; children: ReactNode; className?: string; right?: ReactNode }) {
  return (
    <section className={`panel p-4 ${className}`}>
      {title && (
        <header className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{title}</h3>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, onClick }: { label: string; value: ReactNode; sub?: ReactNode; onClick?: () => void }) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp onClick={onClick} className={`panel flex flex-col gap-1 p-3 text-left ${onClick ? "transition hover:border-accent/50" : ""}`}>
      <span className="text-[11px] uppercase tracking-wider text-muted">{label}</span>
      <span className="mono text-xl font-semibold text-white">{value}</span>
      {sub && <span className="text-[11px] text-muted">{sub}</span>}
    </Comp>
  );
}

export function scoreColor(v: number): string {
  return v >= 80 ? "text-ok" : v >= 55 ? "text-warn" : "text-bad";
}
export function scoreStroke(v: number): string {
  return v >= 80 ? "#34d399" : v >= 55 ? "#fbbf24" : "#f87171";
}

export function ScoreRing({ value, label, size = 72, onClick }: { value: number; label: string; size?: number; onClick?: () => void }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-1.5" title={`${label}: ${value}/100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#1e2837" strokeWidth={6} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={scoreStroke(value)} strokeWidth={6} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * value) / 100} style={{ transition: "stroke-dashoffset .6s ease" }} />
        <text x="50%" y="50%" transform={`rotate(90 ${size / 2} ${size / 2})`} dominantBaseline="central" textAnchor="middle" className="mono" fill="#fff" fontSize={size / 4} fontWeight={600}>
          {value}
        </text>
      </svg>
      <span className="text-[11px] uppercase tracking-wider text-muted">{label}</span>
    </button>
  );
}

export function Badge({ children, tone = "neutral", className = "" }: { children: ReactNode; tone?: "neutral" | "ok" | "warn" | "bad" | "info" | "accent"; className?: string }) {
  const tones: Record<string, string> = {
    neutral: "bg-panel2 text-muted border-line",
    ok: "bg-ok/10 text-ok border-ok/30",
    warn: "bg-warn/10 text-warn border-warn/30",
    bad: "bg-bad/10 text-bad border-bad/30",
    info: "bg-info/10 text-info border-info/30",
    accent: "bg-accent/10 text-accent border-accent/30",
  };
  return <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${tones[tone]} ${className}`}>{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-muted">{children}</div>;
}

export function NodeLink({ nodeId, label, onSelect }: { nodeId: number | null; label: ReactNode; onSelect?: (id: number) => void }) {
  if (nodeId === null || !onSelect) return <span className="mono text-xs text-muted">{label}</span>;
  return (
    <button type="button" onClick={() => onSelect(nodeId)} className="mono text-xs text-accent hover:underline" title="Inspect element">
      {label}
    </button>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? "Filter…"} className="w-full rounded-md border border-line bg-bg px-3 py-1.5 text-sm outline-none placeholder:text-muted/70 focus:border-accent" />
  );
}

export function Toggle({ options, value, onChange }: { options: { value: string; label: string; count?: number }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} className={`rounded-md border px-2 py-1 text-xs transition ${value === o.value ? "border-accent bg-accent/15 text-white" : "border-line bg-panel2 text-muted hover:text-fg"}`}>
          {o.label}
          {o.count !== undefined && <span className="mono ml-1 opacity-70">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export function Spinner({ className = "" }: { className?: string }) {
  return <span className={`spin inline-block h-3.5 w-3.5 rounded-full border-2 border-accent border-t-transparent ${className}`} />;
}
