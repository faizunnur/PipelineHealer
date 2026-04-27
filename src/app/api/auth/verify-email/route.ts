import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSession, setSessionCookie } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  const { token } = await req.json() as { token: string };
  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

  const db = createAdminClient();

  const { data: record } = await db
    .from("email_verification_tokens")
    .select("user_id, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!record) {
    return NextResponse.json({ error: "Invalid or already used verification link." }, { status: 400 });
  }

  if (new Date(record.expires_at) < new Date()) {
    await db.from("email_verification_tokens").delete().eq("token", token);
    return NextResponse.json({ error: "This verification link has expired. Please register again." }, { status: 400 });
  }

  // Mark profile as verified
  await db.from("profiles").update({ email_verified: true }).eq("id", record.user_id);

  // Delete used token
  await db.from("email_verification_tokens").delete().eq("token", token);

  // Fetch email for session payload
  const { data: profile } = await db
    .from("profiles")
    .select("email")
    .eq("id", record.user_id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  // Auto sign-in after verification
  const sessionToken = await createSession({ userId: record.user_id, email: profile.email });
  const response = NextResponse.json({ ok: true });
  setSessionCookie(response, sessionToken);
  return response;
}
