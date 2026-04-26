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
  const systemPrompt = pipelineContext
    ? `${CHAT_SYSTEM_PROMPT}\n\nUser's pipeline context:\n${pipelineContext}`
    : CHAT_SYSTEM_PROMPT;

  // Keep last 10 messages to limit tokens
  const trimmedMessages = messages.slice(-10);

  const stream = await client.messages.stream({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: systemPrompt,
    messages: trimmedMessages,
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
