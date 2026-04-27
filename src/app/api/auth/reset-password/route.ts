import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPassword } from "@/lib/auth/password";

export async function POST(req: NextRequest) {
  const { token, password } = await req.json() as { token: string; password: string };

  if (!token) return NextResponse.json({ error: "Reset token missing" }, { status: 400 });
  if (!password || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const db = createAdminClient();

  // Look up token
  const { data: record } = await db
    .from("password_reset_tokens")
    .select("email, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!record) {
    return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
  }

  if (new Date(record.expires_at) < new Date()) {
    await db.from("password_reset_tokens").delete().eq("token", token);
    return NextResponse.json({ error: "Reset link has expired. Please request a new one." }, { status: 400 });
  }

  const password_hash = await hashPassword(password);

  const { error } = await db
    .from("profiles")
    .update({ password_hash })
    .eq("email", record.email);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Delete used token
  await db.from("password_reset_tokens").delete().eq("token", token);

  return NextResponse.json({ ok: true });
}
