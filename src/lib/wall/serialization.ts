const MAX_SAFE_INT_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

export function serializeInteger(value: bigint): number | string {
  if (value > MAX_SAFE_INT_BIGINT || value < -MAX_SAFE_INT_BIGINT) {
    return value.toString();
  }

  return Number(value);
}

export function parseIntegerLike(value: unknown): bigint | null {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number" && Number.isSafeInteger(value)) {
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

export function integerLikeToSafeNumber(value: unknown): number | null {
  const parsed = parseIntegerLike(value);

  if (parsed === null || parsed > MAX_SAFE_INT_BIGINT || parsed < -MAX_SAFE_INT_BIGINT) {
    return null;
  }

  return Number(parsed);
}

export function formatBigIntDimension(value: bigint): string {
  return value > MAX_SAFE_INT_BIGINT ? value.toLocaleString("en-US") : Number(value).toLocaleString("en-US");
}

