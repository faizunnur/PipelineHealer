ALTER TABLE pipelines
  ADD COLUMN IF NOT EXISTS webhook_status TEXT DEFAULT NULL
    CHECK (webhook_status IN ('created', 'exists', 'failed', 'skipped'));
