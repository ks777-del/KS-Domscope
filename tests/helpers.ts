import type { FetchedPage } from "@/types/page";
import { parseHtml } from "@/lib/parser/html-parser";
import { buildDomDocument } from "@/lib/parser/dom-parser";

export function makePage(html: string, url = "https://acme.test/", headers: Record<string, string> = {}): FetchedPage {
  return {
    requestedUrl: url,
    finalUrl: url,
    status: 200,
    statusText: "OK",
    headers,
    contentType: "text/html; charset=utf-8",
    html,
    size: Buffer.byteLength(html),
    redirects: [],
    fetchDurationMs: 1,
    fetchedAt: new Date().toISOString(),
    robots: { status: "unavailable", detail: "test" },
  };
}

export function parse(html: string) {
  return buildDomDocument(parseHtml(html));
}
