import {
  normalizeRect,
  normalizeRectBigInt,
  pixelCount,
  pixelCountBigInt,
  PixelRectBigInt,
} from "./selection";
import { PixelRect, PRICE_PER_PIXEL_CENTS } from "./pricing-zones";

export type RegionQuote = {
  selection: PixelRect;
  width: number;
  height: number;
  totalPixels: number;
  totalCents: number;
  totalDollars: number;
  pricePerPixelCents: number;
};

export function quoteRegion(rect: PixelRect): RegionQuote {
  const selection = normalizeRect(rect);

  const width = selection.x2 - selection.x1 + 1;
  const height = selection.y2 - selection.y1 + 1;
  const totalPixelsBig = pixelCount(selection);
  const totalCentsBig = totalPixelsBig * BigInt(PRICE_PER_PIXEL_CENTS);

  if (totalPixelsBig > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Selection is too large to quote safely.");
  }

  if (totalCentsBig > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Selection cost exceeds supported numeric limits.");
  }

  const totalPixels = Number(totalPixelsBig);
  const totalCents = Number(totalCentsBig);

  return {
    selection,
    width,
    height,
    totalPixels,
    totalCents,
    totalDollars: totalCents / 100,
    pricePerPixelCents: PRICE_PER_PIXEL_CENTS,
  };
}

export type RegionQuoteBigInt = {
  selection: PixelRectBigInt;
  width: bigint;
  height: bigint;
  totalPixels: bigint;
  totalCents: bigint;
  totalDollars: number;
  pricePerPixelCents: number;
};

export function quoteRegionBigInt(rect: PixelRectBigInt): RegionQuoteBigInt {
  const selection = normalizeRectBigInt(rect);

  const width = selection.x2 - selection.x1 + BigInt(1);
  const height = selection.y2 - selection.y1 + BigInt(1);
  const totalPixels = pixelCountBigInt(selection);
  const totalCents = totalPixels * BigInt(PRICE_PER_PIXEL_CENTS);

  return {
    selection,
    width,
    height,
    totalPixels,
    totalCents,
    totalDollars: Number(totalCents) / 100,
    pricePerPixelCents: PRICE_PER_PIXEL_CENTS,
  };
}
