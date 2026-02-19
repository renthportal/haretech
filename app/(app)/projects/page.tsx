'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import {
  Plus,
  FolderKanban,
  Search,
  LayoutGrid,
  List,
  MapPin,
  Calendar,
} from 'lucide-react'
import { SkeletonCard } from '@/components/ui/loading'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Modal } from '@/components/ui/modal'
import { Spinner } from '@/components/ui/loading'
import type { Project, TurbineModel, ProjectStatus } from '@/types'
import { PROJECT_STATUS_LABELS } from '@/types'
import { formatDate, formatMW } from '@/lib/utils'
import toast from 'react-hot-toast'
import Link from 'next/link'

export default function ProjectsPage() {
  const { profile } = useProfile()
  const [projects, setProjects] = useState<Project[]>([])
  const [turbineModels, setTurbineModels] = useState<TurbineModel[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [createOpen, setCreateOpen] = useState(false)
  const supabase = createClient()

  // New project form
  const [form, setForm] = useState({
    name: '',
    client_name: '',
    location_name: '',
    latitude: '',
    longitude: '',
    total_turbines: '',
    turbine_model_id: '',
    hub_height: '',
    start_date: '',
    target_end_date: '',
    notes: '',
  })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchProjects()
    fetchTurbineModels()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchProjects() {
    const { data, error } = await supabase
      .from('projects')
      .select('*, turbine_model:turbine_models(*)')
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Projeler yüklenemedi')
    } else {
      setProjects(data || [])
    }
    setLoading(false)
  }

  async function fetchTurbineModels() {
    const { data } = await supabase
      .from('turbine_models')
      .select('*')
      .order('manufacturer')
    setTurbineModels(data || [])
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.org_id) return
    setCreating(true)

    try {
      const { error } = await supabase.from('projects').insert({
        org_id: profile.org_id,
        name: form.name,
        client_name: form.client_name || null,
        location_name: form.location_name || null,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        total_turbines: parseInt(form.total_turbines),
        turbine_model_id: form.turbine_model_id || null,
        hub_height: form.hub_height ? parseFloat(form.hub_height) : null,
        start_date: form.start_date || null,
        target_end_date: form.target_end_date || null,
        notes: form.notes || null,
      })

      if (error) {
        toast.error('Proje oluşturulamadı: ' + error.message)
      } else {
        toast.success('Proje oluşturuldu')
        setCreateOpen(false)
        setForm({
          name: '', client_name: '', location_name: '', latitude: '', longitude: '',
          total_turbines: '', turbine_model_id: '', hub_height: '', start_date: '',
          target_end_date: '', notes: '',
        })
        fetchProjects()
      }
    } catch {
      toast.error('Bir hata oluştu')
    } finally {
      setCreating(false)
    }
  }

  // Filter projects
  const filtered = projects.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.client_name && p.client_name.toLowerCase().includes(search.toLowerCase())) ||
      (p.location_name && p.location_name.toLowerCase().includes(search.toLowerCase()))
    const matchStatus = statusFilter === 'all' || p.status === statusFilter
    return matchSearch && matchStatus
  })

  const canCreate = profile?.role === 'ADMIN' || profile?.role === 'PROJECT_MANAGER'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-white">Projeler</h1>
        {canCreate && (
          <button onClick={() => setCreateOpen(true)} className="btn-primary">
            <Plus className="h-4 w-4" />
            Yeni Proje
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10"
            placeholder="Proje ara..."
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-field w-auto"
        >
          <option value="all">Tüm Durumlar</option>
          {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <div className="flex items-center border border-wind-700/30 rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2.5 ${viewMode === 'grid' ? 'bg-wind-700/20 text-wind-400' : 'text-gray-400 hover:text-gray-200'}`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2.5 ${viewMode === 'list' ? 'bg-wind-700/20 text-wind-400' : 'text-gray-400 hover:text-gray-200'}`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Project list/grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={search || statusFilter !== 'all' ? 'Sonuç bulunamadı' : 'Henüz proje yok'}
          description={
            search || statusFilter !== 'all'
              ? 'Arama kriterlerinizi değiştirin.'
              : 'İlk projenizi oluşturarak başlayın.'
          }
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`} className="card-hover">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-100 truncate">{project.name}</h3>
                  {project.location_name && (
                    <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {project.location_name}
                    </p>
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
          ))}
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-wind-700/20">
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">Proje</th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">Konum</th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">Türbin</th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">Model</th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-wind-700/10">
                {filtered.map((project) => (
                  <tr key={project.id} className="hover:bg-surface-light/50 transition-colors">
                    <td className="px-5 py-3">
                      <Link href={`/projects/${project.id}`} className="text-sm text-gray-200 font-medium hover:text-wind-400">
                        {project.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-400">{project.location_name || '—'}</td>
                    <td className="px-5 py-3 text-sm text-gray-300">{project.total_turbines}</td>
                    <td className="px-5 py-3 text-sm text-gray-400">
                      {project.turbine_model
                        ? `${project.turbine_model.manufacturer} ${project.turbine_model.model}`
                        : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={project.status} type="project" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Project Modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Yeni Proje" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label-text">Proje Adı *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input-field"
                placeholder="Akbelen RES"
                required
              />
            </div>
            <div>
              <label className="label-text">Müşteri</label>
              <input
                type="text"
                value={form.client_name}
                onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                className="input-field"
                placeholder="Müşteri firma adı"
              />
            </div>
            <div>
              <label className="label-text">Konum</label>
              <input
                type="text"
                value={form.location_name}
                onChange={(e) => setForm({ ...form, location_name: e.target.value })}
                className="input-field"
                placeholder="Muğla, Milas"
              />
            </div>
            <div>
              <label className="label-text">Enlem</label>
              <input
                type="number"
                step="any"
                value={form.latitude}
                onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                className="input-field"
                placeholder="37.3167"
              />
            </div>
            <div>
              <label className="label-text">Boylam</label>
              <input
                type="number"
                step="any"
                value={form.longitude}
                onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                className="input-field"
                placeholder="28.3667"
              />
            </div>
            <div>
              <label className="label-text">Toplam Türbin Sayısı *</label>
              <input
                type="number"
                min="1"
                value={form.total_turbines}
                onChange={(e) => setForm({ ...form, total_turbines: e.target.value })}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="label-text">Türbin Modeli</label>
              <select
                value={form.turbine_model_id}
                onChange={(e) => setForm({ ...form, turbine_model_id: e.target.value })}
                className="input-field"
              >
                <option value="">Seçiniz</option>
                {turbineModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.manufacturer} {m.model} ({formatMW(m.rated_power_mw)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-text">Hub Yüksekliği (m)</label>
              <input
                type="number"
                step="any"
                value={form.hub_height}
                onChange={(e) => setForm({ ...form, hub_height: e.target.value })}
                className="input-field"
                placeholder="105"
              />
            </div>
            <div>
              <label className="label-text">Başlangıç Tarihi</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="label-text">Hedef Bitiş Tarihi</label>
              <input
                type="date"
                value={form.target_end_date}
                onChange={(e) => setForm({ ...form, target_end_date: e.target.value })}
                className="input-field"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label-text">Notlar</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="input-field"
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setCreateOpen(false)} className="btn-ghost">
              İptal
            </button>
            <button type="submit" disabled={creating} className="btn-primary">
              {creating ? <Spinner size="sm" /> : <Plus className="h-4 w-4" />}
              Oluştur
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
