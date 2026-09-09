import Link from "next/link";
import { ComparePanel } from "@/components/compare-panel";

export const dynamic = "force-dynamic";

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ a?: string; b?: string; urlA?: string; urlB?: string }> }) {
  const sp = await searchParams;
  const isId = (v?: string) => Boolean(v && /^[0-9a-f-]{36}$/i.test(v));
  return (
    <main className="min-h-screen grid-bg">
      <header className="flex items-center gap-3 border-b border-line bg-panel px-4 py-2">
        <Link href="/" className="flex items-center gap-2 font-semibold text-white"><span>🔬</span> DOMScope</Link>
        <span className="text-sm text-muted">/ Compare websites</span>
      </header>
      <div className="p-6">
        <ComparePanel initialA={isId(sp.a) ? { id: sp.a } : { url: sp.urlA ?? "" }} initialB={isId(sp.b) ? { id: sp.b } : { url: sp.urlB ?? "" }} />
      </div>
    </main>
  );
}
