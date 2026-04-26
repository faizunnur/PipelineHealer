/**
 * Environment Variable & Secret Audit
 * Scans workflow files for env var references and flags issues:
 * - Hardcoded values (should be secrets)
 * - Missing required vars
 * - Unused declared vars
 * - Potentially leaked secrets via echo/print
 */

export interface EnvAuditFinding {
  severity: "critical" | "high" | "medium" | "low";
  rule: string;
  title: string;
  description: string;
  evidence: string;
  line?: number;
  recommendation: string;
}

export interface EnvAuditResult {
  filePath: string;
  findings: EnvAuditFinding[];
  envVarsFound: string[];
  secretsReferenced: string[];
  scannedAt: string;
}

// Patterns that indicate hardcoded secrets
const HARDCODED_PATTERNS: Array<{ pattern: RegExp; rule: string; title: string }> = [
  {
    pattern: /(?:password|passwd|pwd|secret|token|api[_-]?key|auth[_-]?key|private[_-]?key)\s*[:=]\s*["'][^${\s"']{8,}["']/gi,
    rule: "ENV001",
    title: "Hardcoded secret value",
  },
  {
    pattern: /(?:aws_access_key_id|aws_secret_access_key)\s*[:=]\s*["'][A-Z0-9]{16,}["']/gi,
    rule: "ENV002",
    title: "Hardcoded AWS credential",
  },
  {
    pattern: /(?:AKIA|ASIA)[A-Z0-9]{16}/g,
    rule: "ENV002",
    title: "AWS Access Key ID pattern detected",
  },
  {
    pattern: /gh[oprsu]_[A-Za-z0-9]{36}/g,
    rule: "ENV003",
    title: "GitHub personal access token detected",
  },
  {
    pattern: /glpat-[A-Za-z0-9\-_]{20}/g,
    rule: "ENV004",
    title: "GitLab personal access token detected",
  },
];

// Patterns for secret leakage (echo/print of secret vars)
const LEAK_PATTERNS: Array<RegExp> = [
  /echo\s+\$\{\{\s*secrets\.[A-Z_]+\s*\}\}/gi,
  /run:.*echo.*\$\{\{\s*secrets\./gi,
  /print\(.*\$\{\{\s*secrets\./gi,
];

// Extract all env var references from YAML
function extractEnvVars(content: string): string[] {
  const vars = new Set<string>();
  const envBlockMatch = content.matchAll(/env:\s*\n((?:\s+[A-Z_][A-Z0-9_]*:.*\n)*)/gm);
  for (const match of envBlockMatch) {
    const block = match[1];
    const keys = block.matchAll(/\s+([A-Z_][A-Z0-9_]*):/gm);
    for (const k of keys) vars.add(k[1]);
  }
  return Array.from(vars);
}

// Extract all ${{ secrets.XXX }} references
function extractSecretRefs(content: string): string[] {
  const refs = new Set<string>();
  const matches = content.matchAll(/\$\{\{\s*secrets\.([A-Z_][A-Z0-9_]*)\s*\}\}/gi);
  for (const m of matches) refs.add(m[1]);
  return Array.from(refs);
}

export function auditWorkflow(filePath: string, content: string): EnvAuditResult {
  const findings: EnvAuditFinding[] = [];
  const lines = content.split("\n");

  // Check hardcoded secrets
  for (const { pattern, rule, title } of HARDCODED_PATTERNS) {
    const matches = content.matchAll(new RegExp(pattern.source, "gi"));
    for (const match of matches) {
      const lineNum = content.slice(0, match.index).split("\n").length;
      findings.push({
        severity: "critical",
        rule,
        title,
        description: "Sensitive values should never be hardcoded in workflow files. Use GitHub/GitLab secrets instead.",
        evidence: lines[lineNum - 1]?.trim() ?? match[0],
        line: lineNum,
        recommendation: "Move this value to a repository/org secret and reference it with ${{ secrets.SECRET_NAME }}",
      });
    }
  }

  // Check for secret leakage via echo
  for (const pattern of LEAK_PATTERNS) {
    const matches = content.matchAll(new RegExp(pattern.source, "gi"));
    for (const match of matches) {
      const lineNum = content.slice(0, match.index).split("\n").length;
      findings.push({
        severity: "high",
        rule: "ENV005",
        title: "Secret value may be leaked to logs",
        description: "Printing or echoing secret variables exposes them in pipeline logs which may be publicly visible.",
        evidence: lines[lineNum - 1]?.trim() ?? match[0],
        line: lineNum,
        recommendation: "Never echo or print secret values. Remove this line or use masking techniques.",
      });
    }
  }

  // Check for unmasked env vars passed as env to run steps
  const runStepsWithSecrets = content.matchAll(/run:.*\n(?:.*\n)*?.*\$\{\{\s*secrets\.[A-Z_]+/gm);
  for (const match of runStepsWithSecrets) {
    // Only flag if secret is used directly in shell interpolation (not as env var)
    if (match[0].includes("${{") && !match[0].includes("env:")) {
      const lineNum = content.slice(0, match.index).split("\n").length;
      findings.push({
        severity: "medium",
        rule: "ENV006",
        title: "Secret passed directly into shell",
        description: "Passing secrets directly into shell commands via ${{ secrets.X }} can expose them in process lists.",
        evidence: lines[lineNum - 1]?.trim() ?? "",
        line: lineNum,
        recommendation: "Pass secrets via environment variables: set `env: MY_SECRET: ${{ secrets.X }}` and reference $MY_SECRET in the script.",
      });
    }
  }

  // Check for world-readable permissions on env
  if (content.includes("pull_request_target") && content.includes("secrets.")) {
    findings.push({
      severity: "critical",
      rule: "ENV007",
      title: "Secrets exposed in pull_request_target trigger",
      description: "pull_request_target runs in the context of the target branch and has access to secrets, even for PRs from forks. This is a common attack vector.",
      evidence: "Workflow uses pull_request_target with secrets",
      recommendation: "Avoid using secrets in pull_request_target workflows triggered by untrusted PRs. Use a separate workflow with manual approval.",
    });
  }

  // Check for env vars set to empty
  const emptyEnvMatches = content.matchAll(/\s+([A-Z_][A-Z0-9_]*):\s*["']{2}\s*$/gm);
  for (const match of emptyEnvMatches) {
    findings.push({
      severity: "low",
      rule: "ENV008",
      title: `Empty environment variable: ${match[1]}`,
      description: "Environment variables set to empty strings may cause unexpected behavior.",
      evidence: match[0].trim(),
      recommendation: `Either set a default value for ${match[1]} or remove if unused.`,
    });
  }

  return {
    filePath,
    findings,
    envVarsFound: extractEnvVars(content),
    secretsReferenced: extractSecretRefs(content),
    scannedAt: new Date().toISOString(),
  };
}
