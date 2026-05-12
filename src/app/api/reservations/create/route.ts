import { NextRequest, NextResponse } from "next/server";

import { quoteRegionBigInt } from "@/lib/pricing";
import { PRICE_PER_PIXEL_CENTS } from "@/lib/pricing-zones";
import {
  parsePixelRectBigInt,
  validateSelectionForPurchaseBigInt,
} from "@/lib/selection";
import {
  getSupabaseAdminClient,
  hasSupabaseServiceEnv,
} from "@/lib/supabase/server";

const MAX_SAFE_INT_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

function serializeInteger(value: bigint): number | string {
  if (value > MAX_SAFE_INT_BIGINT || value < -MAX_SAFE_INT_BIGINT) {
    return value.toString();
  }

  return Number(value);
}

function serializeQuote(quote: ReturnType<typeof quoteRegionBigInt>) {
  return {
    selection: {
      x1: serializeInteger(quote.selection.x1),
      y1: serializeInteger(quote.selection.y1),
      x2: serializeInteger(quote.selection.x2),
      y2: serializeInteger(quote.selection.y2),
    },
    width: Number(quote.width),
    height: Number(quote.height),
    totalPixels: Number(quote.totalPixels),
    totalCents: Number(quote.totalCents),
    totalDollars: quote.totalDollars,
    pricePerPixelCents: quote.pricePerPixelCents,
  };
}

type ReservationPayload = {
  selection: unknown;
  customerEmail: string;
  holdMinutes?: number;
};

function isReservationPayload(payload: unknown): payload is ReservationPayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Record<string, unknown>;

  const holdMinutes = candidate.holdMinutes;

  return (
    typeof candidate.customerEmail === "string" &&
    candidate.customerEmail.includes("@") &&
    parsePixelRectBigInt(candidate.selection) !== null &&
    (holdMinutes === undefined ||
      (typeof holdMinutes === "number" && Number.isFinite(holdMinutes)))
  );
}

export async function POST(request: NextRequest) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isReservationPayload(payload)) {
    return NextResponse.json(
      {
        error:
          "Expected customerEmail and selection with integer x1,y1,x2,y2.",
      },
      { status: 400 },
    );
  }

  const parsedRect = parsePixelRectBigInt(payload.selection);

  if (!parsedRect) {
    return NextResponse.json(
      {
        error:
          "Expected selection with integer x1,y1,x2,y2 (number or integer string).",
      },
      { status: 400 },
    );
  }

  const validation = validateSelectionForPurchaseBigInt(parsedRect);

  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const selection = validation.selection;

  if (!hasSupabaseServiceEnv()) {
    return NextResponse.json(
      {
        error:
          "Supabase environment is not configured yet. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      },
      { status: 503 },
    );
  }

  const holdMinutesRaw = payload.holdMinutes ?? 15;
  const holdMinutes = Math.max(5, Math.min(30, Math.floor(holdMinutesRaw)));

  let quote;

  try {
    quote = quoteRegionBigInt(selection);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to calculate quote.",
      },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdminClient();

  const { data: completedOverlap, error: completedOverlapError } = await supabase
    .from("pixel_reservations")
    .select("id")
    .eq("status", "completed")
    .lte("x1", selection.x2.toString())
    .gte("x2", selection.x1.toString())
    .lte("y1", selection.y2.toString())
    .gte("y2", selection.y1.toString())
    .limit(1);

  if (completedOverlapError) {
    return NextResponse.json(
      {
        error: "Failed to validate reservation overlap.",
        details: completedOverlapError.message,
      },
      { status: 500 },
    );
  }

  if ((completedOverlap ?? []).length > 0) {
    return NextResponse.json(
      {
        error: "Selected region is already sold.",
      },
      { status: 409 },
    );
  }

  const { data, error } = await supabase.rpc("create_region_reservation", {
    p_x1: selection.x1.toString(),
    p_y1: selection.y1.toString(),
    p_x2: selection.x2.toString(),
    p_y2: selection.y2.toString(),
    p_customer_email: payload.customerEmail,
    p_quote_cents: Number(quote.totalCents),
    p_zone_breakdown: {
      pricing_model: "flat",
      price_per_pixel_cents: PRICE_PER_PIXEL_CENTS,
    },
    p_hold_minutes: holdMinutes,
  });

  if (error) {
    const notAvailable = error.message.includes("REGION_NOT_AVAILABLE");

    return NextResponse.json(
      {
        error: notAvailable
          ? "Selected region is no longer available."
          : "Failed to create reservation.",
        details: error.message,
      },
      { status: notAvailable ? 409 : 500 },
    );
  }

  const firstRow = Array.isArray(data) ? data[0] : data;

  return NextResponse.json(
    {
      reservationId: firstRow?.reservation_id,
      expiresAt: firstRow?.expires_at,
      holdMinutes,
      selection: {
        x1: serializeInteger(selection.x1),
        y1: serializeInteger(selection.y1),
        x2: serializeInteger(selection.x2),
        y2: serializeInteger(selection.y2),
      },
      quote: serializeQuote(quote),
    },
    { status: 201 },
  );
}
