import type { DomDocument } from "./dom";
import type { FetchedPage, PageMetadata } from "./page";
import type { TechnologyDetection } from "./technology";

export interface PageStatistics {
  elements: number;
  maxDepth: number;
  textNodes: number;
  comments: number;
  links: number;
  images: number;
  forms: number;
  scripts: number;
  stylesheets: number;
  htmlSize: number;
  textSize: number;
  attributeCount: number;
  uniqueTags: number;
  uniqueClasses: number;
  uniqueIds: number;
  tagFrequency: { tag: string; count: number }[];
  headings: Record<"h1" | "h2" | "h3" | "h4" | "h5" | "h6", number>;
  iframes: number;
  tables: number;
  buttons: number;
  inputs: number;
}

export type LinkKind =
  | "internal"
  | "external"
  | "anchor"
  | "mailto"
  | "tel"
  | "javascript"
  | "other";

export interface LinkEntry {
  href: string;
  resolved: string | null;
  kind: LinkKind;
  text: string;
  nodeId: number;
  rel: string | null;
  target: string | null;
  nofollow: boolean;
}

export interface LinkAnalysis {
  counts: Record<LinkKind, number>;
  total: number;
  uniqueDestinations: number;
  links: LinkEntry[];
  externalDomains: { domain: string; count: number }[];
  emptyHrefs: number;
}

export type AssetType =
  | "image"
  | "svg"
  | "font"
  | "stylesheet"
  | "script"
  | "favicon"
  | "video"
  | "audio"
  | "iframe"
  | "preload"
  | "other";

export interface AssetEntry {
  url: string | null;
  type: AssetType;
  sourceTag: string;
  nodeId: number;
  loading: string | null;
  inline: boolean;
  detail: string | null;
  external: boolean | null;
}

export interface AssetAnalysis {
  counts: Record<AssetType, number>;
  total: number;
  assets: AssetEntry[];
  imagesWithoutDimensions: number;
  lazyImages: number;
  assetDomains: { domain: string; count: number }[];
}

export interface ScriptEntry {
  src: string | null;
  resolved: string | null;
  inline: boolean;
  async: boolean;
  defer: boolean;
  module: boolean;
  nomodule: boolean;
  type: string | null;
  inlineSize: number;
  nodeId: number;
  sourceLine: number | null;
  inHead: boolean;
  external: boolean | null;
  preview: string | null;
}

export interface ScriptAnalysis {
  total: number;
  external: number;
  inline: number;
  async: number;
  defer: number;
  module: number;
  jsonLd: number;
  blockingInHead: number;
  inlineBytes: number;
  scripts: ScriptEntry[];
  scriptDomains: { domain: string; count: number }[];
}

export interface StyleAnalysis {
  externalStylesheets: number;
  inlineStyleBlocks: number;
  elementsWithStyle: number;
  inlineStyleBytes: number;
  styleBlockBytes: number;
  stylesheets: { href: string; media: string | null; nodeId: number }[];
  styleBlocks: { size: number; nodeId: number; preview: string }[];
  topClasses: { name: string; count: number }[];
  totalClassUsages: number;
  uniqueClasses: number;
  fontFaces: number;
  importantCount: number;
  mediaQueries: number;
}

export type CheckStatus = "pass" | "warn" | "fail" | "info";

export interface SeoCheck {
  id: string;
  label: string;
  status: CheckStatus;
  value: string | null;
  detail: string;
}

export interface SeoAnalysis {
  score: number;
  checks: SeoCheck[];
  headings: { tag: string; text: string; nodeId: number }[];
  scoring: string[];
}

export interface AccessibilityIssue {
  id: string;
  rule: string;
  message: string;
  nodeId: number | null;
  severity: IssueSeverity;
  evidence: string;
}

export interface AccessibilityAnalysis {
  score: number;
  images: { total: number; withAlt: number; decorative: number; missing: number };
  forms: { inputs: number; labelled: number; unlabelled: number };
  buttons: { total: number; named: number; unnamed: number };
  links: { total: number; meaningful: number; generic: number; empty: number };
  lang: string | null;
  headingIssues: string[];
  headingOrder: string[];
  ariaAttributes: number;
  roles: number;
  landmarks: string[];
  positiveTabindex: number;
  iframesWithoutTitle: number;
  issues: AccessibilityIssue[];
  scoring: string[];
}

export interface ComplexityBranch {
  nodeId: number;
  label: string;
  descendants: number;
  depth: number;
}

export interface ComplexityAnalysis {
  score: number;
  elements: number;
  maxDepth: number;
  averageDepth: number;
  deepBranches: number;
  deepThreshold: number;
  largestBranches: ComplexityBranch[];
  deepestPaths: { nodeId: number; path: string; depth: number }[];
  classDiversity: number;
  idDiversity: number;
  averageChildren: number;
  maxChildren: { nodeId: number; label: string; count: number } | null;
  breakdown: { metric: string; value: string; penalty: number; explanation: string }[];
  explanation: string;
}

export interface RepeatedPattern {
  signature: string;
  kind: "class" | "structure";
  count: number;
  tag: string;
  exampleNodeIds: number[];
  averageChildren: number;
}

export type IssueSeverity = "critical" | "warning" | "suggestion";
export type IssueCategory =
  | "SEO"
  | "Accessibility"
  | "Structure"
  | "Assets"
  | "Links"
  | "Metadata"
  | "Performance";

export interface Issue {
  id: string;
  category: IssueCategory;
  severity: IssueSeverity;
  title: string;
  description: string;
  evidence: string;
  nodeId: number | null;
}

export interface ScoreBreakdown {
  seo: number;
  accessibility: number;
  structure: number;
  metadata: number;
  complexity: number;
  technology: number;
  overall: number;
  notes: Record<string, string[]>;
}

export interface FetchSummary {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  statusText: string;
  contentType: string | null;
  size: number;
  redirects: FetchedPage["redirects"];
  fetchDurationMs: number;
  fetchedAt: string;
  headers: Record<string, string>;
  robots: FetchedPage["robots"];
}

export interface AnalysisResult {
  id: string | null;
  url: string;
  hostname: string;
  analyzedAt: string;
  analysisDurationMs: number;
  fetch: FetchSummary;
  metadata: PageMetadata;
  statistics: PageStatistics;
  dom: DomDocument;
  links: LinkAnalysis;
  assets: AssetAnalysis;
  scripts: ScriptAnalysis;
  styles: StyleAnalysis;
  seo: SeoAnalysis;
  accessibility: AccessibilityAnalysis;
  technologies: TechnologyDetection[];
  complexity: ComplexityAnalysis;
  patterns: RepeatedPattern[];
  issues: Issue[];
  scores: ScoreBreakdown;
}

/** Progress events streamed from /api/analyze */
export type AnalyzeEvent =
  | { type: "stage"; stage: string; status: "start" | "done"; detail?: string }
  | { type: "result"; result: AnalysisResult }
  | { type: "error"; code: string; message: string; status?: number };
