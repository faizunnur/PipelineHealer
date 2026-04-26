-- ============================================================
-- Database Functions & Triggers
-- ============================================================

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_pipelines_updated_at
  BEFORE UPDATE ON pipelines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_healing_updated_at
  BEFORE UPDATE ON healing_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_chat_sessions_updated_at
  BEFORE UPDATE ON chat_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Atomically increment token usage
CREATE OR REPLACE FUNCTION increment_token_usage(p_user_id UUID, p_amount INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET tokens_used = tokens_used + p_amount
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user stats for admin
CREATE OR REPLACE FUNCTION get_user_stats(p_user_id UUID)
RETURNS TABLE (
  total_pipelines       BIGINT,
  total_runs            BIGINT,
  failed_runs           BIGINT,
  total_healed          BIGINT,
  tokens_used_this_month INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM pipelines WHERE user_id = p_user_id)::BIGINT,
    (SELECT COUNT(*) FROM pipeline_runs pr
     JOIN pipelines p ON p.id = pr.pipeline_id
     WHERE p.user_id = p_user_id)::BIGINT,
    (SELECT COUNT(*) FROM pipeline_runs pr
     JOIN pipelines p ON p.id = pr.pipeline_id
     WHERE p.user_id = p_user_id AND pr.status = 'failed')::BIGINT,
    (SELECT COUNT(*) FROM healing_events
     WHERE user_id = p_user_id AND status = 'applied')::BIGINT,
    (SELECT COALESCE(SUM(total), 0) FROM token_usage_log
     WHERE user_id = p_user_id
     AND created_at >= date_trunc('month', NOW()))::INTEGER;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
