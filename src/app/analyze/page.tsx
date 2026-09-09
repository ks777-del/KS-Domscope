import Link from "next/link";
import { redirect } from "next/navigation";
import { AnalyzeClient } from "@/components/analyze-client";
import { validateUrl } from "@/lib/crawler/url-utils";

export const dynamic = "force-dynamic";

export default async function AnalyzePage({ searchParams }: { searchParams: Promise<{ url?: string; id?: string }> }) {
  const sp = await searchParams;
  if (sp.id && /^[0-9a-f-]{36}$/i.test(sp.id)) return <AnalyzeClient url={null} id={sp.id} />;
  if (!sp.url) redirect("/");
  const v = validateUrl(sp.url);
  if (!v.ok) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="panel max-w-md p-6 text-center">
          <div className="text-lg font-semibold text-bad">Invalid URL</div>
          <p className="mt-2 text-sm text-muted">{v.error}</p>
          <Link href="/" className="mt-4 inline-block text-sm text-accent hover:underline">← Back</Link>
        </div>
      </div>
    );
  }
  return <AnalyzeClient url={v.normalized!} id={null} />;
}
