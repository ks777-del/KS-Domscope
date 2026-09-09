import { NextResponse } from "next/server";
import { listRecent } from "@/db/analyses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ items: await listRecent(12) });
  } catch {
    return NextResponse.json({ items: [], error: "Database unavailable" });
  }
}
