import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { email } = await req.json() as { email: string };
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/auth/callback?next=/reset-password`,
  });

  // Always return success — never reveal whether the email exists
  if (error) console.error("[forgot-password]", error.message);
  return NextResponse.json({ ok: true });
}
