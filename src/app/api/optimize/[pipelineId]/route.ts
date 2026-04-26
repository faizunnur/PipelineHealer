import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pipelineId } = await params;

  // Check token budget
  const { data: profile } = await supabase
    .from("profiles").select("tokens_used,token_budget").eq("id", user.id).single();
  if (profile && profile.tokens_used >= profile.token_budget) {
    return NextResponse.json({ error: "Token budget exceeded" }, { status: 429 });
  }

  const { data: pipeline } = await supabase
    .from("pipelines")
    .select("*, integrations(encrypted_token, token_iv, token_tag)")
    .eq("id", pipelineId).eq("user_id", user.id).single();

  if (!pipeline) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const integration = pipeline.integrations as {
    encrypted_token: string; token_iv: string; token_tag: string;
  } | null;
  if (!integration) return NextResponse.json({ error: "Integration not found" }, { status: 400 });

  const token = decrypt({ encrypted: integration.encrypted_token, iv: integration.token_iv, tag: integration.token_tag });

  // Find workflow file
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

  const adminClient = createAdminClient();
  // Delete old suggestions for this pipeline
  await adminClient.from("performance_suggestions").delete().eq("pipeline_id", pipelineId);

  // Insert new suggestions
  if (suggestions.length > 0) {
    await adminClient.from("performance_suggestions").insert(
      suggestions.map((s) => ({
        pipeline_id: pipelineId,
        user_id: user.id,
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

  // Log token usage
  await adminClient.from("token_usage_log").insert({
    user_id: user.id, feature: "healing", model: "claude-sonnet-4-6",
    tokens_in: Math.floor(tokens_used * 0.7), tokens_out: Math.floor(tokens_used * 0.3),
  });
  await supabase.rpc("increment_token_usage", { p_user_id: user.id, p_amount: tokens_used });

  return NextResponse.json({ suggestions, workflow_path: workflowPath, tokens_used });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pipelineId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pipelineId } = await params;
  const { data } = await supabase
    .from("performance_suggestions")
    .select("*").eq("pipeline_id", pipelineId).eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ suggestions: data ?? [] });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ pipelineId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pipelineId } = await params;
  const body = await req.json();

  await supabase.from("performance_suggestions")
    .update({ status: body.status })
    .eq("id", body.id).eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
