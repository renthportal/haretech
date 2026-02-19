-- ============================================
-- WindLift - Initial Schema (DÜZELTME)
-- Supabase'de auth schema'ya erişim kısıtlı olduğu için
-- trigger kısmı kaldırıldı - profil Supabase Dashboard'dan
-- veya uygulama kodu üzerinden oluşturulacak
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Firma/Organizasyon
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Kullanıcı Profilleri
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id),
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN','PROJECT_MANAGER','FIELD_ENGINEER','OPERATOR','CLIENT')),
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Türbin Modelleri
CREATE TABLE IF NOT EXISTS turbine_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer TEXT NOT NULL,
  model TEXT NOT NULL,
  rated_power_mw NUMERIC,
  rotor_diameter NUMERIC,
  nacelle_weight NUMERIC,
  hub_weight NUMERIC,
  blade_weight NUMERIC,
  blade_count INTEGER DEFAULT 3,
  tower_sections JSONB,
  max_wind_nacelle NUMERIC DEFAULT 10,
  max_wind_blade NUMERIC DEFAULT 8,
  max_wind_tower NUMERIC DEFAULT 12,
  spec_sheet_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Projeler
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  client_name TEXT,
  location_name TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  total_turbines INTEGER NOT NULL,
  turbine_model_id UUID REFERENCES turbine_models(id),
  hub_height NUMERIC,
  status TEXT DEFAULT 'planning' CHECK (status IN ('planning','mobilization','active','completing','completed','on_hold')),
  start_date DATE,
  target_end_date DATE,
  actual_end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Vinçler
CREATE TABLE IF NOT EXISTS cranes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  crane_type TEXT CHECK (crane_type IN ('mobile','crawler','rough_terrain','truck')),
  manufacturer TEXT,
  model TEXT,
  max_capacity NUMERIC,
  max_boom_length NUMERIC,
  max_tip_height NUMERIC,
  current_project_id UUID REFERENCES projects(id),
  status TEXT DEFAULT 'available' CHECK (status IN ('available','mobilizing','on_site','working','demobilizing','maintenance')),
  current_location TEXT,
  daily_rate NUMERIC,
  mobilization_cost NUMERIC,
  load_chart_data JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Türbin Birimleri
CREATE TABLE IF NOT EXISTS turbines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  turbine_number TEXT NOT NULL,
  latitude NUMERIC,
  longitude NUMERIC,
  foundation_status TEXT DEFAULT 'pending' CHECK (foundation_status IN ('pending','in_progress','completed')),
  tower_status TEXT DEFAULT 'pending' CHECK (tower_status IN ('pending','in_progress','completed')),
  nacelle_status TEXT DEFAULT 'pending' CHECK (nacelle_status IN ('pending','in_progress','completed')),
  hub_status TEXT DEFAULT 'pending' CHECK (hub_status IN ('pending','in_progress','completed')),
  blades_status TEXT DEFAULT 'pending' CHECK (blades_status IN ('pending','in_progress','completed')),
  commissioning_status TEXT DEFAULT 'pending' CHECK (commissioning_status IN ('pending','in_progress','completed')),
  foundation_date DATE,
  tower_complete_date DATE,
  nacelle_date DATE,
  hub_date DATE,
  blades_complete_date DATE,
  commissioning_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Montaj Aktiviteleri
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turbine_id UUID REFERENCES turbines(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id),
  activity_type TEXT NOT NULL CHECK (activity_type IN ('tower_section_1','tower_section_2','tower_section_3','tower_section_4','nacelle','hub','blade_1','blade_2','blade_3')),
  component_weight NUMERIC,
  lift_height NUMERIC,
  lift_radius NUMERIC,
  crane_id UUID REFERENCES cranes(id),
  planned_date DATE,
  planned_start_time TIME,
  actual_date DATE,
  actual_start_time TIME,
  actual_end_time TIME,
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned','ready','in_progress','completed','cancelled','weather_hold')),
  wind_speed_at_lift NUMERIC,
  weather_notes TEXT,
  crew_lead_id UUID REFERENCES profiles(id),
  crew_members UUID[],
  photos TEXT[],
  checklist JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ekipler
CREATE TABLE IF NOT EXISTS crews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  crew_type TEXT CHECK (crew_type IN ('installation','electrical','commissioning','transport')),
  leader_id UUID REFERENCES profiles(id),
  members UUID[],
  current_project_id UUID REFERENCES projects(id),
  status TEXT DEFAULT 'available',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Hava Durumu
CREATE TABLE IF NOT EXISTS weather_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  timestamp TIMESTAMPTZ NOT NULL,
  wind_speed NUMERIC,
  wind_gust NUMERIC,
  wind_direction NUMERIC,
  temperature NUMERIC,
  humidity NUMERIC,
  precipitation NUMERIC,
  visibility NUMERIC,
  source TEXT DEFAULT 'api' CHECK (source IN ('api','manual')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Günlük Raporlar
CREATE TABLE IF NOT EXISTS daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  report_date DATE NOT NULL,
  reported_by UUID REFERENCES profiles(id),
  weather_summary TEXT,
  work_performed TEXT,
  issues TEXT,
  next_day_plan TEXT,
  working_hours NUMERIC,
  downtime_hours NUMERIC,
  downtime_reason TEXT CHECK (downtime_reason IN ('weather','crane_breakdown','material_delay','other')),
  photos TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

-- İndexler
CREATE INDEX IF NOT EXISTS idx_profiles_org ON profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_projects_org ON projects(org_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_turbines_project ON turbines(project_id);
CREATE INDEX IF NOT EXISTS idx_activities_turbine ON activities(turbine_id);
CREATE INDEX IF NOT EXISTS idx_activities_project ON activities(project_id);
CREATE INDEX IF NOT EXISTS idx_activities_status ON activities(status);
CREATE INDEX IF NOT EXISTS idx_activities_planned_date ON activities(planned_date);
CREATE INDEX IF NOT EXISTS idx_cranes_org ON cranes(org_id);
CREATE INDEX IF NOT EXISTS idx_cranes_status ON cranes(status);
CREATE INDEX IF NOT EXISTS idx_crews_org ON crews(org_id);
CREATE INDEX IF NOT EXISTS idx_weather_logs_project ON weather_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_daily_reports_project ON daily_reports(project_id);

-- ============================================
-- handle_new_user trigger
-- Supabase Auth trigger - eğer hata verirse
-- bu bloğu atlayıp manuel profil oluşturun
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, org_id, full_name, role)
  VALUES (
    NEW.id,
    (NEW.raw_user_meta_data->>'org_id')::UUID,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'OPERATOR')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
