import type { PixelRect } from "../pricing-zones";
import type { TileCoord } from "./types";

export const WALL_TILE_SIZE = 512;
export const MAX_TILE_REQUEST_COUNT = 64;

function floorDiv(value: number, divisor: number): number {
  return Math.floor(value / divisor);
}

export function tileKey(tile: TileCoord): string {
  return `${tile.x}:${tile.y}`;
}

export function parseTileKey(key: string): TileCoord | null {
  const [xRaw, yRaw] = key.split(":");
  const x = Number(xRaw);
  const y = Number(yRaw);

  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) {
    return null;
  }

  return { x, y };
}

export function tileBounds(tile: TileCoord): PixelRect {
  const x1 = tile.x * WALL_TILE_SIZE;
  const y1 = tile.y * WALL_TILE_SIZE;

  return {
    x1,
    y1,
    x2: x1 + WALL_TILE_SIZE - 1,
    y2: y1 + WALL_TILE_SIZE - 1,
  };
}

export function tileForPoint(point: { x: number; y: number }): TileCoord {
  return {
    x: floorDiv(point.x, WALL_TILE_SIZE),
    y: floorDiv(point.y, WALL_TILE_SIZE),
  };
}

export function tilesForViewport(viewport: PixelRect, buffer = 1): TileCoord[] {
  const startX = floorDiv(viewport.x1, WALL_TILE_SIZE) - buffer;
  const endX = floorDiv(viewport.x2, WALL_TILE_SIZE) + buffer;
  const startY = floorDiv(viewport.y1, WALL_TILE_SIZE) - buffer;
  const endY = floorDiv(viewport.y2, WALL_TILE_SIZE) + buffer;
  const tiles: TileCoord[] = [];

  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      tiles.push({ x, y });
    }
  }

  return tiles;
}

export function dedupeTiles(tiles: TileCoord[]): TileCoord[] {
  const seen = new Set<string>();
  const result: TileCoord[] = [];

  for (const tile of tiles) {
    const key = tileKey(tile);

    if (!seen.has(key)) {
      seen.add(key);
      result.push(tile);
    }
  }

  return result;
}

export function unionTileBounds(tiles: TileCoord[]): PixelRect | null {
  if (tiles.length === 0) {
    return null;
  }

  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;

  for (const tile of tiles) {
    const bounds = tileBounds(tile);
    x1 = Math.min(x1, bounds.x1);
    y1 = Math.min(y1, bounds.y1);
    x2 = Math.max(x2, bounds.x2);
    y2 = Math.max(y2, bounds.y2);
  }

  return { x1, y1, x2, y2 };
}
