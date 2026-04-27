import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateHealthReport, getPeriodDates } from "@/lib/reports/report-generator";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();
  const { data: reports } = await db
    .from("health_reports")
    .select("id, period, period_start, period_end, summary, created_at, stats")
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false })
    .limit(30);

  return NextResponse.json({ reports: reports ?? [] });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { period } = await request.json() as { period: "daily" | "weekly" | "monthly" };
  if (!["daily", "weekly", "monthly"].includes(period)) {
    return NextResponse.json({ error: "period must be daily, weekly, or monthly" }, { status: 400 });
  }

  const { start, end } = getPeriodDates(period);
  const result = await generateHealthReport({
    userId: session.userId,
    period,
    periodStart: start,
    periodEnd: end,
  });

  return NextResponse.json(result);
}
