import type { PixelRect } from "../pricing-zones";

export type WallCamera = {
  originX: number;
  originY: number;
  zoom: number;
};

export type ScreenSize = {
  width: number;
  height: number;
};

export type WorldPoint = {
  x: number;
  y: number;
};

export type AdMeta = {
  imageUrl: string | null;
  targetUrl: string | null;
  headline: string | null;
};

export type WallRegionState = "sold" | "pending";

export type WallRegion = PixelRect & {
  id: string;
  state: WallRegionState;
  ad: AdMeta | null;
};

export type WallPointerMode = "select" | "pan";

export type TileCoord = {
  x: number;
  y: number;
};
