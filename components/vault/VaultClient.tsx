'use client'
import { useState, useTransition } from 'react'
import {
  Globe, Mail, CreditCard, Landmark, MoreHorizontal,
  Plus, Eye, EyeOff, Copy, Check, Pencil, Trash2, Shield, X, ChevronDown,
} from 'lucide-react'
import type {
  VaultItem, VaultType, VaultFields,
  WebsiteFields, EmailFields, CreditCardFields, BankFields, OtherFields,
} from '@/lib/crypto/vault'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Props {
  items: VaultItem[]
  onCreate: (type: VaultType, name: string, fields: VaultFields) => Promise<void>
  onUpdate: (id: string, name: string, fields: VaultFields) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

const TYPE_META: Record<VaultType, { label: string; icon: React.FC<{ className?: string }>; color: string }> = {
  website:     { label: 'Website',     icon: Globe,        color: 'text-blue-400 bg-blue-400/10' },
  email:       { label: 'Email',       icon: Mail,         color: 'text-purple-400 bg-purple-400/10' },
  credit_card: { label: 'Credit Card', icon: CreditCard,   color: 'text-yellow-400 bg-yellow-400/10' },
  bank:        { label: 'Bank',        icon: Landmark,     color: 'text-emerald-400 bg-emerald-400/10' },
  other:       { label: 'Other',       icon: MoreHorizontal, color: 'text-zinc-400 bg-zinc-400/10' },
}
const VAULT_TYPES: VaultType[] = ['website', 'email', 'credit_card', 'bank', 'other']

// ── Helpers ───────────────────────────────────────────────────────────────────
const MASK = '••••••••'
function maskCardNumber(n: string) {
  const clean = n.replace(/\s/g, '')
  return clean.length > 4 ? `•••• •••• •••• ${clean.slice(-4)}` : n
}

function defaultFields(type: VaultType): VaultFields {
  switch (type) {
    case 'website':     return { url: '', username: '', password: '', notes: '' }
    case 'email':       return { email_address: '', password: '', recovery_email: '', notes: '' }
    case 'credit_card': return { cardholder_name: '', card_number: '', expiry: '', cvv: '', pin: '', notes: '' }
    case 'bank':        return { bank_name: '', account_number: '', routing_code: '', pin: '', notes: '' }
    case 'other':       return { fields: [{ key: '', value: '', hidden: true }], notes: '' }
  }
}

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      onClick={handleCopy}
      aria-label="Copy to clipboard"
      className="ml-1 rounded p-0.5 text-zinc-500 hover:text-zinc-300 transition-colors"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

// ── Masked field row ──────────────────────────────────────────────────────────
function FieldRow({ label, value, sensitive = true }: { label: string; value: string; sensitive?: boolean }) {
  const [revealed, setRevealed] = useState(false)
  if (!value) return null
  const display = sensitive && !revealed ? MASK : value
  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-zinc-800/60 px-3 py-1.5">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</p>
        <p className="mt-0.5 text-sm text-zinc-100 font-mono break-all select-all">{display}</p>
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        {sensitive && (
          <button
            onClick={() => setRevealed(r => !r)}
            aria-label={revealed ? 'Hide' : 'Reveal'}
            className="rounded p-0.5 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        )}
        <CopyBtn value={value} />
      </div>
    </div>
  )
}

// ── Vault card ────────────────────────────────────────────────────────────────
function VaultCard({ item, onEdit, onDelete }: {
  item: VaultItem
  onEdit: () => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const meta = TYPE_META[item.type]
  const Icon = meta.icon
  const f = item.fields

  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-900 overflow-hidden">
      {/* Header row */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => setExpanded(e => !e)}
        onKeyDown={e => e.key === 'Enter' && setExpanded(x => !x)}
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-zinc-800/40 transition-colors"
      >
        <div className={`rounded-lg p-2 ${meta.color}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-100 truncate">{item.name}</p>
          <p className="text-xs text-zinc-500">{meta.label}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={e => { e.stopPropagation(); onEdit() }}
            aria-label="Edit"
            className="rounded p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete() }}
            aria-label="Delete"
            className="rounded p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <ChevronDown className={`h-4 w-4 text-zinc-600 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Expanded fields */}
      {expanded && (
        <div className="space-y-1.5 border-t border-zinc-700/50 px-4 py-3">
          {item.type === 'website' && (() => {
            const ff = f as WebsiteFields
            return <>
              <FieldRow label="URL"      value={ff.url}      sensitive={false} />
              <FieldRow label="Username" value={ff.username} sensitive={false} />
              <FieldRow label="Password" value={ff.password} />
              {ff.notes && <FieldRow label="Notes" value={ff.notes} sensitive={false} />}
            </>
          })()}
          {item.type === 'email' && (() => {
            const ff = f as EmailFields
            return <>
              <FieldRow label="Email"          value={ff.email_address}  sensitive={false} />
              <FieldRow label="Password"       value={ff.password} />
              <FieldRow label="Recovery Email" value={ff.recovery_email} />
              {ff.notes && <FieldRow label="Notes" value={ff.notes} sensitive={false} />}
            </>
          })()}
          {item.type === 'credit_card' && (() => {
            const ff = f as CreditCardFields
            return <>
              <FieldRow label="Cardholder"  value={ff.cardholder_name}                    sensitive={false} />
              <FieldRow label="Card Number" value={ff.card_number ? maskCardNumber(ff.card_number) : ''} />
              <FieldRow label="Expiry"      value={ff.expiry}  />
              <FieldRow label="CVV"         value={ff.cvv}     />
              <FieldRow label="PIN"         value={ff.pin}     />
              {ff.notes && <FieldRow label="Notes" value={ff.notes} sensitive={false} />}
            </>
          })()}
          {item.type === 'bank' && (() => {
            const ff = f as BankFields
            return <>
              <FieldRow label="Bank"           value={ff.bank_name}      sensitive={false} />
              <FieldRow label="Account Number" value={ff.account_number} />
              <FieldRow label="IFSC / Routing" value={ff.routing_code}   />
              <FieldRow label="PIN"            value={ff.pin}            />
              {ff.notes && <FieldRow label="Notes" value={ff.notes} sensitive={false} />}
            </>
          })()}
          {item.type === 'other' && (() => {
            const ff = f as OtherFields
            return <>
              {ff.fields.map((kv, i) =>
                kv.key ? <FieldRow key={i} label={kv.key} value={kv.value} sensitive={kv.hidden} /> : null
              )}
              {ff.notes && <FieldRow label="Notes" value={ff.notes} sensitive={false} />}
            </>
          })()}
        </div>
      )}
    </div>
  )
}

// ── Form fields per type ──────────────────────────────────────────────────────
function VaultForm({ type, value, onChange }: {
  type: VaultType
  value: VaultFields
  onChange: (f: VaultFields) => void
}) {
  const inp = 'w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500'
  const ta  = `${inp} resize-none`

  if (type === 'website') {
    const f = value as WebsiteFields
    return <div className="space-y-3">
      <input className={inp} placeholder="URL (https://...)" value={f.url} onChange={e => onChange({ ...f, url: e.target.value })} />
      <input className={inp} placeholder="Username / Email" value={f.username} onChange={e => onChange({ ...f, username: e.target.value })} />
      <input className={inp} type="password" placeholder="Password" value={f.password} onChange={e => onChange({ ...f, password: e.target.value })} autoComplete="new-password" />
      <textarea className={ta} rows={2} placeholder="Notes (optional)" value={f.notes} onChange={e => onChange({ ...f, notes: e.target.value })} />
    </div>
  }
  if (type === 'email') {
    const f = value as EmailFields
    return <div className="space-y-3">
      <input className={inp} placeholder="Email address" value={f.email_address} onChange={e => onChange({ ...f, email_address: e.target.value })} />
      <input className={inp} type="password" placeholder="Password" value={f.password} onChange={e => onChange({ ...f, password: e.target.value })} autoComplete="new-password" />
      <input className={inp} placeholder="Recovery email (optional)" value={f.recovery_email} onChange={e => onChange({ ...f, recovery_email: e.target.value })} />
      <textarea className={ta} rows={2} placeholder="Notes (optional)" value={f.notes} onChange={e => onChange({ ...f, notes: e.target.value })} />
    </div>
  }
  if (type === 'credit_card') {
    const f = value as CreditCardFields
    return <div className="space-y-3">
      <input className={inp} placeholder="Cardholder name" value={f.cardholder_name} onChange={e => onChange({ ...f, cardholder_name: e.target.value })} />
      <input className={inp} placeholder="Card number (e.g. 4111 1111 1111 1111)" value={f.card_number} onChange={e => onChange({ ...f, card_number: e.target.value })} />
      <div className="grid grid-cols-3 gap-3">
        <input className={inp} placeholder="Expiry MM/YY" value={f.expiry} onChange={e => onChange({ ...f, expiry: e.target.value })} />
        <input className={inp} placeholder="CVV" value={f.cvv} onChange={e => onChange({ ...f, cvv: e.target.value })} />
        <input className={inp} placeholder="PIN" value={f.pin} onChange={e => onChange({ ...f, pin: e.target.value })} />
      </div>
      <textarea className={ta} rows={2} placeholder="Notes (optional)" value={f.notes} onChange={e => onChange({ ...f, notes: e.target.value })} />
    </div>
  }
  if (type === 'bank') {
    const f = value as BankFields
    return <div className="space-y-3">
      <input className={inp} placeholder="Bank name" value={f.bank_name} onChange={e => onChange({ ...f, bank_name: e.target.value })} />
      <input className={inp} placeholder="Account number" value={f.account_number} onChange={e => onChange({ ...f, account_number: e.target.value })} />
      <input className={inp} placeholder="IFSC / Sort code / Routing number" value={f.routing_code} onChange={e => onChange({ ...f, routing_code: e.target.value })} />
      <input className={inp} placeholder="PIN / Passcode" value={f.pin} onChange={e => onChange({ ...f, pin: e.target.value })} />
      <textarea className={ta} rows={2} placeholder="Notes (optional)" value={f.notes} onChange={e => onChange({ ...f, notes: e.target.value })} />
    </div>
  }
  // other
  const f = value as OtherFields
  return <div className="space-y-3">
    <div className="space-y-2">
      {f.fields.map((kv, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            className={`${inp} w-32 shrink-0`}
            placeholder="Field name"
            value={kv.key}
            onChange={e => {
              const updated = [...f.fields]; updated[i] = { ...kv, key: e.target.value }
              onChange({ ...f, fields: updated })
            }}
          />
          <input
            className={`${inp} flex-1`}
            placeholder="Value"
            type={kv.hidden ? 'password' : 'text'}
            value={kv.value}
            autoComplete="new-password"
            onChange={e => {
              const updated = [...f.fields]; updated[i] = { ...kv, value: e.target.value }
              onChange({ ...f, fields: updated })
            }}
          />
          <button
            type="button"
            onClick={() => {
              const updated = [...f.fields]; updated[i] = { ...kv, hidden: !kv.hidden }
              onChange({ ...f, fields: updated })
            }}
            aria-label={kv.hidden ? 'Mark as visible' : 'Mark as hidden'}
            className="shrink-0 rounded p-1.5 text-zinc-500 hover:text-zinc-300"
          >
            {kv.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...f, fields: f.fields.filter((_, j) => j !== i) })}
            aria-label="Remove field"
            className="shrink-0 rounded p-1.5 text-zinc-500 hover:text-red-400"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange({ ...f, fields: [...f.fields, { key: '', value: '', hidden: true }] })}
        className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300"
      >
        <Plus className="h-3.5 w-3.5" /> Add field
      </button>
    </div>
    <textarea className={ta} rows={2} placeholder="Notes (optional)" value={f.notes} onChange={e => onChange({ ...f, notes: e.target.value })} />
  </div>
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function VaultModal({
  initial, onSave, onClose,
}: {
  initial?: VaultItem
  onSave: (type: VaultType, name: string, fields: VaultFields) => Promise<void>
  onClose: () => void
}) {
  const [type,   setType]   = useState<VaultType>(initial?.type ?? 'website')
  const [name,   setName]   = useState(initial?.name ?? '')
  const [fields, setFields] = useState<VaultFields>(initial?.fields ?? defaultFields('website'))
  const [pending, startTransition] = useTransition()

  const handleTypeChange = (t: VaultType) => {
    setType(t)
    if (!initial) setFields(defaultFields(t))
  }

  const handleSubmit = () => {
    if (!name.trim()) return
    startTransition(async () => {
      await onSave(type, name, fields)
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal header */}
        <div className="flex items-center justify-between border-b border-zinc-700 px-5 py-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-400" />
            <h2 className="text-base font-semibold text-zinc-100">
              {initial ? 'Edit Item' : 'Add to Vault'}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* Type selector */}
          {!initial && (
            <div className="grid grid-cols-5 gap-1.5">
              {VAULT_TYPES.map(t => {
                const m = TYPE_META[t]; const Icon = m.icon
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleTypeChange(t)}
                    className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-xs transition-all ${
                      type === t
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                        : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="leading-tight text-center">{m.label}</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Name */}
          <input
            className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            placeholder="Item name (e.g. GitHub, Gmail, Chase Visa)"
            value={name}
            onChange={e => setName(e.target.value)}
          />

          {/* Type-specific fields */}
          <VaultForm type={type} value={fields} onChange={setFields} />

          {/* Encryption notice */}
          <p className="flex items-center gap-1.5 text-xs text-zinc-600">
            <Shield className="h-3 w-3 text-emerald-600 shrink-0" />
            All fields are encrypted with AES-256-GCM before storage.
          </p>
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t border-zinc-700 px-5 py-4">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-zinc-700 py-2 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={pending || !name.trim()}
            className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
          >
            {pending ? 'Saving…' : initial ? 'Save Changes' : 'Add to Vault'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Delete confirmation ───────────────────────────────────────────────────────
function ConfirmDeleteModal({ name, onConfirm, onClose }: {
  name: string; onConfirm: () => void; onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl">
        <h3 className="text-sm font-semibold text-zinc-100 mb-1">Delete &ldquo;{name}&rdquo;?</h3>
        <p className="text-xs text-zinc-500 mb-4">This action cannot be undone.</p>
        <div className="flex gap-2">
          <button onClick={onClose}   className="flex-1 rounded-lg border border-zinc-700 py-2 text-sm text-zinc-400 hover:bg-zinc-800">Cancel</button>
          <button onClick={onConfirm} className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-500">Delete</button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function VaultClient({ items, onCreate, onUpdate, onDelete }: Props) {
  const [filter,     setFilter]     = useState<VaultType | 'all'>('all')
  const [search,     setSearch]     = useState('')
  const [showAdd,    setShowAdd]    = useState(false)
  const [editItem,   setEditItem]   = useState<VaultItem | null>(null)
  const [deleteItem, setDeleteItem] = useState<VaultItem | null>(null)
  const [, startTransition]         = useTransition()

  const filtered = items.filter(item => {
    const matchType = filter === 'all' || item.type === filter
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase())
    return matchType && matchSearch
  })

  const counts: Record<VaultType | 'all', number> = {
    all:         items.length,
    website:     items.filter(i => i.type === 'website').length,
    email:       items.filter(i => i.type === 'email').length,
    credit_card: items.filter(i => i.type === 'credit_card').length,
    bank:        items.filter(i => i.type === 'bank').length,
    other:       items.filter(i => i.type === 'other').length,
  }

  const handleDelete = (item: VaultItem) => {
    startTransition(async () => {
      await onDelete(item.id)
      setDeleteItem(null)
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-emerald-500/10 p-2">
              <Shield className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-zinc-100">Password Vault</h1>
              <p className="text-xs text-zinc-500">AES-256-GCM encrypted · {items.length} items</p>
            </div>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
          >
            <Plus className="h-4 w-4" /> Add Item
          </button>
        </div>

        {/* Search */}
        <input
          type="search"
          placeholder="Search vault…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 mb-3"
        />

        {/* Category tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          {([
            ['all', 'All', null] as const,
            ...VAULT_TYPES.map(t => [t, TYPE_META[t].label, TYPE_META[t].icon] as const),
          ]).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setFilter(key as VaultType | 'all')}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                filter === key
                  ? 'bg-emerald-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
              }`}
            >
              {Icon && <Icon className="h-3 w-3" />}
              {label}
              <span className={`ml-0.5 rounded-full px-1 text-[10px] ${
                filter === key ? 'bg-emerald-500 text-white' : 'bg-zinc-700 text-zinc-400'
              }`}>
                {counts[key as VaultType | 'all']}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <Shield className="h-10 w-10 text-zinc-700 mb-3" />
            <p className="text-sm text-zinc-500">
              {items.length === 0 ? 'Your vault is empty' : 'No items match your search'}
            </p>
            {items.length === 0 && (
              <button
                onClick={() => setShowAdd(true)}
                className="mt-3 text-xs text-emerald-400 hover:text-emerald-300"
              >
                Add your first item
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(item => (
              <VaultCard
                key={item.id}
                item={item}
                onEdit={() => setEditItem(item)}
                onDelete={() => setDeleteItem(item)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add modal */}
      {showAdd && (
        <VaultModal
          onSave={async (type, name, fields) => {
            await onCreate(type, name, fields)
          }}
          onClose={() => setShowAdd(false)}
        />
      )}

      {/* Edit modal */}
      {editItem && (
        <VaultModal
          initial={editItem}
          onSave={async (_, name, fields) => {
            await onUpdate(editItem.id, name, fields)
          }}
          onClose={() => setEditItem(null)}
        />
      )}

      {/* Delete confirm */}
      {deleteItem && (
        <ConfirmDeleteModal
          name={deleteItem.name}
          onConfirm={() => handleDelete(deleteItem)}
          onClose={() => setDeleteItem(null)}
        />
      )}
    </div>
  )
}
