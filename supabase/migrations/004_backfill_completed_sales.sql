-- Backfill sold regions for reservations completed before sold-region persistence was added.

insert into public.pixel_regions (
  submission_id,
  x1,
  y1,
  x2,
  y2,
  lease_starts_at,
  lease_ends_at,
  published_at
)
select
  s.id as submission_id,
  r.x1,
  r.y1,
  r.x2,
  r.y2,
  coalesce(r.completed_at, now()) as lease_starts_at,
  coalesce(r.completed_at, now()) + interval '1 year' as lease_ends_at,
  coalesce(r.completed_at, now()) as published_at
from public.pixel_reservations r
left join public.ad_submissions s on s.reservation_id = r.id
where
  r.status = 'completed'
  and not exists (
    select 1
    from public.pixel_regions pr
    where pr.x1 = r.x1
      and pr.y1 = r.y1
      and pr.x2 = r.x2
      and pr.y2 = r.y2
      and pr.lease_ends_at > now() - interval '10 years'
  );
