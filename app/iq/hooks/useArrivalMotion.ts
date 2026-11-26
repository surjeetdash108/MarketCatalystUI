"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";

/** The one motion every arrival and intro uses (Live Feed, Pulse): soft ease-out. */
export const ARRIVAL_EASE = "cubic-bezier(.22,1,.36,1)";
export const ARRIVAL_MS = 620;
/** Gap between stories that arrive together, so they land one by one. */
export const ARRIVAL_STAGGER_MS = 160;
/** How far a new story drops from. */
const DROP_PX = 14;

/**
 * Live Feed / Pulse arrival motion — new stories drop in from just above and
 * the stories under them slide down to make room, instead of everything
 * jumping.
 *
 * Rows are the `[data-fid]` children of `bodyRef`; a row that is NEW carries
 * `data-fresh="1"`. After every commit this remembers where each row sits
 * (FLIP: First/Last/Invert/Play). It only animates a commit where a fresh row
 * has newly appeared — expanding a row, paging, or any other reflow stays
 * instant — and never when `scope` (tab + filters + page) changed in the same
 * commit, since that is a different list, not an arrival.
 *
 * Several stories in one refresh used to land all at once; they now land one
 * after another, top first, ARRIVAL_STAGGER_MS apart, each with its own flash
 * (the row's CSS flash animation is delayed to match).
 */
export function useArrivalMotion(bodyRef: RefObject<HTMLElement | null>, scope: string) {
  const last = useRef<{ tops: Map<string, number>; scope: string } | null>(null);

  useLayoutEffect(() => {
    const root = bodyRef.current;
    if (!root) { last.current = null; return; }
    const rows = Array.from(root.querySelectorAll<HTMLElement>("[data-fid]"));
    const tops = new Map<string, number>();
    for (const r of rows) tops.set(r.dataset.fid as string, r.offsetTop);
    const prev = last.current;
    last.current = { tops, scope };
    if (!prev || prev.scope !== scope) return;
    const arrived = rows.filter(r => r.dataset.fresh === "1" && !prev.tops.has(r.dataset.fid as string));
    if (arrived.length === 0) return;
    if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // New rows, top to bottom, each a stagger step later than the one above.
    arrived.forEach((r, i) => {
      const delay = i * ARRIVAL_STAGGER_MS;
      r.style.animationDelay = `${delay}ms`; // the green flash starts as the row lands
      r.animate(
        [{ opacity: 0, transform: `translateY(-${DROP_PX}px)` }, { opacity: 1, transform: "none" }],
        { duration: ARRIVAL_MS, delay, easing: ARRIVAL_EASE, fill: "backwards" },
      );
    });
    // Rows already on screen glide down over the whole sequence, so the list
    // makes room smoothly while the new stories land one by one.
    const span = ARRIVAL_MS + (arrived.length - 1) * ARRIVAL_STAGGER_MS;
    for (const r of rows) {
      const before = prev.tops.get(r.dataset.fid as string);
      if (before === undefined) continue;
      const d = before - (tops.get(r.dataset.fid as string) as number);
      if (Math.abs(d) > 1) {
        r.animate([{ transform: `translateY(${d}px)` }, { transform: "none" }], { duration: span, easing: ARRIVAL_EASE });
      }
    }
  });
}
