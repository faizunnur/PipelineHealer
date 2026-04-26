-- Migration 0006: Schema updates to support new features
-- Adds missing columns / alters tables to match application code

-- ============================================================
-- ROLLBACK EVENTS — replace minimal schema with full one
-- ============================================================
ALTER TABLE rollback_events
  ADD COLUMN IF NOT EXISTS run_id          UUID REFERENCES pipeline_runs(id),
  ADD COLUMN IF NOT EXISTS target_sha      TEXT,
  ADD COLUMN IF NOT EXISTS reason          TEXT,
  ADD COLUMN IF NOT EXISTS result_sha      TEXT,
  ADD COLUMN IF NOT EXISTS executed_at     TIMESTAMPTZ;

-- Allow 'success' and 'failed' (keeping existing values too)
ALTER TABLE rollback_events
  DROP CONSTRAINT IF EXISTS rollback_events_status_check;
ALTER TABLE rollback_events
  ADD CONSTRAINT rollback_events_status_check
  CHECK (status IN ('pending','applying','applied','success','failed'));

-- rollback_method has a default so old rows are fine
ALTER TABLE rollback_events
  ALTER COLUMN rollback_method SET DEFAULT 'revert_commit';

-- ============================================================
-- ENV VAR AUDITS — redesign to hold per-finding rows
-- ============================================================
-- Drop old columns and add new ones (destructive only for old data)
ALTER TABLE env_var_audits
  ADD COLUMN IF NOT EXISTS file_path      TEXT,
  ADD COLUMN IF NOT EXISTS severity       TEXT CHECK (severity IN ('critical','high','medium','low')),
  ADD COLUMN IF NOT EXISTS rule           TEXT,
  ADD COLUMN IF NOT EXISTS title          TEXT,
  ADD COLUMN IF NOT EXISTS description    TEXT,
  ADD COLUMN IF NOT EXISTS evidence       TEXT,
  ADD COLUMN IF NOT EXISTS line_number    INTEGER,
  ADD COLUMN IF NOT EXISTS recommendation TEXT,
  ADD COLUMN IF NOT EXISTS resolved       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS resolved_at    TIMESTAMPTZ;

-- Remove old unique constraint that no longer applies
ALTER TABLE env_var_audits
  DROP CONSTRAINT IF EXISTS env_var_audits_pipeline_id_var_name_key;

-- ============================================================
-- HEALTH REPORTS — add period label and stats JSONB column
-- ============================================================
ALTER TABLE health_reports
  ADD COLUMN IF NOT EXISTS period TEXT CHECK (period IN ('daily','weekly','monthly')),
  ADD COLUMN IF NOT EXISTS stats  JSONB DEFAULT '[]'::JSONB;

-- ============================================================
-- ORGANIZATIONS — add slug and description columns
-- ============================================================
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS slug        TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Set a default slug from name for existing rows (if any)
UPDATE organizations SET slug = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]', '-', 'g'))
WHERE slug IS NULL;

-- Add unique constraint for slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug) WHERE slug IS NOT NULL;

-- Make provider/provider_org_id nullable (we no longer require them for manual orgs)
ALTER TABLE organizations
  ALTER COLUMN provider DROP NOT NULL,
  ALTER COLUMN provider_org_id DROP NOT NULL;

-- ============================================================
-- PIPELINE_TEMPLATES — add alias columns + relax constraints
-- Table already exists in 0004 with column 'title' and 'created_by'
-- We add 'name' and 'author_id' as aliases for compatibility
-- ============================================================
ALTER TABLE pipeline_templates
  ADD COLUMN IF NOT EXISTS name       TEXT,
  ADD COLUMN IF NOT EXISTS author_id  UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Sync name from title for existing rows
UPDATE pipeline_templates SET name = title WHERE name IS NULL AND title IS NOT NULL;

-- Drop the restrictive category CHECK to allow new categories (ci, deploy, docker, release, security, other)
ALTER TABLE pipeline_templates
  DROP CONSTRAINT IF EXISTS pipeline_templates_category_check;

-- Drop the restrictive provider CHECK to allow just github/gitlab (not 'both')
ALTER TABLE pipeline_templates
  DROP CONSTRAINT IF EXISTS pipeline_templates_provider_check;

ALTER TABLE pipeline_templates
  ADD CONSTRAINT pipeline_templates_provider_check
  CHECK (provider IN ('github','gitlab','both'));

-- Update INSERT policy to allow both author_id and created_by
DROP POLICY IF EXISTS "templates_own_write" ON pipeline_templates;
CREATE POLICY "templates_own_write" ON pipeline_templates
  FOR INSERT WITH CHECK (auth.uid() = created_by OR auth.uid() = author_id);

DROP POLICY IF EXISTS "templates_own_update" ON pipeline_templates;
CREATE POLICY "templates_own_update" ON pipeline_templates
  FOR UPDATE USING (auth.uid() = created_by OR auth.uid() = author_id);
