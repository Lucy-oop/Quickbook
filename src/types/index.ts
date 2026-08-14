import type {
  CurrencyCode, InvoiceKind, Locale, MembershipRow, MembershipStatus,
  PaymentMethod, ProductView, RoleRow, TenantRow, UserRow, CustomFieldValues,
} from './database'

export * from './database'

/* ── Permissions ─────────────────────────────────────────────────────────── */

/**
 * Every permission key in public.permissions. Keep this union in sync with
 * supabase/migrations/20260810000700_seed.sql — it is what `usePermission()`
 * and every `<Can>` guard are typed against.
 */
export const PERMISSIONS = [
  'dashboard.view',

  'members.read', 'members.invite', 'members.manage',

  'settings.manage', 'settings.custom_fields', 'currency.manage',

  'accounts.read', 'accounts.manage',

  'transactions.create', 'transactions.read', 'transactions.read_own',
  'transactions.update', 'transactions.update_own', 'transactions.delete',

  'invoices.create', 'invoices.read', 'invoices.read_own',
  'invoices.update', 'invoices.delete', 'invoices.void',

  'payments.create', 'payments.read', 'payments.manage',

  'contacts.read', 'contacts.manage', 'contacts.delete',

  'products.read', 'products.read_cost', 'products.manage', 'products.delete',

  'inventory.read', 'inventory.adjust', 'inventory.manage_locations',

  // Payroll is sensitive: recording an expense does not imply the right to read
  // what the shop pays its staff.
  'employees.read', 'employees.manage',

  'reports.sales', 'reports.pnl', 'reports.margin',
  'reports.cashflow', 'reports.ar_ap', 'reports.inventory',

  'pos.use', 'audit.read',
] as const

export type Permission = (typeof PERMISSIONS)[number]

export type SystemRoleKey = 'owner' | 'admin' | 'manager' | 'accountant' | 'cashier' | 'viewer'

/* ── Session / tenant context ────────────────────────────────────────────── */

/**
 * Whether the business may use the app right now.
 *
 *   ok               paid and current
 *   trialing         inside the free period; `trialDaysLeft` is set
 *   pending_approval a payment is awaiting review — access CONTINUES, because a
 *                    shop that has paid must not be punished for our queue
 *   expired          trial or plan has lapsed; the app is gated
 */
export type AccessState = 'ok' | 'trialing' | 'pending_approval' | 'expired'

export interface SubscriptionAccess {
  state: AccessState
  /** True only for `expired` — the single thing guards should branch on. */
  isExpired: boolean
  /** Whole days remaining, floored, and never negative. Null when not trialing. */
  trialDaysLeft: number | null
  /** Whichever date governs: trial_ends_at while trialing, else plan_expires_at. */
  endsAt: string | null
}

/**
 * Everything the app needs to render a screen for one user in one business.
 * Resolved once per request in `getSessionContext()` and cached by React Query
 * on the client.
 */
export interface SessionContext {
  user: UserRow
  tenant: TenantRow
  membership: MembershipRow
  role: RoleRow
  /** Effective set: role grants + per-user grants − per-user revokes. */
  permissions: Permission[]
  isOwner: boolean
  /** Empty array means "every warehouse". */
  warehouseScope: string[]
  locale: Locale
  /** Resolved once here so the guard, the banner and the paywall agree. */
  access: SubscriptionAccess
}

export interface TenantOption {
  tenant: Pick<TenantRow, 'id' | 'name' | 'slug' | 'logo_url' | 'base_currency' | 'business_type'>
  role: Pick<RoleRow, 'key' | 'name_en' | 'name_my'>
  status: MembershipStatus
}

/* ── POS / cart ──────────────────────────────────────────────────────────── */

export interface CartLine {
  /** Stable client-side key; a product can appear twice with different notes. */
  lineId: string
  productId: string | null
  name: string
  sku: string | null
  unit: string
  quantity: number
  unitPrice: number
  discount: number
  taxRate: number
  customFields: CustomFieldValues
  /** Populated only when the cashier holds `products.read_cost`. */
  unitCost?: number | null
}

export interface CartTotals {
  subtotal: number
  discount: number
  tax: number
  total: number
  itemCount: number
}

export interface CheckoutPayload {
  kind: InvoiceKind
  contactId: string | null
  warehouseId: string | null
  currency: CurrencyCode
  exchangeRate: number
  method: PaymentMethod
  paidAmount: number
  notes?: string
  lines: CartLine[]
  customFields: CustomFieldValues
  /**
   * Invoice-level discount, on top of any per-line discounts. Must be sent:
   * post_invoice() computes the charge as
   *   sum(lines) - invoices.discount_amount + tax + invoices.shipping_amount
   * so a discount left on the client is shown to the customer and then never
   * applied to what they actually pay.
   */
  orderDiscount?: number
  /** Delivery / shipping fee added after discount. */
  shipping?: number
  /** Defaults to today; the manual voucher form lets the user back-date. */
  issueDate?: string
  dueDate?: string | null
}

/* ── Misc UI ─────────────────────────────────────────────────────────────── */

export interface DateRange {
  from: string
  to: string
}

export interface Paginated<T> {
  rows: T[]
  count: number
  page: number
  pageSize: number
}

export type ProductListItem = ProductView

export interface QuickActionResult {
  ok: boolean
  message?: string
  id?: string
}
