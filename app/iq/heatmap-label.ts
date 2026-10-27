/**
 * The % label on a heatmap tile. Small tiles used to show the ticker alone
 * (E2E Oct 26: BAC, CSCO, VR… had no % label). Whenever the ticker fits, the
 * move is shown too — full ("+0.43%") when there is room, abbreviated to one
 * decimal without the % sign ("+0.4") when there is not.
 */
export function tilePctLabel(chg: number | null | undefined, cellPxW: number, cellPxH: number): string | null {
  if (chg == null || !Number.isFinite(chg)) return null;
  const s = chg >= 0 ? "+" : "−";
  const roomy = cellPxW >= 34 && cellPxH >= 24;
  return roomy ? `${s}${Math.abs(chg).toFixed(2)}%` : `${s}${Math.abs(chg).toFixed(1)}`;
}
