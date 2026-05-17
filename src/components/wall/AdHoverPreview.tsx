import type { AdMeta } from "@/lib/wall/types";
import styles from "./PricingPreview.module.css";

export function AdHoverPreview({ ad }: { ad: AdMeta }) {
  return (
    <div className={styles.hoverPreview}>
      {ad.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={ad.imageUrl}
          alt={ad.headline ?? "Ad preview"}
          className={styles.hoverPreviewImage}
          draggable={false}
        />
      ) : (
        <div className={styles.hoverPreviewEmpty}>No image preview</div>
      )}
      <div className={styles.hoverPreviewBody}>
        <p className={styles.hoverPreviewTitle}>
          {ad.headline?.trim() || "Sponsored"}
        </p>
        <p className={styles.hoverPreviewUrl}>
          {ad.targetUrl || "No destination URL"}
        </p>
      </div>
    </div>
  );
}
