-- 2 Million Dollar Wall - Initial schema

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create type public.reservation_status as enum (
  'pending',
  'completed',
  'expired',
  'cancelled'
);

create type public.submission_status as enum (
  'pending_review',
  'approved',
  'rejected'
);

create table public.ad_submissions (
  id uuid primary key default gen_random_uuid(),
  customer_email text not null check (position('@' in customer_email) > 1),
  target_url text not null,
  image_url text,
  headline text,
  status public.submission_status not null default 'pending_review',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  rejection_reason text
);

create table public.pixel_regions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references public.ad_submissions(id) on delete set null,
  x1 integer not null,
  y1 integer not null,
  x2 integer not null,
  y2 integer not null,
  region box generated always as (box(point(x1, y1), point(x2, y2))) stored,
  lease_starts_at timestamptz not null default now(),
  lease_ends_at timestamptz not null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  constraint pixel_regions_bounds check (
    x1 >= 0
    and y1 >= 0
    and x2 >= x1
    and y2 >= y1
    and x2 < 2000
    and y2 < 1000
  ),
  constraint pixel_regions_lease_order check (lease_ends_at > lease_starts_at)
);

create index pixel_regions_region_gist_idx
  on public.pixel_regions using gist (region);

create index pixel_regions_lease_idx
  on public.pixel_regions (lease_ends_at);

create table public.pixel_reservations (
  id uuid primary key default gen_random_uuid(),
  customer_email text not null check (position('@' in customer_email) > 1),
  x1 integer not null,
  y1 integer not null,
  x2 integer not null,
  y2 integer not null,
  region box generated always as (box(point(x1, y1), point(x2, y2))) stored,
  quote_cents integer not null check (quote_cents > 0),
  zone_breakdown jsonb not null,
  status public.reservation_status not null default 'pending',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint pixel_reservations_bounds check (
    x1 >= 0
    and y1 >= 0
    and x2 >= x1
    and y2 >= y1
    and x2 < 2000
    and y2 < 1000
  ),
  constraint pixel_reservations_expiry check (expires_at > created_at)
);

create index pixel_reservations_region_gist_idx
  on public.pixel_reservations using gist (region);

create index pixel_reservations_status_expiry_idx
  on public.pixel_reservations (status, expires_at);

create or replace function public.region_is_available(
  p_x1 integer,
  p_y1 integer,
  p_x2 integer,
  p_y2 integer
)
returns boolean
language plpgsql
stable
as $$
declare
  v_x1 integer := least(p_x1, p_x2);
  v_x2 integer := greatest(p_x1, p_x2);
  v_y1 integer := least(p_y1, p_y2);
  v_y2 integer := greatest(p_y1, p_y2);
  v_region box := box(point(v_x1, v_y1), point(v_x2, v_y2));
begin
  if v_x1 < 0 or v_y1 < 0 or v_x2 >= 2000 or v_y2 >= 1000 then
    return false;
  end if;

  if exists (
    select 1
    from public.pixel_regions pr
    where pr.lease_ends_at > now()
      and pr.region && v_region
  ) then
    return false;
  end if;

  if exists (
    select 1
    from public.pixel_reservations r
    where r.status = 'pending'
      and r.expires_at > now()
      and r.region && v_region
  ) then
    return false;
  end if;

  return true;
end;
$$;

create or replace function public.create_region_reservation(
  p_x1 integer,
  p_y1 integer,
  p_x2 integer,
  p_y2 integer,
  p_customer_email text,
  p_quote_cents integer,
  p_zone_breakdown jsonb,
  p_hold_minutes integer default 15
)
returns table (
  reservation_id uuid,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_x1 integer := least(p_x1, p_x2);
  v_x2 integer := greatest(p_x1, p_x2);
  v_y1 integer := least(p_y1, p_y2);
  v_y2 integer := greatest(p_y1, p_y2);
  v_hold_minutes integer := greatest(5, least(30, p_hold_minutes));
  v_reservation_id uuid;
  v_expires_at timestamptz := now() + make_interval(mins => v_hold_minutes);
begin
  -- Serialize reservation creation to avoid overlap races under concurrency.
  perform pg_advisory_xact_lock(20001000);

  if p_customer_email is null or position('@' in p_customer_email) <= 1 then
    raise exception 'INVALID_EMAIL';
  end if;

  if p_quote_cents <= 0 then
    raise exception 'INVALID_QUOTE';
  end if;

  if not public.region_is_available(v_x1, v_y1, v_x2, v_y2) then
    raise exception 'REGION_NOT_AVAILABLE';
  end if;

  insert into public.pixel_reservations (
    customer_email,
    x1,
    y1,
    x2,
    y2,
    quote_cents,
    zone_breakdown,
    status,
    expires_at
  )
  values (
    p_customer_email,
    v_x1,
    v_y1,
    v_x2,
    v_y2,
    p_quote_cents,
    p_zone_breakdown,
    'pending',
    v_expires_at
  )
  returning id into v_reservation_id;

  return query
  select v_reservation_id, v_expires_at;
end;
$$;

create or replace function public.expire_stale_reservations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_count integer;
begin
  update public.pixel_reservations
  set status = 'expired'
  where status = 'pending'
    and expires_at <= now();

  get diagnostics affected_count = row_count;
  return affected_count;
end;
$$;

alter table public.ad_submissions enable row level security;
alter table public.pixel_regions enable row level security;
alter table public.pixel_reservations enable row level security;

create policy "Public can view active regions"
  on public.pixel_regions
  for select
  using (published_at is not null and lease_ends_at > now());
