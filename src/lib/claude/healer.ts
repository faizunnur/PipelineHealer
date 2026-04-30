import Anthropic from "@anthropic-ai/sdk";
import { HEALER_SYSTEM_PROMPT } from "./prompts";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface HealingAnalysis {
  reason: string;
  solution: string;
  file_path: string | null;
  original_code: string | null;
  fixed_code: string | null;
  confidence: "high" | "medium" | "low";
  tokens_used: number;
}

// CI logs put errors at the END — take the tail for better signal
function extractRelevantLogs(log: string, maxChars = 3000): string {
  if (log.length <= maxChars) return log;
  const lines = log.split("\n").filter((l) => l.trim());
  let result = "";
  for (let i = lines.length - 1; i >= 0; i--) {
    const candidate = lines[i] + "\n" + result;
    if (candidate.length > maxChars) break;
    result = candidate;
  }
  return result.trim() || log.slice(-maxChars);
}

export async function analyzeAndHeal(
  errorExcerpt: string,
  workflowContext?: {
    provider: "github" | "gitlab";
    workflowContent?: string;
    repoName: string;
    jobName: string;
    branch: string;
  }
): Promise<HealingAnalysis> {
  const contextBlock = workflowContext?.workflowContent
    ? `\n\nCurrent workflow file (${workflowContext.provider === "github" ? ".github/workflows" : ".gitlab-ci.yml"}):\n\`\`\`yaml\n${workflowContext.workflowContent.slice(0, 3000)}\n\`\`\``
    : "";

  const userMessage = `Repository: ${workflowContext?.repoName ?? "unknown"}
Provider: ${workflowContext?.provider ?? "github"}
Branch: ${workflowContext?.branch ?? "main"}
Failed Job: ${workflowContext?.jobName ?? "unknown"}

Error Excerpt (last lines of failed job log):
\`\`\`
${extractRelevantLogs(errorExcerpt)}
\`\`\`${contextBlock}

Analyze this failure and provide the JSON fix.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    // Array format enables cache_control — caches once total prefix reaches Sonnet 4.6's 2048-token minimum
    system: [
      {
        type: "text",
        text: HEALER_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMessage }],
  });

  const tokensUsed =
    (response.usage.input_tokens ?? 0) +
    (response.usage.output_tokens ?? 0) -
    ((response.usage.cache_read_input_tokens ?? 0) * 9) / 10; // cache reads cost ~0.1x

  const rawText =
    response.content[0].type === "text" ? response.content[0].text : "{}";

  let parsed: Omit<HealingAnalysis, "tokens_used">;
  try {
    const cleaned = rawText.replace(/^```json?\n?|```$/gm, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = {
      reason: "Failed to parse AI response. Please review the error manually.",
      solution: rawText,
      file_path: null,
      original_code: null,
      fixed_code: null,
      confidence: "low",
    };
  }

  return { ...parsed, tokens_used: Math.ceil(tokensUsed) };
}
