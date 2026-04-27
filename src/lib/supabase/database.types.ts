// Manually maintained — covers all tables in migrations 0001–0006
// Uses standalone Row types to avoid circular Omit<Database[...], ...> references.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ── Standalone Row types (no circular references) ──────────────────────────

type ProfileRow = {
  id: string; email: string; full_name: string | null; avatar_url: string | null;
  role: "user" | "admin"; is_suspended: boolean; approval_mode: "manual" | "auto";
  token_budget: number; tokens_used: number; password_hash: string | null;
  email_verified: boolean;
  created_at: string; updated_at: string;
};
type IntegrationRow = {
  id: string; user_id: string; provider: "github" | "gitlab"; provider_user: string;
  encrypted_token: string; token_iv: string; token_tag: string;
  webhook_secret: string; is_active: boolean; created_at: string;
};
type PipelineRow = {
  id: string; user_id: string; integration_id: string; provider: "github" | "gitlab";
  repo_full_name: string; pipeline_name: string; default_branch: string;
  is_monitored: boolean; last_run_id: string | null; last_status: string | null;
  created_at: string; updated_at: string;
};
type PipelineRunRow = {
  id: string; pipeline_id: string; provider_run_id: string; commit_sha: string;
  commit_message: string | null; branch: string; triggered_by: string | null;
  status: "queued" | "running" | "success" | "failed" | "cancelled";
  started_at: string | null; completed_at: string | null;
  duration_seconds: number | null; raw_payload: Json | null; created_at: string;
};
type PipelineJobRow = {
  id: string; run_id: string; provider_job_id: string; job_name: string;
  status: "queued" | "running" | "success" | "failed" | "skipped";
  runner_name: string | null; started_at: string | null; completed_at: string | null;
  duration_seconds: number | null; error_excerpt: string | null;
  log_url: string | null; created_at: string;
};
type HealingEventRow = {
  id: string; user_id: string; pipeline_id: string; run_id: string; job_id: string;
  error_excerpt: string; ai_reason: string | null; ai_solution: string | null;
  ai_file_path: string | null; ai_original_code: string | null; ai_fixed_code: string | null;
  ai_tokens_used: number; ai_model: string;
  status: "pending_review" | "approved" | "rejected" | "applying" | "applied" | "apply_failed";
  approval_mode: string; approved_by: string | null; approved_at: string | null;
  applied_at: string | null; apply_error: string | null;
  created_at: string; updated_at: string;
};
type ChatSessionRow = {
  id: string; user_id: string; title: string | null; created_at: string; updated_at: string;
};
type ChatMessageRow = {
  id: string; session_id: string; role: "user" | "assistant";
  content: string; tokens_used: number; created_at: string;
};
type TokenUsageRow = {
  id: string; user_id: string; feature: "healing" | "chat"; model: string;
  tokens_in: number; tokens_out: number; total: number; ref_id: string | null; created_at: string;
};
type NotificationChannelRow = {
  id: string; user_id: string; name: string;
  type: "slack" | "teams" | "discord" | "email";
  webhook_url: string | null; webhook_iv: string | null; webhook_tag: string | null;
  email_address: string | null; events: string[]; is_active: boolean; created_at: string;
};
type FlakyTestRow = {
  id: string; pipeline_id: string; user_id: string; test_name: string;
  file_path: string | null; failure_count: number; pass_count: number;
  total_runs: number; flakiness_score: number; last_seen_at: string;
  is_suppressed: boolean; created_at: string;
};
type PerformanceSuggestionRow = {
  id: string; pipeline_id: string; user_id: string; category: string; title: string;
  description: string; estimated_saving: string | null; original_code: string | null;
  optimized_code: string | null; file_path: string | null; ai_tokens_used: number;
  status: "pending" | "applied" | "dismissed"; created_at: string;
};
type SecretScanResultRow = {
  id: string; pipeline_id: string; user_id: string; file_path: string;
  severity: "critical" | "high" | "medium" | "low" | "info"; rule_id: string;
  title: string; description: string; evidence: string | null; recommendation: string;
  status: "open" | "resolved" | "false_positive"; created_at: string;
};
type FailurePatternRow = {
  id: string; user_id: string; error_hash: string; normalized_error: string;
  pattern_name: string | null; occurrence_count: number; affected_pipelines: string[];
  last_seen_at: string; ai_insight: string | null; created_at: string; updated_at: string;
};
type SlaRuleRow = {
  id: string; user_id: string; pipeline_id: string; name: string; metric: string;
  threshold: number; window_hours: number; notify_channel_id: string | null;
  is_active: boolean; created_at: string;
};
type SlaViolationRow = {
  id: string; rule_id: string; run_id: string | null;
  actual_value: number; threshold: number; notified: boolean | null; created_at: string;
};
type PipelineTemplateRow = {
  id: string; title: string; name: string | null; description: string; category: string;
  provider: "github" | "gitlab" | "both"; language: string | null; content: string;
  variables: Json; tags: string[]; use_count: number; is_featured: boolean;
  is_official: boolean; created_by: string | null; author_id: string | null;
  created_at: string; updated_at: string | null;
};
type EnvVarAuditRow = {
  id: string; pipeline_id: string; user_id: string; file_path: string | null;
  severity: "critical" | "high" | "medium" | "low" | null; rule: string | null;
  title: string | null; description: string | null; evidence: string | null;
  line_number: number | null; recommendation: string | null;
  resolved: boolean; resolved_at: string | null;
  var_name: string | null; status: string | null;
  detected_in: string | null; last_checked_at: string | null; created_at: string;
};
type OrganizationRow = {
  id: string; name: string; slug: string | null; description: string | null;
  provider: string | null; provider_org_id: string | null; owner_id: string;
  integration_id: string | null; avatar_url: string | null; created_at: string;
};
type OrgMemberRow = {
  id: string; org_id: string; user_id: string;
  role: "owner" | "admin" | "member" | "viewer";
  invited_by: string | null; joined_at: string;
};
type HealthReportRow = {
  id: string; user_id: string; period: "daily" | "weekly" | "monthly" | null;
  period_start: string; period_end: string; total_runs: number; failed_runs: number;
  healed_runs: number; tokens_used: number; time_saved_seconds: number;
  top_failing_repos: Json; top_errors: Json; stats: Json;
  summary: string | null; sent_at: string | null; created_at: string;
};
type RollbackEventRow = {
  id: string; user_id: string; pipeline_id: string;
  healing_event_id: string | null; run_id: string | null; trigger_run_id: string | null;
  target_sha: string | null; target_commit_sha: string; reason: string | null;
  result_sha: string | null;
  rollback_method: "revert_commit" | "re_run_last_success" | "create_pr";
  status: "pending" | "applying" | "applied" | "success" | "failed";
  pr_url: string | null; error: string | null; executed_at: string | null; created_at: string;
};

// ── Helper type: satisfies GenericTable from @supabase/postgrest-js ─────────
type Rel = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};
type TableDef<R, Rels extends Rel[] = []> = {
  Row: R;
  Insert: Partial<R>;
  Update: Partial<R>;
  Relationships: Rels;
};

export type Database = {
  public: {
    Tables: {
      profiles: TableDef<ProfileRow>;
      integrations: TableDef<IntegrationRow, [
        { foreignKeyName: "integrations_user_id_fkey"; columns: ["user_id"]; referencedRelation: "profiles"; referencedColumns: ["id"] }
      ]>;
      pipelines: TableDef<PipelineRow, [
        { foreignKeyName: "pipelines_user_id_fkey"; columns: ["user_id"]; referencedRelation: "profiles"; referencedColumns: ["id"] },
        { foreignKeyName: "pipelines_integration_id_fkey"; columns: ["integration_id"]; referencedRelation: "integrations"; referencedColumns: ["id"] }
      ]>;
      pipeline_runs: TableDef<PipelineRunRow, [
        { foreignKeyName: "pipeline_runs_pipeline_id_fkey"; columns: ["pipeline_id"]; referencedRelation: "pipelines"; referencedColumns: ["id"] }
      ]>;
      pipeline_jobs: TableDef<PipelineJobRow, [
        { foreignKeyName: "pipeline_jobs_run_id_fkey"; columns: ["run_id"]; referencedRelation: "pipeline_runs"; referencedColumns: ["id"] }
      ]>;
      healing_events: TableDef<HealingEventRow, [
        { foreignKeyName: "healing_events_user_id_fkey"; columns: ["user_id"]; referencedRelation: "profiles"; referencedColumns: ["id"] },
        { foreignKeyName: "healing_events_pipeline_id_fkey"; columns: ["pipeline_id"]; referencedRelation: "pipelines"; referencedColumns: ["id"] },
        { foreignKeyName: "healing_events_run_id_fkey"; columns: ["run_id"]; referencedRelation: "pipeline_runs"; referencedColumns: ["id"] },
        { foreignKeyName: "healing_events_job_id_fkey"; columns: ["job_id"]; referencedRelation: "pipeline_jobs"; referencedColumns: ["id"] }
      ]>;
      chat_sessions: TableDef<ChatSessionRow>;
      chat_messages: TableDef<ChatMessageRow, [
        { foreignKeyName: "chat_messages_session_id_fkey"; columns: ["session_id"]; referencedRelation: "chat_sessions"; referencedColumns: ["id"] }
      ]>;
      token_usage_log: TableDef<TokenUsageRow, [
        { foreignKeyName: "token_usage_log_user_id_fkey"; columns: ["user_id"]; referencedRelation: "profiles"; referencedColumns: ["id"] }
      ]>;
      notification_channels: TableDef<NotificationChannelRow, [
        { foreignKeyName: "notification_channels_user_id_fkey"; columns: ["user_id"]; referencedRelation: "profiles"; referencedColumns: ["id"] }
      ]>;
      flaky_tests: TableDef<FlakyTestRow, [
        { foreignKeyName: "flaky_tests_pipeline_id_fkey"; columns: ["pipeline_id"]; referencedRelation: "pipelines"; referencedColumns: ["id"] }
      ]>;
      performance_suggestions: TableDef<PerformanceSuggestionRow, [
        { foreignKeyName: "performance_suggestions_pipeline_id_fkey"; columns: ["pipeline_id"]; referencedRelation: "pipelines"; referencedColumns: ["id"] }
      ]>;
      secret_scan_results: TableDef<SecretScanResultRow, [
        { foreignKeyName: "secret_scan_results_pipeline_id_fkey"; columns: ["pipeline_id"]; referencedRelation: "pipelines"; referencedColumns: ["id"] }
      ]>;
      failure_patterns: TableDef<FailurePatternRow>;
      sla_rules: TableDef<SlaRuleRow, [
        { foreignKeyName: "sla_rules_pipeline_id_fkey"; columns: ["pipeline_id"]; referencedRelation: "pipelines"; referencedColumns: ["id"] },
        { foreignKeyName: "sla_rules_notify_channel_id_fkey"; columns: ["notify_channel_id"]; referencedRelation: "notification_channels"; referencedColumns: ["id"] }
      ]>;
      sla_violations: TableDef<SlaViolationRow, [
        { foreignKeyName: "sla_violations_rule_id_fkey"; columns: ["rule_id"]; referencedRelation: "sla_rules"; referencedColumns: ["id"] },
        { foreignKeyName: "sla_violations_run_id_fkey"; columns: ["run_id"]; referencedRelation: "pipeline_runs"; referencedColumns: ["id"] }
      ]>;
      pipeline_templates: TableDef<PipelineTemplateRow>;
      env_var_audits: TableDef<EnvVarAuditRow, [
        { foreignKeyName: "env_var_audits_pipeline_id_fkey"; columns: ["pipeline_id"]; referencedRelation: "pipelines"; referencedColumns: ["id"] }
      ]>;
      organizations: TableDef<OrganizationRow, [
        { foreignKeyName: "organizations_owner_id_fkey"; columns: ["owner_id"]; referencedRelation: "profiles"; referencedColumns: ["id"] }
      ]>;
      org_members: TableDef<OrgMemberRow, [
        { foreignKeyName: "org_members_org_id_fkey"; columns: ["org_id"]; referencedRelation: "organizations"; referencedColumns: ["id"] },
        { foreignKeyName: "org_members_user_id_fkey"; columns: ["user_id"]; referencedRelation: "profiles"; referencedColumns: ["id"] }
      ]>;
      health_reports: TableDef<HealthReportRow>;
      rollback_events: TableDef<RollbackEventRow, [
        { foreignKeyName: "rollback_events_pipeline_id_fkey"; columns: ["pipeline_id"]; referencedRelation: "pipelines"; referencedColumns: ["id"] },
        { foreignKeyName: "rollback_events_healing_event_id_fkey"; columns: ["healing_event_id"]; referencedRelation: "healing_events"; referencedColumns: ["id"] }
      ]>;
      password_reset_tokens: TableDef<{
        id: string; email: string; token: string; expires_at: string; created_at: string;
      }>;
      email_verification_tokens: TableDef<{
        id: string; user_id: string; token: string; expires_at: string; created_at: string;
      }>;
    };
    // Empty views — empty object satisfies Record<string, GenericView>
    Views: {
      [_ in never]: {
        Row: Record<string, unknown>;
        Relationships: {
          foreignKeyName: string; columns: string[];
          isOneToOne?: boolean; referencedRelation: string; referencedColumns: string[];
        }[];
      };
    };
    Functions: {
      increment_token_usage: {
        Args: { p_user_id: string; p_amount: number };
        Returns: undefined;
      };
      get_user_stats: {
        Args: { p_user_id: string };
        Returns: {
          total_pipelines: number; total_runs: number;
          total_healed: number; tokens_used: number;
        }[];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
