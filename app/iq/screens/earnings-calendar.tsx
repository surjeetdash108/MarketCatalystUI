"use client";

import { useMemo, useState } from "react";
import { useCollection } from "../hooks/useCollection";
import { StockLogo } from "../utils";

/**
 * EarningSpike-style earnings calendar: a date-anchored Day/Week view replacing
 * the eight fixed range tabs (Last Month … Month), which could only ever land on
 * eight preset windows and had no way to reach an arbitrary date.
 *
 * WHAT IS AND IS NOT RENDERED
 * The reference design carries several columns our data cannot fill. Rather
 * than render an empty column or invent a value, they are omitted entirely:
 *
 *   Before Open / After Close  — the FMP `earnings-calendar` response has no
 *     session field at all (verified against the live endpoint: it returns
 *     symbol, date, epsActual, epsEstimated, revenueActual, revenueEstimated,
 *     lastUpdated). Nothing in the pipeline drops it; the vendor never sends it.
 *   Typical move / Guidance    — no synced source. Options-implied move would
 *     need an options feed; guidance needs a transcript or Benzinga-class feed.
 *   Reaction                   — computable from ohlcv_bars (close on the day
 *     after the print vs. the prior close) but not wired here; it needs a bar
 *     lookup per row, so it belongs in a backend-computed field.
 *
 * Everything below is read from live Firestore. There is no mock fallback: an
 * empty day renders as an empty day, because a calendar that invents companies
 * is worse than one that shows none.
 */

export interface LiveEarningsDoc {
  id: string;
  ticker: string;
  date: string;
  epsEstimate: number | null;
  epsActual: number | null;
  revenueEstimate: number | null;
  revenueActual: number | null;
}

interface CompanyDoc {
  id: string;
  ticker?: string;
  name?: string | null;
  marketCap?: number | null;
  /**
   * Recent-article count, denormalised onto the company doc by news.job via a
   * server-side count() aggregation.
   *
   * This screen used to subscribe to the whole `news` collection and count
   * client-side — ~4,150 documents and ~3.2 MB shipped to every browser on
   * every load, 76% of the page's payload, to render one integer per row.
   * `companies` is already fetched here, so the badge now costs nothing extra
   * and the news listener is gone entirely.
   */
  newsCount?: number | null;
}

// ── Date helpers ─────────────────────────────────────────────────────────────
// All arithmetic is UTC-based on 'YYYY-MM-DD' strings. Local-time Date math
// shifts the day boundary for anyone west of UTC, which would silently move
// rows between calendar days.

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return toISO(d);
}

/** Monday of the week containing `iso`. Sunday counts as the *preceding* week. */
function mondayOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const shift = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  return addDays(iso, -shift);
}

/** Mon–Fri of the week containing `iso`. Weekends are dropped: US issuers do
 *  not report on them, and empty Sat/Sun columns waste a fifth of the width. */
function weekDays(iso: string): string[] {
  const mon = mondayOf(iso);
  return [0, 1, 2, 3, 4].map(i => addDays(mon, i));
}

function parts(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return { dow: d.getUTCDay(), day: d.getUTCDate(), mon: d.getUTCMonth(), yr: d.getUTCFullYear() };
}

function fmtDayLabel(iso: string): string {
  const p = parts(iso);
  return `${DOW[p.dow]}, ${MON[p.mon]} ${p.day}, ${p.yr}`;
}

function fmtWeekLabel(days: string[]): string {
  const a = parts(days[0]), b = parts(days[days.length - 1]);
  return a.mon === b.mon
    ? `${MON[a.mon]} ${a.day} - ${b.day}, ${b.yr}`
    : `${MON[a.mon]} ${a.day} - ${MON[b.mon]} ${b.day}, ${b.yr}`;
}

// ── Number formatting ────────────────────────────────────────────────────────

function fmtCap(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  if (a >= 1e12) return `${(v / 1e12).toFixed(1)}T`;
  if (a >= 1e9) return `${(v / 1e9).toFixed(a >= 1e10 ? 0 : 1)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(0)}M`;
  return `${v.toFixed(0)}`;
}

function fmtEps(v: number | null | undefined): string {
  return v == null || !Number.isFinite(v) ? "—" : v.toFixed(2);
}

function fmtPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const r = Math.round(v);
  return `${r > 0 ? "+" : ""}${r}%`;
}

/**
 * Percentage surprise. Guarded on a near-zero estimate: an $0.00 consensus is
 * common for pre-profit names, and dividing by it yields ±Infinity, which
 * renders as a nonsense "+Infinity%" beat.
 */
function surprise(est: number | null | undefined, act: number | null | undefined): number | null {
  if (est == null || act == null) return null;
  if (Math.abs(est) < 0.005) return null;
  return ((act - est) / Math.abs(est)) * 100;
}

// ── Row assembly ─────────────────────────────────────────────────────────────

export interface CalRow {
  ticker: string;
  name: string | null;
  date: string;
  marketCap: number | null;
  epsEst: number | null;
  epsAct: number | null;
  epsSurp: number | null;
  epsYoY: number | null;
  salesEst: number | null;
  salesAct: number | null;
  salesSurp: number | null;
  salesYoY: number | null;
  newsCount: number;
}

/**
 * Year-ago comparable for a print. Quarters are not exactly 365 days apart and
 * issuers shift report dates by days-to-weeks, so an exact-date lookup almost
 * never matches — the window is deliberately wide (350–380 days back) and takes
 * the closest hit inside it.
 */
function yearAgo(
  rows: LiveEarningsDoc[],
  ticker: string,
  date: string,
  pick: (d: LiveEarningsDoc) => number | null,
): number | null {
  const target = new Date(`${date}T00:00:00Z`).getTime();
  let best: { v: number; gap: number } | null = null;
  for (const r of rows) {
    if (r.ticker !== ticker || !r.date) continue;
    const gapDays = (target - new Date(`${r.date}T00:00:00Z`).getTime()) / 86400_000;
    if (gapDays < 350 || gapDays > 380) continue;
    const v = pick(r);
    if (v == null) continue;
    const off = Math.abs(gapDays - 365);
    if (!best || off < best.gap) best = { v, gap: off };
  }
  return best?.v ?? null;
}

function growth(now: number | null, prior: number | null): number | null {
  if (now == null || prior == null || Math.abs(prior) < 1e-9) return null;
  return ((now - prior) / Math.abs(prior)) * 100;
}

// ── Filter option sets ───────────────────────────────────────────────────────

const CAPS: [number, string][] = [
  [0, "All"],
  [1e8, "100M+"],
  [1e9, "1B+"],
  [1e10, "10B+"],
  [1e11, "100B+"],
];

type SortKey = "cap" | "symbol" | "surprise";
const SORTS: [SortKey, string][] = [
  ["cap", "Market Cap"],
  ["symbol", "Symbol"],
  ["surprise", "Surprise"],
];

type ViewKey = "eps" | "sales";

/** Dropdown that closes on select — matches the reference's filter chips. */
function Picker<T extends string | number>({
  label, value, options, onPick,
}: {
  label: string;
  value: string;
  options: [T, string][];
  onPick: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ecal-pick">
      <button className={`ecal-chip${open ? " on" : ""}`} onClick={() => setOpen(o => !o)}>
        {label}: <b>{value}</b>
        <span className="ecal-caret" aria-hidden>{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <>
          {/* Click-away layer: a bare onBlur would fire before the option's
              onClick registers, swallowing the selection. */}
          <div className="ecal-away" onClick={() => setOpen(false)} />
          <div className="ecal-menu">
            {options.map(([v, l]) => (
              <button
                key={String(v)}
                className={`ecal-opt${l === value ? " on" : ""}`}
                onClick={() => { onPick(v); setOpen(false); }}
              >
                {l}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function EarningsCalendar({
  selected, onSelect,
}: {
  selected: string;
  onSelect: (ticker: string) => void;
}) {
  const { data: events, loading } = useCollection<LiveEarningsDoc>("earnings_events");
  const { data: companies } = useCollection<CompanyDoc>("companies");

  const [mode, setMode] = useState<"day" | "week">("day");
  // Anchor starts at today and is the single source of truth for both views, so
  // switching Day <-> Week keeps you on the same date instead of resetting.
  const [anchor, setAnchor] = useState<string>(() => toISO(new Date()));
  const [cap, setCap] = useState(0);
  const [sort, setSort] = useState<SortKey>("cap");
  const [view, setView] = useState<ViewKey>("eps");
  const [hasNews, setHasNews] = useState(false);

  const capLabel = CAPS.find(([v]) => v === cap)?.[1] ?? "All";
  const sortLabel = SORTS.find(([k]) => k === sort)?.[1] ?? "Market Cap";
  const viewLabel = view === "eps" ? "EPS" : "Sales";

  const days = useMemo(() => weekDays(anchor), [anchor]);

  const byTicker = useMemo(() => {
    const m = new Map<string, CompanyDoc>();
    for (const c of companies) m.set((c.ticker ?? c.id).toUpperCase(), c);
    return m;
  }, [companies]);

  // Was a client-side tally over the entire `news` collection. The count is now
  // precomputed by news.job and rides along on the company doc this screen
  // already reads, so the tally and the 3.2 MB subscription behind it are gone.
  const newsCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of companies) {
      if (c.newsCount != null) m.set((c.ticker ?? c.id).toUpperCase(), c.newsCount);
    }
    return m;
  }, [companies]);

  const rowsFor = useMemo(() => {
    return (iso: string): CalRow[] => {
      const out = events
        .filter(e => e.date === iso)
        .map<CalRow>(e => {
          const t = e.ticker.toUpperCase();
          const co = byTicker.get(t);
          return {
            ticker: t,
            name: co?.name ?? null,
            date: e.date,
            marketCap: co?.marketCap ?? null,
            epsEst: e.epsEstimate,
            epsAct: e.epsActual,
            epsSurp: surprise(e.epsEstimate, e.epsActual),
            epsYoY: growth(
              e.epsActual ?? e.epsEstimate,
              yearAgo(events, t, iso, d => d.epsActual ?? d.epsEstimate),
            ),
            salesEst: e.revenueEstimate,
            salesAct: e.revenueActual,
            salesSurp: surprise(e.revenueEstimate, e.revenueActual),
            salesYoY: growth(
              e.revenueActual ?? e.revenueEstimate,
              yearAgo(events, t, iso, d => d.revenueActual ?? d.revenueEstimate),
            ),
            newsCount: newsCounts.get(t) ?? 0,
          };
        })
        // A null market cap means the `companies` sync has not reached that
        // ticker yet, not that it is a micro-cap — so it is never filtered out
        // by a cap floor, only sorted last.
        .filter(r => cap === 0 || r.marketCap == null || r.marketCap >= cap)
        .filter(r => !hasNews || r.newsCount > 0);

      out.sort((a, b) => {
        if (sort === "symbol") return a.ticker.localeCompare(b.ticker);
        if (sort === "surprise") {
          const av = view === "eps" ? a.epsSurp : a.salesSurp;
          const bv = view === "eps" ? b.epsSurp : b.salesSurp;
          return (bv ?? -Infinity) - (av ?? -Infinity);
        }
        return (b.marketCap ?? -1) - (a.marketCap ?? -1);
      });
      return out;
    };
  }, [events, byTicker, newsCounts, cap, hasNews, sort, view]);

  const dayRows = useMemo(() => rowsFor(anchor), [rowsFor, anchor]);


  const step = (dir: 1 | -1) => setAnchor(a => addDays(a, mode === "day" ? dir : dir * 7));

  const label = mode === "day" ? fmtDayLabel(anchor) : fmtWeekLabel(days);

  return (
    <div className="ecal">
      {/* ── Date navigator + Day/Week toggle ──────────────────────────────── */}
      <div className="ecal-top">
        <div className="ecal-nav">
          <button className="ecal-arrow" onClick={() => step(-1)} aria-label="Previous">‹</button>
          <div className="ecal-date">{label}</div>
          <button className="ecal-arrow" onClick={() => step(1)} aria-label="Next">›</button>
        </div>
        <div className="ecal-seg">
          <button className={`ecal-segbtn${mode === "week" ? " on" : ""}`} onClick={() => setMode("week")}>Week</button>
          <button className={`ecal-segbtn${mode === "day" ? " on" : ""}`} onClick={() => setMode("day")}>Day</button>
        </div>
      </div>

      {/* ── Filter bar ────────────────────────────────────────────────────── */}
      <div className="ecal-filters">
        <Picker label="Cap" value={capLabel} options={CAPS} onPick={setCap} />
        <Picker label="Sort" value={sortLabel} options={SORTS} onPick={setSort} />
        <Picker
          label="View"
          value={viewLabel}
          options={[["eps", "EPS"], ["sales", "Sales"]] as [ViewKey, string][]}
          onPick={setView}
        />
        <button
          className={`ecal-chip ecal-toggle${hasNews ? " on" : ""}`}
          onClick={() => setHasNews(v => !v)}
        >
          Has news
        </button>
        <button className="ecal-chip ecal-today" onClick={() => setAnchor(toISO(new Date()))}>
          Today
        </button>
      </div>

      {mode === "day" ? (
        <DayTable
          rows={dayRows}
          view={view}
          selected={selected}
          onSelect={onSelect}
          loading={loading}
          date={anchor}
        />
      ) : (
        <WeekGrid
          days={days}
          rowsFor={rowsFor}
          selected={selected}
          onSelect={onSelect}
          onOpenDay={(iso) => { setAnchor(iso); setMode("day"); }}
        />
      )}
    </div>
  );
}

// ── Day view ─────────────────────────────────────────────────────────────────

function DayTable({
  rows, view, selected, onSelect, loading, date,
}: {
  rows: CalRow[];
  view: ViewKey;
  selected: string;
  onSelect: (t: string) => void;
  loading: boolean;
  date: string;
}) {
  const isEps = view === "eps";

  if (loading) {
    return <div className="ecal-empty">Loading earnings…</div>;
  }
  if (rows.length === 0) {
    return (
      <div className="ecal-empty">
        <div className="ecal-empty-h">No companies reporting</div>
        <div>Nothing scheduled for {fmtDayLabel(date)} in the synced calendar.</div>
      </div>
    );
  }

  return (
    <div className="ecal-day">
      <div className="ecal-day-h">
        <span className="ecal-day-t">{fmtDayLabel(date)}</span>
        <span className="ecal-day-n">{rows.length} reporting</span>
      </div>
      <div className="ecal-tablewrap">
        <table className="ecal-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th className="r">Mkt Cap</th>
              <th className="r">{isEps ? "Est EPS" : "Est Sales"}</th>
              <th className="r">{isEps ? "EPS" : "Sales"}</th>
              <th className="r">Surprise</th>
              <th className="r">YoY</th>
              <th className="r">News</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const est = isEps ? r.epsEst : r.salesEst;
              const act = isEps ? r.epsAct : r.salesAct;
              const surp = isEps ? r.epsSurp : r.salesSurp;
              const yoy = isEps ? r.epsYoY : r.salesYoY;
              const f = isEps ? fmtEps : fmtCap;
              return (
                <tr
                  key={r.ticker}
                  className={selected === r.ticker ? "on" : ""}
                  onClick={() => onSelect(r.ticker)}
                >
                  <td>
                    <div className="ecal-symcell">
                      <StockLogo sym={r.ticker} size={22} />
                      <div>
                        <div className="ecal-sym">{r.ticker}</div>
                        {r.name && <div className="ecal-name">{r.name}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="r ecal-num">{fmtCap(r.marketCap)}</td>
                  <td className="r ecal-num">{f(est)}</td>
                  <td className="r ecal-num">{f(act)}</td>
                  <td className={`r ecal-num ${surp == null ? "" : surp >= 0 ? "up" : "dn"}`}>{fmtPct(surp)}</td>
                  <td className={`r ecal-num ${yoy == null ? "" : yoy >= 0 ? "up" : "dn"}`}>{fmtPct(yoy)}</td>
                  <td className="r">
                    {r.newsCount > 0 ? <span className="ecal-newsdot">{r.newsCount}</span> : <span className="ecal-num">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Week view ────────────────────────────────────────────────────────────────

function WeekGrid({
  days, rowsFor, selected, onSelect, onOpenDay,
}: {
  days: string[];
  rowsFor: (iso: string) => CalRow[];
  selected: string;
  onSelect: (t: string) => void;
  onOpenDay: (iso: string) => void;
}) {
  const today = toISO(new Date());
  return (
    <div className="ecal-week">
      {days.map(iso => {
        const rows = rowsFor(iso);
        const p = parts(iso);
        return (
          <div key={iso} className={`ecal-col${iso === today ? " today" : ""}`}>
            <div className="ecal-colh">
              {iso === today && <span className="ecal-dot" aria-hidden />}
              <span className="ecal-colday">{p.day}</span>
              <span className="ecal-coldow">{DOW[p.dow].toUpperCase()}</span>
              <span className="ecal-coln">({rows.length})</span>
              <button className="ecal-expand" onClick={() => onOpenDay(iso)} aria-label={`Open ${fmtDayLabel(iso)}`}>⤢</button>
            </div>


            <div className="ecal-collist">
              {rows.length === 0 && <div className="ecal-colnone">—</div>}
              {rows.map(r => {
                const surp = r.epsSurp;
                return (
                  <button
                    key={r.ticker}
                    className={`ecal-cell${selected === r.ticker ? " on" : ""}`}
                    onClick={() => onSelect(r.ticker)}
                  >
                    <div className="ecal-cell-top">
                      <StockLogo sym={r.ticker} size={18} />
                      <span className="ecal-cell-sym">{r.ticker}</span>
                      {r.newsCount > 0 && <span className="ecal-newsdot sm">{r.newsCount}</span>}
                      <span className="ecal-cell-cap">{fmtCap(r.marketCap)}</span>
                    </div>
                    <div className="ecal-cell-sub">
                      {r.epsAct != null ? (
                        <>
                          <span className={surp == null ? "" : surp >= 0 ? "up" : "dn"}>
                            {surp == null ? "" : surp >= 0 ? "Beat " : "Miss "}{fmtPct(surp)}
                          </span>
                          <span className="ecal-cell-eps">EPS {fmtEps(r.epsAct)}</span>
                        </>
                      ) : (
                        <span className="ecal-cell-eps">Est {fmtEps(r.epsEst)}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
