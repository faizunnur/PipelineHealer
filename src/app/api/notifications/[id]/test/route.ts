import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotifications } from "@/lib/notifications/sender";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = createAdminClient();

  const { data: channel } = await db
    .from("notification_channels")
    .select("id, user_id")
    .eq("id", id)
    .eq("user_id", session.userId)
    .single();

  if (!channel) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await sendNotifications(session.userId, {
      event: "healing_applied",
      title: "Test Notification from PipelineHealer",
      message: "This is a test notification. If you see this, your notification channel is working correctly!",
      repoName: "octocat/hello-world",
      fields: [
        { name: "Status", value: "✅ Working", inline: true },
        { name: "Channel", value: "Test", inline: true },
      ],
      actionUrl: "/dashboard",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
