-- ============================================================
-- Row Level Security Policies
-- ============================================================

-- === PROFILES ===
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_own_select" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_own_update" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_admin_all" ON profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- === INTEGRATIONS ===
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "integrations_own" ON integrations
  FOR ALL USING (auth.uid() = user_id);

-- === PIPELINES ===
ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pipelines_own" ON pipelines
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "pipelines_admin" ON pipelines
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- === PIPELINE RUNS ===
ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "runs_own" ON pipeline_runs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM pipelines p
      WHERE p.id = pipeline_runs.pipeline_id AND p.user_id = auth.uid()
    )
  );

-- === PIPELINE JOBS ===
ALTER TABLE pipeline_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jobs_own" ON pipeline_jobs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM pipeline_runs pr
      JOIN pipelines p ON p.id = pr.pipeline_id
      WHERE pr.id = pipeline_jobs.run_id AND p.user_id = auth.uid()
    )
  );

-- === HEALING EVENTS ===
ALTER TABLE healing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "healing_own" ON healing_events
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "healing_admin" ON healing_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- === CHAT SESSIONS ===
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_sessions_own" ON chat_sessions
  FOR ALL USING (auth.uid() = user_id);

-- === CHAT MESSAGES ===
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_messages_own" ON chat_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM chat_sessions cs
      WHERE cs.id = chat_messages.session_id AND cs.user_id = auth.uid()
    )
  );

-- === TOKEN USAGE LOG ===
ALTER TABLE token_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usage_own" ON token_usage_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "usage_admin" ON token_usage_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Service role bypass (for server-side inserts)
CREATE POLICY "usage_service_insert" ON token_usage_log
  FOR INSERT WITH CHECK (true);
