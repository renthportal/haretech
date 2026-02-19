'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Truck } from 'lucide-react'
import { SkeletonCard } from '@/components/ui/loading'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import type { Crane } from '@/types'
import { formatTons, formatMeters } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function CranesPage() {
  const [cranes, setCranes] = useState<Crane[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchCranes() {
      const { data, error } = await supabase
        .from('cranes')
        .select('*')
        .order('name')

      if (error) {
        toast.error('Vinçler yüklenemedi')
      } else {
        setCranes(data || [])
      }
      setLoading(false)
    }
    fetchCranes()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Vinçler</h1>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : cranes.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="Henüz vinç eklenmemiş"
          description="Sprint 5'te vinç yönetimi özelliği tam olarak eklenecek."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cranes.map((crane) => (
            <div key={crane.id} className="card">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-100">{crane.name}</h3>
                  <p className="text-xs text-gray-500">
                    {crane.manufacturer} {crane.model}
                  </p>
                </div>
                <StatusBadge status={crane.status} type="crane" />
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">Kapasite</span>
                  <p className="text-gray-200 font-medium">
                    {crane.max_capacity ? formatTons(crane.max_capacity) : '—'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Boom</span>
                  <p className="text-gray-200 font-medium">
                    {crane.max_boom_length ? formatMeters(crane.max_boom_length) : '—'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Tip Height</span>
                  <p className="text-gray-200 font-medium">
                    {crane.max_tip_height ? formatMeters(crane.max_tip_height) : '—'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
