'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AlertTriangle, Users, Calendar, Search, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ConflictsPage() {
  const [dateStart, setDateStart] = useState(() => new Date().toISOString().split('T')[0])
  const [dateEnd, setDateEnd] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split('T')[0]
  })
  const [search, setSearch] = useState('')
  const [conflicts, setConflicts] = useState<any[]>([])
  const [availability, setAvailability] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'conflicts' | 'availability'>('conflicts')
  const supabase = createClient()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      // Tüm work_entries çek (tarih aralığında)
      const { data: entries } = await supabase
        .from('work_entries')
        .select(`
          id, work_date, entry_type, total_hours,
          personnel:personnel_id(id, employee_code, full_name, department),
          projects:project_id(id, name)
        `)
        .gte('work_date', dateStart)
        .lte('work_date', dateEnd)
        .order('work_date')

      if (!entries) { setLoading(false); return }

      // Aynı kişi aynı günde birden fazla projede mi?
      const dayPersonMap = new Map<string, any[]>() // key: "personId_date"
      for (const e of entries) {
        const p = Array.isArray(e.personnel) ? (e.personnel as any[])[0] : e.personnel
        const proj = Array.isArray(e.projects) ? (e.projects as any[])[0] : e.projects
        if (!p) continue
        const key = `${p.id}_${e.work_date}`
        if (!dayPersonMap.has(key)) dayPersonMap.set(key, [])
        dayPersonMap.get(key)!.push({ ...e, person: p, project: proj })
      }

      // Çakışmaları bul: aynı kişi aynı gün 2+ farklı projede
      const conflictList: any[] = []
      for (const [, dayEntries] of Array.from(dayPersonMap.entries())) {
        const projects = new Set(dayEntries.map((e) => e.project?.id).filter(Boolean))
        if (projects.size > 1) {
          const person = dayEntries[0].person
          conflictList.push({
            person,
            date: dayEntries[0].work_date,
            entries: dayEntries,
            projects: Array.from(projects).map((pid) => {
              const e = dayEntries.find((x) => x.project?.id === pid)
              return { id: pid, name: e?.project?.name, hours: e?.total_hours, entry_type: e?.entry_type }
            })
          })
        }
      }

      // Kişi bazlı müsaitlik özeti
      const personMap = new Map<string, any>()
      for (const e of entries) {
        const p = Array.isArray(e.personnel) ? (e.personnel as any[])[0] : e.personnel
        if (!p) continue
        if (!personMap.has(p.id)) {
          personMap.set(p.id, {
            id: p.id, employee_code: p.employee_code, full_name: p.full_name,
            department: p.department, totalDays: 0, onSiteDays: 0, leaveDays: 0,
            standbyDays: 0, projects: new Set<string>(), dates: new Set<string>()
          })
        }
        const rec = personMap.get(p.id)!
        rec.dates.add(e.work_date)
        rec.totalDays++
        if (e.entry_type === 'on_site') rec.onSiteDays++
        if (['annual_leave','inter_project_leave','sick_leave','day_off'].includes(e.entry_type)) rec.leaveDays++
        if (e.entry_type === 'standby') rec.standbyDays++
        const proj = Array.isArray(e.projects) ? (e.projects as any[])[0] : e.projects
        if (proj?.name) rec.projects.add(proj.name)
      }

      setConflicts(conflictList.sort((a, b) => a.date.localeCompare(b.date)))
      setAvailability(Array.from(personMap.values()).map((r) => ({
        ...r,
        uniqueDays: r.dates.size,
        projectList: Array.from(r.projects as Set<string>),
      })).sort((a, b) => b.onSiteDays - a.onSiteDays))

    } catch (err) {
      toast.error('Veri yüklenemedi')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [dateStart, dateEnd, supabase])

  useEffect(() => { fetchData() }, [fetchData])

  const filteredConflicts = conflicts.filter((c) => {
    if (!search) return true
    const q = search.toLowerCase()
    return c.person?.full_name?.toLowerCase().includes(q) || c.person?.employee_code?.includes(q)
  })

  const filteredAvailability = availability.filter((p) => {
    if (!search) return true
    const q = search.toLowerCase()
    return p.full_name?.toLowerCase().includes(q) || p.employee_code?.includes(q) || p.department?.toLowerCase().includes(q)
  })

  const ENTRY_LABELS: Record<string, string> = {
    on_site: 'Saha', travel: 'Yol', standby: 'Bekleme',
    annual_leave: 'Yıllık İzin', sick_leave: 'Rapor', day_off: 'Tatil',
    inter_project_leave: 'Proje Arası', training: 'Eğitim',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Kaynak Çakışması & Müsaitlik</h1>
        <p className="text-sm text-gray-500 mt-0.5">Aynı anda birden fazla projede görünen personeli ve müsait kapasiteyi görün</p>
      </div>

      {/* Mod */}
      <div className="flex gap-2">
        <button onClick={() => setMode('conflicts')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'conflicts' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'btn-ghost'}`}>
          <AlertTriangle className="h-4 w-4" />Çakışmalar {conflicts.length > 0 && <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{conflicts.length}</span>}
        </button>
        <button onClick={() => setMode('availability')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'availability' ? 'bg-wind-700/40 text-wind-300 border border-wind-600/40' : 'btn-ghost'}`}>
          <Users className="h-4 w-4" />Personel Müsaitlik
        </button>
      </div>

      {/* Filtreler */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-500" />
          <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} className="input-field py-1.5 text-sm" />
          <span className="text-gray-500">→</span>
          <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} className="input-field py-1.5 text-sm" />
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Personel ara..." className="input-field pl-9 py-1.5 text-sm w-48" />
        </div>
      </div>

      {loading ? (
        <div className="card text-center py-12 text-gray-500">Yükleniyor...</div>
      ) : mode === 'conflicts' ? (
        <>
          {filteredConflicts.length === 0 ? (
            <div className="card text-center py-12">
              <CheckCircle2 className="h-12 w-12 text-wind-400 mx-auto mb-3" />
              <p className="text-gray-200 font-medium">Çakışma yok</p>
              <p className="text-sm text-gray-500 mt-1">Seçilen tarih aralığında aynı anda birden fazla projede kayıtlı personel bulunamadı.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">{filteredConflicts.length} çakışma bulundu — aynı personel aynı gün 2+ projede kayıtlı</p>
              {filteredConflicts.map((c, i) => (
                <div key={i} className="card border-red-500/20 bg-red-500/5">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm font-bold text-gray-100">{c.person?.full_name}</span>
                        <span className="text-xs text-gray-500">#{c.person?.employee_code}</span>
                        <span className="text-xs font-mono text-red-300">{c.date}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {c.projects.map((proj: any, j: number) => (
                          <div key={j} className="flex items-center gap-2 bg-surface-light rounded-lg px-3 py-1.5">
                            <span className="text-xs font-medium text-gray-200">{proj.name || 'Proje yok'}</span>
                            <span className="text-xs text-gray-500">{ENTRY_LABELS[proj.entry_type] || proj.entry_type}</span>
                            <span className="text-xs text-wind-400">{proj.hours}s</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-red-300/70 mt-2">Bu kişi bu günde {c.projects.length} farklı projede kayıtlı görünüyor. Import verisini kontrol edin.</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {/* KPI */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KPICard label="Toplam Personel" value={filteredAvailability.length} color="text-white" />
            <KPICard label="Saha Günü (Top.)" value={filteredAvailability.reduce((s, p) => s + p.onSiteDays, 0)} color="text-wind-400" />
            <KPICard label="İzin Günü (Top.)" value={filteredAvailability.reduce((s, p) => s + p.leaveDays, 0)} color="text-gray-400" />
            <KPICard label="Bekleme (Top.)" value={filteredAvailability.reduce((s, p) => s + p.standbyDays, 0)} color="text-yellow-400" />
          </div>

          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-wind-700/20">
                    {['Personel','Departman','Saha Günü','İzin','Bekleme','Projeler','Doluluk'].map((h) => (
                      <th key={h} className="text-left text-xs text-gray-500 uppercase tracking-wider px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-wind-700/10">
                  {filteredAvailability.map((p) => {
                    const totalPeriodDays = Math.round((new Date(dateEnd).getTime() - new Date(dateStart).getTime()) / 86400000) + 1
                    const busyPct = Math.min(100, Math.round((p.uniqueDays / totalPeriodDays) * 100))
                    return (
                      <tr key={p.id} className="hover:bg-surface-light/30">
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-200">{p.full_name}</p>
                          <p className="text-xs text-gray-500">#{p.employee_code}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-400">{p.department || '—'}</td>
                        <td className="px-4 py-3 text-sm font-bold text-wind-400">{p.onSiteDays}g</td>
                        <td className="px-4 py-3 text-sm text-gray-400">{p.leaveDays}g</td>
                        <td className="px-4 py-3 text-sm text-yellow-400">{p.standbyDays}g</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {p.projectList.slice(0,3).map((name: string, i: number) => (
                              <span key={i} className="text-xs bg-surface-light text-gray-300 px-2 py-0.5 rounded-full truncate max-w-[120px]">{name}</span>
                            ))}
                            {p.projectList.length > 3 && <span className="text-xs text-gray-500">+{p.projectList.length - 3}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 w-32">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-surface-light rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-wind-600" style={{ width: `${busyPct}%` }} />
                            </div>
                            <span className="text-xs text-gray-500 w-8 text-right">%{busyPct}</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function KPICard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="card">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  )
}
