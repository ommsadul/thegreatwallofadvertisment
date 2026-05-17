# thegreatwallofadvertisment

An infinite pixel ad wall where people can select exact coordinates, reserve a region, attach an ad destination, pay through Stripe Checkout, and publish the placement onto the public wall.

## What It Does

- Infinite canvas with pan, zoom, true-pixel selection, and tile-based loading.
- Flat pricing: `$2` per purchasable pixel.
- Exact bigint-safe coordinate handling for very large wall positions.
- Reservation holds so selected regions cannot be double-sold during checkout.
- Durable ad drafts that store destination, headline, and copied creative assets before payment.
- Stripe Checkout and webhook finalization.
- About, FAQ, checkout success/cancel, and claim pixel flows with a shared visual system.
- Browser smoke tests for the marketing pages and pixel wall.

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- shadcn/base-ui components
- Supabase Postgres and Storage
- Stripe Checkout and Webhooks
- Playwright for browser smoke tests
- Node test runner for wall engine tests

## Local Setup

Install dependencies:

```bash
npm install
```

Copy the environment template:

```bash
cp .env.example .env.local
```

Fill these values:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Supabase Setup

Run the migrations in order in the Supabase SQL editor or with the Supabase CLI:

```text
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_payment_columns.sql
supabase/migrations/003_infinite_coordinates_flat_pricing.sql
supabase/migrations/004_backfill_completed_sales.sql
supabase/migrations/005_bigint_overlap_checks.sql
supabase/migrations/006_ad_drafts_assets.sql
```

Important notes:

- `005_bigint_overlap_checks.sql` replaces floating-point region overlap checks with exact bigint comparisons.
- `006_ad_drafts_assets.sql` creates `ad_drafts`, links drafts to submissions, and creates the public `ad-assets` storage bucket.
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only. It is used by API routes for reservations, draft storage, and checkout finalization.

## Stripe Setup

Use Stripe test keys during local development.

For webhook testing:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the returned `whsec_...` value into `STRIPE_WEBHOOK_SECRET`.

Checkout uses:

- `POST /api/checkout/session` to create a Stripe Checkout Session.
- `POST /api/stripe/webhook` to mark reservations as paid and publish placements.

## API Routes

- `POST /api/pricing/quote`
- `POST /api/inventory/availability`
- `POST /api/reservations/create`
- `POST /api/ad/autofill`
- `POST /api/ad/drafts`
- `POST /api/checkout/session`
- `POST /api/stripe/webhook`
- `GET /api/wall/regions`
- `POST /api/wall/tiles`

## Scripts

```bash
npm run dev       # Start the Next dev server
npm run build     # Build production output
npm run start     # Start the production server after build
npm run lint      # Run ESLint
npm run test:wall # Compile and run wall engine tests
npm run test:e2e  # Run Playwright smoke tests against next start
```

`npm run test:e2e` expects a production build to exist because it runs `next start`. Run `npm run build` first.

If Playwright browsers are missing on a fresh machine:

```bash
npx playwright install chromium
```

## Verification Before Push

Run:

```bash
npm run lint
npm run test:wall
npm run build
npm run test:e2e
```

`next/font/google` downloads Space Grotesk and IBM Plex Mono during production builds. The build environment needs network access the first time those assets are fetched.

## Project Structure

```text
src/app/                         App Router pages and API routes
src/components/Navigation.tsx     Shared pill navigation
src/components/wall/              Pixel wall UI, canvas, claim panel, hooks
src/components/ui/                shadcn/base-ui primitives
src/lib/ad/                       Ad draft, autofill, and preview helpers
src/lib/payments/                 Stripe checkout finalization
src/lib/wall/                     Canvas geometry, store, tile, and serialization logic
supabase/migrations/              Database and storage migrations
tests/                            Node and Playwright tests
```

## Current Product Flow

1. User opens the wall and zooms/pans to a location.
2. User switches to Select and drags an exact pixel rectangle.
3. The app quotes total pixels and price.
4. User enters email, destination URL, headline, and optionally an image URL.
5. The server creates a stored ad draft and copies supported images into Supabase Storage.
6. User reserves the region.
7. User checks out through Stripe.
8. Stripe webhook finalizes payment and publishes the ad region to the wall.
