import { NextRequest, NextResponse } from "next/server";
import { getStatus, resolveConfig, AIProviderError, isProviderId } from "@/lib/ai/provider";
import { askWebsite, explainIssue, explainPage } from "@/lib/ai/analyzer";
import { getAnalysis } from "@/db/analyses";
import { rateLimit } from "@/lib/crawler/security";
import type { AIRequest } from "@/types/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/ai → provider status (never returns the key). */
export async function GET() {
  return NextResponse.json(getStatus());
}

/** POST /api/ai → grounded answer about a stored analysis. */
export async function POST(req: NextRequest) {
  const key = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const rl = rateLimit(`ai:${key}`, 20, 60_000);
  if (!rl.allowed) return NextResponse.json({ error: `Rate limit exceeded. Try again in ${rl.retryAfterSec}s.` }, { status: 429 });

  let body: AIRequest;
  try {
    body = (await req.json()) as AIRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.analysisId) return NextResponse.json({ error: "analysisId is required. Only stored analyses can be queried." }, { status: 400 });

  const override = body.config
    ? {
        provider: isProviderId(body.config.provider) ? body.config.provider : undefined,
        model: typeof body.config.model === "string" ? body.config.model.slice(0, 120) : undefined,
        apiKey: typeof body.config.apiKey === "string" ? body.config.apiKey.slice(0, 400) : undefined,
        baseUrl: typeof body.config.baseUrl === "string" && /^https?:\/\//.test(body.config.baseUrl) ? body.config.baseUrl.slice(0, 300) : undefined,
      }
    : undefined;
  const config = resolveConfig(override);
  if (!config) return NextResponse.json({ error: "AI is not configured. Set AI_PROVIDER, AI_MODEL and AI_API_KEY on the server, or supply provider settings in the AI panel." }, { status: 503 });

  const result = await getAnalysis(body.analysisId);
  if (!result) return NextResponse.json({ error: "Analysis not found." }, { status: 404 });

  try {
    const out =
      body.mode === "explain-page" ? await explainPage(result, config)
      : body.mode === "explain-issue" ? await explainIssue(result, body.issueId ?? "", config)
      : await askWebsite(result, body.question ?? "", config);
    return NextResponse.json({ text: out.text, model: out.model, provider: out.provider });
  } catch (err) {
    if (err instanceof AIProviderError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("ai failed", err);
    return NextResponse.json({ error: "AI request failed." }, { status: 500 });
  }
}
