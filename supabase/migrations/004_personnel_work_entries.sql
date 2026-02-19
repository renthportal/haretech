-- ============================================
-- WindLift - Personel & Puantaj Tabloları
-- Migration 004
-- ============================================

-- Saha Personeli (Odoo sicil bazlı, profiles'tan ayrı)
CREATE TABLE personnel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  employee_code TEXT NOT NULL,           -- Odoo Sicil No (10362)
  full_name TEXT NOT NULL,               -- YÜCEL YALÇINKAYA
  department TEXT,                       -- RES MONTAJ GENEL MÜDÜRLÜĞÜ
  role_title TEXT,                       -- Vinç Operatörü, Montaj Teknisyeni...
  phone TEXT,
  certifications JSONB DEFAULT '[]',    -- [{name:"GWO", expiry:"2027-06-01"}]
  current_project_id UUID REFERENCES projects(id),
  status TEXT DEFAULT 'available' CHECK (status IN ('on_site','standby','leave','available','training')),
  profile_id UUID REFERENCES profiles(id), -- WindLift hesabı varsa bağla
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, employee_code)
);

-- Import Batch: Her Excel yükleme işleminin kaydı
CREATE TABLE import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  uploaded_by UUID REFERENCES profiles(id),
  file_name TEXT NOT NULL,
  period_start DATE,
  period_end DATE,
  total_rows INTEGER DEFAULT 0,
  imported_rows INTEGER DEFAULT 0,
  new_personnel INTEGER DEFAULT 0,
  skipped_rows INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]',
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing','completed','failed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Günlük Puantaj Başlık Kaydı (1 satır = 1 kişi × 1 gün)
CREATE TABLE work_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  personnel_id UUID REFERENCES personnel(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'on_site',            -- ŞEHİRDIŞI
    'travel',             -- ŞEHİRDIŞI GİDİŞ
    'standby',            -- BEKLEME
    'annual_leave',       -- YILLIK İZİN
    'inter_project_leave',-- PROJE ARASI İZNİ
    'sick_leave',         -- İSTİRAHAT RAPORU
    'training',           -- EĞİTİM
    'day_off',            -- HAFTA TATİLİ / RESMİ TATİL
    'paternity_leave',    -- BABALIK İZNİ
    'office'              -- OFİSTE
  )),
  total_hours NUMERIC,
  start_time NUMERIC,    -- 8.5 = 08:30
  end_time NUMERIC,
  project_id UUID REFERENCES projects(id),
  odoo_project_code TEXT,   -- Ham Odoo kodu (PR25090056)
  odoo_activity_code TEXT,  -- 100003493 - RES MONTAJ
  notes TEXT,
  meal_breakfast BOOLEAN DEFAULT false,
  meal_lunch BOOLEAN DEFAULT false,
  meal_dinner BOOLEAN DEFAULT false,
  meal_night BOOLEAN DEFAULT false,
  odoo_status TEXT,          -- Merkez Onayı, Taslak...
  import_batch_id UUID REFERENCES import_batches(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  -- Aynı kişi aynı gün tek kayıt (import'ta duplicate kontrolü için)
  UNIQUE(personnel_id, work_date, import_batch_id)
);

-- İş Satırları: Her günde 1-4 arası iş tipi + türbin + saat
CREATE TABLE work_entry_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_entry_id UUID REFERENCES work_entries(id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL CHECK (line_no BETWEEN 1 AND 4),
  work_type_code TEXT,       -- A, B, C, D, E, EF, F, G, I, K, KH, L, M, MF, N, Y, PROJE ARASI, DAY OFF
  work_type_label TEXT,      -- Ana Montaj, Ön Dikim, Tork İşleri...
  turbine_id UUID REFERENCES turbines(id),
  turbine_raw TEXT,          -- Ham değer: T1, T7, * vb.
  hours NUMERIC DEFAULT 0
);

-- Odoo Proje Kodu ↔ WindLift Proje Eşleme Tablosu
CREATE TABLE odoo_project_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  odoo_code TEXT NOT NULL,       -- PR25090056
  odoo_name TEXT,                -- PR25090056-P-GENEL
  project_id UUID REFERENCES projects(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, odoo_code)
);

-- ============================================
-- İndexler
-- ============================================
CREATE INDEX idx_personnel_org ON personnel(org_id);
CREATE INDEX idx_personnel_code ON personnel(org_id, employee_code);
CREATE INDEX idx_personnel_project ON personnel(current_project_id);
CREATE INDEX idx_personnel_status ON personnel(status);

CREATE INDEX idx_work_entries_personnel ON work_entries(personnel_id);
CREATE INDEX idx_work_entries_date ON work_entries(work_date);
CREATE INDEX idx_work_entries_project ON work_entries(project_id);
CREATE INDEX idx_work_entries_type ON work_entries(entry_type);
CREATE INDEX idx_work_entries_batch ON work_entries(import_batch_id);

CREATE INDEX idx_work_entry_lines_entry ON work_entry_lines(work_entry_id);
CREATE INDEX idx_work_entry_lines_turbine ON work_entry_lines(turbine_id);
CREATE INDEX idx_work_entry_lines_type ON work_entry_lines(work_type_code);

CREATE INDEX idx_import_batches_org ON import_batches(org_id);
CREATE INDEX idx_odoo_mappings_org ON odoo_project_mappings(org_id);
CREATE INDEX idx_odoo_mappings_code ON odoo_project_mappings(odoo_code);
