import {
  MAX_PURCHASE_PIXELS,
  PixelRect,
} from "@/lib/pricing-zones";

const MAX_SAFE_INT_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

export type PixelRectBigInt = {
  x1: bigint;
  y1: bigint;
  x2: bigint;
  y2: bigint;
};

function parseCoordinateBigInt(value: unknown): bigint | null {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      return null;
    }

    return BigInt(value);
  }

  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    try {
      return BigInt(value);
    } catch {
      return null;
    }
  }

  return null;
}

function toSafeNumber(value: bigint): number | null {
  if (value > MAX_SAFE_INT_BIGINT || value < -MAX_SAFE_INT_BIGINT) {
    return null;
  }

  return Number(value);
}

export function normalizeRect(rect: PixelRect): PixelRect {
  return {
    x1: Math.min(rect.x1, rect.x2),
    y1: Math.min(rect.y1, rect.y2),
    x2: Math.max(rect.x1, rect.x2),
    y2: Math.max(rect.y1, rect.y2),
  };
}

export function normalizeRectBigInt(rect: PixelRectBigInt): PixelRectBigInt {
  return {
    x1: rect.x1 < rect.x2 ? rect.x1 : rect.x2,
    y1: rect.y1 < rect.y2 ? rect.y1 : rect.y2,
    x2: rect.x1 > rect.x2 ? rect.x1 : rect.x2,
    y2: rect.y1 > rect.y2 ? rect.y1 : rect.y2,
  };
}

export function isFiniteRect(rect: unknown): rect is PixelRect {
  return parsePixelRect(rect) !== null;
}

export function parsePixelRectBigInt(rect: unknown): PixelRectBigInt | null {
  if (!rect || typeof rect !== "object") {
    return null;
  }

  const candidate = rect as Record<string, unknown>;
  const x1 = parseCoordinateBigInt(candidate.x1);
  const y1 = parseCoordinateBigInt(candidate.y1);
  const x2 = parseCoordinateBigInt(candidate.x2);
  const y2 = parseCoordinateBigInt(candidate.y2);

  if (x1 === null || y1 === null || x2 === null || y2 === null) {
    return null;
  }

  return { x1, y1, x2, y2 };
}

export function parsePixelRect(rect: unknown): PixelRect | null {
  const parsed = parsePixelRectBigInt(rect);
  if (!parsed) {
    return null;
  }

  const x1 = toSafeNumber(parsed.x1);
  const y1 = toSafeNumber(parsed.y1);
  const x2 = toSafeNumber(parsed.x2);
  const y2 = toSafeNumber(parsed.y2);

  if (x1 === null || y1 === null || x2 === null || y2 === null) {
    return null;
  }

  return { x1, y1, x2, y2 };
}

export function pixelCount(rect: PixelRect): bigint {
  const normalized = normalizeRect(rect);
  const width = BigInt(normalized.x2 - normalized.x1 + 1);
  const height = BigInt(normalized.y2 - normalized.y1 + 1);

  return width * height;
}

export function pixelCountBigInt(rect: PixelRectBigInt): bigint {
  const normalized = normalizeRectBigInt(rect);
  const width = normalized.x2 - normalized.x1 + BigInt(1);
  const height = normalized.y2 - normalized.y1 + BigInt(1);

  return width * height;
}

export function validateSelectionForPurchaseBigInt(
  rect: PixelRectBigInt,
): { valid: true; selection: PixelRectBigInt; totalPixels: bigint } | {
  valid: false;
  error: string;
} {
  const normalized = normalizeRectBigInt(rect);
  const totalPixels = pixelCountBigInt(normalized);

  if (totalPixels > BigInt(MAX_PURCHASE_PIXELS)) {
    return {
      valid: false,
      error: `Selection is too large. Maximum ${MAX_PURCHASE_PIXELS.toLocaleString()} pixels per checkout.`,
    };
  }

  return {
    valid: true,
    selection: normalized,
    totalPixels,
  };
}

export function validateSelectionForPurchase(
  rect: PixelRect,
): { valid: true; selection: PixelRect; totalPixels: bigint } | {
  valid: false;
  error: string;
} {
  const validation = validateSelectionForPurchaseBigInt({
    x1: BigInt(rect.x1),
    y1: BigInt(rect.y1),
    x2: BigInt(rect.x2),
    y2: BigInt(rect.y2),
  });

  if (!validation.valid) {
    return validation;
  }

  const normalized = normalizeRect(rect);
  const totalPixels = validation.totalPixels;

  if (totalPixels > BigInt(MAX_PURCHASE_PIXELS)) {
    return {
      valid: false,
      error: `Selection is too large. Maximum ${MAX_PURCHASE_PIXELS.toLocaleString()} pixels per checkout.`,
    };
  }

  return {
    valid: true,
    selection: normalized,
    totalPixels,
  };
}
