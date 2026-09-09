import type { ScriptAnalysis, ScriptEntry } from "@/types/analysis";
import type { ParsedDocument } from "@/lib/parser/dom-parser";
import { isInside } from "@/lib/parser/dom-parser";
import { hostnameOf, safeResolve, sameSite } from "@/lib/crawler/url-utils";

const NON_JS_TYPES = new Set(["application/ld+json", "application/json", "text/template", "text/x-template", "text/html", "importmap", "speculationrules", "text/plain"]);

export function analyzeScripts(doc: ParsedDocument, baseUrl: string): ScriptAnalysis {
  const { dom } = doc;
  const scripts: ScriptEntry[] = [];
  const baseHost = hostnameOf(baseUrl);
  const domains = new Map<string, number>();
  let external = 0, inline = 0, asyncCount = 0, defer = 0, moduleCount = 0, jsonLd = 0, blockingInHead = 0, inlineBytes = 0;

  for (const n of dom.nodes) {
    if (n.tag !== "script") continue;
    const a = n.attributes;
    const type = a.type?.trim().toLowerCase() || null;
    const src = a.src?.trim() || null;
    const resolved = src ? safeResolve(src, baseUrl) : null;
    const isModule = type === "module";
    const isAsync = a.async !== undefined;
    const isDefer = a.defer !== undefined;
    const content = doc.inlineContent.get(n.id) ?? "";
    const inHead = isInside(dom, n.id, "head");
    const isJsonLd = type === "application/ld+json";
    const entry: ScriptEntry = {
      src,
      resolved,
      inline: !src,
      async: isAsync,
      defer: isDefer,
      module: isModule,
      nomodule: a.nomodule !== undefined,
      type,
      inlineSize: src ? 0 : content.length,
      nodeId: n.id,
      sourceLine: n.sourceLine,
      inHead,
      external: resolved ? !sameSite(baseHost, hostnameOf(resolved)) : null,
      preview: src ? null : content.trim().slice(0, 160).replace(/\s+/g, " ") || null,
    };
    scripts.push(entry);
    if (isJsonLd) jsonLd++;
    if (src) {
      external++;
      const d = hostnameOf(resolved);
      if (d) domains.set(d, (domains.get(d) ?? 0) + 1);
      if (inHead && !isAsync && !isDefer && !isModule && (!type || !NON_JS_TYPES.has(type))) blockingInHead++;
    } else {
      inline++;
      inlineBytes += content.length;
    }
    if (isAsync) asyncCount++;
    if (isDefer) defer++;
    if (isModule) moduleCount++;
  }
  return {
    total: scripts.length,
    external,
    inline,
    async: asyncCount,
    defer,
    module: moduleCount,
    jsonLd,
    blockingInHead,
    inlineBytes,
    scripts,
    scriptDomains: [...domains.entries()].map(([domain, count]) => ({ domain, count })).sort((a, b) => b.count - a.count),
  };
}
