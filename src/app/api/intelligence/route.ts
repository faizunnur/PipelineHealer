import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/intelligence — AI fix history + token usage breakdown
export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();

  type EnvRow = { id: string; file_path: string | null; severity: string | null; rule: string | null; title: string | null; ai_fix_result: unknown; resolved: boolean; pipeline_id: string; created_at: string };
  type ScanRow = { id: string; file_path: string; severity: string; rule_id: string; title: string; ai_fix_result: unknown; status: string; pipeline_id: string; created_at: string };
  type UsageRow = { feature: string; model: string; tokens_in: number; tokens_out: number; total: number; created_at: string };

  const [envFixes, scanFixes, tokenUsage] = await Promise.all([
    db
      .from("env_var_audits")
      .select("id, file_path, severity, rule, title, ai_fix_result, resolved, created_at, pipeline_id")
      .eq("user_id", session.userId)
      .not("ai_fix_result", "is", null)
      .order("created_at", { ascending: false }),

    db
      .from("secret_scan_results")
      .select("id, file_path, severity, rule_id, title, ai_fix_result, status, created_at, pipeline_id")
      .eq("user_id", session.userId)
      .not("ai_fix_result", "is", null)
      .order("created_at", { ascending: false }),

    db
      .from("token_usage_log")
      .select("feature, model, tokens_in, tokens_out, total, created_at")
      .eq("user_id", session.userId)
      .order("created_at", { ascending: false }),
  ]);

  // Normalize into a unified list
  const envItems = ((envFixes.data ?? []) as unknown as EnvRow[]).map((r) => ({
    id: r.id,
    source: "env_audit" as const,
    file_path: r.file_path,
    severity: r.severity,
    rule: r.rule,
    title: r.title,
    ai_fix_result: r.ai_fix_result,
    is_resolved: r.resolved,
    pipeline_id: r.pipeline_id,
    created_at: r.created_at,
  }));

  const scanItems = ((scanFixes.data ?? []) as unknown as ScanRow[]).map((r) => ({
    id: r.id,
    source: "security_scan" as const,
    file_path: r.file_path,
    severity: r.severity,
    rule: r.rule_id,
    title: r.title,
    ai_fix_result: r.ai_fix_result,
    is_resolved: r.status === "resolved" || r.status === "dismissed",
    pipeline_id: r.pipeline_id,
    created_at: r.created_at,
  }));

  const aiFixes = [...envItems, ...scanItems].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Aggregate token usage by feature
  const usageMap: Record<string, { feature: string; model: string; tokens_in: number; tokens_out: number; total: number; calls: number; last_used: string }> = {};
  for (const row of (tokenUsage.data ?? []) as unknown as UsageRow[]) {
    const key = `${row.feature}::${row.model}`;
    if (!usageMap[key]) {
      usageMap[key] = { feature: row.feature, model: row.model, tokens_in: 0, tokens_out: 0, total: 0, calls: 0, last_used: row.created_at };
    }
    usageMap[key].tokens_in += row.tokens_in ?? 0;
    usageMap[key].tokens_out += row.tokens_out ?? 0;
    usageMap[key].total += row.total ?? 0;
    usageMap[key].calls += 1;
    if (row.created_at > usageMap[key].last_used) usageMap[key].last_used = row.created_at;
  }

  return NextResponse.json({
    ai_fixes: aiFixes,
    token_usage: Object.values(usageMap).sort((a, b) => b.total - a.total),
  });
}

// DELETE /api/intelligence — clear ai_fix_result for a finding
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { findingId, source } = await req.json().catch(() => ({}));
  if (!findingId || !source) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const db = createAdminClient();

  if (source === "env_audit") {
    await db.from("env_var_audits").update({ ai_fix_result: null }).eq("id", findingId).eq("user_id", session.userId);
  } else {
    await db.from("secret_scan_results").update({ ai_fix_result: null }).eq("id", findingId).eq("user_id", session.userId);
  }

  return NextResponse.json({ success: true });
}
