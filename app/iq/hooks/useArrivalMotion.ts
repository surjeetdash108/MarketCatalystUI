"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";

const EASE = "cubic-bezier(.2,.9,.25,1)";
const MS = 520;

/**
 * Live Feed arrival motion — a new story drops in from above and the stories
 * under it slide down to make room, instead of everything jumping.
 *
 * Rows are the `[data-fid]` children of `bodyRef`; a row that is NEW carries
 * `data-fresh="1"`. After every commit this remembers where each row sits
 * (FLIP: First/Last/Invert/Play). It only animates a commit where a fresh row
 * has newly appeared — expanding a row, paging, or any other reflow stays
 * instant — and never when `scope` (tab + filters + page) changed in the same
 * commit, since that is a different list, not an arrival.
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
    if (!rows.some(r => r.dataset.fresh === "1" && !prev.tops.has(r.dataset.fid as string))) return;
    if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    for (const r of rows) {
      const id = r.dataset.fid as string;
      const before = prev.tops.get(id);
      if (before === undefined) {
        // Only a row that is genuinely new drops in; a row that merely entered
        // this page (pushed over from the next one) stays put.
        if (r.dataset.fresh === "1") {
          r.animate(
            [{ opacity: 0, transform: "translateY(-34px)" }, { opacity: 1, transform: "none" }],
            { duration: MS, easing: EASE, fill: "backwards" },
          );
        }
        continue;
      }
      const d = before - (tops.get(id) as number);
      if (Math.abs(d) > 1) {
        r.animate([{ transform: `translateY(${d}px)` }, { transform: "none" }], { duration: MS, easing: EASE });
      }
    }
  });
}
