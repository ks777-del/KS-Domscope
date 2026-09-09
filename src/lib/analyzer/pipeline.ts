import type { AnalysisResult, AnalyzeEvent } from "@/types/analysis";
import type { FetchedPage } from "@/types/page";
import { fetchPage } from "@/lib/crawler/fetch-page";
import { parseHtml } from "@/lib/parser/html-parser";
import { buildDomDocument } from "@/lib/parser/dom-parser";
import { extractMetadata } from "@/lib/parser/metadata-parser";
import { analyzeDom, detectRepeatedPatterns } from "./dom-analyzer";
import { analyzeLinks } from "./link-analyzer";
import { analyzeAssets } from "./asset-analyzer";
import { analyzeScripts } from "./script-analyzer";
import { analyzeStyles } from "./style-analyzer";
import { analyzeSeo } from "./seo-analyzer";
import { analyzeAccessibility } from "./accessibility-analyzer";
import { detectTechnologies } from "./technology-detector";
import { analyzeComplexity } from "./complexity-analyzer";
import { buildIssues } from "./issues";
import { computeScores } from "./scoring";

export type ProgressFn = (event: AnalyzeEvent) => void | Promise<void>;

const yieldToLoop = () => new Promise<void>((r) => setImmediate(r));

/** Analyze already-fetched HTML. Pure and deterministic; used by tests. */
export async function analyzeFetchedPage(page: FetchedPage, progress?: ProgressFn): Promise<AnalysisResult> {
  const started = Date.now();
  const emit = async (stage: string, status: "start" | "done", detail?: string) => {
    if (progress) await progress({ type: "stage", stage, status, detail });
    await yieldToLoop();
  };

  await emit("parse", "start");
  const parsed = parseHtml(page.html);
  const doc = buildDomDocument(parsed);
  await emit("parse", "done", `${doc.dom.totalElements.toLocaleString()} elements, depth ${doc.dom.maxDepth}`);

  await emit("metadata", "start");
  const metadata = extractMetadata(doc, page.finalUrl);
  const statistics = analyzeDom(doc, Buffer.byteLength(page.html, "utf8"));
  await emit("metadata", "done", metadata.title ? `"${metadata.title.slice(0, 50)}"` : "no title");

  await emit("links", "start");
  const links = analyzeLinks(doc.dom, page.finalUrl);
  await emit("links", "done", `${links.total} links`);

  await emit("assets", "start");
  const assets = analyzeAssets(doc, page.finalUrl);
  const scripts = analyzeScripts(doc, page.finalUrl);
  const styles = analyzeStyles(doc);
  await emit("assets", "done", `${assets.total} assets, ${scripts.total} scripts, ${styles.externalStylesheets} stylesheets`);

  await emit("seo", "start");
  const seo = analyzeSeo(doc.dom, metadata, page.finalUrl);
  await emit("seo", "done", `score ${seo.score}`);

  await emit("a11y", "start");
  const accessibility = analyzeAccessibility(doc.dom);
  await emit("a11y", "done", `${accessibility.issues.length} findings`);

  await emit("tech", "start");
  const technologies = detectTechnologies(doc, page.headers, metadata);
  await emit("tech", "done", technologies.length ? technologies.slice(0, 4).map((t) => t.name).join(", ") : "nothing detected");

  await emit("complexity", "start");
  const complexity = analyzeComplexity(doc.dom);
  const patterns = detectRepeatedPatterns(doc.dom);
  await emit("complexity", "done", `score ${complexity.score}`);

  await emit("issues", "start");
  const base = {
    url: page.finalUrl,
    hostname: new URL(page.finalUrl).hostname,
    fetch: {
      requestedUrl: page.requestedUrl,
      finalUrl: page.finalUrl,
      status: page.status,
      statusText: page.statusText,
      contentType: page.contentType,
      size: page.size,
      redirects: page.redirects,
      fetchDurationMs: page.fetchDurationMs,
      fetchedAt: page.fetchedAt,
      headers: pickHeaders(page.headers),
      robots: page.robots,
    },
    metadata,
    statistics,
    dom: doc.dom,
    links,
    assets,
    scripts,
    styles,
    seo,
    accessibility,
    technologies,
    complexity,
    patterns,
  };
  const issues = buildIssues(base);
  const scores = computeScores({ ...base, issues });
  await emit("issues", "done", `${issues.length} issues`);

  return { id: null, analyzedAt: new Date().toISOString(), analysisDurationMs: Date.now() - started, ...base, issues, scores };
}

/** Full pipeline: fetch + analyze. Emits progress events. */
export async function runAnalysis(url: string, progress?: ProgressFn): Promise<{ ok: true; result: AnalysisResult } | { ok: false; code: string; message: string; status?: number }> {
  if (progress) await progress({ type: "stage", stage: "fetch", status: "start" });
  const fetched = await fetchPage(url);
  if (!fetched.ok) return { ok: false, code: fetched.code, message: fetched.message, status: fetched.status };
  if (progress) await progress({ type: "stage", stage: "fetch", status: "done", detail: `HTTP ${fetched.page.status}, ${(fetched.page.size / 1024).toFixed(1)} KB${fetched.page.redirects.length ? `, ${fetched.page.redirects.length} redirect(s)` : ""}` });
  const result = await analyzeFetchedPage(fetched.page, progress);
  return { ok: true, result };
}

const HEADER_ALLOWLIST = ["content-type", "server", "x-powered-by", "cache-control", "content-encoding", "content-language", "last-modified", "etag", "vary", "strict-transport-security", "content-security-policy", "x-frame-options", "x-content-type-options", "referrer-policy", "permissions-policy", "cf-ray", "x-vercel-id", "x-vercel-cache", "x-nf-request-id", "via", "x-cache", "x-served-by", "age", "x-amz-cf-id", "x-amz-cf-pop", "x-shopify-stage", "x-wix-request-id", "x-aspnet-version", "x-akamai-transformed", "link", "x-robots-tag", "date", "x-generator", "x-drupal-cache"];
function pickHeaders(h: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(h)) if (HEADER_ALLOWLIST.includes(k.toLowerCase())) out[k.toLowerCase()] = h[k].slice(0, 500);
  return out;
}
