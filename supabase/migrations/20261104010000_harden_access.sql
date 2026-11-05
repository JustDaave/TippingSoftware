-- QuietTip: tighten access after the initial schema. All data remains fictional.
--
-- 1. Explicit grants for service_role. Newer Supabase projects can turn off "automatically
--    expose new tables", which leaves service_role without table privileges. The server
--    (secret key) needs them; anon and authenticated still get nothing.
-- 2. consume_rate_limit no longer runs as SECURITY DEFINER. Only service_role may call it,
--    and service_role already has the table privileges it needs, so elevated rights are
--    unnecessary in the exposed public schema.
-- 3. A confirmed (paid) tip is final, and a tip's receipt and amount cannot change.
-- 4. Tables and functions created later in public are not granted to anon/authenticated
--    by default.

-- ---------------------------------------------------------------- 1. server role grants

grant usage on schema public to service_role;
grant select, insert, update, delete on public.cafes, public.receipts, public.tip_attempts,
  public.feedback, public.rate_limits to service_role;
grant select on public.employee_demo_totals to service_role;

-- ---------------------------------------------------------------- 2. rate limiting

create or replace function public.consume_rate_limit(p_bucket text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_hits integer;
begin
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'invalid rate limit arguments';
  end if;

  insert into public.rate_limits as r (bucket, window_start, hits)
  values (p_bucket, now(), 1)
  on conflict (bucket) do update set
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds)
                        then now() else r.window_start end,
    hits         = case when r.window_start < now() - make_interval(secs => p_window_seconds)
                        then 1 else r.hits + 1 end
  returning hits into v_hits;

  -- Occasionally drop stale buckets so the table stays small.
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_hits <= p_limit;
end;
$$;

revoke execute on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

-- ---------------------------------------------------------------- 3. tip integrity

create or replace function public.guard_tip_attempt_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.receipt_id is distinct from old.receipt_id or new.amount_cents is distinct from old.amount_cents then
    raise exception 'tip receipt and amount cannot change';
  end if;
  if old.status = 'paid' and new.status is distinct from 'paid' then
    raise exception 'a confirmed tip cannot change status';
  end if;
  if old.stripe_checkout_session_id is not null
     and new.stripe_checkout_session_id is distinct from old.stripe_checkout_session_id then
    raise exception 'checkout session cannot change';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_tip_attempt_update() from public, anon, authenticated;

create trigger tip_attempts_guard_update
  before update on public.tip_attempts
  for each row execute function public.guard_tip_attempt_update();

-- Speeds up the per-receipt "already tipped?" lookup used when a receipt page is refreshed.
create index tip_attempts_receipt_paid_idx on public.tip_attempts (receipt_id) where status = 'paid';

-- ---------------------------------------------------------------- 4. safer defaults

-- Applies to objects created later by the role running migrations (postgres).
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
