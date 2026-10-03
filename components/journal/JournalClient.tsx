'use client'
import { useState, useTransition } from 'react'
import { Plus, ArrowLeft, Pencil, Trash2, Clock, CalendarDays } from 'lucide-react'
import { MarkdownEditor }   from '@/components/markdown/MarkdownEditor'
import { MarkdownRenderer } from '@/components/markdown/MarkdownRenderer'
import { createEntry, updateEntry, deleteEntry } from '@/app/(vault)/journal/actions'

export interface JournalEntry {
  id:         string
  title:      string
  content:    string
  mood:       string | null
  entry_date: string
  created_at: number
}

// ── Mood config ───────────────────────────────────────────────────────────────
const MOODS = [
  { value: 'happy',       emoji: '😊', label: 'Happy',       color: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300' },
  { value: 'neutral',     emoji: '😐', label: 'Neutral',     color: 'border-zinc-500/40  bg-zinc-500/10  text-zinc-400'    },
  { value: 'sad',         emoji: '😢', label: 'Sad',         color: 'border-blue-500/40  bg-blue-500/10  text-blue-400'    },
  { value: 'frustrated',  emoji: '😤', label: 'Frustrated',  color: 'border-red-500/40   bg-red-500/10   text-red-400'     },
  { value: 'thoughtful',  emoji: '🤔', label: 'Thoughtful',  color: 'border-purple-500/40 bg-purple-500/10 text-purple-400' },
  { value: 'energetic',   emoji: '⚡', label: 'Energetic',   color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' },
  { value: 'grateful',    emoji: '🙏', label: 'Grateful',    color: 'border-pink-500/40  bg-pink-500/10  text-pink-400'    },
  { value: 'anxious',     emoji: '😰', label: 'Anxious',     color: 'border-orange-500/40 bg-orange-500/10 text-orange-400' },
]

const getMood = (v: string | null) => MOODS.find(m => m.value === v)
function today() { return new Date().toISOString().slice(0, 10) }
function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
}
function fmtTs(ts: number) {
  return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Mood picker ───────────────────────────────────────────────────────────────
function MoodPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {MOODS.map(m => (
        <button
          key={m.value}
          type="button"
          onClick={() => onChange(value === m.value ? '' : m.value)}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
            value === m.value
              ? m.color
              : 'border-zinc-700 bg-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
          }`}
        >
          <span>{m.emoji}</span>{m.label}
        </button>
      ))}
    </div>
  )
}

// ── Full-page journal entry editor ────────────────────────────────────────────
function EntryEditor({ entry, onSave, onCancel }: {
  entry:    JournalEntry | null
  onSave:   (title: string, content: string, mood: string, date: string) => void
  onCancel: () => void
}) {
  const [title,   setTitle]   = useState(entry?.title      ?? '')
  const [content, setContent] = useState(entry?.content    ?? '')
  const [mood,    setMood]    = useState(entry?.mood        ?? '')
  const [date,    setDate]    = useState(entry?.entry_date  ?? today())
  const [pending, startTransition] = useTransition()

  const moodObj = getMood(mood)

  const handleSave = () => {
    if (!title.trim()) return
    startTransition(() => onSave(title, content, mood, date))
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b border-zinc-800 px-6 py-3">
        <button onClick={onCancel} className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Journal
        </button>
        <span className="text-zinc-700">/</span>
        <span className="text-sm text-zinc-400">{entry ? 'Editing entry' : 'New entry'}</span>
        <div className="ml-auto flex gap-2">
          <button onClick={onCancel} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={pending || !title.trim()}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-4 py-1.5 text-sm font-medium text-white"
          >
            {pending ? 'Saving…' : entry ? 'Update entry' : 'Create entry'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 max-w-4xl w-full mx-auto">
        {/* Title */}
        <input
          type="text"
          placeholder="What's on your mind?"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full bg-transparent text-3xl font-bold text-zinc-100 placeholder:text-zinc-700 focus:outline-none border-b border-zinc-800 pb-3"
        />

        {/* Date + mood row */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-zinc-600 shrink-0" />
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
            />
          </div>
          {moodObj && (
            <span className={`rounded-full border px-3 py-1 text-xs font-medium ${moodObj.color}`}>
              {moodObj.emoji} {moodObj.label}
            </span>
          )}
        </div>

        {/* Mood picker */}
        <div className="space-y-1.5">
          <p className="text-xs text-zinc-600 uppercase tracking-wide">How are you feeling?</p>
          <MoodPicker value={mood} onChange={setMood} />
        </div>

        {/* Markdown editor */}
        <MarkdownEditor
          value={content}
          onChange={setContent}
          placeholder={'Write your journal entry in **Markdown**…\n\n## Today I learned\n\nStart writing...'}
          minHeight="420px"
        />
      </div>
    </div>
  )
}

// ── Entry view (read mode) ────────────────────────────────────────────────────
function EntryView({ entry, onEdit, onBack }: { entry: JournalEntry; onEdit: () => void; onBack: () => void }) {
  const mood = getMood(entry.mood)
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 border-b border-zinc-800 px-6 py-3">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Journal
        </button>
        <span className="text-zinc-700">/</span>
        <span className="text-sm text-zinc-300 truncate">{entry.title}</span>
        <button onClick={onEdit} className="ml-auto flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 transition-colors">
          <Pencil className="h-3.5 w-3.5" /> Edit
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-5 max-w-4xl w-full mx-auto">
        {/* Header */}
        <div className="mb-6 space-y-2 border-b border-zinc-800 pb-5">
          <h1 className="text-3xl font-bold text-zinc-100">{entry.title}</h1>
          <div className="flex items-center gap-3 flex-wrap text-sm text-zinc-500">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" /> {fmtDate(entry.entry_date)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> Saved {fmtTs(entry.created_at)}
            </span>
            {mood && (
              <span className={`flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-xs font-medium ${mood.color}`}>
                {mood.emoji} {mood.label}
              </span>
            )}
          </div>
        </div>
        <MarkdownRenderer content={entry.content} />
      </div>
    </div>
  )
}

// ── Entry card ────────────────────────────────────────────────────────────────
function EntryCard({ entry, onOpen, onEdit, onDelete }: {
  entry:    JournalEntry
  onOpen:   () => void
  onEdit:   () => void
  onDelete: () => void
}) {
  const mood = getMood(entry.mood)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={e => e.key === 'Enter' && onOpen()}
      className="group rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-3 hover:border-zinc-600 cursor-pointer transition-all hover:shadow-lg hover:shadow-black/20"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {mood && <span className="text-lg shrink-0">{mood.emoji}</span>}
            <h3 className="font-semibold text-zinc-100 truncate">{entry.title}</h3>
          </div>
          <p className="text-xs text-zinc-600 mt-1 flex items-center gap-1">
            <CalendarDays className="h-3 w-3" /> {fmtDate(entry.entry_date)}
          </p>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={e => { e.stopPropagation(); onEdit() }} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800" aria-label="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete() }} className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800" aria-label="Delete">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {mood && (
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${mood.color}`}>
          {mood.emoji} {mood.label}
        </span>
      )}

      <p className="text-sm text-zinc-500 leading-relaxed line-clamp-3 font-mono">
        {entry.content.slice(0, 200).replace(/[#*`_~>]/g, '')}{entry.content.length > 200 ? '…' : ''}
      </p>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
type View =
  | { type: 'list' }
  | { type: 'view'; entry: JournalEntry }
  | { type: 'edit'; entry: JournalEntry | null }

export function JournalClient({ entries }: { entries: JournalEntry[] }) {
  const [view,     setView]     = useState<View>({ type: 'list' })
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const handleSave = (title: string, content: string, mood: string, date: string) => {
    const entry = view.type === 'edit' ? view.entry : null
    const fd = new FormData()
    fd.set('title',      title)
    fd.set('content',    content)
    fd.set('mood',       mood)
    fd.set('entry_date', date)
    startTransition(async () => {
      if (entry) await updateEntry(entry.id, fd)
      else        await createEntry(fd)
      setView({ type: 'list' })
    })
  }

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await deleteEntry(id)
      setDeleteId(null)
    })
  }

  if (view.type === 'edit') {
    return <EntryEditor entry={view.entry} onSave={handleSave} onCancel={() => setView({ type: 'list' })} />
  }
  if (view.type === 'view') {
    return (
      <EntryView
        entry={view.entry}
        onEdit={() => setView({ type: 'edit', entry: view.entry })}
        onBack={() => setView({ type: 'list' })}
      />
    )
  }

  // ── List view ──
  return (
    <div className="space-y-5 px-6 py-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Journal</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</p>
        </div>
        <button
          onClick={() => setView({ type: 'edit', entry: null })}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white transition-colors"
        >
          <Plus className="h-4 w-4" /> New Entry
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-4xl mb-3">📓</p>
          <p className="text-zinc-400">No journal entries yet.</p>
          <p className="text-zinc-500 text-sm mt-1">Start writing to track your thoughts and moods.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map(entry => (
            <EntryCard
              key={entry.id}
              entry={entry}
              onOpen={() => setView({ type: 'view', entry })}
              onEdit={() => setView({ type: 'edit', entry })}
              onDelete={() => setDeleteId(entry.id)}
            />
          ))}
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl">
            <h3 className="text-sm font-semibold text-zinc-100 mb-1">Delete entry?</h3>
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
