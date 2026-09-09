export interface RedirectHop {
  url: string;
  status: number;
}

export interface FetchedPage {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  contentType: string | null;
  html: string;
  /** Bytes received. */
  size: number;
  redirects: RedirectHop[];
  fetchDurationMs: number;
  fetchedAt: string;
  /** Result of robots.txt lookup (informational). */
  robots: RobotsInfo;
}

export interface RobotsInfo {
  status: "allowed" | "disallowed" | "unavailable";
  detail: string;
}

export interface FetchFailure {
  ok: false;
  code:
    | "INVALID_URL"
    | "BLOCKED"
    | "DNS"
    | "TIMEOUT"
    | "HTTP_ERROR"
    | "NOT_HTML"
    | "TOO_LARGE"
    | "NETWORK"
    | "RATE_LIMITED"
    | "TOO_MANY_REDIRECTS";
  message: string;
  status?: number;
}

export type FetchResult = { ok: true; page: FetchedPage } | FetchFailure;

export interface PageMetadata {
  title: string | null;
  description: string | null;
  canonical: string | null;
  lang: string | null;
  charset: string | null;
  viewport: string | null;
  robots: string | null;
  generator: string | null;
  themeColor: string | null;
  favicon: string | null;
  openGraph: Record<string, string>;
  twitter: Record<string, string>;
  jsonLdCount: number;
  jsonLdTypes: string[];
  hreflang: { lang: string; href: string }[];
  metaTags: { name: string; content: string }[];
}
