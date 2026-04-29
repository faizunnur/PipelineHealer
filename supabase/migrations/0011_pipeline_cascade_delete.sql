-- Add ON DELETE CASCADE to all FK references to pipelines(id)
-- so deleting a pipeline removes all related data automatically.

ALTER TABLE healing_events
  DROP CONSTRAINT IF EXISTS healing_events_pipeline_id_fkey,
  ADD CONSTRAINT healing_events_pipeline_id_fkey
    FOREIGN KEY (pipeline_id) REFERENCES pipelines(id) ON DELETE CASCADE;

ALTER TABLE rollback_events
  DROP CONSTRAINT IF EXISTS rollback_events_pipeline_id_fkey,
  ADD CONSTRAINT rollback_events_pipeline_id_fkey
    FOREIGN KEY (pipeline_id) REFERENCES pipelines(id) ON DELETE CASCADE;
