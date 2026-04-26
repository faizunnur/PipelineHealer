import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

import { decrypt } from "@/lib/crypto/decrypt";
import { auditWorkflow } from "@/lib/env-audit/auditor";

// POST /api/env-audit/[pipelineId] — run env audit on all workflow files
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ pipelineId: string }> }
) {
  const { pipelineId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: pipeline } = await admin
    .from("pipelines")
    .select("id, repo_full_name, provider, integrations(encrypted_token, token_iv, token_tag)")
    .eq("id", pipelineId)
    .eq("user_id", user.id)
    .single();

  if (!pipeline) return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });

  const pipelineData = pipeline as {
    id: string;
    repo_full_name: string;
    provider: string;
    integrations: { encrypted_token: string; token_iv: string; token_tag: string };
  };

  const plainToken = decrypt({
    encrypted: pipelineData.integrations.encrypted_token,
    iv: pipelineData.integrations.token_iv,
    tag: pipelineData.integrations.token_tag,
  });

  // Fetch workflow files from GitHub
  const [owner, repo] = pipelineData.repo_full_name.split("/");
  const allFindings: Array<{
    pipeline_id: string; user_id: string; file_path: string;
    severity: string; rule: string; title: string; description: string;
    evidence: string; line_number: number | null; recommendation: string;
  }> = [];

  try {
    // List .github/workflows directory
    const listRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/.github/workflows`,
      {
        headers: {
          Authorization: `Bearer ${plainToken}`,
          Accept: "application/vnd.github+json",
        },
      }
    );

    if (!listRes.ok) {
      return NextResponse.json({ error: "Could not fetch workflow files. Check repo permissions." }, { status: 400 });
    }

    const files = await listRes.json();
    const yamlFiles = (files as Array<{ name: string; download_url: string; path: string }>)
      .filter((f) => f.name.endsWith(".yml") || f.name.endsWith(".yaml"));

    for (const file of yamlFiles) {
      const contentRes = await fetch(file.download_url, {
        headers: { Authorization: `Bearer ${plainToken}` },
      });
      if (!contentRes.ok) continue;
      const content = await contentRes.text();
      const result = auditWorkflow(file.path, content);

      for (const finding of result.findings) {
        allFindings.push({
          pipeline_id: pipelineId,
          user_id: user.id,
          file_path: file.path,
          severity: finding.severity,
          rule: finding.rule,
          title: finding.title,
          description: finding.description,
          evidence: finding.evidence,
          line_number: finding.line ?? null,
          recommendation: finding.recommendation,
        });
      }
    }

    // Clear old findings and insert new ones
    await admin.from("env_var_audits").delete().eq("pipeline_id", pipelineId);
    if (allFindings.length > 0) {
      await admin.from("env_var_audits").insert(allFindings);
    }

    return NextResponse.json({
      scanned: yamlFiles.length,
      totalFindings: allFindings.length,
      critical: allFindings.filter((f) => f.severity === "critical").length,
      high: allFindings.filter((f) => f.severity === "high").length,
      medium: allFindings.filter((f) => f.severity === "medium").length,
      low: allFindings.filter((f) => f.severity === "low").length,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// GET /api/env-audit/[pipelineId] — get existing findings
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ pipelineId: string }> }
) {
  const { pipelineId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: findings } = await admin
    .from("env_var_audits")
    .select("*")
    .eq("pipeline_id", pipelineId)
    .eq("user_id", user.id)
    .order("severity", { ascending: true }); // critical first alphabetically

  return NextResponse.json({ findings: findings ?? [] });
}

// PATCH /api/env-audit/[pipelineId] — mark finding as resolved
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ pipelineId: string }> }
) {
  const { pipelineId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { findingId, resolved } = await request.json();
  const admin = createAdminClient();

  await admin
    .from("env_var_audits")
    .update({ resolved: resolved ?? true, resolved_at: resolved ? new Date().toISOString() : null })
    .eq("id", findingId)
    .eq("pipeline_id", pipelineId)
    .eq("user_id", user.id);

  return NextResponse.json({ success: true });
}
