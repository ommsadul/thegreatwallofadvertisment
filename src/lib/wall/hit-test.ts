import type { PixelRect } from "../pricing-zones";
import { rectContainsPoint, rectsOverlap } from "./geometry";
import type { WallRegion, WorldPoint } from "./types";

export function hitTestRegions(
  regions: WallRegion[],
  point: WorldPoint,
): WallRegion | null {
  for (let index = regions.length - 1; index >= 0; index -= 1) {
    const region = regions[index];

    if (rectContainsPoint(region, point)) {
      return region;
    }
  }

  return null;
}

export function filterRegionsForViewport(
  regions: WallRegion[],
  viewport: PixelRect,
): WallRegion[] {
  return regions.filter((region) => rectsOverlap(region, viewport));
}

export function dedupeRegions(regions: WallRegion[]): WallRegion[] {
  const seen = new Set<string>();
  const result: WallRegion[] = [];

  for (const region of regions) {
    if (seen.has(region.id)) {
      continue;
    }

    seen.add(region.id);
    result.push(region);
  }

  return result;
}
