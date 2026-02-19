'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  GitBranch,
  BarChart3,
  FolderKanban,
  Truck,
  Cloud,
  Map,
  FileBarChart,
  Settings,
  Wind,
  X,
  Users,
} from 'lucide-react'
import type { UserRole } from '@/types'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  userRole: UserRole
}

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  roles?: UserRole[]
}

const navItems: NavItem[] = [
  {
    label: 'Panel',
    href: '/dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
  },
  {
    label: 'Projeler',
    href: '/projects',
    icon: <FolderKanban className="h-5 w-5" />,
  },
  {
    label: 'Personel',
    href: '/personnel',
    icon: <Users className="h-5 w-5" />,
    roles: ['ADMIN', 'PROJECT_MANAGER', 'FIELD_ENGINEER'],
  },
  {
    label: 'Kaynaklar',
    href: '/resources/cranes',
    icon: <Truck className="h-5 w-5" />,
    roles: ['ADMIN', 'PROJECT_MANAGER', 'FIELD_ENGINEER'],
  },
  {
    label: 'Hava Durumu',
    href: '/weather',
    icon: <Cloud className="h-5 w-5" />,
  },
  {
    label: 'Harita',
    href: '/map',
    icon: <Map className="h-5 w-5" />,
  },
  {
    label: 'Planlama',
    href: '/planning',
    icon: <GitBranch className="h-5 w-5" />,
    children: [
      { label: 'Gantt Çizelgesi', href: '/planning' },
      { label: 'Kaynak Çakışması', href: '/planning/conflicts' },
    ],
  },
  {
    label: 'Raporlar',
    href: '/reports',
    icon: <FileBarChart className="h-5 w-5" />,
    roles: ['ADMIN', 'PROJECT_MANAGER'],
  },
  {
    label: 'Ayarlar',
    href: '/settings',
    icon: <Settings className="h-5 w-5" />,
    roles: ['ADMIN'],
  },
]

export function Sidebar({ isOpen, onClose, userRole }: SidebarProps) {
  const pathname = usePathname()

  const filteredItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(userRole)
  )

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-surface-dark border-r border-wind-700/20 transition-transform duration-200 lg:translate-x-0 lg:static lg:z-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-wind-700/20">
          <Link href="/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-wind-700">
              <Wind className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold text-white tracking-tight">WindLift</span>
              <span className="block text-[10px] text-gray-500 -mt-1 font-medium tracking-wider uppercase">
                Montaj Yönetimi
              </span>
            </div>
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-surface-light"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="px-3 py-4 space-y-1">
          {filteredItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                  isActive
                    ? 'bg-wind-700/20 text-wind-400 border border-wind-700/30'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-surface-light'
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
