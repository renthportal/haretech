'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Wind,
  Building2,
  Edit2,
  Layers,
} from 'lucide-react'
import { PageLoader } from '@/components/ui/loading'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import type { Project, Turbine } from '@/types'
import { formatDate, formatMW, formatMeters, calcPercentage } from '@/lib/utils'
import toast from 'react-hot-toast'
import Link from 'next/link'

export default function ProjectDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [project, setProject] = useState<Project | null>(null)
  const [turbines, setTurbines] = useState<Turbine[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchProject()
    fetchTurbines()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchProject() {
    const { data, error } = await supabase
      .from('projects')
      .select('*, turbine_model:turbine_models(*)')
      .eq('id', id)
      .single()

    if (error) {
      toast.error('Proje bulunamadı')
    } else {
      setProject(data)
    }
    setLoading(false)
  }

  async function fetchTurbines() {
    const { data } = await supabase
      .from('turbines')
      .select('*')
      .eq('project_id', id)
      .order('turbine_number')

    setTurbines(data || [])
  }

  if (loading) return <PageLoader />
  if (!project) {
    return (
      <EmptyState
        icon={Building2}
        title="Proje bulunamadı"
        description="Bu proje mevcut değil veya erişim yetkiniz yok."
        action={
          <Link href="/projects" className="btn-primary">
            Projelere Dön
          </Link>
        }
      />
    )
  }

  // Calculate turbine completion stats
  const completedTurbines = turbines.filter(
    (t) => t.commissioning_status === 'completed'
  ).length
  const completionPercent = calcPercentage(completedTurbines, turbines.length)

  // Component progress counts
  const componentProgress = {
    foundation: turbines.filter((t) => t.foundation_status === 'completed').length,
    tower: turbines.filter((t) => t.tower_status === 'completed').length,
    nacelle: turbines.filter((t) => t.nacelle_status === 'completed').length,
    hub: turbines.filter((t) => t.hub_status === 'completed').length,
    blades: turbines.filter((t) => t.blades_status === 'completed').length,
    commissioning: completedTurbines,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/projects" className="p-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-surface-light mt-1">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-white">{project.name}</h1>
            <StatusBadge status={project.status} type="project" />
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-gray-400 flex-wrap">
            {project.location_name && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {project.location_name}
              </span>
            )}
            {project.client_name && (
              <span className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                {project.client_name}
              </span>
            )}
            {project.start_date && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(project.start_date)}
                {project.target_end_date && ` — ${formatDate(project.target_end_date)}`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Toplam Türbin" value={project.total_turbines} />
        <StatCard label="Tamamlanan" value={completedTurbines} />
        <StatCard
          label="Model"
          value={project.turbine_model ? `${project.turbine_model.model}` : '—'}
          small
        />
        <StatCard
          label="Güç"
          value={project.turbine_model ? formatMW(project.turbine_model.rated_power_mw) : '—'}
          small
        />
        <StatCard
          label="Hub Yüksekliği"
          value={project.hub_height ? formatMeters(project.hub_height) : '—'}
          small
        />
        <StatCard label="İlerleme" value={`%${completionPercent}`} highlight />
      </div>

      {/* Progress bar */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-200 mb-4">Bileşen İlerlemesi</h2>
        <div className="space-y-3">
          <ProgressRow label="Temel" count={componentProgress.foundation} total={turbines.length} />
          <ProgressRow label="Kule" count={componentProgress.tower} total={turbines.length} />
          <ProgressRow label="Nacelle" count={componentProgress.nacelle} total={turbines.length} />
          <ProgressRow label="Hub" count={componentProgress.hub} total={turbines.length} />
          <ProgressRow label="Kanatlar" count={componentProgress.blades} total={turbines.length} />
          <ProgressRow label="Devreye Alma" count={componentProgress.commissioning} total={turbines.length} />
        </div>
      </div>

      {/* Turbine grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-100">Türbinler</h2>
        </div>

        {turbines.length === 0 ? (
          <EmptyState
            icon={Wind}
            title="Henüz türbin eklenmemiş"
            description="Sprint 2'de türbin oluşturma özelliği eklenecek."
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {turbines.map((turbine) => (
              <TurbineCard key={turbine.id} turbine={turbine} />
            ))}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <QuickLink label="Montaj Planı" description="Lift plan oluştur" icon={Layers} href="#" />
        <QuickLink label="Rüzgar Takvimi" description="Hava durumu takibi" icon={Wind} href="#" />
        <QuickLink label="Günlük Raporlar" description="Saha raporları" icon={Edit2} href="#" />
        <QuickLink label="Fotoğraflar" description="Saha görselleri" icon={Calendar} href="#" />
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  small,
  highlight,
}: {
  label: string
  value: string | number
  small?: boolean
  highlight?: boolean
}) {
  return (
    <div className="card text-center">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`font-bold ${highlight ? 'text-accent text-2xl' : small ? 'text-sm text-gray-200' : 'text-xl text-white'}`}>
        {value}
      </p>
    </div>
  )
}

function ProgressRow({ label, count, total }: { label: string; count: number; total: number }) {
  const percent = total > 0 ? (count / total) * 100 : 0
  return (
    <div className="flex items-center gap-4">
      <span className="text-xs text-gray-400 w-24 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-wind-900 rounded-full overflow-hidden">
        <div
          className="h-full bg-wind-500 rounded-full transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs text-gray-300 w-16 text-right">
        {count}/{total}
      </span>
    </div>
  )
}

function TurbineCard({ turbine }: { turbine: Turbine }) {
  const phases = [
    { key: 'foundation_status', label: 'T' },
    { key: 'tower_status', label: 'K' },
    { key: 'nacelle_status', label: 'N' },
    { key: 'hub_status', label: 'H' },
    { key: 'blades_status', label: 'B' },
    { key: 'commissioning_status', label: 'D' },
  ] as const

  const statusColors: Record<string, string> = {
    pending: 'bg-gray-600',
    in_progress: 'bg-yellow-500',
    completed: 'bg-green-500',
  }

  return (
    <div className="card p-3 text-center">
      <p className="text-sm font-semibold text-gray-200 mb-2">{turbine.turbine_number}</p>
      <div className="flex justify-center gap-0.5">
        {phases.map(({ key, label }) => {
          const status = turbine[key]
          return (
            <div
              key={key}
              className={`h-5 w-5 rounded text-[9px] font-medium flex items-center justify-center text-white ${statusColors[status]}`}
              title={`${label}: ${status}`}
            >
              {label}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function QuickLink({
  label,
  description,
  icon: Icon,
  href,
}: {
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  href: string
}) {
  return (
    <div className="card-hover flex items-center gap-3 opacity-50 cursor-default">
      <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-wind-700/20">
        <Icon className="h-5 w-5 text-wind-400" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-200">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
    </div>
  )
}
