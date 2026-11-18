import type { NewsArticleDoc } from "../types/news";

/** Newest cursor time across the list, as the ISO string `GET /live/news?since=`
 *  expects; null for an empty list. The cursor is `createdAt` (stamped once when
 *  an article is first stored), NOT `updatedAt`: the news job re-stamps
 *  `updatedAt` on a ticker's newest articles every run, which would make them
 *  look new on every poll. Falls back to updatedAt, then publishedAt, for docs
 *  with no createdAt. Mirrors the backend's newsStamp. */
export function newsCursor(list: readonly NewsArticleDoc[]): string | null {
  let best = 0;
  let bestStr: string | null = null;
  for (const a of list) {
    for (const s of [a.createdAt, a.updatedAt, a.publishedAt]) {
      const ms = typeof s === "string" ? Date.parse(s) : NaN;
      if (Number.isFinite(ms)) {
        if (ms > best) {
          best = ms;
          bestStr = s as string;
        }
        break; // first usable field wins for this article
      }
    }
  }
  return bestStr;
}

/** A job run stamps one `createdAt` on all its docs but commits them in several
 *  chunks. A cursor this fresh may sit mid-run, so the poll re-asks for docs AT
 *  that instant (`since` = cursor - 1 ms) until the run has surely finished;
 *  duplicates are harmless because mergeNews matches on id. */
const RUN_SETTLE_MS = 3 * 60_000;

/** The `since` value to send for the held list, or null to do a full load. */
export function sinceParam(list: readonly NewsArticleDoc[], nowMs: number): string | null {
  const cursor = newsCursor(list);
  if (!cursor) return null;
  const ms = Date.parse(cursor);
  return nowMs - ms < RUN_SETTLE_MS ? new Date(ms - 1).toISOString() : cursor;
}

/** Folds an incremental batch into the held list: replaces an article with the
 *  same id (changed content), adds the rest, newest published first. Returns
 *  the same array when the batch is empty so React skips a re-render. */
export function mergeNews(
  current: NewsArticleDoc[],
  incoming: readonly NewsArticleDoc[],
): NewsArticleDoc[] {
  if (incoming.length === 0) return current;
  const byId = new Map(current.map((a) => [a.id, a]));
  // Re-delivered articles we already hold unchanged (the settle window below
  // re-asks for the newest batch) must not trigger a re-render, since the
  // screens recompute news scoring from this list.
  if (incoming.every((a) => byId.get(a.id)?.updatedAt === a.updatedAt && byId.has(a.id))) {
    return current;
  }
  for (const a of incoming) byId.set(a.id, a);
  return [...byId.values()].sort((x, y) =>
    String(y.publishedAt ?? "").localeCompare(String(x.publishedAt ?? "")),
  );
}
