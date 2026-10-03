'use client'
import { useState, useTransition, useRef } from 'react'
import {
  Link2, ExternalLink, Trash2, Plus, FolderOpen, Folder,
  FileText, Upload, Download, Eye, ChevronRight,
} from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { ColorBadge } from '@/components/ui/color-badge'
import {
  createProject, updateProject, deleteProject,
  addTask, toggleTask, deleteTask,
  addProjectLink, deleteProjectLink,
} from '@/app/(vault)/projects/actions'
import { useRouter } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────
export interface ProjectTask   { id: string; project_id: string; title: string; done: number }
export interface ProjectLink   { id: string; project_id: string; user_id: string; title: string; url: string; created_at: number }
export interface ProjectFolder { id: string; project_id: string; user_id: string; name: string; parent_id: string | null; created_at: number }
export interface ProjectFile   {
  id: string; project_id: string; folder_id: string | null; user_id: string
  original_name: string; mime_type: string; size: number; storage_path: string; created_at: number
}

export interface ProjectRow {
  id: string; name: string; description: string | null
  status: 'active' | 'completed' | 'on_hold' | 'cancelled'
  due_date: string | null; created_at: number
  tasks: ProjectTask[]; links: ProjectLink[]
  folders: ProjectFolder[]; files: ProjectFile[]
}

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUS_MAP: Record<ProjectRow['status'], { label: string; color: 'emerald' | 'blue' | 'yellow' | 'zinc' }> = {
  active:    { label: 'Active',    color: 'emerald' },
  completed: { label: 'Completed', color: 'blue'    },
  on_hold:   { label: 'On Hold',   color: 'yellow'  },
  cancelled: { label: 'Cancelled', color: 'zinc'    },
}

const TAB_LABELS = ['Tasks', 'Links', 'Files'] as const
type Tab = typeof TAB_LABELS[number]

function fileIcon(mimeType: string, name: string): string {
  if (mimeType.startsWith('image/')) return '🖼️'
  if (mimeType.startsWith('video/')) return '🎬'
  if (mimeType.startsWith('audio/')) return '🎵'
  if (mimeType === 'application/pdf' || name.endsWith('.pdf')) return '📄'
  if (name.match(/\.(docx?)$/i)) return '📝'
  if (name.match(/\.(xlsx?)$/i)) return '📊'
  if (name.match(/\.(pptx?)$/i)) return '📑'
  if (name.match(/\.(zip|rar|tar|gz)$/i)) return '🗜️'
  if (name.match(/\.(js|ts|tsx|jsx|py|go|rs)$/i)) return '💻'
  if (name.match(/\.(md|txt)$/i)) return '📋'
  return '📁'
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Component ─────────────────────────────────────────────────────────────────
export function ProjectsClient({ projects }: { projects: ProjectRow[] }) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editProject, setEditProject] = useState<ProjectRow | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Record<string, Tab>>({})
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  // Tasks
  const [newTaskInputs, setNewTaskInputs] = useState<Record<string, string>>({})
  // Links
  const [newLinkInputs, setNewLinkInputs] = useState<Record<string, { title: string; url: string }>>({})
  // Files
  const [activeFolderIds, setActiveFolderIds] = useState<Record<string, string | null>>({}) // projectId -> folderId | null (root)
  const [newFolderName, setNewFolderName] = useState<Record<string, string>>({})
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({})
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const getTab = (pid: string): Tab => activeTab[pid] ?? 'Tasks'
  const setTab = (pid: string, tab: Tab) => setActiveTab(prev => ({ ...prev, [pid]: tab }))

  const openCreate = () => { setEditProject(null); setModalOpen(true) }
  const openEdit = (p: ProjectRow) => { setEditProject(p); setModalOpen(true) }
  const closeModal = () => { setModalOpen(false); setEditProject(null) }

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      if (editProject) await updateProject(editProject.id, formData)
      else await createProject(formData)
      closeModal()
    })
  }

  const handleDeleteProject = (id: string) => {
    startTransition(async () => { await deleteProject(id); setDeleteId(null) })
  }

  // Tasks
  const handleAddTask = (projectId: string) => {
    const title = newTaskInputs[projectId]?.trim()
    if (!title) return
    startTransition(async () => {
      await addTask(projectId, title)
      setNewTaskInputs(p => ({ ...p, [projectId]: '' }))
    })
  }
  const handleToggleTask = (taskId: string) => startTransition(() => toggleTask(taskId))
  const handleDeleteTask = (taskId: string) => startTransition(() => deleteTask(taskId))

  // Links
  const setLinkInput = (pid: string, field: 'title' | 'url', val: string) =>
    setNewLinkInputs(p => ({ ...p, [pid]: { ...(p[pid] ?? { title: '', url: '' }), [field]: val } }))

  const handleAddLink = (projectId: string) => {
    const { title = '', url = '' } = newLinkInputs[projectId] ?? {}
    if (!title.trim() || !url.trim()) return
    startTransition(async () => {
      await addProjectLink(projectId, title.trim(), url.trim())
      setNewLinkInputs(p => ({ ...p, [projectId]: { title: '', url: '' } }))
    })
  }
  const handleDeleteLink = (linkId: string) => startTransition(() => deleteProjectLink(linkId))

  // Folders
  const handleCreateFolder = async (projectId: string) => {
    const name = newFolderName[projectId]?.trim()
    if (!name) return
    const res = await fetch(`/api/v1/projects/${projectId}/folders`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (res.ok) {
      setNewFolderName(p => ({ ...p, [projectId]: '' }))
      router.refresh()
    }
  }

  const handleDeleteFolder = async (projectId: string, folderId: string) => {
    if (!confirm('Delete this folder and all its files?')) return
    await fetch(`/api/v1/projects/${projectId}/folders/${folderId}`, { method: 'DELETE' })
    router.refresh()
  }

  // Files
  const handleUpload = async (projectId: string, files: FileList | null) => {
    if (!files || files.length === 0) return
    const folderId = activeFolderIds[projectId] ?? null
    setUploadErrors(p => ({ ...p, [projectId]: '' }))

    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append('file', file)
      if (folderId) fd.append('folder_id', folderId)
      const res = await fetch(`/api/v1/projects/${projectId}/files`, { method: 'POST', body: fd })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        setUploadErrors(p => ({ ...p, [projectId]: body.error ?? 'Upload failed' }))
        return
      }
    }
    router.refresh()
  }

  const handleDeleteFile = async (projectId: string, fileId: string) => {
    if (!confirm('Delete this file permanently?')) return
    await fetch(`/api/v1/projects/${projectId}/files/${fileId}`, { method: 'DELETE' })
    router.refresh()
  }

  const viewUrl = (projectId: string, fileId: string) =>
    `/api/v1/projects/${projectId}/files/${fileId}`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Projects</h1>
          <p className="text-zinc-400 text-sm mt-1">{projects.length} {projects.length === 1 ? 'project' : 'projects'}</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition-colors">
          <Plus className="h-4 w-4" /> New Project
        </button>
      </div>

      {/* Project list */}
      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-4xl mb-4">🗂️</div>
          <p className="text-zinc-400">No projects yet.</p>
          <p className="text-zinc-500 text-sm mt-1">Track your goals, tasks, files, and links.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => {
            const isExpanded = expandedId === project.id
            const tab = getTab(project.id)
            const total = project.tasks.length
            const done = project.tasks.filter(t => t.done).length
            const pct = total > 0 ? Math.round((done / total) * 100) : 0
            const statusInfo = STATUS_MAP[project.status] ?? STATUS_MAP.active
            const activeFolder = activeFolderIds[project.id] ?? null
            const currentFolder = project.folders.find(f => f.id === activeFolder)
            const visibleFiles = project.files.filter(f => f.folder_id === activeFolder)

            return (
              <div key={project.id} className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                {/* Project header row */}
                <div
                  className="flex items-center gap-4 p-5 cursor-pointer hover:bg-zinc-800/40 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : project.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-medium text-zinc-100">{project.name}</h3>
                      <ColorBadge label={statusInfo.label} color={statusInfo.color} />
                      {/* counters */}
                      {project.tasks.length > 0 && (
                        <span className="text-xs text-zinc-500">{done}/{total} tasks</span>
                      )}
                      {project.links.length > 0 && (
                        <span className="flex items-center gap-0.5 text-xs text-zinc-500">
                          <Link2 className="h-3 w-3" />{project.links.length}
                        </span>
                      )}
                      {project.files.length > 0 && (
                        <span className="flex items-center gap-0.5 text-xs text-zinc-500">
                          <FileText className="h-3 w-3" />{project.files.length}
                        </span>
                      )}
                    </div>
                    {project.description && (
                      <p className="text-sm text-zinc-500 mt-1 truncate">{project.description}</p>
                    )}
                    {total > 0 && (
                      <div className="flex items-center gap-2 mt-2 max-w-xs">
                        <div className="flex-1 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-zinc-500 shrink-0">{pct}%</span>
                      </div>
                    )}
                    {project.due_date && <p className="text-xs text-zinc-500 mt-1">Due {project.due_date}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                    <button onClick={() => openEdit(project)} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors" aria-label="Edit">✏️</button>
                    <button onClick={() => setDeleteId(project.id)} className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors" aria-label="Delete">🗑️</button>
                    <span className="text-zinc-600 text-sm ml-1">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Expanded panel */}
                {isExpanded && (
                  <div className="border-t border-zinc-800">
                    {/* Tab bar */}
                    <div className="flex border-b border-zinc-800">
                      {TAB_LABELS.map(t => (
                        <button
                          key={t}
                          onClick={() => setTab(project.id, t)}
                          className={`px-5 py-2.5 text-sm font-medium transition-colors ${
                            tab === t
                              ? 'text-emerald-400 border-b-2 border-emerald-500 -mb-px'
                              : 'text-zinc-500 hover:text-zinc-300'
                          }`}
                        >
                          {t}
                          {t === 'Tasks' && total > 0 && (
                            <span className="ml-1.5 text-xs text-zinc-600">({done}/{total})</span>
                          )}
                          {t === 'Links' && project.links.length > 0 && (
                            <span className="ml-1.5 text-xs text-zinc-600">({project.links.length})</span>
                          )}
                          {t === 'Files' && project.files.length > 0 && (
                            <span className="ml-1.5 text-xs text-zinc-600">({project.files.length})</span>
                          )}
                        </button>
                      ))}
                    </div>

                    {/* ── TASKS tab ── */}
                    {tab === 'Tasks' && (
                      <div className="p-5 space-y-3">
                        {project.tasks.length === 0 && (
                          <p className="text-sm text-zinc-600">No tasks yet. Add one below.</p>
                        )}
                        {project.tasks.map(task => (
                          <div key={task.id} className="flex items-center gap-3 group">
                            <button
                              onClick={() => handleToggleTask(task.id)} disabled={isPending}
                              className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                task.done ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-zinc-600 hover:border-zinc-400'
                              }`}
                            >{task.done ? '✓' : ''}</button>
                            <span className={`flex-1 text-sm ${task.done ? 'line-through text-zinc-500' : 'text-zinc-300'}`}>
                              {task.title}
                            </span>
                            <button onClick={() => handleDeleteTask(task.id)} disabled={isPending}
                              className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-red-400 transition-all">×</button>
                          </div>
                        ))}
                        <div className="flex gap-2 pt-1">
                          <input type="text" placeholder="Add a task…"
                            value={newTaskInputs[project.id] ?? ''}
                            onChange={e => setNewTaskInputs(p => ({ ...p, [project.id]: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTask(project.id) } }}
                            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
                          />
                          <button onClick={() => handleAddTask(project.id)}
                            disabled={isPending || !newTaskInputs[project.id]?.trim()}
                            className="rounded-lg bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 px-3 py-1.5 text-sm transition-colors">Add</button>
                        </div>
                      </div>
                    )}

                    {/* ── LINKS tab ── */}
                    {tab === 'Links' && (
                      <div className="p-5 space-y-3">
                        {project.links.length === 0 && (
                          <p className="text-sm text-zinc-600">No reference links yet.</p>
                        )}
                        {project.links.map(link => (
                          <div key={link.id} className="flex items-center gap-3 group">
                            <img src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(link.url)}&sz=16`}
                              alt="" className="w-4 h-4 rounded shrink-0"
                              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                            <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 group/link">
                              <span className="text-sm text-zinc-200 group-hover/link:text-emerald-400 transition-colors truncate block">{link.title}</span>
                              <span className="text-xs text-zinc-600 truncate block">{link.url}</span>
                            </a>
                            <a href={link.url} target="_blank" rel="noopener noreferrer"
                              className="p-1 text-zinc-600 hover:text-emerald-400 transition-colors shrink-0">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                            <button onClick={() => handleDeleteLink(link.id)} disabled={isPending}
                              className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-red-400 transition-all shrink-0">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                        <div className="flex gap-2 pt-1">
                          <input type="text" placeholder="Label"
                            value={newLinkInputs[project.id]?.title ?? ''}
                            onChange={e => setLinkInput(project.id, 'title', e.target.value)}
                            className="w-32 shrink-0 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
                          />
                          <input type="url" placeholder="https://…"
                            value={newLinkInputs[project.id]?.url ?? ''}
                            onChange={e => setLinkInput(project.id, 'url', e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddLink(project.id) } }}
                            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
                          />
                          <button onClick={() => handleAddLink(project.id)}
                            disabled={isPending || !newLinkInputs[project.id]?.title?.trim() || !newLinkInputs[project.id]?.url?.trim()}
                            className="rounded-lg bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 px-3 py-1.5 text-sm transition-colors">Add</button>
                        </div>
                      </div>
                    )}

                    {/* ── FILES tab ── */}
                    {tab === 'Files' && (
                      <div className="p-5 space-y-4">
                        {/* Breadcrumb + folder nav */}
                        <div className="flex items-center gap-1 text-sm flex-wrap">
                          <button
                            onClick={() => setActiveFolderIds(p => ({ ...p, [project.id]: null }))}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-colors ${
                              activeFolder === null ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                          >
                            <FolderOpen className="h-3.5 w-3.5" /> Root
                          </button>
                          {activeFolder && currentFolder && (
                            <>
                              <ChevronRight className="h-3.5 w-3.5 text-zinc-700" />
                              <span className="flex items-center gap-1 px-2 py-1 text-emerald-400 bg-emerald-500/10 rounded-lg">
                                <Folder className="h-3.5 w-3.5" /> {currentFolder.name}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Folder list (only at root) */}
                        {activeFolder === null && project.folders.length > 0 && (
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                            {project.folders.map(folder => (
                              <div key={folder.id}
                                className="group flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 cursor-pointer hover:border-zinc-600 transition-colors"
                                onClick={() => setActiveFolderIds(p => ({ ...p, [project.id]: folder.id }))}
                              >
                                <Folder className="h-4 w-4 text-yellow-400 shrink-0" />
                                <span className="text-sm text-zinc-200 truncate flex-1">{folder.name}</span>
                                <button
                                  onClick={e => { e.stopPropagation(); void handleDeleteFolder(project.id, folder.id) }}
                                  className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-500 hover:text-red-400 transition-all shrink-0"
                                  aria-label="Delete folder"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                                <span className="text-xs text-zinc-600 shrink-0">
                                  {project.files.filter(f => f.folder_id === folder.id).length} files
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* File list */}
                        {visibleFiles.length === 0 && (
                          <p className="text-sm text-zinc-600">No files here. Upload one below.</p>
                        )}
                        {visibleFiles.length > 0 && (
                          <div className="rounded-lg border border-zinc-800 overflow-hidden">
                            <table className="w-full text-sm">
                              <thead className="bg-zinc-800/60">
                                <tr>
                                  <th className="text-left px-3 py-2 text-xs text-zinc-500 font-medium">Name</th>
                                  <th className="text-right px-3 py-2 text-xs text-zinc-500 font-medium">Size</th>
                                  <th className="text-right px-3 py-2 text-xs text-zinc-500 font-medium">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-800">
                                {visibleFiles.map(file => (
                                  <tr key={file.id} className="hover:bg-zinc-800/30 group">
                                    <td className="px-3 py-2">
                                      <span className="flex items-center gap-2">
                                        <span className="text-base leading-none">{fileIcon(file.mime_type, file.original_name)}</span>
                                        <span className="text-zinc-200 truncate max-w-xs">{file.original_name}</span>
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-right text-zinc-500 font-mono text-xs">{fmtSize(file.size)}</td>
                                    <td className="px-3 py-2 text-right">
                                      <div className="flex items-center justify-end gap-1">
                                        {/* View in new tab */}
                                        <a href={viewUrl(project.id, file.id)} target="_blank" rel="noopener noreferrer"
                                          className="p-1.5 rounded text-zinc-500 hover:text-emerald-400 hover:bg-zinc-800 transition-colors"
                                          title="View / Open">
                                          <Eye className="h-3.5 w-3.5" />
                                        </a>
                                        {/* Download */}
                                        <a href={viewUrl(project.id, file.id)} download={file.original_name}
                                          className="p-1.5 rounded text-zinc-500 hover:text-blue-400 hover:bg-zinc-800 transition-colors"
                                          title="Download">
                                          <Download className="h-3.5 w-3.5" />
                                        </a>
                                        {/* Delete */}
                                        <button onClick={() => void handleDeleteFile(project.id, file.id)}
                                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-all"
                                          title="Delete">
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Upload error */}
                        {uploadErrors[project.id] && (
                          <p className="text-sm text-red-400">{uploadErrors[project.id]}</p>
                        )}

                        {/* Action bar: upload + new folder */}
                        <div className="flex flex-wrap gap-2 pt-1 border-t border-zinc-800">
                          {/* Upload button */}
                          <input
                            type="file" multiple
                            ref={el => { fileInputRefs.current[project.id] = el }}
                            className="hidden"
                            onChange={e => void handleUpload(project.id, e.target.files)}
                          />
                          <button
                            onClick={() => fileInputRefs.current[project.id]?.click()}
                            className="flex items-center gap-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 px-3 py-1.5 text-sm text-zinc-100 transition-colors"
                          >
                            <Upload className="h-3.5 w-3.5" /> Upload Files
                          </button>

                          {/* New folder (root level only) */}
                          {activeFolder === null && (
                            <div className="flex gap-2">
                              <input type="text" placeholder="New folder name"
                                value={newFolderName[project.id] ?? ''}
                                onChange={e => setNewFolderName(p => ({ ...p, [project.id]: e.target.value }))}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleCreateFolder(project.id) } }}
                                className="w-40 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
                              />
                              <button
                                onClick={() => void handleCreateFolder(project.id)}
                                disabled={!newFolderName[project.id]?.trim()}
                                className="flex items-center gap-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 px-3 py-1.5 text-sm transition-colors"
                              >
                                <Folder className="h-3.5 w-3.5" /> New Folder
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal open={modalOpen} onClose={closeModal} title={editProject ? 'Edit Project' : 'New Project'}>
        <form ref={formRef} action={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm text-zinc-300" htmlFor="p-name">Name</label>
            <input id="p-name" name="name" type="text" required
              defaultValue={editProject?.name ?? ''} placeholder="Project name"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm text-zinc-300" htmlFor="p-desc">Description</label>
            <textarea id="p-desc" name="description" rows={3}
              defaultValue={editProject?.description ?? ''} placeholder="What is this project about?"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-sm text-zinc-300" htmlFor="p-status">Status</label>
              <select id="p-status" name="status" defaultValue={editProject?.status ?? 'active'}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none">
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="on_hold">On Hold</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm text-zinc-300" htmlFor="p-due">Due Date</label>
              <input id="p-due" name="due_date" type="date" defaultValue={editProject?.due_date ?? ''}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={closeModal}
              className="flex-1 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-600 transition-colors">Cancel</button>
            <button type="submit" disabled={isPending}
              className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white transition-colors">
              {isPending ? 'Saving…' : editProject ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <Modal open={deleteId !== null} onClose={() => setDeleteId(null)} title="Delete Project">
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">
            Delete this project, all tasks, links, and files permanently?
          </p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteId(null)}
              className="flex-1 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-600 transition-colors">Cancel</button>
            <button onClick={() => deleteId && handleDeleteProject(deleteId)} disabled={isPending}
              className="flex-1 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white transition-colors">
              {isPending ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
