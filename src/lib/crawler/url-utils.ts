export interface UrlValidation {
  ok: boolean;
  url?: URL;
  normalized?: string;
  error?: string;
}

const HOSTNAME_RE =
  /^(?=.{1,253}$)(?!-)([a-z0-9-]{1,63}(?<!-)\.)+[a-z0-9-]{2,63}$|^localhost$|^\d{1,3}(\.\d{1,3}){3}$|^\[?[0-9a-f:]+\]?$/i;

/**
 * Validate a user-provided URL string. Only HTTP(S) URLs with a
 * plausible hostname are accepted. Adds https:// when the scheme is
 * missing so users can type "example.com".
 */
export function validateUrl(input: string): UrlValidation {
  const raw = (input ?? "").trim();
  if (!raw) return { ok: false, error: "Please enter a URL." };
  if (raw.length > 2048) return { ok: false, error: "URL is too long (max 2048 characters)." };
  if (/\s/.test(raw)) return { ok: false, error: "URL must not contain whitespace." };

  let candidate = raw;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false, error: "The URL is malformed." };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: `Unsupported protocol "${url.protocol.replace(":", "")}". Only http and https are allowed.` };
  }
  if (!url.hostname) return { ok: false, error: "The URL has no hostname." };
  if (url.username || url.password) return { ok: false, error: "URLs with embedded credentials are not supported." };
  if (!HOSTNAME_RE.test(url.hostname)) return { ok: false, error: `"${url.hostname}" is not a valid hostname.` };
  if (!url.hostname.includes(".") && url.hostname !== "localhost" && !url.hostname.includes(":")) {
    return { ok: false, error: "Hostname must include a top-level domain (e.g. example.com)." };
  }

  return { ok: true, url, normalized: normalizeUrl(url) };
}

/** Normalize: lowercase host, strip default port, drop fragment, keep path & query. */
export function normalizeUrl(input: string | URL): string {
  const url = typeof input === "string" ? new URL(input) : new URL(input.toString());
  url.hostname = url.hostname.toLowerCase();
  url.hash = "";
  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) {
    url.port = "";
  }
  if (url.pathname === "") url.pathname = "/";
  return url.toString();
}

export function safeResolve(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

export function hostnameOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Compare registrable-ish hosts: treats www.example.com and example.com as same site. */
export function sameSite(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const strip = (h: string) => h.replace(/^www\./, "");
  return strip(a) === strip(b);
}
