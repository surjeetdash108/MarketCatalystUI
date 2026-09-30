"use client";

import { useState } from "react";
import { watchlistFullMessage, type AddTickerResult, type Watchlist } from "./hooks/useWatchlists";

/**
 * Popover that asks which watchlist(s) a ticker belongs to. A ticker can be in
 * several lists at once (checkboxes). Includes inline "new watchlist" creation.
 * Anchored at a fixed viewport position (from the click that opened it).
 */
export function WatchlistPicker({
  sym, watchlists, onAdd, onRemove, onCreate, onClose, anchor, tickerLimit = null,
}: {
  sym: string;
  watchlists: Watchlist[];
  /** Resolves with the outcome so a refused add (e.g. a full list) is shown. */
  onAdd: (listId: string) => Promise<AddTickerResult>;
  onRemove: (listId: string) => void;
  onCreate: (name: string) => Promise<Watchlist | null>;
  onClose: () => void;
  anchor: { x: number; y: number };
  /** Max tickers per list on the user's plan; null = no limit. */
  tickerLimit?: number | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const W = 250;
  const left = Math.max(8, Math.min(anchor.x, vw - W - 8));
  const top = Math.min(anchor.y + 6, vh - 300);
  const S = sym.toUpperCase();

  async function create() {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    const created = await onCreate(name);
    setBusy(false);
    setNewName("");
    setCreating(false);
    if (created) await add(created.id);
  }

  async function add(listId: string) {
    setError(null);
    const res = await onAdd(listId);
    if (!res.ok) setError(res.message);
  }

  return (
    <>
      <div className="scrim" style={{ background: "transparent", zIndex: 90 }} onClick={onClose} />
      <div
        role="menu"
        style={{
          position: "fixed", left, top, zIndex: 91, width: W,
          background: "var(--surface-1)", border: "1px solid var(--border)",
          borderRadius: "var(--r-sm)", boxShadow: "0 16px 40px rgba(0,0,0,.5)", padding: 8,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", padding: "4px 8px 6px" }}>
          Add <b style={{ color: "var(--text-hi)", fontFamily: "var(--f-mono)" }}>{S}</b> to…
        </div>

        <div style={{ maxHeight: 220, overflowY: "auto" }}>
          {watchlists.length === 0 ? (
            <div style={{ fontSize: ".78rem", color: "var(--text-dim-solid)", padding: "6px 8px" }}>No watchlists yet.</div>
          ) : watchlists.map(w => {
            const inList = w.tickers.includes(S);
            // A full list can't take this symbol, but can still have it removed.
            const full = !inList && tickerLimit != null && w.tickers.length >= tickerLimit;
            return (
              <label
                key={w.id}
                title={full ? watchlistFullMessage(tickerLimit ?? 0) : undefined}
                style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 8px", cursor: full ? "not-allowed" : "pointer", borderRadius: 6, opacity: full ? 0.55 : 1 }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "var(--surface-2)")}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "")}
              >
                <input type="checkbox" checked={inList} disabled={full} onChange={() => { setError(null); if (inList) onRemove(w.id); else void add(w.id); }} />
                <span style={{ flex: 1, fontSize: ".82rem", color: "var(--text-hi)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{w.name}</span>
                <span style={{ fontSize: ".68rem", color: full ? "var(--warn)" : "var(--text-dim-solid)", fontFamily: "var(--f-mono)" }}>
                  {tickerLimit != null ? `${w.tickers.length}/${tickerLimit}` : w.tickers.length}
                </span>
              </label>
            );
          })}
        </div>

        {error && (
          <div role="alert" style={{ margin: "6px 4px 2px", padding: "7px 9px", borderRadius: 6, background: "var(--down-dim)", color: "var(--down)", fontSize: ".74rem", lineHeight: 1.4 }}>
            {error}
          </div>
        )}

        <div style={{ borderTop: "1px solid var(--border)", marginTop: 6, paddingTop: 8 }}>
          {creating ? (
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") void create(); if (e.key === "Escape") { setCreating(false); setNewName(""); } }}
              onBlur={() => { if (!newName.trim()) setCreating(false); }}
              placeholder="New list name — Enter"
              style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 8px", fontSize: ".8rem", color: "var(--text-hi)", outline: "none" }}
            />
          ) : (
            <button
              onClick={() => setCreating(true)}
              style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", color: "var(--brand-2)", fontSize: ".8rem", fontWeight: 600, padding: "5px 8px" }}
            >
              ＋ New watchlist
            </button>
          )}
        </div>
      </div>
    </>
  );
}
