-- Migration 0016: Fix env_var_audits schema so new-style per-finding inserts work.
--
-- The original 0004 schema had var_name/status as NOT NULL (designed for a different
-- use-case). Migration 0006 added the current columns (severity, rule, title, etc.)
-- but never relaxed the old NOT NULL constraints, so every INSERT from the new API
-- silently failed (the driver ignored the error) and no findings were stored.

ALTER TABLE env_var_audits
  ALTER COLUMN var_name DROP NOT NULL;

ALTER TABLE env_var_audits
  DROP CONSTRAINT IF EXISTS env_var_audits_status_check;

ALTER TABLE env_var_audits
  ALTER COLUMN status DROP NOT NULL;
