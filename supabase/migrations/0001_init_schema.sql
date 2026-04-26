-- ============================================================
-- PipelineHealer - Initial Schema
-- ============================================================

-- Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  full_name     TEXT,
  avatar_url    TEXT,
  role          TEXT NOT NULL DEFAULT 'user'
                CHECK (role IN ('user', 'admin')),
  is_suspended  BOOLEAN NOT NULL DEFAULT false,
  approval_mode TEXT NOT NULL DEFAULT 'manual'
                CHECK (approval_mode IN ('manual', 'auto')),
  token_budget  INTEGER NOT NULL DEFAULT 100000,
  tokens_used   INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Integrations (GitHub / GitLab connections)
CREATE TABLE IF NOT EXISTS integrations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL CHECK (provider IN ('github', 'gitlab')),
  provider_user   TEXT NOT NULL,
  encrypted_token TEXT NOT NULL,
  token_iv        TEXT NOT NULL,
  token_tag       TEXT NOT NULL,
  webhook_secret  TEXT NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, provider, provider_user)
);

-- Pipelines (tracked repositories)
CREATE TABLE IF NOT EXISTS pipelines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  integration_id  UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL CHECK (provider IN ('github', 'gitlab')),
  repo_full_name  TEXT NOT NULL,
  pipeline_name   TEXT NOT NULL,
  default_branch  TEXT NOT NULL DEFAULT 'main',
  is_monitored    BOOLEAN NOT NULL DEFAULT true,
  last_run_id     UUID,
  last_status     TEXT DEFAULT 'unknown',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pipeline Runs
CREATE TABLE IF NOT EXISTS pipeline_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id       UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  provider_run_id   TEXT NOT NULL,
  commit_sha        TEXT NOT NULL,
  commit_message    TEXT,
  branch            TEXT NOT NULL,
  triggered_by      TEXT,
  status            TEXT NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued','running','success','failed','cancelled')),
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  duration_seconds  INTEGER,
  raw_payload       JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pipeline Jobs
CREATE TABLE IF NOT EXISTS pipeline_jobs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id           UUID NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  provider_job_id  TEXT NOT NULL,
  job_name         TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'queued'
                   CHECK (status IN ('queued','running','success','failed','skipped')),
  runner_name      TEXT,
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  duration_seconds INTEGER,
  error_excerpt    TEXT,
  log_url          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Healing Events
CREATE TABLE IF NOT EXISTS healing_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES profiles(id),
  pipeline_id       UUID NOT NULL REFERENCES pipelines(id),
  run_id            UUID NOT NULL REFERENCES pipeline_runs(id),
  job_id            UUID NOT NULL REFERENCES pipeline_jobs(id),
  error_excerpt     TEXT NOT NULL,
  ai_reason         TEXT,
  ai_solution       TEXT,
  ai_file_path      TEXT,
  ai_original_code  TEXT,
  ai_fixed_code     TEXT,
  ai_tokens_used    INTEGER DEFAULT 0,
  ai_model          TEXT DEFAULT 'claude-sonnet-4-6',
  status            TEXT NOT NULL DEFAULT 'pending_review'
                    CHECK (status IN ('pending_review','approved','rejected',
                                      'applying','applied','apply_failed')),
  approval_mode     TEXT NOT NULL,
  approved_by       UUID REFERENCES profiles(id),
  approved_at       TIMESTAMPTZ,
  applied_at        TIMESTAMPTZ,
  apply_error       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chat Sessions
CREATE TABLE IF NOT EXISTS chat_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Token Usage Log
CREATE TABLE IF NOT EXISTS token_usage_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id),
  feature     TEXT NOT NULL CHECK (feature IN ('healing', 'chat')),
  model       TEXT NOT NULL,
  tokens_in   INTEGER NOT NULL DEFAULT 0,
  tokens_out  INTEGER NOT NULL DEFAULT 0,
  total       INTEGER GENERATED ALWAYS AS (tokens_in + tokens_out) STORED,
  ref_id      UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_runs_pipeline_id     ON pipeline_runs(pipeline_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_run_id          ON pipeline_jobs(run_id);
CREATE INDEX IF NOT EXISTS idx_healing_user_status  ON healing_events(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_user_month     ON token_usage_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipelines_user       ON pipelines(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user   ON chat_sessions(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at ASC);
