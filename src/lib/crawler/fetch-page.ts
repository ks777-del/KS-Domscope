import type { FetchResult, FetchedPage, RedirectHop } from "@/types/page";
import { validateUrl, normalizeUrl } from "./url-utils";
import { assertPublicTarget, FETCH_TIMEOUT_MS, MAX_REDIRECTS, MAX_RESPONSE_BYTES, USER_AGENT } from "./security";
import { checkRobots } from "./robots";

const HTML_TYPES = ["text/html", "application/xhtml+xml"];

/**
 * Securely fetch a public web page.
 * - validates and normalizes the URL
 * - resolves DNS and refuses private / internal targets (also on every redirect)
 * - enforces timeout, redirect limit, content-type and size limits
 * - never executes anything from the response
 */
export async function fetchPage(input: string): Promise<FetchResult> {
  const validation = validateUrl(input);
  if (!validation.ok || !validation.url) {
    return { ok: false, code: "INVALID_URL", message: validation.error ?? "Invalid URL." };
  }

  const started = Date.now();
  const redirects: RedirectHop[] = [];
  let current = new URL(validation.normalized!);
  const requestedUrl = current.toString();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const check = await assertPublicTarget(current);
      if (!check.ok) {
        const isDns = /DNS/.test(check.reason ?? "");
        return { ok: false, code: isDns ? "DNS" : "BLOCKED", message: check.reason ?? "Target blocked." };
      }

      let res: Response;
      try {
        res = await fetch(current.toString(), {
          method: "GET",
          redirect: "manual",
          signal: controller.signal,
          headers: {
            "user-agent": USER_AGENT,
            accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
            "accept-language": "en-US,en;q=0.8",
          },
        });
      } catch (err) {
        const e = err as Error & { cause?: { code?: string } };
        if (e.name === "AbortError") {
          return { ok: false, code: "TIMEOUT", message: `The request timed out after ${FETCH_TIMEOUT_MS / 1000}s.` };
        }
        const code = e.cause?.code;
        if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
          return { ok: false, code: "DNS", message: `DNS resolution failed for ${current.hostname}.` };
        }
        return {
          ok: false,
          code: "NETWORK",
          message: `Network error while contacting ${current.hostname}${code ? ` (${code})` : ""}.`,
        };
      }

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) {
          return { ok: false, code: "HTTP_ERROR", status: res.status, message: `The target returned HTTP ${res.status} without a Location header.` };
        }
        redirects.push({ url: current.toString(), status: res.status });
        try {
          await res.body?.cancel();
        } catch {
          /* ignore */
        }
        let next: URL;
        try {
          next = new URL(location, current);
        } catch {
          return { ok: false, code: "HTTP_ERROR", status: res.status, message: `Redirect target "${location}" is invalid.` };
        }
        if (next.protocol !== "http:" && next.protocol !== "https:") {
          return { ok: false, code: "BLOCKED", message: `Redirect to unsupported protocol ${next.protocol}.` };
        }
        if (hop === MAX_REDIRECTS) {
          return { ok: false, code: "TOO_MANY_REDIRECTS", message: `More than ${MAX_REDIRECTS} redirects.` };
        }
        current = next;
        continue;
      }

      if (!res.ok) {
        try {
          await res.body?.cancel();
        } catch {
          /* ignore */
        }
        return { ok: false, code: "HTTP_ERROR", status: res.status, message: `The target returned HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ""}.` };
      }

      const contentType = res.headers.get("content-type");
      const mime = contentType?.split(";")[0].trim().toLowerCase() ?? null;
      if (!mime || !HTML_TYPES.includes(mime)) {
        try {
          await res.body?.cancel();
        } catch {
          /* ignore */
        }
        return { ok: false, code: "NOT_HTML", status: res.status, message: `The response is not an HTML document (content-type: ${contentType ?? "missing"}).` };
      }

      const declared = Number(res.headers.get("content-length") ?? 0);
      if (declared > MAX_RESPONSE_BYTES) {
        try {
          await res.body?.cancel();
        } catch {
          /* ignore */
        }
        return { ok: false, code: "TOO_LARGE", message: `The document is ${formatBytes(declared)}, above the ${formatBytes(MAX_RESPONSE_BYTES)} limit.` };
      }

      // Stream with a hard cap.
      const chunks: Uint8Array[] = [];
      let received = 0;
      if (res.body) {
        const reader = res.body.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              received += value.byteLength;
              if (received > MAX_RESPONSE_BYTES) {
                await reader.cancel();
                return { ok: false, code: "TOO_LARGE", message: `The document exceeds the ${formatBytes(MAX_RESPONSE_BYTES)} limit.` };
              }
              chunks.push(value);
            }
          }
        } catch (err) {
          if ((err as Error).name === "AbortError") {
            return { ok: false, code: "TIMEOUT", message: `The response body timed out after ${FETCH_TIMEOUT_MS / 1000}s.` };
          }
          return { ok: false, code: "NETWORK", message: "The connection dropped while reading the response." };
        }
      }
      const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
      const charset = detectCharset(contentType, buffer);
      const html = decode(buffer, charset);
      if (!html.trim()) {
        return { ok: false, code: "NOT_HTML", status: res.status, message: "The server returned an empty document." };
      }

      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        headers[k] = v;
      });

      const robots = await checkRobots(current);

      const page: FetchedPage = {
        requestedUrl,
        finalUrl: normalizeUrl(current),
        status: res.status,
        statusText: res.statusText,
        headers,
        contentType,
        html,
        size: received,
        redirects,
        fetchDurationMs: Date.now() - started,
        fetchedAt: new Date().toISOString(),
        robots,
      };
      return { ok: true, page };
    }
    return { ok: false, code: "TOO_MANY_REDIRECTS", message: `More than ${MAX_REDIRECTS} redirects.` };
  } finally {
    clearTimeout(timer);
  }
}

function detectCharset(contentType: string | null, buf: Buffer): string {
  const fromHeader = contentType?.match(/charset=["']?([\w-]+)/i)?.[1];
  if (fromHeader) return fromHeader.toLowerCase();
  const head = buf.subarray(0, 4096).toString("latin1");
  const fromMeta = head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1];
  return (fromMeta ?? "utf-8").toLowerCase();
}

function decode(buf: Buffer, charset: string): string {
  try {
    return new TextDecoder(charset, { fatal: false }).decode(buf);
  } catch {
    return buf.toString("utf8");
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
