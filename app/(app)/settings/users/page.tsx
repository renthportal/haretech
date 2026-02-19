'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import { UserPlus, Users, ArrowLeft } from 'lucide-react'
import { Spinner, SkeletonTable } from '@/components/ui/loading'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Modal } from '@/components/ui/modal'
import type { Profile, UserRole } from '@/types'
import { ROLE_LABELS } from '@/types'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import Link from 'next/link'

export default function UsersPage() {
  const { profile } = useProfile()
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)
  const supabase = createClient()

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('OPERATOR')
  const [inviting, setInviting] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchUsers() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Kullanıcılar yüklenemedi')
    } else {
      setUsers(data || [])
    }
    setLoading(false)
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.org_id) return
    setInviting(true)

    try {
      // In production, this would send an invitation email
      // For now, create the user directly via Supabase Admin API or invite
      const { error } = await supabase.auth.signUp({
        email: inviteEmail,
        password: Math.random().toString(36).slice(-12), // Temp password
        options: {
          data: {
            full_name: inviteName,
            org_id: profile.org_id,
            role: inviteRole,
          },
        },
      })

      if (error) {
        toast.error('Davet gönderilemedi: ' + error.message)
      } else {
        toast.success('Kullanıcı eklendi')
        setInviteOpen(false)
        setInviteEmail('')
        setInviteName('')
        setInviteRole('OPERATOR')
        fetchUsers()
      }
    } catch {
      toast.error('Bir hata oluştu')
    } finally {
      setInviting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/settings" className="p-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-surface-light">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-white">Kullanıcı Yönetimi</h1>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">{users.length} kullanıcı</p>
        <button onClick={() => setInviteOpen(true)} className="btn-primary">
          <UserPlus className="h-4 w-4" />
          Kullanıcı Ekle
        </button>
      </div>

      {loading ? (
        <SkeletonTable rows={5} />
      ) : users.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Henüz kullanıcı yok"
          description="Ekibinizi davet ederek başlayın."
          action={
            <button onClick={() => setInviteOpen(true)} className="btn-primary">
              <UserPlus className="h-4 w-4" />
              Kullanıcı Ekle
            </button>
          }
        />
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-wind-700/20">
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">
                    Ad Soyad
                  </th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">
                    Rol
                  </th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">
                    Telefon
                  </th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">
                    Durum
                  </th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">
                    Kayıt
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-wind-700/10">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-surface-light/50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-wind-700 text-white text-sm font-medium">
                          {user.full_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm text-gray-200 font-medium">{user.full_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={user.role} type="role" />
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-400">
                      {user.phone || '—'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`badge ${user.is_active ? 'badge-green' : 'badge-red'}`}>
                        {user.is_active ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-400">
                      {formatDate(user.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      <Modal isOpen={inviteOpen} onClose={() => setInviteOpen(false)} title="Kullanıcı Ekle">
        <form onSubmit={handleInvite} className="space-y-4">
          <div>
            <label htmlFor="inviteName" className="label-text">Ad Soyad</label>
            <input
              id="inviteName"
              type="text"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              className="input-field"
              required
            />
          </div>
          <div>
            <label htmlFor="inviteEmail" className="label-text">E-posta</label>
            <input
              id="inviteEmail"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="input-field"
              required
            />
          </div>
          <div>
            <label htmlFor="inviteRole" className="label-text">Rol</label>
            <select
              id="inviteRole"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as UserRole)}
              className="input-field"
            >
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setInviteOpen(false)} className="btn-ghost">
              İptal
            </button>
            <button type="submit" disabled={inviting} className="btn-primary">
              {inviting ? <Spinner size="sm" /> : <UserPlus className="h-4 w-4" />}
              Ekle
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
