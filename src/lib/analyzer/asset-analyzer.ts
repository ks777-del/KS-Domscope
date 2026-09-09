import type { AssetAnalysis, AssetEntry, AssetType } from "@/types/analysis";
import type { ParsedDocument } from "@/lib/parser/dom-parser";
import { hostnameOf, safeResolve, sameSite } from "@/lib/crawler/url-utils";

const FONT_RE = /\.(woff2?|ttf|otf|eot)(\?|#|$)/i;
const IMG_RE = /\.(png|jpe?g|gif|webp|avif|bmp|ico|tiff?)(\?|#|$)/i;
const SVG_RE = /\.svg(\?|#|$)/i;

export function analyzeAssets(doc: ParsedDocument, baseUrl: string): AssetAnalysis {
  const { dom } = doc;
  const assets: AssetEntry[] = [];
  const baseHost = hostnameOf(baseUrl);
  let imagesWithoutDimensions = 0;
  let lazyImages = 0;

  const push = (type: AssetType, url: string | null, sourceTag: string, nodeId: number, extra: Partial<AssetEntry> = {}) => {
    const resolved = url ? safeResolve(url, baseUrl) : null;
    const isData = url?.trim().toLowerCase().startsWith("data:") ?? false;
    const external = isData || !resolved ? null : !sameSite(baseHost, hostnameOf(resolved));
    assets.push({
      url: isData ? `${url!.slice(0, 40)}… (data URI)` : (resolved ?? url),
      type,
      sourceTag,
      nodeId,
      loading: null,
      inline: extra.inline ?? isData,
      detail: null,
      external,
      ...extra,
    });
  };

  for (const n of dom.nodes) {
    const a = n.attributes;
    switch (n.tag) {
      case "img": {
        const src = a.src ?? a["data-src"] ?? a["data-lazy-src"] ?? null;
        const srcset = a.srcset ?? a["data-srcset"];
        const type: AssetType = src && SVG_RE.test(src) ? "svg" : "image";
        if (!a.width || !a.height) imagesWithoutDimensions++;
        if ((a.loading ?? "").toLowerCase() === "lazy") lazyImages++;
        push(type, src ?? (srcset ? srcset.split(",")[0].trim().split(/\s+/)[0] : null), "img", n.id, {
          loading: a.loading ?? null,
          detail: [a.alt !== undefined ? `alt="${a.alt.slice(0, 60)}"` : "no alt", a.width && a.height ? `${a.width}×${a.height}` : null, srcset ? "srcset" : null, a.decoding ? `decoding=${a.decoding}` : null].filter(Boolean).join(" · "),
        });
        break;
      }
      case "svg":
        if (n.parent !== null && dom.nodes[n.parent]?.tag !== "svg") {
          push("svg", null, "svg", n.id, { inline: true, detail: `inline, ${n.descendantCount} child elements${a.role ? `, role=${a.role}` : ""}` });
        }
        break;
      case "link": {
        const rel = (a.rel ?? "").toLowerCase().split(/\s+/).filter(Boolean);
        if (!a.href) break;
        if (rel.includes("stylesheet")) push("stylesheet", a.href, "link", n.id, { detail: a.media ? `media=${a.media}` : null });
        else if (rel.includes("icon") || rel.includes("apple-touch-icon") || rel.includes("mask-icon")) push("favicon", a.href, "link", n.id, { detail: [rel.join(" "), a.sizes, a.type].filter(Boolean).join(" · ") });
        else if (rel.includes("preload") || rel.includes("modulepreload") || rel.includes("prefetch")) {
          const as = (a.as ?? "").toLowerCase();
          if (as === "font" || FONT_RE.test(a.href)) push("font", a.href, "link", n.id, { detail: `${rel.join(" ")}${a.crossorigin !== undefined ? " · crossorigin" : ""}` });
          else if (as === "image") push(SVG_RE.test(a.href) ? "svg" : "image", a.href, "link", n.id, { detail: rel.join(" ") });
          else if (as === "style") push("stylesheet", a.href, "link", n.id, { detail: rel.join(" ") });
          else if (as === "script" || rel.includes("modulepreload")) push("script", a.href, "link", n.id, { detail: rel.join(" ") });
          else push("preload", a.href, "link", n.id, { detail: `${rel.join(" ")}${as ? ` as=${as}` : ""}` });
        } else if (FONT_RE.test(a.href)) push("font", a.href, "link", n.id, { detail: rel.join(" ") });
        else if (/fonts\.googleapis\.com|use\.typekit\.net|fonts\.bunny\.net/i.test(a.href)) push("font", a.href, "link", n.id, { detail: `${rel.join(" ")} (font service)` });
        break;
      }
      case "script":
        if (a.src) push("script", a.src, "script", n.id, { loading: a.async !== undefined ? "async" : a.defer !== undefined ? "defer" : null, detail: a.type ?? null });
        break;
      case "video":
        push("video", a.src ?? a.poster ?? null, "video", n.id, { loading: a.preload ?? null, detail: [a.autoplay !== undefined ? "autoplay" : null, a.controls !== undefined ? "controls" : null, a.poster ? "poster" : null].filter(Boolean).join(" · ") || null });
        break;
      case "audio":
        push("audio", a.src ?? null, "audio", n.id, { loading: a.preload ?? null });
        break;
      case "source": {
        const parentTag = n.parent !== null ? dom.nodes[n.parent]?.tag : null;
        const src = a.src ?? (a.srcset ? a.srcset.split(",")[0].trim().split(/\s+/)[0] : null);
        if (!src) break;
        if (parentTag === "video") push("video", src, "source", n.id, { detail: a.type ?? null });
        else if (parentTag === "audio") push("audio", src, "source", n.id, { detail: a.type ?? null });
        else if (parentTag === "picture") push(SVG_RE.test(src) ? "svg" : "image", src, "source", n.id, { detail: [a.type, a.media].filter(Boolean).join(" · ") || null });
        break;
      }
      case "iframe":
        push("iframe", a.src ?? null, "iframe", n.id, { loading: a.loading ?? null, detail: a.title ? `title="${a.title.slice(0, 50)}"` : "no title" });
        break;
      case "object":
      case "embed":
        push("other", a.data ?? a.src ?? null, n.tag, n.id, { detail: a.type ?? null });
        break;
    }
    // CSS url() references in inline style attributes.
    if (a.style && /url\(/i.test(a.style)) {
      const m = a.style.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/i);
      if (m && !m[1].startsWith("data:")) push(IMG_RE.test(m[1]) || !SVG_RE.test(m[1]) ? "image" : "svg", m[1], `${n.tag}[style]`, n.id, { detail: "background url()" });
    }
  }

  // @font-face / url() references from <style> blocks.
  for (const [nodeId, css] of doc.inlineContent) {
    if (dom.nodes[nodeId]?.tag !== "style") continue;
    const re = /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
    let m: RegExpExecArray | null;
    let guard = 0;
    while ((m = re.exec(css)) && guard++ < 200) {
      const u = m[1];
      if (u.startsWith("data:")) continue;
      if (FONT_RE.test(u)) push("font", u, "style", nodeId, { detail: "@font-face / url() in style block" });
      else if (SVG_RE.test(u)) push("svg", u, "style", nodeId, { detail: "url() in style block" });
      else if (IMG_RE.test(u)) push("image", u, "style", nodeId, { detail: "url() in style block" });
    }
  }

  const counts: Record<AssetType, number> = { image: 0, svg: 0, font: 0, stylesheet: 0, script: 0, favicon: 0, video: 0, audio: 0, iframe: 0, preload: 0, other: 0 };
  const domains = new Map<string, number>();
  for (const a of assets) {
    counts[a.type]++;
    const d = a.url && !a.inline ? hostnameOf(a.url) : null;
    if (d) domains.set(d, (domains.get(d) ?? 0) + 1);
  }
  return {
    counts,
    total: assets.length,
    assets,
    imagesWithoutDimensions,
    lazyImages,
    assetDomains: [...domains.entries()].map(([domain, count]) => ({ domain, count })).sort((a, b) => b.count - a.count),
  };
}
