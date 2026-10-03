'use client'
import { useState, useTransition, useMemo } from 'react'
import { Modal } from '@/components/ui/modal'
import { createLink, updateLink, deleteLink } from '@/app/(vault)/links/actions'
import type { LinkRow } from '@/app/(vault)/links/page'

interface LinksClientProps {
  links: LinkRow[]
  allTags: string[]
}

function parseTags(raw: string): string[] {
  try { return JSON.parse(raw) as string[] }
  catch { return [] }
}

function getDomain(url: string): string {
  try { return new URL(url).hostname.replace('www.', '') }
  catch { return url }
}

function getFaviconUrl(url: string): string {
  try {
    const domain = new URL(url).origin
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
  } catch { return '' }
}

const TAG_COLORS = [
  'bg-blue-500/15 text-blue-300 border-blue-500/20',
  'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  'bg-purple-500/15 text-purple-300 border-purple-500/20',
  'bg-orange-500/15 text-orange-300 border-orange-500/20',
  'bg-yellow-500/15 text-yellow-300 border-yellow-500/20',
  'bg-pink-500/15 text-pink-300 border-pink-500/20',
  'bg-indigo-500/15 text-indigo-300 border-indigo-500/20',
  'bg-teal-500/15 text-teal-300 border-teal-500/20',
]

function tagColor(tag: string): string {
  let hash = 0
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash)
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length]!
}

export function LinksClient({ links, allTags }: LinksClientProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editLink, setEditLink] = useState<LinkRow | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [tagInput, setTagInput] = useState('')

  const filtered = useMemo(() => {
    return links.filter(l => {
      const tags = parseTags(l.tags)
      const matchTag = !activeTag || tags.includes(activeTag)
      const matchSearch = !search || [l.title, l.url, l.description ?? '', ...tags]
        .some(s => s.toLowerCase().includes(search.toLowerCase()))
      return matchTag && matchSearch
    })
  }, [links, activeTag, search])

  const openCreate = () => {
    setEditLink(null)
    setTagInput('')
    setModalOpen(true)
  }

  const openEdit = (link: LinkRow) => {
    setEditLink(link)
    setTagInput(parseTags(link.tags).join(', '))
    setModalOpen(true)
  }

  const handleSubmit = (formData: FormData) => {
    formData.set('tags', tagInput)
    startTransition(async () => {
      if (editLink) await updateLink(editLink.id, formData)
      else await createLink(formData)
      setModalOpen(false)
      setEditLink(null)
    })
  }

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await deleteLink(id)
      setDeleteId(null)
    })
  }

  const copyUrl = (url: string, id: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(id)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search links, URLs, tags…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
        />
        <button
          onClick={openCreate}
          className="shrink-0 flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition-colors"
        >
          + Save Link
        </button>
      </div>

      {/* Tag filter pills */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTag(null)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              !activeTag
                ? 'border-zinc-400 bg-zinc-700 text-zinc-100'
                : 'border-zinc-700 bg-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            All ({links.length})
          </button>
          {allTags.map(tag => {
            const count = links.filter(l => parseTags(l.tags).includes(tag)).length
            const isActive = activeTag === tag
            return (
              <button
                key={tag}
                onClick={() => setActiveTag(isActive ? null : tag)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                  isActive
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300 scale-105'
                    : `${tagColor(tag)} hover:scale-105`
                }`}
              >
                #{tag} <span className="opacity-60">{count}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Links grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-4xl mb-4">🔖</div>
          <p className="text-zinc-400">
            {search || activeTag ? 'No links match your filter.' : 'No saved links yet.'}
          </p>
          {!search && !activeTag && (
            <p className="text-zinc-500 text-sm mt-1">Save your first link to get started.</p>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(link => {
            const tags = parseTags(link.tags)
            const domain = getDomain(link.url)
            const favicon = getFaviconUrl(link.url)
            return (
              <div
                key={link.id}
                className="group rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3 hover:border-zinc-700 transition-colors"
              >
                {/* Header */}
                <div className="flex items-start gap-3">
                  {favicon && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={favicon}
                      alt=""
                      width={20}
                      height={20}
                      className="rounded mt-0.5 shrink-0"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-100 leading-snug line-clamp-2">{link.title}</p>
                    <p className="text-xs text-zinc-500 mt-0.5 truncate">{domain}</p>
                  </div>
                </div>

                {/* Description */}
                {link.description && (
                  <p className="text-xs text-zinc-400 line-clamp-2">{link.description}</p>
                )}

                {/* Tags */}
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map(tag => (
                      <button
                        key={tag}
                        onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                        className={`rounded-full border px-2 py-0.5 text-xs transition-all hover:scale-105 ${tagColor(tag)}`}
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1 pt-1 border-t border-zinc-800">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                  >
                    ↗ Open
                  </a>
                  <button
                    onClick={() => copyUrl(link.url, link.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                  >
                    {copied === link.id ? '✓ Copied' : '⎘ Copy'}
                  </button>
                  <button
                    onClick={() => openEdit(link)}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                    aria-label="Edit"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => setDeleteId(link.id)}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                    aria-label="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditLink(null) }}
        title={editLink ? 'Edit Link' : 'Save Link'}
      >
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm text-zinc-300">URL <span className="text-red-400">*</span></label>
            <input
              name="url"
              type="url"
              required
              defaultValue={editLink?.url ?? ''}
              placeholder="https://example.com"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm text-zinc-300">Title <span className="text-red-400">*</span></label>
            <input
              name="title"
              type="text"
              required
              defaultValue={editLink?.title ?? ''}
              placeholder="Descriptive title"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm text-zinc-300">Description</label>
            <textarea
              name="description"
              rows={2}
              defaultValue={editLink?.description ?? ''}
              placeholder="What is this link about?"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm text-zinc-300">Tags</label>
            <input
              type="text"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              placeholder="finance, tools, reference  (comma separated)"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
            />
            {/* Quick tag suggestions from existing tags */}
            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {allTags.map(tag => {
                  const already = tagInput.split(',').map(t => t.trim()).includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        if (already) {
                          setTagInput(tagInput.split(',').map(t => t.trim()).filter(t => t !== tag).join(', '))
                        } else {
                          const current = tagInput.split(',').map(t => t.trim()).filter(Boolean)
                          setTagInput([...current, tag].join(', '))
                        }
                      }}
                      className={`rounded-full border px-2 py-0.5 text-xs transition-all ${
                        already
                          ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                          : `${tagColor(tag)} opacity-60 hover:opacity-100`
                      }`}
                    >
                      #{tag}
                    </button>
                  )
                })}
              </div>
            )}
            <p className="text-xs text-zinc-500">Separate with commas. Click existing tags to add them quickly.</p>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => { setModalOpen(false); setEditLink(null) }}
              className="flex-1 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white transition-colors"
            >
              {isPending ? 'Saving…' : editLink ? 'Update' : 'Save Link'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <Modal open={deleteId !== null} onClose={() => setDeleteId(null)} title="Delete Link">
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">Are you sure you want to delete this link?</p>
          <div className="flex gap-3">
            <button
              onClick={() => setDeleteId(null)}
              className="flex-1 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => deleteId && handleDelete(deleteId)}
              disabled={isPending}
              className="flex-1 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white transition-colors"
            >
              {isPending ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
