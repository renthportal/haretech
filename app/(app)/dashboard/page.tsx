'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  FolderKanban,
  Wind as WindIcon,
  Truck,
  Users,
  ArrowUpRight,
  Calendar,
  CloudSun,
} from 'lucide-react'
import Link from 'next/link'
import { SkeletonCard } from '@/components/ui/loading'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import type { Project } from '@/types'
import { PROJECT_STATUS_LABELS } from '@/types'
import { formatDate } from '@/lib/utils'

interface DashboardStats {
  totalProjects: number
  activeProjects: number
  totalTurbines: number
  completedTurbines: number
  totalCranes: number
  activeCranes: number
  totalCrew: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchDashboard() {
      try {
        // Fetch projects
        const { data: projectsData } = await supabase
          .from('projects')
          .select('*, turbine_model:turbine_models(*)')
          .order('created_at', { ascending: false })
          .limit(6)

        setProjects(projectsData || [])

        // Count stats
        const { count: totalProjects } = await supabase
          .from('projects')
          .select('*', { count: 'exact', head: true })

        const { count: activeProjects } = await supabase
          .from('projects')
          .select('*', { count: 'exact', head: true })
          .in('status', ['active', 'mobilization'])

        const { count: totalTurbines } = await supabase
          .from('turbines')
          .select('*', { count: 'exact', head: true })

        const { count: completedTurbines } = await supabase
          .from('turbines')
          .select('*', { count: 'exact', head: true })
          .eq('commissioning_status', 'completed')

        const { count: totalCranes } = await supabase
          .from('cranes')
          .select('*', { count: 'exact', head: true })

        const { count: activeCranes } = await supabase
          .from('cranes')
          .select('*', { count: 'exact', head: true })
          .in('status', ['on_site', 'working'])

        const { count: totalCrew } = await supabase
          .from('crews')
          .select('*', { count: 'exact', head: true })

        setStats({
          totalProjects: totalProjects || 0,
          activeProjects: activeProjects || 0,
          totalTurbines: totalTurbines || 0,
          completedTurbines: completedTurbines || 0,
          totalCranes: totalCranes || 0,
          activeCranes: activeCranes || 0,
          totalCrew: totalCrew || 0,
        })
      } catch (err) {
        console.error('Dashboard fetch error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboard()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Panel</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Panel</h1>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Calendar className="h-4 w-4" />
          {new Date().toLocaleDateString('tr-TR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={<FolderKanban className="h-5 w-5" />}
          label="Projeler"
          value={stats?.totalProjects || 0}
          subValue={`${stats?.activeProjects || 0} aktif`}
          color="text-wind-500"
          bgColor="bg-wind-700/20"
        />
        <KPICard
          icon={<WindIcon className="h-5 w-5" />}
          label="Türbinler"
          value={stats?.totalTurbines || 0}
          subValue={`${stats?.completedTurbines || 0} tamamlandı`}
          color="text-accent"
          bgColor="bg-accent/10"
        />
        <KPICard
          icon={<Truck className="h-5 w-5" />}
          label="Vinçler"
          value={stats?.totalCranes || 0}
          subValue={`${stats?.activeCranes || 0} sahada`}
          color="text-blue-400"
          bgColor="bg-blue-500/10"
        />
        <KPICard
          icon={<Users className="h-5 w-5" />}
          label="Ekipler"
          value={stats?.totalCrew || 0}
          subValue="kayıtlı ekip"
          color="text-purple-400"
          bgColor="bg-purple-500/10"
        />
      </div>

      {/* Projects section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-100">Projeler</h2>
          <Link href="/projects" className="text-sm text-wind-400 hover:text-wind-300 flex items-center gap-1">
            Tümünü Gör
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        {projects.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="Henüz proje yok"
            description="İlk projenizi oluşturarak başlayın."
            action={
              <Link href="/projects" className="btn-primary">
                <FolderKanban className="h-4 w-4" />
                Proje Oluştur
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>

      {/* Quick info */}
      <div className="card flex items-center gap-4 bg-surface-card">
        <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-blue-500/10">
          <CloudSun className="h-5 w-5 text-blue-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-200">Hava Durumu Entegrasyonu</p>
          <p className="text-xs text-gray-500">
            OpenWeatherMap API anahtarınızı Ayarlar sayfasından ekleyerek
            proje lokasyonlarında anlık hava durumu takibi yapabilirsiniz.
          </p>
        </div>
      </div>
    </div>
  )
}

function KPICard({
  icon,
  label,
  value,
  subValue,
  color,
  bgColor,
}: {
  icon: React.ReactNode
  label: string
  value: number
  subValue: string
  color: string
  bgColor: string
}) {
  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400">{label}</p>
          <p className="text-3xl font-bold text-white mt-1">{value}</p>
          <p className="text-xs text-gray-500 mt-1">{subValue}</p>
        </div>
        <div className={`flex items-center justify-center h-10 w-10 rounded-lg ${bgColor}`}>
          <span className={color}>{icon}</span>
        </div>
      </div>
    </div>
  )
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <Link href={`/projects/${project.id}`} className="card-hover">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-100 truncate">{project.name}</h3>
          {project.location_name && (
            <p className="text-xs text-gray-500 mt-0.5">{project.location_name}</p>
          )}
        </div>
        <StatusBadge status={project.status} type="project" />
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <span className="text-gray-500">Türbin</span>
          <p className="text-gray-200 font-medium">{project.total_turbines} adet</p>
        </div>
        <div>
          <span className="text-gray-500">Model</span>
          <p className="text-gray-200 font-medium truncate">
            {project.turbine_model
              ? `${project.turbine_model.manufacturer} ${project.turbine_model.model}`
              : '—'}
          </p>
        </div>
        {project.client_name && (
          <div className="col-span-2">
            <span className="text-gray-500">Müşteri</span>
            <p className="text-gray-200 font-medium">{project.client_name}</p>
          </div>
        )}
      </div>

      {project.start_date && (
        <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-wind-700/20 text-xs text-gray-500">
          <Calendar className="h-3.5 w-3.5" />
          {formatDate(project.start_date)}
          {project.target_end_date && ` — ${formatDate(project.target_end_date)}`}
        </div>
      )}
    </Link>
  )
}
