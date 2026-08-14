import type { CurrencyCode, Locale } from '@/types/database'

const MYANMAR_DIGITS = ['၀', '၁', '၂', '၃', '၄', '၅', '၆', '၇', '၈', '၉']

/** MMK is quoted without decimals in practice; THB/USD keep two. */
const CURRENCY_DECIMALS: Record<string, number> = {
  MMK: 0, THB: 2, USD: 2, SGD: 2, CNY: 2, EUR: 2,
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  MMK: 'K', THB: '฿', USD: '$', SGD: 'S$', CNY: '¥', EUR: '€',
}

export function toMyanmarDigits(input: string): string {
  return input.replace(/\d/g, (d) => MYANMAR_DIGITS[Number(d)])
}

export interface MoneyOptions {
  currency?: CurrencyCode | string
  locale?: Locale
  /** Render Burmese numerals when locale is 'my'. Off by default for tabular data. */
  burmeseNumerals?: boolean
  /** '1.2M' style shortening for dashboard tiles. */
  compact?: boolean
  showSymbol?: boolean
}

/**
 * Format money for display. Always takes a plain number of *major* units
 * (the database stores numeric(20,4), not integer minor units).
 */
export function formatMoney(value: number | null | undefined, options: MoneyOptions = {}): string {
  const {
    currency = 'MMK',
    locale = 'en',
    burmeseNumerals = false,
    compact = false,
    showSymbol = true,
  } = options

  const amount = Number(value ?? 0)
  const decimals = CURRENCY_DECIMALS[currency] ?? 2

  let text: string

  if (compact && Math.abs(amount) >= 1_000_000) {
    text = `${(amount / 1_000_000).toFixed(amount % 1_000_000 === 0 ? 0 : 1)}M`
  } else if (compact && Math.abs(amount) >= 1_000) {
    text = `${(amount / 1_000).toFixed(amount % 1_000 === 0 ? 0 : 1)}K`
  } else {
    text = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount)
  }

  if (showSymbol) {
    const symbol = CURRENCY_SYMBOLS[currency] ?? currency
    // Myanmar convention puts the kyat symbol after the amount.
    text = currency === 'MMK' ? `${text} ${symbol}` : `${symbol}${text}`
  }

  return locale === 'my' && burmeseNumerals ? toMyanmarDigits(text) : text
}

export function formatNumber(value: number | null | undefined, decimals = 0, locale: Locale = 'en'): string {
  const text = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number(value ?? 0))
  return locale === 'my' ? toMyanmarDigits(text) : text
}

export function formatPercent(value: number | null | undefined, decimals = 1): string {
  return `${Number(value ?? 0).toFixed(decimals)}%`
}

export function formatDate(
  value: string | Date | null | undefined,
  locale: Locale = 'en',
  style: 'short' | 'long' | 'datetime' = 'short',
): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'

  const options: Intl.DateTimeFormatOptions =
    style === 'long'
      ? { year: 'numeric', month: 'long', day: 'numeric' }
      : style === 'datetime'
        ? { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }
        : { year: 'numeric', month: 'short', day: '2-digit' }

  return new Intl.DateTimeFormat(locale === 'my' ? 'my-MM' : 'en-GB', {
    ...options,
    timeZone: 'Asia/Yangon',
  }).format(date)
}

/** ISO date (yyyy-mm-dd) in the tenant's timezone — what the database expects. */
export function toISODate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Yangon' }).format(date)
}

export function dateRangeFromPreset(preset: 'today' | '7d' | '30d' | 'mtd' | 'ytd'): { from: string; to: string } {
  const now = new Date()
  const to = toISODate(now)
  const start = new Date(now)

  switch (preset) {
    case 'today': break
    case '7d': start.setDate(start.getDate() - 6); break
    case '30d': start.setDate(start.getDate() - 29); break
    case 'mtd': start.setDate(1); break
    case 'ytd': start.setMonth(0, 1); break
  }

  return { from: toISODate(start), to }
}

/**
 * Converts a document amount into the tenant's base currency.
 * Mirrors the `amount_base` generated column so client previews match the
 * numbers the database will store.
 */
export function toBaseCurrency(amount: number, exchangeRate: number): number {
  return Math.round(amount * exchangeRate * 10_000) / 10_000
}
