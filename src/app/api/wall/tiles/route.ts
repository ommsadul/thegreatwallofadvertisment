import { NextRequest, NextResponse } from "next/server";

import {
  getSupabaseAdminClient,
  hasSupabaseServiceEnv,
} from "@/lib/supabase/server";
import { rectsOverlap } from "@/lib/wall/geometry";
import { integerLikeToSafeNumber } from "@/lib/wall/serialization";
import {
  dedupeTiles,
  MAX_TILE_REQUEST_COUNT,
  tileBounds,
  tileKey,
  unionTileBounds,
  WALL_TILE_SIZE,
} from "@/lib/wall/tiles";
import type { AdMeta, TileCoord, WallRegion } from "@/lib/wall/types";

type TileRequestPayload = {
  tiles: unknown;
};

type TileResponse = {
  key: string;
  tile: TileCoord;
  bounds: ReturnType<typeof tileBounds>;
  regions: WallRegion[];
  truncated: boolean;
};

const MAX_REGIONS_PER_QUERY = 5000;
const MAX_REGIONS_PER_TILE = 1000;

function parseTileCoord(value: unknown): TileCoord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const x = Number(candidate.x);
  const y = Number(candidate.y);

  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) {
    return null;
  }

  return { x, y };
}

function parsePayload(payload: unknown): TileCoord[] | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as TileRequestPayload;

  if (!Array.isArray(candidate.tiles)) {
    return null;
  }

  const parsed = candidate.tiles
    .map(parseTileCoord)
    .filter((tile): tile is TileCoord => tile !== null);

  if (parsed.length !== candidate.tiles.length || parsed.length > MAX_TILE_REQUEST_COUNT) {
    return null;
  }

  return dedupeTiles(parsed);
}

function mapRowToRegion(
  row: Record<string, unknown>,
  state: "sold" | "pending",
  adBySubmissionId?: Map<string, AdMeta>,
): WallRegion | null {
  const x1 = integerLikeToSafeNumber(row.x1);
  const y1 = integerLikeToSafeNumber(row.y1);
  const x2 = integerLikeToSafeNumber(row.x2);
  const y2 = integerLikeToSafeNumber(row.y2);

  if (
    typeof row.id !== "string" ||
    x1 === null ||
    y1 === null ||
    x2 === null ||
    y2 === null
  ) {
    return null;
  }

  return {
    id: `${state}:${row.id}`,
    x1,
    y1,
    x2,
    y2,
    state,
    ad:
      state === "sold" &&
      typeof row.submission_id === "string" &&
      adBySubmissionId
        ? (adBySubmissionId.get(row.submission_id) ?? null)
        : null,
  };
}

function groupRegionsByTile(tiles: TileCoord[], regions: WallRegion[]): TileResponse[] {
  return tiles.map((tile) => {
    const bounds = tileBounds(tile);
    const matching = regions.filter((region) => rectsOverlap(region, bounds));
    const truncated = matching.length > MAX_REGIONS_PER_TILE;

    return {
      key: tileKey(tile),
      tile,
      bounds,
      regions: matching.slice(0, MAX_REGIONS_PER_TILE),
      truncated,
    };
  });
}

export async function POST(request: NextRequest) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const tiles = parsePayload(payload);

  if (!tiles) {
    return NextResponse.json(
      {
        error: `Expected tiles array with up to ${MAX_TILE_REQUEST_COUNT} integer {x,y} tile coordinates.`,
      },
      { status: 400 },
    );
  }

  const requestBounds = unionTileBounds(tiles);

  if (!requestBounds) {
    return NextResponse.json({ tileSize: WALL_TILE_SIZE, tiles: [] });
  }

  if (!hasSupabaseServiceEnv()) {
    return NextResponse.json(
      {
        tileSize: WALL_TILE_SIZE,
        tiles: groupRegionsByTile(tiles, []),
        warning:
          "Supabase environment is not configured yet. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      },
      { status: 503 },
    );
  }

  const supabase = getSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  const soldRegionsQuery = supabase
    .from("pixel_regions")
    .select("id,x1,y1,x2,y2,submission_id")
    .gt("lease_ends_at", nowIso)
    .lte("x1", requestBounds.x2.toString())
    .gte("x2", requestBounds.x1.toString())
    .lte("y1", requestBounds.y2.toString())
    .gte("y2", requestBounds.y1.toString())
    .limit(MAX_REGIONS_PER_QUERY);

  const pendingRegionsQuery = supabase
    .from("pixel_reservations")
    .select("id,x1,y1,x2,y2")
    .eq("status", "pending")
    .gt("expires_at", nowIso)
    .lte("x1", requestBounds.x2.toString())
    .gte("x2", requestBounds.x1.toString())
    .lte("y1", requestBounds.y2.toString())
    .gte("y2", requestBounds.y1.toString())
    .limit(MAX_REGIONS_PER_QUERY);

  const [
    { data: soldDataRaw, error: soldError },
    { data: pendingRaw, error: pendingError },
  ] = await Promise.all([soldRegionsQuery, pendingRegionsQuery]);

  if (soldError) {
    return NextResponse.json(
      {
        error: "Failed to load sold tile regions.",
        details: soldError.message,
      },
      { status: 500 },
    );
  }

  if (pendingError) {
    return NextResponse.json(
      {
        error: "Failed to load pending tile regions.",
        details: pendingError.message,
      },
      { status: 500 },
    );
  }

  const soldSubmissionIds = ((soldDataRaw ?? []) as Array<Record<string, unknown>>)
    .map((row) => row.submission_id)
    .filter((id): id is string => typeof id === "string");
  const uniqueSubmissionIds = [...new Set(soldSubmissionIds)];
  let adBySubmissionId = new Map<string, AdMeta>();

  if (uniqueSubmissionIds.length > 0) {
    const { data: adRowsRaw, error: adRowsError } = await supabase
      .from("ad_submissions")
      .select("id,image_url,target_url,headline")
      .in("id", uniqueSubmissionIds)
      .limit(MAX_REGIONS_PER_QUERY);

    if (adRowsError) {
      return NextResponse.json(
        {
          error: "Failed to load tile ad metadata.",
          details: adRowsError.message,
        },
        { status: 500 },
      );
    }

    adBySubmissionId = new Map(
      ((adRowsRaw ?? []) as Array<Record<string, unknown>>)
        .map((row) => {
          if (typeof row.id !== "string") {
            return null;
          }

          return [
            row.id,
            {
              imageUrl: typeof row.image_url === "string" ? row.image_url : null,
              targetUrl: typeof row.target_url === "string" ? row.target_url : null,
              headline: typeof row.headline === "string" ? row.headline : null,
            },
          ] as const;
        })
        .filter((item): item is readonly [string, AdMeta] => item !== null),
    );
  }

  const soldRegions = ((soldDataRaw ?? []) as Array<Record<string, unknown>>)
    .map((row) => mapRowToRegion(row, "sold", adBySubmissionId))
    .filter((region): region is WallRegion => region !== null);
  const pendingRegions = ((pendingRaw ?? []) as Array<Record<string, unknown>>)
    .map((row) => mapRowToRegion(row, "pending"))
    .filter((region): region is WallRegion => region !== null);
  const regions = [...soldRegions, ...pendingRegions];
  const responseTiles = groupRegionsByTile(tiles, regions);
  const requestTruncated =
    (soldDataRaw?.length ?? 0) >= MAX_REGIONS_PER_QUERY ||
    (pendingRaw?.length ?? 0) >= MAX_REGIONS_PER_QUERY;

  return NextResponse.json({
    tileSize: WALL_TILE_SIZE,
    tiles: responseTiles,
    truncated: requestTruncated || responseTiles.some((tile) => tile.truncated),
  });
}
