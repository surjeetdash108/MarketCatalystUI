/**
 * Pure helpers for the 13F & Insider screen's lens chips ("Insider buying",
 * "Funds accumulating", ...), which can be combined. Kept out of the component
 * so the combining rules can be tested without rendering it.
 */

/** "any": a stock on at least one selected lens. "all": a stock on every selected lens. */
export type LensMode = "any" | "all";

/** The lens that stands for "everything, ranked by conviction": it is the starting state, not a filter. */
export const DEFAULT_LENS = "notable";

/**
 * The selection after clicking `key`. Every chip, "Most notable" included,
 * toggles on and off independently, in the order picked, so any mix can be
 * combined with "any" / "all". Clearing the last chip returns to "Most notable"
 * rather than an empty selection.
 */
export function toggleLens(selected: string[], key: string): string[] {
  if (selected.includes(key)) {
    const rest = selected.filter(k => k !== key);
    return rest.length > 0 ? rest : [DEFAULT_LENS];
  }
  return [...selected, key];
}

/**
 * Merges each selected lens's own ranked list.
 *  - one lens: that list unchanged.
 *  - "all": the first lens's list, kept only for stocks every other lens also has.
 *  - "any": every stock on any lens; those on more lenses first, then by the
 *    earliest-picked lens that has them, then by their rank on it (the lenses are
 *    ranked by different measures, so ranks are only compared within one lens).
 * `via` maps each ticker to the index of the first selected lens that has it, which is the
 * lens whose figure the row should show.
 */
export function combineLenses<T extends { t: string }>(
  lists: T[][],
  mode: LensMode,
): { rows: T[]; via: Map<string, number> } {
  const via = new Map<string, number>();
  if (lists.length === 0) return { rows: [], via };
  if (lists.length === 1) {
    for (const r of lists[0]) via.set(r.t, 0);
    return { rows: lists[0], via };
  }

  if (mode === "all") {
    const others = lists.slice(1).map(l => new Set(l.map(r => r.t)));
    const rows = lists[0].filter(r => others.every(s => s.has(r.t)));
    for (const r of rows) via.set(r.t, 0);
    return { rows, via };
  }

  const seen = new Map<string, { row: T; hits: number; first: number; rank: number }>();
  lists.forEach((list, li) => {
    list.forEach((row, rank) => {
      const e = seen.get(row.t);
      if (e) e.hits++;
      else seen.set(row.t, { row, hits: 1, first: li, rank });
    });
  });
  const merged = [...seen.values()].sort((a, b) => b.hits - a.hits || a.first - b.first || a.rank - b.rank);
  for (const e of merged) via.set(e.row.t, e.first);
  return { rows: merged.map(e => e.row), via };
}

/** Header text for the selection: one label, "A + B", or "A + N more". */
export function lensTitle(labels: string[]): string {
  if (labels.length <= 2) return labels.join(" + ");
  return `${labels[0]} + ${labels.length - 1} more`;
}

/** Source tag for the selection ("FORM 4", "13F", "FORM 4 + 13F"): each part once, in order. */
export function lensSources(srcs: string[]): string {
  const parts: string[] = [];
  for (const s of srcs) for (const p of s.split(" + ")) if (!parts.includes(p)) parts.push(p);
  return parts.join(" + ");
}
