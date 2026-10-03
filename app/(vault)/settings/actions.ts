'use server'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { getSessionOptions, type SessionData } from '@/lib/auth/session'
import { getDb } from '@/lib/db/client'
import { revalidatePath } from 'next/cache'

export async function saveSettings(formData: FormData) {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, getSessionOptions())
  const userId = session.sub
  if (!userId) throw new Error('Unauthorized')

  const provider = formData.get('provider')?.toString() || 'openai'

  // Derive base URL from provider (or use custom value)
  const providerBaseUrls: Record<string, string> = {
    openai:    'https://api.openai.com/v1',
    gemini:    'https://generativelanguage.googleapis.com/v1beta/openai/',
    grok:      'https://api.x.ai/v1',
    groq:      'https://api.groq.com/openai/v1',
    anthropic: 'https://api.anthropic.com/v1',
    ollama:    `${formData.get('ollama_base_url')?.toString()?.replace(/\/$/, '') || 'http://localhost:11434'}/v1`,
    custom:    formData.get('openai_base_url')?.toString() || '',
  }

  // Build pages config JSON from form fields like pages[journal][enabled], pages[journal][label]
  const pagesRaw = formData.get('pages_config')?.toString()
  let pagesConfigJson = '{}'
  if (pagesRaw) {
    try {
      JSON.parse(pagesRaw) // validate
      pagesConfigJson = pagesRaw
    } catch { /* ignore bad JSON */ }
  }

  const db = getDb()
  db.prepare(`
    UPDATE settings SET
      provider = ?,
      openai_api_key = ?,
      openai_base_url = ?,
      ollama_base_url = ?,
      default_model = ?,
      default_temperature = ?,
      pages_config = ?,
      updated_at = unixepoch()
    WHERE user_id = ?
  `).run(
    provider,
    formData.get('api_key')?.toString() || null,
    providerBaseUrls[provider] ?? formData.get('openai_base_url')?.toString() ?? 'https://api.openai.com/v1',
    formData.get('ollama_base_url')?.toString() || 'http://localhost:11434',
    formData.get('default_model')?.toString() || 'gpt-4o-mini',
    parseFloat(formData.get('temperature')?.toString() || '0.7'),
    pagesConfigJson,
    userId,
  )
  revalidatePath('/settings')
  revalidatePath('/dashboard')  // sidebar re-renders on next navigation
}
