"use client";

import { useEffect } from "react";
import { trackFeatureOpen } from "./feature-adoption";

/**
 * Records a feature open on mount.
 *
 * A component rather than a hook call in the page because the screen pages are
 * async server components — they cannot run effects. This is the smallest
 * possible client boundary: it renders nothing and exists only for the effect.
 *
 * Placed INSIDE ScreenGate by the caller, so a screen blocked by its release
 * flag is not counted as opened — the user never saw it.
 */
export function TrackFeature({ feature }: { feature: string }) {
  useEffect(() => {
    // Deliberately not awaited: adoption tracking must never delay paint.
    trackFeatureOpen(feature);
  }, [feature]);

  return null;
}
