import type { AnalysisResult } from "./analysis";

export interface ComparisonMetric {
  key: string;
  label: string;
  group: string;
  a: number | string | null;
  b: number | string | null;
  /** Which side is "better" if it is meaningful; null when neutral. */
  better: "a" | "b" | "tie" | null;
  /** "lower" = lower is better, "higher" = higher is better, "neutral" */
  direction: "lower" | "higher" | "neutral";
}

export interface ComparisonResult {
  a: { url: string; id: string | null; hostname: string };
  b: { url: string; id: string | null; hostname: string };
  metrics: ComparisonMetric[];
  technologies: { name: string; inA: boolean; inB: boolean }[];
  summary: { aWins: number; bWins: number; ties: number };
}

export interface ComparisonWithAnalyses {
  comparison: ComparisonResult;
  analysisA: AnalysisResult;
  analysisB: AnalysisResult;
}
