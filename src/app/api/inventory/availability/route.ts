import { NextRequest, NextResponse } from "next/server";

import { quoteRegionBigInt } from "@/lib/pricing";
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

export async function POST(request: NextRequest) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsedRect = parsePixelRectBigInt(payload);

  if (!parsedRect) {
    return NextResponse.json(
      {
        error:
          "Expected selection object with integer x1,y1,x2,y2 (number or integer string).",
      },
      { status: 400 },
    );
  }

  const validation = validateSelectionForPurchaseBigInt(parsedRect);

  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const selection = validation.selection;

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

  if (!hasSupabaseServiceEnv()) {
    return NextResponse.json(
      {
        available: null,
        quote: serializeQuote(quote),
        warning:
          "Supabase environment is not configured yet. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      },
      { status: 503 },
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
        error: "Availability check failed.",
        details: completedOverlapError.message,
      },
      { status: 500 },
    );
  }

  if ((completedOverlap ?? []).length > 0) {
    return NextResponse.json({
      available: false,
      quote: serializeQuote(quote),
      warning: "This region has already been purchased.",
    });
  }

  const { data, error } = await supabase.rpc("region_is_available", {
    p_x1: selection.x1.toString(),
    p_y1: selection.y1.toString(),
    p_x2: selection.x2.toString(),
    p_y2: selection.y2.toString(),
  });

  if (error) {
    return NextResponse.json(
      {
        error: "Availability check failed.",
        details: error.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    available: Boolean(data),
    quote: serializeQuote(quote),
  });
}
