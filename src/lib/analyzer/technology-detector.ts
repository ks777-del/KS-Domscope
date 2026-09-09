import type { Confidence, TechnologyCategory, TechnologyDetection } from "@/types/technology";
import type { ParsedDocument } from "@/lib/parser/dom-parser";
import type { PageMetadata } from "@/types/page";

interface Ctx {
  html: string;
  htmlLower: string;
  headers: Record<string, string>;
  scriptSrcs: string[];
  stylesheetHrefs: string[];
  inlineScripts: string;
  inlineStyles: string;
  attrNames: Set<string>;
  classes: Map<string, number>;
  tags: Set<string>;
  meta: PageMetadata;
}

type Rule = {
  name: string;
  category: TechnologyCategory;
  website?: string;
  detect: (c: Ctx) => { evidence: string[]; confidence: Confidence; version?: string | null } | null;
};

const hasSrc = (c: Ctx, re: RegExp) => c.scriptSrcs.filter((s) => re.test(s));
const hasCss = (c: Ctx, re: RegExp) => c.stylesheetHrefs.filter((s) => re.test(s));
const header = (c: Ctx, name: string) => c.headers[name.toLowerCase()];
const classCount = (c: Ctx, re: RegExp) => {
  let n = 0;
  for (const [cls, count] of c.classes) if (re.test(cls)) n += count;
  return n;
};

const RULES: Rule[] = [
  {
    name: "Next.js",
    category: "Meta-framework",
    website: "https://nextjs.org",
    detect: (c) => {
      const ev: string[] = [];
      if (c.html.includes("__NEXT_DATA__")) ev.push("Found __NEXT_DATA__ script");
      const next = hasSrc(c, /\/_next\/static\//);
      if (next.length) ev.push(`${next.length} script(s) served from /_next/static/`);
      if (c.html.includes("__next_f") || c.html.includes('id="__next"')) ev.push("Found #__next root or __next_f flight data");
      if (c.meta.generator?.toLowerCase().includes("next.js")) ev.push(`Generator meta: ${c.meta.generator}`);
      if (header(c, "x-powered-by")?.toLowerCase().includes("next")) ev.push("X-Powered-By header mentions Next.js");
      return ev.length ? { evidence: ev, confidence: ev.length >= 2 ? "High" : "Medium" } : null;
    },
  },
  {
    name: "Nuxt",
    category: "Meta-framework",
    detect: (c) => {
      const ev: string[] = [];
      if (c.html.includes("__NUXT__") || c.html.includes("__nuxt")) ev.push("Found __NUXT__ payload / #__nuxt root");
      if (hasSrc(c, /\/_nuxt\//).length) ev.push("Scripts served from /_nuxt/");
      return ev.length ? { evidence: ev, confidence: ev.length >= 2 ? "High" : "Medium" } : null;
    },
  },
  {
    name: "Gatsby",
    category: "Meta-framework",
    detect: (c) => {
      const ev: string[] = [];
      if (c.html.includes('id="___gatsby"')) ev.push("Found #___gatsby root");
      if (c.meta.generator?.toLowerCase().includes("gatsby")) ev.push(`Generator meta: ${c.meta.generator}`);
      return ev.length ? { evidence: ev, confidence: "High" } : null;
    },
  },
  {
    name: "Remix",
    category: "Meta-framework",
    detect: (c) => (c.html.includes("__remixContext") ? { evidence: ["Found __remixContext"], confidence: "High" } : null),
  },
  {
    name: "Astro",
    category: "Meta-framework",
    detect: (c) => {
      const ev: string[] = [];
      if (c.tags.has("astro-island")) ev.push("Found <astro-island> elements");
      if (c.meta.generator?.toLowerCase().startsWith("astro")) ev.push(`Generator meta: ${c.meta.generator}`);
      if (hasSrc(c, /\/_astro\//).length || hasCss(c, /\/_astro\//).length) ev.push("Assets served from /_astro/");
      return ev.length ? { evidence: ev, confidence: "High" } : null;
    },
  },
  {
    name: "SvelteKit",
    category: "Meta-framework",
    detect: (c) => (c.html.includes("__sveltekit") || hasSrc(c, /\/_app\/immutable\//).length ? { evidence: ["Found __sveltekit bootstrap or /_app/immutable/ assets"], confidence: "High" } : null),
  },
  {
    name: "React",
    category: "JavaScript framework",
    website: "https://react.dev",
    detect: (c) => {
      const ev: string[] = [];
      if (c.attrNames.has("data-reactroot") || c.attrNames.has("data-reactid")) ev.push("data-reactroot / data-reactid attributes");
      const scripts = hasSrc(c, /react(-dom)?(\.production)?(\.min)?\.js|\/react@|react-dom/i);
      if (scripts.length) ev.push(`React script reference: ${scripts[0].slice(0, 80)}`);
      if (c.html.includes("__NEXT_DATA__") || c.html.includes("__next_f") || c.html.includes('id="___gatsby"') || c.html.includes("__remixContext")) ev.push("React-based meta-framework markers present");
      if (/<!--\$!?-->|<!--\/\$-->/.test(c.html)) ev.push("React 18 streaming SSR boundary comments (<!--$-->)");
      if (c.inlineScripts.includes("__REACT_DEVTOOLS_GLOBAL_HOOK__") || c.inlineScripts.includes("ReactDOM")) ev.push("Inline script references ReactDOM");
      return ev.length ? { evidence: ev, confidence: ev.length >= 2 ? "High" : "Medium" } : null;
    },
  },
  {
    name: "Vue.js",
    category: "JavaScript framework",
    detect: (c) => {
      const ev: string[] = [];
      let dataV = 0;
      for (const a of c.attrNames) if (/^data-v-[0-9a-f]{6,}$/.test(a)) dataV++;
      if (dataV) ev.push(`${dataV} scoped-style data-v-* attributes`);
      if (hasSrc(c, /vue(\.runtime)?(\.global)?(\.prod)?(\.min)?\.js|\/vue@/i).length) ev.push("Vue script reference");
      if (c.html.includes("__NUXT__") || c.html.includes("__nuxt")) ev.push("Nuxt (Vue meta-framework) markers present");
      if (c.attrNames.has("v-cloak") || c.attrNames.has("data-server-rendered")) ev.push("v-cloak / data-server-rendered attribute");
      return ev.length ? { evidence: ev, confidence: ev.length >= 2 ? "High" : "Medium" } : null;
    },
  },
  {
    name: "Angular",
    category: "JavaScript framework",
    detect: (c) => {
      const ev: string[] = [];
      const m = c.html.match(/ng-version="([^"]+)"/);
      if (m) ev.push(`ng-version="${m[1]}" attribute`);
      if (c.attrNames.has("ng-app") || c.attrNames.has("ng-controller")) ev.push("AngularJS ng-app / ng-controller directives");
      if ([...c.attrNames].some((a) => a.startsWith("_ngcontent") || a.startsWith("_nghost"))) ev.push("_ngcontent/_nghost attributes");
      return ev.length ? { evidence: ev, confidence: "High", version: m?.[1] ?? null } : null;
    },
  },
  {
    name: "Svelte",
    category: "JavaScript framework",
    detect: (c) => {
      const n = classCount(c, /^svelte-[a-z0-9]{4,}$/);
      const ev: string[] = [];
      if (n) ev.push(`${n} svelte-* scoped class usages`);
      if (c.html.includes("__sveltekit")) ev.push("SvelteKit markers present");
      return ev.length ? { evidence: ev, confidence: n > 3 || ev.length > 1 ? "High" : "Medium" } : null;
    },
  },
  {
    name: "Alpine.js",
    category: "JavaScript library",
    detect: (c) => {
      const ev: string[] = [];
      if (c.attrNames.has("x-data")) ev.push("x-data attributes");
      if (hasSrc(c, /alpine(js)?(\.min)?\.js|\/alpinejs/i).length) ev.push("Alpine script reference");
      return ev.length ? { evidence: ev, confidence: "High" } : null;
    },
  },
  {
    name: "htmx",
    category: "JavaScript library",
    detect: (c) => {
      const ev: string[] = [];
      if ([...c.attrNames].some((a) => /^hx-(get|post|put|delete|trigger|target|swap)$/.test(a))) ev.push("hx-* attributes");
      if (hasSrc(c, /htmx(\.org|\.min)?(\.js)?/i).length) ev.push("htmx script reference");
      return ev.length ? { evidence: ev, confidence: "High" } : null;
    },
  },
  {
    name: "jQuery",
    category: "JavaScript library",
    detect: (c) => {
      const s = hasSrc(c, /jquery([.-]\d[\d.]*)?(\.slim)?(\.min)?\.js/i);
      const ev: string[] = [];
      if (s.length) ev.push(`Script: ${s[0].slice(0, 90)}`);
      if (/jQuery\(|\$\(document\)\.ready/.test(c.inlineScripts)) ev.push("Inline script uses jQuery API");
      const v = s[0]?.match(/jquery[.-](\d+\.\d+(\.\d+)?)/i)?.[1] ?? null;
      return ev.length ? { evidence: ev, confidence: s.length ? "High" : "Medium", version: v } : null;
    },
  },
  {
    name: "WordPress",
    category: "CMS",
    detect: (c) => {
      const ev: string[] = [];
      const wp = (c.htmlLower.match(/\/wp-content\//g) ?? []).length;
      if (wp) ev.push(`${wp} references to /wp-content/`);
      if (c.htmlLower.includes("/wp-includes/")) ev.push("References to /wp-includes/");
      if (c.meta.generator?.toLowerCase().includes("wordpress")) ev.push(`Generator meta: ${c.meta.generator}`);
      if (c.htmlLower.includes("/wp-json/")) ev.push("REST API link /wp-json/");
      const v = c.meta.generator?.match(/wordpress\s*([\d.]+)/i)?.[1] ?? null;
      return ev.length ? { evidence: ev, confidence: ev.length >= 2 ? "High" : "Medium", version: v } : null;
    },
  },
  {
    name: "WooCommerce",
    category: "E-commerce",
    detect: (c) => (c.htmlLower.includes("woocommerce") && (classCount(c, /^woocommerce/) > 0 || c.htmlLower.includes("/plugins/woocommerce/")) ? { evidence: ["woocommerce classes or plugin assets"], confidence: "High" } : null),
  },
  {
    name: "Drupal",
    category: "CMS",
    detect: (c) => {
      const ev: string[] = [];
      if (c.meta.generator?.toLowerCase().includes("drupal")) ev.push(`Generator meta: ${c.meta.generator}`);
      if (c.inlineScripts.includes("drupalSettings") || c.inlineScripts.includes("Drupal.settings")) ev.push("drupalSettings inline script");
      if (c.htmlLower.includes("/sites/default/files/")) ev.push("Assets under /sites/default/files/");
      return ev.length ? { evidence: ev, confidence: ev.length >= 2 ? "High" : "Medium" } : null;
    },
  },
  {
    name: "Joomla",
    category: "CMS",
    detect: (c) => (c.meta.generator?.toLowerCase().includes("joomla") ? { evidence: [`Generator meta: ${c.meta.generator}`], confidence: "High" } : null),
  },
  {
    name: "Ghost",
    category: "CMS",
    detect: (c) => (c.meta.generator?.toLowerCase().includes("ghost") ? { evidence: [`Generator meta: ${c.meta.generator}`], confidence: "High" } : null),
  },
  {
    name: "Shopify",
    category: "E-commerce",
    detect: (c) => {
      const ev: string[] = [];
      if (c.htmlLower.includes("cdn.shopify.com")) ev.push("Assets from cdn.shopify.com");
      if (c.inlineScripts.includes("Shopify.theme") || c.inlineScripts.includes("Shopify.shop")) ev.push("Shopify inline configuration object");
      if (header(c, "x-shopify-stage") || header(c, "x-shopid")) ev.push("Shopify response headers");
      return ev.length ? { evidence: ev, confidence: "High" } : null;
    },
  },
  {
    name: "Wix",
    category: "Site builder",
    detect: (c) => {
      const ev: string[] = [];
      if (c.htmlLower.includes("static.wixstatic.com") || c.htmlLower.includes("static.parastorage.com")) ev.push("Assets from Wix static domains");
      if (c.meta.generator?.toLowerCase().includes("wix")) ev.push(`Generator meta: ${c.meta.generator}`);
      if (header(c, "x-wix-request-id")) ev.push("X-Wix-Request-Id header");
      return ev.length ? { evidence: ev, confidence: "High" } : null;
    },
  },
  {
    name: "Squarespace",
    category: "Site builder",
    detect: (c) => {
      const ev: string[] = [];
      if (c.htmlLower.includes("static1.squarespace.com") || c.htmlLower.includes("squarespace-cdn.com")) ev.push("Assets from Squarespace CDN");
      if (c.inlineScripts.includes("Static.SQUARESPACE_CONTEXT")) ev.push("SQUARESPACE_CONTEXT inline script");
      return ev.length ? { evidence: ev, confidence: "High" } : null;
    },
  },
  {
    name: "Webflow",
    category: "Site builder",
    detect: (c) => {
      const ev: string[] = [];
      if (c.attrNames.has("data-wf-page") || c.attrNames.has("data-wf-site")) ev.push("data-wf-page / data-wf-site attributes");
      if (c.meta.generator?.toLowerCase().includes("webflow")) ev.push(`Generator meta: ${c.meta.generator}`);
      if (c.htmlLower.includes("assets.website-files.com")) ev.push("Assets from assets.website-files.com");
      return ev.length ? { evidence: ev, confidence: "High" } : null;
    },
  },
  {
    name: "HubSpot CMS",
    category: "CMS",
    detect: (c) => (c.meta.generator?.toLowerCase().includes("hubspot") ? { evidence: [`Generator meta: ${c.meta.generator}`], confidence: "High" } : null),
  },
  {
    name: "Tailwind CSS",
    category: "CSS framework",
    website: "https://tailwindcss.com",
    detect: (c) => {
      const utilities = classCount(c, /^(sm|md|lg|xl|2xl|hover|focus|dark|group-hover):|^-?(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|w|h|gap|space-[xy]|text|bg|rounded|border|font|leading|tracking|shadow|z|inset|top|left|right|bottom|max-w|min-h|grid-cols|col-span|opacity|duration|ring|outline)-[a-z0-9[\]/.%-]+$|^(flex|grid|block|hidden|inline-flex|items-center|justify-between|justify-center|relative|absolute|fixed|sticky|truncate|antialiased|container|overflow-hidden|uppercase|sr-only)$/);
      const ev: string[] = [];
      if (hasCss(c, /tailwind/i).length) ev.push("Stylesheet path mentions tailwind");
      if (c.inlineStyles.includes("--tw-") || c.html.includes("--tw-")) ev.push("CSS custom properties prefixed --tw-");
      if (utilities >= 25) ev.push(`${utilities} Tailwind-style utility class usages`);
      if (!ev.length) return null;
      return { evidence: ev, confidence: ev.length >= 2 || utilities >= 80 ? "High" : "Medium" };
    },
  },
  {
    name: "Bootstrap",
    category: "CSS framework",
    detect: (c) => {
      const ev: string[] = [];
      const css = hasCss(c, /bootstrap(\.bundle)?(\.min)?\.css|bootstrapcdn/i);
      const js = hasSrc(c, /bootstrap(\.bundle)?(\.min)?\.js/i);
      if (css.length) ev.push(`Stylesheet: ${css[0].slice(0, 80)}`);
      if (js.length) ev.push(`Script: ${js[0].slice(0, 80)}`);
      const grid = classCount(c, /^col-(xs|sm|md|lg|xl|xxl)-\d+$/);
      const btn = classCount(c, /^btn-(primary|secondary|outline-[a-z]+|success|danger|light|dark)$/);
      if (grid + btn >= 4) ev.push(`${grid} grid col-* and ${btn} btn-* classes`);
      if (c.attrNames.has("data-bs-toggle") || c.attrNames.has("data-bs-target")) ev.push("data-bs-* attributes (Bootstrap 5)");
      const v = css[0]?.match(/bootstrap@?\/?(\d+\.\d+(\.\d+)?)/i)?.[1] ?? null;
      return ev.length ? { evidence: ev, confidence: css.length || js.length || ev.length >= 2 ? "High" : "Medium", version: v } : null;
    },
  },
  {
    name: "Bulma",
    category: "CSS framework",
    detect: (c) => (hasCss(c, /bulma(\.min)?\.css/i).length ? { evidence: ["bulma stylesheet"], confidence: "High" } : null),
  },
  {
    name: "Font Awesome",
    category: "Icons",
    detect: (c) => {
      const ev: string[] = [];
      if (hasCss(c, /font-?awesome|fontawesome/i).length || hasSrc(c, /kit\.fontawesome\.com|fontawesome/i).length) ev.push("Font Awesome stylesheet or kit script");
      const fa = classCount(c, /^fa[srlbd]?$|^fa-[a-z0-9-]+$/);
      if (fa >= 3) ev.push(`${fa} fa-* icon classes`);
      return ev.length ? { evidence: ev, confidence: ev.length >= 2 ? "High" : "Medium" } : null;
    },
  },
  {
    name: "Google Fonts",
    category: "Fonts",
    detect: (c) => (c.htmlLower.includes("fonts.googleapis.com") || c.htmlLower.includes("fonts.gstatic.com") ? { evidence: ["References to fonts.googleapis.com / fonts.gstatic.com"], confidence: "High" } : null),
  },
  {
    name: "Adobe Fonts (Typekit)",
    category: "Fonts",
    detect: (c) => (c.htmlLower.includes("use.typekit.net") ? { evidence: ["References to use.typekit.net"], confidence: "High" } : null),
  },
  {
    name: "Google Analytics",
    category: "Analytics",
    detect: (c) => {
      const ev: string[] = [];
      const gtag = hasSrc(c, /googletagmanager\.com\/gtag\/js/);
      if (gtag.length) ev.push(`gtag.js loaded: ${gtag[0].match(/id=([\w-]+)/)?.[1] ?? "id not visible"}`);
      if (hasSrc(c, /google-analytics\.com\/(analytics|ga)\.js/).length) ev.push("analytics.js / ga.js script");
      const ids = c.inlineScripts.match(/\b(G-[A-Z0-9]{6,}|UA-\d{4,}-\d+)\b/g);
      if (ids) ev.push(`Measurement ID in inline script: ${[...new Set(ids)].slice(0, 2).join(", ")}`);
      return ev.length ? { evidence: ev, confidence: "High" } : null;
    },
  },
  {
    name: "Google Tag Manager",
    category: "Tag manager",
    detect: (c) => {
      const ev: string[] = [];
      if (hasSrc(c, /googletagmanager\.com\/gtm\.js/).length || c.inlineScripts.includes("googletagmanager.com/gtm.js")) ev.push("gtm.js loader");
      const id = c.html.match(/GTM-[A-Z0-9]{4,}/)?.[0];
      if (id) ev.push(`Container ID ${id}`);
      return ev.length ? { evidence: ev, confidence: "High" } : null;
    },
  },
  { name: "Meta Pixel", category: "Marketing", detect: (c) => (c.inlineScripts.includes("connect.facebook.net") || c.inlineScripts.includes("fbq(") ? { evidence: ["fbq() / connect.facebook.net in inline script"], confidence: "High" } : null) },
  { name: "Hotjar", category: "Analytics", detect: (c) => (c.htmlLower.includes("static.hotjar.com") || c.inlineScripts.includes("hj(") && c.inlineScripts.includes("hotjar") ? { evidence: ["Hotjar loader"], confidence: "High" } : null) },
  { name: "Segment", category: "Analytics", detect: (c) => (c.htmlLower.includes("cdn.segment.com") ? { evidence: ["cdn.segment.com script"], confidence: "High" } : null) },
  { name: "Plausible", category: "Analytics", detect: (c) => (hasSrc(c, /plausible\.io\/js/).length ? { evidence: ["plausible.io script"], confidence: "High" } : null) },
  { name: "Matomo", category: "Analytics", detect: (c) => (c.inlineScripts.includes("_paq") || hasSrc(c, /matomo\.js|piwik\.js/).length ? { evidence: ["_paq / matomo.js"], confidence: "High" } : null) },
  { name: "Intercom", category: "Marketing", detect: (c) => (c.htmlLower.includes("widget.intercom.io") || c.inlineScripts.includes("intercomSettings") ? { evidence: ["Intercom widget / intercomSettings"], confidence: "High" } : null) },
  { name: "HubSpot", category: "Marketing", detect: (c) => (hasSrc(c, /js\.hs-scripts\.com|js\.hsforms\.net/).length ? { evidence: ["HubSpot tracking / forms script"], confidence: "High" } : null) },
  { name: "Stripe", category: "JavaScript library", detect: (c) => (hasSrc(c, /js\.stripe\.com/).length ? { evidence: ["js.stripe.com script"], confidence: "High" } : null) },
  { name: "reCAPTCHA", category: "JavaScript library", detect: (c) => (hasSrc(c, /google\.com\/recaptcha|recaptcha\.net/).length ? { evidence: ["reCAPTCHA API script"], confidence: "High" } : null) },
  { name: "GSAP", category: "JavaScript library", detect: (c) => (hasSrc(c, /gsap(\.min)?\.js|\/gsap@/i).length ? { evidence: ["gsap script"], confidence: "High" } : null) },
  { name: "Swiper", category: "JavaScript library", detect: (c) => (hasSrc(c, /swiper/i).length || classCount(c, /^swiper(-wrapper|-slide)?$/) >= 2 ? { evidence: ["swiper script or classes"], confidence: "Medium" } : null) },
  {
    name: "styled-components / Emotion",
    category: "Styling",
    detect: (c) => {
      const ev: string[] = [];
      if (c.attrNames.has("data-styled") || c.attrNames.has("data-styled-version")) ev.push("data-styled attributes (styled-components)");
      if (c.attrNames.has("data-emotion")) ev.push("data-emotion attributes (Emotion)");
      return ev.length ? { evidence: ev, confidence: "High" } : null;
    },
  },
  {
    name: "CSS Modules / hashed classes",
    category: "Styling",
    detect: (c) => {
      const n = classCount(c, /^[A-Za-z]+_[A-Za-z0-9]+__[A-Za-z0-9]{5,}$/);
      return n >= 5 ? { evidence: [`${n} classes shaped like Component_name__hash`], confidence: "Medium" } : null;
    },
  },
  {
    name: "Cloudflare",
    category: "CDN / Hosting",
    detect: (c) => {
      const ev: string[] = [];
      if (header(c, "server")?.toLowerCase() === "cloudflare") ev.push("server: cloudflare header");
      if (header(c, "cf-ray")) ev.push("cf-ray header");
      if (c.htmlLower.includes("/cdn-cgi/")) ev.push("/cdn-cgi/ script reference (e.g. email protection, RUM)");
      return ev.length ? { evidence: ev, confidence: "High" } : null;
    },
  },
  {
    name: "Vercel",
    category: "CDN / Hosting",
    detect: (c) => {
      const ev: string[] = [];
      if (header(c, "x-vercel-id")) ev.push("x-vercel-id header");
      if (header(c, "server")?.toLowerCase() === "vercel") ev.push("server: Vercel header");
      if (hasSrc(c, /\/_vercel\/insights|\/_vercel\/speed-insights/).length) ev.push("Vercel Analytics / Speed Insights script");
      return ev.length ? { evidence: ev, confidence: "High" } : null;
    },
  },
  {
    name: "Netlify",
    category: "CDN / Hosting",
    detect: (c) => {
      const ev: string[] = [];
      if (header(c, "x-nf-request-id")) ev.push("x-nf-request-id header");
      if (header(c, "server")?.toLowerCase() === "netlify") ev.push("server: Netlify header");
      return ev.length ? { evidence: ev, confidence: "High" } : null;
    },
  },
  { name: "Amazon CloudFront", category: "CDN / Hosting", detect: (c) => (header(c, "via")?.toLowerCase().includes("cloudfront") || header(c, "x-amz-cf-id") ? { evidence: ["CloudFront via / x-amz-cf-id header"], confidence: "High" } : null) },
  { name: "Fastly", category: "CDN / Hosting", detect: (c) => (header(c, "x-served-by")?.toLowerCase().includes("cache-") && header(c, "x-cache") ? { evidence: ["x-served-by cache-* header"], confidence: "Medium" } : null) },
  { name: "Akamai", category: "CDN / Hosting", detect: (c) => (header(c, "server")?.toLowerCase().includes("akamai") || header(c, "x-akamai-transformed") ? { evidence: ["Akamai headers"], confidence: "High" } : null) },
  { name: "GitHub Pages", category: "CDN / Hosting", detect: (c) => (header(c, "server")?.toLowerCase() === "github.com" ? { evidence: ["server: GitHub.com header"], confidence: "High" } : null) },
  {
    name: "Nginx",
    category: "Server",
    detect: (c) => {
      const s = header(c, "server");
      return s && /nginx/i.test(s) ? { evidence: [`server: ${s}`], confidence: "High", version: s.match(/nginx\/([\d.]+)/i)?.[1] ?? null } : null;
    },
  },
  {
    name: "Apache",
    category: "Server",
    detect: (c) => {
      const s = header(c, "server");
      return s && /apache/i.test(s) ? { evidence: [`server: ${s}`], confidence: "High", version: s.match(/apache\/([\d.]+)/i)?.[1] ?? null } : null;
    },
  },
  { name: "Microsoft IIS", category: "Server", detect: (c) => { const s = header(c, "server"); return s && /iis/i.test(s) ? { evidence: [`server: ${s}`], confidence: "High" } : null; } },
  { name: "LiteSpeed", category: "Server", detect: (c) => { const s = header(c, "server"); return s && /litespeed/i.test(s) ? { evidence: [`server: ${s}`], confidence: "High" } : null; } },
  { name: "Caddy", category: "Server", detect: (c) => { const s = header(c, "server"); return s && /caddy/i.test(s) ? { evidence: [`server: ${s}`], confidence: "High" } : null; } },
  { name: "Express", category: "Server", detect: (c) => (header(c, "x-powered-by")?.toLowerCase().includes("express") ? { evidence: ["X-Powered-By: Express"], confidence: "High" } : null) },
  { name: "PHP", category: "Language", detect: (c) => { const p = header(c, "x-powered-by"); return p && /php/i.test(p) ? { evidence: [`X-Powered-By: ${p}`], confidence: "High", version: p.match(/php\/([\d.]+)/i)?.[1] ?? null } : null; } },
  { name: "ASP.NET", category: "Language", detect: (c) => (header(c, "x-powered-by")?.toLowerCase().includes("asp.net") || header(c, "x-aspnet-version") ? { evidence: ["ASP.NET headers"], confidence: "High" } : null) },
];

export function detectTechnologies(doc: ParsedDocument, headers: Record<string, string>, meta: PageMetadata): TechnologyDetection[] {
  const { dom } = doc;
  const scriptSrcs: string[] = [];
  const stylesheetHrefs: string[] = [];
  let inlineScripts = "";
  let inlineStyles = "";
  const attrNames = new Set<string>();
  const classes = new Map<string, number>();
  const tags = new Set<string>();
  for (const n of dom.nodes) {
    tags.add(n.tag);
    for (const k of Object.keys(n.attributes)) attrNames.add(k);
    for (const c of n.classes) classes.set(c, (classes.get(c) ?? 0) + 1);
    if (n.tag === "script") {
      if (n.attributes.src) scriptSrcs.push(n.attributes.src);
      else inlineScripts += (doc.inlineContent.get(n.id) ?? "").slice(0, 20_000) + "\n";
    } else if (n.tag === "link" && n.attributes.href && /stylesheet|preload/.test(n.attributes.rel ?? "")) stylesheetHrefs.push(n.attributes.href);
    else if (n.tag === "style") inlineStyles += (doc.inlineContent.get(n.id) ?? "").slice(0, 20_000) + "\n";
  }
  const lowerHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) lowerHeaders[k.toLowerCase()] = v;
  const ctx: Ctx = { html: doc.html, htmlLower: doc.html.toLowerCase(), headers: lowerHeaders, scriptSrcs, stylesheetHrefs, inlineScripts, inlineStyles, attrNames, classes, tags, meta };

  const out: TechnologyDetection[] = [];
  for (const rule of RULES) {
    try {
      const r = rule.detect(ctx);
      if (r) out.push({ name: rule.name, category: rule.category, confidence: r.confidence, evidence: r.evidence, website: rule.website, version: r.version ?? null });
    } catch {
      /* a rule must never break analysis */
    }
  }
  const order: Confidence[] = ["High", "Medium", "Low"];
  return out.sort((a, b) => order.indexOf(a.confidence) - order.indexOf(b.confidence) || a.category.localeCompare(b.category));
}
