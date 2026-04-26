import { createAdminClient } from "@/lib/supabase/admin";

// Regex patterns that indicate test results in log output
const TEST_FAILURE_PATTERNS = [
  /FAIL\s+([\w/.-]+\.(?:test|spec)\.[jt]sx?)/g,
  /✕\s+(.+)/g,
  /✗\s+(.+)/g,
  /FAILED\s+([\w\s]+)\s*\(/g,
  /●\s+(.+)/g,  // Jest
  /\d+ failed.*\n.*?([\w/.-]+\.(?:test|spec)\.[jt]sx?)/g,
  /AssertionError.*?(test_[\w]+|[\w]+_test)/g,
  /FAILED\s+([\w.]+)::([\w]+)/g,   // Python pytest
  /--- FAIL:\s+([\w/]+)/g,           // Go
];

const TEST_PASS_PATTERNS = [
  /PASS\s+([\w/.-]+\.(?:test|spec)\.[jt]sx?)/g,
  /✓\s+(.+)/g,
  /✔\s+(.+)/g,
  /ok\s+([\w/.-]+\.(?:test|spec)\.[jt]sx?)/g,
];

export interface TestResult {
  name: string;
  passed: boolean;
}

export function extractTestResults(logOutput: string): TestResult[] {
  const results: TestResult[] = [];
  const seen = new Set<string>();

  for (const pattern of TEST_FAILURE_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(logOutput)) !== null) {
      const name = (match[2] ?? match[1]).trim();
      if (name && !seen.has(name)) {
        results.push({ name, passed: false });
        seen.add(name);
      }
    }
  }

  for (const pattern of TEST_PASS_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(logOutput)) !== null) {
      const name = match[1].trim();
      if (name && !seen.has(name)) {
        results.push({ name, passed: true });
        seen.add(name);
      }
    }
  }

  return results;
}

export async function recordTestResults(
  pipelineId: string,
  userId: string,
  results: TestResult[]
): Promise<void> {
  if (!results.length) return;
  const supabase = createAdminClient();

  for (const result of results) {
    const { data: existing } = await supabase
      .from("flaky_tests")
      .select("id, failure_count, pass_count, total_runs")
      .eq("pipeline_id", pipelineId)
      .eq("test_name", result.name)
      .single();

    if (existing) {
      await supabase
        .from("flaky_tests")
        .update({
          failure_count: existing.failure_count + (result.passed ? 0 : 1),
          pass_count: existing.pass_count + (result.passed ? 1 : 0),
          total_runs: existing.total_runs + 1,
          last_seen_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("flaky_tests").insert({
        pipeline_id: pipelineId,
        user_id: userId,
        test_name: result.name,
        failure_count: result.passed ? 0 : 1,
        pass_count: result.passed ? 1 : 0,
        total_runs: 1,
      });
    }
  }
}

export function isFlakyError(errorExcerpt: string): boolean {
  const flakyKeywords = [
    /timeout/i,
    /race condition/i,
    /flaky/i,
    /intermittent/i,
    /connection reset/i,
    /ECONNRESET/,
    /socket hang up/i,
    /port already in use/i,
    /EADDRINUSE/,
  ];
  return flakyKeywords.some((kw) => kw.test(errorExcerpt));
}
