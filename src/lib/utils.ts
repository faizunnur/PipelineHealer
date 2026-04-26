import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);

  if (diffSecs < 60) return "just now";
  if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
  if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
  if (diffSecs < 604800) return `${Math.floor(diffSecs / 86400)}d ago`;
  return date.toLocaleDateString();
}

export function truncateCommitSha(sha: string): string {
  return sha.slice(0, 7);
}

export function truncateCommitMessage(msg: string | null, maxLen = 60): string {
  if (!msg) return "—";
  const firstLine = msg.split("\n")[0];
  return firstLine.length > maxLen
    ? firstLine.slice(0, maxLen) + "..."
    : firstLine;
}

export function getStatusColor(
  status: string
): "success" | "destructive" | "warning" | "secondary" {
  switch (status) {
    case "success":
    case "applied":
      return "success";
    case "failed":
    case "apply_failed":
    case "rejected":
      return "destructive";
    case "running":
    case "applying":
    case "pending_review":
    case "queued":
      return "warning";
    default:
      return "secondary";
  }
}
