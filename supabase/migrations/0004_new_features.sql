-- ============================================================
-- PipelineHealer v2 - New Features Schema
-- ============================================================

-- === NOTIFICATION CHANNELS ===
CREATE TABLE IF NOT EXISTS notification_channels (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('slack', 'teams', 'discord', 'email')),
  webhook_url   TEXT,           -- Slack/Teams/Discord webhook URL (encrypted)
  webhook_iv    TEXT,
  webhook_tag   TEXT,
  email_address TEXT,           -- for email type
  events        TEXT[] NOT NULL DEFAULT ARRAY['failure','healing_complete','healing_applied'],
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- === FLAKY TEST TRACKER ===
CREATE TABLE IF NOT EXISTS flaky_tests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id     UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id),
  test_name       TEXT NOT NULL,
  file_path       TEXT,
  failure_count   INTEGER NOT NULL DEFAULT 1,
  pass_count      INTEGER NOT NULL DEFAULT 0,
  total_runs      INTEGER NOT NULL DEFAULT 1,
  flakiness_score FLOAT GENERATED ALWAYS AS (
    CASE WHEN (failure_count + pass_count) = 0 THEN 0
    ELSE failure_count::FLOAT / (failure_count + pass_count)::FLOAT
    END
  ) STORED,
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_suppressed   BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(pipeline_id, test_name)
);

-- === PERFORMANCE SUGGESTIONS ===
CREATE TABLE IF NOT EXISTS performance_suggestions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id     UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id),
  category        TEXT NOT NULL CHECK (category IN ('parallelism','caching','matrix','splitting','runner','misc')),
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  estimated_saving TEXT,         -- e.g. "~4 min per run"
  original_code   TEXT,
  optimized_code  TEXT,
  ai_tokens_used  INTEGER DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','applied','dismissed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- === SECRET SCAN RESULTS ===
CREATE TABLE IF NOT EXISTS secret_scan_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id     UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id),
  severity        TEXT NOT NULL CHECK (severity IN ('critical','high','medium','low','info')),
  rule_id         TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  file_path       TEXT NOT NULL,
  line_number     INTEGER,
  evidence        TEXT,           -- redacted evidence (first/last chars only)
  recommendation TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','fixed','dismissed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- === FAILURE PATTERNS ===
CREATE TABLE IF NOT EXISTS failure_patterns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id),
  pattern_hash    TEXT NOT NULL,  -- hash of normalized error signature
  title           TEXT NOT NULL,
  error_signature TEXT NOT NULL,
  affected_repos  TEXT[] NOT NULL DEFAULT '{}',
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  root_cause      TEXT,
  ai_suggestion   TEXT,
  is_global       BOOLEAN DEFAULT false, -- cross-user pattern
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, pattern_hash)
);

-- === SLA RULES ===
CREATE TABLE IF NOT EXISTS sla_rules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id       UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES profiles(id),
  name              TEXT NOT NULL,
  metric            TEXT NOT NULL CHECK (metric IN ('max_duration','max_failures_per_day','max_consecutive_failures','min_success_rate')),
  threshold         FLOAT NOT NULL,   -- seconds for duration, count for failures, % for success rate
  window_hours      INTEGER DEFAULT 24,
  notify_channel_id UUID REFERENCES notification_channels(id),
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- === SLA VIOLATIONS ===
CREATE TABLE IF NOT EXISTS sla_violations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id     UUID NOT NULL REFERENCES sla_rules(id) ON DELETE CASCADE,
  run_id      UUID REFERENCES pipeline_runs(id),
  actual_value FLOAT NOT NULL,
  threshold   FLOAT NOT NULL,
  notified    BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- === PIPELINE TEMPLATES ===
CREATE TABLE IF NOT EXISTS pipeline_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by    UUID REFERENCES profiles(id),
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,
  category      TEXT NOT NULL CHECK (category IN ('nodejs','python','go','rust','java','docker','deploy','monorepo','security','testing','other')),
  provider      TEXT NOT NULL CHECK (provider IN ('github','gitlab','both')),
  language      TEXT,
  content       TEXT NOT NULL,   -- YAML template with {{VARIABLES}}
  variables     JSONB DEFAULT '[]', -- [{name, description, default, required}]
  tags          TEXT[] DEFAULT '{}',
  use_count     INTEGER DEFAULT 0,
  is_featured   BOOLEAN DEFAULT false,
  is_official   BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- === ENV VAR AUDITS ===
CREATE TABLE IF NOT EXISTS env_var_audits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id     UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id),
  var_name        TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('missing','potentially_expired','misconfigured','ok')),
  description     TEXT,
  detected_in     TEXT,   -- file path where referenced
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(pipeline_id, var_name)
);

-- === ORGANIZATIONS ===
CREATE TABLE IF NOT EXISTS organizations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  provider        TEXT NOT NULL CHECK (provider IN ('github', 'gitlab')),
  provider_org_id TEXT NOT NULL,
  owner_id        UUID NOT NULL REFERENCES profiles(id),
  integration_id  UUID REFERENCES integrations(id),
  avatar_url      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider, provider_org_id)
);

-- === ORG MEMBERS ===
CREATE TABLE IF NOT EXISTS org_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member','viewer')),
  invited_by  UUID REFERENCES profiles(id),
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

-- === HEALTH REPORTS ===
CREATE TABLE IF NOT EXISTS health_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id),
  period_start  TIMESTAMPTZ NOT NULL,
  period_end    TIMESTAMPTZ NOT NULL,
  total_runs    INTEGER DEFAULT 0,
  failed_runs   INTEGER DEFAULT 0,
  healed_runs   INTEGER DEFAULT 0,
  tokens_used   INTEGER DEFAULT 0,
  time_saved_seconds INTEGER DEFAULT 0,
  top_failing_repos JSONB DEFAULT '[]',
  top_errors    JSONB DEFAULT '[]',
  summary       TEXT,
  sent_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- === ROLLBACK EVENTS ===
CREATE TABLE IF NOT EXISTS rollback_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  healing_event_id    UUID REFERENCES healing_events(id),
  pipeline_id         UUID NOT NULL REFERENCES pipelines(id),
  user_id             UUID NOT NULL REFERENCES profiles(id),
  trigger_run_id      UUID REFERENCES pipeline_runs(id),
  target_commit_sha   TEXT NOT NULL,  -- SHA to roll back to
  rollback_method     TEXT NOT NULL CHECK (rollback_method IN ('revert_commit','re_run_last_success','create_pr')),
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','applying','applied','failed')),
  pr_url              TEXT,
  error               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- === INDEXES ===
CREATE INDEX IF NOT EXISTS idx_notification_channels_user ON notification_channels(user_id);
CREATE INDEX IF NOT EXISTS idx_flaky_tests_pipeline ON flaky_tests(pipeline_id, flakiness_score DESC);
CREATE INDEX IF NOT EXISTS idx_perf_suggestions_pipeline ON performance_suggestions(pipeline_id, status);
CREATE INDEX IF NOT EXISTS idx_secret_scan_pipeline ON secret_scan_results(pipeline_id, severity);
CREATE INDEX IF NOT EXISTS idx_failure_patterns_user ON failure_patterns(user_id, occurrence_count DESC);
CREATE INDEX IF NOT EXISTS idx_sla_rules_pipeline ON sla_rules(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_sla_violations_rule ON sla_violations(rule_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_templates_category ON pipeline_templates(category, use_count DESC);
CREATE INDEX IF NOT EXISTS idx_env_var_audits_pipeline ON env_var_audits(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_health_reports_user ON health_reports(user_id, period_start DESC);
