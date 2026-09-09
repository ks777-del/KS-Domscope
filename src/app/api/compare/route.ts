import { NextRequest, NextResponse } from "next/server";
import { runAnalysis } from "@/lib/analyzer/pipeline";
import { compareSites } from "@/lib/comparison/site-comparator";
import { rateLimit } from "@/lib/crawler/security";
import { validateUrl } from "@/lib/crawler/url-utils";
import { getAnalysis, saveAnalysis } from "@/db/analyses";
import type { AnalysisResult } from "@/types/analysis";
import type { ComparisonWithAnalyses } from "@/types/comparison";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Side { url?: string; id?: string }

async function resolveSide(side: Side, label: string): Promise<{ ok: true; result: AnalysisResult } | { ok: false; message: string; status: number }> {
  if (side.id) {
    const r = await getAnalysis(side.id);
    if (!r) return { ok: false, message: `Stored analysis for site ${label} was not found.`, status: 404 };
    return { ok: true, result: r };
  }
  const v = validateUrl(side.url ?? "");
  if (!v.ok) return { ok: false, message: `Site ${label}: ${v.error}`, status: 400 };
  const out = await runAnalysis(v.normalized!);
  if (!out.ok) return { ok: false, message: `Site ${label} (${v.normalized}): ${out.message}`, status: 502 };
  let id: string | null = null;
  try {
    id = await saveAnalysis(out.result);
  } catch {
    /* db optional */
  }
  return { ok: true, result: { ...out.result, id } };
}

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const rl = rateLimit(`compare:${key}`, 8, 60_000);
  if (!rl.allowed) return NextResponse.json({ error: `Rate limit exceeded. Try again in ${rl.retryAfterSec}s.` }, { status: 429 });
  let body: { a?: Side; b?: Side } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.a || !body.b) return NextResponse.json({ error: "Both sites are required." }, { status: 400 });
  const [ra, rb] = await Promise.all([resolveSide(body.a, "A"), resolveSide(body.b, "B")]);
  if (!ra.ok) return NextResponse.json({ error: ra.message }, { status: ra.status });
  if (!rb.ok) return NextResponse.json({ error: rb.message }, { status: rb.status });
  const payload: ComparisonWithAnalyses = { comparison: compareSites(ra.result, rb.result), analysisA: ra.result, analysisB: rb.result };
  return NextResponse.json(payload);
}
