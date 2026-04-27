import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const createSchema = z.object({
  integrationId: z.string().uuid(),
  repoFullName: z.string().min(1),
  pipelineName: z.string().min(1),
  defaultBranch: z.string().default("main"),
  provider: z.enum(["github", "gitlab"]),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();
  const { data } = await db
    .from("pipelines")
    .select(
      `id, provider, repo_full_name, pipeline_name, default_branch,
       is_monitored, last_status, created_at, updated_at,
       pipeline_runs(id, status, branch, commit_sha, created_at)`
    )
    .eq("user_id", session.userId)
    .order("updated_at", { ascending: false })
    .limit(1, { referencedTable: "pipeline_runs" });

  return NextResponse.json({ pipelines: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 });
  }

  const db = createAdminClient();

  // Verify integration ownership
  const { data: integration } = await db
    .from("integrations")
    .select("id")
    .eq("id", parsed.data.integrationId)
    .eq("user_id", session.userId)
    .single();

  if (!integration) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  }

  const { data, error } = await db
    .from("pipelines")
    .insert({
      user_id: session.userId,
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
