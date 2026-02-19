-- ============================================
-- WindLift - Row Level Security Policies
-- DÜZELTME: auth schema yerine public schema kullanıyoruz
-- ============================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE turbine_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE turbines ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE cranes ENABLE ROW LEVEL SECURITY;
ALTER TABLE crews ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Helper fonksiyonlar PUBLIC schema'da
-- ============================================
CREATE OR REPLACE FUNCTION public.get_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================
-- Organizations
-- ============================================
CREATE POLICY "Users can view own organization"
  ON organizations FOR SELECT
  USING (id = public.get_org_id());

CREATE POLICY "Admins can update own organization"
  ON organizations FOR UPDATE
  USING (id = public.get_org_id() AND public.get_user_role() = 'ADMIN');

-- ============================================
-- Profiles
-- ============================================
CREATE POLICY "Users can view profiles in own org"
  ON profiles FOR SELECT
  USING (org_id = public.get_org_id());

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Admins can update any profile in org"
  ON profiles FOR UPDATE
  USING (org_id = public.get_org_id() AND public.get_user_role() = 'ADMIN');

CREATE POLICY "Admins can insert profiles in org"
  ON profiles FOR INSERT
  WITH CHECK (org_id = public.get_org_id() AND public.get_user_role() = 'ADMIN');

-- ============================================
-- Turbine Models (global read, admin write)
-- ============================================
CREATE POLICY "Anyone authenticated can view turbine models"
  ON turbine_models FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage turbine models"
  ON turbine_models FOR ALL
  USING (public.get_user_role() = 'ADMIN');

-- ============================================
-- Projects
-- ============================================
CREATE POLICY "Users can view projects in own org"
  ON projects FOR SELECT
  USING (org_id = public.get_org_id());

CREATE POLICY "Admins and PMs can insert projects"
  ON projects FOR INSERT
  WITH CHECK (
    org_id = public.get_org_id()
    AND public.get_user_role() IN ('ADMIN', 'PROJECT_MANAGER')
  );

CREATE POLICY "Admins and PMs can update projects in org"
  ON projects FOR UPDATE
  USING (
    org_id = public.get_org_id()
    AND public.get_user_role() IN ('ADMIN', 'PROJECT_MANAGER')
  );

CREATE POLICY "Admins can delete projects in org"
  ON projects FOR DELETE
  USING (org_id = public.get_org_id() AND public.get_user_role() = 'ADMIN');

-- ============================================
-- Turbines
-- ============================================
CREATE POLICY "Users can view turbines in own org projects"
  ON turbines FOR SELECT
  USING (
    project_id IN (SELECT id FROM projects WHERE org_id = public.get_org_id())
  );

CREATE POLICY "PMs and engineers can manage turbines"
  ON turbines FOR ALL
  USING (
    project_id IN (SELECT id FROM projects WHERE org_id = public.get_org_id())
    AND public.get_user_role() IN ('ADMIN', 'PROJECT_MANAGER', 'FIELD_ENGINEER')
  );

-- ============================================
-- Activities
-- ============================================
CREATE POLICY "Users can view activities in own org"
  ON activities FOR SELECT
  USING (
    project_id IN (SELECT id FROM projects WHERE org_id = public.get_org_id())
  );

CREATE POLICY "Staff can manage activities"
  ON activities FOR ALL
  USING (
    project_id IN (SELECT id FROM projects WHERE org_id = public.get_org_id())
    AND public.get_user_role() IN ('ADMIN', 'PROJECT_MANAGER', 'FIELD_ENGINEER', 'OPERATOR')
  );

-- ============================================
-- Cranes
-- ============================================
CREATE POLICY "Users can view cranes in own org"
  ON cranes FOR SELECT
  USING (org_id = public.get_org_id());

CREATE POLICY "Admins and PMs can manage cranes"
  ON cranes FOR ALL
  USING (
    org_id = public.get_org_id()
    AND public.get_user_role() IN ('ADMIN', 'PROJECT_MANAGER')
  );

-- ============================================
-- Crews
-- ============================================
CREATE POLICY "Users can view crews in own org"
  ON crews FOR SELECT
  USING (org_id = public.get_org_id());

CREATE POLICY "Admins and PMs can manage crews"
  ON crews FOR ALL
  USING (
    org_id = public.get_org_id()
    AND public.get_user_role() IN ('ADMIN', 'PROJECT_MANAGER')
  );

-- ============================================
-- Weather Logs
-- ============================================
CREATE POLICY "Users can view weather logs for own org projects"
  ON weather_logs FOR SELECT
  USING (
    project_id IN (SELECT id FROM projects WHERE org_id = public.get_org_id())
  );

CREATE POLICY "Staff can insert weather logs"
  ON weather_logs FOR INSERT
  WITH CHECK (
    project_id IN (SELECT id FROM projects WHERE org_id = public.get_org_id())
  );

-- ============================================
-- Daily Reports
-- ============================================
CREATE POLICY "Users can view daily reports for own org projects"
  ON daily_reports FOR SELECT
  USING (
    project_id IN (SELECT id FROM projects WHERE org_id = public.get_org_id())
  );

CREATE POLICY "Staff can manage daily reports"
  ON daily_reports FOR ALL
  USING (
    project_id IN (SELECT id FROM projects WHERE org_id = public.get_org_id())
    AND public.get_user_role() IN ('ADMIN', 'PROJECT_MANAGER', 'FIELD_ENGINEER')
  );
