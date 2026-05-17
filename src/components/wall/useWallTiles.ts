"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { PixelRect } from "@/lib/pricing-zones";
import { dedupeRegions, filterRegionsForViewport } from "@/lib/wall/hit-test";
import {
  dedupeTiles,
  MAX_TILE_REQUEST_COUNT,
  tileKey,
  tilesForViewport,
} from "@/lib/wall/tiles";
import type { TileCoord, WallRegion } from "@/lib/wall/types";

export type TileStatus = {
  state: "idle" | "loading" | "ready" | "error";
  message: string | null;
};

type TileCacheEntry = {
  regions: WallRegion[];
  truncated: boolean;
  loadedAt: number;
};

type TileResponse = {
  key: string;
  tile: TileCoord;
  regions: WallRegion[];
  truncated?: boolean;
};

function compactTileCache(
  cache: Map<string, TileCacheEntry>,
  protectedKeys: Set<string>,
): void {
  if (cache.size <= 140) {
    return;
  }

  const entries = [...cache.entries()].sort(
    (a, b) => a[1].loadedAt - b[1].loadedAt,
  );

  for (const [key] of entries) {
    if (cache.size <= 110) {
      return;
    }

    if (!protectedKeys.has(key)) {
      cache.delete(key);
    }
  }
}

export function useWallTiles(viewportRect: PixelRect) {
  const [tileCache, setTileCache] = useState(new Map<string, TileCacheEntry>());
  const loadingTileKeysRef = useRef(new Set<string>());
  const [tileStatus, setTileStatus] = useState<TileStatus>({
    state: "idle",
    message: null,
  });

  const visibleTiles = useMemo(
    () => dedupeTiles(tilesForViewport(viewportRect, 1)),
    [viewportRect],
  );
  const visibleTileKey = useMemo(
    () => visibleTiles.map(tileKey).join("|"),
    [visibleTiles],
  );

  const visibleRegions = useMemo(() => {
    const visibleKeys = new Set(visibleTiles.map(tileKey));
    const regions: WallRegion[] = [];

    for (const [key, entry] of tileCache.entries()) {
      if (visibleKeys.has(key)) {
        regions.push(...entry.regions);
      }
    }

    return filterRegionsForViewport(dedupeRegions(regions), viewportRect);
  }, [tileCache, viewportRect, visibleTiles]);

  const visibleTruncated = useMemo(() => {
    return visibleTiles.some((tile) => tileCache.get(tileKey(tile))?.truncated);
  }, [tileCache, visibleTiles]);

  useEffect(() => {
    const loadingTileKeys = loadingTileKeysRef.current;
    const missingTiles = visibleTiles
      .filter((tile) => {
        const key = tileKey(tile);

        return !tileCache.has(key) && !loadingTileKeys.has(key);
      })
      .slice(0, MAX_TILE_REQUEST_COUNT);

    const protectedKeys = new Set(tilesForViewport(viewportRect, 2).map(tileKey));

    if (missingTiles.length === 0) {
      return;
    }

    const controller = new AbortController();

    for (const tile of missingTiles) {
      loadingTileKeys.add(tileKey(tile));
    }

    setTileStatus({
      state: "loading",
      message: `Loading ${missingTiles.length} map tile${missingTiles.length === 1 ? "" : "s"}...`,
    });

    async function loadTiles() {
      try {
        const response = await fetch("/api/wall/tiles", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tiles: missingTiles }),
          signal: controller.signal,
        });
        const body = (await response.json()) as {
          tiles?: TileResponse[];
          truncated?: boolean;
          warning?: string;
          error?: string;
        };

        if (!response.ok && !body.tiles) {
          for (const tile of missingTiles) {
            loadingTileKeys.delete(tileKey(tile));
          }

          setTileStatus({
            state: "error",
            message: body.error ?? "Unable to load map tiles.",
          });
          return;
        }

        const returnedTiles = body.tiles ?? [];
        const returnedKeys = new Set(returnedTiles.map((tile) => tile.key));

        setTileCache((previousCache) => {
          const nextCache = new Map(previousCache);

          for (const tile of returnedTiles) {
            nextCache.set(tile.key, {
              regions: tile.regions ?? [],
              truncated: Boolean(tile.truncated || body.truncated),
              loadedAt: Date.now(),
            });
          }

          for (const tile of missingTiles) {
            const key = tileKey(tile);

            if (!returnedKeys.has(key)) {
              nextCache.set(key, {
                regions: [],
                truncated: false,
                loadedAt: Date.now(),
              });
            }
          }

          compactTileCache(nextCache, protectedKeys);

          return nextCache;
        });

        for (const tile of missingTiles) {
          loadingTileKeys.delete(tileKey(tile));
        }

        setTileStatus({
          state: "ready",
          message: body.warning ?? null,
        });
      } catch {
        if (!controller.signal.aborted) {
          for (const tile of missingTiles) {
            loadingTileKeys.delete(tileKey(tile));
          }

          setTileStatus({
            state: "error",
            message: "Network error while loading map tiles.",
          });
        }
      }
    }

    void loadTiles();

    return () => {
      controller.abort();
      for (const tile of missingTiles) {
        loadingTileKeys.delete(tileKey(tile));
      }
    };
  }, [tileCache, viewportRect, visibleTileKey, visibleTiles]);

  return {
    clearTileCache: () => setTileCache(new Map()),
    tileStatus,
    visibleRegions,
    visibleTruncated,
    visibleTiles,
  };
}
