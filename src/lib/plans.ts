import type { Locale } from '@/types'

/**
 * The plans on offer.
 *
 * Kept as data rather than markup so the paywall, a future checkout step and any
 * admin tooling all quote the same prices. Amounts are whole MMK — kyat has no
 * subunit in practice.
 */
export interface Plan {
  id: 'starter' | 'pro' | 'business'
  nameEn: string
  nameMy: string
  /** Total charged up front, in MMK. */
  price: number
  months: number
  /** Shown as a saving against `starter` × months. Null on the baseline plan. */
  savingPct: number | null
  popular?: boolean
  featuresEn: string[]
  featuresMy: string[]
}

const STARTER_MONTHLY = 35_000

export const PLANS: Plan[] = [
  {
    id: 'starter',
    nameEn: 'Starter',
    nameMy: 'စတင်ရန်',
    price: STARTER_MONTHLY,
    months: 1,
    savingPct: null,
    featuresEn: ['1 store', '2 staff accounts', 'Unlimited invoices', 'Daily reports'],
    featuresMy: ['ဆိုင် ၁ ခု', 'ဝန်ထမ်း ၂ ယောက်', 'ပြေစာအကန့်အသတ်မရှိ', 'နေ့စဉ်အစီရင်ခံစာ'],
  },
  {
    id: 'pro',
    nameEn: 'Pro',
    nameMy: 'ပရို',
    price: 180_000,
    months: 6,
    // 35,000 × 6 = 210,000 → 180,000 is 14.3%, rounded for display.
    savingPct: 15,
    popular: true,
    featuresEn: ['1 store', '5 staff accounts', 'Advanced analytics', 'Priority support'],
    featuresMy: ['ဆိုင် ၁ ခု', 'ဝန်ထမ်း ၅ ယောက်', 'အဆင့်မြင့်ခွဲခြမ်းစိတ်ဖြာမှု', 'ဦးစားပေးအကူအညီ'],
  },
  {
    id: 'business',
    nameEn: 'Business',
    nameMy: 'စီးပွားရေး',
    price: 320_000,
    months: 12,
    // 35,000 × 12 = 420,000 → 320,000 is 23.8%, rounded for display.
    savingPct: 25,
    featuresEn: [
      'Unlimited staff',
      'Multi-branch support',
      'Custom export',
      'Dedicated account manager',
    ],
    featuresMy: [
      'ဝန်ထမ်းအကန့်အသတ်မရှိ',
      'ဆိုင်ခွဲများ ပံ့ပိုးမှု',
      'စိတ်ကြိုက် Export',
      'သီးသန့်အကူအညီပေးသူ',
    ],
  },
]

export function planName(plan: Plan, locale: Locale): string {
  return locale === 'my' ? plan.nameMy : plan.nameEn
}

export function planFeatures(plan: Plan, locale: Locale): string[] {
  return locale === 'my' ? plan.featuresMy : plan.featuresEn
}

/** Effective monthly cost, for the "per month" line under the headline price. */
export function monthlyEquivalent(plan: Plan): number {
  return Math.round(plan.price / plan.months)
}
