-- Use exact bigint comparisons for region overlap checks.
-- The previous generated box columns used floating-point geometry, which can
-- lose precision for very large coordinates.

drop index if exists public.pixel_regions_region_gist_idx;
drop index if exists public.pixel_reservations_region_gist_idx;

alter table public.pixel_regions
  drop column if exists region;

alter table public.pixel_reservations
  drop column if exists region;

create index if not exists pixel_regions_active_overlap_idx
  on public.pixel_regions (lease_ends_at, x1, x2, y1, y2);

create index if not exists pixel_reservations_pending_overlap_idx
  on public.pixel_reservations (status, expires_at, x1, x2, y1, y2);

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
begin
  if exists (
    select 1
    from public.pixel_regions pr
    where pr.lease_ends_at > now()
      and pr.x1 <= v_x2
      and pr.x2 >= v_x1
      and pr.y1 <= v_y2
      and pr.y2 >= v_y1
  ) then
    return false;
  end if;

  if exists (
    select 1
    from public.pixel_reservations r
    where r.status = 'pending'
      and r.expires_at > now()
      and r.x1 <= v_x2
      and r.x2 >= v_x1
      and r.y1 <= v_y2
      and r.y2 >= v_y1
  ) then
    return false;
  end if;

  return true;
end;
$$;
