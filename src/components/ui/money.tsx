import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { CurrencyCode, Locale } from '@/types'

/**
 * A money figure with its unit de-emphasised: `540,000` carries the weight, `K`
 * recedes.
 *
 * The split is done here rather than by callers because the unit's *position*
 * is a currency convention, not a styling choice — MMK puts the symbol after
 * the amount, USD and EUR put it before. Reading `formatMoney`'s output back
 * apart would mean re-deriving that rule at every call site.
 */
export function Money({
  value,
  currency,
  locale,
  className,
  unitClassName,
  compact = false,
}: {
  value: number | null | undefined
  currency: CurrencyCode
  locale: Locale
  /** Applied to the figure. Callers set the size and weight. */
  className?: string
  unitClassName?: string
  compact?: boolean
}) {
  const amount = formatMoney(value, { currency, locale, compact, showSymbol: false })
  const unit = UNIT[currency] ?? currency
  const unitAfter = currency === 'MMK'

  const unitEl = (
    <span
      className={cn(
        'text-sm font-medium text-muted-foreground',
        unitAfter ? 'ml-1.5' : 'mr-1',
        unitClassName,
      )}
    >
      {unit}
    </span>
  )

  return (
    <span className={cn('inline-flex items-baseline tabular-nums', className)}>
      {!unitAfter && unitEl}
      <span>{amount}</span>
      {unitAfter && unitEl}
    </span>
  )
}

/**
 * Deliberately not `formatMoney`'s symbol table: that one is for inline prose
 * where "$" must be unambiguous. Here the unit is a caption beside a large
 * figure, so the short form Myanmar shopkeepers actually write ("K") is clearer
 * than the Unicode kyat sign.
 */
const UNIT: Partial<Record<CurrencyCode, string>> = {
  MMK: 'K',
  USD: '$',
  THB: '฿',
  SGD: 'S$',
  CNY: '¥',
  EUR: '€',
}
