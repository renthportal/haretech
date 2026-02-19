-- ============================================
-- WindLift - Müşteriler & Saha Bildirimleri
-- ============================================

-- Müşteriler
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  short_name TEXT,
  country TEXT DEFAULT 'TR',
  city TEXT,
  address TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view customers" ON customers FOR SELECT USING (org_id = public.get_org_id());
CREATE POLICY "Admins manage customers" ON customers FOR ALL USING (org_id = public.get_org_id() AND public.get_user_role() IN ('ADMIN','PROJECT_MANAGER'));

-- Projects tablosuna customer_id ekle (yoksa)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);

-- Saha Bildirimleri (incidents)
CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  project_id UUID REFERENCES projects(id),
  turbine_id UUID REFERENCES turbines(id),
  reported_by UUID REFERENCES profiles(id),
  incident_date DATE NOT NULL DEFAULT CURRENT_DATE,
  incident_time TIME,
  category TEXT NOT NULL CHECK (category IN (
    'accident','near_miss','damage','nonconformity','environmental','security','quality','other'
  )),
  severity TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('low','medium','high','critical')),
  title TEXT NOT NULL,
  description TEXT,
  location_detail TEXT,
  injured_person TEXT,
  injury_type TEXT,
  immediate_action TEXT,
  corrective_action TEXT,
  root_cause TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open','investigating','action_required','closed','cancelled')),
  assigned_to UUID REFERENCES profiles(id),
  due_date DATE,
  closed_date DATE,
  media_urls TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incidents_project ON incidents(project_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_date ON incidents(incident_date);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);

ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view incidents" ON incidents FOR SELECT USING (org_id = public.get_org_id());
CREATE POLICY "Field engineers create incidents" ON incidents FOR INSERT WITH CHECK (org_id = public.get_org_id());
CREATE POLICY "Admins manage incidents" ON incidents FOR UPDATE USING (org_id = public.get_org_id() AND public.get_user_role() IN ('ADMIN','PROJECT_MANAGER','FIELD_ENGINEER'));
