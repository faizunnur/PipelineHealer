import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto/decrypt";
import { applyGitHubFix } from "@/lib/github/workflow-updater";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { pipelineId, findingId, source } = body as {
    pipelineId: string;
    findingId: string;
    source: "env_audit" | "security_scan";
  };

  if (!pipelineId || !findingId || !source)
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

  const db = createAdminClient();

  // Fetch pipeline + token
  const { data: pipeline } = await db
    .from("pipelines")
    .select("id, repo_full_name, provider, integrations(encrypted_token, token_iv, token_tag)")
    .eq("id", pipelineId)
    .eq("user_id", session.userId)
    .single();

  if (!pipeline) return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });

  const integration = pipeline.integrations as {
    encrypted_token: string; token_iv: string; token_tag: string;
  } | null;
  if (!integration) return NextResponse.json({ error: "Integration not found" }, { status: 400 });

  const token = decrypt({
    encrypted: integration.encrypted_token,
    iv: integration.token_iv,
    tag: integration.token_tag,
  });

  // Fetch finding + its ai_fix_result
  type FindingRow = { id: string; file_path: string | null; title: string | null; ai_fix_result: { original_code: string | null; fixed_code: string | null; explanation: string } | null };

  let finding: FindingRow | null = null;
  if (source === "env_audit") {
    const { data } = await db.from("env_var_audits").select("id, file_path, title, ai_fix_result").eq("id", findingId).eq("user_id", session.userId).single();
    finding = data as FindingRow | null;
  } else {
    const { data } = await db.from("secret_scan_results").select("id, file_path, title, ai_fix_result").eq("id", findingId).eq("user_id", session.userId).single();
    finding = data as FindingRow | null;
  }

  if (!finding) return NextResponse.json({ error: "Finding not found" }, { status: 404 });

  const fix = finding.ai_fix_result;

  if (!fix?.original_code || !fix?.fixed_code)
    return NextResponse.json({ error: "No applicable fix available — original or fixed code is missing." }, { status: 400 });

  const pipelineRow = pipeline as { provider: string; repo_full_name: string };
  if (pipelineRow.provider !== "github")
    return NextResponse.json({ error: "Auto-apply currently supports GitHub repositories only." }, { status: 400 });

  if (!finding.file_path)
    return NextResponse.json({ error: "Finding has no file path." }, { status: 400 });

  try {
    await applyGitHubFix({
      token,
      repoFullName: pipelineRow.repo_full_name,
      filePath: finding.file_path,
      originalCode: fix.original_code,
      fixedCode: fix.fixed_code,
      reason: fix.explanation,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 422 });
  }

  // Mark finding as resolved after successful apply
  if (source === "env_audit") {
    await db.from("env_var_audits")
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq("id", findingId)
      .eq("user_id", session.userId);
  } else {
    await db.from("secret_scan_results")
      .update({ status: "resolved" })
      .eq("id", findingId)
      .eq("user_id", session.userId);
  }

  return NextResponse.json({ success: true });
}
