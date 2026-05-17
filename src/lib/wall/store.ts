import type { PixelRect } from "../pricing-zones";
import {
  clampZoom,
  normalizeCamera,
  panCameraFromAnchor,
  snapDragToRect,
  zoomCameraAtScreenPoint,
} from "./geometry";
import type {
  ScreenSize,
  WallCamera,
  WallPointerMode,
  WorldPoint,
} from "./types";

export type WallStoreSnapshot = {
  camera: WallCamera;
  pointerMode: WallPointerMode;
  selectionStart: WorldPoint | null;
  selectionEnd: WorldPoint | null;
  selectedRect: PixelRect | null;
  revision: number;
};

export type WallStore = {
  getSnapshot: () => WallStoreSnapshot;
  subscribe: (listener: () => void) => () => void;
  setPointerMode: (mode: WallPointerMode) => void;
  setCamera: (camera: WallCamera) => void;
  panFromAnchor: (
    anchorCamera: WallCamera,
    deltaClient: { x: number; y: number },
    size: ScreenSize,
  ) => void;
  zoomAt: (
    screenPoint: { x: number; y: number },
    size: ScreenSize,
    direction: "in" | "out",
  ) => void;
  startSelection: (point: WorldPoint) => void;
  updateSelection: (point: WorldPoint) => void;
  commitSelection: () => void;
  clearSelection: () => void;
};

function activeSelectionFromSnapshot(snapshot: WallStoreSnapshot): PixelRect | null {
  if (snapshot.selectionStart && snapshot.selectionEnd) {
    return snapDragToRect(snapshot.selectionStart, snapshot.selectionEnd);
  }

  return snapshot.selectedRect;
}

export function getActiveSelection(snapshot: WallStoreSnapshot): PixelRect | null {
  return activeSelectionFromSnapshot(snapshot);
}

export function createWallStore(initialCamera: WallCamera): WallStore {
  let snapshot: WallStoreSnapshot = {
    camera: normalizeCamera(initialCamera),
    pointerMode: "select",
    selectionStart: null,
    selectionEnd: null,
    selectedRect: null,
    revision: 0,
  };
  const listeners = new Set<() => void>();

  function emit(next: Omit<WallStoreSnapshot, "revision">): void {
    snapshot = {
      ...next,
      revision: snapshot.revision + 1,
    };

    for (const listener of listeners) {
      listener();
    }
  }

  function patch(next: Partial<Omit<WallStoreSnapshot, "revision">>): void {
    emit({
      ...snapshot,
      ...next,
    });
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    setPointerMode: (mode) => {
      patch({
        pointerMode: mode,
        selectionStart: null,
        selectionEnd: null,
      });
    },
    setCamera: (camera) => {
      patch({ camera: normalizeCamera(camera) });
    },
    panFromAnchor: (anchorCamera, deltaClient, size) => {
      patch({
        camera: panCameraFromAnchor(anchorCamera, deltaClient, size),
      });
    },
    zoomAt: (screenPoint, size, direction) => {
      const multiplier = direction === "in" ? 1.16 : 1 / 1.16;
      patch({
        camera: zoomCameraAtScreenPoint(
          snapshot.camera,
          screenPoint,
          size,
          clampZoom(Number((snapshot.camera.zoom * multiplier).toFixed(4))),
        ),
      });
    },
    startSelection: (point) => {
      patch({
        selectionStart: point,
        selectionEnd: point,
        selectedRect: null,
      });
    },
    updateSelection: (point) => {
      if (!snapshot.selectionStart) {
        return;
      }

      patch({ selectionEnd: point });
    },
    commitSelection: () => {
      const selectedRect = activeSelectionFromSnapshot(snapshot);

      patch({
        selectedRect,
        selectionStart: null,
        selectionEnd: null,
      });
    },
    clearSelection: () => {
      patch({
        selectionStart: null,
        selectionEnd: null,
        selectedRect: null,
      });
    },
  };
}
