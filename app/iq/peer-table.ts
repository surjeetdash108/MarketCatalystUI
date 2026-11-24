/**
 * Pure helpers for the stock page's Peers table: which peers show by default,
 * how a clicked column header sorts them, and how the filter box interacts with
 * both. Kept out of the component so they can be tested without rendering it.
 */

/** Peers shown until the user asks for all of them: the largest by market cap. */
export const PEER_DEFAULT_LIMIT = 25;

export type PeerSortKey = "sym" | "price" | "c" | "w" | "m" | "mcap" | "pe" | "rs";
export type SortDir = "asc" | "desc";
export interface PeerSort { by: PeerSortKey; dir: SortDir }

/** The table opens ordered by market cap, largest first. */
export const DEFAULT_PEER_SORT: PeerSort = { by: "mcap", dir: "desc" };

export interface PeerLike {
  t: string;
  /** Today's % change. */
  c: number;
  price: number | null;
  marketCap: number | null;
  peRatio: number | null;
  rsRating: number | null;
  name: string | null;
  weeklyChange?: number | null;
  monthlyChange?: number | null;
}

/** Text sorts A→Z first; every number sorts biggest first. */
export function firstDirection(key: PeerSortKey): SortDir {
  return key === "sym" ? "asc" : "desc";
}

/** Clicking a header: the same column flips direction, a new one starts at its first direction. */
export function nextPeerSort(cur: PeerSort, key: PeerSortKey): PeerSort {
  if (cur.by === key) return { by: key, dir: cur.dir === "desc" ? "asc" : "desc" };
  return { by: key, dir: firstDirection(key) };
}

function valueOf(p: PeerLike, by: PeerSortKey): number | string | null {
  switch (by) {
    case "sym": return p.t;
    case "price": return p.price;
    case "c": return p.c;
    case "w": return p.weeklyChange ?? null;
    case "m": return p.monthlyChange ?? null;
    case "mcap": return p.marketCap;
    // The table shows a non-positive P/E as "n/a", so it sorts as empty.
    case "pe": return p.peRatio != null && p.peRatio > 0 ? p.peRatio : null;
    case "rs": return p.rsRating;
  }
}

/** Sorted copy. A peer with no value for the column is always last, in either direction; ties break by ticker. */
export function sortPeers<T extends PeerLike>(peers: T[], by: PeerSortKey, dir: SortDir): T[] {
  return [...peers].sort((a, b) => {
    const va = valueOf(a, by);
    const vb = valueOf(b, by);
    if (va == null && vb == null) return a.t.localeCompare(b.t);
    if (va == null) return 1;
    if (vb == null) return -1;
    const cmp = typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number);
    if (cmp === 0) return a.t.localeCompare(b.t);
    return dir === "asc" ? cmp : -cmp;
  });
}

/** The `limit` largest by market cap (peers with no market cap rank last), largest first. */
export function topByMarketCap<T extends PeerLike>(peers: T[], limit: number = PEER_DEFAULT_LIMIT): T[] {
  return sortPeers(peers, "mcap", "desc").slice(0, limit);
}

/** Lists joined by ticker; the first list's row wins, so richer rows (live-enriched) go first. */
export function mergePeers<T extends { t: string }>(...lists: T[][]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const list of lists) {
    for (const row of list) {
      if (seen.has(row.t)) continue;
      seen.add(row.t);
      out.push(row);
    }
  }
  return out;
}

export interface PeerViewOptions {
  /** The filter box. Searching looks at EVERY peer, so a match beyond the default 25 is still found. */
  query: string;
  by: PeerSortKey;
  dir: SortDir;
  /** True once the user has asked for all peers. */
  showAll: boolean;
  limit?: number;
}

/**
 * The rows to draw. By default only the `limit` largest by market cap are kept,
 * then the clicked column orders THOSE; with a search or "show all" the cap is
 * off and the column orders everything that matches.
 */
export function peerView<T extends PeerLike>(
  pool: T[],
  { query, by, dir, showAll, limit = PEER_DEFAULT_LIMIT }: PeerViewOptions,
): { rows: T[]; matched: number; limited: boolean } {
  const q = query.trim().toUpperCase();
  const matches = q
    ? pool.filter(p => p.t.toUpperCase().includes(q) || (p.name != null && p.name.toUpperCase().includes(q)))
    : pool;
  const capped = !showAll && q === "" && matches.length > limit;
  const kept = capped ? topByMarketCap(matches, limit) : matches;
  return { rows: sortPeers(kept, by, dir), matched: matches.length, limited: capped };
}
