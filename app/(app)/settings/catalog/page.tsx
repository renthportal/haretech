'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Wind } from 'lucide-react'
import { SkeletonTable } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'
import type { TurbineModel } from '@/types'
import { formatMW, formatMeters, formatTons } from '@/lib/utils'
import toast from 'react-hot-toast'
import Link from 'next/link'

export default function CatalogPage() {
  const [models, setModels] = useState<TurbineModel[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchModels() {
      const { data, error } = await supabase
        .from('turbine_models')
        .select('*')
        .order('manufacturer', { ascending: true })

      if (error) {
        toast.error('Türbin modelleri yüklenemedi')
      } else {
        setModels(data || [])
      }
      setLoading(false)
    }
    fetchModels()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/settings" className="p-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-surface-light">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-white">Türbin Kataloğu</h1>
      </div>

      <p className="text-sm text-gray-400">{models.length} türbin modeli kayıtlı</p>

      {loading ? (
        <SkeletonTable rows={6} />
      ) : models.length === 0 ? (
        <EmptyState
          icon={Wind}
          title="Türbin modeli bulunamadı"
          description="Seed data çalıştırarak varsayılan modelleri ekleyin."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {models.map((model) => (
            <div key={model.id} className="card">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">{model.manufacturer}</p>
                  <h3 className="text-base font-semibold text-gray-100">{model.model}</h3>
                </div>
                <span className="badge-yellow">{formatMW(model.rated_power_mw)}</span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs mb-3">
                <div>
                  <span className="text-gray-500">Rotor</span>
                  <p className="text-gray-200 font-medium">{formatMeters(model.rotor_diameter)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Nacelle</span>
                  <p className="text-gray-200 font-medium">{formatTons(model.nacelle_weight)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Hub</span>
                  <p className="text-gray-200 font-medium">{formatTons(model.hub_weight)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Kanat</span>
                  <p className="text-gray-200 font-medium">{formatTons(model.blade_weight)} x{model.blade_count}</p>
                </div>
                <div>
                  <span className="text-gray-500">Kule</span>
                  <p className="text-gray-200 font-medium">
                    {Array.isArray(model.tower_sections) ? model.tower_sections.length : 0} bölüm
                  </p>
                </div>
              </div>

              {/* Wind limits */}
              <div className="flex items-center gap-4 text-xs pt-3 border-t border-wind-700/20">
                <span className="text-gray-500">Rüzgar Limitleri:</span>
                <span className="text-gray-300">
                  Nacelle: {model.max_wind_nacelle} m/s
                </span>
                <span className="text-gray-300">
                  Kanat: {model.max_wind_blade} m/s
                </span>
                <span className="text-gray-300">
                  Kule: {model.max_wind_tower} m/s
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
