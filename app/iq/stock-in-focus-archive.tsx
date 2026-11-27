"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiGet } from "./backend";
import { archiveOrder, focusDayLabel, STOCK_IN_FOCUS_NOTE } from "./wmn-model";
import type { WmnStockInFocus } from "./types/wmn";

/** Entries fetched first, and added by each "Show older". One a day, so a page is about six weeks. */
const PAGE = 30;

/**
 * Every Stock in Focus the desk has posted, newest day first, in a dialog opened
 * from the last "What Matters Now" slide.
 *
 * Rendered by the dashboard, NOT inside the carousel: the slide sits in a
 * transformed, clipped, `inert`-when-off-screen track, where a fixed overlay
 * would be cropped and unreachable. It is portaled into `.iq-root` (not `body`)
 * so the theme variables, which are scoped to that element, still apply.
 *
 * Older entries are loaded by asking for a larger `limit` (the endpoint has no
 * cursor: one entry a day keeps the list small). The entries already on screen
 * stay put while the bigger list loads.
 */
export function StockInFocusArchive({
  onClose,
  onTicker,
}: {
  onClose: () => void;
  onTicker?: (ticker: string) => void;
}) {
  const [limit, setLimit] = useState(PAGE);
  const [entries, setEntries] = useState<WmnStockInFocus[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const now = new Date();

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setLoading(true);
        setError(null);
      }
    });
    apiGet<{ entries?: WmnStockInFocus[] }>(`/api/stock-in-focus?limit=${limit}`)
      .then((r) => {
        if (cancelled) return;
        setEntries(archiveOrder(r.entries ?? []));
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Couldn't load the archive.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [limit]);

  // Focus once, on open. (Not with the key handler below: that re-subscribes when
  // the parent re-renders, and would pull focus back each time.)
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // More may exist when the server returned a full page.
  const mayHaveMore = entries != null && entries.length >= limit;

  const dialog = (
    <div className="sif-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sif-dlg" role="dialog" aria-modal="true" aria-label="Stock in Focus archive">
        <div className="sif-head">
          <div>
            <h2>Stock in Focus archive</h2>
            <div className="sif-sub">{STOCK_IN_FOCUS_NOTE}</div>
          </div>
          <button ref={closeRef} type="button" className="sif-x" aria-label="Close" onClick={onClose}>×</button>
        </div>
        <div className="sif-body">
          {error && !entries && <div className="sif-msg">{error}</div>}
          {!error && !entries && loading && <div className="sif-msg">Loading…</div>}
          {entries && entries.length === 0 && <div className="sif-msg">Nothing has been posted yet.</div>}
          {entries?.map((e) => (
            <article className="sif-item" key={e.day}>
              <div className="sif-item-top">
                <span className="sif-day">{focusDayLabel(e.day, now)}</span>
                {onTicker ? (
                  <button type="button" className="sif-tk link" onClick={() => { onTicker(e.ticker); onClose(); }}>{e.ticker}</button>
                ) : (
                  <span className="sif-tk">{e.ticker}</span>
                )}
              </div>
              <div className="sif-hl">{e.headline}</div>
              {e.note && <div className="sif-note">{e.note}</div>}
            </article>
          ))}
          {entries && error && <div className="sif-msg">{error}</div>}
          {mayHaveMore && (
            <button type="button" className="sif-more" disabled={loading} onClick={() => setLimit((n) => n + PAGE)}>
              {loading ? "Loading…" : "Show older"}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // Into the app root so its theme variables apply; inline only if it is somehow absent.
  const root = typeof document !== "undefined" ? document.querySelector(".iq-root") : null;
  return root ? createPortal(dialog, root) : dialog;
}
