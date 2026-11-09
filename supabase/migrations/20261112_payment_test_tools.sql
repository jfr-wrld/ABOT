-- ABOT // payment test tools for the Midtrans Sandbox. Safe to run more than once.
-- Apply after 20261111_midtrans_payments.sql.
--
-- Mission Control can settle, fail, expire or refund an order without paying in the simulator.
-- It runs the same grant and revoke functions a real Midtrans notification does, so the app sees
-- exactly what it would after a real payment. Two locks keep it out of real money:
--   * admins only (is_abot_admin), and
--   * only while app_remote_config.payments_sandbox is true. Set it to false when going live:
--       update public.app_remote_config set payments_sandbox = false;

alter table public.app_remote_config add column if not exists payments_sandbox boolean not null default true;

create or replace function public.admin_simulate_payment(p_order_id text, p_outcome text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare done boolean;
begin
  if not public.is_abot_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  if not (select payments_sandbox from public.app_remote_config where id = 'global') then
    raise exception 'test payments are off (payments_sandbox = false)' using errcode = '42501';
  end if;
  if p_outcome = 'paid' then
    done := public.abot_order_paid(p_order_id, 'simulated', 'sim-' || p_order_id);
  elsif p_outcome = 'refunded' then
    done := public.abot_order_reversed(p_order_id);
  elsif p_outcome in ('failed', 'expired') then
    done := public.abot_order_closed(p_order_id, p_outcome);
  else
    raise exception 'bad outcome' using errcode = '22023';
  end if;
  if done then
    insert into public.payment_events (order_id, transaction_status, transaction_id, payload)
    values (
      p_order_id,
      'simulated_' || p_outcome,
      'sim-' || extract(epoch from clock_timestamp())::text,
      jsonb_build_object('simulated', true, 'outcome', p_outcome, 'by', auth.jwt() ->> 'email')
    );
  end if;
  return done;
end;
$$;
revoke all on function public.admin_simulate_payment(text, text) from public, anon;
grant execute on function public.admin_simulate_payment(text, text) to authenticated;
