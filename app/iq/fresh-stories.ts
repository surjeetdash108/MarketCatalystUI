// Live Feed: which stories just ARRIVED (and so get the green flash + NEW chip).
//
// A story is new when none of its identity keys were in the feed the last time
// we looked. The first look only seeds the baseline, so opening the page never
// lights up the whole feed.
//
// Identity is the article URL (falling back to the id) AND ticker|headline —
// the same two checks the screen uses to drop a live-wire story once its synced
// copy lands. Keying on the row id alone would flag that replacement as a new
// story, and keying on the URL alone would miss the copies that only match by
// headline (the two feeds sometimes carry different URLs for one article).

/** The key a story's row is looked up by: the article URL, else its id. */
export function freshStoryKey(n: { url?: string | null; id: string }): string {
  return n.url || n.id;
}

/**
 * Every identity key of a story. Index 0 is the primary key (what the row is
 * looked up by, `freshStoryKey`); the rest are aliases that mark the same story
 * under another URL. A story with no headline has no headline alias — an empty
 * one would collide across unrelated stories.
 */
export function freshStoryKeys(
  n: { url?: string | null; id: string; ticker?: string | null; headline?: string | null },
): string[] {
  const primary = freshStoryKey(n);
  const headline = (n.headline ?? "").toLowerCase();
  return headline ? [primary, `${n.ticker ?? ""}|${headline}`] : [primary];
}

/**
 * Compare the current feed (one key list per story, newest first) against the
 * keys already seen.
 *
 * `seen === null` is the first look: everything is baseline, nothing is fresh.
 * After that, `fresh` holds the primary key of each story none of whose keys
 * were seen, in feed order, capped at `max` — a bulk sync can drop dozens of
 * stories at once and a wall of green helps nobody, so only the newest few are
 * flagged. Every key is added to the returned `seen` either way, so a story
 * that was capped out is never flagged on a later poll.
 */
export function takeFresh(
  seen: ReadonlySet<string> | null,
  stories: readonly (readonly string[])[],
  max: number,
): { seen: Set<string>; fresh: string[] } {
  const next = new Set(seen ?? []);
  const added: string[] = [];
  for (const keys of stories) {
    if (keys.length === 0) continue;
    const isNew = seen !== null && !keys.some(k => next.has(k));
    for (const k of keys) next.add(k);
    if (isNew) added.push(keys[0]);
  }
  return { seen: next, fresh: added.slice(0, Math.max(0, max)) };
}
