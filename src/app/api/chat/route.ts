import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { streamChatResponse } from "@/lib/claude/chatbot";
import { z } from "zod";

const schema = z.object({
  sessionId: z.string().uuid().optional(),
  message: z.string().min(1).max(4000),
  pipelineContext: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();

  // Check token budget
  const { data: profile } = await db
    .from("profiles")
    .select("tokens_used, token_budget, is_suspended")
    .eq("id", session.userId)
    .single();

  if (profile?.is_suspended) {
    return NextResponse.json({ error: "Account suspended" }, { status: 403 });
  }

  if (profile && profile.tokens_used >= profile.token_budget) {
    return NextResponse.json(
      { error: "Token budget exceeded. Please upgrade your plan." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { sessionId, message, pipelineContext } = parsed.data;

  // Get or create session
  let session_id = sessionId;
  if (!session_id) {
    const { data: newSession } = await db
      .from("chat_sessions")
      .insert({ user_id: session.userId, title: message.slice(0, 60) })
      .select("id")
      .single();
    session_id = newSession?.id;
  }

  if (!session_id) {
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }

  // Save user message
  await db.from("chat_messages").insert({ session_id, role: "user", content: message });

  // Get conversation history (last 10 messages)
  const { data: history } = await db
    .from("chat_messages")
    .select("role, content")
    .eq("session_id", session_id)
    .order("created_at", { ascending: true })
    .limit(10);

  const messages = (history ?? []).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let fullResponse = "";
      let tokensUsed = 0;

      try {
        for await (const chunk of streamChatResponse(messages, pipelineContext)) {
          fullResponse += chunk;
          controller.enqueue(encoder.encode(chunk));
        }

        tokensUsed = Math.ceil((message.length + fullResponse.length) / 4);

        await db.from("chat_messages").insert({
          session_id,
          role: "assistant",
          content: fullResponse,
          tokens_used: tokensUsed,
        });

        await db.from("token_usage_log").insert({
          user_id: session.userId,
          feature: "chat",
          model: "claude-haiku-4-5-20251001",
          tokens_in: Math.ceil(message.length / 4),
          tokens_out: Math.ceil(fullResponse.length / 4),
        });

        await db.rpc("increment_token_usage", {
          p_user_id: session.userId,
          p_amount: tokensUsed,
        });
      } catch (err) {
        controller.enqueue(encoder.encode(`\n\nError: ${String(err)}`));
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "X-Session-Id": session_id,
    },
  });
}
