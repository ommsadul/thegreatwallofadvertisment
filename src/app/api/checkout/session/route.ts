import { NextRequest, NextResponse } from "next/server";

import { getStripeServerClient, hasStripeEnv } from "@/lib/stripe/server";
import { STRIPE_MAX_UNIT_AMOUNT_CENTS } from "@/lib/pricing-zones";
import {
  getSupabaseAdminClient,
  hasSupabaseServiceEnv,
} from "@/lib/supabase/server";

export const runtime = "nodejs";

type CheckoutPayload = {
  reservationId: string;
  targetUrl: string;
  imageUrl?: string;
  headline?: string;
};

function isCheckoutPayload(payload: unknown): payload is CheckoutPayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Record<string, unknown>;

  return (
    typeof candidate.reservationId === "string" &&
    candidate.reservationId.length > 10 &&
    typeof candidate.targetUrl === "string" &&
    candidate.targetUrl.startsWith("http") &&
    (candidate.imageUrl === undefined || typeof candidate.imageUrl === "string") &&
    (candidate.headline === undefined || typeof candidate.headline === "string")
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
          "Expected reservationId and targetUrl. Optional fields: imageUrl, headline.",
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

  const { data: reservation, error: reservationError } = await supabase
    .from("pixel_reservations")
    .select("id,customer_email,quote_cents,expires_at,status,x1,y1,x2,y2")
    .eq("id", payload.reservationId)
    .maybeSingle();

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
  const x1 = Number(reservation.x1);
  const y1 = Number(reservation.y1);
  const x2 = Number(reservation.x2);
  const y2 = Number(reservation.y2);

  if (
    !Number.isFinite(x1) ||
    !Number.isFinite(y1) ||
    !Number.isFinite(x2) ||
    !Number.isFinite(y2)
  ) {
    return NextResponse.json(
      {
        error: "Reservation coordinates are invalid.",
      },
      { status: 500 },
    );
  }

  const width = x2 - x1 + 1;
  const height = y2 - y1 + 1;

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
              name: `Pixel Region ${width} x ${height}`,
              description: `Reservation ${reservation.id}`,
            },
            unit_amount: reservation.quote_cents,
          },
        },
      ],
      metadata: {
        reservation_id: reservation.id,
        target_url: payload.targetUrl,
        image_url: payload.imageUrl ?? "",
        headline: payload.headline ?? "",
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
