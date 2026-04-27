import { NextResponse } from "next/server";
import { getSession, clearSessionCookie } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

// DELETE /api/account — permanently delete the authenticated user's account
export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();

  // Delete profile (cascades to all related data via ON DELETE CASCADE)
  const { error } = await db
    .from("profiles")
    .delete()
    .eq("id", session.userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
