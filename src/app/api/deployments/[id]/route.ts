import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { action, notes, version, environment, custom_env_name } = body;

  const db = createAdminClient();

  // Verify ownership
  const { data: existing } = await db
    .from("deployments")
    .select("id, status, user_id, notes")
    .eq("id", id)
    .single();

  if (!existing) return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
  if (existing.user_id !== session.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  type DeploymentUpdate = {
    status?: "pending_approval" | "approved" | "rejected" | "deployed" | "failed";
    approved_by?: string;
    approved_at?: string;
    deployed_at?: string;
    deployed_by?: string;
    notes?: string;
    version?: string;
    environment?: "dev" | "staging" | "production" | "custom";
    custom_env_name?: string;
  };

  let update: DeploymentUpdate = {};

  if (action === "approve") {
    if (existing.status !== "pending_approval") {
      return NextResponse.json({ error: "Deployment is not pending approval" }, { status: 400 });
    }
    update = {
      status: "approved",
      approved_by: session.email ?? session.userId,
      approved_at: new Date().toISOString(),
    };
  } else if (action === "reject") {
    if (existing.status !== "pending_approval") {
      return NextResponse.json({ error: "Deployment is not pending approval" }, { status: 400 });
    }
    update = {
      status: "rejected",
      approved_by: session.email ?? session.userId,
      approved_at: new Date().toISOString(),
      notes: notes ?? (existing as { notes?: string }).notes,
    };
  } else if (action === "deploy") {
    if (!["approved", "failed"].includes(existing.status)) {
      return NextResponse.json({ error: "Deployment must be approved or failed to deploy" }, { status: 400 });
    }
    update = {
      status: "deployed",
      deployed_at: new Date().toISOString(),
      deployed_by: session.email ?? session.userId,
    };
  } else {
    // General update
    if (version !== undefined) update.version = version;
    if (notes !== undefined) update.notes = notes;
    if (environment !== undefined) update.environment = environment as "dev" | "staging" | "production" | "custom";
    if (custom_env_name !== undefined) update.custom_env_name = custom_env_name;
  }

  const { data, error } = await db
    .from("deployments")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ deployment: data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = createAdminClient();

  const { error } = await db
    .from("deployments")
    .delete()
    .eq("id", id)
    .eq("user_id", session.userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
