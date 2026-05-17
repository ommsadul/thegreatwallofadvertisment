-- Durable ad drafts and server-owned creative assets.
-- Checkout sessions should reference draft ids instead of carrying raw ad URLs.

do $$
begin
  create type public.ad_draft_status as enum (
    'draft',
    'ready',
    'failed',
    'published'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.ad_drafts (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid references public.pixel_reservations(id) on delete set null,
  customer_email text,
  target_url text not null check (target_url ~* '^https?://'),
  source_image_url text check (source_image_url is null or source_image_url ~* '^https?://'),
  stored_image_path text,
  stored_image_url text check (stored_image_url is null or stored_image_url ~* '^https?://'),
  image_content_type text,
  image_byte_size integer check (image_byte_size is null or image_byte_size > 0),
  headline text,
  status public.ad_draft_status not null default 'draft',
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ad_drafts enable row level security;

create index if not exists ad_drafts_reservation_idx
  on public.ad_drafts (reservation_id)
  where reservation_id is not null;

create index if not exists ad_drafts_status_created_idx
  on public.ad_drafts (status, created_at desc);

create index if not exists ad_drafts_target_url_idx
  on public.ad_drafts (target_url);

create or replace function public.touch_ad_drafts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_ad_drafts_updated_at on public.ad_drafts;

create trigger touch_ad_drafts_updated_at
before update on public.ad_drafts
for each row
execute function public.touch_ad_drafts_updated_at();

alter table public.ad_submissions
  add column if not exists ad_draft_id uuid references public.ad_drafts(id) on delete set null;

create unique index if not exists ad_submissions_ad_draft_idx
  on public.ad_submissions (ad_draft_id)
  where ad_draft_id is not null;

create index if not exists ad_submissions_reservation_status_idx
  on public.ad_submissions (reservation_id, status);

insert into storage.buckets (
  id,
  name,
  "public",
  file_size_limit,
  allowed_mime_types
)
values (
  'ad-assets',
  'ad-assets',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  name = excluded.name,
  "public" = excluded."public",
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Public can read ad assets'
  ) then
    create policy "Public can read ad assets"
      on storage.objects
      for select
      using (bucket_id = 'ad-assets');
  end if;
end $$;
