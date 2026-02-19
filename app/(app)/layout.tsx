'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { useProfile } from '@/hooks/useProfile'
import { PageLoader } from '@/components/ui/loading'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { profile, loading } = useProfile()

  if (loading) {
    return (
      <div className="min-h-screen bg-wind-900 flex items-center justify-center">
        <PageLoader />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-wind-900 flex">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        userRole={profile?.role || 'OPERATOR'}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          profile={profile}
        />
        <main className="flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
