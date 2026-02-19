'use client'

import { FileBarChart } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Raporlar</h1>
      <EmptyState
        icon={FileBarChart}
        title="Raporlar Modülü"
        description="Sprint 7'de proje ilerleme raporu, hava durumu analizi, kaynak kullanım raporu ve Excel export eklenecek."
      />
    </div>
  )
}
