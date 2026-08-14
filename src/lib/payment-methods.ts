import type { PaymentMethod } from '@/types'

/**
 * The tender types Myanmar SMEs actually use, in the order a shop owner expects
 * to see them.
 *
 * `payment_method` on a transaction is *how* the money moved (cash, bank, a
 * mobile wallet). That is a different question from `payment_account_id`, which
 * is *which* of the tenant's cash/bank accounts it moved through — one wallet
 * transfer can land in any of several accounts.
 *
 * NOTE: pos-terminal, voucher-form and invoice-detail each still carry their own
 * copy of this list. They can adopt this one; it was not changed here to keep
 * that refactor out of an unrelated change.
 */
export const PAYMENT_METHODS: { value: PaymentMethod; labelEn: string; labelMy: string }[] = [
  { value: 'cash', labelEn: 'Cash', labelMy: 'ငွေသား' },
  { value: 'bank_transfer', labelEn: 'Bank transfer', labelMy: 'ဘဏ်လွှဲ' },
  { value: 'kbz_pay', labelEn: 'KBZPay', labelMy: 'KBZPay' },
  { value: 'wave_pay', labelEn: 'WavePay', labelMy: 'WavePay' },
  { value: 'aya_pay', labelEn: 'AYA Pay', labelMy: 'AYA Pay' },
  { value: 'cb_pay', labelEn: 'CB Pay', labelMy: 'CB Pay' },
  { value: 'card', labelEn: 'Card', labelMy: 'ကတ်' },
  { value: 'other', labelEn: 'Other', labelMy: 'အခြား' },
]
