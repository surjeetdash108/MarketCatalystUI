// US equity market session status, computed from real Eastern Time so it's
// correct regardless of the viewer's own timezone. Regular hours are 9:30–16:00
// ET Mon–Fri; pre-market 4:00–9:30 ET; after-hours 16:00–20:00 ET. Weekends and
// full-closure US market holidays read as closed. Early-close half-days (e.g. the
// day after Thanksgiving) are treated as normal sessions — good enough for a
// header badge; upgrade to a vendor market-status feed if exact half-days matter.

export type MarketPhase = "open" | "pre" | "after" | "closed";

export interface MarketStatus {
  phase: MarketPhase;
  /** Short label for the header pill, e.g. "Markets Open". */
  label: string;
}

// NYSE/Nasdaq full-closure holidays, by observed date (YYYY-MM-DD). Extend yearly.
const MARKET_HOLIDAYS = new Set<string>([
  // 2026
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25",
  "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
  // 2027
  "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31",
  "2027-06-18", "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24",
]);

// Extract ET wall-clock parts (DST-aware via the IANA zone) for any Date,
// independent of the machine/browser timezone.
function etParts(d: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    })
      .formatToParts(d)
      .map(p => [p.type, p.value]),
  );
  const hour = parseInt(parts.hour, 10) % 24; // "24:00" → 0
  const minute = parseInt(parts.minute, 10);
  return {
    weekday: parts.weekday,                                    // "Mon" … "Sun"
    isoDate: `${parts.year}-${parts.month}-${parts.day}`,      // "2026-07-11"
    minutes: hour * 60 + minute,                               // minutes since ET midnight
  };
}

const OPEN = 9 * 60 + 30;  // 09:30
const CLOSE = 16 * 60;     // 16:00
const PRE = 4 * 60;        // 04:00
const AFTER_END = 20 * 60; // 20:00

/** Current US equity market session for the given instant (defaults to now). */
export function getMarketStatus(now: Date = new Date()): MarketStatus {
  const { weekday, isoDate, minutes } = etParts(now);

  if (weekday === "Sat" || weekday === "Sun" || MARKET_HOLIDAYS.has(isoDate)) {
    return { phase: "closed", label: "Markets Closed" };
  }
  if (minutes >= OPEN && minutes < CLOSE) return { phase: "open", label: "Markets Open" };
  if (minutes >= PRE && minutes < OPEN) return { phase: "pre", label: "Pre-Market" };
  if (minutes >= CLOSE && minutes < AFTER_END) return { phase: "after", label: "After Hours" };
  return { phase: "closed", label: "Markets Closed" };
}
