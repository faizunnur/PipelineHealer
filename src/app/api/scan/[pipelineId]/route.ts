import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto/decrypt";
import { fetchWorkflowContent } from "@/lib/github/workflow-updater";
import { scanWorkflow } from "@/lib/scanner/security-rules";
import { sendNotifications } from "@/lib/notifications/sender";

const WORKFLOW_PATHS = [
  ".github/workflows/ci.yml", ".github/workflows/main.yml",
  ".github/workflows/build.yml", ".github/workflows/deploy.yml",
  ".github/workflows/release.yml", ".gitlab-ci.yml",
];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pipelineId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pipelineId } = await params;
  const db = createAdminClient();

  const { data: pipeline } = await db
    .from("pipelines")
    .select("*, integrations(encrypted_token, token_iv, token_tag)")
    .eq("id", pipelineId)
    .eq("user_id", session.userId)
    .single();

  if (!pipeline) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const integration = pipeline.integrations as {
    encrypted_token: string; token_iv: string; token_tag: string;
  } | null;
  if (!integration) return NextResponse.json({ error: "Integration not found" }, { status: 400 });

  const token = decrypt({ encrypted: integration.encrypted_token, iv: integration.token_iv, tag: integration.token_tag });

  await db.from("secret_scan_results").delete().eq("pipeline_id", pipelineId);

  const allFindings = [];
  for (const path of WORKFLOW_PATHS) {
    const content = await fetchWorkflowContent(token, pipeline.repo_full_name, path);
    if (!content) continue;
    const findings = scanWorkflow(content, path);
    allFindings.push(...findings);
  }

  if (allFindings.length > 0) {
    await db.from("secret_scan_results").insert(
      allFindings.map((f) => ({ ...f, pipeline_id: pipelineId, user_id: session.userId, status: "open" }))
    );

    const criticalCount = allFindings.filter((f) => f.severity === "critical").length;
    const highCount = allFindings.filter((f) => f.severity === "high").length;
    if (criticalCount > 0 || highCount > 0) {
      await sendNotifications(session.userId, {
        event: "security_alert",
        title: `Security Alert: ${pipeline.repo_full_name}`,
        message: `Found ${criticalCount} critical and ${highCount} high severity issues in your pipeline workflow files.`,
        actionUrl: `/scanner`,
        fields: [
          { name: "Critical", value: String(criticalCount), inline: true },
          { name: "High", value: String(highCount), inline: true },
          { name: "Total Issues", value: String(allFindings.length), inline: true },
        ],
      });
    }
  }

  return NextResponse.json({ findings: allFindings, total: allFindings.length });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pipelineId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pipelineId } = await params;
  const db = createAdminClient();

  const { data } = await db
    .from("secret_scan_results")
    .select("*")
    .eq("pipeline_id", pipelineId)
    .eq("user_id", session.userId)
    .order("severity", { ascending: true });

  return NextResponse.json({ findings: data ?? [] });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ pipelineId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { pipelineId } = await params;
  const db = createAdminClient();

  await db
    .from("secret_scan_results")
    .update({ status: body.status })
    .eq("id", body.id)
    .eq("user_id", session.userId);

  return NextResponse.json({ ok: true });
}
