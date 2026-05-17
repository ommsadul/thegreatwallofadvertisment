"use client";

import type { ReactNode } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { prettyUsd } from "@/lib/money";
import type { RegionQuote } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import type { ClaimWorkflowState } from "./useClaimWorkflow";
import type { TileStatus } from "./useWallTiles";
import styles from "./PricingPreview.module.css";

type Quote = RegionQuote;

function StatusAlert({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "success" | "warning" | "error";
}) {
  return (
    <Alert
      variant={tone === "error" ? "destructive" : "default"}
      className={cn(styles.statusAlert, styles[`statusAlert_${tone}`])}
    >
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

export function ClaimPanel({
  isTruePixelView,
  pricePerPixel,
  quote,
  tileStatus,
  viewportWorldSize,
  visibleRegionCount,
  visibleTruncated,
  workflow,
}: {
  isTruePixelView: boolean;
  pricePerPixel: string;
  quote: Quote | null;
  tileStatus: TileStatus;
  viewportWorldSize: { width: number; height: number };
  visibleRegionCount: number;
  visibleTruncated: boolean;
  workflow: ClaimWorkflowState;
}) {
  return (
    <aside id="buy" className={styles.claimPanel}>
      <div className={styles.panelInner}>
        <header className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>Claim pixels</h2>
          <p className={styles.panelDescription}>
            Choose an exact area, attach a destination, then reserve it for checkout.
          </p>
          <div className={styles.legend}>
            <Badge variant="outline" className={styles.legendItem}>
              <span className={cn(styles.dot, styles.dotSelection)} />
              Selection
            </Badge>
            <Badge variant="outline" className={styles.legendItem}>
              <span className={cn(styles.dot, styles.dotReserved)} />
              Reserved
            </Badge>
            <Badge variant="outline" className={styles.legendItem}>
              <span className={cn(styles.dot, styles.dotLive)} />
              Live
            </Badge>
          </div>
        </header>

        <section className={styles.section} aria-label="Selection summary">
          <span className={styles.sectionTitle}>Selection</span>
          <div className={styles.quotePanel}>
            {quote ? (
              <>
                <div className={styles.quoteRow}>
                  <span>Coordinates</span>
                  <span className={styles.quoteValue}>
                    ({quote.selection.x1}, {quote.selection.y1}) - ({quote.selection.x2},{" "}
                    {quote.selection.y2})
                  </span>
                </div>
                <div className={styles.quoteRow}>
                  <span>Size</span>
                  <span className={styles.quoteValue}>
                    {quote.width.toLocaleString()} x {quote.height.toLocaleString()} pixels
                  </span>
                </div>
                <div className={styles.quoteRow}>
                  <span>Price</span>
                  <span className={styles.quoteValue}>
                    {quote.totalPixels.toLocaleString()} pixels x {pricePerPixel}
                  </span>
                </div>
                <div className={styles.quoteTotal}>
                  <span>Total</span>
                  <span>{prettyUsd(quote.totalCents)}</span>
                </div>
              </>
            ) : (
              <p className={styles.quoteEmpty}>
                {isTruePixelView
                  ? "Drag across the tiny cells to choose exact pixels."
                  : "Use Pixel view or zoom in before choosing an exact area."}
              </p>
            )}
          </div>
        </section>

        <FieldGroup className={styles.section} aria-label="Ad details">
          <span className={styles.sectionTitle}>Ad details</span>
          <Field>
            <FieldLabel htmlFor="reserve-email">Buyer email</FieldLabel>
            <Input
              id="reserve-email"
              type="email"
              value={workflow.customerEmail}
              onChange={(event) => workflow.setCustomerEmail(event.target.value)}
              className={styles.inputControl}
              placeholder="you@example.com"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="target-url">Destination URL</FieldLabel>
            <Input
              id="target-url"
              type="url"
              value={workflow.targetUrl}
              onChange={(event) => workflow.setTargetUrl(event.target.value)}
              className={styles.inputControl}
              placeholder="https://example.com"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="ad-headline">Ad headline</FieldLabel>
            <Input
              id="ad-headline"
              type="text"
              value={workflow.adHeadline}
              onChange={(event) => workflow.setAdHeadline(event.target.value)}
              className={styles.inputControl}
              placeholder="Short ad title"
            />
          </Field>

          <details className={styles.advancedPanel}>
            <summary>Optional image source</summary>
            <Field className={styles.advancedField}>
              <FieldLabel htmlFor="ad-source-image-url">Image URL</FieldLabel>
              <Input
                id="ad-source-image-url"
                type="url"
                value={workflow.sourceImageUrl}
                onChange={(event) => workflow.setSourceImageUrl(event.target.value)}
                className={styles.inputControl}
                placeholder="https://your-site.com/banner.png"
              />
              <FieldDescription className={styles.helperText}>
                The server copies JPEG, PNG, or WebP images into wall storage before checkout.
              </FieldDescription>
            </Field>
          </details>

          <Button
            type="button"
            variant="outline"
            onClick={workflow.prepareAdPreview}
            disabled={workflow.previewResult.state === "loading"}
            className={styles.secondaryAction}
          >
            {workflow.previewResult.state === "loading"
              ? "Building stored preview..."
              : "Generate preview"}
          </Button>

          {workflow.previewResult.message ? (
            <StatusAlert
              tone={workflow.previewResult.state === "error" ? "error" : "success"}
            >
              {workflow.previewResult.message}
            </StatusAlert>
          ) : null}

          {workflow.adDraft ? (
            <div
              className={cn(
                styles.previewCard,
                workflow.isAdDraftCurrent ? null : styles.previewCardStale,
              )}
            >
              {workflow.adDraft.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={workflow.adDraft.imageUrl}
                  alt={workflow.adDraft.headline ?? "Stored ad preview"}
                  className={styles.previewImage}
                  draggable={false}
                />
              ) : (
                <div className={styles.previewTextTile}>
                  {workflow.adDraft.headline ?? "Sponsored"}
                </div>
              )}
              <div className={styles.previewBody}>
                <div>
                  <p className={styles.previewTitle}>
                    {workflow.adDraft.headline ?? "Sponsored"}
                  </p>
                  <p className={styles.previewUrl}>{workflow.adDraft.targetUrl}</p>
                </div>
                <Badge variant="secondary" className={styles.previewBadge}>
                  {workflow.isAdDraftCurrent ? "Ready" : "Refresh needed"}
                </Badge>
              </div>
            </div>
          ) : null}
        </FieldGroup>

        <section className={styles.section} aria-label="Checkout actions">
          <span className={styles.sectionTitle}>Checkout</span>
          <div className={styles.actionGrid}>
            <Button
              type="button"
              variant="outline"
              onClick={workflow.checkAvailability}
              disabled={workflow.availabilityState === "checking" || !quote}
              className={styles.secondaryAction}
            >
              {workflow.availabilityState === "checking" ? "Checking..." : "Check"}
            </Button>
            <Button
              type="button"
              onClick={workflow.createReservation}
              disabled={workflow.reservationState === "creating" || !quote}
              className={styles.primaryAction}
            >
              {workflow.reservationState === "creating" ? "Reserving..." : "Reserve"}
            </Button>
          </div>

          <Button
            type="button"
            onClick={workflow.startCheckout}
            disabled={
              workflow.checkoutState === "creating" ||
              workflow.reservationState !== "created" ||
              !workflow.isAdDraftCurrent
            }
            className={styles.checkoutAction}
          >
            {workflow.checkoutState === "creating" ? "Redirecting..." : "Continue to checkout"}
          </Button>

          <FieldSeparator />

          <div className={styles.statusList}>
            <p>
              Availability:{" "}
              {workflow.availabilityState === "available"
                ? "Available"
                : workflow.availabilityState === "unavailable"
                  ? "Unavailable"
                  : workflow.availabilityState === "checking"
                    ? "Checking"
                    : workflow.availabilityState === "error"
                      ? "Error"
                      : "Not checked"}
            </p>
            <p>
              View: {Math.round(viewportWorldSize.width).toLocaleString()} x{" "}
              {Math.round(viewportWorldSize.height).toLocaleString()} pixels,{" "}
              {visibleRegionCount.toLocaleString()} loaded region
              {visibleRegionCount === 1 ? "" : "s"}
            </p>
            {tileStatus.state === "error" && tileStatus.message ? (
              <StatusAlert tone="error">{tileStatus.message}</StatusAlert>
            ) : null}
            {visibleTruncated ? (
              <StatusAlert tone="warning">
                This tile is dense; some regions may be paged in a later pass.
              </StatusAlert>
            ) : null}
            {workflow.availabilityNote ? (
              <StatusAlert tone="warning">{workflow.availabilityNote}</StatusAlert>
            ) : null}
            {workflow.reservationMessage ? (
              <StatusAlert
                tone={workflow.reservationState === "created" ? "success" : "error"}
              >
                {workflow.reservationMessage}
              </StatusAlert>
            ) : null}
            {workflow.adDraft && !workflow.isAdDraftCurrent ? (
              <StatusAlert tone="warning">
                Preview inputs changed. Generate the preview again before checkout.
              </StatusAlert>
            ) : null}
            {workflow.checkoutMessage ? (
              <StatusAlert tone="error">{workflow.checkoutMessage}</StatusAlert>
            ) : null}
          </div>
        </section>
      </div>
    </aside>
  );
}
