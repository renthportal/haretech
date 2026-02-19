'use client'

import { Calendar } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

export default function ResourceCalendarPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Kaynak Takvimi</h1>
      <EmptyState
        icon={Calendar}
        title="Kaynak Takvimi"
        description="Sprint 5'te vinç ve ekip atama takvimi (Gantt benzeri) eklenecek."
      />
    </div>
  )
}
