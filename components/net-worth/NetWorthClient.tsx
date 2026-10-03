'use client'
import { useState, useTransition } from 'react'
import { TrendingUp, TrendingDown, Plus, Pencil, Trash2, Info, X, DollarSign } from 'lucide-react'
import { ColorBadge } from '@/components/ui/color-badge'
import { createLiability, updateLiability, deleteLiability } from '@/app/(vault)/net-worth/actions'
import { formatCompactCurrency } from '@/lib/format-compact-currency'

// ── Types ─────────────────────────────────────────────────────────────────────
export interface LiabilityRow {
  id: string; name: string; type: string
  amount: number; currency: string; notes: string | null
  created_at: number; updated_at: number
}
export interface NetWorthInvestment {
  id: string; name: string; type: string; currency: string; country: string
  currentValue: number; hasSnapshot: boolean
}

// ── Constants ─────────────────────────────────────────────────────────────────
const COUNTRY_FLAGS: Record<string, string> = { SG: '🇸🇬', IN: '🇮🇳', US: '🇺🇸', OTHER: '🌍' }
const CURRENCIES = ['SGD', 'INR', 'USD', 'EUR', 'GBP']
const LIA_LABELS: Record<string, string> = { loan:'Loan', mortgage:'Mortgage', credit_card:'Credit Card', other:'Other' }
const LIA_COLORS: Record<string, 'red'|'orange'|'yellow'|'zinc'> = { loan:'orange', mortgage:'red', credit_card:'yellow', other:'zinc' }
const INV_LABEL: Record<string, string> = {
  mf:'MF', us_stocks:'US Stocks', indian_stocks:'Indian Stocks', ulips:'ULIPs',
  tradcred:'TredCred', precize:'Precize', '12pct_club':'12% Club', bank:'Bank',
  real_estate:'Real Estate', fd:'FD', epf:'EPF', ppf:'PPF', nps:'NPS',
  bonds:'Bonds', stashaway:'StashAway', fcnr:'FCNR', gold:'Gold', assets:'Assets',
  stock:'Stock', etf:'ETF', crypto:'Crypto', fixed_deposit:'FD', cash:'Cash', other:'Other',
}
const INV_COLOR: Record<string, 'blue'|'indigo'|'yellow'|'orange'|'emerald'|'purple'|'zinc'> = {
  mf:'blue', us_stocks:'indigo', indian_stocks:'orange', ulips:'purple', tradcred:'yellow',
  precize:'yellow', '12pct_club':'emerald', bank:'zinc', real_estate:'purple', fd:'emerald',
  epf:'blue', ppf:'blue', nps:'indigo', bonds:'yellow', stashaway:'emerald', fcnr:'zinc',
  gold:'yellow', stock:'blue', etf:'indigo', crypto:'orange', fixed_deposit:'emerald',
  cash:'zinc', assets:'zinc', other:'zinc',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(v: number, cur: string) {
  try { return new Intl.NumberFormat('en-US',{style:'currency',currency:cur,minimumFractionDigits:0,maximumFractionDigits:0}).format(v) }
  catch { return `${cur} ${v.toLocaleString()}` }
}
function fmtC(v: number, cur: string) {
  return formatCompactCurrency(v, cur)
}
function pct(part: number, total: number) { return total > 0 ? (part/total)*100 : 0 }

// ── SVG Donut chart ───────────────────────────────────────────────────────────
function DonutChart({ segments, size = 120 }: {
  segments: { value: number; color: string; label: string }[]
  size?: number
}) {
  const r = 42, cx = 60, cy = 60, strokeW = 14
  const circ = 2 * Math.PI * r
  const total = segments.reduce((s, sg) => s + sg.value, 0)
  if (total === 0) return null

  let cumulative = 0
  const arcs = segments.map(sg => {
    const frac = sg.value / total
    const dash = frac * circ
    const offset = circ - cumulative * circ / total * total
    const arc = { ...sg, dash, offset: circ * (1 - cumulative) }
    cumulative += frac
    return arc
  })

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className="shrink-0">
      {/* background ring */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgb(var(--zinc-800))" strokeWidth={strokeW} />
      {/* segments */}
      {arcs.map((arc, i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none"
          stroke={arc.color} strokeWidth={strokeW}
          strokeDasharray={`${arc.dash} ${circ - arc.dash}`}
          strokeDashoffset={arc.offset}
          strokeLinecap="butt"
          style={{ transform: 'rotate(-90deg)', transformOrigin: '60px 60px' }}
        >
          <title>{arc.label}: {arc.value.toFixed(0)}</title>
        </circle>
      ))}
    </svg>
  )
}

// ── Net Worth hero card ───────────────────────────────────────────────────────
function NetWorthCard({ currency, assets, liabilities }: { currency: string; assets: number; liabilities: number }) {
  const nw = assets - liabilities
  const healthPct = (assets + liabilities) > 0 ? pct(assets, assets + liabilities) : 100
  const debtRatio = assets > 0 ? (liabilities / assets) * 100 : 0

  return (
    <div className={`rounded-2xl border p-5 space-y-4 ${nw >= 0 ? 'border-emerald-700/40 bg-gradient-to-br from-zinc-900 to-emerald-950/20' : 'border-red-700/40 bg-gradient-to-br from-zinc-900 to-red-950/20'}`}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">{currency} Net Worth</p>
          <p className={`text-3xl font-bold font-mono mt-1 ${nw >= 0 ? 'text-emerald-300' : 'text-red-400'}`}>
            {nw >= 0 ? '' : '−'}{fmtC(Math.abs(nw), currency)}
          </p>
        </div>
        <div className={`rounded-xl p-2 ${nw >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
          {nw >= 0 ? <TrendingUp className="h-5 w-5 text-emerald-400" /> : <TrendingDown className="h-5 w-5 text-red-400" />}
        </div>
      </div>

      {/* Asset vs Liability bars */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-emerald-400"><span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0"/>Assets</span>
          <span className="font-mono font-semibold text-emerald-300">{fmt(assets, currency)}</span>
        </div>
        <div className="h-2.5 bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${healthPct}%` }} />
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-red-400"><span className="h-2 w-2 rounded-full bg-red-500 shrink-0"/>Liabilities</span>
          <span className="font-mono font-semibold text-red-400">{liabilities > 0 ? `−${fmt(liabilities, currency)}` : fmt(0, currency)}</span>
        </div>
        {liabilities > 0 && (
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-red-500/70 rounded-full transition-all" style={{ width: `${100 - healthPct}%` }} />
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-2 border-t border-zinc-800 pt-3">
        <div>
          <p className="text-[10px] text-zinc-600 uppercase tracking-wide">Debt Ratio</p>
          <p className={`text-sm font-mono font-semibold ${debtRatio < 30 ? 'text-emerald-400' : debtRatio < 60 ? 'text-yellow-400' : 'text-red-400'}`}>
            {debtRatio.toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-600 uppercase tracking-wide">Health</p>
          <p className={`text-sm font-semibold ${healthPct > 70 ? 'text-emerald-400' : healthPct > 50 ? 'text-yellow-400' : 'text-red-400'}`}>
            {healthPct > 70 ? '✅ Good' : healthPct > 50 ? '⚠️ Fair' : '🔴 At Risk'}
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function NetWorthClient({ investments, liabilities }: { investments: NetWorthInvestment[]; liabilities: LiabilityRow[] }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editL, setEditL]         = useState<LiabilityRow | null>(null)
  const [deleteId, setDeleteId]   = useState<string | null>(null)
  const [activeCur, setActiveCur] = useState('all')
  const [isPending, startTransition] = useTransition()

  const closeModal = () => { setModalOpen(false); setEditL(null) }
  const handleSubmit = (fd: FormData) => {
    startTransition(async () => { if (editL) await updateLiability(editL.id, fd); else await createLiability(fd); closeModal() })
  }
  const handleDelete = (id: string) => startTransition(async () => { await deleteLiability(id); setDeleteId(null) })

  // ── Calculations ──
  const assetsByCur = investments.reduce<Record<string, number>>((a, i) => {
    a[i.currency] = (a[i.currency] ?? 0) + i.currentValue; return a
  }, {})
  const liabByCur = liabilities.reduce<Record<string, number>>((a, l) => {
    a[l.currency] = (a[l.currency] ?? 0) + l.amount; return a
  }, {})
  const allCurrencies = [...new Set([...Object.keys(assetsByCur), ...Object.keys(liabByCur)])].sort()

  // Asset breakdown by type (for donut)
  const byType = investments.reduce<Record<string, number>>((a, i) => {
    a[i.type] = (a[i.type] ?? 0) + i.currentValue; return a
  }, {})
  const TYPE_HEX: Record<string, string> = {
    mf:'#60a5fa', us_stocks:'#818cf8', indian_stocks:'#fb923c', ulips:'#c084fc',
    tradcred:'#facc15', '12pct_club':'#34d399', bank:'#a1a1aa', real_estate:'#a855f7',
    fd:'#10b981', epf:'#3b82f6', ppf:'#2563eb', nps:'#6366f1', bonds:'#d97706',
    stashaway:'#059669', fcnr:'#71717a', gold:'#f59e0b', assets:'#52525b',
    stock:'#60a5fa', etf:'#818cf8', crypto:'#f97316', cash:'#a1a1aa', other:'#52525b',
  }
  const donutSegments = Object.entries(byType)
    .sort((a,b) => b[1]-a[1])
    .slice(0, 8)
    .map(([type, val]) => ({ value: val, color: TYPE_HEX[type] ?? '#71717a', label: INV_LABEL[type] ?? type }))

  const totalAssets = Object.values(assetsByCur).reduce((s,v)=>s+v,0)
  const totalLiab   = Object.values(liabByCur).reduce((s,v)=>s+v,0)
  const estimatedCnt = investments.filter(i => !i.hasSnapshot).length

  const filtInv = activeCur === 'all' ? investments : investments.filter(i => i.currency === activeCur)
  const filtLia = activeCur === 'all' ? liabilities : liabilities.filter(l => l.currency === activeCur)

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-400" /> Net Worth
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">Assets − Liabilities across all currencies</p>
          </div>
          <div className="flex items-center gap-2">
            {allCurrencies.length > 1 && (
              <div className="flex gap-1">
                <button onClick={() => setActiveCur('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${activeCur==='all' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}>
                  All
                </button>
                {allCurrencies.map(c => (
                  <button key={c} onClick={() => setActiveCur(c)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${activeCur===c ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}>
                    {c}
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => { setEditL(null); setModalOpen(true) }}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 hover:border-zinc-500 px-3 py-1.5 text-xs text-zinc-300 transition-colors">
              <Plus className="h-3.5 w-3.5" /> Liability
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        {/* Cost-basis notice */}
        {estimatedCnt > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-yellow-700/30 bg-yellow-500/5 px-4 py-2.5 text-xs text-yellow-400">
            <Info className="h-3.5 w-3.5 shrink-0" />
            {estimatedCnt} investment{estimatedCnt > 1 ? 's' : ''} use cost basis as estimated value — add snapshots in Investments tab for accuracy.
          </div>
        )}

        {/* ── Net Worth cards ── */}
        {allCurrencies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <DollarSign className="h-12 w-12 text-zinc-700 mb-3" />
            <p className="text-zinc-400">No data yet</p>
            <p className="text-zinc-600 text-sm mt-1">Add investments in the Investments tab to get started.</p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(activeCur === 'all' ? allCurrencies : [activeCur]).map(c => (
                <NetWorthCard key={c} currency={c}
                  assets={assetsByCur[c] ?? 0} liabilities={liabByCur[c] ?? 0} />
              ))}
            </div>

            {/* ── Portfolio composition ── */}
            {investments.length > 0 && (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                <h2 className="text-sm font-semibold text-zinc-300 mb-4">Asset Composition</h2>
                <div className="flex gap-6 items-start flex-wrap">
                  {/* Donut */}
                  <div className="relative">
                    <DonutChart segments={donutSegments} size={140} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <p className="text-[10px] text-zinc-600">Total</p>
                      <p className="text-xs font-bold text-zinc-300 font-mono">{totalAssets > 1e6 ? `${(totalAssets/1e6).toFixed(1)}M` : `${(totalAssets/1e3).toFixed(0)}K`}</p>
                    </div>
                  </div>
                  {/* Legend */}
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
                    {donutSegments.map((s, i) => {
                      const p = pct(s.value, totalAssets)
                      return (
                        <div key={i} className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                          <span className="text-xs text-zinc-400 truncate flex-1">{s.label}</span>
                          <span className="text-xs font-mono text-zinc-500">{p.toFixed(1)}%</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── Two-column: Assets + Liabilities ── */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Assets */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-zinc-100">Assets</h2>
                  <span className="text-xs text-zinc-500">{filtInv.length} positions</span>
                </div>
                <div className="rounded-xl border border-zinc-800 overflow-hidden">
                  {filtInv.length === 0 ? (
                    <div className="p-6 text-center text-zinc-600 text-sm">No investments in this currency.</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-zinc-800/60">
                        <tr>
                          <th className="text-left px-3 py-2 text-[10px] font-medium text-zinc-500 uppercase">Name</th>
                          <th className="text-left px-3 py-2 text-[10px] font-medium text-zinc-500 uppercase hidden sm:table-cell">Type</th>
                          <th className="text-right px-3 py-2 text-[10px] font-medium text-zinc-500 uppercase">Value</th>
                          <th className="text-right px-3 py-2 text-[10px] font-medium text-zinc-500 uppercase">%</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800">
                        {[...filtInv].sort((a,b) => b.currentValue - a.currentValue).map(inv => {
                          const curTotal = assetsByCur[inv.currency] ?? 1
                          const p = pct(inv.currentValue, curTotal)
                          return (
                            <tr key={inv.id} className="hover:bg-zinc-800/30 transition-colors">
                              <td className="px-3 py-2.5">
                                <p className="text-zinc-200 font-medium text-xs truncate max-w-[150px]">{inv.name}</p>
                                <p className="text-[10px] text-zinc-600">{COUNTRY_FLAGS[inv.country]} {inv.country} · {inv.currency}</p>
                              </td>
                              <td className="px-3 py-2.5 hidden sm:table-cell">
                                <ColorBadge label={INV_LABEL[inv.type] ?? inv.type} color={INV_COLOR[inv.type] ?? 'zinc'} />
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono text-xs text-zinc-200">
                                {fmtC(inv.currentValue, inv.currency)}
                                {!inv.hasSnapshot && <span className="block text-[9px] text-yellow-700">est.</span>}
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="flex items-center justify-end gap-1.5">
                                  <div className="w-10 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500/70 rounded-full" style={{ width: `${p}%` }} />
                                  </div>
                                  <span className="text-[10px] text-zinc-500 w-8 text-right">{p.toFixed(0)}%</span>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                      {Object.entries(assetsByCur).filter(([c]) => activeCur==='all' || c===activeCur).map(([c,t]) => (
                        <tfoot key={c} className="border-t border-zinc-700 bg-zinc-800/40">
                          <tr>
                            <td colSpan={2} className="px-3 py-2 text-xs text-zinc-500 font-medium">Total {c}</td>
                            <td className="px-3 py-2 text-right font-mono text-sm font-bold text-emerald-400">{fmt(t, c)}</td>
                            <td />
                          </tr>
                        </tfoot>
                      ))}
                    </table>
                  )}
                </div>
              </div>

              {/* Liabilities */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-zinc-100">Liabilities</h2>
                  <button onClick={() => { setEditL(null); setModalOpen(true) }}
                    className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-700 rounded-lg px-2.5 py-1 hover:border-zinc-500 transition-colors">
                    <Plus className="h-3 w-3" /> Add
                  </button>
                </div>

                {filtLia.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center space-y-2">
                    <p className="text-zinc-600 text-sm">{liabilities.length === 0 ? 'No liabilities' : 'None in this currency'}</p>
                    {liabilities.length === 0 && (
                      <button onClick={() => { setEditL(null); setModalOpen(true) }}
                        className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 mx-auto">
                        <Plus className="h-3 w-3" /> Add loans, mortgages & credit cards
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filtLia.map(l => {
                      const curTotal = liabByCur[l.currency] ?? 1
                      const p = pct(l.amount, curTotal)
                      return (
                        <div key={l.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-700 transition-colors">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <p className="text-sm font-semibold text-zinc-100">{l.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <ColorBadge label={LIA_LABELS[l.type] ?? l.type} color={LIA_COLORS[l.type] ?? 'zinc'} />
                                <span className="text-[10px] text-zinc-600">{l.currency}</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-base font-bold font-mono text-red-400">{fmt(l.amount, l.currency)}</p>
                              <p className="text-[10px] text-zinc-600">{p.toFixed(1)}% of {l.currency} debt</p>
                            </div>
                          </div>
                          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-3">
                            <div className="h-full bg-red-500/60 rounded-full transition-all" style={{ width: `${p}%` }} />
                          </div>
                          {l.notes && <p className="text-xs text-zinc-600 italic mb-2">{l.notes}</p>}
                          <div className="flex justify-end gap-1">
                            <button onClick={() => { setEditL(l); setModalOpen(true) }} className="p-1.5 rounded text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800"><Pencil className="h-3 w-3" /></button>
                            <button onClick={() => setDeleteId(l.id)} className="p-1.5 rounded text-zinc-600 hover:text-red-400 hover:bg-red-500/10"><Trash2 className="h-3 w-3" /></button>
                          </div>
                        </div>
                      )
                    })}
                    {/* Currency totals */}
                    {Object.entries(liabByCur).filter(([c]) => activeCur==='all' || c===activeCur).map(([c,t]) => (
                      <div key={c} className="flex justify-between items-center rounded-lg bg-zinc-800/50 px-4 py-2 border border-zinc-800">
                        <span className="text-xs text-zinc-500">Total {c} liabilities</span>
                        <span className="text-sm font-mono font-bold text-red-400">{fmt(t, c)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Summary overview ── */}
            {allCurrencies.length > 0 && (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-3">
                <h2 className="text-sm font-semibold text-zinc-300">Wealth Summary</h2>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wide mb-1">Total Assets</p>
                    <p className="text-lg font-bold font-mono text-emerald-400">{totalAssets > 1e6 ? `${(totalAssets/1e6).toFixed(2)}M` : `${(totalAssets/1e3).toFixed(1)}K`}</p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">{investments.length} positions</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wide mb-1">Total Liabilities</p>
                    <p className="text-lg font-bold font-mono text-red-400">{totalLiab > 1e6 ? `${(totalLiab/1e6).toFixed(2)}M` : `${(totalLiab/1e3).toFixed(1)}K`}</p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">{liabilities.length} items</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wide mb-1">Debt-to-Asset</p>
                    <p className={`text-lg font-bold font-mono ${totalAssets > 0 && (totalLiab/totalAssets) < 0.3 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                      {totalAssets > 0 ? `${((totalLiab/totalAssets)*100).toFixed(1)}%` : '—'}
                    </p>
                    <p className={`text-[10px] mt-0.5 ${totalAssets > 0 && (totalLiab/totalAssets) < 0.3 ? 'text-emerald-700' : 'text-yellow-700'}`}>
                      {totalAssets > 0 ? ((totalLiab/totalAssets) < 0.3 ? 'Healthy' : (totalLiab/totalAssets) < 0.6 ? 'Moderate' : 'High') : ''}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Add/Edit Liability Modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 overflow-hidden">
            <div className="flex items-center justify-between border-b border-zinc-700 px-5 py-4">
              <h2 className="text-sm font-semibold text-zinc-100">{editL ? 'Edit Liability' : 'Add Liability'}</h2>
              <button onClick={closeModal} className="p-1.5 rounded text-zinc-500 hover:bg-zinc-800"><X className="h-4 w-4" /></button>
            </div>
            <form action={handleSubmit} className="px-5 py-4 space-y-4">
              <input name="name" required placeholder="Liability name *" defaultValue={editL?.name}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Type</label>
                  <select name="type" defaultValue={editL?.type ?? 'loan'}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:outline-none">
                    {Object.entries(LIA_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Currency</label>
                  <select name="currency" defaultValue={editL?.currency ?? 'SGD'}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:outline-none">
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Amount</label>
                <input name="amount" type="number" step="any" required defaultValue={editL?.amount ?? 0}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none" />
              </div>
              <textarea name="notes" rows={2} defaultValue={editL?.notes ?? ''} placeholder="Notes (e.g. monthly instalment, interest rate)…"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none resize-none" />
              <div className="flex gap-2">
                <button type="button" onClick={closeModal} className="flex-1 rounded-lg border border-zinc-700 py-2 text-sm text-zinc-400 hover:bg-zinc-800">Cancel</button>
                <button type="submit" disabled={isPending} className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 py-2 text-sm font-medium text-white">
                  {isPending ? 'Saving…' : editL ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
            <h3 className="text-sm font-semibold text-zinc-100 mb-1">Delete liability?</h3>
            <p className="text-xs text-zinc-500 mb-4">This cannot be undone.</p>
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
