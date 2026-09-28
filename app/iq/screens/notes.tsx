"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiDelete, apiGet } from "../backend";
import { useAppSelector } from "../../store/hooks";
import { useLiveQuotes } from "../live-quotes-context";
import { useIQActions } from "../shell";
import { ChartCard, StockListCard } from "../stock-panel";
import { DataState } from "../utils";

/* One chart note as returned by GET /api/stock-notes/all. */
interface NoteRow {
  id: string;
  sym: string;
  name: string;
  comment: string;
  createdAt: string;
}

interface NotesPage {
  items: NoteRow[];
  nextCursor: string | null;
}

interface Note extends Omit<NoteRow, "createdAt"> {
  createdAt: Date;
}

interface TickerGroup {
  sym: string;
  name: string;
  notes: Note[]; // newest first
  latest: Date;
}

const PAGE_LIMIT = 100;
// Pages fetched automatically on load (PAGE_LIMIT × this = notes). Enough for
// any realistic note history in one go; beyond it the user pages on demand
// rather than the screen silently firing an unbounded request loop.
const AUTO_PAGES = 10;

function notesPath(cursor: string | null): string {
  const qs = new URLSearchParams({ limit: String(PAGE_LIMIT) });
  if (cursor) qs.set("cursor", cursor);
  return `/api/stock-notes/all?${qs.toString()}`;
}

function toNote(r: NoteRow): Note {
  return { ...r, createdAt: new Date(r.createdAt) };
}

/**
 * Every chart note the signed-in user has written, across all tickers, via the
 * cursor-paginated /api/stock-notes/all endpoint (newest first).
 */
function useAllNotes() {
  const [notes, setNotes]           = useState<Note[]>([]);
  const [cursor, setCursor]         = useState<string | null>(null);
  // Starts true: the mount effect kicks off the first load immediately.
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  // Bumped on every (re)load so a superseded in-flight page loop (e.g. the
  // StrictMode double-mount, or Retry mid-load) can't write over a newer one.
  const genRef = useRef(0);

  // Callers flip `loading`/`error` before invoking; this only commits results,
  // and never sets state before its first await.
  const fetchPages = useCallback(async (start: string | null, maxPages: number, replace: boolean) => {
    const gen = ++genRef.current;
    const acc: Note[] = [];
    let next = start;
    const commit = () => {
      setNotes(prev => {
        if (replace) return acc;
        const seen = new Set(prev.map(n => n.id));
        return [...prev, ...acc.filter(n => !seen.has(n.id))];
      });
      setCursor(next);
    };
    try {
      for (let i = 0; i < maxPages; i++) {
        const page = await apiGet<NotesPage>(notesPath(next));
        if (gen !== genRef.current) return;
        acc.push(...(page.items ?? []).map(toNote));
        next = page.nextCursor ?? null;
        if (!next) break;
      }
      commit();
    } catch (e) {
      if (gen !== genRef.current) return;
      // Keep whatever pages did arrive; the user can retry the rest.
      if (acc.length) commit();
      setError(e instanceof Error ? e.message : "Couldn't load your notes.");
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchPages(null, AUTO_PAGES, true); }, [fetchPages]);

  const loadMore = useCallback(() => {
    if (!cursor || loading) return;
    setLoading(true);
    setError(null);
    void fetchPages(cursor, 1, false);
  }, [cursor, loading, fetchPages]);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    void fetchPages(null, AUTO_PAGES, true);
  }, [fetchPages]);

  /** Optimistic delete — the note is restored in place if the API call fails. */
  const remove = useCallback(async (id: string) => {
    let removed: { note: Note; index: number } | null = null;
    setNotes(prev => {
      const index = prev.findIndex(n => n.id === id);
      if (index < 0) return prev;
      removed = { note: prev[index], index };
      return prev.filter(n => n.id !== id);
    });
    try {
      await apiDelete(`/api/stock-notes/${encodeURIComponent(id)}`);
      return true;
    } catch {
      const r = removed as { note: Note; index: number } | null;
      if (r) {
        setNotes(prev => {
          if (prev.some(n => n.id === r.note.id)) return prev;
          const copy = [...prev];
          copy.splice(Math.min(r.index, copy.length), 0, r.note);
          return copy;
        });
      }
      return false;
    }
  }, []);

  return { notes, loading, error, hasMore: cursor != null, loadMore, reload, remove };
}

function fmtWhen(d: Date): string {
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

function fmtShortDate(d: Date): string {
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-US", sameYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "2-digit" });
}

export function NotesScreen() {
  const uid = useAppSelector(s => s.auth.user?.uid ?? null);
  if (!uid) {
    return (
      <div style={{ padding: 18 }}>
        <DataState label="Sign in to see your chart notes." />
      </div>
    );
  }
  // Keyed by uid so switching accounts starts from a clean slate.
  return <NotesBody key={uid} />;
}

function NotesBody() {
  const { openStockFull } = useIQActions();
  const { notes, loading, error, hasMore, loadMore, reload, remove } = useAllNotes();

  const [query, setQuery]   = useState("");
  const [sort, setSort]     = useState<"recent" | "az">("recent");
  const [sel, setSel]       = useState<string | null>(null);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  // Filter by ticker, company name or note text, then group by ticker.
  const groups = useMemo<TickerGroup[]>(() => {
    const q = query.trim().toLowerCase();
    const bySym = new Map<string, TickerGroup>();
    for (const n of notes) {
      if (q && !n.sym.toLowerCase().includes(q) && !n.name.toLowerCase().includes(q) && !n.comment.toLowerCase().includes(q)) continue;
      const g = bySym.get(n.sym);
      if (g) {
        g.notes.push(n);
        if (n.createdAt > g.latest) g.latest = n.createdAt;
      } else {
        bySym.set(n.sym, { sym: n.sym, name: n.name || n.sym, notes: [n], latest: n.createdAt });
      }
    }
    const list = [...bySym.values()];
    for (const g of list) g.notes.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    list.sort(sort === "az"
      ? (a, b) => a.sym.localeCompare(b.sym)
      : (a, b) => b.latest.getTime() - a.latest.getTime());
    return list;
  }, [notes, query, sort]);

  // Fall back to the first visible ticker when the picked one is filtered out
  // or its last note is deleted.
  const selGroup = groups.find(g => g.sym === sel) ?? groups[0] ?? null;
  const selSym = selGroup?.sym ?? null;
  const quoteTickers = useMemo(() => (selSym ? [selSym] : []), [selSym]);
  const quotes = useLiveQuotes(quoteTickers);
  const selPx = selSym ? quotes.get(selSym)?.price ?? 0 : 0;

  const tickerCount = useMemo(() => new Set(notes.map(n => n.sym)).size, [notes]);

  async function handleDelete(id: string) {
    setDeleteErr(null);
    const ok = await remove(id);
    if (!ok) setDeleteErr("Couldn't delete that note. Please try again.");
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Chart Notes</h1>
          <div className="page-sub">
            {notes.length} note{notes.length === 1 ? "" : "s"} across {tickerCount} ticker{tickerCount === 1 ? "" : "s"}
            {hasMore && " · more available"}
          </div>
        </div>
        <div className="actions" style={{ flexWrap: "wrap" }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search ticker or note…"
            aria-label="Search notes"
            style={{
              background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)",
              padding: "6px 10px", fontSize: ".82rem", color: "var(--text-hi)", outline: "none", width: 220,
            }}
          />
          <select
            value={sort}
            onChange={e => setSort(e.target.value as "recent" | "az")}
            aria-label="Sort tickers"
            style={{
              background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)",
              padding: "6px 10px", fontSize: ".82rem", color: "var(--text-hi)", outline: "none", cursor: "pointer",
            }}
          >
            <option value="recent">Most recent</option>
            <option value="az">Ticker A–Z</option>
          </select>
        </div>
      </div>

      <div style={{ padding: "0 18px 18px" }}>
        {error && (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-b" style={{ display: "flex", alignItems: "center", gap: 10, fontSize: ".82rem", color: "var(--down)" }}>
              <span style={{ flex: 1 }}>Couldn&apos;t load all of your notes.</span>
              <button className="btn" onClick={reload} disabled={loading}>Retry</button>
            </div>
          </div>
        )}

        <div className="sp-row" style={{ display: "flex", gap: 14, alignItems: "stretch", marginBottom: 14 }}>
          <StockListCard
            title="Tickers"
            headerRight={<span style={{ fontSize: ".72rem", color: "var(--text-dim-solid)" }}>{groups.length}</span>}
            isEmpty={groups.length === 0}
            loading={loading && notes.length === 0}
            emptyMessage={query ? "No notes match your search." : "No notes yet. Right-click any stock chart to add one."}
            maxListHeight={420}
            showVendor={false}
          >
            {groups.map(g => (
              <div
                key={g.sym}
                className={`pf-li${selSym === g.sym ? " active" : ""}`}
                style={{ gridTemplateColumns: "1fr auto" }}
                onClick={() => setSel(g.sym)}
                onDoubleClick={() => openStockFull(g.sym)}
                title="Click to preview · double-click to open the stock page"
              >
                <div>
                  <span className="s">{g.sym}</span>
                  <span className="n">{g.name}</span>
                </div>
                <div>
                  <span className="px">{g.notes.length} note{g.notes.length === 1 ? "" : "s"}</span>
                  <span className="ch">{fmtShortDate(g.latest)}</span>
                </div>
              </div>
            ))}
            {hasMore && (
              <div style={{ padding: "8px 10px" }}>
                <button className="btn" style={{ width: "100%" }} onClick={loadMore} disabled={loading}>
                  {loading ? "Loading…" : "Load older notes"}
                </button>
              </div>
            )}
          </StockListCard>
          <ChartCard sym={selSym ?? ""} px={selPx} emptyText="Select a ticker to see its chart" />
        </div>

        <div className="card">
          {selGroup ? (
            <div className="cn-wrap" style={{ borderTop: "none" }}>
              <div className="cn-h">
                {selGroup.sym} · {selGroup.name}
                <span className="cn-hint">{selGroup.notes.length} note{selGroup.notes.length === 1 ? "" : "s"}</span>
                <button className="btn primary" style={{ marginLeft: "auto", fontSize: ".74rem", padding: "5px 10px" }}
                  onClick={() => openStockFull(selGroup.sym)}>
                  Open stock page →
                </button>
              </div>
              {deleteErr && <div className="cn-empty" style={{ color: "var(--down)" }}>{deleteErr}</div>}
              {selGroup.notes.map(n => (
                <div key={n.id} className="cn-row">
                  <div className="cn-dot" />
                  <div className="cn-tx">
                    {n.comment}
                    <span className="cn-ts">{" · "}{fmtWhen(n.createdAt)}</span>
                  </div>
                  <button className="icon-x" title="Delete note" aria-label="Delete note" onClick={() => void handleDelete(n.id)}>✕</button>
                </div>
              ))}
            </div>
          ) : (
            <div className="card-b" style={{ padding: 40, textAlign: "center", color: "var(--text-dim-solid)" }}>
              {loading ? "Loading…" : "Select a ticker to see its notes."}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
