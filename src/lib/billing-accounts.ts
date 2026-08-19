/**
 * AD Digital Service's OWN receiving accounts — where subscribers send money.
 *
 * Every value comes from the environment. Nothing financial is hardcoded, and
 * there are deliberately NO default account numbers: a plausible-but-wrong
 * account number sends a shop owner's 180,000 MMK to a stranger, and the UI
 * looks completely normal while it happens. An unset value renders as "not
 * configured", which is recoverable; a fabricated one is not.
 *
 * `BILLING_ACCOUNTS_CONFIGURED` is DERIVED from what is actually present rather
 * than being a boolean someone remembers to flip. Fill the variables in and the
 * checkout warning disappears on the next build, with no code change.
 *
 * These are NEXT_PUBLIC_* because the checkout page is a client component and
 * has to render them — they are published information, not secrets. Next inlines
 * them at build time, which is why each is referenced as a literal
 * `process.env.NEXT_PUBLIC_FOO`; a dynamic lookup would never be replaced.
 *
 * See `.env.example` for the full list.
 */

/** Trims, and treats a leftover placeholder as absent rather than as a value. */
function env(value: string | undefined): string {
  const v = (value ?? '').trim()
  if (!v || v.startsWith('REPLACE_ME') || v.includes('your-')) return ''
  return v
}

function orNull(value: string | undefined): string | null {
  return env(value) || null
}

/* ── Company ──────────────────────────────────────────────────────────── */

export interface CompanyInfo {
  name: string
  /** Path under /public, or null to draw the inline monogram with no request. */
  logoSrc: string | null
  phone: string
  altPhone: string | null
  address: string
  website: string | null
  /** Where "Contact Admin Team" points; falls back to a tel: link on `phone`. */
  supportUrl: string | null
  supportLabelEn: string
  supportLabelMy: string
}

export const COMPANY: CompanyInfo = {
  // A company NAME is safe to default — nobody loses money over it.
  name: env(process.env.NEXT_PUBLIC_COMPANY_NAME) || 'AD Digital Service',
  logoSrc: '/logo.png',
  phone: env(process.env.NEXT_PUBLIC_COMPANY_PHONE),
  altPhone: orNull(process.env.NEXT_PUBLIC_COMPANY_ALT_PHONE),
  address: env(process.env.NEXT_PUBLIC_COMPANY_ADDRESS),
  website: orNull(process.env.NEXT_PUBLIC_COMPANY_WEBSITE),
  supportUrl: orNull(process.env.NEXT_PUBLIC_COMPANY_SUPPORT_URL),
  supportLabelEn: 'Contact Admin Team',
  supportLabelMy: 'အက်ဒမင်အဖွဲ့ကို ဆက်သွယ်ရန်',
}

/* ── Wallets & banks ──────────────────────────────────────────────────── */

export interface WalletAccount {
  id: 'kbz_pay' | 'wave_pay' | 'aya_pay' | 'cb_pay'
  labelEn: string
  labelMy: string
  phone: string
  accountName: string
  /** Path under /public (e.g. '/qr/kbzpay.png'). Null draws an inline SVG. */
  qrImage: string | null
}

export interface BankAccount {
  id: 'kbz_bank' | 'aya_bank' | 'cb_bank'
  bankEn: string
  bankMy: string
  accountNumber: string
  accountName: string
  branch?: string
}

/**
 * Only channels with BOTH a number and an account name survive.
 *
 * A half-configured channel is worse than an absent one: a row showing a number
 * with no name to check it against is exactly the ambiguity that gets money sent
 * to the wrong place.
 */
const ALL_WALLETS: WalletAccount[] = [
  {
    id: 'kbz_pay',
    labelEn: 'KBZPay',
    labelMy: 'KBZPay',
    phone: env(process.env.NEXT_PUBLIC_KBZPAY_NUMBER),
    accountName: env(process.env.NEXT_PUBLIC_KBZPAY_NAME),
    qrImage: orNull(process.env.NEXT_PUBLIC_KBZPAY_QR),
  },
  {
    id: 'wave_pay',
    labelEn: 'WavePay',
    labelMy: 'WavePay',
    phone: env(process.env.NEXT_PUBLIC_WAVEPAY_NUMBER),
    accountName: env(process.env.NEXT_PUBLIC_WAVEPAY_NAME),
    qrImage: orNull(process.env.NEXT_PUBLIC_WAVEPAY_QR),
  },
  {
    id: 'aya_pay',
    labelEn: 'AYA Pay',
    labelMy: 'AYA Pay',
    phone: env(process.env.NEXT_PUBLIC_AYAPAY_NUMBER),
    accountName: env(process.env.NEXT_PUBLIC_AYAPAY_NAME),
    qrImage: orNull(process.env.NEXT_PUBLIC_AYAPAY_QR),
  },
]

const ALL_BANKS: BankAccount[] = [
  {
    id: 'kbz_bank',
    bankEn: 'KBZ Bank',
    bankMy: 'ကမ္ဘောဇဘဏ်',
    accountNumber: env(process.env.NEXT_PUBLIC_KBZ_BANK_ACCOUNT),
    accountName: env(process.env.NEXT_PUBLIC_KBZ_BANK_NAME),
  },
  {
    id: 'aya_bank',
    bankEn: 'AYA Bank',
    bankMy: 'AYA ဘဏ်',
    accountNumber: env(process.env.NEXT_PUBLIC_AYA_BANK_ACCOUNT),
    accountName: env(process.env.NEXT_PUBLIC_AYA_BANK_NAME),
  },
  {
    id: 'cb_bank',
    bankEn: 'CB Bank',
    bankMy: 'CB ဘဏ်',
    accountNumber: env(process.env.NEXT_PUBLIC_CB_BANK_ACCOUNT),
    accountName: env(process.env.NEXT_PUBLIC_CB_BANK_NAME),
  },
]

export const WALLET_ACCOUNTS: WalletAccount[] = ALL_WALLETS.filter(
  (w) => w.phone && w.accountName,
)

export const BANK_ACCOUNTS: BankAccount[] = ALL_BANKS.filter(
  (b) => b.accountNumber && b.accountName,
)

/* ── Readiness ────────────────────────────────────────────────────────── */

/**
 * True when checkout can actually be completed: somewhere to send money, and a
 * way to reach a human when a transfer goes wrong.
 *
 * The support phone is part of the bar on purpose. Manual bank transfer fails in
 * ways only a person can resolve — wrong amount, wrong reference, a slip that
 * will not upload — and a payments page with no contact route strands whoever
 * hits one.
 */
export const BILLING_ACCOUNTS_CONFIGURED: boolean =
  (WALLET_ACCOUNTS.length > 0 || BANK_ACCOUNTS.length > 0) &&
  Boolean(COMPANY.phone) &&
  Boolean(COMPANY.address)

/** What is still missing, so the UI can say which rather than just "not ready". */
export function missingBillingConfig(): string[] {
  const missing: string[] = []
  if (!WALLET_ACCOUNTS.length && !BANK_ACCOUNTS.length) {
    missing.push('at least one wallet or bank account')
  }
  if (!COMPANY.phone) missing.push('NEXT_PUBLIC_COMPANY_PHONE')
  if (!COMPANY.address) missing.push('NEXT_PUBLIC_COMPANY_ADDRESS')
  return missing
}

/** Values written to `payment_submissions.payment_method`. */
export const PAYMENT_CHANNELS = [
  ...WALLET_ACCOUNTS.map((w) => ({ value: w.id, labelEn: w.labelEn, labelMy: w.labelMy })),
  ...BANK_ACCOUNTS.map((b) => ({ value: b.id, labelEn: b.bankEn, labelMy: b.bankMy })),
]
