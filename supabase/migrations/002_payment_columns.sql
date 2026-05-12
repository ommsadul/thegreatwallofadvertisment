-- Add payment and submission linkage columns

alter table public.pixel_reservations
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists paid_at timestamptz;

create unique index if not exists pixel_reservations_stripe_checkout_uidx
  on public.pixel_reservations (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index if not exists pixel_reservations_stripe_intent_uidx
  on public.pixel_reservations (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

alter table public.ad_submissions
  add column if not exists reservation_id uuid references public.pixel_reservations(id) on delete set null,
  add column if not exists x1 integer,
  add column if not exists y1 integer,
  add column if not exists x2 integer,
  add column if not exists y2 integer,
  add column if not exists quote_cents integer;

create unique index if not exists ad_submissions_reservation_uidx
  on public.ad_submissions (reservation_id)
  where reservation_id is not null;
