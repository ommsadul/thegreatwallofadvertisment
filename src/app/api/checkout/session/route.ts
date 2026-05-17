import { NextRequest, NextResponse } from "next/server";

import { getStripeServerClient, hasStripeEnv } from "@/lib/stripe/server";
import { STRIPE_MAX_UNIT_AMOUNT_CENTS } from "@/lib/pricing-zones";
import {
  getSupabaseAdminClient,
  hasSupabaseServiceEnv,
} from "@/lib/supabase/server";
import {
  formatBigIntDimension,
  parseIntegerLike,
} from "@/lib/wall/serialization";

export const runtime = "nodejs";

type CheckoutPayload = {
  reservationId: string;
  adDraftId: string;
};

type AdDraftRow = {
  id: string;
  reservation_id: string | null;
  target_url: string;
  stored_image_url: string | null;
  headline: string | null;
  status: "draft" | "ready" | "failed" | "published";
  customer_email: string | null;
};

function isCheckoutPayload(payload: unknown): payload is CheckoutPayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Record<string, unknown>;

  return (
    typeof candidate.reservationId === "string" &&
    candidate.reservationId.length > 10 &&
    typeof candidate.adDraftId === "string" &&
    candidate.adDraftId.length > 10
  );
}

export async function POST(request: NextRequest) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isCheckoutPayload(payload)) {
    return NextResponse.json(
      {
        error:
          "Expected reservationId and adDraftId. Prepare an ad preview before checkout.",
      },
      { status: 400 },
    );
  }

  if (!hasSupabaseServiceEnv()) {
    return NextResponse.json(
      {
        error:
          "Supabase environment is not configured yet. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      },
      { status: 503 },
    );
  }

  if (!hasStripeEnv()) {
    return NextResponse.json(
      {
        error: "Stripe environment is not configured yet. Set STRIPE_SECRET_KEY.",
      },
      { status: 503 },
    );
  }

  const supabase = getSupabaseAdminClient();
  const stripe = getStripeServerClient();

  const reservationQuery = supabase
    .from("pixel_reservations")
    .select("id,customer_email,quote_cents,expires_at,status,x1,y1,x2,y2")
    .eq("id", payload.reservationId)
    .maybeSingle();

  const adDraftQuery = supabase
    .from("ad_drafts")
    .select("id,reservation_id,target_url,stored_image_url,headline,status,customer_email")
    .eq("id", payload.adDraftId)
    .maybeSingle<AdDraftRow>();

  const [
    { data: reservation, error: reservationError },
    { data: adDraftData, error: adDraftError },
  ] = await Promise.all([reservationQuery, adDraftQuery]);

  if (reservationError) {
    return NextResponse.json(
      {
        error: "Unable to load reservation.",
        details: reservationError.message,
      },
      { status: 500 },
    );
  }

  if (!reservation) {
    return NextResponse.json(
      { error: "Reservation not found." },
      { status: 404 },
    );
  }

  if (reservation.status !== "pending") {
    return NextResponse.json(
      { error: "Reservation is no longer pending." },
      { status: 409 },
    );
  }

  if (new Date(reservation.expires_at).getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "Reservation has expired." },
      { status: 409 },
    );
  }

  if (
    typeof reservation.quote_cents !== "number" ||
    reservation.quote_cents <= 0 ||
    reservation.quote_cents > STRIPE_MAX_UNIT_AMOUNT_CENTS
  ) {
    return NextResponse.json(
      {
        error:
          "Reservation quote is outside supported Stripe amount range.",
      },
      { status: 400 },
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const x1 = parseIntegerLike(reservation.x1);
  const y1 = parseIntegerLike(reservation.y1);
  const x2 = parseIntegerLike(reservation.x2);
  const y2 = parseIntegerLike(reservation.y2);

  if (x1 === null || y1 === null || x2 === null || y2 === null) {
    return NextResponse.json(
      {
        error: "Reservation coordinates are invalid.",
      },
      { status: 500 },
    );
  }

  if (adDraftError) {
    return NextResponse.json(
      {
        error: "Unable to load ad preview.",
        details: adDraftError.message,
      },
      { status: 500 },
    );
  }

  if (!adDraftData) {
    return NextResponse.json(
      { error: "Ad preview not found. Generate the preview again." },
      { status: 404 },
    );
  }

  if (adDraftData.status !== "ready") {
    return NextResponse.json(
      { error: "Ad preview is not ready yet. Generate the preview again." },
      { status: 409 },
    );
  }

  if (
    adDraftData.reservation_id &&
    adDraftData.reservation_id !== reservation.id
  ) {
    return NextResponse.json(
      { error: "This ad preview is already attached to another reservation." },
      { status: 409 },
    );
  }

  let linkDraftQuery = supabase
    .from("ad_drafts")
    .update({
      reservation_id: reservation.id,
      customer_email: reservation.customer_email,
    })
    .eq("id", adDraftData.id);

  linkDraftQuery = adDraftData.reservation_id
    ? linkDraftQuery.eq("reservation_id", reservation.id)
    : linkDraftQuery.is("reservation_id", null);

  const { data: linkedDraft, error: linkDraftError } = await linkDraftQuery
    .select("id")
    .maybeSingle();

  if (linkDraftError || !linkedDraft) {
    return NextResponse.json(
      {
        error: "Unable to attach ad preview to reservation.",
        details: linkDraftError?.message ?? "The preview was already claimed.",
      },
      { status: 409 },
    );
  }

  const width = x2 - x1 + BigInt(1);
  const height = y2 - y1 + BigInt(1);

  if (width <= 0 || height <= 0) {
    return NextResponse.json(
      {
        error: "Reservation coordinates are not ordered correctly.",
      },
      { status: 500 },
    );
  }

  let session;

  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/checkout/cancel?reservation_id=${reservation.id}`,
      customer_email: reservation.customer_email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            product_data: {
              name: `Wall placement ${formatBigIntDimension(width)} x ${formatBigIntDimension(height)} pixels`,
              description:
                "365-day visible placement. The selected region publishes after payment.",
            },
            unit_amount: reservation.quote_cents,
          },
        },
      ],
      metadata: {
        reservation_id: reservation.id,
        ad_draft_id: adDraftData.id,
      },
    });
  } catch (error) {
    const err = error as { type?: string; message?: string };
    const isAuthError = err.type === "StripeAuthenticationError";

    return NextResponse.json(
      {
        error: isAuthError
          ? "Stripe API key is invalid. Set STRIPE_SECRET_KEY to a valid test or live key."
          : "Failed to create Stripe checkout session.",
        details: err.message ?? "Unknown Stripe error.",
      },
      { status: isAuthError ? 503 : 500 },
    );
  }

  const { error: updateError } = await supabase
    .from("pixel_reservations")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", reservation.id);

  if (updateError) {
    return NextResponse.json(
      {
        error: "Checkout session created but failed to persist state.",
        details: updateError.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      checkoutUrl: session.url,
      sessionId: session.id,
    },
    { status: 201 },
  );
}
