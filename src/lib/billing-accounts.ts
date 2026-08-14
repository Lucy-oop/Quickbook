/**
 * Quick Cash's OWN receiving accounts — where subscribers send money.
 *
 * These are placeholders. They are deliberately not filled in with plausible
 * numbers: a realistic-looking but wrong account number would send a shop
 * owner's 180,000 MMK to a stranger, and nothing in the UI would look amiss.
 * Replace every `REPLACE_ME` before this reaches a real customer.
 *
 * Not in the database because they belong to the platform, not to any tenant,
 * and not in env vars because they are public information the page has to render
 * and someone in support needs to be able to read.
 */

export interface WalletAccount {
  id: 'kbz_pay' | 'wave_pay' | 'aya_pay' | 'cb_pay'
  labelEn: string
  labelMy: string
  /** The number the customer transfers to. */
  phone: string
  accountName: string
  /** Path under /public. Null renders an "add your QR" placeholder. */
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
 * Who the money is going to.
 *
 * Shown at the top of checkout so the shop owner can see they are paying a real
 * business before transferring, and reach someone if the transfer goes wrong.
 * Every field below is still a placeholder — see the note at the top of the file.
 */
export interface CompanyInfo {
  name: string
  /** Shown next to the instructions and used for the tel: link. */
  phone: string
  /** Second number, e.g. Viber-only. Null hides the row. */
  altPhone: string | null
  address: string
  website: string | null
  /** Where "Contact Admin Team" points. A viber:// or https://t.me/ link works too. */
  supportUrl: string | null
  supportLabelEn: string
  supportLabelMy: string
}

export const COMPANY: CompanyInfo = {
  name: 'AD Digital Service',
  phone: 'REPLACE_ME — 09-XXXXXXXXX',
  altPhone: null,
  address: 'REPLACE_ME — address, township, city',
  website: null,
  // Null falls back to a tel: link built from `phone`, so support is always
  // reachable even before this is filled in.
  supportUrl: null,
  supportLabelEn: 'Contact Admin Team',
  supportLabelMy: 'အက်ဒမင်အဖွဲ့ကို ဆက်သွယ်ရန်',
}

/**
 * True only when every receiving detail AND the company block are real.
 *
 * Left `false` deliberately: while it is false the checkout page shows a warning
 * banner instead of presenting placeholder account numbers as though they were
 * real. Flip it in the same commit that fills the values in — not before.
 */
export const BILLING_ACCOUNTS_CONFIGURED = false

export const WALLET_ACCOUNTS: WalletAccount[] = [
  {
    id: 'kbz_pay',
    labelEn: 'KBZPay',
    labelMy: 'KBZPay',
    phone: 'REPLACE_ME — 09-XXXXXXXXX',
    accountName: 'REPLACE_ME — Quick Cash',
    qrImage: null,
  },
  {
    id: 'wave_pay',
    labelEn: 'WavePay',
    labelMy: 'WavePay',
    phone: 'REPLACE_ME — 09-XXXXXXXXX',
    accountName: 'REPLACE_ME — Quick Cash',
    qrImage: null,
  },
  {
    id: 'aya_pay',
    labelEn: 'AYA Pay',
    labelMy: 'AYA Pay',
    phone: 'REPLACE_ME — 09-XXXXXXXXX',
    accountName: 'REPLACE_ME — Quick Cash',
    qrImage: null,
  },
]

export const BANK_ACCOUNTS: BankAccount[] = [
  {
    id: 'kbz_bank',
    bankEn: 'KBZ Bank',
    bankMy: 'ကမ္ဘောဇဘဏ်',
    accountNumber: 'REPLACE_ME',
    accountName: 'REPLACE_ME — Quick Cash',
  },
  {
    id: 'aya_bank',
    bankEn: 'AYA Bank',
    bankMy: 'AYA ဘဏ်',
    accountNumber: 'REPLACE_ME',
    accountName: 'REPLACE_ME — Quick Cash',
  },
  {
    id: 'cb_bank',
    bankEn: 'CB Bank',
    bankMy: 'CB ဘဏ်',
    accountNumber: 'REPLACE_ME',
    accountName: 'REPLACE_ME — Quick Cash',
  },
]

/** Values written to `payment_submissions.payment_method`. */
export const PAYMENT_CHANNELS = [
  ...WALLET_ACCOUNTS.map((w) => ({ value: w.id, labelEn: w.labelEn, labelMy: w.labelMy })),
  ...BANK_ACCOUNTS.map((b) => ({ value: b.id, labelEn: b.bankEn, labelMy: b.bankMy })),
] as const
