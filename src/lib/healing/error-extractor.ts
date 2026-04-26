// Extracts only the relevant error lines from a job log
// to minimize Claude API token usage

const NOISE_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s*$/,  // bare timestamps
  /^##\[group\]/,
  /^##\[endgroup\]/,
  /^##\[debug\]/,
  /^\s*\[\d+\/\d+\]\s*$/,                               // progress counters
  /^Downloading\s+\d+/,
  /^\s*%\s*\d+/,                                        // percentage lines
  /^=+$/,                                               // separator lines
  /^-{10,}$/,                                           // long dashes
];

// ANSI escape code regex
const ANSI_REGEX = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;

function isNoiseLine(line: string): boolean {
  return NOISE_PATTERNS.some((pattern) => pattern.test(line));
}

function stripAnsi(text: string): string {
  return text.replace(ANSI_REGEX, "");
}

function findErrorStart(lines: string[]): number {
  // Look for common error indicators from the end
  const errorKeywords = [
    /\berror\b/i,
    /\bfailed\b/i,
    /\bfailure\b/i,
    /\bexception\b/i,
    /\bfatal\b/i,
    /\bnot found\b/i,
    /\bcommand not found\b/i,
    /\bpermission denied\b/i,
    /npm ERR!/i,
    /Error:/,
    /exit code \d+/i,
    /\bCannot\b/,
    /\bUnable to\b/i,
  ];

  // Search backwards from the end to find the first error
  for (let i = lines.length - 1; i >= 0; i--) {
    if (errorKeywords.some((kw) => kw.test(lines[i]))) {
      // Return 20 lines before the first error found
      return Math.max(0, i - 20);
    }
  }

  // No clear error found - return last 50 lines
  return Math.max(0, lines.length - 50);
}

export function extractErrorExcerpt(rawLog: string, maxChars = 3000): string {
  // Strip ANSI codes
  const clean = stripAnsi(rawLog);

  // Split into lines and filter noise
  const allLines = clean.split("\n");
  const meaningful = allLines.filter(
    (line) => line.trim().length > 0 && !isNoiseLine(line)
  );

  // Find where the error section starts
  const startIdx = findErrorStart(meaningful);
  const relevantLines = meaningful.slice(startIdx);

  // Join and truncate
  const excerpt = relevantLines.join("\n").trim();
  if (excerpt.length <= maxChars) return excerpt;

  // If still too long, take the last maxChars characters
  return "...(truncated)\n" + excerpt.slice(excerpt.length - maxChars);
}

export function extractExitCode(rawLog: string): number | null {
  const match = rawLog.match(/exit(?:ed with)? (?:code )?(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}
