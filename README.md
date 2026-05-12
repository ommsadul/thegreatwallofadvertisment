# 2 Million Dollar Wall

Infinite-graph pixel ad marketplace MVP.

## Current MVP Features

- Infinite world viewport with pan/zoom controls
- No predefined board edge in selection/business logic (unbounded coordinates)
- APIs accept integer-string coordinates for very large values (beyond JS number precision)
- Flat pricing: $2 per pixel everywhere
- Live quote preview for rectangular pixel-region selections
- Inventory availability API
- Reservation API with hold window
- Stripe Checkout session API
- Stripe webhook API to mark reservations paid and create moderation submissions

## Stack

- Next.js 16 (App Router, TypeScript)
- Supabase (Postgres + RPC functions)
- Stripe (Checkout + Webhooks)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy env template and fill values:

```bash
cp .env.example .env.local
```

3. Apply SQL migrations in Supabase in order:

- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/002_payment_columns.sql`
- `supabase/migrations/003_infinite_coordinates_flat_pricing.sql`

You can run these in the Supabase SQL editor or via Supabase CLI.

4. Start dev server:

```bash
npm run dev
```

## Required Environment Variables

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

## Stripe Webhook Local Testing

Use Stripe CLI and forward events to your local webhook route:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Then use the returned signing secret as `STRIPE_WEBHOOK_SECRET`.

## Implemented API Routes

- `POST /api/pricing/quote`
- `POST /api/inventory/availability`
- `POST /api/reservations/create`
- `POST /api/checkout/session`
- `POST /api/stripe/webhook`

## Verify

```bash
npm run lint
npm run build
```

## Next Slice

- Admin moderation dashboard for approve/reject
- Publish approved submissions into `pixel_regions`
- Lease expiry scheduler and release automation
