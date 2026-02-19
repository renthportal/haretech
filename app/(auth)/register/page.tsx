'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Wind, Eye, EyeOff, UserPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [orgName, setOrgName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // First create the organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({ name: orgName })
        .select()
        .single()

      if (orgError) {
        toast.error('Organizasyon oluşturulamadı: ' + orgError.message)
        setLoading(false)
        return
      }

      // Then sign up the user with org_id in metadata
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            org_id: org.id,
            role: 'ADMIN',
          },
        },
      })

      if (error) {
        toast.error(error.message)
      } else {
        toast.success('Kayıt başarılı! Giriş yapabilirsiniz.')
        router.push('/dashboard')
        router.refresh()
      }
    } catch {
      toast.error('Bir hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-wind-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-wind-700 mb-4">
            <Wind className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">WindLift</h1>
          <p className="text-sm text-gray-400 mt-1">Yeni Hesap Oluştur</p>
        </div>

        {/* Register form */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-100 mb-6">Kayıt Ol</h2>
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label htmlFor="orgName" className="label-text">Firma Adı</label>
              <input
                id="orgName"
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="input-field"
                placeholder="Firma A.Ş."
                required
              />
            </div>

            <div>
              <label htmlFor="fullName" className="label-text">Ad Soyad</label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="input-field"
                placeholder="Ahmet Yılmaz"
                required
              />
            </div>

            <div>
              <label htmlFor="email" className="label-text">E-posta</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="ornek@firma.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="password" className="label-text">Şifre</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pr-12"
                  placeholder="••••••••"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">En az 6 karakter</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <>
                  <UserPlus className="h-5 w-5" />
                  Kayıt Ol
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-400">
              Zaten hesabınız var mı?{' '}
              <Link href="/login" className="text-wind-400 hover:text-wind-300 font-medium">
                Giriş Yap
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
