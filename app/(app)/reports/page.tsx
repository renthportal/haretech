'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  FileBarChart, Users, Building2, Download, Search,
  Calendar, Clock, TrendingUp, ChevronDown, ChevronUp,
} from 'lucide-react'
import { ENTRY_TYPE_LABELS } from '@/lib/odoo-parser'
import toast from 'react-hot-toast'

type ReportMode = 'personnel' | 'project'

export default function ReportsPage() {
  const [mode, setMode] = useState<ReportMode>('personnel')
  const [dateStart, setDateStart] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]
  })
  const [dateEnd, setDateEnd] = useState(() => new Date().toISOString().split('T')[0])
  const [search, setSearch] = useState('')
  const [personnelList, setPersonnelList] = useState<any[]>([])
  const [projectList, setProjectList] = useState<any[]>([])
  const [reportData, setReportData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('personnel').select('id, employee_code, full_name, department').eq('is_active', true).order('full_name').then(({ data }) => setPersonnelList(data || []))
    supabase.from('projects').select('id, name').order('name').then(({ data }) => setProjectList(data || []))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchReport = useCallback(async () => {
    setLoading(true)
    setReportData([])
    setExpanded(null)
    try {
      if (mode === 'personnel') {
        await fetchPersonnelReport()
      } else {
        await fetchProjectReport()
      }
    } finally {
      setLoading(false)
    }
  }, [mode, dateStart, dateEnd]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchPersonnelReport() {
    const { data: entries } = await supabase
      .from('work_entries')
      .select(`
        id, work_date, entry_type, total_hours,
        personnel:personnel_id(id, employee_code, full_name, department),
        projects:project_id(name),
        work_entry_lines(work_type_label, hours)
      `)
      .gte('work_date', dateStart)
      .lte('work_date', dateEnd)
      .order('work_date', { ascending: false })

    if (!entries) return

    // Group by personnel
    const map = new Map<string, any>()
    for (const e of entries) {
      const p: any = e.personnel
      if (!p) continue
      const key = String(p.id)
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          employee_code: p.employee_code,
          full_name: p.full_name,
          department: p.department,
          totalHours: 0,
          onSiteDays: 0,
          standbyDays: 0,
          leaveDays: 0,
          workTypeHours: {} as Record<string, number>,
          entries: [],
        })
      }
      const rec = map.get(key)!
      rec.totalHours += Number(e.total_hours) || 0
      if (e.entry_type === 'on_site') rec.onSiteDays++
      if (e.entry_type === 'standby') rec.standbyDays++
      if (['annual_leave','inter_project_leave','sick_leave','day_off'].includes(e.entry_type)) rec.leaveDays++
      for (const l of (e.work_entry_lines || []) as any[]) {
        if (l.hours > 0 && l.work_type_label && !['Proje Arası','İzin Günü'].includes(l.work_type_label)) {
          rec.workTypeHours[l.work_type_label] = (rec.workTypeHours[l.work_type_label] || 0) + l.hours
        }
      }
      const projArr: any[] = e.projects as any[]
      rec.entries.push({ ...e, project_name: Array.isArray(projArr) ? projArr[0]?.name : null })
    }
    setReportData(Array.from(map.values()).sort((a, b) => b.totalHours - a.totalHours))
  }

  async function fetchProjectReport() {
    const { data: entries } = await supabase
      .from('work_entries')
      .select(`
        id, work_date, entry_type, total_hours, project_id,
        personnel:personnel_id(id, employee_code, full_name),
        projects:project_id(id, name),
        work_entry_lines(work_type_label, hours)
      `)
      .gte('work_date', dateStart)
      .lte('work_date', dateEnd)
      .not('project_id', 'is', null)

    if (!entries) return

    const map = new Map<string, any>()
    for (const e of entries) {
      const projArr: any[] = e.projects as any[]
      const proj = Array.isArray(projArr) ? projArr[0] : null
      if (!proj) continue
      const key = String(proj.id)
      if (!map.has(key)) {
        map.set(key, { id: key, name: proj.name, totalHours: 0, personnelSet: new Set(), workTypeHours: {}, entries: [] })
      }
      const rec = map.get(key)!
      rec.totalHours += Number(e.total_hours) || 0
      const pArr: any[] = e.personnel as any[]
      const person = Array.isArray(pArr) ? pArr[0] : null
      if (person) rec.personnelSet.add(person.full_name)
      for (const l of (e.work_entry_lines || []) as any[]) {
        if (l.hours > 0 && l.work_type_label && !['Proje Arası','İzin Günü'].includes(l.work_type_label)) {
          rec.workTypeHours[l.work_type_label] = (rec.workTypeHours[l.work_type_label] || 0) + l.hours
        }
      }
      rec.entries.push({ ...e, person_name: person?.full_name, person_code: person?.employee_code })
    }
    const result = Array.from(map.values()).map((r) => ({ ...r, uniquePersonnel: r.personnelSet.size }))
    setReportData(result.sort((a, b) => b.totalHours - a.totalHours))
  }

  function exportCSV() {
    if (reportData.length === 0) return
    let csv = ''
    if (mode === 'personnel') {
      csv = 'Sicil,Ad Soyad,Departman,Toplam Saat,Saha Günü,Bekleme,İzin\n'
      for (const r of reportData) {
        csv += `${r.employee_code},"${r.full_name}","${r.department || ''}",${r.totalHours.toFixed(1)},${r.onSiteDays},${r.standbyDays},${r.leaveDays}\n`
      }
    } else {
      csv = 'Proje,Toplam Saat,Personel Sayısı\n'
      for (const r of reportData) {
        csv += `"${r.name}",${r.totalHours.toFixed(1)},${r.uniquePersonnel}\n`
      }
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `windlift-rapor-${mode}-${dateStart}-${dateEnd}.csv`
    a.click()
    toast.success('CSV indirildi')
  }

  const filtered = reportData.filter((r) => {
    const q = search.toLowerCase()
    if (!q) return true
    if (mode === 'personnel') return r.full_name?.toLowerCase().includes(q) || r.employee_code?.includes(q) || r.department?.toLowerCase().includes(q)
    return r.name?.toLowerCase().includes(q)
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Raporlar</h1>
          <p className="text-sm text-gray-500 mt-0.5">Personel ve proje bazlı puantaj analizleri</p>
        </div>
        {reportData.length > 0 && (
          <button onClick={exportCSV} className="btn-ghost">
            <Download className="h-4 w-4" />CSV İndir
          </button>
        )}
      </div>

      {/* Mod seçimi */}
      <div className="flex gap-2">
        <button onClick={() => { setMode('personnel'); setReportData([]) }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'personnel' ? 'bg-wind-700/40 text-wind-300 border border-wind-600/40' : 'btn-ghost'}`}>
          <Users className="h-4 w-4" />Personel Raporu
        </button>
        <button onClick={() => { setMode('project'); setReportData([]) }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'project' ? 'bg-wind-700/40 text-wind-300 border border-wind-600/40' : 'btn-ghost'}`}>
          <Building2 className="h-4 w-4" />Proje Raporu
        </button>
      </div>

      {/* Filtreler */}
      <div className="card flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-500" />
          <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} className="input-field py-1.5 text-sm" />
          <span className="text-gray-500">→</span>
          <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} className="input-field py-1.5 text-sm" />
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Ara..." className="input-field pl-9 py-1.5 text-sm w-48" />
        </div>
        <button onClick={fetchReport} disabled={loading} className="btn-primary ml-auto">
          {loading ? 'Yükleniyor...' : <><FileBarChart className="h-4 w-4" />Rapor Oluştur</>}
        </button>
      </div>

      {/* Özet kartlar */}
      {reportData.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard label={mode === 'personnel' ? 'Toplam Personel' : 'Toplam Proje'} value={filtered.length} icon={<Users className="h-4 w-4" />} color="text-white" />
          <SummaryCard label="Toplam Saat" value={filtered.reduce((s, r) => s + r.totalHours, 0).toFixed(1) + 's'} icon={<Clock className="h-4 w-4" />} color="text-wind-400" />
          {mode === 'personnel' && <>
            <SummaryCard label="Toplam Saha Günü" value={filtered.reduce((s, r) => s + r.onSiteDays, 0)} icon={<TrendingUp className="h-4 w-4" />} color="text-green-400" />
            <SummaryCard label="Toplam İzin Günü" value={filtered.reduce((s, r) => s + r.leaveDays, 0)} icon={<Calendar className="h-4 w-4" />} color="text-gray-400" />
          </>}
          {mode === 'project' && <>
            <SummaryCard label="Ortalama Saat/Proje" value={(filtered.reduce((s, r) => s + r.totalHours, 0) / (filtered.length || 1)).toFixed(1) + 's'} icon={<TrendingUp className="h-4 w-4" />} color="text-blue-400" />
            <SummaryCard label="Toplam Personel" value={new Set(filtered.flatMap((r) => Array.from(r.personnelSet || []))).size} icon={<Users className="h-4 w-4" />} color="text-purple-400" />
          </>}
        </div>
      )}

      {/* Sonuçlar */}
      {reportData.length === 0 && !loading && (
        <div className="card text-center py-12">
          <FileBarChart className="h-12 w-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">Tarih aralığı seçip "Rapor Oluştur" butonuna basın</p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="space-y-2">
          {mode === 'personnel' ? (
            <>
              {/* Tablo başlığı */}
              <div className="grid grid-cols-7 gap-2 px-4 py-2 text-xs text-gray-500 uppercase tracking-wider font-medium">
                <div className="col-span-2">Personel</div>
                <div className="text-right">Toplam Saat</div>
                <div className="text-right">Saha</div>
                <div className="text-right">Bekleme</div>
                <div className="text-right">İzin</div>
                <div></div>
              </div>
              {filtered.map((r) => (
                <div key={r.id} className="card p-0 overflow-hidden">
                  <button className="w-full grid grid-cols-7 gap-2 px-4 py-3 hover:bg-surface-light/30 transition-colors text-left"
                    onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                    <div className="col-span-2">
                      <p className="text-sm font-medium text-gray-200">{r.full_name}</p>
                      <p className="text-xs text-gray-500">#{r.employee_code}{r.department && ` · ${r.department}`}</p>
                    </div>
                    <div className="text-right text-sm font-bold text-wind-400">{r.totalHours.toFixed(1)}s</div>
                    <div className="text-right text-sm text-green-400">{r.onSiteDays}g</div>
                    <div className="text-right text-sm text-yellow-400">{r.standbyDays}g</div>
                    <div className="text-right text-sm text-gray-400">{r.leaveDays}g</div>
                    <div className="flex justify-end">{expanded === r.id ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}</div>
                  </button>
                  {expanded === r.id && (
                    <div className="border-t border-wind-700/20 px-4 py-3 space-y-3">
                      {/* İş tipi dağılımı */}
                      {Object.keys(r.workTypeHours).length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-gray-400 mb-2">İş Tipi Dağılımı</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {Object.entries(r.workTypeHours).sort(([,a],[,b]) => (b as number)-(a as number)).map(([label, hours]) => (
                              <div key={label} className="flex justify-between text-xs bg-surface-light rounded px-2 py-1">
                                <span className="text-gray-400 truncate pr-2">{label}</span>
                                <span className="text-gray-200 font-medium">{hours as number}s</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Günlük kayıtlar */}
                      <div>
                        <p className="text-xs font-medium text-gray-400 mb-2">Günlük Kayıtlar ({r.entries.length})</p>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {r.entries.map((e: any) => (
                            <div key={e.id} className="flex items-center gap-3 text-xs py-1 border-b border-wind-700/10">
                              <span className="font-mono text-gray-500 w-20 flex-shrink-0">{e.work_date}</span>
                              <span className="badge badge-gray text-xs py-0">{ENTRY_TYPE_LABELS[e.entry_type] || e.entry_type}</span>
                              {e.project_name && <span className="text-gray-500 truncate">{e.project_name}</span>}
                              <span className="text-gray-400 ml-auto">{e.total_hours}s</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </>
          ) : (
            <>
              <div className="grid grid-cols-5 gap-2 px-4 py-2 text-xs text-gray-500 uppercase tracking-wider font-medium">
                <div className="col-span-2">Proje</div>
                <div className="text-right">Toplam Saat</div>
                <div className="text-right">Personel</div>
                <div></div>
              </div>
              {filtered.map((r) => (
                <div key={r.id} className="card p-0 overflow-hidden">
                  <button className="w-full grid grid-cols-5 gap-2 px-4 py-3 hover:bg-surface-light/30 transition-colors text-left"
                    onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                    <div className="col-span-2">
                      <p className="text-sm font-medium text-gray-200">{r.name}</p>
                      <p className="text-xs text-gray-500">{r.uniquePersonnel} farklı personel çalışmış</p>
                    </div>
                    <div className="text-right text-sm font-bold text-wind-400">{r.totalHours.toFixed(1)}s</div>
                    <div className="text-right text-sm text-blue-400">{r.uniquePersonnel} kişi</div>
                    <div className="flex justify-end">{expanded === r.id ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}</div>
                  </button>
                  {expanded === r.id && (
                    <div className="border-t border-wind-700/20 px-4 py-3 space-y-3">
                      {/* İş tipi dağılımı */}
                      {Object.keys(r.workTypeHours).length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-gray-400 mb-2">İş Tipi Dağılımı</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {Object.entries(r.workTypeHours).sort(([,a],[,b]) => (b as number)-(a as number)).map(([label, hours]) => (
                              <div key={label} className="flex justify-between text-xs bg-surface-light rounded px-2 py-1">
                                <span className="text-gray-400 truncate pr-2">{label}</span>
                                <span className="text-gray-200 font-medium">{hours as number}s</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Personel listesi */}
                      <div>
                        <p className="text-xs font-medium text-gray-400 mb-2">Çalışan Personel</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                          {Array.from(r.personnelSet as Set<string>).sort().map((name: string) => (
                            <div key={name} className="text-xs text-gray-300 py-0.5">· {name}</div>
                          ))}
                        </div>
                      </div>
                      {/* Günlük kayıtlar */}
                      <div>
                        <p className="text-xs font-medium text-gray-400 mb-2">Kayıtlar ({r.entries.length})</p>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {r.entries.sort((a: any, b: any) => b.work_date.localeCompare(a.work_date)).map((e: any) => (
                            <div key={e.id} className="flex items-center gap-3 text-xs py-1 border-b border-wind-700/10">
                              <span className="font-mono text-gray-500 w-20 flex-shrink-0">{e.work_date}</span>
                              <span className="text-gray-300">{e.person_name}</span>
                              <span className="badge badge-gray text-xs py-0">{ENTRY_TYPE_LABELS[e.entry_type] || e.entry_type}</span>
                              <span className="text-gray-400 ml-auto">{e.total_hours}s</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) {
  return (
    <div className="card">
      <div className="flex items-center gap-1.5 text-gray-500 mb-1 text-xs">{icon}{label}</div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}
