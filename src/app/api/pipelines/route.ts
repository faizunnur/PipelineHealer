import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const createSchema = z.object({
  integrationId: z.string().uuid(),
  repoFullName: z.string().min(1),
  pipelineName: z.string().min(1),
  defaultBranch: z.string().default("main"),
  provider: z.enum(["github", "gitlab"]),
});

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("pipelines")
    .select(
      `id, provider, repo_full_name, pipeline_name, default_branch,
       is_monitored, last_status, created_at, updated_at,
       pipeline_runs(id, status, branch, commit_sha, created_at)`
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1, { referencedTable: "pipeline_runs" });

  return NextResponse.json({ pipelines: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Verify integration ownership
  const { data: integration } = await supabase
    .from("integrations")
    .select("id")
    .eq("id", parsed.data.integrationId)
    .eq("user_id", user.id)
    .single();

  if (!integration) {
    return NextResponse.json(
      { error: "Integration not found" },
      { status: 404 }
    );
  }

  const { data, error } = await supabase
    .from("pipelines")
    .insert({
      user_id: user.id,
      integration_id: parsed.data.integrationId,
      provider: parsed.data.provider,
      repo_full_name: parsed.data.repoFullName,
      pipeline_name: parsed.data.pipelineName,
      default_branch: parsed.data.defaultBranch,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ pipeline: data }, { status: 201 });
}
