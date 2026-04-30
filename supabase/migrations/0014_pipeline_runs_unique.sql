-- Unique indexes are required for the upsert onConflict clauses in the webhook handler.
-- Without them, every upsert silently fails and pipeline_runs stays empty.

CREATE UNIQUE INDEX IF NOT EXISTS pipeline_runs_pipeline_provider_run_unique
  ON pipeline_runs (pipeline_id, provider_run_id);

CREATE UNIQUE INDEX IF NOT EXISTS pipeline_jobs_run_provider_job_unique
  ON pipeline_jobs (run_id, provider_job_id);
