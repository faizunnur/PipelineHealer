import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto/decrypt";
import { fetchWorkflowContent } from "@/lib/github/workflow-updater";
import { analyzePerformance } from "@/lib/optimizer/analyzer";

const COMMON_WORKFLOW_PATHS = [
  ".github/workflows/ci.yml", ".github/workflows/main.yml",
  ".github/workflows/build.yml", ".github/workflows/deploy.yml",
  ".github/workflows/test.yml", ".gitlab-ci.yml",
];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pipelineId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pipelineId } = await params;
  const db = createAdminClient();

  // Check token budget
  const { data: profile } = await db
    .from("profiles")
    .select("tokens_used, token_budget")
    .eq("id", session.userId)
    .single();
  if (profile && profile.tokens_used >= profile.token_budget) {
    return NextResponse.json({ error: "Token budget exceeded" }, { status: 429 });
  }

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

  let workflowContent: string | null = null;
  let workflowPath = "";
  for (const path of COMMON_WORKFLOW_PATHS) {
    workflowContent = await fetchWorkflowContent(token, pipeline.repo_full_name, path);
    if (workflowContent) { workflowPath = path; break; }
  }

  if (!workflowContent) {
    return NextResponse.json({ error: "No workflow file found. Make sure your repository has a .github/workflows/ file." }, { status: 404 });
  }

  const { suggestions, tokens_used } = await analyzePerformance(
    workflowContent, pipeline.provider as "github" | "gitlab", pipeline.repo_full_name
  );

  await db.from("performance_suggestions").delete().eq("pipeline_id", pipelineId);

  if (suggestions.length > 0) {
    await db.from("performance_suggestions").insert(
      suggestions.map((s) => ({
        pipeline_id: pipelineId,
        user_id: session.userId,
        category: s.category,
        title: s.title,
        description: s.description,
        estimated_saving: s.estimated_saving,
        original_code: s.original_code,
        optimized_code: s.optimized_code,
        ai_tokens_used: Math.round(tokens_used / suggestions.length),
        status: "pending",
      }))
    );
  }

  await db.from("token_usage_log").insert({
    user_id: session.userId, feature: "healing", model: "claude-sonnet-4-6",
    tokens_in: Math.floor(tokens_used * 0.7), tokens_out: Math.floor(tokens_used * 0.3),
  });
  await db.rpc("increment_token_usage", { p_user_id: session.userId, p_amount: tokens_used });

  return NextResponse.json({ suggestions, workflow_path: workflowPath, tokens_used });
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
    .from("performance_suggestions")
    .select("*")
    .eq("pipeline_id", pipelineId)
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false });

  return NextResponse.json({ suggestions: data ?? [] });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ pipelineId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pipelineId } = await params;
  const body = await req.json();
  const db = createAdminClient();

  await db
    .from("performance_suggestions")
    .update({ status: body.status })
    .eq("id", body.id)
    .eq("user_id", session.userId);

  return NextResponse.json({ ok: true });
}
