import type { LinkAnalysis, LinkEntry, LinkKind } from "@/types/analysis";
import type { DomDocument } from "@/types/dom";
import { deepText } from "@/lib/parser/dom-parser";
import { hostnameOf, safeResolve, sameSite } from "@/lib/crawler/url-utils";

export function classifyHref(href: string, baseUrl: string): { kind: LinkKind; resolved: string | null } {
  const trimmed = href.trim();
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("#") || trimmed === "") return { kind: "anchor", resolved: null };
  if (lower.startsWith("mailto:")) return { kind: "mailto", resolved: trimmed };
  if (lower.startsWith("tel:") || lower.startsWith("sms:")) return { kind: "tel", resolved: trimmed };
  if (lower.startsWith("javascript:")) return { kind: "javascript", resolved: null };
  const resolved = safeResolve(trimmed, baseUrl);
  if (!resolved) return { kind: "other", resolved: null };
  const proto = resolved.split(":")[0];
  if (proto !== "http" && proto !== "https") return { kind: "other", resolved };
  const baseHost = hostnameOf(baseUrl);
  const linkHost = hostnameOf(resolved);
  // Same-page fragment written as absolute URL
  const baseNoHash = baseUrl.split("#")[0];
  if (resolved.split("#")[0] === baseNoHash && resolved.includes("#")) return { kind: "anchor", resolved };
  return { kind: sameSite(baseHost, linkHost) ? "internal" : "external", resolved };
}

export function analyzeLinks(dom: DomDocument, baseUrl: string): LinkAnalysis {
  const links: LinkEntry[] = [];
  const counts: Record<LinkKind, number> = { internal: 0, external: 0, anchor: 0, mailto: 0, tel: 0, javascript: 0, other: 0 };
  const destinations = new Set<string>();
  const domainCounts = new Map<string, number>();
  let emptyHrefs = 0;
  for (const n of dom.nodes) {
    if (n.tag !== "a" && n.tag !== "area") continue;
    const href = n.attributes.href;
    if (href === undefined) continue;
    if (!href.trim()) emptyHrefs++;
    const { kind, resolved } = classifyHref(href, baseUrl);
    counts[kind]++;
    if (resolved) destinations.add(resolved);
    if (kind === "external") {
      const d = hostnameOf(resolved);
      if (d) domainCounts.set(d, (domainCounts.get(d) ?? 0) + 1);
    }
    const rel = n.attributes.rel ?? null;
    let text = deepText(dom, n.id, 120);
    if (!text) {
      const img = n.children.map((c) => dom.nodes[c]).find((c) => c && c.tag === "img" && c.attributes.alt);
      if (img) text = `[img alt: ${img.attributes.alt}]`;
      else if (n.attributes["aria-label"]) text = `[aria-label: ${n.attributes["aria-label"]}]`;
      else if (n.attributes.title) text = `[title: ${n.attributes.title}]`;
    }
    links.push({
      href,
      resolved,
      kind,
      text,
      nodeId: n.id,
      rel,
      target: n.attributes.target ?? null,
      nofollow: (rel ?? "").toLowerCase().split(/\s+/).includes("nofollow"),
    });
  }
  return {
    counts,
    total: links.length,
    uniqueDestinations: destinations.size,
    links,
    externalDomains: [...domainCounts.entries()].map(([domain, count]) => ({ domain, count })).sort((a, b) => b.count - a.count),
    emptyHrefs,
  };
}
