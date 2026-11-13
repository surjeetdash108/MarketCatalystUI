// Trade Tracker storage: every trade a user saves, kept per stock, in this browser.
// Saving never replaces an earlier trade, so a bullish and a bearish set-up (or
// several set-ups with different horizons or weights) for one stock all stay.
//
// Layout: `si_trades_<TICKER>` holds a JSON array of trades, newest first.
// Older builds kept ONE trade per stock in `si_thesis_<TICKER>`; it is moved into
// the array the first time it is read, then the old key is removed.

export type TradeDir = "Bull" | "Bear";

export interface SavedTrade {
  /** Unique per saved trade, so a stock can hold several. */
  id: string;
  ticker: string;
  dir: TradeDir;
  hz: string;
  title: string;
  target: number;
  stop: number;
  confAtSave: number | null;
  savedDate: string;
  /** Price when the trade was saved. Trades saved before this field existed have none. */
  entryPx?: number | null;
  /** ISO time the trade was saved. */
  savedAt?: string;
  wO?: Record<string, number> | null;
}

/** The slice of `Storage` used here (so tests can pass a fake). */
export interface TradeStore {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const PREFIX = "si_trades_";
const LEGACY_PREFIX = "si_thesis_";
/** Saving the same set-up again within this long is a double click, not a new trade. */
const DUPLICATE_WINDOW_MS = 60_000;

export const tradesKey = (ticker: string): string => `${PREFIX}${ticker.toUpperCase()}`;
const legacyKey = (ticker: string): string => `${LEGACY_PREFIX}${ticker.toUpperCase()}`;

const savedMs = (t: { savedAt?: string }): number => {
  const ms = t.savedAt ? Date.parse(t.savedAt) : NaN;
  return Number.isFinite(ms) ? ms : 0;
};
const newestFirst = (a: SavedTrade, b: SavedTrade): number => savedMs(b) - savedMs(a);

function isTrade(x: unknown): x is Omit<SavedTrade, "id"> & { id?: string } {
  const t = x as Partial<SavedTrade> | null;
  return !!t && typeof t.ticker === "string" && (t.dir === "Bull" || t.dir === "Bear") && typeof t.hz === "string" && typeof t.target === "number" && typeof t.stop === "number";
}

function parse(raw: string | null): unknown {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

/** All trades saved for one stock, newest first. Moves an old single-trade record into the list. */
export function readTrades(store: TradeStore, ticker: string): SavedTrade[] {
  const sym = ticker.toUpperCase();
  const stored = parse(store.getItem(tradesKey(sym)));
  const list: SavedTrade[] = [];
  for (const t of Array.isArray(stored) ? stored : []) {
    if (isTrade(t)) list.push({ ...t, id: t.id || `t-${savedMs(t)}` });
  }

  const old = parse(store.getItem(legacyKey(sym)));
  if (isTrade(old)) {
    const id = old.id || `t-${savedMs(old)}`;
    if (!list.some((t) => t.id === id)) list.push({ ...old, id });
  }
  list.sort(newestFirst);

  if (store.getItem(legacyKey(sym)) != null) {
    // Keep the old record only if it could not be moved into the list.
    try {
      writeTrades(store, sym, list);
      store.removeItem(legacyKey(sym));
    } catch { /* storage full or blocked: the old key stays and is read again next time */ }
  }
  return list;
}

export function writeTrades(store: TradeStore, ticker: string, trades: SavedTrade[]): void {
  if (trades.length === 0) store.removeItem(tradesKey(ticker));
  else store.setItem(tradesKey(ticker), JSON.stringify(trades));
}

const sameSetup = (a: Omit<SavedTrade, "id">, b: Omit<SavedTrade, "id">): boolean =>
  a.ticker === b.ticker && a.dir === b.dir && a.hz === b.hz && a.target === b.target && a.stop === b.stop &&
  JSON.stringify(a.wO ?? null) === JSON.stringify(b.wO ?? null);

/** Add a trade to a stock's list. Never replaces another trade; a double click on Save is ignored. */
export function addTrade(
  trades: SavedTrade[],
  input: Omit<SavedTrade, "id">,
  nowMs: number = Date.now(),
  rand: string = Math.random().toString(36).slice(2, 6),
): { trades: SavedTrade[]; trade: SavedTrade } {
  const dupe = trades.find((t) => sameSetup(t, input) && nowMs - savedMs(t) >= 0 && nowMs - savedMs(t) < DUPLICATE_WINDOW_MS);
  if (dupe) return { trades, trade: dupe };
  const trade: SavedTrade = { ...input, id: `${nowMs.toString(36)}-${rand}` };
  return { trades: [trade, ...trades].sort(newestFirst), trade };
}

export function removeTrade(trades: SavedTrade[], id: string): SavedTrade[] {
  return trades.filter((t) => t.id !== id);
}

/** Every trade saved in this browser, grouped by stock (A to Z), newest first within a stock. */
export function listAllTrades(store: TradeStore): SavedTrade[] {
  const tickers = new Set<string>();
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (!key) continue;
    if (key.startsWith(PREFIX)) tickers.add(key.slice(PREFIX.length));
    else if (key.startsWith(LEGACY_PREFIX)) tickers.add(key.slice(LEGACY_PREFIX.length));
  }
  const all: SavedTrade[] = [];
  for (const t of tickers) all.push(...readTrades(store, t));
  return all.sort((a, b) => a.ticker.localeCompare(b.ticker) || newestFirst(a, b));
}

/** "Nov 14, 2026 · 2:08 AM", or "" when the trade has no usable save time (saved by an old build). */
export function formatSavedAt(savedAt: string | undefined): string {
  const ms = savedAt ? Date.parse(savedAt) : NaN;
  if (!Number.isFinite(ms)) return "";
  const d = new Date(ms);
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}
