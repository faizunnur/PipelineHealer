import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPatternInsight } from "@/lib/patterns/detector";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("failure_patterns")
    .select("*")
    .eq("user_id", user.id)
    .order("occurrence_count", { ascending: false })
    .limit(30);

  return NextResponse.json({ patterns: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { patternId } = body;

  const insight = await getPatternInsight(patternId, user.id);
  return NextResponse.json({ insight });
}
