export interface SecurityRule {
  id: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  description: string;
  recommendation: string;
  pattern?: RegExp;
  check?: (content: string, lines: string[]) => Array<{ lineNumber: number; evidence: string }>;
}

export const SECURITY_RULES: SecurityRule[] = [
  {
    id: "SEC001",
    severity: "critical",
    title: "Hardcoded Secret / Token",
    description: "A potential hardcoded secret, token, or password was found in your workflow file.",
    recommendation: "Move this value to a GitHub/GitLab Secret and reference it as ${{ secrets.MY_SECRET }}.",
    check: (content, lines) => {
      const results: Array<{ lineNumber: number; evidence: string }> = [];
      const secretPatterns = [
        /(?:password|passwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key)\s*[:=]\s*['"]?([A-Za-z0-9+/=_\-]{16,})['"]?/gi,
        /(?:ghp|ghs|github_pat|glpat|AKID|AIza)[A-Za-z0-9_\-]{10,}/g,
        /-----BEGIN (?:RSA|OPENSSH|EC|DSA) PRIVATE KEY-----/g,
      ];
      lines.forEach((line, i) => {
        if (line.trim().startsWith("#")) return; // skip comments
        if (/\$\{\{?\s*secrets\./i.test(line)) return; // skip proper secret refs
        if (/\$\{\{?\s*vars\./i.test(line)) return;
        if (/\$\{\{?\s*env\./i.test(line)) return;
        secretPatterns.forEach((p) => {
          const m = line.match(p);
          if (m) {
            const val = m[0];
            const redacted = val.slice(0, 4) + "..." + val.slice(-4);
            results.push({ lineNumber: i + 1, evidence: redacted });
          }
        });
      });
      return results;
    },
  },
  {
    id: "SEC002",
    severity: "high",
    title: "pull_request_target without Explicit Permissions",
    description: "Using pull_request_target with access to secrets is dangerous — untrusted code from forks can exfiltrate secrets.",
    recommendation: "Add explicit `permissions: read-all` or avoid checking out PR code in pull_request_target workflows.",
    check: (_content, lines) => {
      const results: Array<{ lineNumber: number; evidence: string }> = [];
      let inPRT = false;
      lines.forEach((line, i) => {
        if (/pull_request_target/.test(line)) inPRT = true;
        if (inPRT && /actions\/checkout/.test(line)) {
          results.push({ lineNumber: i + 1, evidence: "actions/checkout in pull_request_target" });
          inPRT = false;
        }
      });
      return results;
    },
  },
  {
    id: "SEC003",
    severity: "high",
    title: "Unpinned Action Reference (@main or @master)",
    description: "Using @main or @master means your workflow can be compromised if that action's repository is attacked (supply chain risk).",
    recommendation: "Pin actions to a specific commit SHA: uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11",
    check: (_content, lines) => {
      const results: Array<{ lineNumber: number; evidence: string }> = [];
      lines.forEach((line, i) => {
        const m = line.match(/uses:\s*[\w/-]+@(main|master|latest)/);
        if (m) results.push({ lineNumber: i + 1, evidence: line.trim() });
      });
      return results;
    },
  },
  {
    id: "SEC004",
    severity: "medium",
    title: "Missing permissions block",
    description: "Workflows without explicit permissions get write access to everything by default, violating least-privilege.",
    recommendation: "Add `permissions: read-all` at the top level and grant only what each job needs.",
    check: (_content, lines) => {
      const hasPermissions = lines.some((l) => /^permissions:/m.test(l));
      const hasTrigger = lines.some((l) => /on:/m.test(l));
      if (hasTrigger && !hasPermissions) {
        return [{ lineNumber: 1, evidence: "No permissions block found" }];
      }
      return [];
    },
  },
  {
    id: "SEC005",
    severity: "medium",
    title: "Script Injection via GitHub Context",
    description: "Using ${{ github.event.*.body }} or similar in run: steps allows attackers to inject arbitrary commands.",
    recommendation: "Use an intermediate environment variable: env: BODY: ${{ github.event.issue.body }} then reference $BODY in the script.",
    check: (_content, lines) => {
      const results: Array<{ lineNumber: number; evidence: string }> = [];
      lines.forEach((line, i) => {
        if (/run:.*\$\{\{.*github\.event\.(issue|pull_request|comment|discussion)\.(body|title)/.test(line)) {
          results.push({ lineNumber: i + 1, evidence: line.trim() });
        }
      });
      return results;
    },
  },
  {
    id: "SEC006",
    severity: "low",
    title: "Missing timeout-minutes",
    description: "Jobs without timeout-minutes can run indefinitely, wasting runner minutes and costs.",
    recommendation: "Add `timeout-minutes: 30` (or appropriate value) to each job.",
    check: (_content, lines) => {
      const results: Array<{ lineNumber: number; evidence: string }> = [];
      let inJob = false;
      let jobLine = 0;
      let hasTimeout = false;
      let jobName = "";
      lines.forEach((line, i) => {
        if (/^  \w[\w-]*:/.test(line) && !line.includes("runs-on") && !line.includes("steps")) {
          if (inJob && !hasTimeout) {
            results.push({ lineNumber: jobLine + 1, evidence: `Job "${jobName}" missing timeout-minutes` });
          }
          inJob = true; jobLine = i; hasTimeout = false;
          jobName = line.trim().replace(":", "");
        }
        if (inJob && /timeout-minutes/.test(line)) hasTimeout = true;
      });
      if (inJob && !hasTimeout) {
        results.push({ lineNumber: jobLine + 1, evidence: `Job "${jobName}" missing timeout-minutes` });
      }
      return results;
    },
  },
  {
    id: "SEC007",
    severity: "info",
    title: "Using :latest Docker tag",
    description: "Using :latest tags in Docker images can cause non-reproducible builds and unexpected breakages.",
    recommendation: "Pin to a specific version: node:20.10.0-alpine3.18 instead of node:latest",
    check: (_content, lines) => {
      const results: Array<{ lineNumber: number; evidence: string }> = [];
      lines.forEach((line, i) => {
        const m = line.match(/(?:image:|FROM|container:)\s*[\w/.-]+:latest/);
        if (m) results.push({ lineNumber: i + 1, evidence: m[0].trim() });
      });
      return results;
    },
  },
];

export function scanWorkflow(
  content: string,
  filePath: string
): Array<{
  rule_id: string;
  severity: string;
  title: string;
  description: string;
  recommendation: string;
  file_path: string;
  line_number: number | null;
  evidence: string | null;
}> {
  const lines = content.split("\n");
  const findings = [];

  for (const rule of SECURITY_RULES) {
    if (rule.check) {
      const matches = rule.check(content, lines);
      for (const match of matches) {
        findings.push({
          rule_id: rule.id,
          severity: rule.severity,
          title: rule.title,
          description: rule.description,
          recommendation: rule.recommendation,
          file_path: filePath,
          line_number: match.lineNumber,
          evidence: match.evidence,
        });
      }
    } else if (rule.pattern) {
      let match;
      const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
      while ((match = regex.exec(content)) !== null) {
        const lineNumber = content.slice(0, match.index).split("\n").length;
        findings.push({
          rule_id: rule.id,
          severity: rule.severity,
          title: rule.title,
          description: rule.description,
          recommendation: rule.recommendation,
          file_path: filePath,
          line_number: lineNumber,
          evidence: match[0].slice(0, 60),
        });
      }
    }
  }

  return findings;
}
