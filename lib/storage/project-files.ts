import 'server-only'
import fs from 'fs'
import path from 'path'

const UPLOADS_BASE = path.join(process.cwd(), '.data', 'uploads', 'projects')

/** Ensure the per-project upload directory exists and return its path */
export function getProjectUploadDir(projectId: string): string {
  const dir = path.join(UPLOADS_BASE, projectId)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

/** Build the full storage path for a file */
export function buildStoragePath(projectId: string, fileId: string, originalName: string): string {
  const ext = path.extname(originalName)
  return path.join(getProjectUploadDir(projectId), `${fileId}${ext}`)
}

/** Write a Buffer / Uint8Array to disk and return the storage path */
export async function writeProjectFile(
  projectId: string,
  fileId: string,
  originalName: string,
  data: ArrayBuffer,
): Promise<string> {
  const storagePath = buildStoragePath(projectId, fileId, originalName)
  await fs.promises.writeFile(storagePath, new Uint8Array(data))
  return storagePath
}

/** Delete a file from disk (silent if missing) */
export function deleteProjectFile(storagePath: string): void {
  try {
    if (fs.existsSync(storagePath)) fs.unlinkSync(storagePath)
  } catch { /* ignore */ }
}

/** Read a file from disk — returns Buffer */
export async function readProjectFile(storagePath: string): Promise<Buffer> {
  return fs.promises.readFile(storagePath)
}

/** Human-readable file size */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Icon name based on MIME type (used in the UI) */
export function fileIcon(mimeType: string, filename: string): string {
  const ext = path.extname(filename).toLowerCase()
  if (mimeType.startsWith('image/')) return '🖼️'
  if (mimeType.startsWith('video/')) return '🎬'
  if (mimeType.startsWith('audio/')) return '🎵'
  if (mimeType === 'application/pdf' || ext === '.pdf') return '📄'
  if (['.doc', '.docx'].includes(ext)) return '📝'
  if (['.xls', '.xlsx'].includes(ext)) return '📊'
  if (['.ppt', '.pptx'].includes(ext)) return '📑'
  if (['.zip', '.rar', '.tar', '.gz'].includes(ext)) return '🗜️'
  if (['.js', '.ts', '.tsx', '.jsx', '.py', '.go', '.rs', '.java'].includes(ext)) return '💻'
  if (['.md', '.txt'].includes(ext)) return '📋'
  return '📁'
}
