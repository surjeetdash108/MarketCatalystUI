"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { firebaseAuth } from "../../firebase";
import { apiGet, apiPost, apiPatch, apiDelete } from "../backend";

export interface Watchlist {
  id: string;
  name: string;
  tickers: string[];
}

export type WatchlistsApi = ReturnType<typeof useWatchlists>;

/** Outcome of adding a ticker, so callers can say whether it worked and why not. */
export type AddTickerResult = { ok: true } | { ok: false; message: string };

/** The message shown when a list is at the plan's ticker limit. */
export function watchlistFullMessage(limit: number): string {
  return `This watchlist is full. The Free plan holds up to ${limit} stocks per watchlist — remove one, or upgrade to add more.`;
}

/** Backend errors arrive as a JSON body string; pull out its `message`. */
function apiErrorMessage(e: unknown, fallback: string): string {
  const raw = e instanceof Error ? e.message : "";
  try {
    const msg = (JSON.parse(raw) as { message?: unknown }).message;
    if (typeof msg === "string" && msg.trim()) return msg.trim();
  } catch { /* not JSON */ }
  return fallback;
}

/**
 * Shared instance provided once at the shell so every consumer (the ⌘K search
 * star, the stock-page star, and the Watchlist screen) reads and mutates ONE
 * state — a star anywhere shows up on the Watchlist screen immediately, with no
 * manual refresh.
 */
export const WatchlistsContext = createContext<WatchlistsApi | null>(null);

export function useWatchlistsContext(): WatchlistsApi {
  const ctx = useContext(WatchlistsContext);
  if (!ctx) throw new Error("useWatchlistsContext used outside <WatchlistsContext.Provider>");
  return ctx;
}

/**
 * Multiple named watchlists for the signed-in user. Backed by
 * GET/POST/PATCH/DELETE /api/watchlists (users/{uid}/watchlists/{id}). All
 * mutations update local state optimistically and reconcile from the server
 * response; a failed write refetches so the UI never drifts from the backend.
 */
export function useWatchlists() {
  const uid = firebaseAuth.currentUser?.uid ?? null;
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [loading, setLoading] = useState(true);
  // Max tickers per list on the user's plan; null = no limit (or unknown).
  const [tickerLimit, setTickerLimit] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (!uid) { setWatchlists([]); setLoading(false); return; }
    try {
      const res = await apiGet<{ watchlists: Watchlist[]; tickerLimit?: number | null }>("/api/watchlists");
      setWatchlists(res.watchlists ?? []);
      setTickerLimit(typeof res.tickerLimit === "number" ? res.tickerLimit : null);
    } catch { /* keep previous */ } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => { void refresh(); }, [refresh]);

  const createList = useCallback(async (name: string): Promise<Watchlist | null> => {
    try {
      const created = await apiPost<Watchlist>("/api/watchlists", { name });
      setWatchlists(prev => [...prev, created]);
      return created;
    } catch { return null; }
  }, []);

  const renameList = useCallback(async (id: string, name: string) => {
    setWatchlists(prev => prev.map(w => (w.id === id ? { ...w, name } : w)));
    try { await apiPatch<Watchlist>(`/api/watchlists/${id}`, { name }); } catch { void refresh(); }
  }, [refresh]);

  const deleteList = useCallback(async (id: string) => {
    // Deleting the last list makes the server recreate an empty "My Watchlist".
    // Removing it locally first would flash a no-watchlist screen until the
    // reply lands, so in that case keep it on screen and swap in the reply.
    setWatchlists(prev => (prev.length > 1 ? prev.filter(w => w.id !== id) : prev));
    try {
      const res = await apiDelete<{ watchlists: Watchlist[] }>(`/api/watchlists/${id}`);
      setWatchlists(res.watchlists ?? []);
    } catch { void refresh(); }
  }, [refresh]);

  /**
   * Adds a ticker and reports the outcome. A list already at the plan limit is
   * refused up front, without a round trip. If the server refuses (limit,
   * unknown symbol), the optimistic add is undone immediately and its message
   * is returned for the caller to show — never swallowed.
   */
  const addTicker = useCallback(async (id: string, sym: string): Promise<AddTickerResult> => {
    const s = sym.toUpperCase();
    const list = watchlists.find(w => w.id === id);
    if (list?.tickers.includes(s)) return { ok: true };
    if (list && tickerLimit != null && list.tickers.length >= tickerLimit) {
      return { ok: false, message: watchlistFullMessage(tickerLimit) };
    }
    setWatchlists(prev => prev.map(w => (w.id === id && !w.tickers.includes(s) ? { ...w, tickers: [...w.tickers, s] } : w)));
    try {
      await apiPost<Watchlist>(`/api/watchlists/${id}/tickers`, { ticker: s });
      return { ok: true };
    } catch (e) {
      setWatchlists(prev => prev.map(w => (w.id === id ? { ...w, tickers: w.tickers.filter(t => t !== s) } : w)));
      void refresh();
      return { ok: false, message: apiErrorMessage(e, `Couldn't add ${s}. Please try again.`) };
    }
  }, [watchlists, tickerLimit, refresh]);

  const removeTicker = useCallback(async (id: string, sym: string) => {
    const s = sym.toUpperCase();
    setWatchlists(prev => prev.map(w => (w.id === id ? { ...w, tickers: w.tickers.filter(t => t !== s) } : w)));
    try { await apiDelete<Watchlist>(`/api/watchlists/${id}/tickers/${encodeURIComponent(s)}`); } catch { void refresh(); }
  }, [refresh]);

  return { uid, watchlists, loading, tickerLimit, refresh, createList, renameList, deleteList, addTicker, removeTicker };
}
