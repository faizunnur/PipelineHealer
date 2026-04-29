import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto/decrypt";
import { setupGitHubWebhook, setupGitLabWebhook } from "@/lib/webhooks/auto-setup";

// DELETE /api/pipelines/[id] — delete pipeline and all related data
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = createAdminClient();

  // Confirm ownership
  const { data: pipeline } = await db
    .from("pipelines")
    .select("id")
    .eq("id", id)
    .eq("user_id", session.userId)
    .single();

  if (!pipeline) return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });

  // Delete the pipeline — CASCADE handles all related rows
  // (migration 0011 adds CASCADE to healing_events and rollback_events)
  const { error } = await db.from("pipelines").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// POST /api/pipelines/[id]/webhook — retry webhook setup
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = createAdminClient();

  const { data: pipeline } = await db
    .from("pipelines")
    .select("repo_full_name, provider, default_branch, integrations(webhook_secret, encrypted_token, token_iv, token_tag)")
    .eq("id", id)
    .eq("user_id", session.userId)
    .single();

  if (!pipeline) return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });

  const intg = pipeline.integrations as {
    webhook_secret: string; encrypted_token: string; token_iv: string; token_tag: string;
  } | null;
  if (!intg) return NextResponse.json({ error: "Integration not found" }, { status: 404 });

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const token = decrypt({ encrypted: intg.encrypted_token, iv: intg.token_iv, tag: intg.token_tag });

  const result =
    pipeline.provider === "github"
      ? await setupGitHubWebhook(token, pipeline.repo_full_name, intg.webhook_secret, appUrl)
      : await setupGitLabWebhook(token, pipeline.repo_full_name, intg.webhook_secret, appUrl);

  // Persist updated webhook status
  if (result?.status) {
    await db.from("pipelines").update({ webhook_status: result.status }).eq("id", id);
  }

  return NextResponse.json({ result });
}
