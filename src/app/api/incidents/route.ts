import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { subDays } from "date-fns";
import { differenceInHours } from "date-fns";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();
  const since = subDays(new Date(), 30).toISOString();

  // Get user's pipelines
  const { data: pipelines } = await db
    .from("pipelines")
    .select("id, repo_full_name")
    .eq("user_id", session.userId);

  const pipelineIds = (pipelines ?? []).map((p) => p.id);
  const pipelineMap = Object.fromEntries((pipelines ?? []).map((p) => [p.id, p.repo_full_name]));

  if (pipelineIds.length === 0) {
    return NextResponse.json({ incidents: [], recentRuns: [] });
  }

  // Fetch recent runs with jobs
  const { data: runs } = await db
    .from("pipeline_runs")
    .select(`
      id, pipeline_id, status, branch, commit_sha, commit_message,
      triggered_by, started_at, completed_at, duration_seconds, created_at,
      pipeline_jobs ( id, job_name, status, started_at, completed_at, error_excerpt )
    `)
    .in("pipeline_id", pipelineIds)
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  const allRuns = runs ?? [];

  // Group by pipeline + branch to find incident groups (consecutive failures)
  const branchMap: Record<string, typeof allRuns> = {};
  for (const run of allRuns) {
    const key = `${run.pipeline_id}:${run.branch}`;
    if (!branchMap[key]) branchMap[key] = [];
    branchMap[key].push(run);
  }

  type IncidentGroup = {
    branch: string;
    pipeline_id: string;
    repo_name: string;
    runs: typeof allRuns;
    failureStart: string;
    recoveredAt: string | null;
    durationHours: number | null;
  };

  const incidents: IncidentGroup[] = [];

  for (const [key, branchRuns] of Object.entries(branchMap)) {
    const [pipelineId, ...branchParts] = key.split(":");
    const branch = branchParts.join(":");

    let incidentRuns: typeof allRuns = [];
    let inIncident = false;

    for (const run of branchRuns) {
      const isFailed = run.status === "failed";
      const isSuccess = run.status === "success";

      if (isFailed) {
        inIncident = true;
        incidentRuns.push(run);
      } else if (isSuccess && inIncident) {
        // Incident resolved
        const failureStart = incidentRuns[0].created_at;
        const recoveredAt = run.created_at;
        const durationHours = differenceInHours(new Date(recoveredAt), new Date(failureStart));

        incidents.push({
          branch,
          pipeline_id: pipelineId,
          repo_name: pipelineMap[pipelineId] ?? pipelineId,
          runs: [...incidentRuns],
          failureStart,
          recoveredAt,
          durationHours,
        });

        incidentRuns = [];
        inIncident = false;
      } else if (isSuccess) {
        incidentRuns = [];
        inIncident = false;
      }
    }

    // Still-open incident
    if (inIncident && incidentRuns.length > 0) {
      incidents.push({
        branch,
        pipeline_id: pipelineId,
        repo_name: pipelineMap[pipelineId] ?? pipelineId,
        runs: incidentRuns,
        failureStart: incidentRuns[0].created_at,
        recoveredAt: null,
        durationHours: null,
      });
    }
  }

  // Sort: open first, then by start time desc
  incidents.sort((a, b) => {
    if (!a.recoveredAt && b.recoveredAt) return -1;
    if (a.recoveredAt && !b.recoveredAt) return 1;
    return new Date(b.failureStart).getTime() - new Date(a.failureStart).getTime();
  });

  // Critical path: slowest completed runs for analysis
  const recentRuns = allRuns
    .filter((r) => r.duration_seconds && r.started_at && r.completed_at)
    .sort((a, b) => (b.duration_seconds ?? 0) - (a.duration_seconds ?? 0))
    .slice(0, 20)
    .map((r) => ({ ...r, repo_name: pipelineMap[r.pipeline_id] ?? r.pipeline_id }));

  return NextResponse.json({ incidents, recentRuns });
}
