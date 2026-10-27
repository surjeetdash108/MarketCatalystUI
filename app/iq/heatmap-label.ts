/**
 * The % label on a heatmap tile. Small tiles used to show the ticker alone
 * (E2E Oct 26: BAC, CSCO, VR… had no % label). Whenever the ticker fits, the
 * move is shown too:
 * - Roomy tiles (>=48w && >=30h): full 2 decimals ("-3.20%")
 * - Mid-small tiles (>=38w && >=22h): 1 decimal with percent ("-3.2%") to avoid clipping ADBE/ABT
 * - Small tiles (<38w || <22h): 1 decimal without percent ("-3.2")
 */
export function tilePctLabel(chg: number | null | undefined, cellPxW: number, cellPxH: number): string | null {
  if (chg == null || !Number.isFinite(chg)) return null;
  const s = chg >= 0 ? "+" : "−";
  const abs = Math.abs(chg);

  if (cellPxW >= 48 && cellPxH >= 30) {
    return `${s}${abs.toFixed(2)}%`;
  }
  if (cellPxW >= 38 && cellPxH >= 22) {
    return `${s}${abs.toFixed(1)}%`;
  }
  return `${s}${abs.toFixed(1)}`;
}

export interface TileTypography {
  showText: boolean;
  fs: number;
  pctFs: number;
  pctLabel: string | null;
  gapPx: number;
}

/**
 * Computes font sizes and label parameters so small tiles never clip
 * ticker or percent moves (ADBE −3.20%, ABT −0.74%).
 */
export function tileTypography(
  sym: string,
  chg: number | null | undefined,
  cellPxW: number,
  cellPxH: number,
): TileTypography {
  const minDim = Math.min(cellPxW, cellPxH);
  if (minDim < 13 || cellPxW < 18) {
    return { showText: false, fs: 0.45, pctFs: 0.38, pctLabel: null, gapPx: 1 };
  }

  const rawPctLabel = tilePctLabel(chg, cellPxW, cellPxH);
  // Only display pct when height has at least 20px so 2 lines don't clip vertically
  const showPct = rawPctLabel != null && cellPxH >= 20;
  const activePctLabel = showPct ? rawPctLabel : null;

  const availW = Math.max(12, cellPxW - 4);
  const availH = Math.max(10, cellPxH - 4);

  const symLen = sym.length;
  const pctLen = activePctLabel ? activePctLabel.length : 0;
  const maxLen = Math.max(symLen, pctLen);

  // Geometric mean base font size
  let fs = Math.min(1.05, Math.sqrt(cellPxW * cellPxH) / 72);

  // Horizontal bounding: ~0.6ch per character in mono font
  const maxFsW = availW / (Math.max(1, maxLen) * 9.6);
  fs = Math.min(fs, maxFsW);

  // Vertical bounding: line 1 + optional gap + line 2
  const gapPx = cellPxH < 28 ? 1 : 2;
  const totalEm = activePctLabel ? 1.82 : 1.0;
  const maxFsH = (availH - (activePctLabel ? gapPx : 0)) / (totalEm * 16);
  fs = Math.min(fs, maxFsH);

  // Bounds
  fs = Math.max(0.42, Math.min(1.05, Number(fs.toFixed(3))));
  const pctFs = Math.max(0.35, Number((fs * 0.82).toFixed(3)));

  return {
    showText: true,
    fs,
    pctFs,
    pctLabel: activePctLabel,
    gapPx,
  };
}
