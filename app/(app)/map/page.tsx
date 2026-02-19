'use client'

import { Map } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

export default function MapPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Harita</h1>
      <EmptyState
        icon={Map}
        title="Harita Modülü"
        description="Sprint 7'de Leaflet/Mapbox entegrasyonu ile proje haritası, türbin pozisyonları ve vinç konumları eklenecek."
      />
    </div>
  )
}
