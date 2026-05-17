import type { TileStatus } from "@/components/wall/useWallTiles";
import styles from "./PricingPreview.module.css";

export function ScalePill({
  description,
  label,
}: {
  description: string;
  label: string;
}) {
  return (
    <div className={styles.scalePill}>
      <span className={styles.scaleBadge}>{label}</span>
      <span className={styles.scaleText}>{description}</span>
    </div>
  );
}

export function WallHint({
  description,
  label,
  tileStatus,
  visibleTruncated,
}: {
  description: string;
  label: string;
  tileStatus: TileStatus;
  visibleTruncated: boolean;
}) {
  return (
    <div className={styles.wallHint}>
      <strong>{label}:</strong> {description} Scroll to zoom. Drag to select exact
      pixels, or pan after switching to Pan.{" "}
      {visibleTruncated
        ? "This dense area is capped while loading more detail."
        : tileStatus.message}
    </div>
  );
}
