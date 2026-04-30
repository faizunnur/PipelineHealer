import Anthropic from "@anthropic-ai/sdk";
import { CHAT_SYSTEM_PROMPT } from "./prompts";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function* streamChatResponse(
  messages: ChatMessage[],
  pipelineContext?: string
): AsyncGenerator<string> {
  const systemText = pipelineContext
    ? `${CHAT_SYSTEM_PROMPT}\n\nUser's pipeline context:\n${pipelineContext}`
    : CHAT_SYSTEM_PROMPT;

  // Keep last 10 messages to limit tokens
  const trimmed = messages.slice(-10);

  // Add cache_control to the second-to-last message so the growing conversation
  // history gets cached once it reaches Haiku 4.5's 4096-token minimum
  const messagesForRequest: Anthropic.MessageParam[] = trimmed.map(
    (msg, idx) => {
      if (idx === trimmed.length - 2 && trimmed.length >= 2) {
        return {
          role: msg.role,
          content: [
            {
              type: "text",
              text: msg.content,
              cache_control: { type: "ephemeral" },
            },
          ],
        };
      }
      return { role: msg.role, content: msg.content };
    }
  );

  const stream = await client.messages.stream({
    model: "claude-haiku-4-5",
    max_tokens: 2048,
    // Cache the system prompt — activates once total prefix exceeds 4096 tokens
    system: [
      {
        type: "text",
        text: systemText,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: messagesForRequest,
  });

  for await (const chunk of stream) {
    if (
      chunk.type === "content_block_delta" &&
      chunk.delta.type === "text_delta"
    ) {
      yield chunk.delta.text;
    }
  }
}

export async function getChatUsage(messages: ChatMessage[]): Promise<number> {
  // Estimate tokens: ~4 chars per token
  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  return Math.ceil(totalChars / 4);
}
