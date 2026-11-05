-- QuietTip initial schema.
-- All data in this project is fictional. Money is stored as integer cents.
--
-- Access model: the browser never talks to Supabase directly. Every read and write goes
-- through Next.js server code using the secret (service role) key. RLS is enabled on every
-- table with NO policies, and table privileges are revoked from anon/authenticated, so the
-- public anon key cannot list receipts, read feedback, change payment status, or edit totals.

create extension if not exists pgcrypto with schema extensions;

-- Random, URL-safe bearer token: 24 random bytes -> 32 base64url characters (192 bits).
create or replace function public.new_receipt_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');
$$;

-- ---------------------------------------------------------------- cafes

create table public.cafes (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique check (slug ~ '^[a-z0-9-]{1,64}$'),
  name                text not null check (char_length(name) between 1 and 120),
  is_fictional        boolean not null default true check (is_fictional),
  employee_count      integer not null check (employee_count between 1 and 50),
  -- Fictional pre-existing pool shown in the employee demo, kept separate from test tips.
  starting_pool_cents integer not null default 0 check (starting_pool_cents >= 0),
  policy_text         text not null,
  created_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------- receipts

-- A receipt represents a purchase that is ALREADY PAID. There is no POS integration.
create table public.receipts (
  id             uuid primary key default gen_random_uuid(),
  cafe_id        uuid not null references public.cafes (id) on delete cascade,
  access_token   text not null unique default public.new_receipt_token()
                   check (access_token ~ '^[A-Za-z0-9_-]{32}$'),
  reference      text not null check (char_length(reference) between 1 and 32),
  purchased_at   timestamptz not null,
  items          jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  subtotal_cents integer not null check (subtotal_cents >= 0),
  tax_cents      integer not null check (tax_cents >= 0),
  total_cents    integer not null check (total_cents = subtotal_cents + tax_cents),
  is_fictional   boolean not null default true check (is_fictional),
  created_at     timestamptz not null default now(),
  unique (cafe_id, reference)
);

-- ---------------------------------------------------------------- tip attempts

-- One row per Stripe Checkout Session. Only rows with status 'paid' count toward totals.
-- "No tip" and "Finish without tipping" never create a row.
create table public.tip_attempts (
  id                         uuid primary key default gen_random_uuid(),
  receipt_id                 uuid not null references public.receipts (id) on delete cascade,
  amount_cents               integer not null check (amount_cents between 50 and 10000),
  currency                   text not null default 'usd' check (currency = 'usd'),
  status                     text not null default 'pending'
                               check (status in ('pending', 'paid', 'expired', 'failed')),
  stripe_checkout_session_id text unique,
  stripe_livemode            boolean check (stripe_livemode is distinct from true),
  created_at                 timestamptz not null default now(),
  confirmed_at               timestamptz,
  check ((status = 'paid') = (confirmed_at is not null))
);

create index tip_attempts_receipt_id_idx on public.tip_attempts (receipt_id);

-- ---------------------------------------------------------------- feedback

-- Optional and independent of tipping. Not readable by any public role.
create table public.feedback (
  id            uuid primary key default gen_random_uuid(),
  receipt_id    uuid not null references public.receipts (id) on delete cascade,
  worked_well   text check (char_length(worked_well) <= 1000),
  could_improve text check (char_length(could_improve) <= 1000),
  created_at    timestamptz not null default now(),
  check (coalesce(btrim(worked_well), '') <> '' or coalesce(btrim(could_improve), '') <> '')
);

create index feedback_receipt_id_idx on public.feedback (receipt_id);

-- ---------------------------------------------------------------- rate limiting

-- Fixed-window counters for public write endpoints. Keys are hashed by the server;
-- raw IP addresses are never stored.
create table public.rate_limits (
  bucket       text primary key check (char_length(bucket) <= 200),
  window_start timestamptz not null,
  hits         integer not null
);

create or replace function public.consume_rate_limit(p_bucket text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hits integer;
begin
  insert into public.rate_limits as r (bucket, window_start, hits)
  values (p_bucket, now(), 1)
  on conflict (bucket) do update set
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds)
                        then now() else r.window_start end,
    hits         = case when r.window_start < now() - make_interval(secs => p_window_seconds)
                        then 1 else r.hits + 1 end
  returning hits into v_hits;
  return v_hits <= p_limit;
end;
$$;

-- ---------------------------------------------------------------- aggregate demo view

-- Aggregate-only totals for the employee transparency demo. No receipt, tip, or feedback rows.
create view public.employee_demo_totals
with (security_invoker = true)
as
select
  c.slug,
  c.name,
  c.employee_count,
  c.starting_pool_cents,
  coalesce(sum(t.amount_cents) filter (where t.status = 'paid'), 0)::integer as confirmed_test_tips_cents
from public.cafes c
left join public.receipts r on r.cafe_id = c.id
left join public.tip_attempts t on t.receipt_id = r.id
group by c.id;

-- ---------------------------------------------------------------- lock down public roles

alter table public.cafes        enable row level security;
alter table public.receipts     enable row level security;
alter table public.tip_attempts enable row level security;
alter table public.feedback     enable row level security;
alter table public.rate_limits  enable row level security;
-- No policies are created on purpose: anon and authenticated get no rows.

revoke all on public.cafes, public.receipts, public.tip_attempts, public.feedback,
              public.rate_limits, public.employee_demo_totals
  from anon, authenticated;

revoke execute on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.new_receipt_token() from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
grant execute on function public.new_receipt_token() to service_role;
