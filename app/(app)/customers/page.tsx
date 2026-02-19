'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import { Building2, Plus, Edit2, Phone, Mail, MapPin, Search, X, Save } from 'lucide-react'
import toast from 'react-hot-toast'

const EMPTY_FORM = { name: '', short_name: '', country: 'TR', city: '', address: '', contact_name: '', contact_email: '', contact_phone: '', notes: '' }

export default function CustomersPage() {
  const { profile } = useProfile()
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('customers').select('*, projects:projects(id, name)').eq('is_active', true).order('name')
    setCustomers(data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetch() }, [fetch])

  function openNew() { setForm({ ...EMPTY_FORM }); setEditing(null); setModal(true) }
  function openEdit(c: any) { setForm({ name: c.name, short_name: c.short_name || '', country: c.country || 'TR', city: c.city || '', address: c.address || '', contact_name: c.contact_name || '', contact_email: c.contact_email || '', contact_phone: c.contact_phone || '', notes: c.notes || '' }); setEditing(c); setModal(true) }

  async function save() {
    if (!form.name.trim()) { toast.error('Müşteri adı zorunlu'); return }
    setSaving(true)
    const payload = { ...form, org_id: profile?.org_id }
    const { error } = editing
      ? await supabase.from('customers').update(payload).eq('id', editing.id)
      : await supabase.from('customers').insert(payload)
    if (error) toast.error(error.message)
    else { toast.success(editing ? 'Güncellendi' : 'Müşteri eklendi'); setModal(false); fetch() }
    setSaving(false)
  }

  async function deactivate(id: string) {
    if (!confirm('Bu müşteriyi pasif yapmak istiyor musunuz?')) return
    await supabase.from('customers').update({ is_active: false }).eq('id', id)
    fetch()
  }

  const filtered = customers.filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.city?.toLowerCase().includes(search.toLowerCase()))

  const canManage = profile?.role === 'ADMIN' || profile?.role === 'PROJECT_MANAGER'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Müşteriler</h1>
          <p className="text-sm text-gray-500 mt-0.5">{customers.length} aktif müşteri</p>
        </div>
        {canManage && <button onClick={openNew} className="btn-primary"><Plus className="h-4 w-4" />Yeni Müşteri</button>}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ara..." className="input-field pl-9" />
      </div>

      {loading ? <div className="text-center py-12 text-gray-500">Yükleniyor...</div> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <div key={c.id} className="card hover:border-wind-700/40 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-wind-700/30 flex items-center justify-center text-wind-400 font-bold text-sm flex-shrink-0">
                    {(c.short_name || c.name).slice(0,2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-100">{c.name}</p>
                    {c.short_name && <p className="text-xs text-gray-500">{c.short_name}</p>}
                  </div>
                </div>
                {canManage && (
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(c)} className="p-1.5 text-gray-500 hover:text-gray-200 hover:bg-surface-light rounded"><Edit2 className="h-3.5 w-3.5" /></button>
                    <button onClick={() => deactivate(c.id)} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded"><X className="h-3.5 w-3.5" /></button>
                  </div>
                )}
              </div>
              <div className="mt-3 space-y-1.5">
                {c.city && <p className="text-xs text-gray-400 flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-gray-600" />{c.city}{c.country !== 'TR' && `, ${c.country}`}</p>}
                {c.contact_name && <p className="text-xs text-gray-400 flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-gray-600" />{c.contact_name}</p>}
                {c.contact_email && <p className="text-xs text-gray-400 flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-gray-600" />{c.contact_email}</p>}
                {c.contact_phone && <p className="text-xs text-gray-400 flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-gray-600" />{c.contact_phone}</p>}
              </div>
              {c.projects && c.projects.length > 0 && (
                <div className="mt-3 pt-3 border-t border-wind-700/20">
                  <p className="text-xs text-gray-500 mb-1.5">{c.projects.length} Proje</p>
                  <div className="flex flex-wrap gap-1">
                    {c.projects.map((p: any) => <span key={p.id} className="text-xs bg-surface-light text-gray-400 px-2 py-0.5 rounded-full">{p.name}</span>)}
                  </div>
                </div>
              )}
            </div>
          ))}
          {canManage && (
            <button onClick={openNew} className="card border-dashed border-wind-700/30 hover:border-wind-600/50 flex flex-col items-center justify-center gap-2 py-8 text-gray-600 hover:text-gray-400 transition-colors cursor-pointer">
              <Plus className="h-8 w-8" />
              <span className="text-sm">Yeni Müşteri Ekle</span>
            </button>
          )}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f1a12] border border-wind-700/30 rounded-xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-white">{editing ? 'Müşteriyi Düzenle' : 'Yeni Müşteri'}</h3>
              <button onClick={() => setModal(false)} className="text-gray-500 hover:text-gray-300"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Firma Adı *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} full />
                <Field label="Kısa Ad" value={form.short_name} onChange={(v) => setForm({ ...form, short_name: v })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Şehir" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
                <Field label="Ülke" value={form.country} onChange={(v) => setForm({ ...form, country: v })} />
              </div>
              <Field label="Adres" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
              <div className="border-t border-wind-700/20 pt-3">
                <p className="text-xs text-gray-500 mb-2">İletişim Kişisi</p>
                <div className="grid grid-cols-1 gap-3">
                  <Field label="Ad Soyad" value={form.contact_name} onChange={(v) => setForm({ ...form, contact_name: v })} />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="E-posta" value={form.contact_email} onChange={(v) => setForm({ ...form, contact_email: v })} type="email" />
                    <Field label="Telefon" value={form.contact_phone} onChange={(v) => setForm({ ...form, contact_phone: v })} type="tel" />
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Notlar</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="input-field w-full resize-none text-sm" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setModal(false)} className="btn-ghost flex-1" disabled={saving}><X className="h-4 w-4" />İptal</button>
              <button onClick={save} className="btn-primary flex-1" disabled={saving}><Save className="h-4 w-4" />{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', full }: { label: string; value: string; onChange: (v: string) => void; type?: string; full?: boolean }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <label className="text-xs text-gray-400 mb-1 block">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="input-field w-full text-sm" />
    </div>
  )
}
