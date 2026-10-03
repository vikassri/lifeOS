const COMPACT_UNITS = [
  { threshold: 1_000_000_000_000, suffix: 'T' },
  { threshold: 1_000_000_000, suffix: 'B' },
  { threshold: 1_000_000, suffix: 'M' },
  { threshold: 1_000, suffix: 'K' },
] as const

export function formatCompactCurrency(value: number, currency: string): string {
  const unit = COMPACT_UNITS.find(({ threshold }) => Math.abs(value) >= threshold)

  try {
    const amount = unit ? value / unit.threshold : value
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(amount)

    return `${formatted}${unit?.suffix ?? ''}`
  } catch {
    const amount = unit ? value / unit.threshold : value
    return `${currency} ${amount.toLocaleString('en-US', {
      maximumFractionDigits: 1,
    })}${unit?.suffix ?? ''}`
  }
}
