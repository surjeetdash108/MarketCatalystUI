/** Stories per page in Live Feed → Intraday commentary. */
export const FEED_PAGE_SIZE = 50;

/**
 * The slice of a `total`-item list shown on `page` (0-based), `size` per page.
 * A page past the end — the list shrank under a filter — snaps to the last page.
 */
export function pageWindow(total: number, page: number, size = FEED_PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(total / size));
  const p = Math.min(Math.max(0, page), pages - 1);
  return { page: p, pages, from: p * size, to: Math.min(total, (p + 1) * size), hasPrev: p > 0, hasNext: p < pages - 1 };
}
