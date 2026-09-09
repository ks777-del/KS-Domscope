import { pgTable, text, integer, timestamp, jsonb, uuid, index } from "drizzle-orm/pg-core";

export const analyses = pgTable(
  "analyses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    url: text("url").notNull(),
    hostname: text("hostname").notNull(),
    title: text("title"),
    overallScore: integer("overall_score"),
    elements: integer("elements"),
    result: jsonb("result").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("analyses_created_idx").on(t.createdAt), index("analyses_hostname_idx").on(t.hostname)],
);

export type AnalysisRow = typeof analyses.$inferSelect;
