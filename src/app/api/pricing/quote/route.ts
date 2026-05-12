import { NextRequest, NextResponse } from "next/server";

import { quoteRegionBigInt } from "@/lib/pricing";
import {
  parsePixelRectBigInt,
  validateSelectionForPurchaseBigInt,
} from "@/lib/selection";

const MAX_SAFE_INT_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

function serializeInteger(value: bigint): number | string {
  if (value > MAX_SAFE_INT_BIGINT || value < -MAX_SAFE_INT_BIGINT) {
    return value.toString();
  }

  return Number(value);
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = (await request.json()) as unknown;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsedRect = parsePixelRectBigInt(body);

  if (!parsedRect) {
    return NextResponse.json(
      {
        error:
          "Invalid payload. Expected x1,y1,x2,y2 as integers (number or integer string).",
      },
      { status: 400 },
    );
  }

  const validation = validateSelectionForPurchaseBigInt(parsedRect);

  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  let quote;

  try {
    quote = quoteRegionBigInt(validation.selection);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to calculate quote.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
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
  });
}
