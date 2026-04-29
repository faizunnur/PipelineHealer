import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto/decrypt";
import { setupGitHubWebhook, setupGitLabWebhook } from "@/lib/webhooks/auto-setup";
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

  const { data: integration } = await db
    .from("integrations")
    .select("id, webhook_secret, encrypted_token, token_iv, token_tag")
    .eq("id", parsed.data.integrationId)
    .eq("user_id", session.userId)
    .single();

  if (!integration) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  }

  const { data: pipeline, error } = await db
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

  // Auto-setup webhook (non-blocking — pipeline creation already succeeded)
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const token = decrypt({ encrypted: integration.encrypted_token, iv: integration.token_iv, tag: integration.token_tag });

  const webhookResult =
    parsed.data.provider === "github"
      ? await setupGitHubWebhook(token, parsed.data.repoFullName, integration.webhook_secret, appUrl)
      : await setupGitLabWebhook(token, parsed.data.repoFullName, integration.webhook_secret, appUrl);

  // Persist webhook status
  if (webhookResult?.status) {
    await db.from("pipelines").update({ webhook_status: webhookResult.status }).eq("id", pipeline.id);
  }

  return NextResponse.json({ pipeline, webhookResult }, { status: 201 });
}
