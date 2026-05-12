export const PRICE_PER_PIXEL_CENTS = 200;
export const STRIPE_MAX_UNIT_AMOUNT_CENTS = 99_999_999;
export const MAX_PURCHASE_PIXELS = Math.floor(
  STRIPE_MAX_UNIT_AMOUNT_CENTS / PRICE_PER_PIXEL_CENTS,
);

export const DEFAULT_VIEWPORT_WORLD_WIDTH = 2000;
export const DEFAULT_VIEWPORT_WORLD_HEIGHT = 1000;

export type PixelRect = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};
