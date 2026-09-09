import type { PageMetadata } from "@/types/page";
import type { ParsedDocument } from "./dom-parser";
import { safeResolve } from "@/lib/crawler/url-utils";

export function extractMetadata(doc: ParsedDocument, baseUrl: string): PageMetadata {
  const { dom } = doc;
  const html = dom.nodes[dom.root];
  const meta: PageMetadata = {
    title: null,
    description: null,
    canonical: null,
    lang: html?.attributes.lang?.trim() || null,
    charset: null,
    viewport: null,
    robots: null,
    generator: null,
    themeColor: null,
    favicon: null,
    openGraph: {},
    twitter: {},
    jsonLdCount: 0,
    jsonLdTypes: [],
    hreflang: [],
    metaTags: [],
  };

  for (const n of dom.nodes) {
    if (n.tag === "title" && meta.title === null) {
      meta.title = n.textPreview || (n.textLength ? "(non-empty)" : "");
      continue;
    }
    if (n.tag === "meta") {
      const a = n.attributes;
      const name = (a.name ?? a.property ?? a["http-equiv"] ?? "").toLowerCase();
      const content = a.content ?? "";
      if (a.charset) meta.charset = a.charset;
      if (!name) continue;
      meta.metaTags.push({ name, content });
      if (name === "description" && meta.description === null) meta.description = content;
      else if (name === "viewport") meta.viewport = content;
      else if (name === "robots") meta.robots = content;
      else if (name === "generator") meta.generator = content;
      else if (name === "theme-color") meta.themeColor = content;
      else if (name.startsWith("og:")) meta.openGraph[name.slice(3)] = content;
      else if (name.startsWith("twitter:")) meta.twitter[name.slice(8)] = content;
      continue;
    }
    if (n.tag === "link") {
      const rel = (n.attributes.rel ?? "").toLowerCase().split(/\s+/);
      const href = n.attributes.href;
      if (!href) continue;
      if (rel.includes("canonical") && meta.canonical === null) meta.canonical = safeResolve(href, baseUrl) ?? href;
      if ((rel.includes("icon") || rel.includes("shortcut")) && meta.favicon === null) meta.favicon = safeResolve(href, baseUrl) ?? href;
      if (rel.includes("alternate") && n.attributes.hreflang) meta.hreflang.push({ lang: n.attributes.hreflang, href });
      continue;
    }
    if (n.tag === "script" && (n.attributes.type ?? "").toLowerCase() === "application/ld+json") {
      meta.jsonLdCount++;
      const raw = doc.inlineContent.get(n.id) ?? "";
      try {
        const parsed = JSON.parse(raw);
        collectTypes(parsed, meta.jsonLdTypes);
      } catch {
        meta.jsonLdTypes.push("(invalid JSON)");
      }
    }
  }
  if (meta.title !== null) meta.title = meta.title.trim();
  return meta;
}

function collectTypes(value: unknown, out: string[], depth = 0): void {
  if (depth > 4 || value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const v of value) collectTypes(v, out, depth + 1);
    return;
  }
  const obj = value as Record<string, unknown>;
  const t = obj["@type"];
  if (typeof t === "string" && !out.includes(t)) out.push(t);
  if (Array.isArray(t)) for (const x of t) if (typeof x === "string" && !out.includes(x)) out.push(x);
  if (Array.isArray(obj["@graph"])) collectTypes(obj["@graph"], out, depth + 1);
}
