'use client'
import { useRef, useState, useTransition } from 'react'
import { useSearchParams } from 'next/navigation'
import { HardDrive, CheckCircle, AlertCircle, ExternalLink, Layout, Eye, EyeOff, Pencil } from 'lucide-react'
import { saveSettings } from '@/app/(vault)/settings/actions'
import { ALL_PAGES, resolvePageConfig, type PagesConfig } from '@/lib/pages-config'

interface SettingsRow {
  id: string
  user_id: string
  provider: string
  openai_api_key: string | null
  openai_base_url: string
  ollama_base_url: string
  default_model: string
  default_temperature: number
  pages_config: string | null
  // Google Drive
  google_drive_enabled: number
  google_drive_email: string | null
}

interface SettingsFormProps {
  settings: SettingsRow
}

const GROUP_ICONS: Record<string, string> = {
  AI: '🤖', Writing: '✍️', Work: '🗂️', Finance: '💰', Security: '🔐', Other: '🔍',
}

const PROVIDERS = [
  { id: 'openai',    label: 'OpenAI',     icon: '🤖', needsKey: true,  keyLabel: 'OpenAI API Key',   keyPlaceholder: 'sk-...' },
  { id: 'gemini',    label: 'Gemini',     icon: '✨', needsKey: true,  keyLabel: 'Google API Key',   keyPlaceholder: 'AIzaSy...' },
  { id: 'grok',      label: 'Grok (xAI)', icon: '⚡', needsKey: true,  keyLabel: 'xAI API Key',      keyPlaceholder: 'xai-...' },
  { id: 'groq',      label: 'Groq',       icon: '🚀', needsKey: true,  keyLabel: 'Groq API Key',     keyPlaceholder: 'gsk_...' },
  { id: 'anthropic', label: 'Anthropic',  icon: '🧠', needsKey: true,  keyLabel: 'Anthropic API Key',keyPlaceholder: 'sk-ant-...' },
  { id: 'ollama',    label: 'Ollama',     icon: '🦙', needsKey: false, keyLabel: '',                 keyPlaceholder: '' },
  { id: 'custom',    label: 'Custom API', icon: '⚙️', needsKey: false, keyLabel: 'API Key',          keyPlaceholder: 'Optional — Bearer token' },
] as const

type ProviderId = typeof PROVIDERS[number]['id']

const STATIC_MODELS: Record<string, { value: string; label: string }[]> = {
  openai: [
    { value: 'gpt-4o',          label: 'GPT-4o' },
    { value: 'gpt-4o-mini',     label: 'GPT-4o Mini' },
    { value: 'gpt-4-turbo',     label: 'GPT-4 Turbo' },
    { value: 'gpt-3.5-turbo',   label: 'GPT-3.5 Turbo' },
  ],
  gemini: [
    { value: 'gemini-2.0-flash',       label: 'Gemini 2.0 Flash' },
    { value: 'gemini-1.5-pro',         label: 'Gemini 1.5 Pro' },
    { value: 'gemini-1.5-flash',       label: 'Gemini 1.5 Flash' },
  ],
  grok: [
    { value: 'grok-2',          label: 'Grok 2' },
    { value: 'grok-beta',       label: 'Grok Beta' },
  ],
  groq: [
    { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
    { value: 'llama-3.1-8b-instant',    label: 'Llama 3.1 8B' },
    { value: 'mixtral-8x7b-32768',      label: 'Mixtral 8x7B' },
    { value: 'gemma2-9b-it',            label: 'Gemma 2 9B' },
  ],
  anthropic: [
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-5-haiku-20241022',  label: 'Claude 3.5 Haiku' },
    { value: 'claude-3-opus-20240229',     label: 'Claude 3 Opus' },
  ],
  custom: [
    { value: 'custom', label: 'Enter model name below' },
  ],
}

export function SettingsForm({ settings }: SettingsFormProps) {
  const searchParams = useSearchParams()
  const driveSuccess = searchParams.get('success') === 'google_connected'
  const driveError   = searchParams.get('error')
  const [driveConnected, setDriveConnected] = useState(!!settings.google_drive_enabled)
  const [driveEmail] = useState(settings.google_drive_email ?? '')
  const [disconnecting, setDisconnecting] = useState(false)

  // Pages config state
  const initialPagesConfig = resolvePageConfig(settings.pages_config)
  const [pagesConfig, setPagesConfig] = useState<PagesConfig>(initialPagesConfig)
  const [editingLabel, setEditingLabel] = useState<string | null>(null)

  const togglePage = (key: string) => {
    setPagesConfig(prev => ({
      pages: {
        ...prev.pages,
        [key]: { ...prev.pages[key]!, enabled: !prev.pages[key]?.enabled },
      },
    }))
  }

  const setPageLabel = (key: string, label: string) => {
    setPagesConfig(prev => ({
      pages: {
        ...prev.pages,
        [key]: { ...prev.pages[key]!, label },
      },
    }))
  }

  const [provider, setProvider] = useState<ProviderId>((settings.provider as ProviderId) || 'openai')
  const [temperature, setTemperature] = useState(settings.default_temperature)
  const [selectedModel, setSelectedModel] = useState(settings.default_model)
  const [ollamaUrl, setOllamaUrl] = useState(settings.ollama_base_url || 'http://localhost:11434')
  const [ollamaModels, setOllamaModels] = useState<string[]>([])
  const [fetchingModels, setFetchingModels] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const providerInfo = PROVIDERS.find(p => p.id === provider)!
  const staticModels = STATIC_MODELS[provider] ?? []

  const fetchOllamaModels = async () => {
    setFetchingModels(true)
    setFetchError('')
    setOllamaModels([])
    try {
      // Use server-side proxy to avoid CORS — Next.js server fetches from Ollama directly
      const params = new URLSearchParams({ base_url: ollamaUrl.replace(/\/$/, '') })
      const res = await fetch(`/api/v1/ai/ollama-models?${params}`)
      const data = await res.json() as { models?: string[]; error?: string }

      if (!res.ok || data.error) {
        throw new Error(data.error ?? `Server error ${res.status}`)
      }
      const names = data.models ?? []
      if (names.length === 0) throw new Error('No models found. Pull a model first: ollama pull llama3')
      setOllamaModels(names)
      setSelectedModel(names[0] ?? '')
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to reach Ollama')
    } finally {
      setFetchingModels(false)
    }
  }

  const handleProviderChange = (id: ProviderId) => {
    setProvider(id)
    setSelectedModel(STATIC_MODELS[id]?.[0]?.value ?? '')
    setOllamaModels([])
    setFetchError('')
  }

  const handleSubmit = (formData: FormData) => {
    formData.set('default_model', selectedModel)
    formData.set('temperature', temperature.toString())
    formData.set('provider', provider)
    formData.set('pages_config', JSON.stringify(pagesConfig))
    startTransition(async () => {
      await saveSettings(formData)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    })
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-6">

      {/* Provider selector */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">AI Provider</h2>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {PROVIDERS.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleProviderChange(p.id)}
              className={`flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-xs font-medium transition-colors ${
                provider === p.id
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                  : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
              }`}
            >
              <span className="text-xl">{p.icon}</span>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Provider-specific config */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
          {providerInfo.label} Configuration
        </h2>

        {/* Ollama: URL + fetch models */}
        {provider === 'ollama' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm text-zinc-300">Ollama Base URL</label>
              <div className="flex gap-2">
                <input
                  name="ollama_base_url"
                  type="text"
                  value={ollamaUrl}
                  onChange={e => setOllamaUrl(e.target.value)}
                  placeholder="http://localhost:11434"
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={fetchOllamaModels}
                  disabled={fetchingModels}
                  className="shrink-0 rounded-lg bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 px-4 py-2 text-sm text-zinc-100 transition-colors"
                >
                  {fetchingModels ? '⟳ Fetching…' : '↻ Fetch Models'}
                </button>
              </div>
              <p className="text-xs text-zinc-500">Make sure Ollama is running locally. Click "Fetch Models" to load available models.</p>
            </div>

            {fetchError && (
              <div className="rounded-lg border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-300">
                {fetchError}
              </div>
            )}

            {ollamaModels.length > 0 && (
              <div className="space-y-2">
                <label className="block text-sm text-zinc-300">Available Models</label>
                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                  {ollamaModels.map(m => (
                    <label key={m} className={`flex items-center gap-3 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                      selectedModel === m
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-zinc-700 bg-zinc-800 hover:border-zinc-600'
                    }`}>
                      <input
                        type="radio"
                        name="_model_radio"
                        value={m}
                        checked={selectedModel === m}
                        onChange={() => setSelectedModel(m)}
                        className="accent-emerald-500"
                      />
                      <span className="text-sm text-zinc-100 font-mono">{m}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {ollamaModels.length === 0 && !fetchError && (
              <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-sm text-zinc-500 text-center">
                Click "Fetch Models" to load models from your Ollama instance
              </div>
            )}
          </div>
        )}

        {/* Custom: OpenAI-compatible URL, optional API key, and model */}
        {provider === 'custom' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="custom-api-base-url" className="block text-sm text-zinc-300">API Base URL</label>
              <input
                id="custom-api-base-url"
                name="openai_base_url"
                type="url"
                defaultValue={settings.openai_base_url}
                placeholder="https://your-api-endpoint/v1"
                required
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
              />
              <p className="text-xs text-zinc-500">Use an OpenAI-compatible chat completions endpoint. Include the API version path, such as /v1.</p>
            </div>
            <div className="space-y-2">
              <label htmlFor="custom-api-key" className="block text-sm text-zinc-300">API Key <span className="text-zinc-500">(optional)</span></label>
              <input
                id="custom-api-key"
                name="api_key"
                type="password"
                autoComplete="off"
                defaultValue={settings.openai_api_key ?? ''}
                placeholder={providerInfo.keyPlaceholder}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
              />
              <p className="text-xs text-zinc-500">Sent as a Bearer token to your configured endpoint. Stored locally with your settings.</p>
            </div>
            <div className="space-y-2">
              <label htmlFor="custom-model-name" className="block text-sm text-zinc-300">Model Name</label>
              <input
                id="custom-model-name"
                type="text"
                value={selectedModel === 'custom' ? '' : selectedModel}
                onChange={e => setSelectedModel(e.target.value)}
                placeholder="e.g. mistral, phi-3, custom-model"
                required
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* All other providers: API key + static model list */}
        {provider !== 'ollama' && provider !== 'custom' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm text-zinc-300">{providerInfo.keyLabel}</label>
              <input
                name="api_key"
                type="password"
                defaultValue={settings.openai_api_key ?? ''}
                placeholder={providerInfo.keyPlaceholder}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
              />
              <p className="text-xs text-zinc-500">Stored locally — never sent anywhere except directly to {providerInfo.label}.</p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm text-zinc-300">Model</label>
              <div className="grid gap-2">
                {staticModels.map(m => (
                  <label key={m.value} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                    selectedModel === m.value
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-zinc-700 bg-zinc-800 hover:border-zinc-600'
                  }`}>
                    <input
                      type="radio"
                      name="_model_radio"
                      value={m.value}
                      checked={selectedModel === m.value}
                      onChange={() => setSelectedModel(m.value)}
                      className="accent-emerald-500"
                    />
                    <span className="text-sm text-zinc-100">{m.label}</span>
                    <span className="ml-auto font-mono text-xs text-zinc-500">{m.value}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Hidden fields */}
      <input type="hidden" name="provider" value={provider} />
      <input type="hidden" name="default_model" value={selectedModel} />

      {/* Temperature */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Generation</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label htmlFor="temperature" className="text-sm text-zinc-300">Temperature</label>
            <span className="text-sm font-mono text-zinc-400">{temperature.toFixed(1)}</span>
          </div>
          <input
            id="temperature"
            name="temperature"
            type="range"
            min="0" max="2" step="0.1"
            value={temperature}
            onChange={e => setTemperature(parseFloat(e.target.value))}
            className="w-full accent-emerald-500"
          />
          <div className="flex justify-between text-xs text-zinc-500">
            <span>0 — Precise</span>
            <span>1 — Balanced</span>
            <span>2 — Creative</span>
          </div>
        </div>
      </div>

      {/* ── Navigation & Pages ───────────────────────────────────────────── */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-5">
        <div className="flex items-center gap-2">
          <Layout className="h-4 w-4 text-zinc-400" />
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Navigation &amp; Pages</h2>
        </div>
        <p className="text-xs text-zinc-500">Toggle pages on/off in the sidebar. Click the pencil to rename a page label.</p>

        {/* Always-on pages notice */}
        <div className="flex gap-3 text-xs text-zinc-500">
          <span className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1">📊 Dashboard — always visible</span>
          <span className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1">⚙️ Settings — always visible</span>
        </div>

        {/* Group the pages */}
        {(['AI', 'Writing', 'Work', 'Finance', 'Security', 'Other'] as const).map(group => {
          const groupPages = ALL_PAGES.filter(p => p.group === group)
          if (groupPages.length === 0) return null
          return (
            <div key={group} className="space-y-2">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                <span>{GROUP_ICONS[group]}</span> {group}
              </p>
              <div className="space-y-1.5">
                {groupPages.map(page => {
                  const cfg = pagesConfig.pages[page.key]
                  const isEnabled = cfg?.enabled !== false
                  const label = cfg?.label ?? page.defaultLabel
                  const isEditing = editingLabel === page.key

                  return (
                    <div key={page.key}
                      className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                        isEnabled ? 'border-zinc-700 bg-zinc-800' : 'border-zinc-800 bg-zinc-900 opacity-60'
                      }`}
                    >
                      {/* Toggle */}
                      <button
                        type="button"
                        onClick={() => togglePage(page.key)}
                        className={`shrink-0 relative inline-flex h-5 w-9 rounded-full transition-colors focus:outline-none ${
                          isEnabled ? 'bg-emerald-500' : 'bg-zinc-600'
                        }`}
                        role="switch"
                        aria-checked={isEnabled}
                        aria-label={`Toggle ${label}`}
                      >
                        <span className={`inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow transition-transform ${
                          isEnabled ? 'translate-x-4' : 'translate-x-0.5'
                        }`} />
                      </button>

                      {/* Label (editable) */}
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <input
                            autoFocus
                            type="text"
                            value={label}
                            onChange={e => setPageLabel(page.key, e.target.value)}
                            onBlur={() => setEditingLabel(null)}
                            onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingLabel(null) }}
                            className="w-full bg-transparent border-b border-emerald-500 text-sm text-zinc-100 focus:outline-none"
                          />
                        ) : (
                          <span className={`text-sm ${isEnabled ? 'text-zinc-200' : 'text-zinc-500'}`}>{label}</span>
                        )}
                        {label !== page.defaultLabel && !isEditing && (
                          <span className="block text-[10px] text-zinc-600">default: {page.defaultLabel}</span>
                        )}
                      </div>

                      {/* Icon + edit label button */}
                      <div className="flex items-center gap-2 shrink-0">
                        {isEnabled ? (
                          <Eye className="h-3.5 w-3.5 text-zinc-500" />
                        ) : (
                          <EyeOff className="h-3.5 w-3.5 text-zinc-600" />
                        )}
                        <button type="button"
                          onClick={() => setEditingLabel(isEditing ? null : page.key)}
                          className="p-1 rounded text-zinc-600 hover:text-zinc-300 transition-colors"
                          aria-label={`Rename ${label}`}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        <p className="text-xs text-zinc-600">Changes take effect after saving — the sidebar updates on your next page navigation.</p>
      </div>

      {/* ── Google Drive Storage ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-zinc-400" />
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">File Storage — Google Drive</h2>
        </div>

        {/* Status banners */}
        {driveSuccess && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-700/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            <CheckCircle className="h-4 w-4 shrink-0" />
            Google Drive connected! Project files will now be stored in your Drive.
          </div>
        )}
        {driveError === 'google_not_configured' && (
          <div className="flex items-center gap-2 rounded-lg border border-red-700/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>
              <strong>GOOGLE_CLIENT_ID</strong> is not set in <code className="bg-zinc-800 px-1 rounded">.env.local</code>.{' '}
              See the setup guide below.
            </span>
          </div>
        )}
        {driveError === 'google_denied' && (
          <div className="flex items-center gap-2 rounded-lg border border-yellow-700/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Google sign-in was cancelled or denied.
          </div>
        )}

        {driveConnected ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-emerald-700/30 bg-zinc-800 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📁</span>
                <div>
                  <p className="text-sm font-medium text-zinc-100">Google Drive Connected</p>
                  <p className="text-xs text-zinc-400">{driveEmail || 'Connected'} · Files stored in Life OS / Projects /</p>
                </div>
              </div>
              <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
            </div>
            <div className="flex gap-2">
              <a href="https://drive.google.com" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-zinc-600 transition-colors">
                <ExternalLink className="h-3.5 w-3.5" /> Open Drive
              </a>
              <button type="button"
                disabled={disconnecting}
                onClick={async () => {
                  setDisconnecting(true)
                  await fetch('/api/v1/storage/google-disconnect', { method: 'POST' })
                  setDriveConnected(false)
                  setDisconnecting(false)
                }}
                className="rounded-lg border border-red-700/40 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50">
                {disconnecting ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">
              Connect your Google account to store project files in your Google Drive (15 GB free with Gmail).
              Files are saved to <code className="bg-zinc-800 px-1 rounded text-xs">Life OS / Projects / &lt;project&gt;/</code>.
            </p>

            <a href="/api/v1/storage/google-auth"
              className="flex items-center justify-center gap-2 w-full rounded-lg border border-zinc-600 bg-zinc-800 hover:bg-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-100 transition-colors">
              <span className="text-lg">🔗</span> Connect Google Drive
            </a>

            {/* Setup instructions */}
            <details className="rounded-lg border border-zinc-700 bg-zinc-800/50">
              <summary className="cursor-pointer px-4 py-3 text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
                📋 Setup instructions — first time only
              </summary>
              <div className="px-4 pb-4 space-y-3 text-sm text-zinc-400">
                <ol className="list-decimal list-inside space-y-2">
                  <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">console.cloud.google.com</a> → Create a project</li>
                  <li>Enable <strong className="text-zinc-200">Google Drive API</strong></li>
                  <li>Go to <strong className="text-zinc-200">APIs &amp; Services → Credentials</strong> → Create OAuth 2.0 Client ID</li>
                  <li>Choose <strong className="text-zinc-200">Web application</strong>, add redirect URI: <code className="bg-zinc-900 px-1 rounded">http://localhost:3000/api/v1/storage/google-callback</code></li>
                  <li>Add to your <code className="bg-zinc-900 px-1 rounded">.env.local</code>:</li>
                </ol>
                <pre className="rounded-lg bg-zinc-900 p-3 text-xs text-zinc-300 overflow-x-auto">{`GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/v1/storage/google-callback`}</pre>
                <p className="text-xs text-zinc-500">Restart the dev server after adding the env vars, then click "Connect Google Drive".</p>
              </div>
            </details>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending || (provider === 'ollama' && !selectedModel) || (provider === 'custom' && (!selectedModel || selectedModel === 'custom'))}
        className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2.5 text-sm font-medium text-white transition-colors"
      >
        {isPending ? 'Saving…' : saved ? '✓ Saved' : 'Save Settings'}
      </button>

      {provider === 'ollama' && !selectedModel && (
        <p className="text-center text-xs text-zinc-500">Fetch and select an Ollama model to save</p>
      )}
    </form>
  )
}
