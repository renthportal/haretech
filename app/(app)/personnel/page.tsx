'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import {
  Users,
  Search,
  Upload,
  MapPin,
  Calendar,
  Clock,
  ChevronRight,
  RefreshCw,
} from 'lucide-react'
import Link from 'next/link'
import { SkeletonCard } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'
import { ENTRY_TYPE_LABELS } from '@/lib/odoo-parser'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

// ── Tipler ─────────────────────────────────
interface PersonnelWithStats {
  id: string
  employee_code: string
  full_name: string
  department: string | null
  role_title: string | null
  status: string
  current_project_id: string | null
  project_name?: string | null
  today_entry_type?: string | null
  today_hours?: number | null
  today_work_types?: string | null
  last_work_date?: string | null
}

const STATUS_COLORS: Record<string, string> = {
  on_site: 'badge-green',
  standby: 'badge-yellow',
  travel: 'badge-yellow',
  leave: 'badge-gray',
  available: 'badge-blue',
  training: 'badge-blue',
}

const STATUS_LABELS: Record<string, string> = {
  on_site: 'Sahada',
  standby: 'Beklemede',
  travel: 'Yolda',
  leave: 'İzinde',
  available: 'Müsait',
  training: 'Eğitimde',
}

// ── Sayfa ───────────────────────────────────
export default function PersonnelPage() {
  const { profile } = useProfile()
  const [personnel, setPersonnel] = useState<PersonnelWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [projectFilter, setProjectFilter] = useState('all')
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const supabase = createClient()

  const today = new Date().toISOString().split('T')[0]

  const fetchPersonnel = useCallback(async () => {
    setLoading(true)
    try {
      // Personel + bugünkü iş durumu (JOIN ile)
      const { data, error } = await supabase
        .from('personnel')
        .select(`
          id,
          employee_code,
          full_name,
          department,
          role_title,
          status,
          current_project_id,
          projects:current_project_id(name)
        `)
        .eq('is_active', true)
        .order('full_name')

      if (error) throw error

      // Bugünkü work_entries'i ayrıca çek
      const { data: todayEntries } = await supabase
        .from('work_entries')
        .select(`
          personnel_id,
          entry_type,
          total_hours,
          work_entry_lines(work_type_label, hours)
        `)
        .eq('work_date', today)

      // Map: personnel_id → today entry
      const todayMap = new Map<string, typeof todayEntries extends (infer T)[] ? T : never>()
      if (todayEntries) {
        for (const e of todayEntries) {
          todayMap.set(e.personnel_id, e)
        }
      }

      const enriched: PersonnelWithStats[] = (data || []).map((p) => {
        const te = todayMap.get(p.id)
        const workTypes = te
          ? (te.work_entry_lines || [])
              .filter((l: { work_type_label: string; hours: number }) => l.hours > 0 && l.work_type_label && !['Proje Arası', 'İzin Günü'].includes(l.work_type_label))
              .map((l: { work_type_label: string; hours: number }) => `${l.work_type_label} (${l.hours}s)`)
              .join(', ')
          : null

        return {
          id: p.id,
          employee_code: p.employee_code,
          full_name: p.full_name,
          department: p.department,
          role_title: p.role_title,
          status: p.status,
          current_project_id: p.current_project_id,
          project_name: (Array.isArray(p.projects) ? p.projects[0]?.name : (p.projects as { name: string } | null)?.name) ?? null,
          today_entry_type: te?.entry_type ?? null,
          today_hours: te?.total_hours ?? null,
          today_work_types: workTypes,
        }
      })

      setPersonnel(enriched)
    } catch (err) {
      toast.error('Personel yüklenemedi')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [supabase, today])

  useEffect(() => {
    fetchPersonnel()
    // Projeleri çek (filtre için)
    supabase.from('projects').select('id, name').order('name').then(({ data }) => {
      setProjects(data || [])
    })
  }, [fetchPersonnel, supabase])

  // ── İstatistikler ──
  const stats = {
    total: personnel.length,
    onSite: personnel.filter((p) => p.status === 'on_site').length,
    standby: personnel.filter((p) => p.status === 'standby').length,
    available: personnel.filter((p) => p.status === 'available').length,
    leave: personnel.filter((p) => ['leave', 'annual_leave', 'sick_leave'].includes(p.status)).length,
  }

  // ── Filtrele ──
  const filtered = personnel.filter((p) => {
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      p.full_name.toLowerCase().includes(q) ||
      p.employee_code.includes(q) ||
      (p.role_title?.toLowerCase() ?? '').includes(q) ||
      (p.project_name?.toLowerCase() ?? '').includes(q)
    const matchStatus = statusFilter === 'all' || p.status === statusFilter
    const matchProject =
      projectFilter === 'all' || p.current_project_id === projectFilter
    return matchSearch && matchStatus && matchProject
  })

  const canImport = profile?.role === 'ADMIN' || profile?.role === 'PROJECT_MANAGER'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Personel</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date().toLocaleDateString('tr-TR', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            })} itibarıyla saha kadrosu
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchPersonnel}
            className="btn-ghost"
            title="Yenile"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          {canImport && (
            <Link href="/personnel/import" className="btn-primary">
              <Upload className="h-4 w-4" />
              Excel İçe Aktar
            </Link>
          )}
        </div>
      </div>

      {/* KPI Kartları */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <KPICard label="Toplam" value={stats.total} color="text-white" bg="bg-surface-light" />
        <KPICard label="Sahada" value={stats.onSite} color="text-wind-400" bg="bg-wind-700/20" />
        <KPICard label="Beklemede" value={stats.standby} color="text-yellow-400" bg="bg-yellow-500/10" />
        <KPICard label="Müsait" value={stats.available} color="text-blue-400" bg="bg-blue-500/10" />
        <KPICard label="İzinde" value={stats.leave} color="text-gray-400" bg="bg-surface-light" />
      </div>

      {/* Filtreler */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10"
            placeholder="İsim, sicil, rol ara..."
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-field w-auto"
        >
          <option value="all">Tüm Durumlar</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="input-field w-auto"
        >
          <option value="all">Tüm Projeler</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        {(search || statusFilter !== 'all' || projectFilter !== 'all') && (
          <button
            onClick={() => { setSearch(''); setStatusFilter('all'); setProjectFilter('all') }}
            className="text-xs text-gray-400 hover:text-gray-200"
          >
            Temizle
          </button>
        )}
        <span className="text-xs text-gray-500 ml-auto">{filtered.length} personel</span>
      </div>

      {/* Personel Tablosu */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={personnel.length === 0 ? 'Henüz personel yok' : 'Sonuç bulunamadı'}
          description={
            personnel.length === 0
              ? 'Odoo puantaj Excel dosyasını içe aktararak personeli otomatik oluşturabilirsiniz.'
              : 'Arama kriterlerinizi değiştirin.'
          }
          action={
            personnel.length === 0 && canImport ? (
              <Link href="/personnel/import" className="btn-primary">
                <Upload className="h-4 w-4" />
                Excel İçe Aktar
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-wind-700/20">
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">Personel</th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">Proje</th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">Bugün</th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">Yapılan İşler</th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">Durum</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-wind-700/10">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-light/40 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 h-9 w-9 rounded-full bg-wind-700/30 flex items-center justify-center text-xs font-bold text-wind-400">
                          {p.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-100">{p.full_name}</p>
                          <p className="text-xs text-gray-500">
                            #{p.employee_code}
                            {p.role_title && ` · ${p.role_title}`}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {p.project_name ? (
                        <div className="flex items-center gap-1 text-sm text-gray-300">
                          <MapPin className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                          {p.project_name}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {p.today_entry_type ? (
                        <div>
                          <span className={`badge text-xs ${STATUS_COLORS[p.today_entry_type] || 'badge-gray'}`}>
                            {ENTRY_TYPE_LABELS[p.today_entry_type] || p.today_entry_type}
                          </span>
                          {p.today_hours != null && p.today_hours > 0 && (
                            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {p.today_hours}s
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-600">Kayıt yok</span>
                      )}
                    </td>
                    <td className="px-5 py-3 max-w-[260px]">
                      <p className="text-xs text-gray-400 truncate">
                        {p.today_work_types || <span className="text-gray-600">—</span>}
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`badge text-xs ${STATUS_COLORS[p.status] || 'badge-gray'}`}>
                        {STATUS_LABELS[p.status] || p.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/personnel/${p.id}`}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-surface-light transition-colors"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Import Geçmişi Linki */}
      {canImport && personnel.length > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">
            Veriler Odoo puantaj dosyasından içe aktarılmaktadır.
          </span>
          <Link href="/personnel/import" className="text-wind-400 hover:text-wind-300 flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            Import geçmişi & yeni yükleme
          </Link>
        </div>
      )}
    </div>
  )
}

function KPICard({
  label, value, color, bg,
}: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className={`card flex items-center justify-between ${bg} border-0`}>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</p>
      </div>
    </div>
  )
}
