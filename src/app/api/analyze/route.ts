import { NextRequest, NextResponse } from "next/server";
import { runAnalysis } from "@/lib/analyzer/pipeline";
import { rateLimit } from "@/lib/crawler/security";
import { validateUrl } from "@/lib/crawler/url-utils";
import { getAnalysis, saveAnalysis } from "@/db/analyses";
import type { AnalyzeEvent } from "@/types/analysis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function clientKey(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

/** GET /api/analyze?id=... → stored analysis */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const result = await getAnalysis(id);
  if (!result) return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
  return NextResponse.json(result);
}

/** POST /api/analyze {url} → NDJSON stream of progress events ending with the result */
export async function POST(req: NextRequest) {
  const rl = rateLimit(`analyze:${clientKey(req)}`, 15, 60_000);
  if (!rl.allowed) return NextResponse.json({ error: `Rate limit exceeded. Try again in ${rl.retryAfterSec}s.` }, { status: 429, headers: { "retry-after": String(rl.retryAfterSec) } });

  let body: { url?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const v = validateUrl(body.url ?? "");
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: AnalyzeEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        const out = await runAnalysis(v.normalized!, send);
        if (!out.ok) {
          send({ type: "error", code: out.code, message: out.message, status: out.status });
        } else {
          send({ type: "stage", stage: "save", status: "start" });
          let id: string | null = null;
          try {
            id = await saveAnalysis(out.result);
          } catch (err) {
            console.error("saveAnalysis failed", err);
          }
          send({ type: "stage", stage: "save", status: "done", detail: id ? "snapshot stored" : "not stored (database unavailable)" });
          send({ type: "result", result: { ...out.result, id } });
        }
      } catch (err) {
        console.error("analyze failed", err);
        send({ type: "error", code: "INTERNAL", message: (err as Error).message || "Unexpected analysis failure." });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" } });
}
