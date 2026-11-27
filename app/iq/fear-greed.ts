/**
 * Pure helpers for the Fear & Greed card: its five zones, and the "previous close /
 * 1 week / 1 month / 1 year ago" readings picked from the stored daily history.
 * Kept out of the component so they can be tested without rendering it.
 */

export interface FgZone {
  key: "extreme-fear" | "fear" | "neutral" | "greed" | "extreme-greed";
  label: string;
  /** The zone covers [from, to] on the 0–100 scale. */
  from: number;
  to: number;
  color: string;
}

export const FG_ZONES: readonly FgZone[] = [
  { key: "extreme-fear", label: "Extreme Fear", from: 0, to: 25, color: "#F87171" },
  { key: "fear", label: "Fear", from: 25, to: 45, color: "#FB923C" },
  { key: "neutral", label: "Neutral", from: 45, to: 55, color: "#F5B544" },
  { key: "greed", label: "Greed", from: 55, to: 75, color: "#A3E635" },
  { key: "extreme-greed", label: "Extreme Greed", from: 75, to: 100, color: "#4ADE80" },
];

/** The zone a reading falls in. Same cut-offs as the backend's `label()` (fear-greed.job): < 25, < 45, <= 55, <= 75. */
export function fgZone(v: number): FgZone {
  if (v < 25) return FG_ZONES[0];
  if (v < 45) return FG_ZONES[1];
  if (v <= 55) return FG_ZONES[2];
  if (v <= 75) return FG_ZONES[3];
  return FG_ZONES[4];
}

export interface FgPast {
  /** "Previous close", "1 week ago", ... */
  label: string;
  /** The session (YYYY-MM-DD) the reading is from. */
  date: string;
  value: number;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
/** How far before a lookback date the nearest reading may be (a long weekend plus a holiday); further and the row is left out. */
const MAX_GAP_DAYS = 5;

const toMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** `iso` moved back by whole months, the day clamped to the target month's length (31 Mar - 1 month = 28 Feb, not 3 Mar). */
function monthsBack(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const idx = y * 12 + (m - 1) - months;
  const ty = Math.floor(idx / 12);
  const tm = idx % 12;
  const last = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return toIso(Date.UTC(ty, tm, Math.min(d, last)));
}

/**
 * Previous close, 1 week, 1 month and 1 year ago, each the stored reading on that
 * date or the nearest session before it (within MAX_GAP_DAYS). A row with no
 * reading that close is left out, never filled with a guess. `asOfDate` is the
 * session the current reading belongs to; the previous close is the latest
 * reading strictly before it.
 */
export function fgPastReadings(
  history: ReadonlyArray<{ id: string; value?: number | null }>,
  asOfDate: string | null | undefined,
): FgPast[] {
  if (!asOfDate || !ISO.test(asOfDate)) return [];
  const rows = history
    .filter((h): h is { id: string; value: number } => typeof h.value === "number" && Number.isFinite(h.value) && ISO.test(h.id))
    .sort((a, b) => a.id.localeCompare(b.id));

  const nearest = (target: string, strict: boolean) => {
    let hit: { id: string; value: number } | null = null;
    for (const r of rows) {
      if (strict ? r.id < target : r.id <= target) hit = r;
      else break;
    }
    if (!hit) return null;
    return (toMs(target) - toMs(hit.id)) / DAY_MS <= MAX_GAP_DAYS + (strict ? 1 : 0) ? hit : null;
  };

  const asOfMs = toMs(asOfDate);
  const targets: Array<[string, string, boolean]> = [
    ["Previous close", asOfDate, true],
    ["1 week ago", toIso(asOfMs - 7 * DAY_MS), false],
    ["1 month ago", monthsBack(asOfDate, 1), false],
    ["1 year ago", monthsBack(asOfDate, 12), false],
  ];
  const out: FgPast[] = [];
  for (const [label, target, strict] of targets) {
    const hit = nearest(target, strict);
    if (hit) out.push({ label, date: hit.id, value: Math.round(hit.value) });
  }
  return out;
}
