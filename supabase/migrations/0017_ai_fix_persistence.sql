-- Migration 0017: AI Fix Persistence + token_usage_log feature expansion

-- Add ai_fix_result column to both finding tables so fixes persist until dismissed
ALTER TABLE env_var_audits
  ADD COLUMN IF NOT EXISTS ai_fix_result JSONB;

ALTER TABLE secret_scan_results
  ADD COLUMN IF NOT EXISTS ai_fix_result JSONB;

-- Expand token_usage_log feature CHECK to include new AI features
ALTER TABLE token_usage_log
  DROP CONSTRAINT IF EXISTS token_usage_log_feature_check;

ALTER TABLE token_usage_log
  ADD CONSTRAINT token_usage_log_feature_check
  CHECK (feature IN ('healing', 'chat', 'ai-fix', 'optimize'));
