// ============================================
// WindLift - Odoo Puantaj Excel Parser
// lib/odoo-parser.ts
// ============================================

/* eslint-disable @typescript-eslint/no-explicit-any */
import * as XLSX from 'xlsx'

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
  return raw.split('-')[0].trim().toUpperCase()
}

function getWorkTypeLabel(raw: string): string {
  return WORK_TYPE_LABELS[raw] || raw || ''
}

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

export interface ParsedLine {
  lineNo: number
  workTypeRaw: string
  workTypeCode: string
  workTypeLabel: string
  turbineRaw: string
  hours: number
}

export interface ParsedRow {
  employeeCode: string
  fullName: string
  department: string
  workDate: string
  entryTypeRaw: string
  entryType: string
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

export interface ParseResult {
  rows: ParsedRow[]
  uniquePersonnel: PersonnelSummary[]
  uniqueProjects: ProjectSummary[]
  dateRange: { start: string; end: string }
  totalRows: number
  skippedRows: number
  warnings: string[]
}

export function parseOdooExcel(buffer: ArrayBuffer): ParseResult {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  // Parse as array-of-arrays using unknown to avoid cast conflicts
  const rawData: unknown = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
  const raw: any[][] = rawData as any[][]

  if (!raw || raw.length < 2) {
    return {
      rows: [], uniquePersonnel: [], uniqueProjects: [],
      dateRange: { start: '', end: '' },
      totalRows: 0, skippedRows: 0,
      warnings: ['Dosya boş veya geçersiz format.'],
    }
  }

  const headers: string[] = (raw[0] as any[]).map((h: any) => String(h ?? '').trim())
  const col = (name: string) => headers.indexOf(name)

  const warnings: string[] = []
  for (const c of ['Sicil No', 'Personel', 'Tarih', 'Puantaj Kaydı Türü']) {
    if (col(c) === -1) warnings.push(`Kritik kolon bulunamadı: "${c}"`)
  }
  if (warnings.length > 0 && col('Sicil No') === -1) {
    return { rows: [], uniquePersonnel: [], uniqueProjects: [], dateRange: { start: '', end: '' }, totalRows: 0, skippedRows: 0, warnings }
  }

  const rows: ParsedRow[] = []
  let skippedRows = 0
  const personnelMap = new Map<string, PersonnelSummary>()
  const projectMap = new Map<string, ProjectSummary>()
  const dates: Date[] = []

  for (let i = 1; i < raw.length; i++) {
    const r: any[] = raw[i] as any[]
    const employeeCode = String(r[col('Sicil No')] ?? '').trim()
    const fullName = String(r[col('Personel')] ?? '').trim()
    const entryTypeRaw = String(r[col('Puantaj Kaydı Türü')] ?? '').trim()

    if (!employeeCode || !fullName || !entryTypeRaw) { skippedRows++; continue }

    let workDate = ''
    const rawDate = r[col('Tarih')]
    if (rawDate instanceof Date) {
      workDate = rawDate.toISOString().split('T')[0]
      dates.push(rawDate)
    } else if (typeof rawDate === 'string') {
      workDate = rawDate.split('T')[0]
    } else if (rawDate != null) {
      try {
        const d = XLSX.SSF.parse_date_code(Number(rawDate))
        if (d) {
          workDate = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
          dates.push(new Date(workDate))
        }
      } catch { /* skip */ }
    }
    if (!workDate) { skippedRows++; continue }

    const entryType = ENTRY_TYPE_MAP[entryTypeRaw] || 'day_off'
    const totalHours = parseFloat(String(r[col('Süre')] ?? 0)) || 0
    const startRaw = r[col('Başlangıç Saati')]
    const endRaw = r[col('Bitiş Saati')]
    const startTime = startRaw != null ? parseFloat(String(startRaw)) : null
    const endTime = endRaw != null ? parseFloat(String(endRaw)) : null

    const odooProjectCode = String(r[col('Proje Kodu')] ?? '').trim()
    const odooProjectName = String(r[col('Proje')] ?? '').trim()
    const odooActivityCode = String(r[col('Aktivite')] ?? '').trim()
    const notes = String(r[col('Yapılan İş')] ?? '').trim()
    const department = String(r[col('Department')] ?? '').trim()
    const odooStatus = String(r[col('Durum')] ?? '').trim()

    const isTruthy = (v: any) => v === true || v === 1 || v === '1' || v === 'True'
    const mealBreakfast = isTruthy(r[col('Kahvaltı')])
    const mealLunch = isTruthy(r[col('Öğle Yemeği')])
    const mealDinner = isTruthy(r[col('Akşam Yemeği')])
    const mealNight = isTruthy(r[col('Gece Yemeği')])

    const slotDefs = [
      { typeCol: 'Res Montaj Tipi1', turbineCol: 'Tirbun No1', hourCol: 'RM Saat1' },
      { typeCol: 'Res Montaj Tipi2', turbineCol: 'Tirbun No2', hourCol: 'RM Saat2' },
      { typeCol: 'Res Montaj Tipi3', turbineCol: 'Tirbun No3', hourCol: 'RM Saat3' },
      { typeCol: 'Res Montaj Tipi4', turbineCol: 'Tirbun No4', hourCol: 'RM Saat4' },
    ]

    const lines: ParsedLine[] = []
    for (let lineNo = 0; lineNo < 4; lineNo++) {
      const s = slotDefs[lineNo]
      const workTypeRaw = String(r[col(s.typeCol)] ?? '').trim()
      const turbineRaw = String(r[col(s.turbineCol)] ?? '').trim()
      const hours = parseFloat(String(r[col(s.hourCol)] ?? 0)) || 0
      if (workTypeRaw) {
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
      employeeCode, fullName, department, workDate,
      entryTypeRaw, entryType, totalHours, startTime, endTime,
      odooProjectCode, odooProjectName, odooActivityCode,
      notes, mealBreakfast, mealLunch, mealDinner, mealNight,
      odooStatus, lines,
    })

    if (!personnelMap.has(employeeCode)) {
      personnelMap.set(employeeCode, { employeeCode, fullName, department, entryCount: 0 })
    }
    personnelMap.get(employeeCode)!.entryCount++

    if (odooProjectCode && !projectMap.has(odooProjectCode)) {
      projectMap.set(odooProjectCode, { odooCode: odooProjectCode, odooName: odooProjectName, personnelCount: 0 })
    }
    if (odooProjectCode) projectMap.get(odooProjectCode)!.personnelCount++
  }

  const sortedDates = dates.slice().sort((a, b) => a.getTime() - b.getTime())
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
