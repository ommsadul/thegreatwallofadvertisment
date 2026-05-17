"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

import { AdHoverPreview } from "@/components/wall/AdHoverPreview";
import { ClaimPanel } from "@/components/wall/ClaimPanel";
import { PixelWallCanvas } from "@/components/wall/PixelWallCanvas";
import { ScalePill, WallHint } from "@/components/wall/WallStatusChrome";
import { WallToolbar } from "@/components/wall/WallToolbar";
import { prettyUsd } from "@/lib/money";
import { quoteRegion } from "@/lib/pricing";
import {
  DEFAULT_VIEWPORT_WORLD_HEIGHT,
  DEFAULT_VIEWPORT_WORLD_WIDTH,
  PRICE_PER_PIXEL_CENTS,
} from "@/lib/pricing-zones";
import { getViewportRect, getViewportWorldSize } from "@/lib/wall/geometry";
import { createWallStore, getActiveSelection, type WallStore } from "@/lib/wall/store";
import type { AdMeta, WallCamera } from "@/lib/wall/types";
import { selectionKeyFor, useClaimWorkflow } from "./useClaimWorkflow";
import { useWallTiles } from "./useWallTiles";
import styles from "./PricingPreview.module.css";

const DEFAULT_CLAIM_ZOOM = 8;
const TRUE_PIXEL_ZOOM = 6;

function isExternalHttpUrl(value: string | null | undefined): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

function getDefaultCamera(): WallCamera {
  return {
    originX: -(DEFAULT_VIEWPORT_WORLD_WIDTH / DEFAULT_CLAIM_ZOOM) / 2,
    originY: -(DEFAULT_VIEWPORT_WORLD_HEIGHT / DEFAULT_CLAIM_ZOOM) / 2,
    zoom: DEFAULT_CLAIM_ZOOM,
  };
}

function getStore(): WallStore {
  return createWallStore(getDefaultCamera());
}

export default function PricingPreview() {
  const [wallStore] = useState(getStore);
  const [previewAd, setPreviewAd] = useState<AdMeta | null>(null);
  const wallSnapshot = useSyncExternalStore(
    wallStore.subscribe,
    wallStore.getSnapshot,
    wallStore.getSnapshot,
  );
  const selection = getActiveSelection(wallSnapshot);
  const selectionKey = selectionKeyFor(selection);
  const viewportRect = useMemo(
    () => getViewportRect(wallSnapshot.camera),
    [wallSnapshot.camera],
  );
  const viewportWorldSize = useMemo(
    () => getViewportWorldSize(wallSnapshot.camera),
    [wallSnapshot.camera],
  );
  const {
    clearTileCache,
    tileStatus,
    visibleRegions,
    visibleTruncated,
  } = useWallTiles(viewportRect);

  const quote = useMemo(() => {
    if (!selection) {
      return null;
    }

    try {
      return quoteRegion(selection);
    } catch {
      return null;
    }
  }, [selection]);

  const workflow = useClaimWorkflow({
    quote,
    selectionKey,
    onReservationCreated: clearTileCache,
  });

  const pricePerPixel = prettyUsd(PRICE_PER_PIXEL_CENTS);
  const isTruePixelView = wallSnapshot.camera.zoom >= TRUE_PIXEL_ZOOM;
  const scaleLabel = isTruePixelView
    ? "True pixel view"
    : wallSnapshot.camera.zoom >= 2
      ? "Cluster guide view"
      : "Overview mode";
  const scaleDescription = isTruePixelView
    ? `Each tiny cell is 1 pixel (${pricePerPixel}). Dots mark every 10 pixels.`
    : "Guides are for wayfinding, not purchasable blocks.";

  return (
    <div className={styles.wallApp} data-testid="pixel-wall-page">
      <PixelWallCanvas
        store={wallStore}
        regions={visibleRegions}
        onHoverRegion={(region) => setPreviewAd(region?.ad ?? null)}
        onOpenRegion={(region) => {
          if (isExternalHttpUrl(region.ad?.targetUrl)) {
            window.open(region.ad.targetUrl, "_blank", "noopener,noreferrer");
          }
        }}
      />

      {wallSnapshot.pointerMode === "pan" && previewAd ? (
        <AdHoverPreview ad={previewAd} />
      ) : null}

      <ScalePill label={scaleLabel} description={scaleDescription} />
      <WallHint
        description={scaleDescription}
        label={scaleLabel}
        tileStatus={tileStatus}
        visibleTruncated={visibleTruncated}
      />
      <WallToolbar
        pointerMode={wallSnapshot.pointerMode}
        selectionExists={Boolean(selection)}
        onPointerModeChange={(mode) => wallStore.setPointerMode(mode)}
        onClearSelection={() => wallStore.clearSelection()}
        onPixelView={() => wallStore.setCamera(getDefaultCamera())}
      />
      <ClaimPanel
        isTruePixelView={isTruePixelView}
        pricePerPixel={pricePerPixel}
        quote={quote}
        tileStatus={tileStatus}
        viewportWorldSize={viewportWorldSize}
        visibleRegionCount={visibleRegions.length}
        visibleTruncated={visibleTruncated}
        workflow={workflow}
      />
    </div>
  );
}
