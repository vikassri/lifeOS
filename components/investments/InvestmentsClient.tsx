'use client'
import { useState, useTransition } from 'react'
import {
  TrendingUp, TrendingDown, Minus, Plus, Pencil, Trash2,
  BarChart2, Globe, RefreshCw, ChevronDown, ChevronUp, X,
} from 'lucide-react'
import { ColorBadge } from '@/components/ui/color-badge'
import { formatCompactCurrency } from '@/lib/format-compact-currency'
import {
  createInvestment, updateInvestment, deleteInvestment,
  addSnapshot, deleteSnapshot,
} from '@/app/(vault)/vault/finance/actions'

// ── Types ─────────────────────────────────────────────────────────────────────
export interface InvestmentSnapshot {
  id: string; investment_id: string; value: number
  period: string; period_type: string; snapshot_date: string; created_at: number
}
export interface InvestmentRow {
  id: string; name: string; type: string; ticker: string | null
  quantity: number; buy_price: number; currency: string; country: string
  notes: string | null; snapshots: InvestmentSnapshot[]
}

// ── Constants ─────────────────────────────────────────────────────────────────
const INVESTMENT_TYPES = [
  { value: 'mf',            label: 'Mutual Fund',    color: 'blue'    as const, hex: '#60a5fa' },
  { value: 'us_stocks',     label: 'US Stocks',      color: 'indigo'  as const, hex: '#818cf8' },
  { value: 'indian_stocks', label: 'Indian Stocks',  color: 'orange'  as const, hex: '#fb923c' },
  { value: 'ulips',         label: 'ULIPs',          color: 'purple'  as const, hex: '#c084fc' },
  { value: 'tradcred',      label: 'TredCred',       color: 'yellow'  as const, hex: '#facc15' },
  { value: 'precize',       label: 'Precize',        color: 'yellow'  as const, hex: '#eab308' },
  { value: '12pct_club',    label: '12% Club',       color: 'emerald' as const, hex: '#34d399' },
  { value: 'bank',          label: 'Bank',           color: 'zinc'    as const, hex: '#a1a1aa' },
  { value: 'real_estate',   label: 'Real Estate',    color: 'purple'  as const, hex: '#a855f7' },
  { value: 'fd',            label: 'Fixed Deposit',  color: 'emerald' as const, hex: '#10b981' },
  { value: 'epf',           label: 'EPF',            color: 'blue'    as const, hex: '#3b82f6' },
  { value: 'ppf',           label: 'PPF',            color: 'blue'    as const, hex: '#2563eb' },
  { value: 'nps',           label: 'NPS',            color: 'indigo'  as const, hex: '#6366f1' },
  { value: 'bonds',         label: 'Bonds',          color: 'yellow'  as const, hex: '#d97706' },
  { value: 'stashaway',     label: 'StashAway',      color: 'emerald' as const, hex: '#059669' },
  { value: 'fcnr',          label: 'FCNR',           color: 'zinc'    as const, hex: '#71717a' },
  { value: 'gold',          label: 'Gold',           color: 'yellow'  as const, hex: '#f59e0b' },
  { value: 'assets',        label: 'Assets',         color: 'zinc'    as const, hex: '#52525b' },
  { value: 'stock',         label: 'Stock',          color: 'blue'    as const, hex: '#60a5fa' },
  { value: 'etf',           label: 'ETF',            color: 'indigo'  as const, hex: '#818cf8' },
  { value: 'crypto',        label: 'Crypto',         color: 'orange'  as const, hex: '#f97316' },
  { value: 'fixed_deposit', label: 'FD',             color: 'emerald' as const, hex: '#10b981' },
  { value: 'cash',          label: 'Cash',           color: 'zinc'    as const, hex: '#a1a1aa' },
  { value: 'other',         label: 'Other',          color: 'zinc'    as const, hex: '#52525b' },
]
const TYPE_MAP = Object.fromEntries(INVESTMENT_TYPES.map(t => [t.value, t]))
const typeLabel = (v: string) => TYPE_MAP[v]?.label ?? v
const typeColor = (v: string) => TYPE_MAP[v]?.color ?? ('zinc' as const)
const typeHex   = (v: string) => TYPE_MAP[v]?.hex ?? '#52525b'

const COUNTRY_FLAGS: Record<string, string> = { SG: '🇸🇬', IN: '🇮🇳', US: '🇺🇸', OTHER: '🌍' }
const CURRENCIES = ['SGD', 'INR', 'USD', 'EUR', 'GBP']

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(v: number, cur: string) {
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v) }
  catch { return `${cur} ${v.toLocaleString()}` }
}
function fmtCompact(v: number, cur: string) {
  return formatCompactCurrency(v, cur)
}
function today() { return new Date().toISOString().slice(0, 10) }
function monthPeriod() { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}` }

function getCurrentValue(inv: InvestmentRow) {
  const s = [...inv.snapshots].sort((a,b) => new Date(b.snapshot_date).getTime() - new Date(a.snapshot_date).getTime())[0]
  return s ? s.value : inv.quantity * inv.buy_price
}
const hasSnapshot = (inv: InvestmentRow) => inv.snapshots.length > 0

// ── Allocation bar (stacked) ──────────────────────────────────────────────────
function AllocationBar({ segments }: { segments: { pct: number; hex: string; label: string }[] }) {
  return (
    <div className="relative h-5 w-full rounded-full overflow-hidden flex bg-zinc-800">
      {segments.map((s, i) => (
        <div
          key={i}
          title={`${s.label} ${s.pct.toFixed(1)}%`}
          className="h-full transition-all"
          style={{ width: `${s.pct}%`, backgroundColor: s.hex }}
        />
      ))}
    </div>
  )
}

// ── Mini sparkline from snapshots ────────────────────────────────────────────
function Sparkline({ snapshots, currency }: { snapshots: InvestmentSnapshot[]; currency: string }) {
  if (snapshots.length < 2) return <span className="text-[10px] text-zinc-700">no history</span>
  const sorted = [...snapshots].sort((a,b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime())
  const vals = sorted.map(s => s.value)
  const min = Math.min(...vals), max = Math.max(...vals)
  const range = max - min || 1
  const W = 64, H = 24
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * W
    const y = H - ((v - min) / range) * (H - 4) - 2
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const last = vals[vals.length - 1]!
  const first = vals[0]!
  const isUp = last >= first
  return (
    <div className="flex items-center gap-2">
      <svg width={W} height={H} className="shrink-0">
        <polyline points={pts} fill="none" stroke={isUp ? '#34d399' : '#f87171'} strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      <span className={`text-[10px] font-mono ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
        {fmtCompact(last, currency)}
      </span>
    </div>
  )
}

// ── Investment card ───────────────────────────────────────────────────────────
function InvCard({ inv, portfolioPct, onEdit, onDelete, onSnapshot }: {
  inv: InvestmentRow; portfolioPct: number
  onEdit: () => void; onDelete: () => void; onSnapshot: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const cv = getCurrentValue(inv)
  const cost = inv.quantity * inv.buy_price
  const gl = cv - cost
  const glPct = cost > 0 ? (gl / cost) * 100 : 0
  const isEst = !hasSnapshot(inv)

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden hover:border-zinc-700 transition-colors">
      {/* Header */}
      <div className="px-4 py-3.5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-zinc-100 truncate">{inv.name}</span>
              {inv.ticker && <span className="text-[10px] font-mono bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded text-zinc-400">{inv.ticker}</span>}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <ColorBadge label={typeLabel(inv.type)} color={typeColor(inv.type)} />
              <span className="text-xs text-zinc-600">{COUNTRY_FLAGS[inv.country] ?? '🌍'} {inv.country}</span>
              {isEst && <span className="text-[10px] text-yellow-600 border border-yellow-800/40 rounded px-1">est.</span>}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className={`text-lg font-bold font-mono ${isEst ? 'text-zinc-400' : 'text-zinc-100'}`}>
              {fmtCompact(cv, inv.currency)}
            </p>
            {cost > 0 && (
              <p className={`text-xs font-mono flex items-center justify-end gap-0.5 ${gl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {gl >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {gl >= 0 ? '+' : ''}{fmtCompact(gl, inv.currency)} ({glPct >= 0 ? '+' : ''}{glPct.toFixed(1)}%)
              </p>
            )}
          </div>
        </div>

        {/* Portfolio allocation bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-zinc-600">
            <span>Portfolio share</span>
            <span>{portfolioPct.toFixed(1)}%</span>
          </div>
          <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${portfolioPct}%`, backgroundColor: typeHex(inv.type) }} />
          </div>
        </div>

        {/* Sparkline */}
        {inv.snapshots.length >= 2 && <Sparkline snapshots={inv.snapshots} currency={inv.currency} />}
      </div>

      {/* Expandable details */}
      <div className={`border-t border-zinc-800 px-4 overflow-hidden transition-all ${expanded ? 'py-3' : 'max-h-0 py-0'}`}>
        {expanded && (
          <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
            {inv.quantity > 0 && <div><span className="text-zinc-600">Qty: </span>{inv.quantity}</div>}
            {inv.buy_price > 0 && <div><span className="text-zinc-600">Buy price: </span><span className="font-mono">{fmt(inv.buy_price, inv.currency)}</span></div>}
            {cost > 0 && <div><span className="text-zinc-600">Cost basis: </span><span className="font-mono">{fmt(cost, inv.currency)}</span></div>}
            <div><span className="text-zinc-600">Currency: </span>{inv.currency}</div>
            {inv.notes && <div className="col-span-2 text-zinc-500 italic">{inv.notes}</div>}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 border-t border-zinc-800 px-4 py-2 bg-zinc-800/30">
        <button onClick={onSnapshot} className="flex items-center gap-1 rounded px-2 py-1 text-xs text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/20 transition-colors">
          <Plus className="h-3 w-3" /> Value
        </button>
        <button onClick={onEdit} className="ml-auto p-1.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 transition-colors" aria-label="Edit">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button onClick={onDelete} className="p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" aria-label="Delete">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => setExpanded(e => !e)} className="p-1.5 rounded text-zinc-500 hover:text-zinc-300 transition-colors">
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function InvestmentsClient({ investments }: { investments: InvestmentRow[] }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editInv, setEditInv]     = useState<InvestmentRow | null>(null)
  const [snapInv, setSnapInv]     = useState<InvestmentRow | null>(null)
  const [deleteId, setDeleteId]   = useState<string | null>(null)
  const [view, setView]           = useState<'cards'|'table'>('cards')
  const [filterCur, setFilterCur] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [isPending, startTransition] = useTransition()

  const [snapVal, setSnapVal]           = useState('')
  const [snapPT, setSnapPT]             = useState<'monthly'|'yearly'>('monthly')
  const [snapPeriod, setSnapPeriod]     = useState(monthPeriod())
  const [snapDate, setSnapDate]         = useState(today())

  const closeModal = () => { setModalOpen(false); setEditInv(null) }

  const handleSubmit = (fd: FormData) => {
    startTransition(async () => {
      if (editInv) await updateInvestment(editInv.id, fd)
      else         await createInvestment(fd)
      closeModal()
    })
  }

  const handleDelete = (id: string) => startTransition(async () => { await deleteInvestment(id); setDeleteId(null) })

  const handleSnap = () => {
    if (!snapInv || !snapVal) return
    startTransition(async () => { await addSnapshot(snapInv.id, parseFloat(snapVal), snapPeriod, snapPT, snapDate); setSnapVal('') })
  }

  // ── Calculations ──
  const byCurrency = investments.reduce<Record<string, number>>((a, i) => {
    a[i.currency] = (a[i.currency] ?? 0) + getCurrentValue(i); return a
  }, {})
  const grandTotal = Object.values(byCurrency).reduce((s, v) => s + v, 0)

  const byType = investments.reduce<Record<string, number>>((a, i) => {
    a[i.type] = (a[i.type] ?? 0) + getCurrentValue(i); return a
  }, {})
  const typeSegments = Object.entries(byType)
    .sort((a,b) => b[1]-a[1])
    .map(([type, val]) => ({ type, val, pct: grandTotal > 0 ? (val/grandTotal)*100 : 0, hex: typeHex(type) }))

  const byCountry = investments.reduce<Record<string, number>>((a, i) => {
    a[i.country] = (a[i.country] ?? 0) + getCurrentValue(i); return a
  }, {})

  const filtered = investments.filter(i =>
    (filterCur === 'all' || i.currency === filterCur) &&
    (filterType === 'all' || i.type === filterType)
  )
  const currencies = [...new Set(investments.map(i => i.currency))]
  const types = [...new Set(investments.map(i => i.type))]

  const totalGainLoss = investments.reduce((s, i) => {
    const cv = getCurrentValue(i), cost = i.quantity * i.buy_price
    return s + (cv - cost)
  }, 0)

  return (
    <div className="flex flex-col h-full">
      {/* ── Page Header ── */}
      <div className="border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-400" /> Investments
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">{investments.length} positions tracked</p>
          </div>
          <button onClick={() => { setEditInv(null); setModalOpen(true) }}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white transition-colors">
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>

        {/* Currency totals row */}
        {Object.keys(byCurrency).length > 0 && (
          <div className="flex gap-3 flex-wrap">
            {Object.entries(byCurrency).sort((a,b)=>b[1]-a[1]).map(([cur, total]) => {
              const invCount = investments.filter(i => i.currency === cur).length
              return (
                <div key={cur} className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-800/50 px-4 py-2.5">
                  <div>
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wide">{cur} Portfolio</p>
                    <p className="text-xl font-bold text-emerald-400 font-mono">{fmt(total, cur)}</p>
                    <p className="text-[10px] text-zinc-600">{invCount} positions</p>
                  </div>
                </div>
              )
            })}
            {totalGainLoss !== 0 && (
              <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-800/50 px-4 py-2.5">
                <div>
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wide">Total Gain/Loss</p>
                  <p className={`text-xl font-bold font-mono flex items-center gap-1 ${totalGainLoss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {totalGainLoss >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    {totalGainLoss >= 0 ? '+' : ''}{fmtCompact(totalGainLoss, investments[0]?.currency ?? 'USD')}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        {investments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <TrendingUp className="h-12 w-12 text-zinc-700 mb-4" />
            <p className="text-zinc-400 text-lg font-medium">No investments yet</p>
            <p className="text-zinc-600 text-sm mt-1">Start tracking your portfolio</p>
            <button onClick={() => { setEditInv(null); setModalOpen(true) }}
              className="mt-4 flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-500">
              <Plus className="h-4 w-4" /> Add first investment
            </button>
          </div>
        ) : (
          <>
            {/* Allocation bar */}
            {typeSegments.length > 0 && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-zinc-500" />
                  <h2 className="text-sm font-semibold text-zinc-300">Portfolio Allocation</h2>
                </div>
                <AllocationBar segments={typeSegments.map(s => ({ pct: s.pct, hex: s.hex, label: typeLabel(s.type) }))} />
                {/* Legend */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {typeSegments.map(s => (
                    <div key={s.type} className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.hex }} />
                      <span className="text-xs text-zinc-400 truncate">{typeLabel(s.type)}</span>
                      <span className="text-xs text-zinc-600 ml-auto font-mono">{s.pct.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Country breakdown */}
            {Object.keys(byCountry).length > 1 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(byCountry).sort((a,b)=>b[1]-a[1]).map(([c, v]) => {
                  const inv = investments.find(i => i.country === c)
                  const pct = grandTotal > 0 ? (v / grandTotal) * 100 : 0
                  return (
                    <div key={c} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-lg">{COUNTRY_FLAGS[c] ?? '🌍'}</span>
                        <span className="text-xs text-zinc-600 font-mono">{pct.toFixed(0)}%</span>
                      </div>
                      <p className="text-sm font-medium text-zinc-100">{c}</p>
                      <p className="text-xs font-mono text-emerald-400">{fmtCompact(v, inv?.currency ?? 'USD')}</p>
                      <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500/60 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Filters + view toggle */}
            <div className="flex items-center gap-3 flex-wrap">
              <select value={filterCur} onChange={e => setFilterCur(e.target.value)}
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 focus:outline-none">
                <option value="all">All Currencies</option>
                {currencies.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={filterType} onChange={e => setFilterType(e.target.value)}
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 focus:outline-none">
                <option value="all">All Types</option>
                {types.map(t => <option key={t} value={t}>{typeLabel(t)}</option>)}
              </select>
              <div className="ml-auto flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800 p-0.5">
                {(['cards','table'] as const).map(v => (
                  <button key={v} onClick={() => setView(v)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${view===v ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}>
                    {v === 'cards' ? '⊞ Cards' : '☰ Table'}
                  </button>
                ))}
              </div>
              <span className="text-xs text-zinc-600">{filtered.length} results</span>
            </div>

            {/* Cards view */}
            {view === 'cards' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {[...filtered].sort((a,b) => getCurrentValue(b) - getCurrentValue(a)).map(inv => {
                  const cv = getCurrentValue(inv)
                  const curTotal = byCurrency[inv.currency] ?? 1
                  const pct = (cv / curTotal) * 100
                  return (
                    <InvCard
                      key={inv.id}
                      inv={inv}
                      portfolioPct={pct}
                      onEdit={() => { setEditInv(inv); setModalOpen(true) }}
                      onDelete={() => setDeleteId(inv.id)}
                      onSnapshot={() => { setSnapInv(inv); setSnapVal(''); setSnapPT('monthly'); setSnapPeriod(monthPeriod()); setSnapDate(today()) }}
                    />
                  )
                })}
              </div>
            )}

            {/* Table view */}
            {view === 'table' && (
              <div className="rounded-xl border border-zinc-800 overflow-x-auto">
                <table className="w-full text-sm min-w-[820px]">
                  <thead className="bg-zinc-800/60">
                    <tr>
                      {['Name','Type','Ticker','Qty','Buy Price','Current Value','Gain/Loss','Country',''].map(h => (
                        <th key={h} className={`px-4 py-3 text-xs font-medium text-zinc-400 uppercase ${h === '' || h === 'Gain/Loss' || h === 'Current Value' ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {[...filtered].sort((a,b) => getCurrentValue(b) - getCurrentValue(a)).map(inv => {
                      const cv = getCurrentValue(inv)
                      const cost = inv.quantity * inv.buy_price
                      const gl = cv - cost, glPct = cost > 0 ? (gl/cost)*100 : 0
                      return (
                        <tr key={inv.id} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium text-zinc-100">{inv.name}</p>
                            {!hasSnapshot(inv) && <span className="text-[10px] text-yellow-600">est.</span>}
                          </td>
                          <td className="px-4 py-3"><ColorBadge label={typeLabel(inv.type)} color={typeColor(inv.type)} /></td>
                          <td className="px-4 py-3 text-zinc-500 font-mono text-xs">{inv.ticker ?? '—'}</td>
                          <td className="px-4 py-3 text-zinc-300 text-right">{inv.quantity || '—'}</td>
                          <td className="px-4 py-3 text-right font-mono text-xs text-zinc-400">{inv.buy_price > 0 ? fmt(inv.buy_price, inv.currency) : '—'}</td>
                          <td className="px-4 py-3 text-right font-mono font-medium text-zinc-100">{fmt(cv, inv.currency)}</td>
                          <td className="px-4 py-3 text-right font-mono text-xs">
                            {cost > 0 ? (
                              <span className={gl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                <span className="flex items-center justify-end gap-0.5">
                                  {gl >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                  {gl >= 0 ? '+' : ''}{fmtCompact(gl, inv.currency)}
                                </span>
                                <span className="text-[10px]">{glPct >= 0 ? '+' : ''}{glPct.toFixed(1)}%</span>
                              </span>
                            ) : <Minus className="h-3 w-3 text-zinc-700 ml-auto" />}
                          </td>
                          <td className="px-4 py-3 text-zinc-300">{COUNTRY_FLAGS[inv.country]} {inv.country}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => { setSnapInv(inv); setSnapVal(''); setSnapDate(today()); setSnapPeriod(monthPeriod()) }}
                                className="px-1.5 py-0.5 rounded text-[10px] text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/10">+Val</button>
                              <button onClick={() => { setEditInv(inv); setModalOpen(true) }} className="p-1.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700"><Pencil className="h-3 w-3" /></button>
                              <button onClick={() => setDeleteId(inv.id)} className="p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10"><Trash2 className="h-3 w-3" /></button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot className="bg-zinc-800/60 border-t border-zinc-700">
                    <tr>
                      <td colSpan={5} className="px-4 py-2 text-xs text-zinc-500">Total</td>
                      <td className="px-4 py-2 text-right">
                        {Object.entries(byCurrency).filter(([c]) => filterCur === 'all' || c === filterCur).map(([c,t]) => (
                          <div key={c} className="text-sm font-bold font-mono text-emerald-400">{fmt(t, c)}</div>
                        ))}
                      </td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Add/Edit Modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-700 bg-zinc-900 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-700 px-5 py-4">
              <h2 className="text-base font-semibold text-zinc-100">{editInv ? 'Edit Investment' : 'Add Investment'}</h2>
              <button onClick={closeModal} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800"><X className="h-4 w-4" /></button>
            </div>
            <form action={handleSubmit} className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
              <input name="name" required placeholder="Investment name *" defaultValue={editInv?.name}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Type</label>
                  <select name="type" defaultValue={editInv?.type ?? 'mf'}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:outline-none">
                    {INVESTMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Ticker</label>
                  <input name="ticker" placeholder="AAPL" defaultValue={editInv?.ticker ?? ''}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Quantity</label>
                  <input name="quantity" type="number" step="any" defaultValue={editInv?.quantity ?? 0}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Buy Price / Unit</label>
                  <input name="buy_price" type="number" step="any" defaultValue={editInv?.buy_price ?? 0}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Currency</label>
                  <select name="currency" defaultValue={editInv?.currency ?? 'SGD'}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:outline-none">
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Country</label>
                  <select name="country" defaultValue={editInv?.country ?? 'SG'}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:outline-none">
                    <option value="SG">🇸🇬 Singapore</option>
                    <option value="IN">🇮🇳 India</option>
                    <option value="US">🇺🇸 USA</option>
                    <option value="OTHER">🌍 Other</option>
                  </select>
                </div>
              </div>
              <div className="rounded-lg border border-zinc-700/60 bg-zinc-800/40 p-3 space-y-1.5">
                <label className="text-xs text-zinc-400">Current Value <span className="text-zinc-600">(saves a snapshot today)</span></label>
                <input name="current_value" type="number" step="any" placeholder="Leave blank to use cost basis"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none" />
              </div>
              <textarea name="notes" rows={2} defaultValue={editInv?.notes ?? ''} placeholder="Notes…"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none resize-none" />
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={closeModal} className="flex-1 rounded-lg border border-zinc-700 py-2 text-sm text-zinc-400 hover:bg-zinc-800">Cancel</button>
                <button type="submit" disabled={isPending} className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 py-2 text-sm font-medium text-white">
                  {isPending ? 'Saving…' : editInv ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Snapshot modal ── */}
      {snapInv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 overflow-hidden">
            <div className="flex items-center justify-between border-b border-zinc-700 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-zinc-100">Record Value</h2>
                <p className="text-xs text-zinc-500 mt-0.5">{snapInv.name}</p>
              </div>
              <button onClick={() => setSnapInv(null)} className="p-1.5 rounded text-zinc-500 hover:bg-zinc-800"><X className="h-4 w-4" /></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <input type="number" step="any" value={snapVal} onChange={e => setSnapVal(e.target.value)}
                placeholder={`Current value in ${snapInv.currency}`}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-lg font-mono text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none" />
              <div className="grid grid-cols-2 gap-3">
                <div className="flex rounded-lg overflow-hidden border border-zinc-700">
                  {(['monthly','yearly'] as const).map(pt => (
                    <button key={pt} type="button" onClick={() => { setSnapPT(pt); setSnapPeriod(pt==='monthly'?monthPeriod():String(new Date().getFullYear())) }}
                      className={`flex-1 py-1.5 text-xs font-medium transition-colors ${snapPT===pt ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}`}>
                      {pt==='monthly'?'Monthly':'Yearly'}
                    </button>
                  ))}
                </div>
                <input type="text" value={snapPeriod} onChange={e => setSnapPeriod(e.target.value)}
                  placeholder={snapPT==='monthly'?'2026-09':'2026'}
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm font-mono text-zinc-100 focus:outline-none" />
                <input type="date" value={snapDate} onChange={e => setSnapDate(e.target.value)}
                  className="col-span-2 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:outline-none" />
              </div>
              <button onClick={handleSnap} disabled={isPending || !snapVal}
                className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 py-2 text-sm font-medium text-white">
                {isPending ? <RefreshCw className="h-4 w-4 animate-spin mx-auto" /> : 'Save Snapshot'}
              </button>
              {/* History */}
              {snapInv.snapshots.length > 0 && (
                <div className="space-y-1.5 max-h-44 overflow-y-auto">
                  <p className="text-xs text-zinc-600 uppercase tracking-wide">History</p>
                  {[...snapInv.snapshots].sort((a,b) => new Date(b.snapshot_date).getTime() - new Date(a.snapshot_date).getTime()).map(s => (
                    <div key={s.id} className="flex items-center justify-between rounded-lg bg-zinc-800 px-3 py-2">
                      <div>
                        <p className="text-sm font-mono font-medium text-zinc-200">{fmt(s.value, snapInv.currency)}</p>
                        <p className="text-xs text-zinc-600">{s.period} · {s.snapshot_date}</p>
                      </div>
                      <button onClick={() => startTransition(() => deleteSnapshot(s.id))} className="p-1 text-zinc-600 hover:text-red-400">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
            <h3 className="text-sm font-semibold text-zinc-100 mb-1">Delete investment?</h3>
            <p className="text-xs text-zinc-500 mb-4">All snapshots will also be deleted.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)} className="flex-1 rounded-lg border border-zinc-700 py-2 text-sm text-zinc-400 hover:bg-zinc-800">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} disabled={isPending} className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-500">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
