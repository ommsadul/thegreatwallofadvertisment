"use client";

import { useMemo, useState } from "react";

import type { RegionQuote } from "@/lib/pricing";

type Quote = RegionQuote;

export type AdDraftPreview = {
  id: string;
  status: "draft" | "ready" | "failed" | "published";
  targetUrl: string;
  sourceImageUrl: string | null;
  imageUrl: string | null;
  imagePath: string | null;
  headline: string | null;
  warning: string | null;
};

function formatExpiry(value: string | undefined): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).format(date);
}

function minutesUntil(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const diffMs = date.getTime() - Date.now();
  if (diffMs <= 0) {
    return 0;
  }

  return Math.ceil(diffMs / 60000);
}

export function selectionKeyFor(selection: Quote["selection"] | null): string {
  if (!selection) {
    return "";
  }

  return `${selection.x1}:${selection.y1}:${selection.x2}:${selection.y2}`;
}

function draftSignatureFor(
  targetUrl: string,
  headline: string,
  sourceImageUrl: string,
): string {
  return [
    targetUrl.trim(),
    headline.trim(),
    sourceImageUrl.trim(),
  ].join("\n");
}

export function useClaimWorkflow({
  quote,
  selectionKey,
  onReservationCreated,
}: {
  quote: Quote | null;
  selectionKey: string;
  onReservationCreated: () => void;
}) {
  const [customerEmail, setCustomerEmail] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [adHeadline, setAdHeadline] = useState("");
  const [sourceImageUrl, setSourceImageUrl] = useState("");
  const [adDraft, setAdDraft] = useState<AdDraftPreview | null>(null);
  const [adDraftSignature, setAdDraftSignature] = useState("");
  const [previewResult, setPreviewResult] = useState<{
    state: "idle" | "loading" | "success" | "error";
    message: string | null;
  }>({
    state: "idle",
    message: null,
  });
  const [availabilityResult, setAvailabilityResult] = useState<{
    selectionKey: string;
    state: "unknown" | "checking" | "available" | "unavailable" | "error";
    note: string | null;
  }>({
    selectionKey: "",
    state: "unknown",
    note: null,
  });
  const [reservationResult, setReservationResult] = useState<{
    selectionKey: string;
    state: "idle" | "creating" | "created" | "error";
    message: string | null;
    reservationId: string | null;
  }>({
    selectionKey: "",
    state: "idle",
    message: null,
    reservationId: null,
  });
  const [checkoutResult, setCheckoutResult] = useState<{
    selectionKey: string;
    state: "idle" | "creating" | "error";
    message: string | null;
  }>({
    selectionKey: "",
    state: "idle",
    message: null,
  });

  const currentDraftSignature = useMemo(
    () => draftSignatureFor(targetUrl, adHeadline, sourceImageUrl),
    [adHeadline, sourceImageUrl, targetUrl],
  );
  const isAdDraftCurrent =
    Boolean(adDraft) && adDraftSignature === currentDraftSignature;
  const availabilityState =
    availabilityResult.selectionKey === selectionKey
      ? availabilityResult.state
      : "unknown";
  const availabilityNote =
    availabilityResult.selectionKey === selectionKey
      ? availabilityResult.note
      : null;
  const reservationState =
    reservationResult.selectionKey === selectionKey
      ? reservationResult.state
      : "idle";
  const reservationMessage =
    reservationResult.selectionKey === selectionKey
      ? reservationResult.message
      : null;
  const reservationId =
    reservationResult.selectionKey === selectionKey
      ? reservationResult.reservationId
      : null;
  const checkoutState =
    checkoutResult.selectionKey === selectionKey ? checkoutResult.state : "idle";
  const checkoutMessage =
    checkoutResult.selectionKey === selectionKey ? checkoutResult.message : null;

  async function checkAvailability() {
    if (!quote) {
      return;
    }

    setAvailabilityResult({
      selectionKey,
      state: "checking",
      note: null,
    });

    try {
      const response = await fetch("/api/inventory/availability", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(quote.selection),
      });
      const body = (await response.json()) as {
        available?: boolean | null;
        warning?: string;
        error?: string;
      };

      if (!response.ok) {
        setAvailabilityResult({
          selectionKey,
          state: "error",
          note: body.error ?? "Availability check failed.",
        });
        return;
      }

      if (body.available === true) {
        setAvailabilityResult({
          selectionKey,
          state: "available",
          note: body.warning ?? null,
        });
      } else if (body.available === false) {
        setAvailabilityResult({
          selectionKey,
          state: "unavailable",
          note: body.warning ?? null,
        });
      } else {
        setAvailabilityResult({
          selectionKey,
          state: "error",
          note: body.warning ?? "Availability check returned no status.",
        });
      }
    } catch {
      setAvailabilityResult({
        selectionKey,
        state: "error",
        note: "Network error while checking availability.",
      });
    }
  }

  async function createReservation() {
    if (!quote) {
      return;
    }

    if (!customerEmail.includes("@")) {
      setReservationResult({
        selectionKey,
        state: "error",
        message: "Enter a valid email before reserving.",
        reservationId: null,
      });
      return;
    }

    setReservationResult({
      selectionKey,
      state: "creating",
      message: null,
      reservationId: null,
    });
    setCheckoutResult({
      selectionKey,
      state: "idle",
      message: null,
    });

    try {
      const response = await fetch("/api/reservations/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          selection: quote.selection,
          customerEmail,
        }),
      });
      const body = (await response.json()) as {
        reservationId?: string;
        expiresAt?: string;
        holdMinutes?: number;
        error?: string;
      };

      if (!response.ok) {
        setReservationResult({
          selectionKey,
          state: "error",
          message: body.error ?? "Reservation failed.",
          reservationId: null,
        });
        return;
      }

      const remainingMinutes = minutesUntil(body.expiresAt);
      const lockedMinutes =
        typeof body.holdMinutes === "number" && Number.isFinite(body.holdMinutes)
          ? body.holdMinutes
          : 15;
      const remainingText =
        typeof remainingMinutes === "number"
          ? `${remainingMinutes} min left`
          : `${lockedMinutes} min lock`;

      setReservationResult({
        selectionKey,
        state: "created",
        message: `Selection locked (${remainingText}) until ${formatExpiry(body.expiresAt)}.`,
        reservationId: body.reservationId ?? null,
      });
      setAvailabilityResult({
        selectionKey,
        state: "unavailable",
        note: "This selection is now locked by your reservation.",
      });

      onReservationCreated();
    } catch {
      setReservationResult({
        selectionKey,
        state: "error",
        message: "Network error while creating reservation.",
        reservationId: null,
      });
    }
  }

  async function startCheckout() {
    if (!reservationId) {
      setCheckoutResult({
        selectionKey,
        state: "error",
        message: "Create a reservation before checkout.",
      });
      return;
    }

    if (!targetUrl.startsWith("http")) {
      setCheckoutResult({
        selectionKey,
        state: "error",
        message: "Enter a valid destination URL starting with http or https.",
      });
      return;
    }

    if (!adDraft || !isAdDraftCurrent) {
      setCheckoutResult({
        selectionKey,
        state: "error",
        message: "Generate a current ad preview before checkout.",
      });
      return;
    }

    setCheckoutResult({
      selectionKey,
      state: "creating",
      message: null,
    });

    try {
      const response = await fetch("/api/checkout/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reservationId,
          adDraftId: adDraft.id,
        }),
      });
      const body = (await response.json()) as {
        checkoutUrl?: string;
        error?: string;
      };

      if (!response.ok || !body.checkoutUrl) {
        setCheckoutResult({
          selectionKey,
          state: "error",
          message: body.error ?? "Failed to start checkout.",
        });
        return;
      }

      window.location.href = body.checkoutUrl;
    } catch {
      setCheckoutResult({
        selectionKey,
        state: "error",
        message: "Network error while creating checkout session.",
      });
    }
  }

  async function prepareAdPreview() {
    if (!targetUrl.startsWith("http")) {
      setPreviewResult({
        state: "error",
        message: "Enter a valid destination URL first.",
      });
      return;
    }

    setPreviewResult({
      state: "loading",
      message: null,
    });

    try {
      const response = await fetch("/api/ad/drafts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetUrl,
          customerEmail: customerEmail || undefined,
          headline: adHeadline || undefined,
          imageUrl: sourceImageUrl || undefined,
        }),
      });
      const body = (await response.json()) as {
        draft?: AdDraftPreview;
        error?: string;
        details?: string;
      };

      if (!response.ok || !body.draft) {
        setPreviewResult({
          state: "error",
          message: body.error ?? body.details ?? "Preview generation failed.",
        });
        return;
      }

      const nextHeadline = body.draft.headline ?? adHeadline;
      setAdDraft(body.draft);
      setAdHeadline(nextHeadline);
      setAdDraftSignature(
        draftSignatureFor(targetUrl, nextHeadline, sourceImageUrl),
      );

      setPreviewResult({
        state: "success",
        message: body.draft.warning
          ? `Preview saved. ${body.draft.warning}`
          : "Preview saved. The checkout will publish this stored draft.",
      });
    } catch {
      setPreviewResult({
        state: "error",
        message: "Network error while preparing the ad preview.",
      });
    }
  }

  return {
    adDraft,
    adHeadline,
    availabilityNote,
    availabilityState,
    checkoutMessage,
    checkoutState,
    checkAvailability,
    createReservation,
    customerEmail,
    isAdDraftCurrent,
    prepareAdPreview,
    previewResult,
    reservationMessage,
    reservationState,
    setAdHeadline,
    setCustomerEmail,
    setSourceImageUrl,
    setTargetUrl,
    sourceImageUrl,
    startCheckout,
    targetUrl,
  };
}

export type ClaimWorkflowState = ReturnType<typeof useClaimWorkflow>;
