# 🔬 DOMScope — Inspect the anatomy of any website

DOMScope fetches a public web page **server-side**, parses its real HTML into a DOM representation and runs a set of analyzers over it: statistics, links, assets, scripts, styles, metadata, SEO, static accessibility signals, technology detection, complexity and repeated-structure detection. Results are shown in a developer-tool UI with an interactive DOM tree, a visual DOM graph, an element inspector, an issue center, global search, export, comparison and an optional grounded AI layer.

Everything is TypeScript / Next.js (App Router) / React / Node.js. No Python. No mock data — if something cannot be determined it is shown as *Not detected / Unknown / Unavailable*.

## Running

```bash
npm install
cp .env.example .env        # set DATABASE_URL (and optional AI_* vars)
npx drizzle-kit push        # creates the `analyses` table
npm run dev
npm test                    # vitest unit tests on controlled HTML fixtures
```

## Architecture

```
URL input → /api/analyze (NDJSON progress stream)
  → lib/crawler   fetch-page.ts (secure fetch)  url-utils.ts  security.ts (SSRF)  robots.ts
  → lib/parser    html-parser.ts → dom-parser.ts (flat DomDocument) → metadata-parser.ts
  → lib/analyzer  dom · link · asset · script · style · seo · accessibility · technology · complexity
                  issues.ts (unified issue center) · scoring.ts · pipeline.ts (orchestrator)
  → stored in PostgreSQL (Drizzle, `analyses` table) → shareable /analyze?id=…
  → UI: components/* (workspace, dom-tree, architecture-graph, element-inspector, panels)
  → lib/ai        provider.ts · providers.ts (OpenAI-compatible + Gemini) · context-builder.ts · analyzer.ts
  → lib/comparison/site-comparator.ts · lib/export/{json,html}-export.ts
```

The project uses the `src/` layout: `src/app`, `src/components`, `src/lib`, `src/types`, `src/db`; tests live in `tests/`.

### API

| Route | Purpose |
|---|---|
| `POST /api/analyze {url}` | Full pipeline; streams `{"type":"stage"…}` progress lines and ends with `{"type":"result"…}` or `{"type":"error"…}` |
| `GET /api/analyze?id=` | Load a stored analysis |
| `POST /api/crawl {url}` | Raw fetch diagnostics only (status, headers, redirects, HTML preview) |
| `POST /api/compare {a:{url|id}, b:{url|id}}` | Analyze/load two sites and compare |
| `GET /api/ai` / `POST /api/ai` | Provider status / grounded Q&A, page explanation, issue explanation |
| `GET /api/analyses` | Recent stored analyses |

## Security

* Only `http:`/`https:`; credentials in URLs rejected; hostnames validated.
* DNS is resolved before every request **and every redirect hop**; loopback, RFC1918, link-local (incl. `169.254.169.254`), CGNAT, multicast, IPv6 ULA/link-local, IPv4-mapped addresses and `.local/.internal/localhost` names are refused.
* 15 s timeout, 5 redirect max, 3 MB body cap (streamed and aborted), HTML content types only.
* Page scripts are never executed; nothing downloaded is evaluated; forms are never submitted; no auth/anti-bot bypass.
* In-memory per-IP rate limiting on all fetching endpoints.
* AI keys stay server-side (env vars, or a per-session override that is sent to *our* server only and never echoed back).

## Scoring model (all rule-based, all shown in the UI)

* **SEO** — weighted checks (title 15, description 12, H1 12, canonical 8, Open Graph 8, robots 6, lang 6, viewport 5, twitter 5, title length 5, single H1 4, description length 4, H2 4, favicon 3, structured data 3). `warn` = half credit. Score = earned / total × 100.
* **Accessibility** — 100 minus penalties: images without alt (≤25, proportional), unlabelled inputs (≤20), unnamed buttons (≤15), empty/generic links (≤10), missing `lang` (10), heading order problems (5 each, ≤10), positive tabindex (3 each, ≤6), untitled iframes (2 each, ≤6). *Static heuristics only — not a full audit.*
* **Structure** — 100 minus structural issues (critical 15 / warning 8 / suggestion 3) minus 4 per missing semantic landmark below four of `header nav main footer section article aside`.
* **Metadata** — share of 10 signals present (title, description, canonical, ≥3 OG tags, twitter:card, favicon, viewport, charset, lang, JSON-LD).
* **Complexity** (DOM complexity, 0 = simple) — element count (≤35, linear to 3 000), max depth (≤25, depth 8→32), deep leaves beyond depth 15 (≤15), class diversity (≤10), average children (≤10), id diversity (≤5). The "Simplicity" score is `100 − complexity`.
* **Technology** (modern-practice signals) — async/defer/module share of external scripts (≤25), blocking scripts in head (5 each ≤20), lazy-image share (≤15), plain-http assets (3 each ≤15), missing resource hints (10), images without dimensions (2 each ≤15).
* **Overall** = SEO 25 % + Accessibility 25 % + Structure 15 % + Metadata 15 % + Simplicity 10 % + Technology 10 %.

## Technology detection

Each rule reports only when concrete evidence exists (framework markers such as `__NEXT_DATA__`, `data-reactroot`, `ng-version`, `data-v-*`, asset paths like `/_next/static/`, `/wp-content/`, response headers such as `cf-ray`, `x-vercel-id`, `server`, class-pattern counts for Tailwind/Bootstrap, known analytics loaders…). Confidence is *High* with ≥2 independent signals or a definitive marker, otherwise *Medium*. Evidence strings are shown for every detection.

## AI layer (optional)

`AIProvider` abstraction with OpenAI, OpenRouter, Gemini and any OpenAI-compatible custom endpoint. The model receives a compact structured context (metadata, pruned DOM outline, heading/nav summary, resource statistics, SEO/a11y findings, technology evidence, complexity, patterns, issues, scores) — never raw HTML — and is instructed to answer only from that context and to state when something is unavailable. Configure via `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY`, `AI_BASE_URL`, or per-session in the AI panel.

## Limitations (by design)

* Analysis is of the server-delivered HTML; client-rendered content that only appears after JavaScript runs is not visible.
* Accessibility checks are static signals, not a WCAG audit.
* Technology detections are inferences from observable evidence.
* Repeated-structure detection shows inferred patterns, not real framework components.
* The DOM tree transferred to the browser is capped at 25 000 elements (statistics cover the full document; a notice is shown when truncated).
