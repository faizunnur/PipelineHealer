import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a CI/CD security expert. Analyze security findings and return precise YAML fixes.

Respond with valid JSON only, no markdown, no extra text:
{
  "explanation": "One sentence explaining the vulnerability and the fix.",
  "original_code": "exact yaml snippet to replace (must match file exactly), or null",
  "fixed_code": "replacement yaml snippet, or null",
  "confidence": "high|medium|low"
}

Rules:
- Keep original_code and fixed_code minimal — only changed lines ± 1 line of context
- original_code must EXACTLY match the content in the file — copy from the evidence field
- Set confidence "low" and original_code/fixed_code null when you cannot determine the exact snippet
- For missing permissions blocks: original_code is the job name line, fixed_code adds the permissions block after it
- Never include secrets or credentials in the fix`;

export interface AiFixResult {
  explanation: string;
  original_code: string | null;
  fixed_code: string | null;
  confidence: "high" | "medium" | "low";
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();

  const { data: profile } = await db
    .from("profiles")
    .select("tokens_used, token_budget, is_suspended")
    .eq("id", session.userId)
    .single();

  if (profile?.is_suspended)
    return NextResponse.json({ error: "Account suspended" }, { status: 403 });
  if (profile && profile.tokens_used >= profile.token_budget)
    return NextResponse.json({ error: "Token budget exceeded. Please upgrade your plan." }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const { finding } = body as { finding: Record<string, unknown> };
  if (!finding) return NextResponse.json({ error: "Missing finding" }, { status: 400 });

  const ruleId = (finding.rule_id ?? finding.rule ?? "unknown") as string;
  const lines = [
    `Repository security finding:`,
    `Rule: ${ruleId}  |  Severity: ${String(finding.severity).toUpperCase()}`,
    `File: ${finding.file_path}${finding.line_number ? `  |  Line: ${finding.line_number}` : ""}`,
    `Title: ${finding.title}`,
    `Description: ${finding.description}`,
  ];
  if (finding.evidence) lines.push(`\nEvidence (exact code from file):\n${finding.evidence}`);
  lines.push(`\nRecommendation: ${finding.recommendation}`);
  lines.push(`\nProvide the JSON fix. Use the evidence as the basis for original_code.`);

  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: lines.join("\n") }],
  });

  const tokensUsed = (response.usage.input_tokens ?? 0) + (response.usage.output_tokens ?? 0);

  await db.rpc("increment_token_usage", { p_user_id: session.userId, p_amount: tokensUsed });
  await db.from("token_usage_log").insert({
    user_id: session.userId,
    feature: "ai-fix",
    model: "claude-haiku-4-5",
    tokens_in: response.usage.input_tokens ?? 0,
    tokens_out: response.usage.output_tokens ?? 0,
  });

  const rawText = response.content[0].type === "text" ? response.content[0].text : "{}";
  let result: AiFixResult;
  try {
    const cleaned = rawText.replace(/^```json?\n?|```$/gm, "").trim();
    result = JSON.parse(cleaned);
  } catch {
    result = {
      explanation: rawText,
      original_code: null,
      fixed_code: null,
      confidence: "low",
    };
  }

  return NextResponse.json(result);
}
