import { createAdminClient } from "@/lib/supabase/admin";
import Anthropic from "@anthropic-ai/sdk";

export interface ReportData {
  userId: string;
  period: "daily" | "weekly" | "monthly";
  periodStart: string;
  periodEnd: string;
}

export interface PipelineStats {
  pipelineId: string;
  repoName: string;
  totalRuns: number;
  successRuns: number;
  failedRuns: number;
  successRate: number;
  avgDurationMinutes: number;
  healingEvents: number;
  slaViolations: number;
}

export async function generateHealthReport(data: ReportData): Promise<{
  reportId: string;
  summary: string;
  stats: PipelineStats[];
}> {
  const supabase = createAdminClient();
  const client = new Anthropic();

  // Gather stats for all pipelines in the period
  const { data: pipelines } = await supabase
    .from("pipelines")
    .select("id, repo_full_name")
    .eq("user_id", data.userId);

  if (!pipelines || pipelines.length === 0) {
    const reportId = await saveReport(supabase, data, [], "No pipelines found for this account.");
    return { reportId, summary: "No pipelines found.", stats: [] };
  }

  const stats: PipelineStats[] = [];

  for (const pipeline of pipelines) {
    const { data: runs } = await supabase
      .from("pipeline_runs")
      .select("id, status, duration_seconds")
      .eq("pipeline_id", pipeline.id)
      .gte("created_at", data.periodStart)
      .lte("created_at", data.periodEnd);

    const runList = runs ?? [];
    const total = runList.length;
    const success = runList.filter((r) => r.status === "success").length;
    const failed = runList.filter((r) => r.status === "failed").length;
    const durations = runList.filter((r) => r.duration_seconds).map((r) => r.duration_seconds as number);
    const avgDuration = durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 60)
      : 0;

    const { count: healingCount } = await supabase
      .from("healing_events")
      .select("id", { count: "exact", head: true })
      .eq("pipeline_id", pipeline.id)
      .gte("created_at", data.periodStart)
      .lte("created_at", data.periodEnd);

    // Get SLA rule IDs for this pipeline, then count violations
    const { data: ruleIds } = await supabase
      .from("sla_rules")
      .select("id")
      .eq("pipeline_id", pipeline.id);
    const ruleIdList = (ruleIds ?? []).map((r) => r.id);
    let slaCount = 0;
    if (ruleIdList.length > 0) {
      const { count } = await supabase
        .from("sla_violations")
        .select("id", { count: "exact", head: true })
        .in("rule_id", ruleIdList)
        .gte("created_at", data.periodStart)
        .lte("created_at", data.periodEnd);
      slaCount = count ?? 0;
    }

    stats.push({
      pipelineId: pipeline.id,
      repoName: pipeline.repo_full_name,
      totalRuns: total,
      successRuns: success,
      failedRuns: failed,
      successRate: total > 0 ? Math.round((success / total) * 100) : 100,
      avgDurationMinutes: avgDuration,
      healingEvents: healingCount ?? 0,
      slaViolations: slaCount,
    });
  }

  // Generate AI summary
  const statsText = stats.map((s) =>
    `${s.repoName}: ${s.totalRuns} runs, ${s.successRate}% success rate, ${s.avgDurationMinutes}min avg, ${s.healingEvents} heals, ${s.slaViolations} SLA violations`
  ).join("\n");

  let summary = "";
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [{
        role: "user",
        content: `Summarize this ${data.period} CI/CD pipeline health report in 3-4 sentences. Be specific about trends, highlight concerns, and give one actionable recommendation.\n\n${statsText}`,
      }],
    });
    summary = (response.content[0] as { type: string; text: string }).text;
  } catch {
    summary = `Report covers ${stats.length} pipeline(s) from ${new Date(data.periodStart).toLocaleDateString()} to ${new Date(data.periodEnd).toLocaleDateString()}.`;
  }

  const reportId = await saveReport(supabase, data, stats, summary);
  return { reportId, summary, stats };
}

async function saveReport(
  supabase: ReturnType<typeof createAdminClient>,
  data: ReportData,
  stats: PipelineStats[],
  summary: string
): Promise<string> {
  const { data: report } = await supabase
    .from("health_reports")
    .insert({
      user_id: data.userId,
      period: data.period,
      period_start: data.periodStart,
      period_end: data.periodEnd,
      stats: stats as unknown as import("@/lib/supabase/database.types").Json,
      summary,
    })
    .select("id")
    .single();

  return report?.id ?? "";
}

export function getPeriodDates(period: "daily" | "weekly" | "monthly"): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString();
  let start: Date;
  if (period === "daily") {
    start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  } else if (period === "weekly") {
    start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else {
    start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  return { start: start.toISOString(), end };
}
