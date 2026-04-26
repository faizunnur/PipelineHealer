import { createAdminClient } from "@/lib/supabase/admin";
import { createHash } from "crypto";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Normalize an error to a canonical signature for deduplication
export function normalizeError(errorExcerpt: string): string {
  return errorExcerpt
    .replace(/\/home\/\w+\//g, "/user/")
    .replace(/\/tmp\/[\w.-]+/g, "/tmp/X")
    .replace(/\b\d+\.\d+\.\d+\b/g, "X.X.X")
    .replace(/line \d+/gi, "line N")
    .replace(/:[0-9]+/g, ":N")
    .replace(/0x[0-9a-f]+/gi, "0xN")
    .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, "UUID")
    .replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g, "TIMESTAMP")
    .toLowerCase()
    .trim()
    .slice(0, 500);
}

export function hashError(normalized: string): string {
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

export async function detectAndRecordPattern(
  userId: string,
  repoName: string,
  errorExcerpt: string
): Promise<void> {
  const normalized = normalizeError(errorExcerpt);
  const hash = hashError(normalized);
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("failure_patterns")
    .select("id, affected_pipelines, occurrence_count")
    .eq("user_id", userId)
    .eq("error_hash", hash)
    .single();

  if (existing) {
    const repos = Array.from(new Set([...existing.affected_pipelines, repoName]));
    await supabase
      .from("failure_patterns")
      .update({
        affected_pipelines: repos,
        occurrence_count: existing.occurrence_count + 1,
        last_seen_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    // Generate a title using Claude (only for new patterns, very cheap with Haiku)
    let patternName = "Recurring Pipeline Failure";
    try {
      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 50,
        messages: [{
          role: "user",
          content: `Give a 5-10 word title for this CI/CD error (just the title, no punctuation):\n${errorExcerpt.slice(0, 200)}`,
        }],
      });
      if (response.content[0].type === "text") {
        patternName = response.content[0].text.trim();
      }
    } catch { /* use default title */ }

    await supabase.from("failure_patterns").insert({
      user_id: userId,
      error_hash: hash,
      normalized_error: normalized,
      pattern_name: patternName,
      affected_pipelines: [repoName],
      occurrence_count: 1,
    });
  }
}

export async function getPatternInsight(patternId: string, userId: string): Promise<string> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("failure_patterns")
    .select("*")
    .eq("id", patternId)
    .eq("user_id", userId)
    .single();

  if (!data) return "";

  if (data.ai_insight) return data.ai_insight;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    messages: [{
      role: "user",
      content: `This CI/CD error has occurred ${data.occurrence_count} times across ${data.affected_pipelines.length} repos:\n\n${data.normalized_error}\n\nIn 2-3 sentences, explain the likely root cause and the best permanent fix.`,
    }],
  });

  const insight = response.content[0].type === "text" ? response.content[0].text.trim() : "";

  await supabase.from("failure_patterns").update({ ai_insight: insight }).eq("id", patternId);

  return insight;
}
