'use client'
import { useState, useTransition, useRef, useCallback } from 'react'
import {
  Plus, Search, Pencil, Trash2, ArrowLeft, Clock, HardDrive,
  Upload, ExternalLink, Download, FileText, FileImage, FileCode,
  File, Film, Music, Archive, AlertCircle, CheckCircle2, X,
  RefreshCw,
} from 'lucide-react'
import { ColorBadge }      from '@/components/ui/color-badge'
import { MarkdownEditor }   from '@/components/markdown/MarkdownEditor'
import { MarkdownRenderer } from '@/components/markdown/MarkdownRenderer'
import { createDocument, updateDocument, deleteDocument } from '@/app/(vault)/documents/actions'

// ── Types ─────────────────────────────────────────────────────────────────────
export interface DocumentRow {
  id: string; title: string; content: string
  category: string; created_at: number; updated_at: number
}

export interface DocFileRow {
  id: string; user_id: string; name: string; mime_type: string
  size: number; category: string; storage_backend: string
  drive_file_id: string | null; drive_view_link: string | null; created_at: number
}

interface Props {
  documents:    DocumentRow[]
  driveFiles:   DocFileRow[]
  driveConnected: boolean
  driveEmail:   string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { value: 'general',  label: 'General',  color: 'zinc'    as const },
  { value: 'finance',  label: 'Finance',  color: 'emerald' as const },
  { value: 'legal',    label: 'Legal',    color: 'blue'    as const },
  { value: 'medical',  label: 'Medical',  color: 'red'     as const },
  { value: 'work',     label: 'Work',     color: 'indigo'  as const },
  { value: 'personal', label: 'Personal', color: 'purple'  as const },
]
const catColor = (v: string) => CATEGORIES.find(c => c.value === v)?.color ?? 'zinc'
const catLabel = (v: string) => CATEGORIES.find(c => c.value === v)?.label ?? v

function fmtDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtSize(bytes: number) {
  if (bytes < 1024)              return `${bytes} B`
  if (bytes < 1024 * 1024)      return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// ── File type icon ────────────────────────────────────────────────────────────
function FileTypeIcon({ mime, className = 'h-5 w-5' }: { mime: string; className?: string }) {
  if (mime.startsWith('image/'))       return <FileImage  className={`${className} text-pink-400`} />
  if (mime.startsWith('video/'))       return <Film       className={`${className} text-purple-400`} />
  if (mime.startsWith('audio/'))       return <Music      className={`${className} text-yellow-400`} />
  if (mime.includes('pdf'))            return <FileText   className={`${className} text-red-400`} />
  if (mime.includes('zip') || mime.includes('tar') || mime.includes('gz'))
                                       return <Archive    className={`${className} text-orange-400`} />
  if (mime.includes('code') || mime.includes('json') || mime.includes('xml') || mime.includes('javascript'))
                                       return <FileCode   className={`${className} text-emerald-400`} />
  if (mime.includes('spreadsheet') || mime.includes('excel'))
                                       return <FileText   className={`${className} text-green-400`} />
  if (mime.includes('presentation') || mime.includes('powerpoint'))
                                       return <FileText   className={`${className} text-orange-400`} />
  if (mime.includes('text') || mime.includes('document') || mime.includes('word'))
                                       return <FileText   className={`${className} text-blue-400`} />
  return <File className={`${className} text-zinc-400`} />
}

// ══════════════════════════════════════════════════════════════════════════════
// DRIVE FILES SECTION
// ══════════════════════════════════════════════════════════════════════════════

function UploadZone({
  onFiles, uploading, category, onCategoryChange,
}: {
  onFiles: (files: FileList) => void
  uploading: boolean
  category: string
  onCategoryChange: (c: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    if (e.dataTransfer.files.length > 0) onFiles(e.dataTransfer.files)
  }, [onFiles])

  return (
    <div className="space-y-3">
      {/* Category picker */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-zinc-500">Category:</span>
        {CATEGORIES.map(c => (
          <button
            key={c.value}
            type="button"
            onClick={() => onCategoryChange(c.value)}
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
              category === c.value
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload files"
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-8 cursor-pointer transition-all ${
          dragOver
            ? 'border-emerald-500 bg-emerald-500/5'
            : 'border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/30'
        }`}
      >
        <input ref={inputRef} type="file" multiple className="hidden" onChange={e => e.target.files && onFiles(e.target.files)} />
        {uploading ? (
          <RefreshCw className="h-8 w-8 text-emerald-400 animate-spin" />
        ) : (
          <Upload className="h-8 w-8 text-zinc-600" />
        )}
        <div className="text-center">
          <p className="text-sm font-medium text-zinc-300">{uploading ? 'Uploading to Google Drive…' : 'Drop files here or click to browse'}</p>
          <p className="text-xs text-zinc-600 mt-0.5">Any file type · max 100 MB per file</p>
        </div>
      </div>
    </div>
  )
}

function DriveFilesPanel({ files: initial, driveEmail }: { files: DocFileRow[]; driveEmail: string | null }) {
  const [files,      setFiles]      = useState<DocFileRow[]>(initial)
  const [uploading,  setUploading]  = useState(false)
  const [deleting,   setDeleting]   = useState<string | null>(null)
  const [error,      setError]      = useState('')
  const [success,    setSuccess]    = useState('')
  const [category,   setCategory]   = useState('general')
  const [filterCat,  setFilterCat]  = useState('all')
  const [search,     setSearch]     = useState('')

  const showMsg = (ok: boolean, msg: string) => {
    if (ok) { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
    else    { setError(msg);   setTimeout(() => setError(''), 4000)   }
  }

  const uploadFiles = async (fileList: FileList) => {
    setUploading(true); setError('')
    let uploaded = 0
    for (const file of Array.from(fileList)) {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('category', category)
      try {
        const res = await fetch('/api/v1/documents/files', { method: 'POST', body: fd })
        const data = await res.json() as { file?: DocFileRow; error?: string }
        if (!res.ok || !data.file) throw new Error(data.error ?? `Upload failed: ${res.status}`)
        setFiles(prev => [data.file!, ...prev])
        uploaded++
      } catch (e) {
        showMsg(false, e instanceof Error ? e.message : 'Upload failed')
      }
    }
    setUploading(false)
    if (uploaded > 0) showMsg(true, `${uploaded} file${uploaded > 1 ? 's' : ''} uploaded to Drive`)
  }

  const handleDelete = async (file: DocFileRow) => {
    setDeleting(file.id)
    const res = await fetch(`/api/v1/documents/files/${file.id}`, { method: 'DELETE' })
    setDeleting(null)
    if (res.ok) {
      setFiles(prev => prev.filter(f => f.id !== file.id))
      showMsg(true, `"${file.name}" deleted`)
    } else {
      showMsg(false, 'Delete failed')
    }
  }

  const filtered = files.filter(f => {
    const matchCat = filterCat === 'all' || f.category === filterCat
    const matchSearch = !search || f.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  return (
    <div className="space-y-4">
      {/* Drive status bar */}
      <div className="flex items-center gap-2 rounded-lg border border-emerald-700/30 bg-emerald-500/5 px-4 py-2.5">
        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
        <span className="text-sm text-zinc-300">
          Connected to Google Drive
          {driveEmail && <span className="ml-1 text-zinc-500">· {driveEmail}</span>}
        </span>
        <a
          href="https://drive.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Open Drive
        </a>
      </div>

      {/* Upload zone */}
      <UploadZone onFiles={uploadFiles} uploading={uploading} category={category} onCategoryChange={setCategory} />

      {/* Toast */}
      {error   && <div className="flex items-center gap-2 rounded-lg border border-red-700/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
      {success && <div className="flex items-center gap-2 rounded-lg border border-emerald-700/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300"><CheckCircle2 className="h-4 w-4 shrink-0" />{success}</div>}

      {/* Filters */}
      {files.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
            <input
              type="search"
              placeholder="Search files…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-800 pl-8 pr-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none w-44"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {[{ value: 'all', label: 'All' }, ...CATEGORIES].map(c => (
              <button
                key={c.value}
                onClick={() => setFilterCat(c.value)}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                  filterCat === c.value ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* File list */}
      {filtered.length === 0 && files.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-zinc-800 rounded-xl">
          <HardDrive className="h-10 w-10 text-zinc-700 mb-3" />
          <p className="text-sm text-zinc-500">No files uploaded yet</p>
          <p className="text-xs text-zinc-600 mt-0.5">Drop files above to get started</p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-800/60">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-400 uppercase tracking-wide">File</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-400 uppercase tracking-wide hidden sm:table-cell">Category</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-400 uppercase tracking-wide hidden md:table-cell">Size</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-400 uppercase tracking-wide hidden lg:table-cell">Uploaded</th>
                <th className="px-4 py-2.5 text-xs font-medium text-zinc-400 uppercase tracking-wide text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filtered.map(f => (
                <tr key={f.id} className="hover:bg-zinc-800/30 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileTypeIcon mime={f.mime_type} className="h-5 w-5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-zinc-100 font-medium truncate max-w-xs">{f.name}</p>
                        <p className="text-xs text-zinc-600 sm:hidden">{fmtSize(f.size)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <ColorBadge label={catLabel(f.category)} color={catColor(f.category)} />
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs hidden md:table-cell">{fmtSize(f.size)}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs hidden lg:table-cell">{fmtDate(f.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {/* View on Drive */}
                      {f.drive_view_link && (
                        <a
                          href={f.drive_view_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="View on Drive"
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-blue-400 hover:bg-zinc-800 transition-colors"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {/* Download */}
                      <a
                        href={`/api/v1/documents/files/${f.id}`}
                        download={f.name}
                        title="Download"
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-emerald-400 hover:bg-zinc-800 transition-colors"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(f)}
                        disabled={deleting === f.id}
                        title="Delete"
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors disabled:opacity-50"
                      >
                        {deleting === f.id
                          ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          : <Trash2 className="h-3.5 w-3.5" />
                        }
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function DriveNotConnected() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed border-zinc-800 space-y-4">
      <div className="rounded-full bg-zinc-800 p-4">
        <HardDrive className="h-8 w-8 text-zinc-600" />
      </div>
      <div>
        <p className="text-base font-medium text-zinc-300">Google Drive not connected</p>
        <p className="text-sm text-zinc-500 mt-1">Connect Drive in Settings to upload and manage files here.</p>
      </div>
      <a
        href="/settings"
        className="flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition-colors"
      >
        Go to Settings
      </a>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// NOTES (text documents) SECTION
// ══════════════════════════════════════════════════════════════════════════════

type NoteView =
  | { type: 'list' }
  | { type: 'view'; doc: DocumentRow }
  | { type: 'edit'; doc: DocumentRow | null }

function NotesSection({ docs }: { docs: DocumentRow[] }) {
  const [view,     setView]     = useState<NoteView>({ type: 'list' })
  const [search,   setSearch]   = useState('')
  const [filterCat,setFilterCat] = useState('all')
  const [deleteId, setDeleteId]  = useState<string | null>(null)
  const [title,    setTitle]     = useState('')
  const [content,  setContent]   = useState('')
  const [category, setCategory]  = useState('general')
  const [pending, startTransition] = useTransition()

  const openEdit = (doc: DocumentRow | null) => {
    setTitle(doc?.title ?? '')
    setContent(doc?.content ?? '')
    setCategory(doc?.category ?? 'general')
    setView({ type: 'edit', doc })
  }

  const handleSave = () => {
    if (!title.trim()) return
    const doc = view.type === 'edit' ? view.doc : null
    const fd = new FormData()
    fd.set('title', title); fd.set('content', content); fd.set('category', category)
    startTransition(async () => {
      if (doc) await updateDocument(doc.id, fd)
      else      await createDocument(fd)
      setView({ type: 'list' })
    })
  }

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await deleteDocument(id)
      setDeleteId(null)
      if (view.type === 'view') setView({ type: 'list' })
    })
  }

  // ── Editor ──
  if (view.type === 'edit') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setView({ type: 'list' })} className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="ml-auto flex gap-2">
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 focus:outline-none"
            >
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <button onClick={() => setView({ type: 'list' })} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800">Cancel</button>
            <button onClick={handleSave} disabled={pending || !title.trim()} className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-4 py-1.5 text-sm font-medium text-white">
              {pending ? 'Saving…' : view.doc ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Document title"
          className="w-full bg-transparent text-2xl font-bold text-zinc-100 placeholder:text-zinc-700 border-b border-zinc-800 pb-3 focus:outline-none"
        />
        <MarkdownEditor value={content} onChange={setContent} minHeight="500px" placeholder="Write document content in Markdown…" />
      </div>
    )
  }

  // ── Viewer ──
  if (view.type === 'view') {
    const doc = view.doc
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setView({ type: 'list' })} className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="ml-auto flex gap-2">
            <button onClick={() => setDeleteId(doc.id)} className="flex items-center gap-1.5 rounded-lg border border-red-700/40 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
            <button onClick={() => openEdit(doc)} className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 mb-2">{doc.title}</h1>
          <div className="flex items-center gap-3 text-xs text-zinc-600 mb-5">
            <ColorBadge label={catLabel(doc.category)} color={catColor(doc.category)} />
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {fmtDate(doc.updated_at)}</span>
          </div>
          <MarkdownRenderer content={doc.content} />
        </div>
      </div>
    )
  }

  // ── List ──
  const filtered = docs.filter(d => {
    const mc = filterCat === 'all' || d.category === filterCat
    const ms = !search || d.title.toLowerCase().includes(search.toLowerCase()) || d.content.toLowerCase().includes(search.toLowerCase())
    return mc && ms
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
          <input
            type="search"
            placeholder="Search notes…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 pl-8 pr-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none w-44"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[{ value: 'all', label: 'All' }, ...CATEGORIES].map(c => (
            <button key={c.value} onClick={() => setFilterCat(c.value)}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${filterCat === c.value ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}>
              {c.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => openEdit(null)}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white"
        >
          <Plus className="h-4 w-4" /> New Note
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-zinc-800 rounded-xl">
          <FileText className="h-10 w-10 text-zinc-700 mb-3" />
          <p className="text-sm text-zinc-500">{search || filterCat !== 'all' ? 'No documents match.' : 'No notes yet.'}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-800/60">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-400 uppercase tracking-wide">Title</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-400 uppercase tracking-wide hidden sm:table-cell">Category</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-400 uppercase tracking-wide hidden md:table-cell">Updated</th>
                <th className="px-4 py-2.5 text-xs font-medium text-zinc-400 uppercase tracking-wide text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filtered.map(doc => (
                <tr key={doc.id} className="hover:bg-zinc-800/30 transition-colors group">
                  <td className="px-4 py-3">
                    <button onClick={() => setView({ type: 'view', doc })} className="text-left">
                      <p className="text-zinc-100 font-medium hover:text-emerald-400 transition-colors">{doc.title}</p>
                      <p className="text-xs text-zinc-600 mt-0.5 font-mono">{doc.content.slice(0,60).replace(/[#*`]/g, '')}{doc.content.length > 60 ? '…' : ''}</p>
                    </button>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <ColorBadge label={catLabel(doc.category)} color={catColor(doc.category)} />
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs hidden md:table-cell">{fmtDate(doc.updated_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(doc)} className="p-1.5 rounded text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800" aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => setDeleteId(doc.id)} className="p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-zinc-800" aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
            <h3 className="text-sm font-semibold text-zinc-100 mb-1">Delete document?</h3>
            <p className="text-xs text-zinc-500 mb-4">This cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)} className="flex-1 rounded-lg border border-zinc-700 py-2 text-sm text-zinc-400 hover:bg-zinc-800">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} disabled={pending} className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50">
                {pending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════
export function DocumentsClient({ documents, driveFiles, driveConnected, driveEmail }: Props) {
  const [tab, setTab] = useState<'drive' | 'notes'>('drive')

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Documents</h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              {driveFiles.length} drive file{driveFiles.length !== 1 ? 's' : ''} · {documents.length} note{documents.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl bg-zinc-800/50 p-1 w-fit">
          <button
            onClick={() => setTab('drive')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              tab === 'drive' ? 'bg-zinc-700 text-zinc-100 shadow' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <HardDrive className="h-4 w-4" />
            Drive Files
            {driveConnected && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
          </button>
          <button
            onClick={() => setTab('notes')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              tab === 'notes' ? 'bg-zinc-700 text-zinc-100 shadow' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <FileText className="h-4 w-4" />
            Text Notes
          </button>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {tab === 'drive' && (
          driveConnected
            ? <DriveFilesPanel files={driveFiles} driveEmail={driveEmail} />
            : <DriveNotConnected />
        )}
        {tab === 'notes' && <NotesSection docs={documents} />}
      </div>
    </div>
  )
}
