-- Infinite-world migration: unbounded coordinate model and flat pricing support

drop index if exists public.pixel_regions_region_gist_idx;
drop index if exists public.pixel_reservations_region_gist_idx;

alter table public.pixel_regions
  drop column if exists region;

alter table public.pixel_reservations
  drop column if exists region;

alter table public.pixel_regions
  alter column x1 type bigint using x1::bigint,
  alter column y1 type bigint using y1::bigint,
  alter column x2 type bigint using x2::bigint,
  alter column y2 type bigint using y2::bigint;

alter table public.pixel_reservations
  alter column x1 type bigint using x1::bigint,
  alter column y1 type bigint using y1::bigint,
  alter column x2 type bigint using x2::bigint,
  alter column y2 type bigint using y2::bigint;

alter table public.ad_submissions
  alter column x1 type bigint using x1::bigint,
  alter column y1 type bigint using y1::bigint,
  alter column x2 type bigint using x2::bigint,
  alter column y2 type bigint using y2::bigint;

alter table public.pixel_regions
  add column region box generated always as (box(point(x1, y1), point(x2, y2))) stored;

alter table public.pixel_reservations
  add column region box generated always as (box(point(x1, y1), point(x2, y2))) stored;

create index if not exists pixel_regions_region_gist_idx
  on public.pixel_regions using gist (region);

create index if not exists pixel_reservations_region_gist_idx
  on public.pixel_reservations using gist (region);

alter table public.pixel_regions
  drop constraint if exists pixel_regions_bounds,
  add constraint pixel_regions_order_bounds check (x2 >= x1 and y2 >= y1);

alter table public.pixel_reservations
  drop constraint if exists pixel_reservations_bounds,
  add constraint pixel_reservations_order_bounds check (x2 >= x1 and y2 >= y1);

alter table public.pixel_reservations
  alter column zone_breakdown drop not null,
  alter column zone_breakdown set default '{}'::jsonb;

alter table public.pixel_reservations
  drop constraint if exists pixel_reservations_quote_cents_check,
  add constraint pixel_reservations_quote_cents_check
    check (quote_cents > 0 and quote_cents <= 99999999);

drop function if exists public.region_is_available(integer, integer, integer, integer);

drop function if exists public.create_region_reservation(
  integer,
  integer,
  integer,
  integer,
  text,
  integer,
  jsonb,
  integer
);

create or replace function public.region_is_available(
  p_x1 bigint,
  p_y1 bigint,
  p_x2 bigint,
  p_y2 bigint
)
returns boolean
language plpgsql
stable
as $$
declare
  v_x1 bigint := least(p_x1, p_x2);
  v_x2 bigint := greatest(p_x1, p_x2);
  v_y1 bigint := least(p_y1, p_y2);
  v_y2 bigint := greatest(p_y1, p_y2);
  v_region box := box(point(v_x1, v_y1), point(v_x2, v_y2));
begin
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
  p_x1 bigint,
  p_y1 bigint,
  p_x2 bigint,
  p_y2 bigint,
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
  v_x1 bigint := least(p_x1, p_x2);
  v_x2 bigint := greatest(p_x1, p_x2);
  v_y1 bigint := least(p_y1, p_y2);
  v_y2 bigint := greatest(p_y1, p_y2);
  v_hold_minutes integer := greatest(5, least(30, p_hold_minutes));
  v_reservation_id uuid;
  v_expires_at timestamptz := now() + make_interval(mins => v_hold_minutes);
begin
  perform pg_advisory_xact_lock(20001000);

  if p_customer_email is null or position('@' in p_customer_email) <= 1 then
    raise exception 'INVALID_EMAIL';
  end if;

  if p_quote_cents <= 0 or p_quote_cents > 99999999 then
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
    coalesce(p_zone_breakdown, '{}'::jsonb),
    'pending',
    v_expires_at
  )
  returning id into v_reservation_id;

  return query
  select v_reservation_id, v_expires_at;
end;
$$;
