'use client'

import { Users } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

export default function CrewsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Ekipler</h1>
      <EmptyState
        icon={Users}
        title="Ekip Yönetimi"
        description="Sprint 5'te ekip oluşturma, üye atama ve ekip takvimi eklenecek."
      />
    </div>
  )
}
