'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import {
  Calendar, ChevronDown, ChevronUp, AlertTriangle,
  CheckCircle2, Clock, Edit2, Save, X, Plus,
} from 'lucide-react'
import toast from 'react-hot-toast'

const PHASES = [
  { key: 'foundation', label: 'Temel', color: '#6366f1' },
  { key: 'tower',      label: 'Kule',  color: '#0ea5e9' },
  { key: 'nacelle',    label: 'Nasel', color: '#f59e0b' },
  { key: 'hub',        label: 'Hub',   color: '#10b981' },
  { key: 'blades',     label: 'Kanatlar', color: '#22d3ee' },
  { key: 'commissioning', label: 'Devreye Alma', color: '#a78bfa' },
]

const STATUS_COLORS: Record<string, string> = {
  not_started: 'text-gray-400',
  in_progress: 'text-blue-400',
  completed: 'text-wind-400',
  delayed: 'text-red-400',
  cancelled: 'text-gray-600',
}

export default function PlanningPage() {
  const { profile } = useProfile()
  const [projects, setProjects] = useState<any[]>([])
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [turbines, setTurbines] = useState<any[]>([])
  const [plans, setPlans] = useState<any[]>([]) // turbine_plans rows
  const [loading, setLoading] = useState(false)
  const [editCell, setEditCell] = useState<{ turbineId: string; phase: string } | null>(null)
  const [editForm, setEditForm] = useState({ planned_start: '', planned_end: '', actual_start: '', actual_end: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [viewMode, setViewMode] = useState<'table' | 'gantt'>('gantt')
  const [expanded, setExpanded] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('projects').select('id, name, start_date, target_end_date').order('name').then(({ data }) => {
      setProjects(data || [])
      if (data && data.length > 0) setSelectedProject(data[0].id)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = useCallback(async () => {
    if (!selectedProject) return
    setLoading(true)
    const [{ data: t }, { data: p }] = await Promise.all([
      supabase.from('turbines').select('*').eq('project_id', selectedProject).order('turbine_number'),
      supabase.from('turbine_plans').select('*').eq('project_id', selectedProject),
    ])
    setTurbines(t || [])
    setPlans(p || [])
    setLoading(false)
  }, [selectedProject, supabase])

  useEffect(() => { fetchData() }, [fetchData])

  // Plan lookup
  const getPlan = (turbineId: string, phase: string) =>
    plans.find((p) => p.turbine_id === turbineId && p.phase === phase) || null

  function openEdit(turbineId: string, phase: string) {
    const plan = getPlan(turbineId, phase)
    setEditForm({
      planned_start: plan?.planned_start || '',
      planned_end: plan?.planned_end || '',
      actual_start: plan?.actual_start || '',
      actual_end: plan?.actual_end || '',
      notes: plan?.notes || '',
    })
    setEditCell({ turbineId, phase })
  }

  async function savePlan() {
    if (!editCell || !profile?.org_id) return
    setSaving(true)
    const existing = getPlan(editCell.turbineId, editCell.phase)
    const payload = {
      org_id: profile.org_id,
      turbine_id: editCell.turbineId,
      project_id: selectedProject,
      phase: editCell.phase,
      planned_start: editForm.planned_start || null,
      planned_end: editForm.planned_end || null,
      actual_start: editForm.actual_start || null,
      actual_end: editForm.actual_end || null,
      notes: editForm.notes || null,
      status: editForm.actual_end ? 'completed' : editForm.actual_start ? 'in_progress' : editForm.planned_start ? 'not_started' : 'not_started',
    }
    const { error } = existing
      ? await supabase.from('turbine_plans').update(payload).eq('id', existing.id)
      : await supabase.from('turbine_plans').insert(payload)
    if (error) toast.error('Kaydedilemedi: ' + error.message)
    else { toast.success('Kaydedildi'); fetchData() }
    setSaving(false)
    setEditCell(null)
  }

  async function bulkCreatePlans() {
    if (!profile?.org_id || turbines.length === 0) return
    const toInsert: any[] = []
    for (const t of turbines) {
      for (const ph of PHASES) {
        if (!getPlan(t.id, ph.key)) {
          toInsert.push({ org_id: profile.org_id, turbine_id: t.id, project_id: selectedProject, phase: ph.key, status: 'not_started' })
        }
      }
    }
    if (toInsert.length === 0) { toast('Tüm planlar zaten mevcut'); return }
    const { error } = await supabase.from('turbine_plans').insert(toInsert)
    if (error) toast.error(error.message)
    else { toast.success(`${toInsert.length} plan satırı oluşturuldu`); fetchData() }
  }

  // Gantt hesaplamaları
  const project = projects.find((p) => p.id === selectedProject)
  const ganttStart = project?.start_date ? new Date(project.start_date) : new Date()
  const ganttEnd = project?.target_end_date ? new Date(project.target_end_date) : new Date(ganttStart.getTime() + 180 * 86400000)
  const totalDays = Math.max(1, (ganttEnd.getTime() - ganttStart.getTime()) / 86400000)

  function dayOffset(dateStr: string) {
    if (!dateStr) return 0
    return Math.max(0, (new Date(dateStr).getTime() - ganttStart.getTime()) / 86400000)
  }
  function dayWidth(startStr: string, endStr: string) {
    if (!startStr || !endStr) return 0
    return Math.max(0.5, (new Date(endStr).getTime() - new Date(startStr).getTime()) / 86400000)
  }

  // Proje özet istatistikleri
  const totalPlans = turbines.length * PHASES.length
  const filledPlans = plans.filter((p) => p.planned_start).length
  const completedPlans = plans.filter((p) => p.status === 'completed').length
  const delayedPlans = plans.filter((p) => (p.variance_days || 0) > 0 && p.status !== 'completed').length

  // Kritik yol: en geç biten türbin
  const turbineLatestEnd = turbines.map((t) => {
    const tPlans = plans.filter((p) => p.turbine_id === t.id && p.planned_end)
    if (tPlans.length === 0) return { turbine: t, latestEnd: null, delay: null }
    const latest = tPlans.reduce((max, p) => p.planned_end > (max?.planned_end || '') ? p : max, tPlans[0])
    const actualLatest = tPlans.filter((p) => p.actual_end).reduce((max, p) => !max || p.actual_end > max.actual_end ? p : max, null as any)
    const delay = latest.variance_days || 0
    return { turbine: t, latestEnd: latest.planned_end, delay }
  }).filter((x) => x.latestEnd).sort((a, b) => (b.delay || 0) - (a.delay || 0))

  const criticalTurbine = turbineLatestEnd[0]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Gantt Planlama</h1>
          <p className="text-sm text-gray-500 mt-0.5">Türbin bazlı iş planı ve ilerleme takibi</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-surface-light rounded-lg p-1">
            <button onClick={() => setViewMode('gantt')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${viewMode === 'gantt' ? 'bg-wind-700/60 text-wind-300' : 'text-gray-400 hover:text-gray-200'}`}>
              📊 Gantt
            </button>
            <button onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${viewMode === 'table' ? 'bg-wind-700/60 text-wind-300' : 'text-gray-400 hover:text-gray-200'}`}>
              📋 Tablo
            </button>
          </div>
        </div>
      </div>

      {/* Proje seçimi */}
      <div className="flex items-center gap-3 flex-wrap">
        <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)} className="input-field w-72">
          <option value="">Proje seçin</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {selectedProject && (
          <button onClick={bulkCreatePlans} className="btn-ghost text-sm">
            <Plus className="h-4 w-4" />Tüm Plan Satırlarını Oluştur
          </button>
        )}
      </div>

      {!selectedProject ? (
        <div className="card text-center py-12 text-gray-500">Proje seçin</div>
      ) : loading ? (
        <div className="card text-center py-12 text-gray-500">Yükleniyor...</div>
      ) : turbines.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">
          Bu projede türbin yok. Önce proje detayından türbin ekleyin.
        </div>
      ) : (
        <>
          {/* KPI */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KPICard label="Plan Doluluk" value={`%${Math.round((filledPlans/totalPlans)*100)}`} sub={`${filledPlans}/${totalPlans} faz`} color="text-white" />
            <KPICard label="Tamamlanan Faz" value={completedPlans} sub={`${totalPlans} fazdan`} color="text-wind-400" />
            <KPICard label="Gecikmeli Faz" value={delayedPlans} sub="gün gecikmeli" color={delayedPlans > 0 ? 'text-red-400' : 'text-gray-400'} />
            <KPICard label="Kritik Türbin" value={criticalTurbine ? `T${criticalTurbine.turbine?.turbine_number}` : '—'}
              sub={criticalTurbine?.delay ? `${criticalTurbine.delay > 0 ? '+' : ''}${criticalTurbine.delay}g` : 'zamanında'}
              color={criticalTurbine?.delay > 0 ? 'text-red-400' : 'text-wind-400'} />
          </div>

          {/* GANTT GÖRÜNÜMÜ */}
          {viewMode === 'gantt' && (
            <div className="card p-0 overflow-hidden">
              <div className="px-5 py-3 border-b border-wind-700/20 flex items-center gap-4 flex-wrap">
                <h3 className="text-sm font-semibold text-gray-200">Zaman Çizelgesi</h3>
                <div className="flex items-center gap-3 ml-auto text-xs text-gray-500">
                  <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded opacity-60" style={{background:'#6366f1'}}></span>Planlanan</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded opacity-90" style={{background:'#22c55e'}}></span>Gerçekleşen</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded" style={{background:'#ef4444'}}></span>Gecikme</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <div style={{ minWidth: '900px' }}>
                  {/* Ay başlıkları */}
                  <GanttHeader start={ganttStart} end={ganttEnd} />

                  {/* Türbin satırları */}
                  {turbines.map((t) => {
                    const tPlans = plans.filter((p) => p.turbine_id === t.id)
                    const hasDelay = tPlans.some((p) => (p.variance_days || 0) > 0 && p.status !== 'completed')
                    return (
                      <div key={t.id} className="border-b border-wind-700/10 hover:bg-surface-light/20">
                        {/* Türbin label */}
                        <div className="flex items-center">
                          <div className="w-32 flex-shrink-0 px-3 py-2 flex items-center gap-2 border-r border-wind-700/20">
                            <span className="text-sm font-bold text-gray-200 font-mono">T{t.turbine_number}</span>
                            {hasDelay && <AlertTriangle className="h-3.5 w-3.5 text-red-400" />}
                          </div>
                          {/* Gantt bars */}
                          <div className="flex-1 relative h-10 px-2 py-1">
                            {PHASES.map((ph) => {
                              const plan = getPlan(t.id, ph.key)
                              if (!plan?.planned_start) return null
                              const pLeft = (dayOffset(plan.planned_start) / totalDays) * 100
                              const pWidth = (dayWidth(plan.planned_start, plan.planned_end) / totalDays) * 100
                              const aLeft = plan.actual_start ? (dayOffset(plan.actual_start) / totalDays) * 100 : null
                              const aWidth = plan.actual_start ? (dayWidth(plan.actual_start, plan.actual_end || new Date().toISOString().split('T')[0]) / totalDays) * 100 : null
                              const isDelayed = (plan.variance_days || 0) > 0 && plan.status !== 'completed'
                              return (
                                <div key={ph.key}>
                                  {/* Planlanan bar */}
                                  <div title={`${ph.label}: ${plan.planned_start} → ${plan.planned_end}`}
                                    style={{ left: `${pLeft}%`, width: `${Math.max(pWidth, 0.5)}%`, background: ph.color + '55', border: `1px solid ${ph.color}88` }}
                                    className="absolute top-1 h-3.5 rounded cursor-pointer hover:opacity-80"
                                    onClick={() => openEdit(t.id, ph.key)}
                                  />
                                  {/* Gerçekleşen bar */}
                                  {aLeft !== null && aWidth !== null && (
                                    <div title={`Gerçekleşen: ${plan.actual_start} → ${plan.actual_end || 'devam'}`}
                                      style={{ left: `${aLeft}%`, width: `${Math.max(aWidth, 0.5)}%`, background: isDelayed ? '#ef4444cc' : '#22c55ecc' }}
                                      className="absolute bottom-1 h-3.5 rounded"
                                    />
                                  )}
                                </div>
                              )
                            })}
                          </div>
                          <button onClick={() => openEdit(t.id, PHASES[0].key)}
                            className="flex-shrink-0 px-2 text-gray-600 hover:text-gray-300">
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {/* Faz detayları - collapsed by default */}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Legend */}
              <div className="px-5 py-3 border-t border-wind-700/20 flex flex-wrap gap-3">
                {PHASES.map((ph) => (
                  <span key={ph.key} className="flex items-center gap-1.5 text-xs text-gray-400">
                    <span className="inline-block w-3 h-2 rounded" style={{ background: ph.color }}></span>
                    {ph.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* TABLO GÖRÜNÜMÜ */}
          {viewMode === 'table' && (
            <div className="space-y-2">
              {turbines.map((t) => {
                const tPlans = plans.filter((p) => p.turbine_id === t.id)
                const hasDelay = tPlans.some((p) => (p.variance_days || 0) > 0 && p.status !== 'completed')
                const completedCount = tPlans.filter((p) => p.status === 'completed').length
                return (
                  <div key={t.id} className="card p-0 overflow-hidden">
                    <button className="w-full flex items-center gap-4 px-5 py-3 hover:bg-surface-light/30 transition-colors"
                      onClick={() => setExpanded(expanded === t.id ? null : t.id)}>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-gray-100 font-mono w-8">T{t.turbine_number}</span>
                        {hasDelay && <AlertTriangle className="h-4 w-4 text-red-400" />}
                        {completedCount === PHASES.length && <CheckCircle2 className="h-4 w-4 text-wind-400" />}
                      </div>
                      {/* Mini faz durumu */}
                      <div className="flex gap-1 flex-1">
                        {PHASES.map((ph) => {
                          const plan = getPlan(t.id, ph.key)
                          const delay = plan?.variance_days || 0
                          const bg = !plan?.planned_start ? 'bg-gray-800' :
                            plan.status === 'completed' ? 'bg-wind-600' :
                            delay > 0 ? 'bg-red-500' :
                            plan.status === 'in_progress' ? 'bg-blue-500' : 'bg-gray-600'
                          return (
                            <div key={ph.key} title={ph.label} className={`flex-1 h-2 rounded-full ${bg}`} />
                          )
                        })}
                      </div>
                      <div className="text-xs text-gray-500">{completedCount}/{PHASES.length} faz</div>
                      {expanded === t.id ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
                    </button>

                    {expanded === t.id && (
                      <div className="border-t border-wind-700/20 overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-wind-700/10">
                              <th className="text-left text-xs text-gray-500 px-4 py-2 w-28">Faz</th>
                              <th className="text-left text-xs text-gray-500 px-3 py-2">Plan Başlangıç</th>
                              <th className="text-left text-xs text-gray-500 px-3 py-2">Plan Bitiş</th>
                              <th className="text-left text-xs text-gray-500 px-3 py-2">Gerçek Başlangıç</th>
                              <th className="text-left text-xs text-gray-500 px-3 py-2">Gerçek Bitiş</th>
                              <th className="text-left text-xs text-gray-500 px-3 py-2">Sapma</th>
                              <th className="text-left text-xs text-gray-500 px-3 py-2">Durum</th>
                              <th className="px-3 py-2"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-wind-700/10">
                            {PHASES.map((ph) => {
                              const plan = getPlan(t.id, ph.key)
                              const delay = plan?.variance_days || 0
                              return (
                                <tr key={ph.key} className="hover:bg-surface-light/20">
                                  <td className="px-4 py-2.5">
                                    <span className="flex items-center gap-2">
                                      <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: ph.color }} />
                                      <span className="text-gray-300 font-medium">{ph.label}</span>
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-gray-400 font-mono text-xs">{plan?.planned_start || '—'}</td>
                                  <td className="px-3 py-2 text-gray-400 font-mono text-xs">{plan?.planned_end || '—'}</td>
                                  <td className="px-3 py-2 text-gray-400 font-mono text-xs">{plan?.actual_start || '—'}</td>
                                  <td className="px-3 py-2 text-gray-400 font-mono text-xs">{plan?.actual_end || '—'}</td>
                                  <td className="px-3 py-2">
                                    {delay !== 0 && plan?.planned_start ? (
                                      <span className={`text-xs font-bold ${delay > 0 ? 'text-red-400' : 'text-wind-400'}`}>
                                        {delay > 0 ? '+' : ''}{delay}g
                                      </span>
                                    ) : plan?.planned_start ? <span className="text-xs text-wind-400">zamanında</span> : <span className="text-xs text-gray-600">—</span>}
                                  </td>
                                  <td className="px-3 py-2">
                                    <span className={`text-xs ${STATUS_COLORS[plan?.status || 'not_started']}`}>
                                      {plan?.status === 'completed' ? '✓ Tamam' :
                                       plan?.status === 'in_progress' ? '⏳ Devam' :
                                       plan?.status === 'delayed' ? '⚠ Gecikme' :
                                       plan?.status === 'cancelled' ? '✕ İptal' :
                                       plan?.planned_start ? '○ Planlandı' : '— Girilmedi'}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2">
                                    <button onClick={() => openEdit(t.id, ph.key)}
                                      className="text-xs text-gray-500 hover:text-wind-400 p-1 rounded hover:bg-surface-light">
                                      <Edit2 className="h-3.5 w-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Edit Modal */}
      {editCell && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f1a12] border border-wind-700/30 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                T{turbines.find((t) => t.id === editCell.turbineId)?.turbine_number} — {PHASES.find((p) => p.key === editCell.phase)?.label}
              </h3>
              <button onClick={() => setEditCell(null)} className="text-gray-500 hover:text-gray-300"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <DateField label="Plan Başlangıç" value={editForm.planned_start} onChange={(v) => setEditForm({ ...editForm, planned_start: v })} />
                <DateField label="Plan Bitiş" value={editForm.planned_end} onChange={(v) => setEditForm({ ...editForm, planned_end: v })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <DateField label="Gerçek Başlangıç" value={editForm.actual_start} onChange={(v) => setEditForm({ ...editForm, actual_start: v })} />
                <DateField label="Gerçek Bitiş" value={editForm.actual_end} onChange={(v) => setEditForm({ ...editForm, actual_end: v })} />
              </div>
              {editForm.planned_start && editForm.planned_end && (
                <div className="text-xs text-gray-500 bg-surface-light rounded px-3 py-2">
                  Planlanan süre: {Math.round((new Date(editForm.planned_end).getTime() - new Date(editForm.planned_start).getTime()) / 86400000) + 1} gün
                  {editForm.actual_end && editForm.planned_end && (
                    <span className={`ml-3 font-bold ${new Date(editForm.actual_end) > new Date(editForm.planned_end) ? 'text-red-400' : 'text-wind-400'}`}>
                      {Math.round((new Date(editForm.actual_end).getTime() - new Date(editForm.planned_end).getTime()) / 86400000)} gün sapma
                    </span>
                  )}
                </div>
              )}
              <textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="Not (isteğe bağlı)" rows={2}
                className="input-field w-full text-sm resize-none" />
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditCell(null)} className="btn-ghost flex-1" disabled={saving}><X className="h-4 w-4" />İptal</button>
              <button onClick={savePlan} className="btn-primary flex-1" disabled={saving}>
                <Save className="h-4 w-4" />{saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function GanttHeader({ start, end }: { start: Date; end: Date }) {
  const months: { label: string; pct: number }[] = []
  let cur = new Date(start.getFullYear(), start.getMonth(), 1)
  const totalMs = end.getTime() - start.getTime()
  while (cur <= end) {
    const next = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
    const from = Math.max(cur.getTime(), start.getTime())
    const to = Math.min(next.getTime(), end.getTime())
    months.push({
      label: cur.toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' }),
      pct: ((to - from) / totalMs) * 100,
    })
    cur = next
  }
  return (
    <div className="flex border-b border-wind-700/20 bg-surface-light/20">
      <div className="w-32 flex-shrink-0 border-r border-wind-700/20 px-3 py-1.5 text-xs text-gray-500">Türbin</div>
      <div className="flex flex-1">
        {months.map((m, i) => (
          <div key={i} style={{ width: `${m.pct}%` }}
            className="text-xs text-gray-500 px-1 py-1.5 border-r border-wind-700/10 truncate text-center">
            {m.label}
          </div>
        ))}
      </div>
      <div className="w-8 flex-shrink-0" />
    </div>
  )
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-gray-400 mb-1 block">{label}</label>
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="input-field w-full text-sm" />
    </div>
  )
}

function KPICard({ label, value, sub, color }: { label: string; value: string | number; sub: string; color: string }) {
  return (
    <div className="card">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
      <p className="text-xs text-gray-600 mt-0.5">{sub}</p>
    </div>
  )
}
