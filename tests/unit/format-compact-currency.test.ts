import { describe, expect, it } from 'vitest'
import { formatCompactCurrency } from '@/lib/format-compact-currency'

describe('formatCompactCurrency', () => {
  it('formats compact amounts without locale-dependent compact notation', () => {
    expect(formatCompactCurrency(902_995, 'INR')).toBe('₹903K')
    expect(formatCompactCurrency(1_250_000, 'USD')).toBe('$1.3M')
  })

  it('leaves smaller amounts unscaled', () => {
    expect(formatCompactCurrency(999, 'USD')).toBe('$999')
  })

  it('uses a readable fallback for unsupported currencies', () => {
    expect(formatCompactCurrency(1_234.5, 'INVALID')).toBe('INVALID 1.2K')
  })
})
