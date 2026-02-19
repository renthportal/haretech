'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowLeft, MapPin, Calendar, Wind, Building2,
  Layers, Users, ChevronDown, ChevronUp,
} from 'lucide-react'
import { PageLoader } from '@/components/ui/loading'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import type { Project, Turbine } from '@/types'
import { formatDate, formatMW, formatMeters, calcPercentage } from '@/lib/utils'
import { ENTRY_TYPE_LABELS } from '@/lib/odoo-parser'
import toast from 'react-hot-toast'
import Link from 'next/link'

type Tab = 'overview' | 'personnel' | 'turbines'
type GroupBy = 'person' | 'turbine'

const STATUS_OPTIONS = ['pending','in_progress','completed']
const STATUS_LABELS: Record<string, string> = { pending: 'Bekliyor', in_progress: 'Devam Ediyor', completed: 'Tamamlandı' }

export default function ProjectDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [project, setProject] = useState<Project | null>(null)
  const [turbines, setTurbines] = useState<Turbine[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('overview')
  const [groupBy, setGroupBy] = useState<GroupBy>('person')
  const [allEntries, setAllEntries] = useState<any[]>([])
  const [personnelLoading, setPersonnelLoading] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [dateStart, setDateStart] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]
  })
  const [dateEnd, setDateEnd] = useState(() => new Date().toISOString().split('T')[0])
  const [addTurbineModal, setAddTurbineModal] = useState(false)
  const [editTurbine, setEditTurbine] = useState<Turbine | null>(null)
  const [turbineForm, setTurbineForm] = useState({ turbine_number: '' })
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchProject()
    fetchTurbines()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab === 'personnel') fetchEntries()
  }, [tab, dateStart, dateEnd]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchProject() {
    const { data, error } = await supabase
      .from('projects')
      .select('*, turbine_model:turbine_models(*)')
      .eq('id', id).single()
    if (error) toast.error('Proje bulunamadı')
    else setProject(data)
    setLoading(false)
  }

  async function fetchTurbines() {
    const { data } = await supabase.from('turbines').select('*').eq('project_id', id).order('turbine_number')
    setTurbines(data || [])
  }

  async function saveTurbine() {
    if (!turbineForm.turbine_number.trim()) { toast.error('Türbin numarası zorunlu'); return }
    setSaving(true)
    if (editTurbine) {
      const { error } = await supabase.from('turbines').update({ turbine_number: turbineForm.turbine_number }).eq('id', editTurbine.id)
      if (error) toast.error('Güncellenemedi'); else { toast.success('Türbin güncellendi'); fetchTurbines() }
    } else {
      const { error } = await supabase.from('turbines').insert({ project_id: id, turbine_number: turbineForm.turbine_number, foundation_status: 'pending', tower_status: 'pending', nacelle_status: 'pending', hub_status: 'pending', blades_status: 'pending', commissioning_status: 'pending' })
      if (error) toast.error('Eklenemedi: ' + error.message); else { toast.success('Türbin eklendi'); fetchTurbines() }
    }
    setSaving(false)
    setAddTurbineModal(false)
    setEditTurbine(null)
    setTurbineForm({ turbine_number: '' })
  }

  async function updateTurbineStatus(turbineId: string, field: string, value: string) {
    const { error } = await supabase.from('turbines').update({ [field]: value }).eq('id', turbineId)
    if (error) toast.error('Güncellenemedi'); else fetchTurbines()
  }

  async function deleteTurbine(turbineId: string) {
    if (!confirm('Bu türbini silmek istiyor musunuz?')) return
    await supabase.from('turbines').delete().eq('id', turbineId)
    fetchTurbines()
  }

  async function fetchEntries() {
    setPersonnelLoading(true)
    const { data } = await supabase
      .from('work_entries')
      .select(`
        id, work_date, entry_type, total_hours,
        personnel:personnel_id(id, employee_code, full_name, department),
        work_entry_lines(id, work_type_label, work_type_code, turbine_raw, hours)
      `)
      .eq('project_id', id)
      .gte('work_date', dateStart)
      .lte('work_date', dateEnd)
      .order('work_date', { ascending: false })
    setAllEntries(data || [])
    setPersonnelLoading(false)
    setExpanded(null)
  }

  // Supabase FK join bazen array bazen obje döner - ikisini de handle et
  const getPerson = (e: any) => {
    const p = e.personnel
    if (!p) return null
    if (Array.isArray(p)) return p[0] || null
    return p
  }

  // ── Gruplama: Personel bazlı ──
  const byPerson = (() => {
    const map = new Map<string, any>()
    for (const e of allEntries) {
      const p = getPerson(e)
      if (!p) continue
      const key = String(p.id)
      if (!map.has(key)) {
        map.set(key, {
          id: key, employee_code: p.employee_code, full_name: p.full_name,
          department: p.department, totalHours: 0, onSiteDays: 0,
          turbineMap: {} as Record<string, Record<string, number>>,
          entries: [] as any[],
        })
      }
      const rec = map.get(key)!
      rec.totalHours += Number(e.total_hours) || 0
      if (e.entry_type === 'on_site') rec.onSiteDays++
      rec.entries.push(e)
      for (const l of (e.work_entry_lines || []) as any[]) {
        if (!l.hours || !l.work_type_label || ['Proje Arası','İzin Günü'].includes(l.work_type_label)) continue
        const tKey = l.turbine_raw && l.turbine_raw !== '*' ? `T${l.turbine_raw}` : 'Genel Saha'
        if (!rec.turbineMap[tKey]) rec.turbineMap[tKey] = {}
        rec.turbineMap[tKey][l.work_type_label] = (rec.turbineMap[tKey][l.work_type_label] || 0) + l.hours
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalHours - a.totalHours)
  })()

  // ── Gruplama: Türbin bazlı ──
  const byTurbine = (() => {
    const map = new Map<string, any>()
    for (const e of allEntries) {
      const p = getPerson(e)
      for (const l of (e.work_entry_lines || []) as any[]) {
        if (!l.hours || !l.work_type_label || ['Proje Arası','İzin Günü'].includes(l.work_type_label)) continue
        const tKey = l.turbine_raw && l.turbine_raw !== '*' ? `T${l.turbine_raw}` : 'Genel Saha'
        if (!map.has(tKey)) {
          map.set(tKey, { id: tKey, label: tKey, totalHours: 0, personMap: {} as Record<string, any>, workTypeHours: {} as Record<string, number> })
        }
        const rec = map.get(tKey)!
        rec.totalHours += l.hours
        rec.workTypeHours[l.work_type_label] = (rec.workTypeHours[l.work_type_label] || 0) + l.hours
        if (p) {
          const pKey = String(p.id)
          if (!rec.personMap[pKey]) rec.personMap[pKey] = { full_name: p.full_name, employee_code: p.employee_code, hours: 0, workTypes: {} as Record<string, number> }
          rec.personMap[pKey].hours += l.hours
          rec.personMap[pKey].workTypes[l.work_type_label] = (rec.personMap[pKey].workTypes[l.work_type_label] || 0) + l.hours
        }
      }
    }
    // Sıralama: Genel Saha en sona
    return Array.from(map.values()).sort((a, b) => {
      if (a.id === 'Genel Saha') return 1
      if (b.id === 'Genel Saha') return -1
      const na = parseInt(a.id.replace('T','')) || 9999
      const nb = parseInt(b.id.replace('T','')) || 9999
      return na - nb
    })
  })()

  const totalHours = byPerson.reduce((s, p) => s + p.totalHours, 0)

  if (loading) return <PageLoader />
  if (!project) {
    return (
      <EmptyState icon={Building2} title="Proje bulunamadı"
        description="Bu proje mevcut değil veya erişim yetkiniz yok."
        action={<Link href="/projects" className="btn-primary">Projelere Dön</Link>} />
    )
  }

  const completedTurbines = turbines.filter((t) => t.commissioning_status === 'completed').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/projects" className="btn-ghost p-2"><ArrowLeft className="h-4 w-4" /></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{project.name}</h1>
            <StatusBadge status={project.status} />
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
            {project.location_name && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{project.location_name}</span>}
            {project.client_name && <span>{project.client_name}</span>}
            {project.start_date && <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{formatDate(project.start_date)}</span>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-wind-700/20">
        <TabBtn active={tab === 'overview'} onClick={() => setTab('overview')} icon={<Layers className="h-4 w-4" />} label="Genel Bakış" />
        <TabBtn active={tab === 'personnel'} onClick={() => setTab('personnel')} icon={<Users className="h-4 w-4" />} label="Personel & Türbin" />
      </div>

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Toplam Türbin" value={project.total_turbines} />
            <StatCard label="Tamamlanan" value={completedTurbines} color="text-wind-400" />
            <StatCard label="İlerleme" value={`%${calcPercentage(completedTurbines, project.total_turbines)}`} color="text-blue-400" />
            {project.turbine_model && <StatCard label="Güç" value={formatMW(project.turbine_model.rated_power_mw)} color="text-yellow-400" />}
          </div>

          {project.turbine_model && (
            <div className="card space-y-3">
              <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2"><Wind className="h-4 w-4" />Türbin Modeli</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <InfoRow label="Üretici" value={project.turbine_model.manufacturer} />
                <InfoRow label="Model" value={project.turbine_model.model} />
                <InfoRow label="Güç" value={formatMW(project.turbine_model.rated_power_mw)} />
                <InfoRow label="Rotor" value={formatMeters(project.turbine_model.rotor_diameter)} />
              </div>
            </div>
          )}

          <div className="card p-0 overflow-hidden">
            <div className="px-5 py-3 border-b border-wind-700/20 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-200">Türbin Durumları ({turbines.length})</h3>
              <button onClick={() => { setTurbineForm({ turbine_number: '' }); setEditTurbine(null); setAddTurbineModal(true) }}
                className="btn-primary text-xs py-1.5 px-3">+ Türbin Ekle</button>
            </div>
            {turbines.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">Henüz türbin eklenmemiş</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-wind-700/10">
                      {['#','Temel','Kule','Nasel','Hub','Kanatlar','Devreye Alma',''].map((h) => (
                        <th key={h} className="text-left text-xs text-gray-500 uppercase tracking-wider px-3 py-2.5">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-wind-700/10">
                    {turbines.map((t) => {
                      const fields = [
                        { key: 'foundation_status', val: t.foundation_status },
                        { key: 'tower_status', val: t.tower_status },
                        { key: 'nacelle_status', val: t.nacelle_status },
                        { key: 'hub_status', val: t.hub_status },
                        { key: 'blades_status', val: t.blades_status },
                        { key: 'commissioning_status', val: t.commissioning_status },
                      ]
                      return (
                        <tr key={t.id} className="hover:bg-surface-light/20">
                          <td className="px-3 py-2 text-sm font-bold text-gray-200">{t.turbine_number}</td>
                          {fields.map(({ key, val }) => (
                            <td key={key} className="px-3 py-2">
                              <select value={val || 'pending'} onChange={(e) => updateTurbineStatus(t.id, key, e.target.value)}
                                className="text-xs rounded px-1.5 py-0.5 border-0 outline-none cursor-pointer
                                  bg-transparent text-gray-300 hover:bg-surface-light transition-colors"
                                style={{ colorScheme: 'dark' }}>
                                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                              </select>
                            </td>
                          ))}
                          <td className="px-3 py-2">
                            <div className="flex gap-1">
                              <button onClick={() => { setTurbineForm({ turbine_number: t.turbine_number }); setEditTurbine(t); setAddTurbineModal(true) }}
                                className="text-xs text-gray-500 hover:text-gray-200 px-1.5 py-0.5 rounded hover:bg-surface-light">✏️</button>
                              <button onClick={() => deleteTurbine(t.id)}
                                className="text-xs text-gray-500 hover:text-red-400 px-1.5 py-0.5 rounded hover:bg-red-500/10">🗑️</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PERSONNEL & TURBINE TAB ── */}
      {tab === 'personnel' && (
        <div className="space-y-4">
          {/* Filtreler + GroupBy */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} className="input-field py-1.5 text-sm" />
              <span className="text-gray-500">→</span>
              <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} className="input-field py-1.5 text-sm" />
            </div>
            <div className="flex items-center gap-1 ml-auto bg-surface-light rounded-lg p-1">
              <button onClick={() => { setGroupBy('person'); setExpanded(null) }}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${groupBy === 'person' ? 'bg-wind-700/60 text-wind-300' : 'text-gray-400 hover:text-gray-200'}`}>
                <Users className="h-3.5 w-3.5 inline mr-1" />Personel
              </button>
              <button onClick={() => { setGroupBy('turbine'); setExpanded(null) }}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${groupBy === 'turbine' ? 'bg-wind-700/60 text-wind-300' : 'text-gray-400 hover:text-gray-200'}`}>
                🌀 Türbin
              </button>
            </div>
          </div>

          {personnelLoading ? (
            <div className="text-center py-8 text-gray-500 text-sm">Yükleniyor...</div>
          ) : allEntries.length === 0 ? (
            <EmptyState icon={Users} title="Bu projede puantaj kaydı yok"
              description="Seçilen tarih aralığında bu projeye atanmış personel kaydı bulunamadı."
              action={<Link href="/personnel/import" className="btn-ghost">Excel İçe Aktar</Link>} />
          ) : (
            <>
              {/* Özet */}
              <div className="grid grid-cols-3 gap-3">
                <StatCard label="Personel Sayısı" value={byPerson.length} />
                <StatCard label="Toplam Saat" value={totalHours.toFixed(1) + 's'} color="text-wind-400" />
                <StatCard label="Türbin Sayısı" value={byTurbine.length} color="text-blue-400" />
              </div>

              {/* ── PERSONEL BAZLI ── */}
              {groupBy === 'person' && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 px-1">Her personelin hangi türbinde ne kadar çalıştığı</p>
                  {byPerson.map((p) => {
                    const turbineEntries = Object.entries(p.turbineMap as Record<string, Record<string, number>>)
                      .sort(([a], [b]) => {
                        if (a === 'Genel Saha') return 1
                        if (b === 'Genel Saha') return -1
                        return parseInt(a.replace('T','')) - parseInt(b.replace('T',''))
                      })
                    return (
                      <div key={p.id} className="card p-0 overflow-hidden">
                        <button
                          className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-surface-light/30 transition-colors text-left"
                          onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                        >
                          <div className="flex-shrink-0 h-9 w-9 rounded-full bg-wind-700/30 flex items-center justify-center text-xs font-bold text-wind-400">
                            {String(p.full_name).split(' ').map((n: string) => n[0]).slice(0,2).join('')}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-200">{p.full_name}</p>
                            <p className="text-xs text-gray-500">#{p.employee_code}{p.department && ` · ${p.department}`}</p>
                          </div>
                          <div className="text-right mr-4">
                            <p className="text-sm font-bold text-wind-400">{p.totalHours.toFixed(1)}s</p>
                            <p className="text-xs text-gray-500">{turbineEntries.length} türbin · {p.onSiteDays}g saha</p>
                          </div>
                          {/* Türbin rozetleri */}
                          <div className="hidden sm:flex flex-wrap gap-1 max-w-xs">
                            {turbineEntries.slice(0,5).map(([tKey]) => (
                              <span key={tKey} className="text-xs px-2 py-0.5 rounded-full bg-wind-700/30 text-wind-400 font-mono">{tKey}</span>
                            ))}
                            {turbineEntries.length > 5 && <span className="text-xs text-gray-500">+{turbineEntries.length - 5}</span>}
                          </div>
                          {expanded === p.id ? <ChevronUp className="h-4 w-4 text-gray-500 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-500 flex-shrink-0" />}
                        </button>
                        {expanded === p.id && (
                          <div className="border-t border-wind-700/20 px-5 py-4">
                            <p className="text-xs font-medium text-gray-400 mb-3">Türbin Bazlı Çalışma Detayı</p>
                            <div className="space-y-3">
                              {turbineEntries.map(([tKey, workTypes]) => {
                                const tTotal = Object.values(workTypes).reduce((s, h) => s + h, 0)
                                return (
                                  <div key={tKey} className="bg-surface-light rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-sm font-bold text-wind-400 font-mono">{tKey}</span>
                                      <span className="text-sm font-bold text-gray-200">{tTotal}s toplam</span>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                      {Object.entries(workTypes).sort(([,a],[,b]) => b-a).map(([wt, h]) => (
                                        <div key={wt} className="flex justify-between text-xs">
                                          <span className="text-gray-400 truncate pr-2">{wt}</span>
                                          <span className="text-gray-200 font-medium flex-shrink-0">{h}s</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                            {/* Günlük kayıtlar özeti */}
                            <div className="mt-3 pt-3 border-t border-wind-700/10">
                              <p className="text-xs font-medium text-gray-400 mb-2">Günlük Kayıtlar</p>
                              <div className="space-y-1 max-h-36 overflow-y-auto">
                                {p.entries.map((e: any) => (
                                  <div key={e.id} className="flex items-center gap-2 text-xs">
                                    <span className="font-mono text-gray-500 w-20 flex-shrink-0">{e.work_date}</span>
                                    <span className="badge badge-gray py-0 text-xs">{ENTRY_TYPE_LABELS[e.entry_type] || e.entry_type}</span>
                                    <span className="text-gray-400 ml-auto">{e.total_hours}s</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* ── TÜRBİN BAZLI ── */}
              {groupBy === 'turbine' && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 px-1">Her türbinde hangi personelin ne kadar çalıştığı</p>
                  {byTurbine.map((t) => {
                    const persons = Object.values(t.personMap as Record<string, any>).sort((a: any, b: any) => b.hours - a.hours)
                    return (
                      <div key={t.id} className="card p-0 overflow-hidden">
                        <button
                          className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-surface-light/30 transition-colors text-left"
                          onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                        >
                          <div className="flex-shrink-0 h-9 w-9 rounded-full bg-blue-700/30 flex items-center justify-center text-xs font-bold text-blue-400 font-mono">
                            {t.label.replace('T','')}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-bold text-gray-200">{t.label}</p>
                            <p className="text-xs text-gray-500">{persons.length} personel çalışmış</p>
                          </div>
                          <div className="text-right mr-4">
                            <p className="text-sm font-bold text-wind-400">{t.totalHours.toFixed(1)}s</p>
                            <p className="text-xs text-gray-500">{Object.keys(t.workTypeHours).length} iş tipi</p>
                          </div>
                          {/* Personel rozetleri */}
                          <div className="hidden sm:flex flex-wrap gap-1 max-w-xs">
                            {persons.slice(0,4).map((p: any) => (
                              <span key={p.employee_code} className="text-xs px-2 py-0.5 rounded-full bg-surface-light text-gray-300">
                                {String(p.full_name).split(' ')[0]}
                              </span>
                            ))}
                            {persons.length > 4 && <span className="text-xs text-gray-500">+{persons.length - 4}</span>}
                          </div>
                          {expanded === t.id ? <ChevronUp className="h-4 w-4 text-gray-500 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-500 flex-shrink-0" />}
                        </button>
                        {expanded === t.id && (
                          <div className="border-t border-wind-700/20 px-5 py-4 space-y-4">
                            {/* İş tipi özeti */}
                            <div>
                              <p className="text-xs font-medium text-gray-400 mb-2">İş Tipi Dağılımı (Toplam)</p>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                {Object.entries(t.workTypeHours as Record<string,number>).sort(([,a],[,b])=>b-a).map(([wt,h]) => (
                                  <div key={wt} className="flex justify-between text-xs bg-surface-light rounded px-2 py-1">
                                    <span className="text-gray-400 truncate pr-2">{wt}</span>
                                    <span className="text-gray-200 font-medium">{h}s</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            {/* Personel listesi */}
                            <div>
                              <p className="text-xs font-medium text-gray-400 mb-2">Çalışan Personel</p>
                              <div className="space-y-2">
                                {persons.map((p: any) => (
                                  <div key={p.employee_code} className="bg-surface-light rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-1.5">
                                      <span className="text-sm font-medium text-gray-200">{p.full_name}</span>
                                      <span className="text-sm font-bold text-wind-400">{p.hours}s</span>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                                      {Object.entries(p.workTypes as Record<string,number>).sort(([,a],[,b])=>b-a).map(([wt,h]) => (
                                        <div key={wt} className="flex justify-between text-xs">
                                          <span className="text-gray-500 truncate pr-1">{wt}</span>
                                          <span className="text-gray-300 flex-shrink-0">{h}s</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Türbin Ekle/Düzenle Modal */}
      {addTurbineModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f1a12] border border-wind-700/30 rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-4">{editTurbine ? 'Türbini Düzenle' : 'Yeni Türbin Ekle'}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Türbin Numarası *</label>
                <input
                  type="text"
                  value={turbineForm.turbine_number}
                  onChange={(e) => setTurbineForm({ turbine_number: e.target.value })}
                  placeholder="örn: 1, 2, 7A..."
                  className="input-field w-full"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && saveTurbine()}
                />
                <p className="text-xs text-gray-600 mt-1">Tüm statüler başlangıçta "Bekliyor" olarak ayarlanır</p>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setAddTurbineModal(false); setEditTurbine(null) }} className="btn-ghost flex-1" disabled={saving}>İptal</button>
              <button onClick={saveTurbine} className="btn-primary flex-1" disabled={saving}>
                {saving ? 'Kaydediliyor...' : editTurbine ? 'Güncelle' : 'Ekle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${active ? 'border-wind-500 text-wind-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
      {icon}{label}
    </button>
  )
}

function StatCard({ label, value, color = 'text-white' }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="card">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-gray-200 font-medium">{value || '—'}</p>
    </div>
  )
}
