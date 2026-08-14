/**
 * Supabase schema types.
 *
 * Regenerate after every migration with:
 *   npx supabase gen types typescript --project-id <ref> --schema public > src/types/database.ts
 *
 * This file is hand-maintained to match supabase/migrations/* until you wire up
 * generation in CI. The shapes below are the contract the whole app codes against.
 */

/**
 * NOTE: every shape below is a `type` alias, never an `interface`.
 * postgrest-js constrains a schema to `Record<string, unknown>`, and TypeScript
 * only gives implicit index signatures to type aliases — an interface silently
 * fails the constraint, collapsing `Schema` to `never` and turning every query
 * result into `never`. Keep them as aliases.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

/* ── Enums (mirror the PostgreSQL types) ─────────────────────────────────── */

export type BusinessType = 'retail' | 'service' | 'restaurant' | 'wholesale' | 'manufacturing' | 'other'
export type MembershipStatus = 'invited' | 'active' | 'suspended' | 'revoked'
export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense'
export type TransactionType = 'income' | 'expense' | 'transfer' | 'journal'
export type TransactionStatus = 'draft' | 'posted' | 'void'
export type InvoiceKind = 'sales' | 'purchase' | 'quote' | 'pos'
export type InvoiceStatus = 'draft' | 'issued' | 'partial' | 'paid' | 'overdue' | 'void'
export type PaymentMethod =
  | 'cash' | 'bank_transfer' | 'kbz_pay' | 'wave_pay' | 'aya_pay' | 'cb_pay' | 'card' | 'credit' | 'other'
export type ContactKind = 'customer' | 'supplier' | 'both'
/**
 * What kind of spending an expense account represents. Set on expense accounts
 * only — it is what the Add Expense dialog branches on to reveal salary or
 * office-specific fields, and what the dashboard breakdown groups by.
 */
export type ExpenseGroup = 'payroll' | 'office' | 'inventory' | 'other'
export type StockMoveKind = 'in' | 'out' | 'adjustment' | 'transfer' | 'sale' | 'purchase' | 'return' | 'wastage'
export type CustomFieldType =
  | 'text' | 'textarea' | 'number' | 'decimal' | 'date' | 'datetime' | 'boolean'
  | 'select' | 'multiselect' | 'email' | 'phone' | 'url' | 'barcode' | 'file' | 'currency'
export type CustomFieldEntity =
  | 'product' | 'contact' | 'transaction' | 'invoice' | 'invoice_item' | 'warehouse' | 'member'
export type AuditAction = 'insert' | 'update' | 'delete' | 'login' | 'export' | 'void' | 'restore'
export type CurrencyCode = 'MMK' | 'THB' | 'USD' | 'SGD' | 'CNY' | 'EUR'
export type Locale = 'my' | 'en'

/* ── Row shapes ──────────────────────────────────────────────────────────── */

export type TenantRow = {
  id: string
  name: string
  slug: string
  business_type: BusinessType
  legal_name: string | null
  tax_number: string | null
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  country_code: string
  timezone: string
  default_locale: Locale
  base_currency: CurrencyCode
  fiscal_year_start_month: number
  logo_url: string | null
  settings: TenantSettings
  subscription_plan: string
  /** 'trialing' | 'active' | 'pending_approval' | 'expired' | 'cancelled' — CHECK-constrained. */
  subscription_status: string
  trial_ends_at: string | null
  /** When a PAID plan lapses. Null while trialing; trial_ends_at governs then. */
  plan_expires_at: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export type TenantSettings = {
  receipt_footer_en?: string
  receipt_footer_my?: string
  receipt_width?: '58mm' | '80mm' | 'a4'
  default_tax_rate?: number
  show_tax_on_receipt?: boolean
  low_stock_alerts?: boolean
  allow_negative_stock?: boolean
  auto_exchange_rates?: boolean
  [key: string]: Json | undefined
}

export type UserRow = {
  id: string
  email: string | null
  phone: string | null
  full_name: string | null
  avatar_url: string | null
  locale: Locale
  last_tenant_id: string | null
  is_platform_admin: boolean
  created_at: string
  updated_at: string
}

export type RoleRow = {
  id: string
  tenant_id: string | null
  key: string
  name_en: string
  name_my: string | null
  description: string | null
  is_system: boolean
  is_owner_role: boolean
  rank: number
  created_at: string
  updated_at: string
}

export type PermissionRow = {
  key: string
  module: string
  label_en: string
  label_my: string | null
  description: string | null
  is_sensitive: boolean
}

export type MembershipRow = {
  id: string
  tenant_id: string
  user_id: string | null
  role_id: string
  status: MembershipStatus
  permission_overrides: { granted: string[]; revoked: string[] }
  warehouse_scope: string[]
  invited_email: string | null
  /** When `invite_token` stops being redeemable. Null when not an email invite. */
  invite_expires_at: string | null
  invited_phone: string | null
  invite_token: string | null
  invited_by: string | null
  invited_at: string
  joined_at: string | null
  revoked_at: string | null
  created_at: string
  updated_at: string
}

export type CurrencyRow = {
  code: CurrencyCode
  name: string
  name_my: string | null
  symbol: string
  decimal_digits: number
  is_active: boolean
}

export type ExchangeRateRow = {
  id: string
  tenant_id: string | null
  base_code: CurrencyCode
  quote_code: CurrencyCode
  rate: number
  rate_date: string
  source: string
  created_by: string | null
  created_at: string
}

export type AccountRow = {
  id: string
  tenant_id: string
  parent_id: string | null
  code: string
  name_en: string
  name_my: string | null
  type: AccountType
  subtype: string | null
  currency_code: CurrencyCode | null
  /** Expense accounts only; null on asset/liability/equity/income accounts. */
  expense_group: ExpenseGroup | null
  is_cash_like: boolean
  is_system: boolean
  is_active: boolean
  opening_balance: number
  description: string | null
  custom_fields: CustomFieldValues
  created_by: string | null
  created_at: string
  updated_at: string
}

export type ContactRow = {
  id: string
  tenant_id: string
  kind: ContactKind
  code: string | null
  name: string
  phone: string | null
  email: string | null
  address: string | null
  tax_number: string | null
  credit_limit: number
  payment_terms_days: number
  currency_code: CurrencyCode | null
  notes: string | null
  custom_fields: CustomFieldValues
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export type TransactionRow = {
  id: string
  tenant_id: string
  reference: string | null
  type: TransactionType
  status: TransactionStatus
  occurred_on: string
  contact_id: string | null
  account_id: string | null
  payment_account_id: string | null
  payment_method: PaymentMethod
  currency_code: CurrencyCode
  exchange_rate: number
  amount: number
  tax_amount: number
  /** Generated: amount × exchange_rate, in the tenant's base currency. */
  amount_base: number
  description: string | null
  attachment_url: string | null
  invoice_id: string | null
  custom_fields: CustomFieldValues
  voided_at: string | null
  voided_by: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type TransactionLineRow = {
  id: string
  tenant_id: string
  transaction_id: string
  account_id: string
  debit: number
  credit: number
  exchange_rate: number
  debit_base: number
  credit_base: number
  memo: string | null
  line_no: number
}

export type InvoiceRow = {
  id: string
  tenant_id: string
  kind: InvoiceKind
  status: InvoiceStatus
  /** Null while a draft; assigned by post_invoice() at issue time. */
  number: string | null
  contact_id: string | null
  contact_snapshot: ContactSnapshot
  warehouse_id: string | null
  issue_date: string
  due_date: string | null
  currency_code: CurrencyCode
  exchange_rate: number
  subtotal: number
  discount_amount: number
  tax_amount: number
  shipping_amount: number
  total: number
  paid_amount: number
  balance_due: number
  total_base: number
  payment_method: PaymentMethod | null
  notes: string | null
  terms: string | null
  custom_fields: CustomFieldValues
  issued_at: string | null
  voided_at: string | null
  voided_by: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  /** Only present via v_invoices, and only for holders of `reports.margin`. */
  cost_total?: number | null
}

export type ContactSnapshot = {
  name?: string
  phone?: string
  email?: string
  address?: string
  tax_number?: string
}

export type InvoiceItemRow = {
  id: string
  tenant_id: string
  invoice_id: string
  product_id: string | null
  line_no: number
  description: string
  sku: string | null
  quantity: number
  unit: string | null
  unit_price: number
  discount_amount: number
  tax_rate: number
  tax_amount: number
  line_total: number
  custom_fields: CustomFieldValues
  created_at: string
  /** Withheld from `authenticated`; present only on privileged reads. */
  unit_cost?: number
  line_cost?: number
}

export type PaymentRow = {
  id: string
  tenant_id: string
  invoice_id: string | null
  contact_id: string | null
  transaction_id: string | null
  account_id: string | null
  number: string | null
  direction: 'in' | 'out'
  method: PaymentMethod
  currency_code: CurrencyCode
  exchange_rate: number
  amount: number
  amount_base: number
  paid_on: string
  reference: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

/**
 * Staff on the payroll. Kept separate from `contacts` so that base salaries do
 * not surface in customer/supplier pickers, and so the whole table can sit
 * behind `employees.read`.
 */
export type EmployeeRow = {
  id: string
  tenant_id: string
  /** Payroll / staff ID. Unique per tenant when present. */
  code: string | null
  name: string
  name_my: string | null
  position: string | null
  phone: string | null
  /** Pre-fills the salary form; the transaction records what was actually paid. */
  base_salary: number
  payment_method: PaymentMethod
  is_active: boolean
  note: string | null
  custom_fields: CustomFieldValues
  created_by: string | null
  created_at: string
  updated_at: string
}

/**
 * The salary detail behind one expense transaction, 1:1 with it. The
 * transaction's `amount` remains the ledger figure; these columns explain how
 * it was composed.
 */
export type PayrollEntryRow = {
  transaction_id: string
  tenant_id: string
  employee_id: string
  /** Always the first day of the month being paid for. */
  pay_period: string
  base_amount: number
  bonus_amount: number
  deduction_amount: number
  note: string | null
  created_at: string
}

export type ExpenseBreakdownRow = {
  expense_group: ExpenseGroup
  total: number
  entry_count: number
}

/**
 * What the accept-invite page is allowed to know before anyone is signed in.
 * Deliberately free of tenant ids and inviter identity — see
 * `invitation_by_token` in the migration.
 */
export type InvitationLookup = {
  valid: boolean
  /** 'not_found' | 'already_used' | 'expired', or null when valid. */
  reason: string | null
  email: string | null
  tenant_name: string | null
  /**
   * The joining business's own locale. The invitee has no session, so this is
   * what `<I18nProvider>` on /accept-invite runs on.
   */
  tenant_locale: Locale | null
  role_name_en: string | null
  role_name_my: string | null
  expires_at: string | null
}

export type PaymentSubmissionRow = {
  id: string
  tenant_id: string
  plan: string
  amount: number
  currency_code: CurrencyCode
  payment_method: string
  sender_name: string | null
  tx_ref: string | null
  /** Object path inside the private `payment-slips` bucket, not a URL. */
  slip_path: string | null
  status: 'pending' | 'approved' | 'rejected'
  review_note: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  submitted_by: string | null
  created_at: string
}

export type WarehouseRow = {
  id: string
  tenant_id: string
  code: string
  name: string
  name_my: string | null
  address: string | null
  phone: string | null
  is_default: boolean
  is_active: boolean
  custom_fields: CustomFieldValues
  created_at: string
  updated_at: string
}

export type ProductCategoryRow = {
  id: string
  tenant_id: string
  parent_id: string | null
  name: string
  name_my: string | null
  sort_order: number
  color: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type ProductRow = {
  id: string
  tenant_id: string
  category_id: string | null
  sku: string | null
  barcode: string | null
  name: string
  name_my: string | null
  description: string | null
  unit: string
  track_inventory: boolean
  /** null unless the caller holds `products.read_cost` (masked by v_products). */
  cost_price: number | null
  selling_price: number
  wholesale_price: number | null
  currency_code: CurrencyCode
  tax_rate: number
  reorder_level: number
  reorder_quantity: number
  image_url: string | null
  custom_fields: CustomFieldValues
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

/** public.v_products — the read path for products. */
export type ProductView = ProductRow & {
  category_name: string | null
  stock_on_hand: number
  is_low_stock: boolean
}

export type StockLevelRow = {
  tenant_id: string
  product_id: string
  warehouse_id: string
  quantity: number
  reserved: number
  available: number
  avg_cost: number | null
  updated_at: string
}

export type StockMovementRow = {
  id: string
  tenant_id: string
  product_id: string
  warehouse_id: string
  kind: StockMoveKind
  quantity: number
  unit_cost: number
  reference_type: string | null
  reference_id: string | null
  invoice_id: string | null
  transfer_group: string | null
  notes: string | null
  custom_fields: CustomFieldValues
  occurred_at: string
  created_by: string | null
  created_at: string
}

/* ── Custom fields engine ────────────────────────────────────────────────── */

/** The JSONB payload stored on a row, keyed by CustomFieldRow.field_key. */
export type CustomFieldValue = string | number | boolean | string[] | null
export type CustomFieldValues = Record<string, CustomFieldValue>

export type CustomFieldOption = {
  value: string
  label_en: string
  label_my?: string
  color?: string
}

export type CustomFieldValidation = {
  min?: number
  max?: number
  minLength?: number
  maxLength?: number
  /** POSIX regex, enforced by the database trigger as well as the client. */
  regex?: string
}

export type CustomFieldRow = {
  id: string
  tenant_id: string
  entity: CustomFieldEntity
  field_key: string
  label_en: string
  label_my: string | null
  field_type: CustomFieldType
  is_required: boolean
  is_unique: boolean
  is_searchable: boolean
  show_in_list: boolean
  show_on_print: boolean
  default_value: Json | null
  options: CustomFieldOption[]
  validation: CustomFieldValidation
  help_text: string | null
  sort_order: number
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export type AuditLogRow = {
  id: number
  tenant_id: string
  user_id: string | null
  user_email: string | null
  action: AuditAction
  table_name: string
  record_id: string | null
  changed_keys: string[] | null
  old_data: Json | null
  new_data: Json | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

/* ── RPC return shapes ───────────────────────────────────────────────────── */

export type DashboardSummary = {
  sales_today: number
  sales_period: number
  invoice_count: number
  avg_ticket: number
  income_period?: number
  expense_period?: number
  net_period?: number
  gross_profit?: number
  margin_pct?: number
  receivable_total?: number
  payable_total?: number
  overdue_count?: number
  low_stock_count?: number
  product_count?: number
}

export type SalesTrendPoint = {
  day: string
  sales: number
  expenses: number
  orders: number
}

export type ProfitLossRow = {
  section: 'revenue' | 'expense' | 'cogs'
  account_id: string | null
  account_code: string
  account_name: string
  amount: number
}

export type CashFlowPoint = {
  period: string
  inflow: number
  outflow: number
  net: number
}

/** Metric names emitted by `report_sales` under section 'total'. */
export type SalesMetric =
  | 'gross' | 'discount' | 'tax' | 'shipping' | 'net' | 'cost' | 'profit'

/**
 * One flat table carries both halves of the sales report: the `total` rows are
 * the headline metrics, the `method` rows are cash received per payment method.
 */
export type SalesReportRow = {
  section: 'total' | 'method'
  /** A SalesMetric when section is 'total', otherwise a PaymentMethod. */
  label: string
  invoice_count: number
  amount: number
}

export type StockValuationRow = {
  product_id: string
  sku: string | null
  name: string
  name_my: string | null
  unit: string
  warehouse_id: string
  warehouse_name: string
  quantity: number
  avg_cost: number
  stock_value: number
  retail_value: number
}

/** Per-account income for a period. Mirrors {@link ExpenseRow}. */
export type IncomeRow = {
  account_id: string
  account_code: string
  account_name: string
  account_name_my: string | null
  entry_count: number
  /** Net of tax — tax collected on a sale was never the shop's money. */
  amount: number
  /** Percent of total income in the period, 0-100. */
  share: number
}

export type ExpenseRow = {
  account_id: string
  account_code: string
  account_name: string
  account_name_my: string | null
  entry_count: number
  amount: number
  /** Percent of total expenses in the period, 0-100. */
  share: number
}

export type ArApRow = {
  contact_id: string | null
  contact_name: string
  current_due: number
  days_1_30: number
  days_31_60: number
  days_61_90: number
  days_90_plus: number
  total_due: number
}

export type TopProductRow = {
  product_id: string | null
  name: string
  quantity: number
  revenue: number
}

/* ── Supabase client generic ─────────────────────────────────────────────── */

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

export type Database = {
  public: {
    Tables: {
      tenants: Table<TenantRow>
      users: Table<UserRow>
      roles: Table<RoleRow>
      permissions: Table<PermissionRow>
      roles_permissions: Table<{ role_id: string; permission_key: string; granted_at: string }>
      memberships: Table<MembershipRow>
      currencies: Table<CurrencyRow>
      exchange_rates: Table<ExchangeRateRow>
      accounts: Table<AccountRow>
      contacts: Table<ContactRow>
      transactions: Table<TransactionRow>
      transaction_lines: Table<TransactionLineRow>
      invoices: Table<InvoiceRow>
      invoice_items: Table<InvoiceItemRow>
      payments: Table<PaymentRow>
      employees: Table<EmployeeRow>
      payroll_entries: Table<PayrollEntryRow>
      payment_submissions: Table<PaymentSubmissionRow>
      warehouses: Table<WarehouseRow>
      product_categories: Table<ProductCategoryRow>
      products: Table<ProductRow>
      stock_levels: Table<StockLevelRow>
      stock_movements: Table<StockMovementRow>
      custom_fields_schema: Table<CustomFieldRow>
      audit_logs: Table<AuditLogRow>
      document_sequences: Table<{
        tenant_id: string; doc_type: string; prefix: string
        padding: number; next_number: number; period_key: string
      }>
    }
    Views: {
      v_products: { Row: ProductView; Relationships: [] }
      v_invoices: {
        Row: InvoiceRow & {
          contact_name: string | null
          contact_phone: string | null
          created_by_name: string | null
          days_overdue: number
        }
        Relationships: []
      }
      v_stock_levels: { Row: StockLevelRow; Relationships: [] }
      v_low_stock: {
        Row: {
          tenant_id: string; product_id: string; name: string; name_my: string | null
          sku: string | null; barcode: string | null; unit: string; reorder_level: number
          reorder_quantity: number
          /** The product's own `reorder_level`. No fallback is applied. */
          threshold: number
          /**
           * Summed across every warehouse, matching `v_products.stock_on_hand`.
           * One row per product — there is no warehouse breakdown here by design.
           */
          quantity: number
        }
        Relationships: []
      }
    }
    Functions: {
      create_tenant: {
        Args: {
          p_name: string
          p_business_type?: BusinessType
          p_base_currency?: CurrencyCode
          p_locale?: Locale
          p_phone?: string | null
        }
        Returns: TenantRow
      }
      next_document_number: { Args: { p_tenant_id: string; p_doc_type: string }; Returns: string }
      invite_member: {
        Args: {
          p_tenant_id: string
          p_role_key: string
          p_email?: string | null
          p_phone?: string | null
          p_warehouse_scope?: string[]
        }
        Returns: MembershipRow
      }
      set_member_status: { Args: { p_membership_id: string; p_status: MembershipStatus }; Returns: MembershipRow }
      reinvite_member: {
        Args: {
          p_tenant_id: string
          p_role_key: string
          p_email: string
          p_warehouse_scope?: string[]
        }
        Returns: MembershipRow
      }
      /** Callable by `anon` — the invitee has no session yet. */
      invitation_by_token: { Args: { p_token: string }; Returns: InvitationLookup[] }
      accept_invitation: { Args: { p_token: string; p_user_id: string }; Returns: MembershipRow }
      post_invoice: {
        Args: { p_invoice_id: string; p_paid_amount?: number; p_method?: PaymentMethod }
        Returns: InvoiceRow
      }
      void_invoice: { Args: { p_invoice_id: string; p_reason?: string }; Returns: InvoiceRow }
      has_permission: { Args: { p_tenant_id: string; p_permission: string }; Returns: boolean }
      dashboard_summary: { Args: { p_tenant_id: string; p_from?: string; p_to?: string }; Returns: DashboardSummary }
      report_sales_trend: { Args: { p_tenant_id: string; p_from?: string; p_to?: string }; Returns: SalesTrendPoint[] }
      report_profit_loss: { Args: { p_tenant_id: string; p_from: string; p_to: string }; Returns: ProfitLossRow[] }
      report_cash_flow: {
        Args: { p_tenant_id: string; p_from: string; p_to: string; p_bucket?: 'day' | 'week' | 'month' }
        Returns: CashFlowPoint[]
      }
      report_ar_ap: { Args: { p_tenant_id: string; p_kind?: 'receivable' | 'payable' }; Returns: ArApRow[] }
      report_sales: { Args: { p_tenant_id: string; p_from: string; p_to: string }; Returns: SalesReportRow[] }
      report_stock_valuation: {
        Args: { p_tenant_id: string; p_warehouse_id?: string | null }
        Returns: StockValuationRow[]
      }
      report_expenses: { Args: { p_tenant_id: string; p_from: string; p_to: string }; Returns: ExpenseRow[] }
      report_income: { Args: { p_tenant_id: string; p_from: string; p_to: string }; Returns: IncomeRow[] }
      void_transaction: { Args: { p_transaction_id: string; p_reason?: string | null }; Returns: TransactionRow }
      report_top_products: {
        Args: { p_tenant_id: string; p_from?: string; p_to?: string; p_limit?: number }
        Returns: TopProductRow[]
      }
      report_expense_breakdown: {
        Args: { p_tenant_id: string; p_from?: string; p_to?: string }
        Returns: ExpenseBreakdownRow[]
      }
      /** Creates the product and posts its opening stock in one transaction. */
      create_product_with_stock: {
        Args: {
          p_tenant_id: string
          p_product: Json
          p_quantity?: number
          p_warehouse_id?: string | null
          p_unit_cost?: number
        }
        Returns: string
      }
      /** Records the slip AND flips the tenant to pending_approval, atomically. */
      submit_payment_slip: {
        Args: {
          p_tenant_id: string
          p_plan: string
          p_amount: number
          p_payment_method: string
          p_sender_name?: string | null
          p_tx_ref?: string | null
          p_slip_path?: string | null
        }
        Returns: PaymentSubmissionRow
      }
      /** Platform admins only — approving your own payment would be a free plan. */
      review_payment_submission: {
        Args: {
          p_submission_id: string
          p_approve: boolean
          p_months?: number | null
          p_note?: string | null
        }
        Returns: PaymentSubmissionRow
      }
      record_salary_expense: {
        Args: {
          p_tenant_id: string
          p_account_id: string
          p_employee_id: string
          p_pay_period: string
          p_base: number
          p_bonus?: number
          p_deduction?: number
          p_payment_account_id?: string | null
          p_payment_method?: PaymentMethod
          p_occurred_on?: string
          p_description?: string | null
          p_note?: string | null
          p_exchange_rate?: number
        }
        Returns: TransactionRow
      }
    }
    Enums: {
      business_type: BusinessType
      membership_status: MembershipStatus
      account_type: AccountType
      transaction_type: TransactionType
      transaction_status: TransactionStatus
      invoice_kind: InvoiceKind
      invoice_status: InvoiceStatus
      payment_method: PaymentMethod
      contact_kind: ContactKind
      expense_group: ExpenseGroup
      stock_move_kind: StockMoveKind
      custom_field_type: CustomFieldType
      custom_field_entity: CustomFieldEntity
      audit_action: AuditAction
    }
    CompositeTypes: Record<string, never>
  }
}
