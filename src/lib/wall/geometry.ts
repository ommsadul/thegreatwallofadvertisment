import {
  DEFAULT_VIEWPORT_WORLD_HEIGHT,
  DEFAULT_VIEWPORT_WORLD_WIDTH,
  PixelRect,
} from "../pricing-zones";
import type { ScreenSize, WallCamera, WorldPoint } from "./types";

export const MIN_WALL_ZOOM = 0.25;
export const MAX_WALL_ZOOM = 10;

export function clampZoom(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(MAX_WALL_ZOOM, Math.max(MIN_WALL_ZOOM, value));
}

export function getViewportWorldSize(camera: WallCamera): {
  width: number;
  height: number;
} {
  const zoom = clampZoom(camera.zoom);

  return {
    width: Math.max(1, DEFAULT_VIEWPORT_WORLD_WIDTH / zoom),
    height: Math.max(1, DEFAULT_VIEWPORT_WORLD_HEIGHT / zoom),
  };
}

export function getViewportRect(camera: WallCamera): PixelRect {
  const viewport = getViewportWorldSize(camera);
  const x1 = Math.floor(camera.originX);
  const y1 = Math.floor(camera.originY);
  const x2 = Math.ceil(camera.originX + viewport.width - 1);
  const y2 = Math.ceil(camera.originY + viewport.height - 1);

  return { x1, y1, x2, y2 };
}

export function normalizeCamera(camera: WallCamera): WallCamera {
  return {
    originX: Number.isFinite(camera.originX) ? camera.originX : 0,
    originY: Number.isFinite(camera.originY) ? camera.originY : 0,
    zoom: clampZoom(camera.zoom),
  };
}

export function screenToWorld(
  point: { clientX: number; clientY: number },
  bounds: DOMRect,
  camera: WallCamera,
): WorldPoint {
  const viewport = getViewportWorldSize(camera);
  const relativeX = bounds.width > 0 ? (point.clientX - bounds.left) / bounds.width : 0;
  const relativeY = bounds.height > 0 ? (point.clientY - bounds.top) / bounds.height : 0;

  return {
    x: camera.originX + relativeX * viewport.width,
    y: camera.originY + relativeY * viewport.height,
  };
}

export function worldToScreen(
  point: WorldPoint,
  camera: WallCamera,
  size: ScreenSize,
): WorldPoint {
  const viewport = getViewportWorldSize(camera);

  return {
    x: ((point.x - camera.originX) / viewport.width) * size.width,
    y: ((point.y - camera.originY) / viewport.height) * size.height,
  };
}

export function rectToScreen(
  rect: PixelRect,
  camera: WallCamera,
  size: ScreenSize,
): { x: number; y: number; width: number; height: number } {
  const start = worldToScreen({ x: rect.x1, y: rect.y1 }, camera, size);
  const end = worldToScreen({ x: rect.x2 + 1, y: rect.y2 + 1 }, camera, size);

  return {
    x: start.x,
    y: start.y,
    width: end.x - start.x,
    height: end.y - start.y,
  };
}

export function snapDragToRect(start: WorldPoint, end: WorldPoint): PixelRect {
  const minX = Math.min(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxX = Math.max(start.x, end.x);
  const maxY = Math.max(start.y, end.y);

  return {
    x1: Math.floor(minX),
    y1: Math.floor(minY),
    x2: Math.floor(maxX),
    y2: Math.floor(maxY),
  };
}

export function panCameraFromAnchor(
  anchorCamera: WallCamera,
  deltaClient: { x: number; y: number },
  size: ScreenSize,
): WallCamera {
  const viewport = getViewportWorldSize(anchorCamera);
  const deltaWorldX = size.width > 0 ? (deltaClient.x / size.width) * viewport.width : 0;
  const deltaWorldY = size.height > 0 ? (deltaClient.y / size.height) * viewport.height : 0;

  return normalizeCamera({
    ...anchorCamera,
    originX: anchorCamera.originX - deltaWorldX,
    originY: anchorCamera.originY - deltaWorldY,
  });
}

export function zoomCameraAtScreenPoint(
  camera: WallCamera,
  screenPoint: { x: number; y: number },
  size: ScreenSize,
  nextZoom: number,
): WallCamera {
  const currentViewport = getViewportWorldSize(camera);
  const relativeX = size.width > 0 ? screenPoint.x / size.width : 0.5;
  const relativeY = size.height > 0 ? screenPoint.y / size.height : 0.5;
  const worldX = camera.originX + relativeX * currentViewport.width;
  const worldY = camera.originY + relativeY * currentViewport.height;
  const zoom = clampZoom(nextZoom);
  const nextViewport = getViewportWorldSize({ ...camera, zoom });

  return normalizeCamera({
    originX: worldX - relativeX * nextViewport.width,
    originY: worldY - relativeY * nextViewport.height,
    zoom,
  });
}

export function rectsOverlap(a: PixelRect, b: PixelRect): boolean {
  return a.x1 <= b.x2 && a.x2 >= b.x1 && a.y1 <= b.y2 && a.y2 >= b.y1;
}

export function rectContainsPoint(rect: PixelRect, point: WorldPoint): boolean {
  return point.x >= rect.x1 && point.x < rect.x2 + 1 && point.y >= rect.y1 && point.y < rect.y2 + 1;
}
