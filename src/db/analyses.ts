import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { analyses } from "@/db/schema";
import type { AnalysisResult } from "@/types/analysis";

export async function saveAnalysis(result: AnalysisResult): Promise<string> {
  const [row] = await db
    .insert(analyses)
    .values({ url: result.url, hostname: result.hostname, title: result.metadata.title, overallScore: result.scores.overall, elements: result.statistics.elements, result })
    .returning({ id: analyses.id });
  return row.id;
}

export async function getAnalysis(id: string): Promise<AnalysisResult | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db.select().from(analyses).where(eq(analyses.id, id)).limit(1);
  if (!row) return null;
  const result = row.result as AnalysisResult;
  return { ...result, id: row.id };
}

export interface RecentAnalysis {
  id: string;
  url: string;
  hostname: string;
  title: string | null;
  overallScore: number | null;
  elements: number | null;
  createdAt: string;
}

export async function listRecent(limit = 12): Promise<RecentAnalysis[]> {
  const rows = await db
    .select({ id: analyses.id, url: analyses.url, hostname: analyses.hostname, title: analyses.title, overallScore: analyses.overallScore, elements: analyses.elements, createdAt: analyses.createdAt })
    .from(analyses)
    .orderBy(desc(analyses.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}
