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
${errorExcerpt.slice(0, 3000)}
\`\`\`${contextBlock}

Analyze this failure and provide the JSON fix.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: HEALER_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const tokensUsed =
    response.usage.input_tokens + response.usage.output_tokens;
  const rawText =
    response.content[0].type === "text" ? response.content[0].text : "{}";

  let parsed: Omit<HealingAnalysis, "tokens_used">;
  try {
    // Strip any accidental markdown code fences
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

  return { ...parsed, tokens_used: tokensUsed };
}
