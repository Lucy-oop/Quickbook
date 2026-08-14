-- =============================================================================
--  review_payment_submission — accept a status string as well as a boolean
--
--  The original takes `p_approve boolean`. Anyone reviewing a payment in the SQL
--  editor reaches for the word, not the boolean:
--
--    select public.review_payment_submission('<id>', 'rejected', 'အကြောင်းပြချက်');
--
--  which fails with a type error. Rather than let that be a footgun during a
--  review — the moment when someone is deciding whether a shop keeps working —
--  this overload accepts 'approved' / 'rejected' and delegates.
--
--  The status word is validated, not coerced. `to_boolean('yes')`-style leniency
--  would let a typo silently approve a payment.
-- =============================================================================
create or replace function public.review_payment_submission(
  p_submission_id uuid,
  p_status        text,
  p_note          text default null,
  p_months        int default null
)
returns public.payment_submissions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text := lower(btrim(coalesce(p_status, '')));
begin
  if v_status not in ('approved','approve','rejected','reject') then
    raise exception
      'p_status must be ''approved'' or ''rejected'' (got %). Nothing was changed.', p_status
      using errcode = '22023';
  end if;

  return public.review_payment_submission(
    p_submission_id,
    v_status in ('approved','approve'),
    p_months,
    p_note
  );
end;
$$;

grant execute on function public.review_payment_submission(uuid, text, text, int) to authenticated;

comment on function public.review_payment_submission(uuid, text, text, int) is
  'String-status wrapper. Both forms are equivalent: ("id", true, …) and ("id", ''approved'', …).';
