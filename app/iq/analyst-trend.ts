/**
 * What analysts have been doing on one stock lately, for the summary above the
 * stock page's Analyst Actions table: counts of upgrades, downgrades and
 * target changes over 30 and 90 days, the average new target, and a one-line
 * direction.
 */
export interface TrendCall {
  act: string; // "Upgrade" | "Downgrade" | "PT Raise" | "PT Cut" | "Initiate" | "Maintain" | ...
  dir: number; // 1 bullish, -1 bearish, 0 neutral
  pt1: number; // the firm's own target with this call; 0 when none
  ptSource?: "firm" | "consensus";
  date: string; // YYYY-MM-DD
}

export interface TrendWindow {
  days: number;
  calls: number;
  upgrades: number;
  downgrades: number;
  raises: number;
  cuts: number;
  initiations: number;
  bullish: number;
  bearish: number;
  /** Average of the firms' own targets on calls in the window; null when none gave one. */
  avgTarget: number | null;
}

function since(todayIso: string, days: number): string {
  const d = new Date(`${todayIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export function trendWindow(calls: readonly TrendCall[], todayIso: string, days: number): TrendWindow {
  const from = since(todayIso, days);
  const w: TrendWindow = { days, calls: 0, upgrades: 0, downgrades: 0, raises: 0, cuts: 0, initiations: 0, bullish: 0, bearish: 0, avgTarget: null };
  const targets: number[] = [];
  for (const c of calls) {
    if (c.date < from || c.date > todayIso) continue;
    w.calls++;
    const a = c.act.toLowerCase();
    if (a.startsWith("upgrade")) w.upgrades++;
    else if (a.startsWith("downgrade")) w.downgrades++;
    else if (a.includes("raise")) w.raises++;
    else if (a.includes("cut") || a.includes("lower")) w.cuts++;
    else if (a.startsWith("init")) w.initiations++;
    if (c.dir > 0) w.bullish++;
    else if (c.dir < 0) w.bearish++;
    if (c.pt1 > 0 && c.ptSource !== "consensus") targets.push(c.pt1);
  }
  if (targets.length) w.avgTarget = targets.reduce((s, v) => s + v, 0) / targets.length;
  return w;
}

/** One line on the direction of the last 30 days, falling back to 90. */
export function trendLine(w30: TrendWindow, w90: TrendWindow): string {
  const w = w30.calls > 0 ? w30 : w90;
  if (w.calls === 0) return "No analyst calls in the last 90 days.";
  const parts: string[] = [];
  if (w.upgrades) parts.push(`${w.upgrades} upgrade${w.upgrades === 1 ? "" : "s"}`);
  if (w.downgrades) parts.push(`${w.downgrades} downgrade${w.downgrades === 1 ? "" : "s"}`);
  if (w.raises) parts.push(`${w.raises} target raise${w.raises === 1 ? "" : "s"}`);
  if (w.cuts) parts.push(`${w.cuts} target cut${w.cuts === 1 ? "" : "s"}`);
  if (w.initiations) parts.push(`${w.initiations} initiation${w.initiations === 1 ? "" : "s"}`);
  const tone = w.bullish > w.bearish ? "Leaning bullish" : w.bearish > w.bullish ? "Leaning bearish" : "Mixed";
  const detail = parts.length ? parts.join(", ") : `${w.calls} reiteration${w.calls === 1 ? "" : "s"}`;
  return `${tone} over the last ${w.days} days: ${detail}.`;
}

export interface FirmTarget {
  firm: string;
  pt: number;
  rating: string;
  date: string;
}

/**
 * Each firm's most recent own price target on or after `fromIso`, highest
 * first: the "where targets sit" ticks and the per-firm bars. Calls without a
 * firm target (consensus fallback) are skipped.
 */
export function latestFirmTargets(
  calls: ReadonlyArray<TrendCall & { firm: string; to: string }>,
  fromIso: string,
): FirmTarget[] {
  const byFirm = new Map<string, FirmTarget>();
  for (const c of calls) {
    if (c.date < fromIso || !(c.pt1 > 0) || c.ptSource === "consensus" || !c.firm) continue;
    const key = c.firm.trim().toLowerCase();
    const prev = byFirm.get(key);
    if (!prev || c.date > prev.date) byFirm.set(key, { firm: c.firm, pt: c.pt1, rating: c.to, date: c.date });
  }
  return [...byFirm.values()].sort((a, b) => b.pt - a.pt);
}
