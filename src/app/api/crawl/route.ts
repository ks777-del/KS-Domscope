import { NextRequest, NextResponse } from "next/server";
import { fetchPage } from "@/lib/crawler/fetch-page";
import { rateLimit } from "@/lib/crawler/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/crawl {url} → raw fetch diagnostics (no analysis). */
export async function POST(req: NextRequest) {
  const key = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const rl = rateLimit(`crawl:${key}`, 20, 60_000);
  if (!rl.allowed) return NextResponse.json({ error: `Rate limit exceeded. Try again in ${rl.retryAfterSec}s.` }, { status: 429 });
  let body: { url?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const res = await fetchPage(body.url ?? "");
  if (!res.ok) return NextResponse.json({ ok: false, code: res.code, message: res.message, status: res.status ?? null }, { status: res.code === "INVALID_URL" || res.code === "BLOCKED" ? 400 : 502 });
  const { html, ...rest } = res.page;
  return NextResponse.json({ ok: true, page: { ...rest, htmlPreview: html.slice(0, 2000), htmlLength: html.length } });
}
