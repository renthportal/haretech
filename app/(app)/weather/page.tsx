'use client'

import { Cloud } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

export default function WeatherPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Hava Durumu</h1>
      <EmptyState
        icon={Cloud}
        title="Hava Durumu Modülü"
        description="Sprint 4'te OpenWeatherMap API entegrasyonu, proje bazlı saatlik rüzgar tahmini ve Go/No-Go matrisi eklenecek."
      />
    </div>
  )
}
