-- Deployment Environment Board + Approval Gates
CREATE TABLE IF NOT EXISTS deployments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id     UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  run_id          UUID REFERENCES pipeline_runs(id) ON DELETE SET NULL,
  environment     TEXT NOT NULL CHECK (environment IN ('dev','staging','production','custom')),
  custom_env_name TEXT,
  status          TEXT NOT NULL DEFAULT 'deployed'
                    CHECK (status IN ('pending_approval','approved','rejected','deployed','failed')),
  version         TEXT,  -- commit sha or release tag
  deployed_at     TIMESTAMPTZ,
  deployed_by     TEXT,
  approved_by     TEXT,
  approved_at     TIMESTAMPTZ,
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_deployments_pipeline ON deployments(pipeline_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deployments_user     ON deployments(user_id, created_at DESC);

-- Pipeline Artifacts (docker images, npm packages, S3 files, GitHub releases)
CREATE TABLE IF NOT EXISTS pipeline_artifacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  run_id      UUID REFERENCES pipeline_runs(id) ON DELETE SET NULL,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('docker','npm','s3','github-release','pypi','other')),
  url         TEXT,
  version     TEXT,
  size_bytes  BIGINT,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_artifacts_pipeline ON pipeline_artifacts(pipeline_id, created_at DESC);

-- Auto GitHub Issue Rules (create issue when pipeline fails N times in a row)
CREATE TABLE IF NOT EXISTS auto_issue_rules (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id           UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  consecutive_failures  INT NOT NULL DEFAULT 3,
  labels                TEXT[] NOT NULL DEFAULT ARRAY['ci-failure','automated'],
  assignees             TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(pipeline_id)
);

-- Tracks auto-created GitHub issues so we don't duplicate
CREATE TABLE IF NOT EXISTS auto_issues (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id         UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  run_id              UUID REFERENCES pipeline_runs(id) ON DELETE SET NULL,
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  github_issue_number INT,
  github_issue_url    TEXT,
  title               TEXT,
  status              TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auto_issues_pipeline ON auto_issues(pipeline_id, created_at DESC);

-- Track consecutive failures per pipeline (updated by webhook)
ALTER TABLE pipelines
  ADD COLUMN IF NOT EXISTS consecutive_failures INT NOT NULL DEFAULT 0;
