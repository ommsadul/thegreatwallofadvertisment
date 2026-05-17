"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { PointerEvent, WheelEvent } from "react";

import {
  getViewportRect,
  getViewportWorldSize,
  rectToScreen,
  screenToWorld,
  worldToScreen,
} from "@/lib/wall/geometry";
import { hitTestRegions } from "@/lib/wall/hit-test";
import { getActiveSelection, WallStore } from "@/lib/wall/store";
import { WALL_CANVAS_THEME } from "@/lib/wall/theme";
import type { ScreenSize, WallCamera, WallRegion } from "@/lib/wall/types";

type PixelWallCanvasProps = {
  store: WallStore;
  regions: WallRegion[];
  onHoverRegion: (region: WallRegion | null) => void;
  onOpenRegion: (region: WallRegion) => void;
};

type ImageCacheEntry = {
  image: HTMLImageElement;
  loaded: boolean;
  failed: boolean;
};

function resizeCanvas(
  canvas: HTMLCanvasElement | null,
  size: ScreenSize,
  alpha = true,
): CanvasRenderingContext2D | null {
  if (!canvas || size.width <= 0 || size.height <= 0) {
    return null;
  }

  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const targetWidth = Math.max(1, Math.floor(size.width * dpr));
  const targetHeight = Math.max(1, Math.floor(size.height * dpr));

  if (canvas.width !== targetWidth) {
    canvas.width = targetWidth;
  }

  if (canvas.height !== targetHeight) {
    canvas.height = targetHeight;
  }

  canvas.style.width = `${size.width}px`;
  canvas.style.height = `${size.height}px`;

  const context = canvas.getContext("2d", { alpha });

  if (!context) {
    return null;
  }

  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  return context;
}

function clearCanvas(context: CanvasRenderingContext2D, size: ScreenSize): void {
  context.clearRect(0, 0, size.width, size.height);
}

function drawGrid(
  context: CanvasRenderingContext2D,
  size: ScreenSize,
  camera: WallCamera,
): void {
  context.fillStyle = WALL_CANVAS_THEME.background;
  context.fillRect(0, 0, size.width, size.height);

  const viewport = getViewportRect(camera);
  const worldSize = getViewportWorldSize(camera);
  const cellSize = Math.min(size.width / worldSize.width, size.height / worldSize.height);

  function drawLines(step: number, strokeStyle: string, lineWidth: number): void {
    context.beginPath();
    context.strokeStyle = strokeStyle;
    context.lineWidth = lineWidth;

    const startX = Math.floor(viewport.x1 / step) * step;
    const endX = Math.ceil(viewport.x2 / step) * step;
    const startY = Math.floor(viewport.y1 / step) * step;
    const endY = Math.ceil(viewport.y2 / step) * step;

    for (let x = startX; x <= endX; x += step) {
      const screen = worldToScreen({ x, y: viewport.y1 }, camera, size);
      const crispX = Math.round(screen.x) + 0.5;
      context.moveTo(crispX, 0);
      context.lineTo(crispX, size.height);
    }

    for (let y = startY; y <= endY; y += step) {
      const screen = worldToScreen({ x: viewport.x1, y }, camera, size);
      const crispY = Math.round(screen.y) + 0.5;
      context.moveTo(0, crispY);
      context.lineTo(size.width, crispY);
    }

    context.stroke();
  }

  function drawGuideDots(step: number, radius: number, fillStyle: string): void {
    context.fillStyle = fillStyle;

    const startX = Math.floor(viewport.x1 / step) * step;
    const endX = Math.ceil(viewport.x2 / step) * step;
    const startY = Math.floor(viewport.y1 / step) * step;
    const endY = Math.ceil(viewport.y2 / step) * step;

    for (let x = startX; x <= endX; x += step) {
      for (let y = startY; y <= endY; y += step) {
        const screen = worldToScreen({ x, y }, camera, size);
        context.beginPath();
        context.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  if (cellSize >= 6) {
    drawLines(1, WALL_CANVAS_THEME.truePixelLine, 1);
    drawGuideDots(10, 1.05, WALL_CANVAS_THEME.tenPixelDot);
    return;
  }

  if (cellSize >= 2.2) {
    drawLines(1, WALL_CANVAS_THEME.microLine, 1);
    drawGuideDots(10, 0.95, WALL_CANVAS_THEME.guideDot);
    return;
  }

  drawGuideDots(
    cellSize >= 1 ? 20 : 50,
    cellSize >= 1 ? 1.1 : 0.9,
    WALL_CANVAS_THEME.overviewDot,
  );
}

function drawRegionPlaceholder(
  context: CanvasRenderingContext2D,
  region: WallRegion,
  screenRect: { x: number; y: number; width: number; height: number },
): void {
  if (region.state === "pending") {
    context.fillStyle = WALL_CANVAS_THEME.pendingFill;
    context.strokeStyle = WALL_CANVAS_THEME.pendingStroke;
  } else {
    context.fillStyle = WALL_CANVAS_THEME.soldFill;
    context.strokeStyle = WALL_CANVAS_THEME.soldStroke;
  }

  context.lineWidth = 1;
  context.fillRect(screenRect.x, screenRect.y, screenRect.width, screenRect.height);
  context.strokeRect(
    Math.round(screenRect.x) + 0.5,
    Math.round(screenRect.y) + 0.5,
    Math.max(0, Math.round(screenRect.width) - 1),
    Math.max(0, Math.round(screenRect.height) - 1),
  );
}

function drawRegionLabel(
  context: CanvasRenderingContext2D,
  region: WallRegion,
  screenRect: { x: number; y: number; width: number; height: number },
): void {
  if (screenRect.width < 46 || screenRect.height < 24) {
    return;
  }

  context.save();
  context.beginPath();
  context.rect(screenRect.x, screenRect.y, screenRect.width, screenRect.height);
  context.clip();

  const title = region.ad?.headline?.trim() || (region.state === "pending" ? "Reserved" : "Sponsored");
  const host = region.ad?.targetUrl
    ? (() => {
        try {
          return new URL(region.ad.targetUrl ?? "").hostname.replace(/^www\./i, "");
        } catch {
          return "ad link";
        }
      })()
    : "ad link";

  context.fillStyle = WALL_CANVAS_THEME.text;
  context.font = "500 12px Space Grotesk, Aptos, Segoe UI, sans-serif";
  context.fillText(title, screenRect.x + 8, screenRect.y + 16, screenRect.width - 16);

  if (screenRect.height >= 42) {
    context.fillStyle = WALL_CANVAS_THEME.mutedText;
    context.font = "400 10px Space Grotesk, Aptos, Segoe UI, sans-serif";
    context.fillText(host, screenRect.x + 8, screenRect.y + 31, screenRect.width - 16);
  }

  context.restore();
}

export function PixelWallCanvas({
  store,
  regions,
  onHoverRegion,
  onOpenRegion,
}: PixelWallCanvasProps) {
  const backgroundCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const regionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const imageCacheRef = useRef(new Map<string, ImageCacheEntry>());
  const panAnchorRef = useRef<{
    clientX: number;
    clientY: number;
    camera: WallCamera;
    size: ScreenSize;
  } | null>(null);
  const pendingClickRef = useRef<{
    region: WallRegion;
    clientX: number;
    clientY: number;
  } | null>(null);
  const hoveredRegionIdRef = useRef<string | null>(null);
  const [size, setSize] = useState<ScreenSize>({ width: 0, height: 0 });
  const [imageVersion, setImageVersion] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  const activeSelection = getActiveSelection(snapshot);

  useEffect(() => {
    const stage = stageRef.current;

    if (!stage) {
      return;
    }

    const updateSize = () => {
      const rect = stage.getBoundingClientRect();
      setSize({
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
      });
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(stage);

    return () => {
      observer.disconnect();
    };
  }, []);

  const requestImage = useCallback((url: string): ImageCacheEntry => {
    const existing = imageCacheRef.current.get(url);

    if (existing) {
      return existing;
    }

    const image = new Image();
    const entry: ImageCacheEntry = {
      image,
      loaded: false,
      failed: false,
    };

    image.onload = () => {
      entry.loaded = true;
      setImageVersion((value) => value + 1);
    };
    image.onerror = () => {
      entry.failed = true;
      setImageVersion((value) => value + 1);
    };
    image.src = url;
    imageCacheRef.current.set(url, entry);

    return entry;
  }, []);

  useEffect(() => {
    if (size.width <= 0 || size.height <= 0) {
      return;
    }

    const backgroundContext = resizeCanvas(backgroundCanvasRef.current, size, false);
    const regionContext = resizeCanvas(regionCanvasRef.current, size, true);
    const overlayContext = resizeCanvas(overlayCanvasRef.current, size, true);

    if (!backgroundContext || !regionContext || !overlayContext) {
      return;
    }

    drawGrid(backgroundContext, size, snapshot.camera);
    clearCanvas(regionContext, size);
    clearCanvas(overlayContext, size);

    for (const region of regions) {
      const screenRect = rectToScreen(region, snapshot.camera, size);

      if (
        screenRect.x > size.width ||
        screenRect.y > size.height ||
        screenRect.x + screenRect.width < 0 ||
        screenRect.y + screenRect.height < 0
      ) {
        continue;
      }

      const drawRect = {
        x: Math.floor(screenRect.x),
        y: Math.floor(screenRect.y),
        width: Math.max(1, Math.ceil(screenRect.width)),
        height: Math.max(1, Math.ceil(screenRect.height)),
      };

      drawRegionPlaceholder(regionContext, region, drawRect);

      if (region.state === "sold" && region.ad?.imageUrl) {
        const entry = requestImage(region.ad.imageUrl);

        if (entry.loaded && !entry.failed) {
          regionContext.save();
          regionContext.beginPath();
          regionContext.rect(drawRect.x, drawRect.y, drawRect.width, drawRect.height);
          regionContext.clip();
          regionContext.drawImage(entry.image, drawRect.x, drawRect.y, drawRect.width, drawRect.height);
          regionContext.restore();
          regionContext.strokeStyle = "rgba(17,17,17,0.26)";
          regionContext.strokeRect(
            Math.round(drawRect.x) + 0.5,
            Math.round(drawRect.y) + 0.5,
            Math.max(0, Math.round(drawRect.width) - 1),
            Math.max(0, Math.round(drawRect.height) - 1),
          );
        }
      }

      drawRegionLabel(regionContext, region, drawRect);
    }

    if (activeSelection) {
      const selectionRect = rectToScreen(activeSelection, snapshot.camera, size);
      overlayContext.fillStyle = WALL_CANVAS_THEME.selectionFill;
      overlayContext.strokeStyle = WALL_CANVAS_THEME.selectionStroke;
      overlayContext.lineWidth = 2;
      overlayContext.fillRect(
        selectionRect.x,
        selectionRect.y,
        selectionRect.width,
        selectionRect.height,
      );
      overlayContext.strokeRect(
        Math.round(selectionRect.x) + 0.5,
        Math.round(selectionRect.y) + 0.5,
        Math.max(1, Math.round(selectionRect.width)),
        Math.max(1, Math.round(selectionRect.height)),
      );
    }
  }, [activeSelection, imageVersion, regions, requestImage, size, snapshot.camera]);

  function setHoveredRegion(region: WallRegion | null): void {
    const nextId = region?.id ?? null;

    if (hoveredRegionIdRef.current === nextId) {
      return;
    }

    hoveredRegionIdRef.current = nextId;
    onHoverRegion(region);
  }

  function getWorldPoint(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();

    return screenToWorld(
      {
        clientX: event.clientX,
        clientY: event.clientY,
      },
      bounds,
      store.getSnapshot().camera,
    );
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>): void {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    const current = store.getSnapshot();
    const bounds = event.currentTarget.getBoundingClientRect();
    const point = screenToWorld(event, bounds, current.camera);

    if (current.pointerMode === "select") {
      store.startSelection(point);
      setHoveredRegion(null);
      return;
    }

    panAnchorRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      camera: current.camera,
      size: {
        width: bounds.width,
        height: bounds.height,
      },
    };
    setIsPanning(true);

    const hit = hitTestRegions(regions, point);
    pendingClickRef.current =
      hit?.state === "sold" && hit.ad?.targetUrl
        ? {
            region: hit,
            clientX: event.clientX,
            clientY: event.clientY,
          }
        : null;
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>): void {
    const current = store.getSnapshot();

    if (current.pointerMode === "select" && current.selectionStart) {
      store.updateSelection(getWorldPoint(event));
      return;
    }

    if (panAnchorRef.current) {
      store.panFromAnchor(
        panAnchorRef.current.camera,
        {
          x: event.clientX - panAnchorRef.current.clientX,
          y: event.clientY - panAnchorRef.current.clientY,
        },
        panAnchorRef.current.size,
      );
      setHoveredRegion(null);
      return;
    }

    const hit = hitTestRegions(regions, getWorldPoint(event));
    setHoveredRegion(hit?.state === "sold" ? hit : null);
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>): void {
    const current = store.getSnapshot();

    if (current.pointerMode === "select") {
      store.commitSelection();
      return;
    }

    if (panAnchorRef.current && pendingClickRef.current) {
      const movedX = Math.abs(event.clientX - pendingClickRef.current.clientX);
      const movedY = Math.abs(event.clientY - pendingClickRef.current.clientY);

      if (movedX <= 6 && movedY <= 6) {
        onOpenRegion(pendingClickRef.current.region);
      }
    }

    panAnchorRef.current = null;
    pendingClickRef.current = null;
    setIsPanning(false);
  }

  function handlePointerCancel(): void {
    panAnchorRef.current = null;
    pendingClickRef.current = null;
    store.commitSelection();
    setIsPanning(false);
    setHoveredRegion(null);
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>): void {
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    store.zoomAt(
      {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      },
      {
        width: bounds.width,
        height: bounds.height,
      },
      event.deltaY < 0 ? "in" : "out",
    );
  }

  return (
    <div
      ref={stageRef}
      className="absolute inset-0 touch-none select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={() => {
        if (!panAnchorRef.current) {
          setHoveredRegion(null);
        }
      }}
      onWheel={handleWheel}
      style={{
        cursor:
          snapshot.pointerMode === "pan"
            ? isPanning
              ? "grabbing"
              : "grab"
            : "crosshair",
      }}
    >
      <canvas ref={backgroundCanvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
      <canvas ref={regionCanvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
      <canvas ref={overlayCanvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
    </div>
  );
}
