'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  MapPin,
  Clock,
  Calendar,
  TrendingUp,
  Award,
} from 'lucide-react'
import Link from 'next/link'
import { SkeletonCard } from '@/components/ui/loading'
import { ENTRY_TYPE_LABELS } from '@/lib/odoo-parser'
import toast from 'react-hot-toast'

interface WorkEntryLine {
  id: string
  work_type_code: string
  work_type_label: string
  turbine_raw: string | null
  hours: number
}

const ENTRY_TYPE_COLORS: Record<string, string> = {
  on_site: 'text-wind-400 bg-wind-700/20',
  standby: 'text-yellow-400 bg-yellow-500/10',
  travel: 'text-blue-400 bg-blue-500/10',
  annual_leave: 'text-gray-400 bg-surface-light',
  inter_project_leave: 'text-gray-400 bg-surface-light',
  sick_leave: 'text-red-400 bg-red-500/10',
  training: 'text-purple-400 bg-purple-500/10',
  day_off: 'text-gray-500 bg-surface-light',
  paternity_leave: 'text-gray-400 bg-surface-light',
  office: 'text-blue-400 bg-blue-500/10',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseRow = Record<string, any>

export default function PersonnelDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [person, setPerson] = useState<SupabaseRow | null>(null)
  const [entries, setEntries] = useState<SupabaseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  })
  const supabase = createClient()

  useEffect(() => {
    if (!params.id) return
    fetchData()
  }, [params.id, dateRange]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchData() {
    setLoading(true)
    try {
      const { data: p, error: pe } = await supabase
        .from('personnel')
        .select('*, projects:current_project_id(name)')
        .eq('id', params.id as string)
        .single()

      if (pe || !p) {
        toast.error('Personel bulunamadı')
        router.push('/personnel')
        return
      }
      setPerson(p)

      const { data: we } = await supabase
        .from('work_entries')
        .select(`
          id, work_date, entry_type, total_hours, notes, odoo_project_code,
          projects:project_id(name),
          work_entry_lines(id, work_type_code, work_type_label, turbine_raw, hours)
        `)
        .eq('personnel_id', params.id as string)
        .gte('work_date', dateRange.start)
        .lte('work_date', dateRange.end)
        .order('work_date', { ascending: false })

      setEntries(we || [])
    } catch {
      toast.error('Veri yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  const stats = entries.reduce(
    (acc, e) => {
      acc.totalHours += e.total_hours || 0
      if (e.entry_type === 'on_site') acc.onSiteDays++
      if (e.entry_type === 'standby') acc.standbyDays++
      if (['annual_leave', 'inter_project_leave', 'sick_leave'].includes(e.entry_type)) acc.leaveDays++
      const lines: WorkEntryLine[] = e.work_entry_lines || []
      for (const l of lines) {
        if (l.hours > 0 && l.work_type_label && !['Proje Arası', 'İzin Günü'].includes(l.work_type_label)) {
          acc.workTypeHours[l.work_type_label] = (acc.workTypeHours[l.work_type_label] || 0) + l.hours
        }
      }
      return acc
    },
    { totalHours: 0, onSiteDays: 0, standbyDays: 0, leaveDays: 0, workTypeHours: {} as Record<string, number> }
  )

  const topWorkTypes = Object.entries(stats.workTypeHours)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)

  const getProjectName = (row: SupabaseRow) => {
    const p = row?.projects
    if (!p) return null
    if (Array.isArray(p)) return p[0]?.name || null
    return p.name || null
  }

  const isExpiringSoon = (expiry: string) => {
    const diff = (new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return diff < 90
  }

  if (loading && !person) {
    return (
      <div className="space-y-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  if (!person) return null

  const certifications: { name: string; expiry: string }[] = person.certifications || []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/personnel" className="btn-ghost p-2">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-4 flex-1">
          <div className="h-12 w-12 rounded-full bg-wind-700/30 flex items-center justify-center text-sm font-bold text-wind-400">
            {person.full_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{person.full_name}</h1>
            <p className="text-sm text-gray-500">
              #{person.employee_code}
              {person.role_title && ` · ${person.role_title}`}
              {person.department && ` · ${person.department}`}
            </p>
          </div>
          {getProjectName(person) && (
            <div className="ml-auto flex items-center gap-1.5 text-sm text-gray-400">
              <MapPin className="h-4 w-4" />
              {getProjectName(person)}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <div className="card space-y-3">
            <h3 className="text-sm font-semibold text-gray-200">Dönem Özeti</h3>
            <div className="flex items-center gap-2 mb-3">
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="input-field text-xs py-1.5 flex-1"
              />
              <span className="text-gray-500 text-xs">→</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="input-field text-xs py-1.5 flex-1"
              />
            </div>
            <StatRow label="Toplam Saat" value={`${stats.totalHours.toFixed(1)}s`} icon={<Clock className="h-3.5 w-3.5" />} />
            <StatRow label="Saha Günü" value={`${stats.onSiteDays} gün`} icon={<TrendingUp className="h-3.5 w-3.5" />} color="text-wind-400" />
            <StatRow label="Bekleme Günü" value={`${stats.standbyDays} gün`} icon={<Clock className="h-3.5 w-3.5" />} color="text-yellow-400" />
            <StatRow label="İzin Günü" value={`${stats.leaveDays} gün`} icon={<Calendar className="h-3.5 w-3.5" />} color="text-gray-400" />
          </div>

          {topWorkTypes.length > 0 && (
            <div className="card space-y-3">
              <h3 className="text-sm font-semibold text-gray-200">İş Tipi Dağılımı</h3>
              {topWorkTypes.map(([label, hours]) => (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400 truncate pr-2">{label}</span>
                    <span className="text-gray-300 font-medium">{hours}s</span>
                  </div>
                  <div className="h-1.5 bg-surface-light rounded-full overflow-hidden">
                    <div
                      className="h-full bg-wind-600 rounded-full"
                      style={{ width: `${Math.min(100, (hours / (topWorkTypes[0]?.[1] || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {certifications.length > 0 && (
            <div className="card space-y-2">
              <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                <Award className="h-4 w-4" />
                Sertifikalar
              </h3>
              {certifications.map((cert, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">{cert.name}</span>
                  <span className={`text-xs font-mono ${isExpiringSoon(cert.expiry) ? 'text-red-400' : 'text-gray-500'}`}>
                    {cert.expiry}{isExpiringSoon(cert.expiry) && ' ⚠'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-sm font-semibold text-gray-200">
            İş Kayıtları
            <span className="text-gray-500 font-normal ml-2">({entries.length} kayıt)</span>
          </h3>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : entries.length === 0 ? (
            <div className="card text-center py-8">
              <Calendar className="h-8 w-8 text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Bu dönemde kayıt yok</p>
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => {
                const lines: WorkEntryLine[] = entry.work_entry_lines || []
                const activeLines = lines.filter(
                  (l) => l.hours > 0 && l.work_type_label && !['Proje Arası', 'İzin Günü'].includes(l.work_type_label)
                )
                return (
                  <div key={entry.id} className="card">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-mono text-gray-400">
                          {new Date(entry.work_date + 'T00:00:00').toLocaleDateString('tr-TR', {
                            weekday: 'short', day: '2-digit', month: 'short',
                          })}
                        </span>
                        <span className={`badge text-xs ${ENTRY_TYPE_COLORS[entry.entry_type] || 'badge-gray'}`}>
                          {ENTRY_TYPE_LABELS[entry.entry_type] || entry.entry_type}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getProjectName(entry) && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {getProjectName(entry)}
                          </span>
                        )}
                        {entry.total_hours != null && entry.total_hours > 0 && (
                          <span className="text-xs font-mono text-gray-400">{entry.total_hours}s</span>
                        )}
                      </div>
                    </div>

                    {activeLines.length > 0 && (
                      <div className="space-y-1 mt-2">
                        {activeLines.map((line) => (
                          <div key={line.id} className="flex items-center gap-2 text-xs">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-wind-600 flex-shrink-0" />
                            <span className="text-gray-300 font-medium">{line.work_type_label}</span>
                            {line.turbine_raw && line.turbine_raw !== '*' && (
                              <span className="text-gray-500">· {line.turbine_raw}</span>
                            )}
                            <span className="text-gray-500 ml-auto">{line.hours}s</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {entry.notes && (
                      <p className="text-xs text-gray-500 mt-2 italic">"{entry.notes}"</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatRow({
  label, value, icon, color = 'text-gray-300',
}: {
  label: string
  value: string
  icon: React.ReactNode
  color?: string
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2 text-gray-400">
        {icon}
        {label}
      </div>
      <span className={`font-semibold ${color}`}>{value}</span>
    </div>
  )
}
