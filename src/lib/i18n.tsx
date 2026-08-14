'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { en } from '@/messages/en'
import { my } from '@/messages/my'
import type { Locale } from '@/types/database'

export type Messages = typeof en
type Dict = Record<string, string>

const DICTS: Record<Locale, Dict> = {
  en: en as unknown as Dict,
  my: my as unknown as Dict,
}

interface I18nValue {
  locale: Locale
  /** t('pos.checkout') — falls back to English, then to the key itself. */
  t: (key: keyof Messages | string, vars?: Record<string, string | number>) => string
  isMyanmar: boolean
}

const I18nCtx = createContext<I18nValue | null>(null)

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo<I18nValue>(() => {
    const dict = DICTS[locale] ?? DICTS.en
    return {
      locale,
      isMyanmar: locale === 'my',
      t: (key, vars) => {
        const raw = dict[key as string] ?? DICTS.en[key as string] ?? (key as string)
        if (!vars) return raw
        return raw.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? `{${name}}`))
      },
    }
  }, [locale])

  return (
    <I18nCtx.Provider value={value}>
      {/* Padauk / Noto Sans Myanmar renders Unicode Burmese correctly; the
          `lang` attribute also drives line-breaking for Myanmar script. */}
      <div lang={locale} className={locale === 'my' ? 'font-myanmar' : undefined}>
        {children}
      </div>
    </I18nCtx.Provider>
  )
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nCtx)
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>')
  return ctx
}

/** Picks the Burmese column when the UI is in Myanmar and a value exists. */
export function localized(
  locale: Locale,
  en: string | null | undefined,
  my: string | null | undefined,
): string {
  if (locale === 'my') return my?.trim() || en?.trim() || ''
  return en?.trim() || my?.trim() || ''
}
