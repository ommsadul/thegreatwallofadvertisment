"use client";

import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type { WallPointerMode } from "@/lib/wall/types";
import styles from "./PricingPreview.module.css";

export function WallToolbar({
  onClearSelection,
  onPixelView,
  onPointerModeChange,
  pointerMode,
  selectionExists,
}: {
  onClearSelection: () => void;
  onPixelView: () => void;
  onPointerModeChange: (mode: WallPointerMode) => void;
  pointerMode: WallPointerMode;
  selectionExists: boolean;
}) {
  return (
    <div className={styles.toolbar}>
      <ToggleGroup
        aria-label="Wall interaction mode"
        value={[pointerMode]}
        onValueChange={(value) => {
          const nextMode = value[0];

          if (nextMode === "select" || nextMode === "pan") {
            onPointerModeChange(nextMode);
          }
        }}
        spacing={1}
        className={styles.toolbarModeGroup}
      >
        <ToggleGroupItem
          aria-label="Select pixels"
          value="select"
          className={cn(
            styles.toolbarButton,
            pointerMode === "select" ? styles.toolbarButtonActive : null,
          )}
        >
          Select
        </ToggleGroupItem>
        <ToggleGroupItem
          aria-label="Pan wall"
          value="pan"
          className={cn(
            styles.toolbarButton,
            pointerMode === "pan" ? styles.toolbarButtonActive : null,
          )}
        >
          Pan
        </ToggleGroupItem>
      </ToggleGroup>

      <Button
        variant="ghost"
        type="button"
        onClick={onClearSelection}
        disabled={!selectionExists}
        className={cn(
          styles.toolbarButton,
          !selectionExists ? styles.toolbarButtonDisabled : null,
        )}
      >
        Clear
      </Button>
      <Button
        variant="ghost"
        type="button"
        onClick={onPixelView}
        className={styles.toolbarButton}
      >
        Pixel view
      </Button>
    </div>
  );
}
