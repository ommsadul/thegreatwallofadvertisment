import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeAdHeadline } from "../src/lib/ad/ad-drafts";
import { buildWebsiteScreenshotUrl } from "../src/lib/ad/website-preview";
import { quoteRegion } from "../src/lib/pricing";
import { MAX_PURCHASE_PIXELS } from "../src/lib/pricing-zones";
import { validateSelectionForPurchaseBigInt } from "../src/lib/selection";
import {
  getViewportRect,
  rectsOverlap,
  screenToWorld,
  snapDragToRect,
  zoomCameraAtScreenPoint,
} from "../src/lib/wall/geometry";
import { serializeInteger, parseIntegerLike } from "../src/lib/wall/serialization";
import {
  tileBounds,
  tileForPoint,
  tileKey,
  tilesForViewport,
  WALL_TILE_SIZE,
} from "../src/lib/wall/tiles";

test("wall camera maps screen coordinates into world coordinates", () => {
  const camera = { originX: -1000, originY: -500, zoom: 1 };
  const bounds = {
    left: 0,
    top: 0,
    width: 2000,
    height: 1000,
  } as DOMRect;

  assert.deepEqual(screenToWorld({ clientX: 1000, clientY: 500 }, bounds, camera), {
    x: 0,
    y: 0,
  });
  assert.deepEqual(getViewportRect(camera), {
    x1: -1000,
    y1: -500,
    x2: 999,
    y2: 499,
  });
});

test("zooming keeps the world coordinate under the cursor stable", () => {
  const camera = { originX: -1000, originY: -500, zoom: 1 };
  const size = { width: 2000, height: 1000 };
  const next = zoomCameraAtScreenPoint(camera, { x: 1000, y: 500 }, size, 2);

  assert.equal(next.zoom, 2);
  assert.deepEqual(
    screenToWorld({ clientX: 1000, clientY: 500 }, { left: 0, top: 0, ...size } as DOMRect, next),
    { x: 0, y: 0 },
  );
});

test("selection snapping normalizes drag direction", () => {
  assert.deepEqual(snapDragToRect({ x: 12.8, y: 9.2 }, { x: -2.2, y: 21.9 }), {
    x1: -3,
    y1: 9,
    x2: 12,
    y2: 21,
  });
});

test("tile math supports negative coordinates", () => {
  const tile = tileForPoint({ x: -1, y: -513 });

  assert.deepEqual(tile, { x: -1, y: -2 });
  assert.equal(tileKey(tile), "-1:-2");
  assert.deepEqual(tileBounds(tile), {
    x1: -WALL_TILE_SIZE,
    y1: -WALL_TILE_SIZE * 2,
    x2: -1,
    y2: -WALL_TILE_SIZE - 1,
  });
});

test("viewport tile discovery includes a preload buffer", () => {
  const tiles = tilesForViewport({ x1: 0, y1: 0, x2: 511, y2: 511 }, 1);

  assert.equal(tiles.length, 9);
  assert.ok(tiles.some((tile) => tile.x === -1 && tile.y === -1));
  assert.ok(tiles.some((tile) => tile.x === 1 && tile.y === 1));
});

test("overlap and pricing stay inclusive by pixel", () => {
  assert.equal(rectsOverlap({ x1: 0, y1: 0, x2: 9, y2: 9 }, { x1: 9, y1: 9, x2: 20, y2: 20 }), true);

  const quote = quoteRegion({ x1: 0, y1: 0, x2: 9, y2: 9 });

  assert.equal(quote.totalPixels, 100);
  assert.equal(quote.totalCents, 20000);
});

test("purchase validation enforces Stripe-sized maximums", () => {
  const ok = validateSelectionForPurchaseBigInt({
    x1: 0n,
    y1: 0n,
    x2: BigInt(MAX_PURCHASE_PIXELS - 1),
    y2: 0n,
  });

  assert.equal(ok.valid, true);

  const tooLarge = validateSelectionForPurchaseBigInt({
    x1: 0n,
    y1: 0n,
    x2: BigInt(MAX_PURCHASE_PIXELS),
    y2: 0n,
  });

  assert.equal(tooLarge.valid, false);
});

test("integer serialization preserves values beyond JS safe number range", () => {
  const large = BigInt(Number.MAX_SAFE_INTEGER) + 99n;

  assert.equal(serializeInteger(large), large.toString());
  assert.equal(parseIntegerLike(large.toString()), large);
  assert.equal(parseIntegerLike("12.1"), null);
});

test("ad preview helpers keep user-facing copy bounded and public", () => {
  assert.equal(sanitizeAdHeadline("  Launch   day  "), "Launch day");
  assert.equal(sanitizeAdHeadline("x".repeat(140))?.length, 96);
  assert.equal(buildWebsiteScreenshotUrl("http://localhost:3000"), null);
  assert.ok(buildWebsiteScreenshotUrl("https://example.com")?.startsWith("https://s.wordpress.com/mshots/"));
});
