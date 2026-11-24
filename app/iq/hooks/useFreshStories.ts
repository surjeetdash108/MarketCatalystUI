"use client";

import { useEffect, useRef, useState } from "react";
import { takeFresh } from "../fresh-stories";

interface FreshState {
  /** The feed signature last compared; null until the first ready look. */
  sig: string | null;
  /** Every story key seen so far; null until the first ready look. */
  seen: Set<string> | null;
  /** Primary keys of the stories currently flagged as new. */
  fresh: ReadonlySet<string>;
}

const NONE: ReadonlySet<string> = new Set();

/**
 * Live Feed arrivals. Pass one key list per story of the WHOLE feed (before any
 * tab, filter or paging), newest first — index 0 of each is the story's primary
 * key (see `freshStoryKeys`) — and `ready` once the first full load is in.
 * Returns the primary keys of stories that arrived since; they stay in the set
 * for `holdMs` so the row can show its green flash and NEW chip, then drop out.
 *
 * Nothing is fresh until `ready` flips (so the first load never lights up) and
 * the first ready look only seeds the baseline. See fresh-stories.ts.
 *
 * The comparison happens DURING render (React re-renders straight away, before
 * anything is committed), not in an effect: a story must already be marked fresh
 * in the very commit where its row first appears, or the arrival motion
 * (useArrivalMotion) would see a plain new row, then a later "fresh" one, and
 * never play.
 */
export function useFreshStories(
  stories: readonly (readonly string[])[],
  ready: boolean,
  { holdMs = 20_000, max = 10 }: { holdMs?: number; max?: number } = {},
): ReadonlySet<string> {
  const [st, setSt] = useState<FreshState>({ sig: null, seen: null, fresh: NONE });
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const scheduled = useRef<Set<string>>(new Set());
  // Only compare when the list really changed — `stories` is a new array every
  // render. The primary keys are enough to tell: an alias can only make a story
  // fresh together with a primary key that is new, so a change in aliases alone
  // never matters. ("\n" cannot appear in a URL or an id.)
  const sig = stories.map(s => s[0]).join("\n");

  let cur = st;
  if (ready && st.sig !== sig) {
    const r = takeFresh(st.seen, stories, max);
    cur = { sig, seen: r.seen, fresh: r.fresh.length ? new Set([...st.fresh, ...r.fresh]) : st.fresh };
    setSt(cur);
  }

  // Each flagged story drops out `holdMs` after it was flagged.
  const flagged = cur.fresh;
  useEffect(() => {
    for (const key of flagged) {
      if (scheduled.current.has(key)) continue;
      scheduled.current.add(key);
      const t = setTimeout(() => {
        timers.current.delete(t);
        setSt(p => {
          if (!p.fresh.has(key)) return p;
          const next = new Set(p.fresh);
          next.delete(key);
          return { ...p, fresh: next };
        });
      }, holdMs);
      timers.current.add(t);
    }
  }, [flagged, holdMs]);

  useEffect(() => {
    const pending = timers.current;
    return () => { pending.forEach(clearTimeout); pending.clear(); };
  }, []);

  return cur.fresh;
}
