/**
 * Explicit column lists for tables whose SELECT grant is column-scoped.
 *
 * `invoice_items` deliberately withholds `unit_cost` and `line_cost` from
 * `authenticated` (see the grants in 20260810000500_rls.sql) so a cashier
 * cannot read margin off the base table. PostgREST expands `select('*')` to
 * every column, including those two, and Postgres then refuses the whole
 * statement with 42501 — so a `select('*')` here fails for *everyone*, owners
 * included, and the invoice renders with no line items at all.
 *
 * Cost is not lost, just gated: it comes from the SECURITY DEFINER helper
 * `masked_invoice_cost()`, which checks `reports.margin` for itself.
 *
 * Declared `as const` on one line on purpose — supabase-js derives the row type
 * from the select *literal*, so a runtime-built string degrades the result to
 * `GenericStringError[]`.
 */
export const INVOICE_ITEM_COLUMNS =
  'id,tenant_id,invoice_id,product_id,line_no,description,sku,quantity,unit,unit_price,discount_amount,tax_rate,tax_amount,line_total,custom_fields,created_at' as const
