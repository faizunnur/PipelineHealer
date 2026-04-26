-- RLS for new feature tables

ALTER TABLE notification_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_own" ON notification_channels FOR ALL USING (auth.uid() = user_id);

ALTER TABLE flaky_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "flaky_own" ON flaky_tests FOR ALL USING (auth.uid() = user_id);

ALTER TABLE performance_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perf_own" ON performance_suggestions FOR ALL USING (auth.uid() = user_id);

ALTER TABLE secret_scan_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scan_own" ON secret_scan_results FOR ALL USING (auth.uid() = user_id);

ALTER TABLE failure_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "patterns_own" ON failure_patterns FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "patterns_global" ON failure_patterns FOR SELECT USING (is_global = true);

ALTER TABLE sla_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sla_rules_own" ON sla_rules FOR ALL USING (auth.uid() = user_id);

ALTER TABLE sla_violations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sla_violations_own" ON sla_violations FOR SELECT USING (
  EXISTS (SELECT 1 FROM sla_rules sr WHERE sr.id = sla_violations.rule_id AND sr.user_id = auth.uid())
);

ALTER TABLE pipeline_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "templates_public_read" ON pipeline_templates FOR SELECT USING (true);
CREATE POLICY "templates_own_write" ON pipeline_templates FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "templates_own_update" ON pipeline_templates FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "templates_admin" ON pipeline_templates FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

ALTER TABLE env_var_audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "env_own" ON env_var_audits FOR ALL USING (auth.uid() = user_id);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_owner" ON organizations FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "org_member_read" ON organizations FOR SELECT USING (
  EXISTS (SELECT 1 FROM org_members WHERE org_id = organizations.id AND user_id = auth.uid())
);

ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_members_own" ON org_members FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "org_members_admin" ON org_members FOR ALL USING (
  EXISTS (SELECT 1 FROM organizations WHERE id = org_members.org_id AND owner_id = auth.uid())
);

ALTER TABLE health_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_own" ON health_reports FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "reports_admin" ON health_reports FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

ALTER TABLE rollback_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rollback_own" ON rollback_events FOR ALL USING (auth.uid() = user_id);
