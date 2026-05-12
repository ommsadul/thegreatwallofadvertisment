"use client";

import { useEffect, useMemo, useState } from "react";

import { quoteRegion } from "@/lib/pricing";
import {
  DEFAULT_VIEWPORT_WORLD_HEIGHT,
  DEFAULT_VIEWPORT_WORLD_WIDTH,
  PixelRect,
} from "@/lib/pricing-zones";

type AdMeta = {
  imageUrl: string | null;
  targetUrl: string | null;
  headline: string | null;
};

function prettyUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

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

function getHostname(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  try {
    const url = new URL(value);
    return url.hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

function isExternalHttpUrl(value: string | null | undefined): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

function snapDragToRect(
  start: { x: number; y: number },
  end: { x: number; y: number },
): PixelRect {
  const minX = Math.min(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxX = Math.max(start.x, end.x);
  const maxY = Math.max(start.y, end.y);

  return {
    x1: Math.floor(minX),
    y1: Math.floor(minY),
    x2: Math.floor(maxX),
    y2: Math.floor(maxY),
  };
}

export default function PricingPreview() {
  const defaultViewportOrigin = { x: -1000, y: -500 };

  const [occupiedRegions, setOccupiedRegions] = useState<
    Array<{
      id: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      state: "sold" | "pending";
      ad: AdMeta | null;
    }>
  >([]);
  const [previewAd, setPreviewAd] = useState<AdMeta | null>(null);
  const [pendingAdClick, setPendingAdClick] = useState<{
    id: string;
    clientX: number;
    clientY: number;
    targetUrl: string;
  } | null>(null);
  const [selectedRect, setSelectedRect] = useState<PixelRect | null>(null);
  const [selectionStart, setSelectionStart] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [panAnchor, setPanAnchor] = useState<{
    clientX: number;
    clientY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const [pointerMode, setPointerMode] = useState<"select" | "pan">("pan");
  const [zoom, setZoom] = useState(1);
  const [viewportOrigin, setViewportOrigin] = useState(defaultViewportOrigin);
  const [customerEmail, setCustomerEmail] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [adImageUrl, setAdImageUrl] = useState("");
  const [adHeadline, setAdHeadline] = useState("");
  const [autofillResult, setAutofillResult] = useState<{
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

  const viewportWorldWidth = Math.max(
    1,
    Math.floor(DEFAULT_VIEWPORT_WORLD_WIDTH / zoom),
  );
  const viewportWorldHeight = Math.max(
    1,
    Math.floor(DEFAULT_VIEWPORT_WORLD_HEIGHT / zoom),
  );

  const liveSelection = useMemo<PixelRect | null>(() => {
    if (!selectionStart || !selectionEnd) {
      return null;
    }

    return snapDragToRect(selectionStart, selectionEnd);
  }, [selectionStart, selectionEnd]);

  const selection = liveSelection ?? selectedRect;

  const quote = useMemo(() => {
    if (!selection) {
      return null;
    }

    try {
      return quoteRegion(selection);
    } catch {
      return null;
    }
  }, [selection]);

  const selectionOverlay = useMemo(() => {
    if (!quote) {
      return null;
    }

    const leftPercent =
      ((quote.selection.x1 - viewportOrigin.x) / viewportWorldWidth) * 100;
    const topPercent =
      ((quote.selection.y1 - viewportOrigin.y) / viewportWorldHeight) * 100;
    const widthPercent = (quote.width / viewportWorldWidth) * 100;
    const heightPercent = (quote.height / viewportWorldHeight) * 100;

    return {
      leftPercent,
      topPercent,
      widthPercent,
      heightPercent,
      style: {
        left: `${leftPercent}%`,
        top: `${topPercent}%`,
        width: `${widthPercent}%`,
        height: `${heightPercent}%`,
      },
    };
  }, [quote, viewportOrigin.x, viewportOrigin.y, viewportWorldWidth, viewportWorldHeight]);

  const tinySelectionMarker = useMemo(() => {
    if (pointerMode !== "select") {
      return null;
    }

    if (!selectionOverlay) {
      return null;
    }

    const isTiny = selectionOverlay.widthPercent < 1 || selectionOverlay.heightPercent < 1;
    if (!isTiny) {
      return null;
    }

    const markerSize = 14;
    const centerX = selectionOverlay.leftPercent + selectionOverlay.widthPercent / 2;
    const centerY = selectionOverlay.topPercent + selectionOverlay.heightPercent / 2;

    return {
      left: `calc(${centerX}% - ${markerSize / 2}px)`,
      top: `calc(${centerY}% - ${markerSize / 2}px)`,
      width: `${markerSize}px`,
      height: `${markerSize}px`,
    };
  }, [selectionOverlay, pointerMode]);

  const occupiedOverlays = useMemo(() => {
    return occupiedRegions
      .map((region) => {
        const visibleX1 = Math.max(region.x1, viewportOrigin.x);
        const visibleY1 = Math.max(region.y1, viewportOrigin.y);
        const visibleX2 = Math.min(
          region.x2,
          viewportOrigin.x + viewportWorldWidth - 1,
        );
        const visibleY2 = Math.min(
          region.y2,
          viewportOrigin.y + viewportWorldHeight - 1,
        );

        if (visibleX1 > visibleX2 || visibleY1 > visibleY2) {
          return null;
        }

        const width = visibleX2 - visibleX1 + 1;
        const height = visibleY2 - visibleY1 + 1;

        return {
          id: region.id,
          state: region.state,
          ad: region.ad,
          style: {
            left: `${((visibleX1 - viewportOrigin.x) / viewportWorldWidth) * 100}%`,
            top: `${((visibleY1 - viewportOrigin.y) / viewportWorldHeight) * 100}%`,
            width: `${(width / viewportWorldWidth) * 100}%`,
            height: `${(height / viewportWorldHeight) * 100}%`,
          },
        };
      })
      .filter(
        (overlay): overlay is {
          id: string;
          state: "sold" | "pending";
          ad: {
            imageUrl: string | null;
            targetUrl: string | null;
            headline: string | null;
          } | null;
          style: { left: string; top: string; width: string; height: string };
        } => overlay !== null,
      );
  }, [occupiedRegions, viewportOrigin.x, viewportOrigin.y, viewportWorldWidth, viewportWorldHeight]);

  const selectionKey = quote
    ? `${quote.selection.x1}-${quote.selection.y1}-${quote.selection.x2}-${quote.selection.y2}`
    : "none";

  function pointToWorld(
    clientX: number,
    clientY: number,
    rect: DOMRect,
  ): { x: number; y: number } {
    const relativeX = (clientX - rect.left) / rect.width;
    const relativeY = (clientY - rect.top) / rect.height;

    const rawX = viewportOrigin.x + relativeX * viewportWorldWidth;
    const rawY = viewportOrigin.y + relativeY * viewportWorldHeight;

    const minX = viewportOrigin.x;
    const minY = viewportOrigin.y;
    const maxX = viewportOrigin.x + viewportWorldWidth - Number.EPSILON;
    const maxY = viewportOrigin.y + viewportWorldHeight - Number.EPSILON;

    const x = Math.max(minX, Math.min(maxX, rawX));
    const y = Math.max(minY, Math.min(maxY, rawY));

    return { x, y };
  }

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

  const cellWidthPercent = 100 / viewportWorldWidth;
  const cellHeightPercent = 100 / viewportWorldHeight;
  const normalizedOffsetX = ((viewportOrigin.x % viewportWorldWidth) + viewportWorldWidth) % viewportWorldWidth;
  const normalizedOffsetY = ((viewportOrigin.y % viewportWorldHeight) + viewportWorldHeight) % viewportWorldHeight;
  const gridOffsetXPercent = -(normalizedOffsetX * cellWidthPercent);
  const gridOffsetYPercent = -(normalizedOffsetY * cellHeightPercent);

  useEffect(() => {
    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/wall/regions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            x1: viewportOrigin.x,
            y1: viewportOrigin.y,
            x2: viewportOrigin.x + viewportWorldWidth - 1,
            y2: viewportOrigin.y + viewportWorldHeight - 1,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          return;
        }

        const body = (await response.json()) as {
          regions?: Array<{
            id: string;
            x1: number;
            y1: number;
            x2: number;
            y2: number;
            state: "sold" | "pending";
            ad: {
              imageUrl: string | null;
              targetUrl: string | null;
              headline: string | null;
            } | null;
          }>;
        };

        setOccupiedRegions(body.regions ?? []);
      } catch {
        // Keep last known regions on transient network failure.
      }
    }, 150);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [viewportOrigin.x, viewportOrigin.y, viewportWorldWidth, viewportWorldHeight]);

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
        message: `Reservation ${body.reservationId} is locked (${remainingText}) until ${formatExpiry(body.expiresAt)}.`,
        reservationId: body.reservationId ?? null,
      });
      setAvailabilityResult({
        selectionKey,
        state: "unavailable",
        note: "This selection is now locked by your reservation.",
      });
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
          targetUrl,
          imageUrl: adImageUrl || undefined,
          headline: adHeadline || undefined,
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

  async function autofillAdFromTargetUrl() {
    if (!targetUrl.startsWith("http")) {
      setAutofillResult({
        state: "error",
        message: "Enter a valid destination URL first.",
      });
      return;
    }

    setAutofillResult({
      state: "loading",
      message: null,
    });

    try {
      const response = await fetch("/api/ad/autofill", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetUrl,
        }),
      });

      const body = (await response.json()) as {
        headline?: string | null;
        imageUrl?: string | null;
        warning?: string;
        error?: string;
      };

      if (!response.ok) {
        setAutofillResult({
          state: "error",
          message: body.error ?? "Could not auto-fill this URL.",
        });
        return;
      }

      if (body.headline && !adHeadline) {
        setAdHeadline(body.headline);
      }

      if (body.imageUrl && !adImageUrl) {
        setAdImageUrl(body.imageUrl);
      }

      if (body.warning) {
        setAutofillResult({
          state: "success",
          message: body.warning,
        });
        return;
      }

      setAutofillResult({
        state: "success",
        message: body.imageUrl || body.headline
          ? "Auto-fill complete. You can edit fields before checkout."
          : "No preview metadata found. You can still continue with just the URL.",
      });
    } catch {
      setAutofillResult({
        state: "error",
        message: "Network error while auto-filling ad details.",
      });
    }
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#8a8a8a] text-white">
      <div
        className={`absolute inset-0 select-none touch-action-none ${
          pointerMode === "pan" ? (panAnchor ? "cursor-grabbing" : "cursor-grab") : "cursor-crosshair"
        }`}
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.16) 0px, rgba(255,255,255,0.16) 1px, transparent 1px, transparent 100%), repeating-linear-gradient(90deg, rgba(255,255,255,0.16) 0px, rgba(255,255,255,0.16) 1px, transparent 1px, transparent 100%)",
          backgroundSize: `${cellWidthPercent}% ${cellHeightPercent}%`,
          backgroundPosition: `${gridOffsetXPercent}% ${gridOffsetYPercent}%`,
          backgroundColor: "#858585",
        }}
      />
      <div
        className="absolute inset-0 select-none touch-action-none"
        style={{
          cursor: pointerMode === "pan" ? (panAnchor ? "grabbing" : "grab") : "crosshair",
        }}
        onWheel={(event) => {
          event.preventDefault();

          setZoom((previous) => {
            if (event.deltaY < 0) {
              return Math.min(8, Number((previous * 1.15).toFixed(2)));
            }

            return Math.max(0.25, Number((previous / 1.15).toFixed(2)));
          });
        }}
        onPointerDown={(event) => {
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();

          if (pointerMode === "pan") {
            setPanAnchor({
              clientX: event.clientX,
              clientY: event.clientY,
              originX: viewportOrigin.x,
              originY: viewportOrigin.y,
            });
            return;
          }

          const point = pointToWorld(event.clientX, event.clientY, rect);
          setSelectionStart(point);
          setSelectionEnd(point);
          setSelectedRect(null);
        }}
        onPointerMove={(event) => {
          if (pointerMode === "pan") {
            if (!panAnchor) {
              return;
            }

            const deltaClientX = event.clientX - panAnchor.clientX;
            const deltaClientY = event.clientY - panAnchor.clientY;
            const deltaWorldX = Math.floor(
              (deltaClientX / window.innerWidth) * viewportWorldWidth,
            );
            const deltaWorldY = Math.floor(
              (deltaClientY / window.innerHeight) * viewportWorldHeight,
            );

            setViewportOrigin({
              x: panAnchor.originX - deltaWorldX,
              y: panAnchor.originY - deltaWorldY,
            });
            return;
          }

          if (!selectionStart) {
            return;
          }

          const rect = event.currentTarget.getBoundingClientRect();
          const point = pointToWorld(event.clientX, event.clientY, rect);
          setSelectionEnd(point);
        }}
        onPointerUp={() => {
          if (pointerMode === "select" && selectionStart && selectionEnd) {
            setSelectedRect(snapDragToRect(selectionStart, selectionEnd));
          }

          setPanAnchor(null);
          setSelectionStart(null);
          setSelectionEnd(null);
        }}
        onPointerLeave={() => {
          setPanAnchor(null);
          setSelectionStart(null);
          setSelectionEnd(null);
          setPendingAdClick(null);
        }}
      >
        {occupiedOverlays.map((overlay) => (
          <div
            key={overlay.id}
            className={`absolute overflow-hidden ${
              pointerMode === "pan" &&
              overlay.state === "sold" &&
              isExternalHttpUrl(overlay.ad?.targetUrl)
                ? "cursor-pointer"
                : ""
            }`}
            style={overlay.style}
            onPointerDown={(event) => {
              if (
                pointerMode === "pan" &&
                overlay.state === "sold" &&
                isExternalHttpUrl(overlay.ad?.targetUrl)
              ) {
                setPendingAdClick({
                  id: overlay.id,
                  clientX: event.clientX,
                  clientY: event.clientY,
                  targetUrl: overlay.ad.targetUrl,
                });
              }
            }}
            onPointerEnter={() => {
              if (pointerMode === "pan" && overlay.state === "sold" && overlay.ad) {
                setPreviewAd(overlay.ad);
              }
            }}
            onPointerLeave={() => {
              setPreviewAd(null);
            }}
            onPointerUp={(event) => {
              if (!pendingAdClick || pendingAdClick.id !== overlay.id) {
                return;
              }

              const movedX = Math.abs(event.clientX - pendingAdClick.clientX);
              const movedY = Math.abs(event.clientY - pendingAdClick.clientY);
              const clickDistanceThreshold = 6;

              if (
                movedX <= clickDistanceThreshold &&
                movedY <= clickDistanceThreshold &&
                pointerMode === "pan"
              ) {
                window.open(pendingAdClick.targetUrl, "_blank", "noopener,noreferrer");
              }

              setPendingAdClick(null);
            }}
            onPointerCancel={() => {
              setPendingAdClick(null);
            }}
          >
            {overlay.state === "sold" ? (
              overlay.ad?.imageUrl ? (
                <div className="relative h-full w-full border border-rose-200 bg-black/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={overlay.ad.imageUrl}
                    alt={overlay.ad.headline ?? "Ad creative"}
                    className="h-full w-full object-cover opacity-90"
                    draggable={false}
                  />
                </div>
              ) : (
                <div className="flex h-full w-full flex-col justify-between border border-rose-200 bg-rose-500/35 p-1 text-[9px] leading-tight text-white">
                  <span className="font-semibold uppercase tracking-wide">
                    {overlay.ad?.headline?.trim() || "Sponsored"}
                  </span>
                  <span className="opacity-90">
                    {getHostname(overlay.ad?.targetUrl) || "link ad"}
                  </span>
                </div>
              )
            ) : (
              <div className="h-full w-full border border-cyan-200 bg-cyan-500/30" />
            )}
          </div>
        ))}

        {selectionOverlay ? (
          <div
            className="pointer-events-none absolute border-2 border-yellow-100 bg-yellow-300/85 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]"
            style={selectionOverlay.style}
          />
        ) : null}

        {tinySelectionMarker ? (
          <div
            className="absolute rounded-full border-2 border-yellow-100 bg-yellow-300/50 shadow-[0_0_0_2px_rgba(0,0,0,0.25)]"
            style={tinySelectionMarker}
          />
        ) : null}
      </div>

      {pointerMode === "pan" && previewAd ? (
        <div className="pointer-events-none absolute top-14 left-3 z-30 w-64 overflow-hidden rounded border border-white/30 bg-black/75 shadow-lg backdrop-blur">
          {previewAd.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewAd.imageUrl}
              alt={previewAd.headline ?? "Ad preview"}
              className="h-36 w-full object-cover"
              draggable={false}
            />
          ) : (
            <div className="flex h-36 w-full items-center justify-center bg-zinc-800/70 text-xs text-white/70">
              No image preview
            </div>
          )}
          <div className="space-y-1 p-2 text-xs">
            <p className="font-semibold text-yellow-100">
              {previewAd.headline?.trim() || "Sponsored"}
            </p>
            <p className="truncate text-white/80">
              {previewAd.targetUrl || "No destination URL"}
            </p>
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none absolute top-3 right-3 rounded border border-white/30 bg-black/50 px-2 py-1 text-xs">
        Origin: {viewportOrigin.x}, {viewportOrigin.y} | Zoom: {zoom.toFixed(2)}x
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 max-w-[420px] rounded border border-white/20 bg-black/55 px-3 py-2 text-[11px] leading-5 text-white/90">
        <span className="font-semibold text-yellow-200">Modes:</span> Select = drag to choose purchasable pixels. Pan = drag to move and click sold ads to visit websites. Reset Pixels = clear selected region.
      </div>

      <div className="absolute top-3 left-3 flex gap-2">
        <button
          type="button"
          onClick={() => setPointerMode("select")}
          className={`rounded border px-3 py-1 text-xs ${
            pointerMode === "select"
              ? "border-yellow-200 bg-yellow-200 text-black"
              : "border-white/30 bg-black/45 text-white"
          }`}
        >
          Select
        </button>
        <button
          type="button"
          onClick={() => setPointerMode("pan")}
          className={`rounded border px-3 py-1 text-xs ${
            pointerMode === "pan"
              ? "border-yellow-200 bg-yellow-200 text-black"
              : "border-white/30 bg-black/45 text-white"
          }`}
        >
          Pan
        </button>
        <button
          type="button"
          onClick={() => {
            setSelectedRect(null);
            setSelectionStart(null);
            setSelectionEnd(null);
          }}
          disabled={!selection}
          className={`rounded border px-3 py-1 text-xs ${
            selection
              ? "border-yellow-200 bg-yellow-200 text-black"
              : "border-white/30 bg-black/45 text-white/60"
          }`}
        >
          Reset Pixels
        </button>
      </div>

      <aside className="absolute right-3 bottom-3 w-[360px] max-w-[calc(100vw-1.5rem)] max-h-[60vh] overflow-auto rounded-xl border border-white/20 bg-black/65 p-4 backdrop-blur">
        <h2 className="text-sm font-semibold tracking-wide uppercase">Infinite Pixel Sheet</h2>
        <p className="mt-1 text-xs text-white/75">Price: 2 dollars per pixel.</p>
        <p className="mt-1 text-[11px] text-white/65">Legend: red = sold, cyan = currently reserved.</p>

        <div className="mt-3 rounded border border-white/20 bg-white/5 p-3 text-xs">
          {quote ? (
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Selection</span>
                <span>
                  ({quote.selection.x1}, {quote.selection.y1}) - ({quote.selection.x2}, {quote.selection.y2})
                </span>
              </div>
              <div className="flex justify-between">
                <span>Total Pixels</span>
                <span>{quote.totalPixels.toLocaleString()}</span>
              </div>
              <div className="mt-1 flex justify-between text-sm font-semibold text-yellow-200">
                <span>Total</span>
                <span>{prettyUsd(quote.totalCents)}</span>
              </div>
            </div>
          ) : (
            <p className="text-white/70">Drag on the sheet in Select mode to choose pixels.</p>
          )}
        </div>

        <div className="mt-3 space-y-2 text-xs">
          <label className="block" htmlFor="reserve-email">
            Buyer Email
          </label>
          <input
            id="reserve-email"
            type="email"
            value={customerEmail}
            onChange={(event) => setCustomerEmail(event.target.value)}
            className="w-full rounded border border-white/25 bg-black/50 px-2 py-2 text-sm outline-none focus:border-yellow-200"
            placeholder="you@example.com"
          />

          <label className="block" htmlFor="target-url">
            Destination URL
          </label>
          <input
            id="target-url"
            type="url"
            value={targetUrl}
            onChange={(event) => setTargetUrl(event.target.value)}
            className="w-full rounded border border-white/25 bg-black/50 px-2 py-2 text-sm outline-none focus:border-yellow-200"
            placeholder="https://example.com"
          />
          <button
            type="button"
            onClick={autofillAdFromTargetUrl}
            disabled={autofillResult.state === "loading"}
            className="w-full rounded border border-white/30 bg-white/10 px-2 py-2 text-xs disabled:opacity-50"
          >
            {autofillResult.state === "loading"
              ? "Fetching Website Preview..."
              : "Auto-fill Ad From URL"}
          </button>
          {autofillResult.message ? (
            <p
              className={
                autofillResult.state === "error"
                  ? "text-[11px] text-rose-200"
                  : "text-[11px] text-emerald-200"
              }
            >
              {autofillResult.message}
            </p>
          ) : null}

          <label className="block" htmlFor="ad-image-url">
            Ad Image URL (optional)
          </label>
          <input
            id="ad-image-url"
            type="url"
            value={adImageUrl}
            onChange={(event) => setAdImageUrl(event.target.value)}
            className="w-full rounded border border-white/25 bg-black/50 px-2 py-2 text-sm outline-none focus:border-yellow-200"
            placeholder="https://your-site.com/banner.png"
          />
          <p className="text-[11px] text-white/65">
            URL only works too. If no image is provided, we render a text ad tile from your link.
          </p>

          <label className="block" htmlFor="ad-headline">
            Ad Headline (optional)
          </label>
          <input
            id="ad-headline"
            type="text"
            value={adHeadline}
            onChange={(event) => setAdHeadline(event.target.value)}
            className="w-full rounded border border-white/25 bg-black/50 px-2 py-2 text-sm outline-none focus:border-yellow-200"
            placeholder="Short ad title"
          />

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={checkAvailability}
              disabled={availabilityState === "checking" || !quote}
              className="rounded border border-white/30 bg-white/10 px-2 py-2 text-xs disabled:opacity-50"
            >
              {availabilityState === "checking" ? "Checking..." : "Check"}
            </button>
            <button
              type="button"
              onClick={createReservation}
              disabled={reservationState === "creating" || !quote}
              className="rounded border border-yellow-200 bg-yellow-200 px-2 py-2 text-xs font-semibold text-black disabled:opacity-50"
            >
              {reservationState === "creating" ? "Reserving..." : "Reserve"}
            </button>
          </div>

          <button
            type="button"
            onClick={startCheckout}
            disabled={checkoutState === "creating" || reservationState !== "created"}
            className="w-full rounded border border-cyan-300/60 bg-cyan-400/20 px-2 py-2 text-xs font-semibold disabled:opacity-50"
          >
            {checkoutState === "creating" ? "Redirecting..." : "Continue to Checkout"}
          </button>

          <div className="space-y-1 text-[11px] text-white/80">
            <p>
              Availability:{" "}
              {availabilityState === "available"
                ? "Available"
                : availabilityState === "unavailable"
                  ? "Unavailable"
                  : availabilityState === "checking"
                    ? "Checking"
                    : availabilityState === "error"
                      ? "Error"
                      : "Not checked"}
            </p>
            {availabilityNote ? <p className="text-amber-200">{availabilityNote}</p> : null}
            {reservationMessage ? (
              <p className={reservationState === "created" ? "text-emerald-200" : "text-rose-200"}>
                {reservationMessage}
              </p>
            ) : null}
            {checkoutMessage ? <p className="text-rose-200">{checkoutMessage}</p> : null}
          </div>
        </div>
      </aside>
    </div>
  );
}
