import Stripe from "stripe";

import { fetchWebsitePreview } from "@/lib/ad/website-preview";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export type FinalizeCheckoutResult = {
  ok: boolean;
  state:
    | "finalized"
    | "already-finalized"
    | "waiting-payment"
    | "not-found"
    | "error";
  message: string;
  reservationId?: string;
};

type ReservationRow = {
  id: string;
  customer_email: string;
  status: "pending" | "completed" | "expired" | "cancelled";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  quote_cents: number;
  completed_at: string | null;
  paid_at: string | null;
};

function isLegacyBlockedScreenshotUrl(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  return value.includes("image.thum.io/get/");
}

function oneYearAfter(baseIso: string): string {
  const base = new Date(baseIso);
  const reference = Number.isNaN(base.getTime()) ? new Date() : base;
  return new Date(reference.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();
}

function extractPaymentIntentId(
  paymentIntent: string | Stripe.PaymentIntent | null,
): string | null {
  if (!paymentIntent) {
    return null;
  }

  if (typeof paymentIntent === "string") {
    return paymentIntent;
  }

  return paymentIntent.id;
}

export async function finalizeCheckoutSession(
  session: Stripe.Checkout.Session,
): Promise<FinalizeCheckoutResult> {
  if (session.payment_status !== "paid") {
    return {
      ok: false,
      state: "waiting-payment",
      message: "Checkout session is not marked as paid yet.",
    };
  }

  const supabase = getSupabaseAdminClient();
  const reservationIdFromMetadata = session.metadata?.reservation_id?.trim() || null;

  let reservationQuery = supabase
    .from("pixel_reservations")
    .select("id,customer_email,status,x1,y1,x2,y2,quote_cents,completed_at,paid_at")
    .limit(1);

  if (reservationIdFromMetadata) {
    reservationQuery = reservationQuery.eq("id", reservationIdFromMetadata);
  } else {
    reservationQuery = reservationQuery.eq("stripe_checkout_session_id", session.id);
  }

  const { data: reservationData, error: reservationError } = await reservationQuery.maybeSingle();

  if (reservationError) {
    return {
      ok: false,
      state: "error",
      message: `Failed to load reservation: ${reservationError.message}`,
    };
  }

  if (!reservationData) {
    return {
      ok: false,
      state: "not-found",
      message: "No reservation found for this checkout session.",
    };
  }

  const reservation = reservationData as ReservationRow;
  const nowIso = new Date().toISOString();

  if (reservation.status !== "completed") {
    const paymentIntentId = extractPaymentIntentId(session.payment_intent);

    const { error: updateError } = await supabase
      .from("pixel_reservations")
      .update({
        status: "completed",
        completed_at: nowIso,
        paid_at: nowIso,
        stripe_payment_intent_id: paymentIntentId,
      })
      .eq("id", reservation.id);

    if (updateError) {
      return {
        ok: false,
        state: "error",
        message: `Failed to mark reservation completed: ${updateError.message}`,
        reservationId: reservation.id,
      };
    }
  }

  const { data: existingSubmission, error: existingSubmissionError } = await supabase
    .from("ad_submissions")
    .select("id,target_url,image_url,headline,status")
    .eq("reservation_id", reservation.id)
    .maybeSingle();

  if (existingSubmissionError) {
    return {
      ok: false,
      state: "error",
      message: `Failed to check ad submission: ${existingSubmissionError.message}`,
      reservationId: reservation.id,
    };
  }

  let submissionId = existingSubmission?.id as string | undefined;

  if (existingSubmission?.id) {
    let nextImageUrl =
      typeof existingSubmission.image_url === "string"
        ? existingSubmission.image_url
        : null;
    let nextHeadline =
      typeof existingSubmission.headline === "string"
        ? existingSubmission.headline
        : null;

    const existingTargetUrl =
      typeof existingSubmission.target_url === "string"
        ? existingSubmission.target_url
        : "";

    if (isLegacyBlockedScreenshotUrl(nextImageUrl)) {
      nextImageUrl = null;
    }

    if (existingTargetUrl && (!nextImageUrl || !nextHeadline)) {
      const preview = await fetchWebsitePreview(existingTargetUrl, 5000);

      if (!nextImageUrl && (preview.imageUrl || preview.screenshotUrl)) {
        nextImageUrl = preview.imageUrl ?? preview.screenshotUrl;
      }

      if (!nextHeadline && preview.headline) {
        nextHeadline = preview.headline;
      }
    }

    const shouldPromoteStatus = existingSubmission.status === "pending_review";
    const shouldUpdateImage = nextImageUrl !== existingSubmission.image_url;
    const shouldUpdateHeadline = nextHeadline !== existingSubmission.headline;

    if (shouldPromoteStatus || shouldUpdateImage || shouldUpdateHeadline) {
      const { error: updateSubmissionError } = await supabase
        .from("ad_submissions")
        .update({
          status: shouldPromoteStatus ? "approved" : existingSubmission.status,
          image_url: nextImageUrl,
          headline: nextHeadline,
        })
        .eq("id", existingSubmission.id);

      if (updateSubmissionError) {
        return {
          ok: false,
          state: "error",
          message: `Failed to update existing ad submission: ${updateSubmissionError.message}`,
          reservationId: reservation.id,
        };
      }
    }
  }

  if (!submissionId) {
    const targetUrl = session.metadata?.target_url ?? "";
    let derivedImageUrl = session.metadata?.image_url || null;
    let derivedHeadline = session.metadata?.headline || null;

    if (isLegacyBlockedScreenshotUrl(derivedImageUrl)) {
      derivedImageUrl = null;
    }

    if (targetUrl && (!derivedImageUrl || !derivedHeadline)) {
      const preview = await fetchWebsitePreview(targetUrl, 5000);

      if (!derivedImageUrl && (preview.imageUrl || preview.screenshotUrl)) {
        derivedImageUrl = preview.imageUrl ?? preview.screenshotUrl;
      }

      if (!derivedHeadline && preview.headline) {
        derivedHeadline = preview.headline;
      }
    }

    const { data: insertedSubmission, error: insertSubmissionError } = await supabase
      .from("ad_submissions")
      .insert({
        reservation_id: reservation.id,
        customer_email:
          session.customer_details?.email ??
          session.customer_email ??
          reservation.customer_email,
        target_url: targetUrl,
        image_url: derivedImageUrl,
        headline: derivedHeadline,
        status: "approved",
        x1: reservation.x1,
        y1: reservation.y1,
        x2: reservation.x2,
        y2: reservation.y2,
        quote_cents: reservation.quote_cents,
      })
      .select("id")
      .single();

    if (insertSubmissionError) {
      if (insertSubmissionError.code !== "23505") {
        return {
          ok: false,
          state: "error",
          message: `Failed to create ad submission: ${insertSubmissionError.message}`,
          reservationId: reservation.id,
        };
      }

      const { data: refetchedSubmission, error: refetchSubmissionError } = await supabase
        .from("ad_submissions")
        .select("id")
        .eq("reservation_id", reservation.id)
        .maybeSingle();

      if (refetchSubmissionError || !refetchedSubmission?.id) {
        return {
          ok: false,
          state: "error",
          message:
            refetchSubmissionError?.message ??
            "Submission race detected but refetch failed.",
          reservationId: reservation.id,
        };
      }

      submissionId = refetchedSubmission.id;
    } else {
      submissionId = insertedSubmission.id;
    }
  }

  if (!submissionId) {
    return {
      ok: false,
      state: "error",
      message: "Submission id is missing after finalize flow.",
      reservationId: reservation.id,
    };
  }

  const { data: existingRegion, error: existingRegionError } = await supabase
    .from("pixel_regions")
    .select("id")
    .eq("submission_id", submissionId)
    .maybeSingle();

  if (existingRegionError) {
    return {
      ok: false,
      state: "error",
      message: `Failed to check sold region: ${existingRegionError.message}`,
      reservationId: reservation.id,
    };
  }

  if (!existingRegion?.id) {
    const leaseBase = reservation.paid_at ?? reservation.completed_at ?? nowIso;
    const leaseEndsAt = oneYearAfter(leaseBase);

    const { error: insertRegionError } = await supabase.from("pixel_regions").insert({
      submission_id: submissionId,
      x1: reservation.x1,
      y1: reservation.y1,
      x2: reservation.x2,
      y2: reservation.y2,
      lease_ends_at: leaseEndsAt,
      published_at: leaseBase,
    });

    if (insertRegionError) {
      return {
        ok: false,
        state: "error",
        message: `Failed to create sold region: ${insertRegionError.message}`,
        reservationId: reservation.id,
      };
    }

    return {
      ok: true,
      state: "finalized",
      message: "Payment finalized and sold region persisted.",
      reservationId: reservation.id,
    };
  }

  return {
    ok: true,
    state: "already-finalized",
    message: "Reservation was already finalized.",
    reservationId: reservation.id,
  };
}
