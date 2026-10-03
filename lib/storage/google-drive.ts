import 'server-only'
import { google } from 'googleapis'
import { Readable } from 'stream'

const SCOPES = ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/userinfo.email']

// ── OAuth2 client factory ──────────────────────────────────────────────────────
export function createOAuth2Client() {
  const clientId     = process.env['GOOGLE_CLIENT_ID']     ?? ''
  const clientSecret = process.env['GOOGLE_CLIENT_SECRET'] ?? ''
  const redirectUri  = process.env['GOOGLE_REDIRECT_URI']  ?? 'http://localhost:3000/api/v1/storage/google-callback'
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

/** Build the URL the user visits to grant Drive access */
export function getAuthUrl(): string {
  const oauth2 = createOAuth2Client()
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',          // always return refresh_token
  })
}

export interface DriveTokens {
  access_token:  string | null | undefined
  refresh_token: string | null | undefined
  expiry_date:   number | null | undefined
}

/** Exchange an auth code for tokens */
export async function exchangeCode(code: string): Promise<DriveTokens & { email: string }> {
  const oauth2 = createOAuth2Client()
  const { tokens } = await oauth2.getToken(code)
  oauth2.setCredentials(tokens)

  // Fetch connected email
  const oauth2Info = google.oauth2({ version: 'v2', auth: oauth2 })
  const { data } = await oauth2Info.userinfo.get()

  return {
    access_token:  tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date:   tokens.expiry_date,
    email:         data.email ?? '',
  }
}

// ── Authenticated Drive client ─────────────────────────────────────────────────
function getDriveClient(tokens: DriveTokens) {
  const oauth2 = createOAuth2Client()
  oauth2.setCredentials({
    access_token:  tokens.access_token  ?? undefined,
    refresh_token: tokens.refresh_token ?? undefined,
    expiry_date:   tokens.expiry_date   ?? undefined,
  })
  return google.drive({ version: 'v3', auth: oauth2 })
}

// ── Folder helpers ─────────────────────────────────────────────────────────────

/** Find or create a folder by name under a given parent */
export async function getOrCreateDriveFolder(
  tokens: DriveTokens,
  name: string,
  parentId?: string,
): Promise<string> {
  const drive = getDriveClient(tokens)
  const q = [
    `name = '${name.replace(/'/g, "\\'")}'`,
    `mimeType = 'application/vnd.google-apps.folder'`,
    `trashed = false`,
    parentId ? `'${parentId}' in parents` : `'root' in parents`,
  ].join(' and ')

  const list = await drive.files.list({ q, fields: 'files(id,name)', spaces: 'drive' })
  const existing = list.data.files?.[0]
  if (existing?.id) return existing.id

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : [],
    },
    fields: 'id',
  })
  return created.data.id!
}

/** Ensure Life OS/Documents folder exists, return its ID */
export async function ensureDocumentsFolder(
  tokens: DriveTokens,
  rootFolderId?: string,
): Promise<{ rootId: string; documentsId: string }> {
  const rootId = rootFolderId ?? await getOrCreateDriveFolder(tokens, 'Life OS')
  const documentsId = await getOrCreateDriveFolder(tokens, 'Documents', rootId)
  return { rootId, documentsId }
}

/** Ensure the root "Life OS" folder and a project sub-folder exist, return project folder ID */
export async function ensureProjectFolder(
  tokens: DriveTokens,
  projectName: string,
  rootFolderId?: string,
): Promise<{ rootId: string; projectId: string }> {
  // Root "Life OS" folder
  const rootId = rootFolderId ?? await getOrCreateDriveFolder(tokens, 'Life OS')
  // Projects sub-folder
  const projectsId = await getOrCreateDriveFolder(tokens, 'Projects', rootId)
  // Per-project folder
  const projectId = await getOrCreateDriveFolder(tokens, projectName, projectsId)
  return { rootId, projectId }
}

// ── File CRUD ──────────────────────────────────────────────────────────────────

/** Upload a file buffer to Drive; returns Drive file ID */
export async function uploadToDrive(
  tokens: DriveTokens,
  folderId: string,
  fileName: string,
  mimeType: string,
  data: Buffer | Uint8Array,
): Promise<string> {
  const drive = getDriveClient(tokens)
  const readable = Readable.from(Buffer.isBuffer(data) ? data : Buffer.from(data))

  const res = await drive.files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media: { mimeType, body: readable },
    fields: 'id',
  })
  return res.data.id!
}

/** Download a Drive file; returns a Buffer */
export async function downloadFromDrive(tokens: DriveTokens, driveFileId: string): Promise<Buffer> {
  const drive = getDriveClient(tokens)
  const res = await drive.files.get(
    { fileId: driveFileId, alt: 'media' },
    { responseType: 'arraybuffer' },
  )
  return Buffer.from(res.data as ArrayBuffer)
}

/** Get a shareable web view link for a Drive file (user must be logged in) */
export async function getDriveViewLink(tokens: DriveTokens, driveFileId: string): Promise<string> {
  const drive = getDriveClient(tokens)
  const res = await drive.files.get({ fileId: driveFileId, fields: 'webViewLink,webContentLink' })
  return res.data.webViewLink ?? res.data.webContentLink ?? ''
}

/** Delete a file from Drive */
export async function deleteFromDrive(tokens: DriveTokens, driveFileId: string): Promise<void> {
  const drive = getDriveClient(tokens)
  await drive.files.delete({ fileId: driveFileId }).catch(() => { /* already deleted */ })
}

// ── Token helpers ──────────────────────────────────────────────────────────────
export function tokensFromSettings(settings: {
  google_access_token:  string | null
  google_refresh_token: string | null
  google_token_expiry:  number | null
}): DriveTokens {
  return {
    access_token:  settings.google_access_token,
    refresh_token: settings.google_refresh_token,
    expiry_date:   settings.google_token_expiry,
  }
}
