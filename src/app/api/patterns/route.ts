import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPatternInsight } from "@/lib/patterns/detector";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();
  const { data } = await db
    .from("failure_patterns")
    .select("*")
    .eq("user_id", session.userId)
    .order("occurrence_count", { ascending: false })
    .limit(30);

  return NextResponse.json({ patterns: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { patternId } = body;

  const insight = await getPatternInsight(patternId, session.userId);
  return NextResponse.json({ insight });
}
