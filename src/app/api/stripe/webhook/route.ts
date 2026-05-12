import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

import {
  getStripeServerClient,
  getStripeWebhookSecret,
  hasStripeWebhookEnv,
} from "@/lib/stripe/server";
import {
  hasSupabaseServiceEnv,
} from "@/lib/supabase/server";
import { finalizeCheckoutSession } from "@/lib/payments/finalize-checkout-session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!hasSupabaseServiceEnv()) {
    return NextResponse.json(
      {
        error:
          "Supabase environment is not configured yet. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      },
      { status: 503 },
    );
  }

  if (!hasStripeWebhookEnv()) {
    return NextResponse.json(
      {
        error:
          "Stripe webhook environment is not configured yet. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET.",
      },
      { status: 503 },
    );
  }

  const stripe = getStripeServerClient();
  const headerStore = await headers();
  const signature = headerStore.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header." },
      { status: 400 },
    );
  }

  const payload = await request.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      getStripeWebhookSecret(),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Invalid Stripe signature.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 },
    );
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    const finalizeResult = await finalizeCheckoutSession(session);

    if (!finalizeResult.ok && finalizeResult.state !== "waiting-payment") {
      return NextResponse.json(
        {
          error: "Failed to finalize checkout session.",
          details: finalizeResult.message,
        },
        { status: 500 },
      );
    }

    if (finalizeResult.state === "not-found") {
      return NextResponse.json(
        { received: true, warning: finalizeResult.message },
        { status: 202 },
      );
    }
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
