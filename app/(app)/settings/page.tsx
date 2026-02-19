'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import { Save, Building2, User, Shield, Key } from 'lucide-react'
import { Spinner } from '@/components/ui/loading'
import { ROLE_LABELS } from '@/types'
import toast from 'react-hot-toast'
import Link from 'next/link'

export default function SettingsPage() {
  const { profile, loading: profileLoading, setProfile } = useProfile()
  const supabase = createClient()

  // Profile form
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)

  // Organization form
  const [orgName, setOrgName] = useState('')
  const [savingOrg, setSavingOrg] = useState(false)

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name)
      setPhone(profile.phone || '')
    }
  }, [profile])

  useEffect(() => {
    async function fetchOrg() {
      if (!profile?.org_id) return
      const { data } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', profile.org_id)
        .single()
      if (data) {
        setOrgName(data.name)
      }
    }
    fetchOrg()
  }, [profile?.org_id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setSaving(true)

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName, phone: phone || null })
        .eq('id', profile.id)

      if (error) {
        toast.error('Profil güncellenemedi: ' + error.message)
      } else {
        setProfile({ ...profile, full_name: fullName, phone: phone || null })
        toast.success('Profil güncellendi')
      }
    } catch {
      toast.error('Bir hata oluştu')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.org_id) return
    setSavingOrg(true)

    try {
      const { error } = await supabase
        .from('organizations')
        .update({ name: orgName })
        .eq('id', profile.org_id)

      if (error) {
        toast.error('Organizasyon güncellenemedi: ' + error.message)
      } else {
        toast.success('Organizasyon güncellendi')
      }
    } catch {
      toast.error('Bir hata oluştu')
    } finally {
      setSavingOrg(false)
    }
  }

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-white">Ayarlar</h1>

      {/* Profile settings */}
      <div className="card">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-wind-700/20">
            <User className="h-5 w-5 text-wind-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-100">Profil Bilgileri</h2>
            <p className="text-xs text-gray-500">Kişisel bilgilerinizi güncelleyin</p>
          </div>
        </div>
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label htmlFor="fullName" className="label-text">Ad Soyad</label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input-field"
              required
            />
          </div>
          <div>
            <label htmlFor="phone" className="label-text">Telefon</label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input-field"
              placeholder="+90 5XX XXX XX XX"
            />
          </div>
          <div>
            <label className="label-text">Rol</label>
            <div className="input-field bg-wind-900/30 cursor-not-allowed text-gray-400 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              {profile?.role ? ROLE_LABELS[profile.role] : '—'}
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Spinner size="sm" /> : <Save className="h-4 w-4" />}
              Kaydet
            </button>
          </div>
        </form>
      </div>

      {/* Organization settings (admin only) */}
      {profile?.role === 'ADMIN' && (
        <div className="card">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-accent/10">
              <Building2 className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-100">Organizasyon</h2>
              <p className="text-xs text-gray-500">Firma bilgilerini yönetin</p>
            </div>
          </div>
          <form onSubmit={handleSaveOrg} className="space-y-4">
            <div>
              <label htmlFor="orgName" className="label-text">Firma Adı</label>
              <input
                id="orgName"
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="input-field"
                required
              />
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={savingOrg} className="btn-primary">
                {savingOrg ? <Spinner size="sm" /> : <Save className="h-4 w-4" />}
                Kaydet
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Quick links for admin */}
      {profile?.role === 'ADMIN' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href="/settings/users" className="card-hover flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-purple-500/10">
              <User className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-200">Kullanıcı Yönetimi</p>
              <p className="text-xs text-gray-500">Kullanıcı ekle, düzenle, roller</p>
            </div>
          </Link>
          <Link href="/settings/catalog" className="card-hover flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-blue-500/10">
              <Key className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-200">Türbin Kataloğu</p>
              <p className="text-xs text-gray-500">Türbin modelleri ekle, düzenle</p>
            </div>
          </Link>
        </div>
      )}
    </div>
  )
}
