'use client'
import { useState, useTransition } from 'react'
import { Plus, Search, Pencil, Trash2, Tag, X, ArrowLeft, Clock } from 'lucide-react'
import { MarkdownEditor }   from '@/components/markdown/MarkdownEditor'
import { MarkdownRenderer } from '@/components/markdown/MarkdownRenderer'
import { createNote, updateNote, deleteNote } from '@/app/(vault)/notes/actions'

export interface NoteRow {
  id:         string
  title:      string
  content:    string
  tags:       string   // JSON array
  created_at: number
  updated_at: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseTags(raw: string): string[] {
  try {
    const p = JSON.parse(raw)
    return Array.isArray(p) ? (p as string[]) : []
  } catch { return [] }
}

const PALETTE = [
  'bg-blue-500/15 text-blue-400 border-blue-500/20',
  'bg-purple-500/15 text-purple-400 border-purple-500/20',
  'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  'bg-orange-500/15 text-orange-400 border-orange-500/20',
  'bg-pink-500/15 text-pink-400 border-pink-500/20',
  'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
]
const tagColor = (i: number) => PALETTE[i % PALETTE.length] ?? PALETTE[0]!

function fmtDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Inline tag input ──────────────────────────────────────────────────────────
function TagInput({ value, onChange }: { value: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState('')

  const addTag = () => {
    const t = input.trim().toLowerCase()
    if (t && !value.includes(t)) onChange([...value, t])
    setInput('')
  }

  return (
    <div className="flex flex-wrap gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 min-h-[40px] items-center">
      {value.map((tag, i) => (
        <span key={tag} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${tagColor(i)}`}>
          {tag}
          <button
            type="button"
            onClick={() => onChange(value.filter(t => t !== tag))}
            className="hover:opacity-70"
            aria-label={`Remove ${tag}`}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        placeholder={value.length === 0 ? 'Add tags… (Enter or comma)' : ''}
        className="flex-1 min-w-20 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() }
          if (e.key === 'Backspace' && !input && value.length > 0) onChange(value.slice(0, -1))
        }}
        onBlur={addTag}
      />
    </div>
  )
}

// ── Full-page note editor ─────────────────────────────────────────────────────
function NoteEditor({ note, onSave, onCancel }: {
  note: NoteRow | null
  onSave:   (title: string, content: string, tags: string[]) => void
  onCancel: () => void
}) {
  const [title,   setTitle]   = useState(note?.title   ?? '')
  const [content, setContent] = useState(note?.content ?? '')
  const [tags,    setTags]    = useState<string[]>(parseTags(note?.tags ?? '[]'))
  const [pending, startTransition] = useTransition()

  const handleSave = () => {
    if (!title.trim()) return
    startTransition(() => onSave(title, content, tags))
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b border-zinc-800 px-6 py-3">
        <button onClick={onCancel} className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Notes
        </button>
        <span className="text-zinc-700">/</span>
        <span className="text-sm text-zinc-400">{note ? 'Editing' : 'New note'}</span>
        <div className="ml-auto flex gap-2">
          <button onClick={onCancel} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={pending || !title.trim()}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-4 py-1.5 text-sm font-medium text-white transition-colors"
          >
            {pending ? 'Saving…' : note ? 'Update note' : 'Create note'}
          </button>
        </div>
      </div>

      {/* Editor body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 max-w-5xl w-full mx-auto">
        {/* Title */}
        <input
          type="text"
          placeholder="Note title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full bg-transparent text-3xl font-bold text-zinc-100 placeholder:text-zinc-700 focus:outline-none border-b border-zinc-800 pb-3"
        />

        {/* Tags */}
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-zinc-600 shrink-0" />
          <TagInput value={tags} onChange={setTags} />
        </div>

        {/* Markdown editor */}
        <MarkdownEditor
          value={content}
          onChange={setContent}
          placeholder={'Write your note in **Markdown**…\n\n# Heading\n\nStart typing...'}
          minHeight="480px"
        />
      </div>
    </div>
  )
}

// ── Note card (preview in list) ───────────────────────────────────────────────
function NoteCard({ note, onEdit, onDelete, onOpen }: {
  note:     NoteRow
  onEdit:   () => void
  onDelete: () => void
  onOpen:   () => void
}) {
  const tags = parseTags(note.tags)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={e => e.key === 'Enter' && onOpen()}
      className="group break-inside-avoid rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-3 hover:border-zinc-600 cursor-pointer transition-all hover:shadow-lg hover:shadow-black/20 mb-4"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-zinc-100 leading-snug">{note.title}</h3>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={e => { e.stopPropagation(); onEdit() }}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            aria-label="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete() }}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
            aria-label="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag, i) => (
            <span key={tag} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${tagColor(i)}`}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Markdown preview — first 3 lines plain-text */}
      <p className="text-sm text-zinc-500 leading-relaxed line-clamp-3 font-mono">
        {note.content.slice(0, 220).replace(/[#*`_~>]/g, '')}{note.content.length > 220 ? '…' : ''}
      </p>

      <p className="flex items-center gap-1 text-[11px] text-zinc-700">
        <Clock className="h-3 w-3" /> {fmtDate(note.updated_at)}
      </p>
    </div>
  )
}

// ── Note view (read mode) ─────────────────────────────────────────────────────
function NoteView({ note, onEdit, onBack }: { note: NoteRow; onEdit: () => void; onBack: () => void }) {
  const tags = parseTags(note.tags)
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 border-b border-zinc-800 px-6 py-3">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Notes
        </button>
        <span className="text-zinc-700">/</span>
        <span className="text-sm text-zinc-300 truncate">{note.title}</span>
        <button onClick={onEdit} className="ml-auto flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 transition-colors">
          <Pencil className="h-3.5 w-3.5" /> Edit
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-5 max-w-4xl w-full mx-auto">
        <h1 className="text-3xl font-bold text-zinc-100 mb-3">{note.title}</h1>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {tags.map((tag, i) => (
              <span key={tag} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${tagColor(i)}`}>{tag}</span>
            ))}
          </div>
        )}
        <p className="text-xs text-zinc-600 mb-6 flex items-center gap-1">
          <Clock className="h-3 w-3" /> Updated {fmtDate(note.updated_at)}
        </p>
        <MarkdownRenderer content={note.content} />
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
type View =
  | { type: 'list' }
  | { type: 'view'; note: NoteRow }
  | { type: 'edit'; note: NoteRow | null }

export function NotesClient({ notes }: { notes: NoteRow[] }) {
  const [view,   setView]   = useState<View>({ type: 'list' })
  const [search, setSearch] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [, startTransition]    = useTransition()

  const filtered = notes.filter(n => {
    if (!search) return true
    const q = search.toLowerCase()
    return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q) || parseTags(n.tags).some(t => t.includes(q))
  })

  const handleSave = (title: string, content: string, tags: string[]) => {
    const note = view.type === 'edit' ? view.note : null
    const fd = new FormData()
    fd.set('title', title)
    fd.set('content', content)
    fd.set('tags', JSON.stringify(tags))
    startTransition(async () => {
      if (note) await updateNote(note.id, fd)
      else       await createNote(fd)
      setView({ type: 'list' })
    })
  }

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await deleteNote(id)
      setDeleteId(null)
    })
  }

  // ── Editor / Viewer panes ──
  if (view.type === 'edit') {
    return (
      <NoteEditor
        note={view.note}
        onSave={handleSave}
        onCancel={() => setView({ type: 'list' })}
      />
    )
  }

  if (view.type === 'view') {
    return (
      <NoteView
        note={view.note}
        onEdit={() => setView({ type: 'edit', note: view.note })}
        onBack={() => setView({ type: 'list' })}
      />
    )
  }

  // ── List view ──
  return (
    <div className="space-y-5 px-6 py-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Notes</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{notes.length} {notes.length === 1 ? 'note' : 'notes'}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
            <input
              type="search"
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-800 pl-8 pr-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none w-44"
            />
          </div>
          <button
            onClick={() => setView({ type: 'edit', note: null })}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white transition-colors"
          >
            <Plus className="h-4 w-4" /> New Note
          </button>
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-4xl mb-3">📝</p>
          <p className="text-zinc-400">{search ? 'No notes match your search.' : 'No notes yet.'}</p>
          <p className="text-zinc-500 text-sm mt-1">Capture ideas in full Markdown.</p>
        </div>
      ) : (
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
          {filtered.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              onOpen={() => setView({ type: 'view', note })}
              onEdit={() => setView({ type: 'edit', note })}
              onDelete={() => setDeleteId(note.id)}
            />
          ))}
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl">
            <h3 className="text-sm font-semibold text-zinc-100 mb-1">Delete note?</h3>
            <p className="text-xs text-zinc-500 mb-4">This cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)} className="flex-1 rounded-lg border border-zinc-700 py-2 text-sm text-zinc-400 hover:bg-zinc-800">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-500">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
