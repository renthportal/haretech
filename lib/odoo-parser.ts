// ============================================
// WindLift - Odoo Puantaj Excel Parser
// lib/odoo-parser.ts
// ============================================
// npm install xlsx  →  gerekli bağımlılık

import * as XLSX from 'xlsx'

// ── İş Tipi Çeviri Tablosu ──────────────────
export const WORK_TYPE_LABELS: Record<string, string> = {
  'A-OFFLOADING (İNDİRME)': 'İndirme / Boşaltma',
  'B-PREPERATION (HAZIRLIK)': 'Hazırlık',
  'C-PRE ASSEMBLY (ÖN DİKİM)': 'Ön Dikim / Ön Montaj',
  'D-MAİN ASSEMBLY (ANA MONTAJ)': 'Ana Montaj (Kaldırma)',
  'E-TORQUE WORKS (TORK İŞLERİ)': 'Tork İşleri',
  'EF-FINISHING WORKS (ELEKTRİK İŞLERİ)': 'Elektrik Bitirme İşleri',
  'F-FIELD ORGANISATION': 'Saha Organizasyonu',
  'G-NON-PRODUCTIVE (ATIL İŞLER)': 'Atıl / Verimsiz',
  'I-PUNCH CLOSING': 'Punch Liste Kapama',
  'K-WAITING (BEKLEMELER)': 'Bekleme',
  'KH-WAITING (HAREKET)': 'Hareket Bekleme',
  'L-EXTRA WORKS': 'Ekstra İşler',
  'M-TRAINING (EĞİTİM)': 'Eğitim',
  'MF-MECHANICAL FINISHING': 'Mekanik Bitirme',
  'N-İDARİ İŞLER': 'İdari İşler',
  'Y-YOL': 'Yol / Seyahat',
  'PROJE ARASI': 'Proje Arası',
  'DAY OFF': 'İzin Günü',
}

function getWorkTypeCode(raw: string): string {
  if (!raw) return ''
  const first = raw.split('-')[0].trim().toUpperCase()
  return first
}

function getWorkTypeLabel(raw: string): string {
  return WORK_TYPE_LABELS[raw] || raw || ''
}

// ── Odoo Puantaj Türü → WindLift entry_type ──
export const ENTRY_TYPE_MAP: Record<string, string> = {
  'ŞEHİRDIŞI': 'on_site',
  'ŞEHİRDIŞI GİDİŞ': 'travel',
  'BEKLEME': 'standby',
  'YILLIK İZİN': 'annual_leave',
  'PROJE ARASI İZNİ': 'inter_project_leave',
  'İSTİRAHAT RAPORU': 'sick_leave',
  'EĞİTİM': 'training',
  'HAFTA TATİLİ': 'day_off',
  'RESMİ TATİL': 'day_off',
  'HAFTAİÇİ TATİL': 'day_off',
  'BABALIK İZNİ': 'paternity_leave',
  'OFİSTE': 'office',
}

export const ENTRY_TYPE_LABELS: Record<string, string> = {
  on_site: 'Sahada',
  travel: 'Yolda',
  standby: 'Bekleme',
  annual_leave: 'Yıllık İzin',
  inter_project_leave: 'Proje Arası',
  sick_leave: 'İstirahat',
  training: 'Eğitim',
  day_off: 'Tatil',
  paternity_leave: 'Babalık İzni',
  office: 'Ofiste',
}

// ── Tip Tanımları ─────────────────────────
export interface ParsedRow {
  employeeCode: string
  fullName: string
  department: string
  workDate: string           // ISO date: 2026-01-02
  entryTypeRaw: string       // ŞEHİRDIŞI
  entryType: string          // on_site
  totalHours: number
  startTime: number | null
  endTime: number | null
  odooProjectCode: string
  odooProjectName: string
  odooActivityCode: string
  notes: string
  mealBreakfast: boolean
  mealLunch: boolean
  mealDinner: boolean
  mealNight: boolean
  odooStatus: string
  lines: ParsedLine[]
}

export interface ParsedLine {
  lineNo: number
  workTypeRaw: string
  workTypeCode: string
  workTypeLabel: string
  turbineRaw: string   // T1, T7, * veya ''
  hours: number
}

export interface ParseResult {
  rows: ParsedRow[]
  uniquePersonnel: PersonnelSummary[]
  uniqueProjects: ProjectSummary[]
  dateRange: { start: string; end: string }
  totalRows: number
  skippedRows: number
  warnings: string[]
}

export interface PersonnelSummary {
  employeeCode: string
  fullName: string
  department: string
  entryCount: number
}

export interface ProjectSummary {
  odooCode: string
  odooName: string
  personnelCount: number
}

// ── Ana Parser Fonksiyonu ─────────────────
export function parseOdooExcel(buffer: ArrayBuffer): ParseResult {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    header: 1,
    defval: null,
  }) as unknown[][]

  if (raw.length < 2) {
    return {
      rows: [], uniquePersonnel: [], uniqueProjects: [],
      dateRange: { start: '', end: '' },
      totalRows: 0, skippedRows: 0, warnings: ['Dosya boş veya geçersiz format.'],
    }
  }

  // Kolon başlıklarını bul (ilk satır)
  const headers = (raw[0] as string[]).map((h) => (h || '').toString().trim())

  const col = (name: string) => headers.indexOf(name)

  // Kritik kolonları kontrol et
  const warnings: string[] = []
  const requiredCols = ['Sicil No', 'Personel', 'Tarih', 'Puantaj Kaydı Türü']
  for (const c of requiredCols) {
    if (col(c) === -1) warnings.push(`Kritik kolon bulunamadı: "${c}"`)
  }
  if (warnings.length > 0) {
    return {
      rows: [], uniquePersonnel: [], uniqueProjects: [],
      dateRange: { start: '', end: '' },
      totalRows: 0, skippedRows: 0, warnings,
    }
  }

  const rows: ParsedRow[] = []
  let skippedRows = 0
  const personnelMap = new Map<string, PersonnelSummary>()
  const projectMap = new Map<string, ProjectSummary>()
  const dates: Date[] = []

  for (let i = 1; i < raw.length; i++) {
    const r = raw[i] as unknown[]

    const employeeCode = (r[col('Sicil No')] ?? '').toString().trim()
    const fullName = (r[col('Personel')] ?? '').toString().trim()
    const entryTypeRaw = (r[col('Puantaj Kaydı Türü')] ?? '').toString().trim()

    // Zorunlu alan kontrolü
    if (!employeeCode || !fullName || !entryTypeRaw) {
      skippedRows++
      continue
    }

    // Tarih parse
    let workDate = ''
    const rawDate = r[col('Tarih')]
    if (rawDate instanceof Date) {
      workDate = rawDate.toISOString().split('T')[0]
      dates.push(rawDate)
    } else if (typeof rawDate === 'string') {
      workDate = rawDate.split('T')[0]
    } else if (rawDate) {
      // Excel serial date
      const d = XLSX.SSF.parse_date_code(rawDate as number)
      if (d) {
        workDate = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
        dates.push(new Date(workDate))
      }
    }

    if (!workDate) {
      skippedRows++
      continue
    }

    const entryType = ENTRY_TYPE_MAP[entryTypeRaw] || 'day_off'
    const totalHours = parseFloat((r[col('Süre')] ?? 0).toString()) || 0
    const startTime = r[col('Başlangıç Saati')] != null
      ? parseFloat(r[col('Başlangıç Saati')]!.toString())
      : null
    const endTime = r[col('Bitiş Saati')] != null
      ? parseFloat(r[col('Bitiş Saati')]!.toString())
      : null

    const odooProjectCode = (r[col('Proje Kodu')] ?? '').toString().trim()
    const odooProjectName = (r[col('Proje')] ?? '').toString().trim()
    const odooActivityCode = (r[col('Aktivite')] ?? '').toString().trim()
    const notes = (r[col('Yapılan İş')] ?? '').toString().trim()
    const department = (r[col('Department')] ?? '').toString().trim()
    const odooStatus = (r[col('Durum')] ?? '').toString().trim()

    const mealBreakfast = r[col('Kahvaltı')] === true || r[col('Kahvaltı')] === 1
    const mealLunch = r[col('Öğle Yemeği')] === true || r[col('Öğle Yemeği')] === 1
    const mealDinner = r[col('Akşam Yemeği')] === true || r[col('Akşam Yemeği')] === 1
    const mealNight = r[col('Gece Yemeği')] === true || r[col('Gece Yemeği')] === 1

    // İş satırlarını parse et (Odoo'da 4 slot var)
    const lines: ParsedLine[] = []
    const slotDefs = [
      { typeCol: 'Res Montaj Tipi1', turbineCol: 'Tirbun No1', hourCol: 'RM Saat1' },
      { typeCol: 'Res Montaj Tipi2', turbineCol: 'Tirbun No2', hourCol: 'RM Saat2' },
      { typeCol: 'Res Montaj Tipi3', turbineCol: 'Tirbun No3', hourCol: 'RM Saat3' },
      { typeCol: 'Res Montaj Tipi4', turbineCol: 'Tirbun No4', hourCol: 'RM Saat4' },
    ]

    for (let lineNo = 0; lineNo < 4; lineNo++) {
      const s = slotDefs[lineNo]
      const workTypeRaw = (r[col(s.typeCol)] ?? '').toString().trim()
      const turbineRaw = (r[col(s.turbineCol)] ?? '').toString().trim()
      const hours = parseFloat((r[col(s.hourCol)] ?? 0).toString()) || 0

      // Boş veya PROJE ARASI / DAY OFF satırları ekle ama filtrele
      if (workTypeRaw && workTypeRaw !== '') {
        lines.push({
          lineNo: lineNo + 1,
          workTypeRaw,
          workTypeCode: getWorkTypeCode(workTypeRaw),
          workTypeLabel: getWorkTypeLabel(workTypeRaw),
          turbineRaw,
          hours,
        })
      }
    }

    rows.push({
      employeeCode,
      fullName,
      department,
      workDate,
      entryTypeRaw,
      entryType,
      totalHours,
      startTime,
      endTime,
      odooProjectCode,
      odooProjectName,
      odooActivityCode,
      notes,
      mealBreakfast,
      mealLunch,
      mealDinner,
      mealNight,
      odooStatus,
      lines,
    })

    // Personel özeti
    if (!personnelMap.has(employeeCode)) {
      personnelMap.set(employeeCode, {
        employeeCode,
        fullName,
        department,
        entryCount: 0,
      })
    }
    personnelMap.get(employeeCode)!.entryCount++

    // Proje özeti
    if (odooProjectCode && !projectMap.has(odooProjectCode)) {
      projectMap.set(odooProjectCode, {
        odooCode: odooProjectCode,
        odooName: odooProjectName,
        personnelCount: 0,
      })
    }
    if (odooProjectCode) {
      projectMap.get(odooProjectCode)!.personnelCount++
    }
  }

  const sortedDates = dates.sort((a, b) => a.getTime() - b.getTime())

  return {
    rows,
    uniquePersonnel: Array.from(personnelMap.values()),
    uniqueProjects: Array.from(projectMap.values()),
    dateRange: {
      start: sortedDates[0]?.toISOString().split('T')[0] ?? '',
      end: sortedDates[sortedDates.length - 1]?.toISOString().split('T')[0] ?? '',
    },
    totalRows: raw.length - 1,
    skippedRows,
    warnings,
  }
}
