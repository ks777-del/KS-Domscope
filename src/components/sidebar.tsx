"use client";

export type TabId = "overview" | "dom" | "graph" | "assets" | "scripts" | "styles" | "links" | "seo" | "accessibility" | "technologies" | "issues" | "ai" | "compare";

export const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "▦" },
  { id: "dom", label: "DOM", icon: "⌥" },
  { id: "graph", label: "Graph", icon: "⌘" },
  { id: "links", label: "Links", icon: "⛓" },
  { id: "assets", label: "Assets", icon: "▣" },
  { id: "scripts", label: "Scripts", icon: "⟨⟩" },
  { id: "styles", label: "Styles", icon: "◐" },
  { id: "seo", label: "SEO", icon: "◎" },
  { id: "accessibility", label: "Accessibility", icon: "♿" },
  { id: "technologies", label: "Technologies", icon: "⚙" },
  { id: "issues", label: "Issues", icon: "⚠" },
  { id: "ai", label: "AI", icon: "✦" },
  { id: "compare", label: "Compare", icon: "⇄" },
];

export function Sidebar({ active, onChange, counts }: { active: TabId; onChange: (t: TabId) => void; counts: Partial<Record<TabId, number | string>> }) {
  return (
    <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-panel px-2 py-1.5 lg:w-48 lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r lg:py-3">
      {TABS.map((t) => (
        <button key={t.id} type="button" onClick={() => onChange(t.id)} className={`flex shrink-0 items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] transition ${active === t.id ? "bg-accent/15 text-white" : "text-muted hover:bg-panel2 hover:text-fg"}`}>
          <span className="w-4 text-center text-xs opacity-70">{t.icon}</span>
          <span className="flex-1">{t.label}</span>
          {counts[t.id] !== undefined && <span className="mono rounded bg-panel2 px-1.5 text-[10px] text-muted">{counts[t.id]}</span>}
        </button>
      ))}
    </nav>
  );
}
