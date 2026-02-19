'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertTriangle,
  ChevronDown, ChevronUp, Clock, Users, Calendar,
  Trash2, Link2, ArrowLeft, Info,
} from 'lucide-react'
import Link from 'next/link'
import { Spinner } from '@/components/ui/loading'
import { Modal } from '@/components/ui/modal'
import {
  parseOdooExcel, type ParseResult, type ParsedRow, ENTRY_TYPE_LABELS,
} from '@/lib/odoo-parser'
import toast from 'react-hot-toast'

interface ImportBatch {
  id: string
  file_name: string
  period_start: string | null
  period_end: string | null
  total_rows: number
  imported_rows: number
  new_personnel: number
  skipped_rows: number
  status: string
  errors: string[]
  created_at: string
  profiles?: { full_name: string } | null
}

type ImportStep = 'idle' | 'parsed' | 'confirming' | 'done'

export default function PersonnelImportPage() {
  const { profile } = useProfile()
  const [step, setStep] = useState<ImportStep>('idle')
  const [dragging, setDragging] = useState(false)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [batches, setBatches] = useState<ImportBatch[]>([])
  const [batchesLoading, setBatchesLoading] = useState(true)
  const [duplicateMode, setDuplicateMode] = useState<'skip' | 'overwrite'>('skip')
  const [projectMappings, setProjectMappings] = useState<Record<string, string>>({})
  const [availableProjects, setAvailableProjects] = useState<{ id: string; name: string }[]>([])
  const [mappingModalOpen, setMappingModalOpen] = useState(false)
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null)
  const [deleteModal, setDeleteModal] = useState<ImportBatch | null>(null)
  const [deleting, setDeleting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const fetchBatches = useCallback(async () => {
    setBatchesLoading(true)
    const { data } = await supabase
      .from('import_batches')
      .select('*, profiles:uploaded_by(full_name)')
      .order('created_at', { ascending: false })
      .limit(50)
    setBatches((data || []) as ImportBatch[])
    setBatchesLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchBatches()
    supabase.from('projects').select('id, name').order('name').then(({ data }) => {
      setAvailableProjects(data || [])
    })
    supabase.from('odoo_project_mappings').select('odoo_code, project_id').then(({ data }) => {
      if (data) {
        const m: Record<string, string> = {}
        for (const r of data) m[String(r.odoo_code)] = String(r.project_id)
        setProjectMappings(m)
      }
    })
  }, [fetchBatches, supabase])

  async function handleFile(file: File) {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('Sadece .xlsx veya .xls dosyaları kabul edilir')
      return
    }
    setFileName(file.name)
    const buffer = await file.arrayBuffer()
    try {
      const result = parseOdooExcel(buffer)
      if (result.warnings.length > 0 && result.rows.length === 0) {
        toast.error(result.warnings[0])
        return
      }
      setParseResult(result)
      setStep('parsed')
      if (result.warnings.length > 0) toast(result.warnings.join('\n'), { icon: '⚠️' })
    } catch (e) {
      toast.error('Dosya okunamadı. Odoo formatında olduğundan emin olun.')
      console.error(e)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const unmappedProjects = parseResult
    ? parseResult.uniqueProjects.filter((p) => p.odooCode && !projectMappings[p.odooCode])
    : []

  async function handleImport() {
    if (!parseResult || !profile?.org_id) return
    setImporting(true)
    setImportProgress(0)

    const { data: batch, error: bErr } = await supabase
      .from('import_batches')
      .insert({
        org_id: profile.org_id,
        uploaded_by: profile.id,
        file_name: fileName,
        period_start: parseResult.dateRange.start || null,
        period_end: parseResult.dateRange.end || null,
        total_rows: parseResult.totalRows,
        status: 'processing',
      })
      .select()
      .single()

    if (bErr || !batch) { toast.error('Import başlatılamadı'); setImporting(false); return }

    let importedRows = 0, newPersonnel = 0, skippedRows = 0
    const errors: string[] = []

    // Save project mappings
    for (const [code, projectId] of Object.entries(projectMappings)) {
      const proj = parseResult.uniqueProjects.find((p) => p.odooCode === code)
      await supabase.from('odoo_project_mappings').upsert({
        org_id: profile.org_id,
        odoo_code: code,
        odoo_name: proj?.odooName ?? code,
        project_id: projectId,
      }, { onConflict: 'org_id,odoo_code' })
    }

    // Upsert personnel
    const personnelIds = new Map<string, string>()
    for (const ps of parseResult.uniquePersonnel) {
      const { data: existing } = await supabase
        .from('personnel').select('id')
        .eq('org_id', profile.org_id).eq('employee_code', ps.employeeCode).single()
      if (existing) {
        personnelIds.set(ps.employeeCode, String(existing.id))
      } else {
        const { data: created } = await supabase
          .from('personnel')
          .insert({ org_id: profile.org_id, employee_code: ps.employeeCode, full_name: ps.fullName, department: ps.department || null, status: 'available' })
          .select('id').single()
        if (created) { personnelIds.set(ps.employeeCode, String(created.id)); newPersonnel++ }
      }
    }

    // Import rows in chunks
    const chunkSize = 10
    const rows: ParsedRow[] = parseResult.rows
    const total = rows.length

    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize)
      for (const row of chunk) {
        const personnelId = personnelIds.get(row.employeeCode)
        if (!personnelId) { skippedRows++; continue }

        const projectId = row.odooProjectCode ? (projectMappings[row.odooProjectCode] || null) : null

        const { data: existing } = await supabase
          .from('work_entries').select('id')
          .eq('personnel_id', personnelId).eq('work_date', row.workDate)
          .neq('import_batch_id', String(batch.id)).maybeSingle()

        if (existing && duplicateMode === 'skip') { skippedRows++; continue }
        if (existing && duplicateMode === 'overwrite') {
          await supabase.from('work_entries').delete().eq('id', String(existing.id))
        }

        const { data: we, error: weErr } = await supabase
          .from('work_entries')
          .insert({
            org_id: profile.org_id,
            personnel_id: personnelId,
            work_date: row.workDate,
            entry_type: row.entryType,
            total_hours: row.totalHours,
            start_time: row.startTime,
            end_time: row.endTime,
            project_id: projectId,
            odoo_project_code: row.odooProjectCode || null,
            odoo_activity_code: row.odooActivityCode || null,
            notes: row.notes || null,
            meal_breakfast: row.mealBreakfast,
            meal_lunch: row.mealLunch,
            meal_dinner: row.mealDinner,
            meal_night: row.mealNight,
            odoo_status: row.odooStatus || null,
            import_batch_id: batch.id,
          })
          .select('id').single()

        if (weErr || !we) { errors.push(`${row.fullName} / ${row.workDate}: ${weErr?.message}`); skippedRows++; continue }

        const linesInsert = row.lines
          .filter((l) => l.workTypeRaw && l.workTypeRaw !== '')
          .map((l) => ({
            work_entry_id: we.id,
            line_no: l.lineNo,
            work_type_code: l.workTypeCode,
            work_type_label: l.workTypeLabel,
            turbine_raw: l.turbineRaw || null,
            hours: l.hours,
          }))
        if (linesInsert.length > 0) await supabase.from('work_entry_lines').insert(linesInsert)
        importedRows++
      }
      setImportProgress(Math.round(((i + chunk.length) / total) * 100))
    }

    // Update personnel statuses based on today's entry
    const today = new Date().toISOString().split('T')[0]
    for (const [, pid] of Array.from(personnelIds.entries())) {
      const { data: todayEntry } = await supabase
        .from('work_entries').select('entry_type, project_id')
        .eq('personnel_id', pid).eq('work_date', today).maybeSingle()
      if (todayEntry) {
        const statusMap: Record<string, string> = {
          on_site: 'on_site', travel: 'travel', standby: 'standby',
          annual_leave: 'leave', inter_project_leave: 'leave', sick_leave: 'leave',
          training: 'training', day_off: 'leave',
        }
        await supabase.from('personnel').update({
          status: statusMap[String(todayEntry.entry_type)] || 'available',
          current_project_id: todayEntry.project_id || null,
        }).eq('id', pid)
      }
    }

    await supabase.from('import_batches').update({
      imported_rows: importedRows, new_personnel: newPersonnel,
      skipped_rows: skippedRows, errors: errors.slice(0, 20),
      status: errors.length > importedRows ? 'failed' : 'completed',
    }).eq('id', String(batch.id))

    setImporting(false)
    setStep('done')
    toast.success(`${importedRows} kayıt içe aktarıldı. ${newPersonnel} yeni personel eklendi.`)
    fetchBatches()
    setParseResult(null)
  }

  async function handleDelete(batch: ImportBatch) {
    setDeleting(true)
    await supabase.from('work_entries').delete().eq('import_batch_id', batch.id)
    await supabase.from('import_batches').delete().eq('id', batch.id)
    toast.success('Import silindi')
    setDeleteModal(null)
    setDeleting(false)
    fetchBatches()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/personnel" className="btn-ghost p-2"><ArrowLeft className="h-4 w-4" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Excel İçe Aktar</h1>
          <p className="text-sm text-gray-500 mt-0.5">Odoo HR Puantaj (hr_work_entry) dosyasını yükleyin</p>
        </div>
      </div>

      {(step === 'idle' || step === 'done') && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${dragging ? 'border-wind-500 bg-wind-700/10' : 'border-wind-700/30 hover:border-wind-700/60 hover:bg-surface-light/30'}`}
        >
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileInput} className="hidden" />
          <FileSpreadsheet className="h-12 w-12 text-wind-600 mx-auto mb-4" />
          <p className="text-lg font-semibold text-gray-200">{dragging ? 'Dosyayı bırakın' : 'Excel dosyasını sürükleyin veya seçin'}</p>
          <p className="text-sm text-gray-500 mt-2">Odoo → HR → Puantaj Kayıtları → Export (.xlsx)</p>
          <div className="flex items-center gap-2 justify-center mt-4">
            <button className="btn-primary pointer-events-none"><Upload className="h-4 w-4" />Dosya Seç</button>
          </div>
        </div>
      )}

      {step === 'parsed' && parseResult && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard icon={<Users className="h-4 w-4" />} label="Personel" value={parseResult.uniquePersonnel.length} color="text-wind-400" />
            <SummaryCard icon={<Calendar className="h-4 w-4" />} label="İş Kaydı" value={parseResult.rows.length} color="text-blue-400" />
            <SummaryCard icon={<Clock className="h-4 w-4" />} label="Tarih Aralığı" value={`${parseResult.dateRange.start} → ${parseResult.dateRange.end}`} small color="text-gray-300" />
            <SummaryCard icon={<AlertTriangle className="h-4 w-4" />} label="Atlanan" value={parseResult.skippedRows} color="text-yellow-400" />
          </div>

          {unmappedProjects.length > 0 && (
            <div className="card border-yellow-500/30 bg-yellow-500/5 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-200">{unmappedProjects.length} Odoo projesi WindLift projesine eşlenmedi</p>
                <p className="text-xs text-gray-400 mt-1">Eşlenmeden import edilirse bu kayıtlar projesiz kalır.</p>
                <button onClick={() => setMappingModalOpen(true)} className="btn-ghost text-xs mt-2 text-yellow-400 border-yellow-500/30">
                  <Link2 className="h-3.5 w-3.5" />Projeleri Eşle ({unmappedProjects.length})
                </button>
              </div>
            </div>
          )}

          <div className="card flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2"><Info className="h-4 w-4 text-gray-500" /><span className="text-sm text-gray-400">Tekrar yükleme durumunda:</span></div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="dup" value="skip" checked={duplicateMode === 'skip'} onChange={() => setDuplicateMode('skip')} className="accent-wind-500" />
              <span className="text-sm text-gray-300">Mevcut kayıtları atla</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="dup" value="overwrite" checked={duplicateMode === 'overwrite'} onChange={() => setDuplicateMode('overwrite')} className="accent-wind-500" />
              <span className="text-sm text-gray-300">Üzerine yaz</span>
            </label>
          </div>

          <div className="card p-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-wind-700/20">
              <h3 className="text-sm font-semibold text-gray-200">Önizleme — İlk 20 Kayıt</h3>
              <span className="text-xs text-gray-500">{fileName}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-wind-700/20">
                    {['Personel','Tarih','Tür','Süre','İş Tipleri','Proje'].map((h) => (
                      <th key={h} className="text-left text-xs text-gray-400 uppercase tracking-wider px-4 py-2.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-wind-700/10">
                  {parseResult.rows.slice(0, 20).map((row, i) => (
                    <tr key={i} className="hover:bg-surface-light/30">
                      <td className="px-4 py-2.5"><p className="text-sm text-gray-200">{row.fullName}</p><p className="text-xs text-gray-500">#{row.employeeCode}</p></td>
                      <td className="px-4 py-2.5 text-sm font-mono text-gray-400">{row.workDate}</td>
                      <td className="px-4 py-2.5"><span className="badge badge-gray text-xs">{ENTRY_TYPE_LABELS[row.entryType] || row.entryTypeRaw}</span></td>
                      <td className="px-4 py-2.5 text-sm text-gray-400">{row.totalHours}s</td>
                      <td className="px-4 py-2.5 text-xs text-gray-400 max-w-[200px]">
                        {row.lines.filter((l) => l.hours > 0 && l.workTypeLabel && !['Proje Arası', 'İzin Günü'].includes(l.workTypeLabel))
                          .map((l) => `${l.workTypeLabel}${l.turbineRaw && l.turbineRaw !== '*' ? ` (${l.turbineRaw})` : ''}: ${l.hours}s`).join(' · ') || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">{row.odooProjectCode || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {importing && (
            <div className="card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-300">İçe aktarılıyor...</span>
                <span className="text-sm font-mono text-wind-400">{importProgress}%</span>
              </div>
              <div className="h-2 bg-surface-light rounded-full overflow-hidden">
                <div className="h-full bg-wind-600 rounded-full transition-all duration-300" style={{ width: `${importProgress}%` }} />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <button onClick={() => { setStep('idle'); setParseResult(null) }} className="btn-ghost" disabled={importing}>İptal</button>
            <button onClick={handleImport} disabled={importing} className="btn-primary">
              {importing ? <Spinner size="sm" /> : <Upload className="h-4 w-4" />}
              {importing ? 'İçe Aktarılıyor...' : `${parseResult.rows.length} Kaydı İçe Aktar`}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="card text-center py-8 border-wind-600/30 bg-wind-700/5">
          <CheckCircle2 className="h-12 w-12 text-wind-400 mx-auto mb-3" />
          <p className="text-lg font-semibold text-gray-200">İçe Aktarma Tamamlandı</p>
          <div className="flex justify-center gap-3 mt-4">
            <Link href="/personnel" className="btn-primary">Personele Git</Link>
            <button onClick={() => setStep('idle')} className="btn-ghost">Yeni Dosya Yükle</button>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5 text-gray-500" />Import Geçmişi
        </h2>
        {batchesLoading ? (
          <div className="text-sm text-gray-500 text-center py-6">Yükleniyor...</div>
        ) : batches.length === 0 ? (
          <div className="card text-center py-8 text-gray-500 text-sm">Henüz import yapılmamış</div>
        ) : (
          <div className="space-y-2">
            {batches.map((b) => (
              <div key={b.id} className="card p-0 overflow-hidden">
                <button
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-surface-light/30 transition-colors"
                  onClick={() => setExpandedBatch(expandedBatch === b.id ? null : b.id)}
                >
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="h-4 w-4 text-wind-600 flex-shrink-0" />
                      <span className="text-sm font-medium text-gray-200">{b.file_name}</span>
                      <BatchStatusBadge status={b.status} />
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                      <span>{b.period_start && b.period_end ? `${b.period_start} → ${b.period_end}` : 'Tarih bilinmiyor'}</span>
                      <span>{b.imported_rows} / {b.total_rows} satır</span>
                      {b.new_personnel > 0 && <span>{b.new_personnel} yeni personel</span>}
                      {b.skipped_rows > 0 && <span className="text-yellow-500">{b.skipped_rows} atlanan</span>}
                      <span>{new Date(b.created_at).toLocaleString('tr-TR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}</span>
                      {b.profiles?.full_name && <span className="text-gray-600">· {b.profiles.full_name}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); setDeleteModal(b) }}
                      className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="İmport'u sil">
                      <Trash2 className="h-4 w-4" />
                    </button>
                    {expandedBatch === b.id ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
                  </div>
                </button>
                {expandedBatch === b.id && (
                  <div className="border-t border-wind-700/20 px-5 py-4 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div><span className="text-gray-500">Toplam Satır</span><p className="text-gray-200 font-medium">{b.total_rows}</p></div>
                      <div><span className="text-gray-500">İçe Aktarılan</span><p className="text-wind-400 font-medium">{b.imported_rows}</p></div>
                      <div><span className="text-gray-500">Yeni Personel</span><p className="text-blue-400 font-medium">{b.new_personnel}</p></div>
                      <div><span className="text-gray-500">Atlanan</span><p className="text-yellow-400 font-medium">{b.skipped_rows}</p></div>
                    </div>
                    {b.errors?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-red-400 mb-1">Hatalar:</p>
                        <div className="space-y-1">
                          {b.errors.map((err, i) => <p key={i} className="text-xs text-red-300 font-mono">{err}</p>)}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={mappingModalOpen} onClose={() => setMappingModalOpen(false)} title="Odoo Projeleri Eşle" size="lg">
        <div className="space-y-4">
          <p className="text-sm text-gray-400">Odoo proje kodlarını WindLift projeleriyle eşleştirin. Bu eşleme kaydedilir; bir sonraki import'ta otomatik uygulanır.</p>
          <div className="space-y-3">
            {parseResult?.uniqueProjects.map((p) => (
              <div key={p.odooCode} className="flex items-center gap-3">
                <div className="flex-1"><p className="text-sm font-mono text-gray-300">{p.odooCode}</p><p className="text-xs text-gray-500 truncate">{p.odooName}</p></div>
                <span className="text-gray-500">→</span>
                <select value={projectMappings[p.odooCode] || ''} onChange={(e) => setProjectMappings({ ...projectMappings, [p.odooCode]: e.target.value })} className="input-field w-48">
                  <option value="">Eşleme yok</option>
                  {availableProjects.map((ap) => <option key={ap.id} value={ap.id}>{ap.name}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setMappingModalOpen(false)} className="btn-ghost">İptal</button>
            <button onClick={() => setMappingModalOpen(false)} className="btn-primary"><CheckCircle2 className="h-4 w-4" />Tamam</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!deleteModal} onClose={() => setDeleteModal(null)} title="Import'u Sil">
        <div className="space-y-4">
          <div className="card bg-red-500/5 border-red-500/20">
            <p className="text-sm text-gray-200"><strong>{deleteModal?.file_name}</strong> dosyasından aktarılan <strong>{deleteModal?.imported_rows} kayıt</strong> silinecek.</p>
            <p className="text-xs text-gray-400 mt-2">Bu işlem geri alınamaz. Personel kayıtları korunur, sadece bu import'a ait work_entries silinir.</p>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeleteModal(null)} className="btn-ghost" disabled={deleting}>İptal</button>
            <button onClick={() => deleteModal && handleDelete(deleteModal)} className="btn-primary bg-red-600 hover:bg-red-700 border-red-600" disabled={deleting}>
              {deleting ? <Spinner size="sm" /> : <Trash2 className="h-4 w-4" />}Sil
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function SummaryCard({ icon, label, value, color, small = false }: { icon: React.ReactNode; label: string; value: string | number; color: string; small?: boolean }) {
  return (
    <div className="card">
      <div className="flex items-center gap-1.5 text-gray-500 mb-1 text-xs">{icon}{label}</div>
      <p className={`font-bold ${color} ${small ? 'text-sm' : 'text-2xl'}`}>{value}</p>
    </div>
  )
}

function BatchStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    completed: { label: 'Tamamlandı', cls: 'badge-green' },
    processing: { label: 'İşleniyor', cls: 'badge-yellow' },
    failed: { label: 'Hatalı', cls: 'badge-red' },
  }
  const s = map[status] || { label: status, cls: 'badge-gray' }
  return <span className={`badge text-xs ${s.cls}`}>{s.label}</span>
}
