import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

import { generateHealthReport, getPeriodDates } from "@/lib/reports/report-generator";

// GET /api/reports — list past reports for the current user
export async function GET() {
  
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: reports } = await admin
    .from("health_reports")
    .select("id, period, period_start, period_end, summary, created_at, stats")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  return NextResponse.json({ reports: reports ?? [] });
}

// POST /api/reports — generate a new report
export async function POST(request: NextRequest) {
  
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { period } = await request.json() as { period: "daily" | "weekly" | "monthly" };
  if (!["daily", "weekly", "monthly"].includes(period)) {
    return NextResponse.json({ error: "period must be daily, weekly, or monthly" }, { status: 400 });
  }

  const { start, end } = getPeriodDates(period);

  const result = await generateHealthReport({
    userId: user.id,
    period,
    periodStart: start,
    periodEnd: end,
  });

  return NextResponse.json(result);
}
