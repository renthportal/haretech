-- ============================================
-- WindLift - Gantt Planlama Tablosu
-- ============================================

-- Her türbin için faz planlaması (foundation, tower, nacelle, hub, blades, commissioning)
CREATE TABLE IF NOT EXISTS turbine_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  turbine_id UUID REFERENCES turbines(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id),
  phase TEXT NOT NULL CHECK (phase IN (
    'foundation','tower','nacelle','hub','blades','commissioning'
  )),
  planned_start DATE,
  planned_end DATE,
  actual_start DATE,
  actual_end DATE,
  planned_days INTEGER GENERATED ALWAYS AS (
    CASE WHEN planned_start IS NOT NULL AND planned_end IS NOT NULL
    THEN (planned_end - planned_start) + 1 ELSE NULL END
  ) STORED,
  actual_days INTEGER GENERATED ALWAYS AS (
    CASE WHEN actual_start IS NOT NULL AND actual_end IS NOT NULL
    THEN (actual_end - actual_start) + 1 ELSE NULL END
  ) STORED,
  variance_days INTEGER GENERATED ALWAYS AS (
    CASE
      WHEN actual_end IS NOT NULL AND planned_end IS NOT NULL
      THEN (actual_end - planned_end)
      WHEN actual_start IS NOT NULL AND planned_end IS NOT NULL AND actual_end IS NULL
      THEN (CURRENT_DATE - planned_end)
      ELSE NULL
    END
  ) STORED,
  status TEXT DEFAULT 'not_started' CHECK (status IN (
    'not_started','in_progress','completed','delayed','cancelled'
  )),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(turbine_id, phase)
);

CREATE INDEX IF NOT EXISTS idx_turbine_plans_project ON turbine_plans(project_id);
CREATE INDEX IF NOT EXISTS idx_turbine_plans_turbine ON turbine_plans(turbine_id);
CREATE INDEX IF NOT EXISTS idx_turbine_plans_phase ON turbine_plans(phase);

ALTER TABLE turbine_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view turbine plans"
  ON turbine_plans FOR SELECT
  USING (org_id = public.get_org_id());

CREATE POLICY "Admins and PMs can manage turbine plans"
  ON turbine_plans FOR ALL
  USING (
    org_id = public.get_org_id()
    AND public.get_user_role() IN ('ADMIN','PROJECT_MANAGER','FIELD_ENGINEER')
  );
