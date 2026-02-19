-- ============================================
-- WindLift - Personel Tabloları RLS
-- DÜZELTME: public.get_org_id() ve public.get_user_role() kullanıyoruz
-- NOT: Bu migration'ı 004 ve düzeltilmiş 002'den SONRA çalıştırın
-- ============================================

ALTER TABLE personnel ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE odoo_project_mappings ENABLE ROW LEVEL SECURITY;

-- ── Personnel ──
CREATE POLICY "Org members can view personnel"
  ON personnel FOR SELECT
  USING (org_id = public.get_org_id());

CREATE POLICY "Admins and PMs can manage personnel"
  ON personnel FOR ALL
  USING (
    org_id = public.get_org_id()
    AND public.get_user_role() IN ('ADMIN','PROJECT_MANAGER','FIELD_ENGINEER')
  );

-- ── Import Batches ──
CREATE POLICY "Org members can view import batches"
  ON import_batches FOR SELECT
  USING (org_id = public.get_org_id());

CREATE POLICY "Admins and PMs can manage import batches"
  ON import_batches FOR ALL
  USING (
    org_id = public.get_org_id()
    AND public.get_user_role() IN ('ADMIN','PROJECT_MANAGER')
  );

-- ── Work Entries ──
CREATE POLICY "Org members can view work entries"
  ON work_entries FOR SELECT
  USING (org_id = public.get_org_id());

CREATE POLICY "Admins and PMs can manage work entries"
  ON work_entries FOR ALL
  USING (
    org_id = public.get_org_id()
    AND public.get_user_role() IN ('ADMIN','PROJECT_MANAGER','FIELD_ENGINEER')
  );

-- ── Work Entry Lines ──
CREATE POLICY "Org members can view work entry lines"
  ON work_entry_lines FOR SELECT
  USING (
    work_entry_id IN (
      SELECT id FROM work_entries WHERE org_id = public.get_org_id()
    )
  );

CREATE POLICY "Admins and PMs can manage work entry lines"
  ON work_entry_lines FOR ALL
  USING (
    work_entry_id IN (
      SELECT id FROM work_entries WHERE org_id = public.get_org_id()
    )
    AND public.get_user_role() IN ('ADMIN','PROJECT_MANAGER','FIELD_ENGINEER')
  );

-- ── Odoo Mappings ──
CREATE POLICY "Org members can view odoo mappings"
  ON odoo_project_mappings FOR SELECT
  USING (org_id = public.get_org_id());

CREATE POLICY "Admins can manage odoo mappings"
  ON odoo_project_mappings FOR ALL
  USING (
    org_id = public.get_org_id()
    AND public.get_user_role() IN ('ADMIN','PROJECT_MANAGER')
  );
