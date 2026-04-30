import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { subDays, format, differenceInMinutes, differenceInHours } from "date-fns";

// Cost per minute by runner (GitHub Actions pricing)
const COST_PER_MIN = { linux: 0.008, windows: 0.016, macos: 0.08 };
const DEFAULT_COST = COST_PER_MIN.linux;

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") ?? "30");
  const pipelineId = searchParams.get("pipelineId") ?? "all";

  const db = createAdminClient();
  const since = subDays(new Date(), days).toISOString();

  // Fetch all pipelines for the user
  const { data: pipelines } = await db
    .from("pipelines")
    .select("id, repo_full_name, provider, default_branch")
    .eq("user_id", session.userId);

  const pipelineIds = (pipelines ?? []).map((p) => p.id);
  if (pipelineIds.length === 0) return NextResponse.json({ dora: {}, builds: [], cost: {}, authors: [] });

  // Fetch runs in date range
  let runsQuery = db
    .from("pipeline_runs")
    .select("id, pipeline_id, status, branch, commit_sha, triggered_by, started_at, completed_at, duration_seconds, created_at")
    .in("pipeline_id", pipelineIds)
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  if (pipelineId !== "all") runsQuery = runsQuery.eq("pipeline_id", pipelineId);

  const { data: runs } = await runsQuery;
  const allRuns = runs ?? [];

  // ── DORA Metrics ─────────────────────────────────────────────────────────────

  const successRuns = allRuns.filter((r) => r.status === "success");
  const failedRuns  = allRuns.filter((r) => r.status === "failed");

  // Deployment Frequency: successful deployments per day
  const deployFreq = allRuns.length > 0 ? (successRuns.length / days).toFixed(2) : "0";

  // Change Failure Rate
  const cfr = allRuns.length > 0
    ? ((failedRuns.length / allRuns.length) * 100).toFixed(1)
    : "0";

  // Lead Time: avg time from run created to completed (proxy for lead time)
  const completedRuns = allRuns.filter((r) => r.started_at && r.completed_at);
  const avgLeadTimeMin = completedRuns.length > 0
    ? completedRuns.reduce((sum, r) => {
        return sum + differenceInMinutes(new Date(r.completed_at!), new Date(r.started_at!));
      }, 0) / completedRuns.length
    : 0;

  // MTTR: for each failure find next success on same branch, avg those gaps
  const mttrValues: number[] = [];
  const sortedByBranch: Record<string, typeof allRuns> = {};
  for (const r of allRuns) {
    if (!sortedByBranch[r.branch]) sortedByBranch[r.branch] = [];
    sortedByBranch[r.branch].push(r);
  }
  for (const branchRuns of Object.values(sortedByBranch)) {
    for (let i = 0; i < branchRuns.length; i++) {
      if (branchRuns[i].status === "failed") {
        const recovery = branchRuns.slice(i + 1).find((r) => r.status === "success");
        if (recovery) {
          mttrValues.push(differenceInHours(new Date(recovery.created_at), new Date(branchRuns[i].created_at)));
        }
      }
    }
  }
  const avgMttrH = mttrValues.length > 0
    ? (mttrValues.reduce((a, b) => a + b, 0) / mttrValues.length).toFixed(1)
    : null;

  // DORA performance level
  const deployFreqNum = parseFloat(deployFreq);
  const doraLevel = (metric: string, value: number) => {
    if (metric === "freq")  return value >= 1 ? "elite" : value >= 1/7 ? "high" : value >= 1/30 ? "medium" : "low";
    if (metric === "cfr")   return value <= 5 ? "elite" : value <= 10 ? "high" : value <= 15 ? "medium" : "low";
    if (metric === "ltMin") return value <= 60 ? "elite" : value <= 1440 ? "high" : value <= 10080 ? "medium" : "low";
    if (metric === "mttrH") return value <= 1 ? "elite" : value <= 24 ? "high" : value <= 168 ? "medium" : "low";
    return "low";
  };

  // ── Daily build series (for charts) ──────────────────────────────────────────
  const dailyMap: Record<string, { date: string; total: number; success: number; failed: number; avgDuration: number; cost: number }> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = format(subDays(new Date(), i), "MMM d");
    dailyMap[d] = { date: d, total: 0, success: 0, failed: 0, avgDuration: 0, cost: 0 };
  }
  const durationSums: Record<string, number[]> = {};
  for (const run of allRuns) {
    const d = format(new Date(run.created_at), "MMM d");
    if (!dailyMap[d]) continue;
    dailyMap[d].total++;
    if (run.status === "success") dailyMap[d].success++;
    if (run.status === "failed") dailyMap[d].failed++;
    const dur = run.duration_seconds ?? 0;
    if (!durationSums[d]) durationSums[d] = [];
    durationSums[d].push(dur);
    dailyMap[d].cost += (dur / 60) * DEFAULT_COST;
  }
  for (const [d, durs] of Object.entries(durationSums)) {
    if (durs.length > 0) dailyMap[d].avgDuration = Math.round(durs.reduce((a, b) => a + b, 0) / durs.length);
  }
  const builds = Object.values(dailyMap);

  // ── Cost per pipeline ─────────────────────────────────────────────────────────
  const costByPipeline: Record<string, { pipelineId: string; name: string; totalCost: number; totalMinutes: number; runs: number }> = {};
  for (const run of allRuns) {
    if (!costByPipeline[run.pipeline_id]) {
      const p = (pipelines ?? []).find((p) => p.id === run.pipeline_id);
      costByPipeline[run.pipeline_id] = { pipelineId: run.pipeline_id, name: p?.repo_full_name ?? run.pipeline_id, totalCost: 0, totalMinutes: 0, runs: 0 };
    }
    const dur = run.duration_seconds ?? 0;
    costByPipeline[run.pipeline_id].totalCost    += (dur / 60) * DEFAULT_COST;
    costByPipeline[run.pipeline_id].totalMinutes += dur / 60;
    costByPipeline[run.pipeline_id].runs++;
  }
  const costBreakdown = Object.values(costByPipeline).sort((a, b) => b.totalCost - a.totalCost);

  // ── Author stats ──────────────────────────────────────────────────────────────
  const authorMap: Record<string, { author: string; total: number; success: number; failed: number }> = {};
  for (const run of allRuns) {
    const a = run.triggered_by ?? "unknown";
    if (!authorMap[a]) authorMap[a] = { author: a, total: 0, success: 0, failed: 0 };
    authorMap[a].total++;
    if (run.status === "success") authorMap[a].success++;
    if (run.status === "failed") authorMap[a].failed++;
  }
  const authors = Object.values(authorMap).sort((a, b) => b.total - a.total).slice(0, 20);

  // ── Branch stats ──────────────────────────────────────────────────────────────
  const branchMap: Record<string, { branch: string; total: number; success: number; failed: number }> = {};
  for (const run of allRuns) {
    const b = run.branch ?? "unknown";
    if (!branchMap[b]) branchMap[b] = { branch: b, total: 0, success: 0, failed: 0 };
    branchMap[b].total++;
    if (run.status === "success") branchMap[b].success++;
    if (run.status === "failed") branchMap[b].failed++;
  }
  const branches = Object.values(branchMap).sort((a, b) => b.total - a.total).slice(0, 15);

  return NextResponse.json({
    dora: {
      deploymentFrequency: { value: deployFreq, unit: "deploys/day", level: doraLevel("freq", deployFreqNum) },
      leadTime:   { value: avgLeadTimeMin.toFixed(0), unit: "min avg", level: doraLevel("ltMin", avgLeadTimeMin) },
      mttr:       { value: avgMttrH, unit: "hrs avg", level: avgMttrH ? doraLevel("mttrH", parseFloat(avgMttrH)) : "low" },
      changeFailureRate: { value: cfr, unit: "% of deploys", level: doraLevel("cfr", parseFloat(cfr)) },
    },
    builds,
    costBreakdown,
    authors,
    branches,
    summary: {
      totalRuns: allRuns.length,
      successRate: allRuns.length > 0 ? ((successRuns.length / allRuns.length) * 100).toFixed(1) : "0",
      totalCost: costBreakdown.reduce((s, c) => s + c.totalCost, 0).toFixed(2),
      avgDuration: completedRuns.length > 0
        ? Math.round(completedRuns.reduce((s, r) => s + (r.duration_seconds ?? 0), 0) / completedRuns.length)
        : 0,
    },
  });
}
