-- =============================================================================
--  VOID A TRANSACTION
--
--  A posted income or expense entry was permanent — a mistyped amount or the
--  wrong category could not be corrected from the UI at all.
--
--  Void-and-re-enter rather than edit-in-place: an edit rewrites a posted ledger
--  entry, so last month's P&L can change after it has already been read and
--  acted on. Voiding leaves the original in place, marked, and adds a corrected
--  entry beside it — both visible, both audited. `void_invoice` already works
--  this way, so the two paths behave alike.
--
--  Every report filters `status = 'posted'`, so a voided row leaves the P&L,
--  cash flow, income/expense reports and dashboard_summary with no changes
--  needed to any of them.
-- =============================================================================
create or replace function public.void_transaction(
  p_transaction_id uuid,
  p_reason         text default null
)
returns public.transactions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_txn public.transactions;
  v_uid uuid := auth.uid();
begin
  select * into v_txn from public.transactions where id = p_transaction_id for update;
  if not found then
    raise exception 'Transaction not found' using errcode = 'P0002';
  end if;

  if not public.is_tenant_member(v_txn.tenant_id) then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  -- Either blanket delete rights, or it is your own entry and you may amend
  -- your own. Mirrors how transactions_update scopes edits.
  if not (
    public.has_permission(v_txn.tenant_id, 'transactions.delete')
    or (v_txn.created_by = v_uid and public.has_permission(v_txn.tenant_id, 'transactions.update_own'))
  ) then
    raise exception 'You do not have permission to void this entry' using errcode = '42501';
  end if;

  if v_txn.status = 'void' then
    raise exception 'This entry is already void' using errcode = '22023';
  end if;

  -- An invoice-linked transaction is one half of a document that also moved
  -- stock and receivables. Voiding it here would leave the invoice issued, the
  -- stock deducted and the balance outstanding, with the revenue gone.
  if v_txn.invoice_id is not null then
    raise exception
      'This entry belongs to an invoice. Void the invoice instead, so stock and the balance are reversed with it.'
      using errcode = '22023';
  end if;

  update public.transactions
     set status      = 'void',
         voided_at   = now(),
         voided_by   = v_uid,
         description = case
                         when coalesce(p_reason, '') = '' then description
                         else coalesce(description || ' · ', '') || 'Void: ' || p_reason
                       end,
         updated_at  = now()
   where id = p_transaction_id
  returning * into v_txn;

  return v_txn;
end;
$$;

grant execute on function public.void_transaction(uuid, text) to authenticated;

-- The RPC is SECURITY DEFINER and does its own permission checks, but the UPDATE
-- it performs still has to satisfy RLS for the calling role in the general case.
-- `transactions_update` covers `transactions.update` / `update_own`; voiding is
-- allowed for `transactions.delete` holders too, which that policy does not
-- mention. Rather than widen the policy — which would also permit ordinary edits —
-- the function runs as its owner and the guards above are the gate.
