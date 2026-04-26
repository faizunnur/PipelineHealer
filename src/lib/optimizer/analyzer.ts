import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const OPTIMIZER_SYSTEM = `You are a CI/CD pipeline performance expert. Analyze GitHub Actions or GitLab CI YAML workflow files and identify specific, actionable optimizations.

Respond with a JSON array of suggestions. Each suggestion must follow this exact structure:
{
  "category": "parallelism" | "caching" | "matrix" | "splitting" | "runner" | "misc",
  "title": "Short descriptive title",
  "description": "Why this is slow/inefficient and the impact",
  "estimated_saving": "Human readable estimate e.g. '~3 min per run'",
  "original_code": "The exact YAML snippet to replace (null if addition only)",
  "optimized_code": "The replacement YAML (null if removal only)"
}

Focus on:
1. Missing dependency caching (npm, pip, maven, gradle, cargo, go modules)
2. Jobs that run sequentially but could be parallel (needs: not set when it could be)
3. Matrix builds that could be parallelized
4. Slow steps (apt-get without cache, large docker pulls without layer caching)
5. Runner size mismatches (using large runner for trivial tasks)
6. Missing --no-install-recommends, --quiet flags on apt-get
7. Running full test suite when only changed files need testing
8. Redundant checkout steps
9. Missing timeout-minutes (can cause wasted runner minutes)
10. Docker builds not using BuildKit or layer caching

Return only the JSON array, no markdown, no extra text.`;

export interface PerformanceSuggestion {
  category: string;
  title: string;
  description: string;
  estimated_saving: string;
  original_code: string | null;
  optimized_code: string | null;
}

export async function analyzePerformance(
  workflowContent: string,
  provider: "github" | "gitlab",
  repoName: string
): Promise<{ suggestions: PerformanceSuggestion[]; tokens_used: number }> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: OPTIMIZER_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Provider: ${provider}\nRepository: ${repoName}\n\nWorkflow file:\n\`\`\`yaml\n${workflowContent.slice(0, 6000)}\n\`\`\`\n\nProvide optimization suggestions as JSON array.`,
      },
    ],
  });

  const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;
  const rawText = response.content[0].type === "text" ? response.content[0].text : "[]";

  let suggestions: PerformanceSuggestion[] = [];
  try {
    const cleaned = rawText.replace(/^```json?\n?|```$/gm, "").trim();
    suggestions = JSON.parse(cleaned);
    if (!Array.isArray(suggestions)) suggestions = [];
  } catch {
    suggestions = [];
  }

  return { suggestions, tokens_used: tokensUsed };
}
