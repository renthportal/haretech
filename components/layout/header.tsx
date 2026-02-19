'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Menu, Bell, User, LogOut, Settings, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'
import { ROLE_LABELS } from '@/types'

interface HeaderProps {
  onMenuToggle: () => void
  profile: Profile | null
}

export function Header({ onMenuToggle, profile }: HeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="sticky top-0 z-30 h-16 bg-surface-dark/80 backdrop-blur-md border-b border-wind-700/20">
      <div className="flex items-center justify-between h-full px-4 lg:px-6">
        {/* Left: menu + breadcrumb */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-surface-light"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        {/* Right: notifications + user */}
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <button className="relative p-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-surface-light transition-colors">
            <Bell className="h-5 w-5" />
          </button>

          {/* User dropdown */}
          <div ref={dropdownRef} className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 p-2 rounded-lg text-gray-300 hover:text-gray-100 hover:bg-surface-light transition-colors"
            >
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-wind-700 text-white text-sm font-medium">
                {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-sm font-medium">{profile?.full_name || 'Kullanıcı'}</div>
                <div className="text-xs text-gray-500">
                  {profile?.role ? ROLE_LABELS[profile.role] : ''}
                </div>
              </div>
              <ChevronDown className="h-4 w-4 hidden sm:block" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-surface border border-wind-700/30 rounded-xl shadow-xl py-1 z-50">
                <div className="px-4 py-3 border-b border-wind-700/20">
                  <p className="text-sm font-medium text-gray-200">{profile?.full_name}</p>
                  <p className="text-xs text-gray-500">{profile?.role ? ROLE_LABELS[profile.role] : ''}</p>
                </div>
                <button
                  onClick={() => {
                    setDropdownOpen(false)
                    router.push('/settings')
                  }}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-300 hover:text-gray-100 hover:bg-surface-light transition-colors"
                >
                  <Settings className="h-4 w-4" />
                  Ayarlar
                </button>
                <button
                  onClick={() => {
                    setDropdownOpen(false)
                    router.push('/settings')
                  }}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-300 hover:text-gray-100 hover:bg-surface-light transition-colors"
                >
                  <User className="h-4 w-4" />
                  Profil
                </button>
                <hr className="border-wind-700/20 my-1" />
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-surface-light transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Çıkış Yap
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
