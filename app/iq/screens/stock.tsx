"use client";

import { StockCatalystSummary } from "../mover-news-modal";
import { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from "react";
import { fmtDate, etTodayIso } from "../calendar-range";
import { useIQActions, ExpandBtn } from "../shell";
import { useWatchlistsContext } from "../hooks/useWatchlists";
import { WatchlistPicker } from "../watchlist-picker";
import { fmt, cls, arr, sign, intervalLabel, TrGauge, RATING_VAL, EarnQ, EarningsGrowthChart, CHART_SCALE, DataState, NotAvailable, StockLogo, VendorTag, type VendorKey, titleCaseLabel, type ChartEarnings, type BarInterval, formatUsDate } from "../utils";
import { buildChartEarnings } from "../chart-earnings";
import { StockChart } from "../stock-panel";
import { exchangeLabel } from "../exchange";
import { firebaseAuth } from "../../firebase";
import { apiPost, apiGet } from "../backend";
import { useApiResource } from "../hooks/useApiResource";
import { useApiList } from "../hooks/useApiList";
import { useBackendBars, useIntervalBars } from "../hooks/useBackendBars";
import { useLiveTick } from "../hooks/useLiveTick";
import { useBackendMarketStatus } from "../hooks/useBackendMarketStatus";
import { latestSessionDate } from "../market-status";
import { etSessionDate } from "../indicators";
import { useLiveQuotes, extendedSession } from "../live-quotes-context";
import { EarningsPlaybook, EarningsPlaybookCards, playbookReports } from "./EarningsPlaybook";
import { useHeadlineQuote, QuoteHeadline } from "../quote-headline";
// import { useLiveQuotes } from "../live-quotes-context";
// import { EarningsPlaybook } from "./EarningsPlaybook";
import { EtfHoldingsView } from "../etf-holdings-view";
import { Stock13FFilingsView } from "../stock-13f-view";
import { StockAnalystActionsView } from "../stock-analyst-actions-view";
import { StockEarningsEpsSales } from "../stock-earnings-eps-sales";
import { useSI } from "../si/si-context";
import { resolveDividends } from "../dividend.util";

const POPULAR_16_ETFS = new Set([
  "CIBR", "DIA", "GLD", "HACK", "HYG", "IBIT", "IWM", "QQEW",
  "QQQ", "SMH", "SOXX", "SPY", "TLT", "XLE", "XLF", "XLK"
]);

import type {
  CompanyDoc, CompanySummary, AnalystConsensusDoc, InsiderTxDoc, OwnershipDoc,
  DividendHistoryDoc, SplitsDoc, FinancialsDoc, QuarterFinancials, AnnualFinancials, EpsHistoryRow, NewsArticleDoc, LiveEarningsDoc, SectorApiDoc, AiAnalysisDoc,
} from "../types";
import { reportedQuarterEps, quarterEpsSurprisePct, reportedAnnualEps, TX_CODE_LABEL, gaapQuarterEps, quarterLabel, ADJUSTED_SURPRISE_LABEL } from "../types";
import { pctChangeStr, epsSalesSeries, annualEpsSalesRows, quarterlyEpsSalesRows, forwardAnnualEstimates, type EpsSalesPt } from "../eps-sales-data";
import { surprisePct, formatEpsSurprise } from "../types";
import { computeTechnicalRating, labelOf, scoreOf, tally, type RatingRow, type Tally, type Vote } from "../technical-rating";
import { range52, fiftyTwoWeekBars } from "../range52";

const labelOfTally = (t: Tally) => labelOf(scoreOf(t));

// Maps the numeric 1-99 tech rating onto the same string categories the
// Screener/TrGauge use (Strong Buy / Buy / Neutral / Sell / Strong Sell).
/** Short pill text per Form 4 transaction code — only P/S are open-market buys/sells. */
const INSIDER_TAG: Record<string, string> = {
  P: "BUY", S: "SELL", A: "AWARD", F: "TAX", G: "GIFT", M: "EXERCISE", X: "EXERCISE", C: "CONVERT", D: "TO ISSUER", W: "WILL",
};

/** Insider transactions shown per page (table and "View all" drawer). */
const INSIDER_PAGE_SIZE = 20;

/** "1–20 of 303 · ← Prev · Page 1 / 16 · Next →" — same look as ETF Corner's pager. */
function Pager({ page, total, pageSize, onPage }: {
  page: number; total: number; pageSize: number; onPage: (page: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const atStart = page === 0;
  const atEnd = page >= pageCount - 1;
  const btn = (disabled: boolean) => ({
    padding: "4px 10px", fontSize: ".74rem", lineHeight: 1,
    opacity: disabled ? 0.35 : 1, cursor: disabled ? "default" : "pointer",
  });
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 12px", borderTop: "1px solid var(--border-soft)", flexWrap: "wrap" }}>
      <span style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", fontFamily: "var(--f-mono)" }}>
        {page * pageSize + 1}–{Math.min(total, (page + 1) * pageSize)} of {total}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button type="button" className="btn" disabled={atStart} onClick={() => onPage(page - 1)} style={btn(atStart)}>← Prev</button>
        <span style={{ fontSize: ".74rem", color: "var(--text-dim-solid)", minWidth: 84, textAlign: "center" }}>Page {page + 1} / {pageCount}</span>
        <button type="button" className="btn" disabled={atEnd} onClick={() => onPage(page + 1)} style={btn(atEnd)}>Next →</button>
      </div>
    </div>
  );
}

/** 1161560 → "1.16M" — share counts in the ownership panels. */
const compactNum = (n: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(n);

function ratingLabel(n: number | null): string {
  if (n == null) return "Neutral";
  if (n >= 90) return "Strong Buy";
  if (n >= 70) return "Buy";
  if (n >= 40) return "Neutral";
  if (n >= 20) return "Sell";
  return "Strong Sell";
}

// Real SMA/EMA computed from a year of actual daily closes (already fetched
// for the 52-week range) — replaces the old "typical %-below-price" guesses.
function sma(bars: { c: number }[], n: number): number | null {
  if (bars.length < n) return null;
  return bars.slice(-n).reduce((s, b) => s + b.c, 0) / n;
}
// Classic (floor-trader) pivot support/resistance from a prior period's H/L/C.
// Computed client-side from the OHLC bars the chart already loads, so every
// opened ticker shows levels regardless of the backend technicals sweep.
type Pivots = { pivot: number; r1: number; r2: number; r3: number; s1: number; s2: number; s3: number };
/** Polygon's SIC industry strings are ALL-CAPS ("PERFUMES, COSMETICS…"); title-
 *  case them for display. FMP industries are already clean mixed-case, so a
 *  string that isn't all-uppercase passes through unchanged. */
function pivotsFrom(h: number, l: number, c: number): Pivots {
  const p = (h + l + c) / 3, range = h - l;
  return { pivot: p, r1: 2 * p - l, s1: 2 * p - h, r2: p + range, s2: p - range, r3: h + 2 * (p - l), s3: l - 2 * (h - p) };
}
// H/L/C of the last COMPLETE week (excludes the current, partial week).
function priorWeekHLC(bars: { t: number; h: number; l: number; c: number }[], now: Date = new Date()): { h: number; l: number; c: number } | null {
  const weeks = new Map<string, { h: number; l: number; c: number; t: number }>();
  for (const b of bars) {
    const d = new Date(b.t);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); // back to Monday
    const key = d.toISOString().slice(0, 10);
    const cur = weeks.get(key);
    if (!cur) weeks.set(key, { h: b.h, l: b.l, c: b.c, t: b.t });
    else { cur.h = Math.max(cur.h, b.h); cur.l = Math.min(cur.l, b.l); if (b.t >= cur.t) { cur.c = b.c; cur.t = b.t; } }
  }
  const keys = [...weeks.keys()].sort();
  // The newest week is skipped only while it is still trading — today (ET) is
  // in it and its Friday close has not passed. Same rule as the backend's
  // keyLevels.weekly (technical-indicators.job).
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false,
  }).formatToParts(now);
  const g = (type: string) => parts.find(p => p.type === type)?.value ?? "";
  const today = new Date(`${g("year")}-${g("month")}-${g("day")}T00:00:00Z`);
  const dow = today.getUTCDay();
  const weekDone = dow === 6 || dow === 0 || (dow === 5 && (Number(g("hour")) % 24) >= 16);
  today.setUTCDate(today.getUTCDate() - ((dow + 6) % 7)); // back to Monday
  const thisWeek = today.toISOString().slice(0, 10);
  const newest = keys[keys.length - 1];
  const newestComplete = newest != null && (newest < thisWeek || (newest === thisWeek && weekDone));
  const basis = newestComplete ? newest : keys[keys.length - 2];
  const w = basis != null ? weeks.get(basis) : undefined;
  return w ? { h: w.h, l: w.l, c: w.c } : null;
}
// Drop a still-forming current-day bar from a daily series so client-side pivot
// fallbacks use the last FULLY-COMPLETED session — mirrors the backend keyLevels
// basis (technical-indicators.job `marketTimeEt`). A bar dated for today's ET
// session is complete only once 16:00 ET (the regular-session close) has passed;
// before that it is a partial intraday aggregate. Tradeoff: early-close half-days
// read as open until 16:00 ET — conservative (falls back to the prior completed
// session, never a partial bar).
function completedSessions<T extends { t: number }>(bars: T[]): T[] {
  if (!bars.length) return bars;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const g = (type: string) => parts.find(p => p.type === type)?.value ?? "";
  const etDate = `${g("year")}-${g("month")}-${g("day")}`;
  const regularSessionClosed = (Number(g("hour")) % 24) >= 16; // 16:00 ET close
  const last = bars[bars.length - 1];
  const lastDate = new Date(last.t).toISOString().slice(0, 10);
  const lastIsCurrentOpenSession = lastDate === etDate && !regularSessionClosed;
  return lastIsCurrentOpenSession ? bars.slice(0, -1) : bars;
}
function lastCompletedSessionBar<T extends { t: number }>(bars: T[]): T | null {
  const done = completedSessions(bars);
  return done.length ? done[done.length - 1] : null;
}
const barDate = (b: { t: number }) => etSessionDate(b.t);
function ema(bars: { c: number }[], n: number): number | null {
  if (bars.length < n) return null;
  const k = 2 / (n + 1);
  let e = bars.slice(0, n).reduce((s, b) => s + b.c, 0) / n;
  for (let i = n; i < bars.length; i++) e = bars[i].c * k + e * (1 - k);
  return e;
}

async function saveNote(sym: string, name: string, comment: string): Promise<string | null> {
  if (!firebaseAuth.currentUser || !comment.trim()) return null;
  try {
    const row = await apiPost<{ id: string }>("/api/stock-notes", { sym, name, comment: comment.trim() });
    return row.id;
  } catch { return null; }
}

const LOGO_BG: Record<string, [string, string]> = {
  AAPL: ["#155F58", "#FFE8CC"], NVDA: ["#1F7A46", "#C8F5E0"], MSFT: ["#155F58", "#FFE8CC"],
  GOOGL: ["#8A2E15", "#EE9090"], META: ["#8A5A15", "#FFE8CC"], AMZN: ["#8A5A15", "#FFE8CC"],
  TSLA: ["#8A2E15", "#EE9090"], JPM: ["#155F58", "#FFE8CC"], V: ["#8A5A15", "#FFE8CC"],
  UNH: ["#1F7A46", "#C8F5E0"],
};
const _PAL: [string, string][] = [
  ["#3C6000","#76B900"],["#1B5680","#2E8FD6"],["#8A5A15","#F0A33C"],["#1E4FA8","#4285F4"],
  ["#003C9E","#0866FF"],["#8A2E15","#F0663C"],["#7A5F10","#C9A227"],["#8A3E15","#F07B3C"],
  ["#155F58","#2FB6A8"],["#2A5B3D","#4ADE80"],
];
function hashPal(s: string): [string, string] {
  let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return _PAL[h % _PAL.length];
}
const logoBg = (s: string) => (LOGO_BG[s] ?? hashPal(s))[0];
const logoFg = (s: string) => (LOGO_BG[s] ?? hashPal(s))[1];

/**
 * Vendor name for display. The backend tags a quote's source with the code path
 * that served it — "polygon-ondemand", "fmp-ondemand" (ondemand.service.ts) —
 * which is a backend concern; the reader of the pill only wants to know whose
 * price this is. Strips that suffix and keeps FMP an initialism rather than
 * "Fmp". The stored `source` value itself is untouched.
 */
function vendorLabel(source: string | null | undefined): string {
  const base = (source ?? "fmp").replace(/-ondemand$/i, "").trim();
  if (!base) return "FMP";
  return base.toLowerCase() === "fmp" ? "FMP" : base[0].toUpperCase() + base.slice(1);
}

// Last-resort labels for a few mega-caps, used only while the backend's own
// `exchange` field hasn't loaded (or is missing). Never defaulted for other
// tickers — that used to stamp "NASDAQ" on OTC names like TCEHY / TCGLF.
const EXCHANGE: Record<string, string> = {
  AAPL: "NASDAQ", NVDA: "NASDAQ", MSFT: "NASDAQ", GOOGL: "NASDAQ", META: "NASDAQ",
  AMZN: "NASDAQ", TSLA: "NASDAQ", JPM: "NYSE", V: "NYSE", UNH: "NYSE",
  AVGO: "NASDAQ", CRM: "NYSE", PLTR: "NYSE", INTC: "NASDAQ", WBA: "NASDAQ",
  DELL: "NYSE", ZIM: "NYSE", AMD: "NASDAQ", MU: "NASDAQ", SMCI: "NASDAQ",
};

const ac = (a: string) => a === "Buy" ? "var(--up)" : a === "Sell" ? "var(--down)" : "var(--text-dim-solid)";

const VOTE_WORD: Record<Vote, string> = { buy: "Buy", sell: "Sell", neutral: "Neutral" };

/** Sell / Neutral / Buy vote counts under a rating gauge. */
function RatingTally({ t }: { t: Tally }) {
  return (
    <div className="counts">
      <span style={{ color: "var(--down)" }}>Sell<b>{t.sell}</b></span>
      <span style={{ color: "var(--text-dim-solid)" }}>Neutral<b>{t.neutral}</b></span>
      <span style={{ color: "var(--up)" }}>Buy<b>{t.buy}</b></span>
    </div>
  );
}

/** One block of the rating drawer: its own verdict, then a row per indicator vote. */
function RatingSection({ title, rows }: { title: string; rows: RatingRow[] }) {
  const t = tally(rows), label = labelOfTally(t);
  return (
    <>
      <div className="ai-sec" style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div className="h">{title}</div>
        <span className="mono" style={{ fontSize: ".72rem", fontWeight: 600, color: ac(label.replace("Strong ", "")) }}>{label}</span>
      </div>
      <table className="ind-tbl">
        <tbody>
          {rows.map(r => (
            <tr key={r.name}>
              <td>{r.name}</td>
              <td className="v">{r.value ?? "–"}</td>
              <td className="a" style={{ color: ac(VOTE_WORD[r.vote]) }}>{VOTE_WORD[r.vote]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/**
 * Colour for an ANALYST consensus label.
 *
 * This exists because the consensus label used to be painted with `tone`, which
 * is the TECHNICAL gauge's colour. The two are different readings — technicals
 * are oscillators and moving averages, consensus is analyst votes — and they
 * disagree often and legitimately. Pairing them meant IREN's "Buy" consensus
 * (10 buy / 3 hold / 1 sell) rendered in the Sell red, because its technicals
 * read Sell: the word and its colour said opposite things.
 *
 * Three levels, matching the Sell/Hold/Buy counts rendered directly beneath it.
 * Deliberately NOT ac() above, which grades oscillator verdicts where "Strong"
 * and "Weak" describe signal strength rather than direction.
 */
const consensusTone = (c: string | null | undefined): string => {
  const k = (c ?? "").trim().toLowerCase();
  if (k === "buy" || k === "strong buy" || k === "outperform") return "var(--up)";
  if (k === "sell" || k === "strong sell" || k === "underperform") return "var(--down)";
  return "var(--text-dim-solid)";
};

type IncRow = { c: string; rev: number; cogs: number; gp: number; opex: number; oi: number; ni: number; eps: number };

/**
 * Real quarterly/annual financials (GET /live/financials) mapped onto the
 * IncRow shape the existing charts/table already render, so those components
 * don't need to change — only their input does. Falls back to the synthetic
 * earnIncome() generator when no real doc exists yet for this ticker/period.
 */
function incRowsFromFinancials(
  period: "Q" | "A",
  doc: FinancialsDoc | null,
  fallback: () => IncRow[],
): IncRow[] {
  const rows = doc ? (period === "Q" ? doc.quarters : doc.annual) : [];
  if (rows.length === 0) return fallback();
  return rows.slice(0, 10).map(r => {
    const revenue = r.revenue ?? 0;
    const grossProfit = r.grossProfit ?? 0;
    const operatingIncome = r.operatingIncome ?? 0;
    const netIncome = r.netIncome ?? 0;
    const opex = period === "Q"
      ? (r as QuarterFinancials).operatingExpenses ?? Math.max(0, grossProfit - operatingIncome)
      : Math.max(0, grossProfit - operatingIncome);
    // Quarters are labelled by period end ("Jul-26"), the same as the Sales
    // chart and table beside this one, so the three line up column for column.
    const end = period === "Q" ? (r as QuarterFinancials).endDate : null;
    const label = period === "Q"
      ? end
        ? fmtDate(end, { month: "short", year: "2-digit" }).replace(" ", "-")
        : `${(r as QuarterFinancials).fiscalPeriod ?? "?"} '${(r.fiscalYear ?? "").slice(-2)}`
      : `FY ${r.fiscalYear ?? "?"}`;
    return {
      c: label,
      rev: revenue / 1e9,
      cogs: Math.max(0, revenue - grossProfit) / 1e9,
      gp: grossProfit / 1e9,
      opex: opex / 1e9,
      oi: operatingIncome / 1e9,
      ni: netIncome / 1e9,
      eps: r.epsActual ?? 0,
    };
  });
}








/** One single-series bar chart (EPS or Sales), zero-baselined so a negative
 * period reads correctly, with the value labelled on top of each bar and the
 * period label angled underneath — matching the reference layout. */
function MetricBars({
  title, data, fmt,
}: {
  title: string;
  data: Array<{ label: string; v: number | null }>;
  fmt: (v: number) => string;
}) {
  const gid = "gb-" + title.replace(/\W/g, "");
  const vals = data.map(d => d.v).filter((v): v is number => v != null);
  /**
   * The viewBox width tracks the MEASURED width, so the drawing is never
   * scaled — the same pattern EarnIncChart uses below.
   *
   * With a fixed 340-wide viewBox the whole chart was magnified by whatever
   * width it landed in: side by side in the main column it came out ~1.4x, and
   * stacked full width in a drawer ~2.3x, where 8px type became 18px and the
   * chart stood 500px tall. Sizing to the container instead keeps the bars and
   * type at one physical size everywhere and spreads the bars into the extra
   * room — which is what makes this read as a sibling of the Earnings Growth
   * chart above it rather than a blown-up thumbnail.
   */
  const wrapRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(560);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => { const cw = el.clientWidth; if (cw > 0) setW(cw); };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Height is fixed, matching EarningsGrowthChart's rendered height at the same
  // width (its 560x161.5 viewBox scales to ~0.29 x width ≈ 227px at 788).
  // PADB/label baseline give the -45°-rotated period labels room to extend
  // down-left without clipping at the viewBox bottom (they used to lose their
  // first 1-2 chars, e.g. "Jan-24" → "n-24").
  const H = 222, PADT = 24, PADB = 48, PADX = 6;
  const LABEL_Y = H - 30;
  const iw = W - PADX * 2, ih = H - PADT - PADB;
  const maxV = Math.max(0, ...vals);
  const minV = Math.min(0, ...vals);
  const span = (maxV - minV) || 1;
  const yOf = (v: number) => PADT + ((maxV - v) / span) * ih;
  const zeroY = yOf(0);
  const gw = iw / Math.max(1, data.length);
  const bw = Math.min(gw * 0.6, 26);
  return (
    <div ref={wrapRef}>
      <div style={{ fontSize: ".72rem", fontWeight: 700, color: "var(--text-dim-solid)", marginBottom: 2 }}>{title}</div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand-2)" />
            <stop offset="100%" stopColor="var(--brand)" />
          </linearGradient>
        </defs>
        {data.map((d, i) => {
          if (d.v == null) return null;
          const cx = PADX + gw * i + gw / 2;
          const yv = yOf(d.v);
          const y = Math.min(zeroY, yv);
          const h = Math.max(2, Math.abs(yv - zeroY));
          const above = d.v >= 0;
          return (
            <g key={d.label + i}>
              <rect x={(cx - bw / 2).toFixed(1)} y={y.toFixed(1)}
                width={bw.toFixed(1)} height={h.toFixed(1)} rx="2.5" fill={`url(#${gid})`} />
              <text x={cx.toFixed(1)} y={(above ? y - 4 : y + h + 9).toFixed(1)}
                textAnchor="middle" fontSize="11" fontFamily="JetBrains Mono,monospace"
                fill="var(--text-hi)">{fmt(d.v)}</text>
              <text x={cx.toFixed(1)} y={LABEL_Y.toFixed(1)} textAnchor="end"
                fontSize="9.5" fill="var(--text-dim-solid)"
                transform={`rotate(-45 ${cx.toFixed(1)} ${LABEL_Y.toFixed(1)})`}>{d.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** The reference layout's headline: EPS and Sales($Mil) bars side by side,
 * driven by the same Quarterly/Annual toggle as the rest of the card. */
function EpsSalesBars({ data }: { data: EpsSalesPt[] }) {
  // EPS and Sales in SEPARATE bordered boxes so each is identified on its own
  // (matches the Earnings Hub's split EPS / Sales cards).
  const box = { border: "1px solid var(--border-soft)", borderRadius: 10, background: "var(--surface-2)", padding: "10px 12px" };
  return (
    <div className="eps-sales-grid">
      <div style={box}>
        <MetricBars title="EPS" data={data.map(d => ({ label: d.label, v: d.eps }))}
          fmt={v => v.toFixed(2)} />
      </div>
      <div style={box}>
        <MetricBars title="Sales ($Mil)" data={data.map(d => ({ label: d.label, v: d.sales }))}
          fmt={v => Math.round(v).toLocaleString()} />
      </div>
    </div>
  );
}

type NewsPeriod = "w" | "pw" | "m" | "q" | "y";
const NEWS_PERIODS: Array<[NewsPeriod, string]> = [
  ["w", "This week"], ["pw", "Prev week"], ["m", "This month"], ["q", "This quarter"], ["y", "This year"],
];
/** Whether a story published at `ms` falls in period `p`, relative to `now`. */
function inNewsPeriod(p: NewsPeriod, ms: number, now: Date): boolean {
  const DAY = 86_400_000, age = now.getTime() - ms;
  // Calendar periods on the New York date, not the viewer's.
  const [dy, dm] = etTodayIso(new Date(ms)).split("-").map(Number);
  const [ny, nm] = etTodayIso(now).split("-").map(Number);
  switch (p) {
    case "w": return age < 7 * DAY;
    case "pw": return age >= 7 * DAY && age < 14 * DAY;
    case "m": return dy === ny && dm === nm;
    case "q": return dy === ny && Math.floor((dm - 1) / 3) === Math.floor((nm - 1) / 3);
    case "y": return dy === ny;
  }
}

/** Segmented toggle (Quarterly / Annual, news periods) — the reference's pill row. */
function SegToggle<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: Array<[T, ReactNode]>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="sd-seg" role="group" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  );
}

/** Tracks an element's rendered width so a chart's viewBox can match it 1:1. */
function useMeasuredWidth(initial: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => { const cw = el.clientWidth; if (cw > 0) setW(cw); };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/**
 * Financials "Sales $B": one bar per period, value on top, period angled
 * underneath. A trailing `est` bar is the next period's consensus estimate,
 * drawn grey — present only when the earnings calendar actually has one.
 */
/**
 * A $B figure with precision that scales with its size. Rounding to whole
 * billions printed "0" on every bar for a ~$0.4B-a-quarter company (JJSF) and
 * flattened JNJ's 25.4 to 25.
 */
function fmtBillions(v: number): string {
  const a = Math.abs(v);
  return v.toFixed(a >= 100 ? 0 : a >= 10 ? 1 : a >= 0.1 ? 2 : 3);
}

function SalesBars({ data }: { data: Array<{ label: string; v: number; est?: boolean }> }) {
  const [wrapRef, W] = useMeasuredWidth(560);
  // PADL leaves room for the first angled label, which runs down-left of its bar.
  const H = 250, PADT = 22, PADB = 50, PADL = 22, PADR = 4;
  const ih = H - PADT - PADB;
  const gw = (W - PADL - PADR) / Math.max(1, data.length);
  const bw = Math.min(28, gw * 0.62);
  const max = Math.max(0, ...data.map(d => d.v)) || 1;
  const baseY = PADT + ih;
  return (
    <div ref={wrapRef}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: "block" }}>
        {data.map((d, i) => {
          const cx = PADL + gw * i + gw / 2;
          const h = Math.max(3, (d.v / max) * ih * 0.92);
          const ly = baseY + 14;
          return (
            <g key={d.label + i}>
              <rect x={(cx - bw / 2).toFixed(1)} y={(baseY - h).toFixed(1)} width={bw.toFixed(1)} height={h.toFixed(1)}
                rx="3" style={{ fill: d.est ? "var(--border-strong)" : "var(--brand)" }} />
              <text x={cx.toFixed(1)} y={(baseY - h - 6).toFixed(1)} textAnchor="middle"
                style={{ fill: d.est ? "var(--text-dim-solid)" : "var(--text)", fontSize: "10.5px", fontFamily: "var(--f-mono)" }}>
                {fmtBillions(d.v)}
              </text>
              <text x={cx.toFixed(1)} y={ly.toFixed(1)} textAnchor="end"
                transform={`rotate(-40 ${cx.toFixed(1)} ${ly.toFixed(1)})`}
                style={{ fill: "var(--text-dim-solid)", fontSize: "10.5px", fontFamily: "var(--f-mono)" }}>
                {d.est ? "*" : ""}{d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Series colours for the grouped income chart. Distinct hues on purpose: the
 *  app's --brand / --ai / --up are all the same green, which made revenue,
 *  gross profit and net income indistinguishable. */
const INC_COLORS = { rev: "#4a67d8", gp: "#c084fc", ni: "var(--up)", loss: "var(--down)" } as const;

// EPS estimate-vs-actual bars. No live source exists for post-earnings price
// reaction across history, so (unlike the old mock version) this never draws
// a "stock move" line — only the two numbers the live earnings feed actually has.
function EarnEpsChart({ hist }: { hist: EarnQ[] }) {
  const d = [...hist].reverse();
  const W = 560, H = 210, PADL = 30, PADR = 18, PADT = 14, PADB = 30;
  const iw = W - PADL - PADR, ih = H - PADT - PADB;
  const maxE = Math.max(...d.map(x => Math.max(x.e, Math.abs(x.a)))) * 1.15 || 1;
  const n = d.length, gw = iw / n, bw = gw * 0.28;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, display: "block" }}>
      <line x1={PADL} y1={PADT + ih / 2} x2={W - PADR} y2={PADT + ih / 2}
        stroke="var(--border)" strokeDasharray="3 3" />
      {d.map((x, i) => {
        const cx = PADL + gw * i + gw / 2;
        const eh = Math.max(2, (x.e / maxE) * ih);
        const ah = Math.max(2, (Math.abs(x.a) / maxE) * ih);
        return (
          <g key={x.q}>
            <rect x={(cx - bw - 2).toFixed(1)} y={(PADT + ih - eh).toFixed(1)} width={bw.toFixed(1)} height={eh.toFixed(1)} rx="2" style={{ fill: "var(--text-dim-solid)" }} />
            <rect x={(cx + 2).toFixed(1)} y={(PADT + ih - ah).toFixed(1)} width={bw.toFixed(1)} height={ah.toFixed(1)} rx="2" style={{ fill: x.surp >= 0 ? "var(--up)" : "var(--down)" }} />
            {(i % 2 === 0 || i === n - 1) && (
              <text x={cx.toFixed(1)} y={H - 10} textAnchor="middle" style={{ fill: "var(--text-dim-solid)", fontSize: "0.5625rem" }}>
                {x.q}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function EarnIncChart({ inc }: { inc: IncRow[] }) {
  // The viewBox width tracks the measured container width so the chart fills
  // the card edge to edge at a fixed height, with text at its natural size.
  const [wrapRef, W] = useMeasuredWidth(760);
  const d = [...inc].reverse();
  const H = 250, PADL = 22, PADR = 4, PADT = 14, PADB = 50;
  const ih = H - PADT - PADB, baseY = PADT + ih;
  const max = Math.max(...d.map(x => Math.max(x.rev, Math.abs(x.ni)))) || 1;
  const gw = (W - PADL - PADR) / Math.max(1, d.length);
  const groupW = Math.min(40, gw * 0.7), gap = 2, bw = (groupW - gap * 2) / 3;
  return (
    <div ref={wrapRef} style={{ width: "100%" }}>
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: "block" }}>
      {d.map((x, i) => {
        const cx = PADL + gw * i + gw / 2;
        const x0 = cx - groupW / 2;
        const vals: Array<[number, string]> = [
          [x.rev, INC_COLORS.rev],
          [x.gp, INC_COLORS.gp],
          [x.ni, x.ni < 0 ? INC_COLORS.loss : INC_COLORS.ni],
        ];
        const ly = baseY + 14;
        return (
          <g key={x.c + i}>
            {vals.map(([v, col], si) => {
              const h = Math.max(2, (Math.abs(v) / max) * ih);
              return (
                <rect key={si} x={(x0 + si * (bw + gap)).toFixed(1)} y={(baseY - h).toFixed(1)}
                  width={bw.toFixed(1)} height={h.toFixed(1)} rx="2" style={{ fill: col }} />
              );
            })}
            <text x={cx.toFixed(1)} y={ly.toFixed(1)} textAnchor="end"
              transform={`rotate(-40 ${cx.toFixed(1)} ${ly.toFixed(1)})`}
              style={{ fill: "var(--text-dim-solid)", fontSize: "10.5px", fontFamily: "var(--f-mono)" }}>
              {x.c}
            </text>
          </g>
        );
      })}
    </svg>
    </div>
  );
}

/** Legend for EarnIncChart, shown in the card footer as in the reference. */
function IncLegend() {
  return (
    <span className="sd-keys">
      <span><i className="sd-key" style={{ background: INC_COLORS.rev }} />Revenue</span>
      <span><i className="sd-key" style={{ background: INC_COLORS.gp }} />Gross profit</span>
      <span><i className="sd-key" style={{ background: INC_COLORS.ni }} />Net income</span>
      <span><i className="sd-key" style={{ background: INC_COLORS.loss }} />Net loss</span>
    </span>
  );
}


export type StockTab =
  | "overview"
  | "analysis"
  | "analyst"
  | "peers"
  | "earnings"
  | "financials"
  | "holdings"
  | "13f"
  | "news";

/** How often the AI read is re-checked until (and after) it arrives. */
const AI_RECHECK_MS = 30_000;

export function StockScreen({
  initialSym,
  hideHeader,
  hideIdentity,
  hideChart,
  headerActions,
  visibleTabs,
  initialTab,
  barInterval: barIntervalProp,
}: {
  initialSym?: string;
  hideHeader?: boolean;
  /** Drop only the identity/quote header but keep the full tabbed layout —
   *  for hosts that already show the ticker and price (the panel chart card).
   *  hideHeader, by contrast, switches to the compact stacked layout. */
  hideIdentity?: boolean;
  hideChart?: boolean;
  headerActions?: ReactNode;
  visibleTabs?: StockTab[];
  /** Tab to open on (default Overview) — Earnings Hub opens on Earnings. */
  initialTab?: StockTab;
  /** Candle size owned by a chart OUTSIDE this screen (the list+chart panels,
   *  which pass hideChart). Drives the technical rating so it re-rates when
   *  that chart's interval changes, exactly as it does on the full page. */
  barInterval?: BarInterval;
} = {}) {
  const { openStock, openStockDetail, openSector } = useIQActions();
  const { enterSI } = useSI();
  const [sym, setSym] = useState(() => {
    if (initialSym) return initialSym;
    if (typeof window !== "undefined") return localStorage.getItem("iq-stock") || "NVDA";
    return "NVDA";
  });

  // Sync when the parent passes a new ticker (e.g. user clicks a different mover)
  useEffect(() => {
    if (initialSym && initialSym !== sym) setSym(initialSym);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSym]);

  // Switch immediately when the global search picks a ticker, even if this
  // screen is already mounted (router-cached) and doesn't re-read localStorage.
  useEffect(() => {
    const onChange = (e: Event) => {
      const next = (e as CustomEvent<string>).detail;
      if (next) setSym(next);
    };
    window.addEventListener("iq-stock-change", onChange);
    return () => window.removeEventListener("iq-stock-change", onChange);
  }, []);
  const [search, setSearch] = useState("");
  // Candle size, not a date range — the backend sizes each interval's history.
  const [ownBarInterval, setBarInterval] = useState<BarInterval>("1D");
  const barInterval = barIntervalProp ?? ownBarInterval;
  // Default ON: the earnings dots are the chart's main annotation, and behind a
  // default-off toggle they were invisible unless you knew to look for the
  // button. The toggle still turns them off for a clean price-only chart.


  // Live overlays for the detail panels — analyst consensus, insider
  // transactions, the full company universe (for peer/sector lookups), sector
  // performance, and earnings events all come straight from the market-data
  // endpoints. Nothing here falls back to mock data; a ticker with no live
  // match for a given panel just shows that panel as not available.
  // Scoped to this ticker: the backend fills it from FMP on demand when the
  // nightly sweep has no doc, so a stock outside that universe still gets one.
  const { data: liveConsensus, loading: liveConsensusLoading } = useApiList<AnalystConsensusDoc>(
    `/market-data/analyst-actions?ticker=${encodeURIComponent(sym)}`,
  );
  // Scoped to this ticker server-side: unscoped, the endpoint returns only the
  // latest page across ALL tickers, so most symbols got few or no rows.
  const { data: liveInsider, loading: insiderLoading } = useApiList<InsiderTxDoc>(
    `/market-data/insider-transactions?ticker=${encodeURIComponent(sym)}`,
  );
  const { data: companies, loading: companiesLoading } = useApiList<CompanyDoc>("/market-data/companies");
  const { data: sectorsLive, loading: sectorsLoading } = useApiList<SectorApiDoc>("/market-data/sectors");
  const { data: liveEarningsEvents, loading: earningsLoading } = useApiList<LiveEarningsDoc>("/market-data/earnings");
  const { bars: yearBars, loading: yearBarsLoading } = useBackendBars(sym, "1Y");
  const { bars: realBars, loading: barsLoading } = useIntervalBars(sym, barInterval);
  // Technical rating on the chart's own candles, so it re-rates whenever the
  // candle interval changes. Null until enough candles have loaded, when the
  // backend's daily rating stands in (see `rating` below).
  const techRating = useMemo(() => (realBars ? computeTechnicalRating(realBars) : null), [realBars]);
  // Live (delayed) price stream for the header + chart overlay: SSE push with a
  // /live/quotes poll fallback (Firebase Hosting doesn't proxy the SSE stream).
  const live = useLiveTick(sym);

  // Per-ticker profile + dividend/split/financials history — cache-aside via
  // GET /live/company|/live/dividend-history|/live/splits|/live/financials
  // (replacing the direct companies Firestore listener this screen used to
  // hold open). Re-fetches whenever `sym` changes since it's part of the path.
  const { data: liveCompany, loading: liveCompanyLoading } = useApiResource<CompanyDoc>(`/live/company?ticker=${encodeURIComponent(sym)}`, 30000);
  // Fast key-stats-only read, fired alongside /live/company ONLY for a ticker
  // that isn't going to get a fast answer from /live/company anyway. Merely
  // being IN the `companies` list isn't enough to predict that: the backend's
  // own fast-path (ondemand.service.getCompany) also requires description /
  // instOwnershipPct / epsTtm to already be on the doc — fields the bulk cron
  // sync (companies.job) never writes, only an on-demand build does — plus a
  // 15-minute freshness window measured from the doc's ORIGINAL createdAt
  // (never bumped on later writes), which most long-tracked tickers blow past
  // regardless of how current their price/sector data is. A ticker that's
  // been in the bulk sync for months but never individually opened before
  // (no description/13F/epsTtm yet) is EXACTLY the case this summary exists
  // for — checking mere list-membership skipped it and left the card sitting
  // on N/A same as before this endpoint existed.
  const knownTicker = companies.some(c =>
    c.ticker === sym
    && c.price != null
    && c.description != null
    && c.instOwnershipPct != null
    && c.epsTtm != null,
  );
  const { data: companySummary } = useApiResource<CompanySummary>(
    !companiesLoading && !knownTicker ? `/live/company/summary?ticker=${encodeURIComponent(sym)}` : null,
  );
  // The full doc always wins, even if the summary happens to resolve after
  // it — liveCompany is null until /live/company itself settles, so this
  // naturally ignores a late summary once the real thing has landed. A
  // non-partial summary (the server already had the full doc in memory)
  // reads identically to a full CompanyDoc for every field below.
  // Until either loads (or if /live/company fails), the stock's row in the
  // already-loaded companies list fills Key Stats instead of a wall of N/A.
  const listedCompany = companies.find(c => c.ticker === sym) ?? null;
  const keyStats: CompanyDoc | CompanySummary | null = liveCompany ?? companySummary ?? listedCompany;
  // Which symbol's "no data" popup the user has dismissed (so it doesn't reopen).
  const [dismissedNoData, setDismissedNoData] = useState("");
  const { data: dividendHistory, loading: dividendLoading } = useApiResource<DividendHistoryDoc>(`/live/dividend-history?ticker=${encodeURIComponent(sym)}`);
  const { data: splitsDoc } = useApiResource<SplitsDoc>(`/live/splits?ticker=${encodeURIComponent(sym)}`);
  // Institutional rollup + top 13F holders (FMP) and short interest (Polygon).
  const { data: ownership, loading: ownershipLoading } = useApiResource<OwnershipDoc>(`/live/ownership?ticker=${encodeURIComponent(sym)}`);
  const { data: financialsDoc, loading: financialsLoading } = useApiResource<FinancialsDoc>(`/live/financials?ticker=${encodeURIComponent(sym)}`);
  const { data: tickerNews } = useApiResource<NewsArticleDoc[]>(`/live/news?ticker=${encodeURIComponent(sym)}`, 30000);
  // On-demand AI read (technicals + news synthesised by OpenRouter), cached 30
  // min server-side. Appended below the deterministic rows + news list.
  const { data: aiAnalysis, loading: aiLoading, error: aiError } = useApiResource<AiAnalysisDoc>(
    `/live/ai-analysis?ticker=${encodeURIComponent(sym)}`,
    // Re-check: a slow model outlives the 20s request timeout, but the backend
    // finishes and caches the read, so a later poll picks it up.
    AI_RECHECK_MS,
  );

  // ── Notes (Firebase stock_comments) ──────────────────────────────────────
  const [noteInput, setNoteInput] = useState("");
  const [noteOpen, setNoteOpen]  = useState(false);
  const [ctxMenu, setCtxMenu]    = useState<{ x: number; y: number } | null>(null);

  type InnerDrawer = "techrating" | "peers" | "industry" | "insider" | "keylevels" | "earnings" | "financials" | "dividend" | null;
  const [innerDrawer, setInnerDrawer] = useState<InnerDrawer>(null);
  // Peers list sort by session % change; default desc (best performers first).
  const [peerSort, setPeerSort] = useState<"desc" | "asc">("desc");
  const [peerSortBy, setPeerSortBy] = useState<"c" | "w" | "m" | "mcap" | "rs" | "sym">("c");
  const [peerQuery, setPeerQuery] = useState<string>("");
  // News tab period; null = the first period that has any stories.
  const [newsPeriod, setNewsPeriod] = useState<NewsPeriod | null>(null);
  const [finPeriod,   setFinPeriod]   = useState<"Q" | "A">("Q");

  // Tab shown below the persistent header + chart, in the full (non-embedded)
  // view only — the compact hideHeader/hideChart embed (StockPanelLayout) keeps
  // its original single stacked-card layout, so this state is unused there.
  const [activeTab, setActiveTab] = useState<StockTab>(() => {
    if (initialTab && (!visibleTabs || visibleTabs.length === 0 || visibleTabs.includes(initialTab))) {
      return initialTab;
    }
    if (visibleTabs && visibleTabs.length > 0 && !visibleTabs.includes("overview")) {
      return visibleTabs[0];
    }
    return "overview";
  });

  useEffect(() => {
    if (visibleTabs && visibleTabs.length > 0 && !visibleTabs.includes(activeTab)) {
      setActiveTab(visibleTabs[0]);
    }
  }, [visibleTabs, activeTab]);

  // Watchlists are backend-synced (multiple named lists). The star beside the
  // ticker name is "filled" when the ticker is in ANY list. See toggleWatch for
  // what a click does.
  const { watchlists, addTicker, removeTicker, createList, tickerLimit } = useWatchlistsContext();
  const watchedSet = useMemo(() => new Set(watchlists.flatMap(w => w.tickers)), [watchlists]);
  const [wlPicker, setWlPicker] = useState<{ sym: string; x: number; y: number } | null>(null);
  const [starBusy, setStarBusy] = useState(false);
  const [wlToast, setWlToast] = useState<{ text: string; kind: "ok" | "error" } | null>(null);
  useEffect(() => {
    if (!wlToast) return;
    // Failures carry a longer explanation, so they stay up a little longer.
    const t = setTimeout(() => setWlToast(null), wlToast.kind === "error" ? 5000 : 2600);
    return () => clearTimeout(t);
  }, [wlToast]);
  const chartRef = useRef<HTMLDivElement>(null);

  // Cross-column height match (generic — works for any stock, any peer count):
  // pin the RIGHT column to the LEFT column's natural height and let the Peers
  // card scroll inside it, so Key levels always lands at the base of the right
  // column, aligned with the bottom of Financials. Measuring is the only robust
  // way — a long Peers list (e.g. 89 peers) would otherwise balloon the grid row
  // and push Key levels far below Financials. Disabled below 901px, where
  // .sd-grid collapses to a single stacked column.
  const leftColRef = useRef<HTMLDivElement>(null);
  const [rightColH, setRightColH] = useState<number | undefined>(undefined);
  // Read the left column's height synchronously (offsetHeight forces a fresh
  // layout) and pin the right column to it. Called from useEffects (which run
  // after the DOM is committed) so charts / earnings tables that render when data
  // arrives are already measured — no requestAnimationFrame, which the browser
  // throttles when the tab isn't painting. The <2px guard prevents redundant
  // updates and any ResizeObserver feedback loop.
  const measureCols = useCallback(() => {
    const el = leftColRef.current;
    if (!el || typeof window === "undefined") return;
    // Whether the two columns exist is now a container question, not a window
    // one (see .sd-grid's @container rule). Reading the grid's own computed
    // track list is the direct answer — with the old matchMedia check, a drawer
    // on a wide monitor reported "two columns" while the layout had already
    // stacked, and the rail got pinned to the full height of everything above
    // it.
    const grid = el.parentElement;
    const twoCol = !!grid &&
      window.getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length > 1;
    const next = twoCol ? el.offsetHeight : undefined;
    setRightColH(prev => (prev != null && next != null && Math.abs(prev - next) < 2 ? prev : next));
  }, []);
  useEffect(() => {
    const el = leftColRef.current;
    if (!el || typeof window === "undefined") return;
    const ro = new ResizeObserver(() => measureCols());
    ro.observe(el);
    window.addEventListener("resize", measureCols);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measureCols);
    };
  }, [measureCols]);
  // The LEFT column keeps growing after mount as async content lands (financials
  // charts, the earnings table, web-font reflow) — and a single measure or even
  // the ResizeObserver can miss the final jump. Poll briefly whenever the stock
  // (or Q↔A toggle) changes and stop once the height has settled. Generic: works
  // for any stock and any peer count. Re-keyed on sym/finPeriod.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let last = -1, stable = 0, n = 0;
    measureCols();
    const id = window.setInterval(() => {
      const el = leftColRef.current;
      const h = el ? el.offsetHeight : -1;
      measureCols();
      if (h === last) stable++; else { stable = 0; last = h; }
      if (stable >= 3 || ++n >= 24) window.clearInterval(id); // settled ~750ms, hard cap ~6s
    }, 250);
    return () => window.clearInterval(id);
  }, [measureCols, sym, finPeriod]);

  // Right-click → Add note saves to the account; the notes themselves are
  // listed on the Notes screen (the inline list under the chart was removed).
  async function submitNote() {
    const id = await saveNote(sym, data.name ?? sym, noteInput);
    if (id) {
      setNoteInput(""); setNoteOpen(false);
    }
  }

  function handleChartRightClick(e: React.MouseEvent) {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  }

  // Ticker universe for autocomplete + header chips: the live companies
  // collection, most-active first, instead of a fixed mock catalog.
  const symbolList = [...companies].filter(c => !!c.ticker).sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0)).map(c => c.ticker);
  // Match by ticker prefix OR company name (so "apple" finds AAPL), largest first.
  const suggestions: { ticker: string; name: string }[] = search
    ? (() => {
        const q = search.toLowerCase();
        const qUpper = search.toUpperCase();
        // Rank by match quality (exact ticker → ticker-prefix → name-prefix →
        // name-substring) so an exact-ticker match always wins over a larger-cap
        // company that merely CONTAINS the query in its name. Prevents a short
        // foreign/ambiguous query (e.g. "ITC"/"TCS"/"RELIANCE") from surfacing an
        // unrelated US security above the exact match; market cap only breaks ties
        // within a tier. The company name is shown per row for disambiguation.
        const rank = (c: (typeof companies)[number]) => {
          const tk = (c.ticker ?? "").toUpperCase();
          if (tk === qUpper) return 0;
          if (tk.startsWith(qUpper)) return 1;
          if ((c.name ?? "").toLowerCase().startsWith(q)) return 2;
          return 3;
        };
        return [...companies]
          .filter(c => {
            if (!c.ticker) return false;
            return c.ticker.toLowerCase().startsWith(q) || (c.name ?? "").toLowerCase().includes(q);
          })
          .sort((a, b) => rank(a) - rank(b) || (b.marketCap ?? 0) - (a.marketCap ?? 0))
          .slice(0, 8)
          .map(c => ({ ticker: c.ticker, name: c.name ?? c.ticker }));
      })()
    : [];

  const isLiveStock = !!liveCompany && liveCompany.price != null;
  const isEtf = useMemo(() => {
    const s = sym.toUpperCase();
    if (POPULAR_16_ETFS.has(s)) return true;
    if (visibleTabs && visibleTabs.includes("holdings") && !visibleTabs.includes("financials")) return true;
    if (liveCompany?.exchange === "ETF" || liveCompany?.sector === "ETF" || liveCompany?.industry === "ETF") return true;
    const name = liveCompany?.name ?? "";
    if (/\betf\b|\bindex fund\b/i.test(name)) return true;
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("mc_etf_market_weekly_cache");
        if (raw) {
          const parsed = JSON.parse(raw);
          const categories = parsed?.data?.categories;
          if (Array.isArray(categories)) {
            for (const cat of categories) {
              if (Array.isArray(cat?.funds) && cat.funds.some((f: any) => f.symbol === s)) {
                return true;
              }
            }
          }
        }
      } catch {
        // ignore parse errors
      }
    }
    return false;
  }, [sym, visibleTabs, liveCompany?.exchange, liveCompany?.sector, liveCompany?.industry, liveCompany?.name]);
  // No usable market data for the searched ticker (delisted, brand-new, or
  // non-US listing) — nothing priced came back after the fetch settled.
  const noData = !liveCompanyLoading && !!liveCompany && liveCompany.price == null && liveCompany.marketCap == null;
  const showNoDataPopup = noData && dismissedNoData !== sym;

  // Real 52-week high/low and average volume from a year of daily bars.
  const yr = yearBars ?? [];
  // Support/resistance pivots. PREFER the backend keyLevels (technical-indicators
  // job) — the single corrected source of truth: it derives classic pivots from
  // the last FULLY-COMPLETED session's finalized OHLC. The 1Y chart series (`yr`,
  // from /live/bars) can trail the official close by a session and/or carry a
  // partial current-day bar, so recomputing from it client-side is a FALLBACK only
  // when keyLevels is absent — and even then we use the last COMPLETED session bar
  // (never a still-forming current-day bar) to match the backend basis.
  const basisBar = lastCompletedSessionBar(yr);
  const priorWk = priorWeekHLC(completedSessions(yr));
  const klDaily: Pivots | { pivot: number | null; r1: number | null; r2: number | null; r3: number | null; s1: number | null; s2: number | null; s3: number | null } | null =
    (liveCompany?.keyLevels?.daily ?? null)
    ?? (basisBar ? pivotsFrom(basisBar.h, basisBar.l, basisBar.c) : null);
  const klWeekly =
    (liveCompany?.keyLevels?.weekly ?? null)
    ?? (priorWk ? pivotsFrom(priorWk.h, priorWk.l, priorWk.c) : null);
  // Twenty COMPLETED sessions: the series can end on today's still-forming
  // bar, which pulled the average down by half a day's volume (CRM read 8.36M
  // against a 20-session 8.81M).
  const yrDone = completedSessions(yr);
  // Fallback only (keyStats.high52/low52 first): the same 52-week window as the backend.
  const yr52w = fiftyTwoWeekBars(yrDone);
  const week52 = yr52w.length > 0
    ? { high: Math.max(...yr52w.map(b => b.h)), low: Math.min(...yr52w.map(b => b.l)) }
    : null;
  // Falls back to the company doc's own avgVolume20 (technical-indicators.job,
  // or the summary's identical computation) until the year of bars this
  // normally derives from has loaded — same reasoning as keyStats below.
  const avgVol20 = yrDone.length > 0
    ? yrDone.slice(-20).reduce((s, b) => s + b.v, 0) / Math.min(20, yrDone.length)
    : (keyStats?.avgVolume20 ?? null);

  // Current-session stats straight from the vendor quote (same source and time as
  // the price) — the stored daily bars lag a session until the nightly sync.
  const sessionQuote = useLiveQuotes([sym]).get(sym) ?? null;
  const qPos = (v: number | null | undefined) => (v != null && v > 0 ? v : null);
  const sessOpen = qPos(sessionQuote?.open);
  const sessHigh = qPos(sessionQuote?.dayHigh);
  const sessLow = qPos(sessionQuote?.dayLow);
  const sessPrevClose = qPos(sessionQuote?.previousClose);
  const sessVolume = qPos(sessionQuote?.dayVolume);
  const hasSessionQuote = sessOpen != null && sessHigh != null && sessLow != null && sessPrevClose != null;

  // A daily bar describes THIS session only when it is dated for it. Between
  // the open and the next sync the series ends on the previous session: STRL
  // on 20 Oct showed 19 Oct's open, range and volume as the day's, and 16 Oct's
  // close as the previous close. A stale last bar is the previous close, not
  // today's stats.
  const sessionDate = latestSessionDate();
  const lastYrBar = yr.length > 0 ? yr[yr.length - 1] : null;
  const lastBarIsSession = lastYrBar != null && barDate(lastYrBar) === sessionDate;
  const lastRealBar = realBars && realBars.length > 0 ? realBars[realBars.length - 1] : null;
  const barSessionVol =
    lastBarIsSession && lastYrBar && lastYrBar.v > 0 ? lastYrBar.v
    // Only a 1D candle's volume IS the session's — a 5m or 1W candle's isn't.
    : barInterval === "1D" && lastRealBar && barDate(lastRealBar) === sessionDate && lastRealBar.v > 0 ? lastRealBar.v
    // Nothing for this session: no figure, rather than another day's volume
    // or the 20-day average standing in for it.
    : null;
  const sessionVol = hasSessionQuote && sessVolume != null ? sessVolume : barSessionVol;


  const ema50 = ema(yr, 50);
  const sma20 = sma(yr, 20);
  const sma50 = sma(yr, 50);
  const sma200 = sma(yr, 200);

  const [insTxSortCol, setInsTxSortCol] = useState<"date" | "shares">("date");
  const [insTxSortDir, setInsTxSortDir] = useState<"asc" | "desc">("desc");

  // Real insider transactions for this ticker, with a real dollar value
  // (shares × pricePerShare from the Form 4 filing) instead of an estimate.
  const allSymInsiderTxns = useMemo(() => {
    return liveInsider
      .filter(x => x.ticker === sym)
      .sort((a, b) => (b.transactionDate ?? "").localeCompare(a.transactionDate ?? ""));
  }, [liveInsider, sym]);

  const sortedSymInsiderTxns = useMemo(() => {
    const list = [...allSymInsiderTxns];
    list.sort((a, b) => {
      if (insTxSortCol === "date") {
        const da = a.transactionDate ?? "";
        const db = b.transactionDate ?? "";
        return insTxSortDir === "asc" ? da.localeCompare(db) : db.localeCompare(da);
      } else {
        const sa = a.shares ?? 0;
        const sb = b.shares ?? 0;
        return insTxSortDir === "asc" ? sa - sb : sb - sa;
      }
    });
    return list;
  }, [allSymInsiderTxns, insTxSortCol, insTxSortDir]);

  // 20 at a time. The page is keyed to the ticker + sort, so switching either
  // lands back on page 1 without a reset effect.
  const insTxPageKey = `${sym}|${insTxSortCol}|${insTxSortDir}`;
  const [insTxPageState, setInsTxPageState] = useState({ key: "", page: 0 });
  const insTxPageCount = Math.max(1, Math.ceil(sortedSymInsiderTxns.length / INSIDER_PAGE_SIZE));
  const insTxPage = insTxPageState.key === insTxPageKey ? Math.min(insTxPageState.page, insTxPageCount - 1) : 0;
  const setInsTxPage = (page: number) => setInsTxPageState({ key: insTxPageKey, page });
  const pagedInsiderTxns = sortedSymInsiderTxns.slice(insTxPage * INSIDER_PAGE_SIZE, (insTxPage + 1) * INSIDER_PAGE_SIZE);
  // The "View all" drawer pages its own (date-ordered) list independently.
  const [insDrawerPageState, setInsDrawerPageState] = useState({ key: "", page: 0 });
  const insDrawerPage = insDrawerPageState.key === sym
    ? Math.min(insDrawerPageState.page, Math.max(0, Math.ceil(allSymInsiderTxns.length / INSIDER_PAGE_SIZE) - 1))
    : 0;
  const setInsDrawerPage = (page: number) => setInsDrawerPageState({ key: sym, page });

  // Every transaction, for the "View all" drawer; the overview card shows the
  // first few. Direction comes from the Form 4 acquired/disposed flag — an
  // award or tax withholding is not an open-market buy or sell, so those are
  // labelled by their transaction code rather than "Buy"/"Sell".
  const symInsider = allSymInsiderTxns.map(x => {
    const shares = Math.round(x.shares ?? 0).toLocaleString("en-US");
    const verb = x.transactionCode === "P" ? "Buy"
      : x.transactionCode === "S" ? "Sell"
      : TX_CODE_LABEL[x.transactionCode] ?? (x.acquiredOrDisposed === "D" ? "Disposed" : "Acquired");
    const isSell = x.acquiredOrDisposed === "D";
    return {
      name: x.ownerName ?? "Insider",
      action: `${verb} ${shares}`,
      isSell,
      tag: INSIDER_TAG[x.transactionCode] ?? (isSell ? "OUT" : "IN"),
      date: (x.transactionDate ?? "").slice(0, 10),
      valueUsd: x.pricePerShare != null ? x.shares * x.pricePerShare : null,
    };
  });
  const insiderVendor: VendorKey = allSymInsiderTxns[0]?.vendor === "fmp" ? "fmp" : "sec";

  // Ownership: FMP's 13F rollup for the newest fully-filed quarter, then the
  // company doc's copy; short interest is Polygon-only (FMP has no feed).
  const inst = ownership?.institutional ?? null;
  const instPct = inst?.ownershipPct ?? liveCompany?.instOwnershipPct ?? null;
  const instHolders = inst?.holders ?? liveCompany?.inst13FHolders ?? null;
  const instHoldersChg = inst?.holdersChange ?? liveCompany?.inst13FHoldersChange ?? null;
  const instAsOf = inst?.asOf ?? liveCompany?.instAsOf ?? null;
  const shortInt = ownership?.shortInterest ?? null;
  const topHolders = ownership?.topHolders ?? [];

  const data = {
    name: liveCompany?.name ?? sym,
    description: liveCompany?.description ?? null,
    homepageUrl: liveCompany?.homepageUrl ?? null,
    // Null (not 0) when the company doc has no price yet, so the header renders a
    // loading dash instead of a fabricated $0.00 / +0.00% (BUG-DATA-007).
    price: liveCompany?.price ?? null,
    pctChange: liveCompany?.pctChange ?? null,
    // Key Stats fields read off keyStats (full doc, falling back to the fast
    // summary) so the card fills in ~1-3s for a brand-new ticker instead of
    // sitting on N/A until the full doc finishes building.
    peRatio: keyStats?.peRatio ?? null,
    dividendYield: keyStats?.dividendYield ?? null,
    beta: liveCompany?.beta ?? null,
    sector: keyStats?.sector ?? null,
    industry: keyStats?.industry ?? null,
    insiderActivity: symInsider,
    week52High: range52({ high: keyStats?.high52 ?? week52?.high, low: keyStats?.low52 ?? week52?.low }, { high: sessHigh, low: sessLow }).high,
    week52Low: range52({ high: keyStats?.high52 ?? week52?.high, low: keyStats?.low52 ?? week52?.low }, { high: sessHigh, low: sessLow }).low,
  };
  const isUp = (data.pctChange ?? 0) >= 0;
  // `p` keeps a 0 fallback purely as the numeric baseline for the derived
  // technical stats and the chart below (which have always assumed a number).
  // The header quote uses the nullable `data.price` / `dispPrice` directly, so a
  // genuinely-missing price shows a dash rather than $0.00 (BUG-DATA-007).
  const p = data.price ?? 0;

  // Cross-column height match: the LEFT column ends at Financials (Dividend &
  // Insider moved to a full-width row below the two-column section). The RIGHT
  // column is pinned to leftColRef's measured height (see measureCols above) so
  // Peers scrolls inside it and Key levels sits at the base, level with
  // Financials' bottom border — regardless of peer count.

  const rating = techRating?.label ?? ratingLabel(liveCompany?.techRating ?? null);
  const ratingBasis = techRating ? intervalLabel(barInterval) : "1 day";
  const rs = liveCompany?.rsRating ?? null;
  const rv = liveCompany?.rvol ?? null;
  const mc = keyStats?.marketCap != null ? keyStats.marketCap / 1e9 : null;
  const gv = techRating?.score ?? RATING_VAL[rating] ?? 0;
  // (The technical `tone` that used to live here is gone: TrGauge already
  // colours its own label from `rating`, and its only other consumer was the
  // analyst-consensus label, which now derives its colour from the consensus
  // itself via consensusTone.)
  // Real analyst consensus (Buy/Hold/Sell vote counts) from analyst_actions —
  // shown as its own block rather than mislabeled as a technical-indicator read.
  const consensusDoc = liveConsensus.find(c => c.ticker === sym);

  // Backend venue first: the full doc, then the fast summary (the full doc can
  // be a bulk-synced one without `exchange` while the summary has it), then the
  // companies-list row. null when nobody knows — the header just omits it.
  const ex = exchangeLabel(
    liveCompany?.exchange
    ?? companySummary?.exchange
    ?? companies.find(c => c.ticker === sym)?.exchange
    ?? EXCHANGE[sym],
  );
  const group = data.sector;

  // Next/most-recent earnings date from the live earnings feed.
  const symEvents = liveEarningsEvents
    .filter(e => e.ticker === sym)
    .sort((a, b) => a.date.localeCompare(b.date));
  const todayStr = etTodayIso();
  // The backend's nextEarningsDate (on both /live/company and its /summary)
  // wins while it is still ahead; a stored date can be a report already made
  // (MSFT showed Jul 29 after reporting), so a past one falls through to the
  // earnings calendar. Never a past date: "—" when nothing is scheduled.
  const storedEr = keyStats?.nextEarningsDate && keyStats.nextEarningsDate >= todayStr ? keyStats.nextEarningsDate : null;
  const calEr = symEvents.find(e => e.date >= todayStr)?.date ?? null;
  const erCandidates = [storedEr, calEr].filter((d): d is string => !!d && d >= todayStr).sort();
  const erDate = erCandidates[0] || "—";
  // Earnings dots for both charts on this screen. Shared derivation (see
  // chart-earnings.ts) so the panel charts on watchlist / portfolio / screener /
  // movers / IPOs place the same reports at the same points. Called with the
  // financials doc this screen already fetched, rather than via
  // useChartEarnings, to avoid fetching it a second time.
  const chartEarnings: ChartEarnings[] = buildChartEarnings(financialsDoc, symEvents, todayStr);

  // The next report on the earnings calendar — the only feed carrying a SALES
  // estimate, and a fallback for the next EPS estimate. Null when none is listed.
  const upcomingEr = symEvents.find(e => e.date >= todayStr) ?? null;
  // Sales surprise for the quarter ending `end`: the calendar row reported
  // within ~100 days after that quarter end, when it has both revenue numbers.
  // The calendar holds only a few rows per ticker, so most quarters stay null.
  const salesSurpriseFor = (end: string | undefined): number | null => {
    if (!end) return null;
    // FMP's per-report revenue estimate on the quarter itself covers the full
    // history; the calendar match below is the fallback for docs built before it.
    const q = financialsDoc?.quarters?.find(x => x.endDate === end);
    if (q?.revenue != null && q.revenueEstimateReported) {
      return ((q.revenue - q.revenueEstimateReported) / Math.abs(q.revenueEstimateReported)) * 100;
    }
    const endMs = Date.parse(end);
    const ev = symEvents.find(e => {
      const lag = Date.parse(e.date) - endMs;
      return lag > 0 && lag <= 100 * 86_400_000 && e.revenueActual != null && e.revenueEstimate != null && e.revenueEstimate !== 0;
    });
    return ev ? ((ev.revenueActual as number) - (ev.revenueEstimate as number)) / Math.abs(ev.revenueEstimate as number) * 100 : null;
  };

  // EPS (TTM): the stored trailing-twelve-month EPS from the company doc, shown
  // as-is — NOT reconstructed as price ÷ P/E (circular: the sync-time P/E was
  // itself derived from EPS, so live-price ÷ stale-P/E drifts). N/A when unstored
  // (BUG-DATA-006). `epsTtm`/`eps` are written by the /live/company backend
  // (ondemand.service) and are now declared on the shared CompanyDoc mirror.
  const eps = keyStats?.epsTtm ?? keyStats?.eps ?? null;
  // Real RSI(14)/MACD from technical-indicators.job — "not available" (never
  // a seeded formula) until that job has run for this ticker.
  const rsi = liveCompany?.rsi14 ?? null;
  const macd = liveCompany?.macd ?? null;
  const macdBuy = macd != null ? macd >= (liveCompany?.macdSignal ?? 0) : null;
  // technical-indicators.job also writes these (daily basis).
  const stochKv = liveCompany?.stochK ?? null;
  const adx14 = liveCompany?.adx14 ?? null;
  const offHigh52 = keyStats?.pctFromHigh52 ?? null;
  const offLow52 = keyStats?.pctFromLow52 ?? null;
  const rsiSeries = liveCompany?.rsi14Series ?? null;
  // Headline quote (regular session + after hours), shared with the panel
  // charts so both print the same number. Kept separate from `p` so the many
  // derived stats below (EPS, 52w positioning) stay pinned to the snapshot.
  const hq = useHeadlineQuote(sym, live, { price: data.price, pctChange: data.pctChange });
  const { dispPrice } = hq;

  const divMetrics = resolveDividends({
    dh: dividendHistory,
    price: dispPrice ?? data.price,
    fallbackDivPerShare: keyStats?.dividendPerShare,
    fallbackYield: data.dividendYield,
  });
  const divPerShare = divMetrics.forwardPerShare;

  const isErConfirmed = Boolean(
    (liveCompany as any)?.earningsConfirmed ??
    (keyStats as any)?.earningsConfirmed ??
    symEvents.find(e => e.date === erDate && (e as any).confirmed)
  );

  // v is in $B. Below $1B, show millions so micro-caps (e.g. GAUZ ≈ $9M) read
  // "$9.1M" rather than rounding to a meaningless "$0.0B".
  const cap = (v: number) =>
    v >= 1000 ? `$${(v / 1000).toFixed(2)}T`
    : v >= 100 ? `$${Math.round(v)}B`
    : v >= 1  ? `$${v.toFixed(1)}B`
    : v > 0   ? `$${(v * 1000).toFixed(v < 0.1 ? 1 : 0)}M`
    : "—";
  const nf = (x: number) => Math.round(x).toLocaleString("en-US");
  // 52-week range, guarded against reverse-split artifacts. The high/low come
  // from SPLIT-ADJUSTED bars, so a serial reverse-splitter's adjusted history
  // explodes: SXTC (150:1 in Feb + 80:1 in Aug 2026) shows a $83,758 "52-week
  // high" against a $3.63 price. Arithmetically the adjusted equivalent, but as
  // a headline it is nonsense — 20 tickers in the live universe were affected.
  // A genuine 52-week range practically never exceeds ~20x, so beyond that we
  // show nothing rather than a fabricated number (this one guard covers the
  // range, the Off-High/Off-Low stats and the drawer, which all read lo/hi).
  const MAX_52W_RATIO = 20;
  const rawLo = data.week52Low, rawHi = data.week52High;
  const range52Reliable =
    rawLo == null || rawHi == null || rawLo <= 0 ? true : rawHi / rawLo <= MAX_52W_RATIO;
  let lo = range52Reliable ? rawLo : null;
  let hi = range52Reliable ? rawHi : null;
  // Foreign / on-demand tickers often lack a stored week52High/Low but DO carry
  // pctFromHigh52 / pctFromLow52 — derive the range from those + the price so the
  // 52W-Range tile stays consistent with the Off-52W-High/Low stats (which read
  // those percentages) instead of showing N/A next to real off-high/low values.
  // Only when the RAW values were missing — never resurrect a ratio-suppressed
  // (reverse-split-artifact) range.
  if ((rawLo == null || rawHi == null) && p > 0) {
    if (hi == null && offHigh52 != null && 1 + offHigh52 / 100 > 0) hi = p / (1 + offHigh52 / 100);
    if (lo == null && offLow52 != null && 1 + offLow52 / 100 > 0) lo = p / (1 + offLow52 / 100);
  }
  // Off-high/low measured from the range shown beside them. The stored
  // percentages run off the last stored bar, so a high made today is missing:
  // XOM read -1.2% (off 179.30) beside a 52-week range topping out at today's
  // 180.26. Only when a real range is on screen — never one derived from these
  // same percentages just above.
  const offPx = dispPrice != null && dispPrice > 0 ? dispPrice : p > 0 ? p : null;
  const offHigh52Shown = rawHi != null && hi != null && hi > 0 && offPx != null
    ? (offPx / Math.max(hi, offPx) - 1) * 100
    : offHigh52;
  const offLow52Shown = rawLo != null && lo != null && lo > 0 && offPx != null
    ? (offPx / Math.min(lo, offPx) - 1) * 100
    : offLow52;

  // Trend / MA posture, from the price vs its 20/50/200-day SMAs computed
  // client-side from the year of daily bars. These used to come from the RS
  // rank whenever one existed, which read a 12-month relative-strength score as
  // if it were a moving-average position: SNDK at RS 98 showed "Above the 20,
  // 50 and 200-day" while trading below its 20 and 50-day. RS is now only the
  // Trend fallback for tickers with no bar history; it says nothing about where
  // price sits against an average, so MA posture has no RS fallback.
  const vsMa = (ma: number | null) => (ma != null && p > 0 ? p > ma : null);
  const maPos = ([["20", sma20], ["50", sma50], ["200", sma200]] as const)
    .map(([label, ma]) => ({ label, above: vsMa(ma) }))
    .filter((m): m is { label: "20" | "50" | "200"; above: boolean } => m.above != null);
  const above50 = maPos.find(m => m.label === "50")?.above ?? null;
  const above200 = maPos.find(m => m.label === "200")?.above ?? null;
  const haveMA   = maPos.length > 0;
  // ["20", "50", "200"] → "20, 50 and 200-day"
  const maList = (ls: string[]) =>
    `${ls.length > 1 ? `${ls.slice(0, -1).join(", ")} and ${ls[ls.length - 1]}` : ls[0]}-day`;
  // Built as JSX, not as a string containing <b> tags. These rows render through
  // {l[1]}, which escapes strings — so markup embedded in one reached the reader
  // as literal "<b>Range / consolidation.</b>" on the stock page.
  const lead = (bold: string, rest: string) => (<><b>{bold}</b> {rest}</>);
  const trendTxt: ReactNode = haveMA
    ? (above50 && above200
        ? lead("Uptrend.", "Price is trading above its 50-day and 200-day moving averages.")
        : above50 === false && above200 === false
        ? lead("Downtrend.", "Price is below both its 50-day and 200-day moving averages.")
        : above50 === false && above200
        ? lead("Pullback.", "Price has slipped below its 50-day but holds above its 200-day.")
        : above50 && above200 === false
        ? lead("Recovering.", "Price has reclaimed its 50-day but is still below its 200-day.")
        : lead("Range / consolidation.", "Price is mixed around its moving averages."))
    : rs != null
    ? (isUp && rs >= 70
        ? lead("Strong uptrend.", "Relative-strength leader; momentum confirmed by recent strength.")
        : rs < 40
        ? lead("Downtrend.", "Lagging the market on relative strength.")
        : lead("Range / consolidation.", "Choppy two-way action with no decisive trend yet."))
    : "Trend read not available yet — no price history synced.";
  const aboveLs = maPos.filter(m => m.above).map(m => m.label);
  const belowLs = maPos.filter(m => !m.above).map(m => m.label);
  const maTxt = !haveMA
    ? "Moving-average posture not available yet."
    : belowLs.length === 0
    ? `Above the ${maList(aboveLs)} — bullish alignment.`
    : aboveLs.length === 0
    ? `Below the ${maList(belowLs)} — bearish alignment.`
    : `Below the ${maList(belowLs)}, above the ${maList(aboveLs)} — mixed.`;

  // Price the EMA/SMA signals compare against — a real one or none. `p` is 0
  // while the company doc has no price, and 0 > any average is false, so CRM's
  // EMA 50 and SMA 200 both read "Sell" with the stock trading above both.
  const sigPx = p > 0 ? p : dispPrice != null && dispPrice > 0 ? dispPrice : null;
  const indRows: [string, string | null, string][] = [
    ["RSI (14)", rsi != null ? rsi.toFixed(2) : null, rsi == null ? "" : rsi > 70 ? "Sell" : rsi < 40 ? "Buy" : "Neutral"],
    ["MACD (12,26)", macd != null ? macd.toFixed(1) : null, macdBuy == null ? "" : macdBuy ? "Buy" : "Sell"],
    // Stoch %K and Wilder ADX(14) now computed by technical-indicators.job.
    ["Stoch %K", stochKv != null ? stochKv.toFixed(1) : null, stochKv == null ? "" : stochKv > 80 ? "Sell" : stochKv < 20 ? "Buy" : "Neutral"],
    ["ADX (14)", adx14 != null ? adx14.toFixed(1) : null, adx14 == null ? "" : adx14 > 25 ? "Strong" : adx14 < 20 ? "Weak" : "Neutral"],
    ["EMA 50", ema50 != null ? nf(ema50) : null, ema50 != null && sigPx != null ? (sigPx > ema50 ? "Buy" : "Sell") : ""],
    ["SMA 200", sma200 != null ? nf(sma200) : null, sma200 != null && sigPx != null ? (sigPx > sma200 ? "Buy" : "Sell") : ""],
  ];

  // Real 10-quarter EPS history from the per-ticker financials feed
  // (/live/financials) — reported EPS is always present; the estimate/%surp
  // fill in where the FMP estimate feed has it. (The market-wide earnings
  // calendar carries estimates for only a few names, so it left this empty.)
  // Foreign private issuers / ADRs (e.g. GAUZ, a 20-F filer) commonly have NO
  // Polygon/FMP statement `quarters` synced yet DO carry a deep FMP `epsHistory`.
  // Fall back to that so the EPS-growth chart shows reported EPS instead of an
  // empty state when statements simply don't exist for the ticker.
  type EpsSrc = {
    endDate: string | null; fiscalPeriod: string | null; fiscalYear: string | number | null;
    epsActual: number | null; epsEstimate: number | null;
    epsActualReported?: number | null; epsEstimateReported?: number | null;
  };
  const qRows: EpsSrc[] = financialsDoc?.quarters ?? [];
  const epsSrc: EpsSrc[] = qRows.some(q => q.epsActual != null)
    ? qRows
    : (financialsDoc?.epsHistory ?? []).map(h => ({
        endDate: h.date ?? null, fiscalPeriod: h.fiscalPeriod, fiscalYear: h.fiscalYear,
        epsActual: h.epsActual, epsEstimate: h.epsEstimate,
      }));
  const hist10: EarnQ[] = epsSrc
    .filter(q => q.epsActual != null)
    .slice()
    .sort((a, b) => (b.endDate ?? "").localeCompare(a.endDate ?? ""))
    .slice(0, 10)
    .map(q => {
      // Beat/miss + the shown actual/estimate use the FMP matched pair
      // (epsActualReported/epsEstimateReported — same basis, split-normalized),
      // never Polygon GAAP actual vs a non-GAAP estimate. GAAP is a display-only
      // fallback for the actual; e=0 (→ "—") when there's no matched pair.
      const repAct = q.epsActualReported ?? null;
      const repEst = q.epsEstimateReported ?? null;
      const pairedSurp = surprisePct(repAct, repEst);
      const surpStr = formatEpsSurprise(repAct, repEst);
      const paired = pairedSurp != null;
      const act = repAct ?? (q.epsActual as number);
      const surp = pairedSurp ?? 0;
      return {
        q: q.endDate
          ? fmtDate(q.endDate, { month: "short", year: "2-digit" })
          : `${q.fiscalPeriod ?? ""} ${q.fiscalYear ?? ""}`.trim(),
        e: paired && repEst != null ? repEst : 0, a: act, surp: parseFloat(surp.toFixed(1)), mv: 0,
        surpStr,
        gaap: gaapQuarterEps(q),
        label: quarterLabel(q),
      };
    });
  const beatStreak = (() => {
    let n = 0;
    for (const h of hist10) { if (h.surp >= 0) n++; else break; }
    return hist10.length && hist10[0].surp < 0 ? -n || -1 : n;
  })();

  // Sectors ranked by today's real pctChange (from /market-data/sectors) —
  // replaces the mock sector list's fabricated rank + Improving/Deteriorating
  // trend label, which had no live equivalent.
  const rankedSectors = [...sectorsLive].sort((a, b) => b.pctChange - a.pctChange);
  const grank = group != null ? rankedSectors.findIndex(s => s.sector === group) + 1 : 0;
  const inSectorRank = liveCompany?.sectorRank ?? null;
  const inSectorTotal = liveCompany?.sectorRankTotal ?? null;
  const topSectors = rankedSectors.slice(0, 5);
  const sectorPcts = topSectors.map(s => s.pctChange);
  const pmxSector = sectorPcts.length ? Math.max(...sectorPcts) : 0;
  const pmnSector = sectorPcts.length ? Math.min(...sectorPcts) : 0;

  // Real peers from Polygon /v1/related-companies (stored on liveCompany.peers),
  // looked up in the live companies for price/RS. Falls back to same-sector RS
  // leaders only if none of the related tickers are in the synced universe.
  // Raw related-tickers Polygon returned for this symbol. This is "how many
  // peers are in the response".
  type PeerRow = {
    t: string;
    c: number;
    price: number | null;
    marketCap: number | null;
    peRatio: number | null;
    rsRating: number | null;
    name: string | null;
    weeklyChange?: number | null;
    monthlyChange?: number | null;
  };
  const rawPeerTickers = (liveCompany?.peers ?? []).filter(t => t !== sym);
  const inUniverse = new Set(companies.map(c => c.ticker));
  // Peers not in the synced universe are priced on demand (one snapshot call),
  // so EVERY peer Polygon returned can be shown — not just the synced ones.
  const missingPeers = rawPeerTickers.filter(t => !inUniverse.has(t));
  const quoteByTicker = useLiveQuotes(missingPeers);

  const [enrichedPeers, setEnrichedPeers] = useState<Map<string, {
    name?: string | null;
    marketCap?: number | null;
    peRatio?: number | null;
    rsRating?: number | null;
    weeklyChange?: number | null;
    monthlyChange?: number | null;
  }>>(new Map());

  // Summaries for EVERY peer: untracked ones need all their fields, and every
  // peer's monthly change is computed live server-side (price now vs the close
  // 30 calendar days ago) rather than read from the last stored bar.
  const peersKey = rawPeerTickers.join(",");
  useEffect(() => {
    if (!peersKey) return;
    let active = true;
    apiGet<Array<{
      ticker: string;
      name: string | null;
      marketCap: number | null;
      peRatio: number | null;
      rsRating: number | null;
      weeklyChange: number | null;
      monthlyChange: number | null;
    }>>(`/live/peers-summary?tickers=${encodeURIComponent(peersKey)}`)
      .then((rows) => {
        if (!active || !Array.isArray(rows)) return;
        setEnrichedPeers((prev) => {
          const next = new Map(prev);
          for (const r of rows) {
            next.set(r.ticker, {
              name: r.name,
              marketCap: r.marketCap != null ? (r.marketCap > 1e6 ? r.marketCap / 1e9 : r.marketCap) : null,
              peRatio: r.peRatio,
              rsRating: r.rsRating,
              weeklyChange: r.weeklyChange,
              monthlyChange: r.monthlyChange,
            });
          }
          return next;
        });
      })
      .catch(() => {});
    return () => { active = false; };
  }, [peersKey]);

  const relatedPeersAll: PeerRow[] = [];
  for (const t of rawPeerTickers) {
    const c = companies.find(x => x.ticker === t);
    const extra = enrichedPeers.get(t);
    if (c && c.pctChange != null) {
      relatedPeersAll.push({
        t: c.ticker,
        c: c.pctChange as number,
        price: c.price ?? null,
        marketCap: c.marketCap != null ? c.marketCap / 1e9 : (extra?.marketCap ?? null),
        peRatio: c.peRatio ?? extra?.peRatio ?? null,
        rsRating: c.rsRating ?? extra?.rsRating ?? null,
        name: c.name || extra?.name || null,
        weeklyChange: c.week5ChangePct ?? extra?.weeklyChange ?? null,
        monthlyChange: extra?.monthlyChange ?? c.monthChangePct ?? null,
      });
      continue;
    }
    const q = quoteByTicker.get(t);
    if (q && q.pctChange != null) {
      relatedPeersAll.push({
        t,
        c: q.pctChange,
        price: q.price ?? null,
        marketCap: extra?.marketCap ?? null,
        peRatio: extra?.peRatio ?? null,
        rsRating: extra?.rsRating ?? null,
        name: extra?.name ?? null,
        weeklyChange: extra?.weeklyChange ?? null,
        monthlyChange: extra?.monthlyChange ?? null,
      });
    }
  }
  // Fallback to same-sector RS leaders only if none of the related tickers resolve.
  const peersAll: PeerRow[] = relatedPeersAll.length
    ? relatedPeersAll
    : companies
        .filter(c => c.sector === group && c.ticker !== sym && c.pctChange != null)
        .sort((a, b) => (b.rsRating ?? 0) - (a.rsRating ?? 0))
        .map(c => ({
          t: c.ticker,
          c: c.pctChange as number,
          price: c.price ?? null,
          marketCap: c.marketCap != null ? c.marketCap / 1e9 : null,
          peRatio: c.peRatio ?? null,
          rsRating: c.rsRating,
          name: c.name,
          weeklyChange: c.week5ChangePct ?? null,
          monthlyChange: c.monthChangePct ?? null,
        }));
  const peers = peersAll;                    // card shows ALL peers (scrolls within the card body when they overflow)
  const peersTotal = peersAll.length;
  const pcs = peersAll.map(x => x.c);
  const pmx = pcs.length ? Math.max(...pcs) : 0;
  const pmn = pcs.length ? Math.min(...pcs) : 0;
  const avgPeerChange = pcs.length ? pcs.reduce((a, b) => a + b, 0) / pcs.length : null;
  const leaderPeer = peersAll.find(x => x.c === pmx);
  const laggardPeer = peersAll.find(x => x.c === pmn);

  // User-controlled ordering by session % change (asc/desc). Leader/Laggard
  // tags still key off pmx/pmn, so they stay correct regardless of sort.
  const sortedPeers = [...peersAll].sort((a, b) => (peerSort === "asc" ? a.c - b.c : b.c - a.c));

  const displayPeers = useMemo(() => {
    let list = [...peersAll];
    if (peerQuery.trim()) {
      const q = peerQuery.trim().toUpperCase();
      list = list.filter(p => p.t.toUpperCase().includes(q) || (p.name && p.name.toUpperCase().includes(q)));
    }
    list.sort((a, b) => {
      if (peerSortBy === "c") {
        return peerSort === "desc" ? b.c - a.c : a.c - b.c;
      }
      if (peerSortBy === "w") {
        const wa = a.weeklyChange ?? -9999;
        const wb = b.weeklyChange ?? -9999;
        return peerSort === "desc" ? wb - wa : wa - wb;
      }
      if (peerSortBy === "m") {
        const ma = a.monthlyChange ?? -9999;
        const mb = b.monthlyChange ?? -9999;
        return peerSort === "desc" ? mb - ma : ma - mb;
      }
      if (peerSortBy === "mcap") {
        const ma = a.marketCap ?? -1;
        const mb = b.marketCap ?? -1;
        return peerSort === "desc" ? mb - ma : ma - mb;
      }
      if (peerSortBy === "rs") {
        const rsa = a.rsRating ?? -1;
        const rsb = b.rsRating ?? -1;
        return peerSort === "desc" ? rsb - rsa : rsa - rsb;
      }
      if (peerSortBy === "sym") {
        return peerSort === "desc" ? b.t.localeCompare(a.t) : a.t.localeCompare(b.t);
      }
      return 0;
    });
    return list;
  }, [peersAll, peerQuery, peerSortBy, peerSort]);

  // Tab bar config — mirrors the stock-detail design's Overview/Analysis/Peers/
  // Earnings/Financials/Holdings/News split (the price chart sits on
  // Overview, Peers has its own dedicated comparison section). Counts are real
  // data (quarters on file / articles fetched / peer counts), not decorative.
  const ALL_TABS: { id: StockTab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "analysis", label: "AI Read" },
    ...(!isEtf ? [{ id: "analyst" as StockTab, label: "Analyst Actions" }] : []),
    { id: "peers", label: "Peers", count: peersTotal || undefined },
    { id: "earnings", label: "Earnings", count: hist10.length || undefined },
    { id: "financials", label: "Financials" },
    { id: "holdings", label: isEtf ? "Holdings" : "Insider Transactions" },
    ...(!isEtf
      ? [
          { id: "13f" as StockTab, label: "13F Filings" },
        ]
      : []),
    { id: "news", label: "News", count: tickerNews?.length || undefined },
  ];

  const TABS = useMemo(() => {
    if (!visibleTabs || visibleTabs.length === 0) return ALL_TABS;
    return ALL_TABS.filter(t => visibleTabs.includes(t.id));
  }, [visibleTabs, isEtf, hist10.length, tickerNews?.length, peersTotal]);
  // Rail cards belong to Analysis (Technical rating / Indicators / analyst actions / Key levels).
  // Overview no longer carries Peers in rail — Peers has its own dedicated comparison section.
  // Every other tab gets a full-width main column instead of an empty track.
  const showRail = !hideHeader && activeTab === "analysis";

  function selectSym(s: string) {
    setSym(s);
    setSearch("");
    if (typeof window !== "undefined") localStorage.setItem("iq-stock", s);
  }

  function openWatchlistPicker(s: string, e: React.MouseEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setWlPicker({ sym: s, x: r.right - 250, y: r.bottom });
  }

  /**
   * The star beside the ticker name. Not saved → one click adds it to the first
   * watchlist (creating "My Watchlist" if there is none) and confirms with a
   * toast. Saved in one list → a click removes it. Saved in several → open the
   * picker, since "unstar" would be ambiguous.
   */
  async function toggleWatch(e: React.MouseEvent<HTMLButtonElement>) {
    const S = sym.toUpperCase();
    const saved = watchlists.filter(w => w.tickers.includes(S));
    if (saved.length > 1) { openWatchlistPicker(S, e); return; }
    if (saved.length === 1) {
      void removeTicker(saved[0].id, S);
      setWlToast({ text: `${S} removed from ${saved[0].name}`, kind: "ok" });
      return;
    }
    // The server always returns at least one list, so none here means they
    // haven't loaded (the button is disabled then) — never create one from here.
    const list = watchlists[0];
    if (!list) return;
    setStarBusy(true);
    try {
      const res = await addTicker(list.id, S);
      setWlToast(res.ok
        ? { text: `${S} added to ${list.name}`, kind: "ok" }
        : { text: res.message, kind: "error" });
    } finally {
      setStarBusy(false);
    }
  }

  return (
    // The container-query scope. This screen renders at four very different
    // widths — full screen, the mover drawer, the detail popover and the
    // search panel — and the layout below sizes itself from THIS element, not
    // from the window, so each copy lays out for the room it actually has.
    // See .sd-scope in iq.css.
    <div className="sd-scope">
      {/* Symbol bar — search left, chips right */}
      {/* {!hideHeader && (
        <div className="fbar" style={{ position: "relative" }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && search) selectSym(search.toUpperCase()); }}
              placeholder="Search symbol or company…"
              style={{
                background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)",
                padding: "5px 10px", fontSize: "0.7812rem", color: "var(--text-hi)", outline: "none", width: "18rem",
                fontFamily: "var(--f-mono)",
              }}
            />
            {suggestions.length > 0 && (
              <div style={{
                position: "absolute", top: "100%", left: 0, background: "var(--surface-1)",
                border: "1px solid var(--border)", borderRadius: "var(--r-sm)", zIndex: 20,
                minWidth: 180, marginTop: 2,
              }}>
                {suggestions.map(s => (
                  <div key={s.ticker} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "6px 8px 6px 12px" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-2)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "")}>
                    <div onMouseDown={() => selectSym(s.ticker)}
                      style={{ flex: 1, cursor: "pointer", minWidth: 0, overflow: "hidden" }}>
                      <span style={{ fontSize: "0.7812rem", color: "var(--text-hi)", fontFamily: "var(--f-mono)" }}>{s.ticker}</span>
                      <span style={{ fontSize: "0.68rem", color: "var(--text-dim-solid)", marginLeft: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</span>
                    </div>
                    <button
                      onMouseDown={e => { e.preventDefault(); openWatchlistPicker(s.ticker, e); }}
                      title={watchedSet.has(s.ticker) ? "Edit watchlists" : "Add to a watchlist"}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1rem", padding: "0 4px",
                        color: watchedSet.has(s.ticker) ? "var(--warn)" : "var(--text-dim-solid)", lineHeight: 1 }}>
                      {watchedSet.has(s.ticker) ? "★" : "☆"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {symbolList.slice(0, 12).map(s => (
            <button key={s} className={`chip${sym === s ? " active" : ""}`} onClick={() => selectSym(s)}>{s}</button>
          ))}
        </div>
      )} */}

      {!hideHeader && !hideIdentity && (
        <div style={{ padding: "14px 18px 0" }}>
          {/* Quote strip, as in the stock-detail reference: ONE card with the
              identity, the quote and a two-line company blurb that expands in
              place. It replaces the tall header + separate scrolling About box,
              which pushed the tabs and chart well down the page. */}
          <section className="sd-snap">
            {/* Centred like the price column beside it, so the SI button stays
                right under the exchange line instead of dropping to the bottom
                edge when the About box makes the strip taller. */}
            <div className="sd-snap-id" style={{ justifyContent: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, height: 34 }}>
                {/* StockLogo matches the height of NVDA + NASDAQ ET perfectly */}
                <StockLogo sym={sym} size={23} style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0 }} />
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <h1 style={{ lineHeight: 1.25 }}>{sym}</h1>
                    {(() => {
                      const S = sym.toUpperCase();
                      const lists = watchlists.filter(w => w.tickers.includes(S));
                      const label = watchlists.length === 0 ? "Loading your watchlists…"
                        : lists.length === 0 ? `Add ${S} to watchlist`
                        : lists.length === 1 ? `Remove ${S} from ${lists[0].name}`
                        : `Edit watchlists for ${S}`;
                      return (
                        <button
                          type="button"
                          className={`sd-star${watchedSet.has(S) ? " on" : ""}`}
                          onClick={toggleWatch}
                          disabled={starBusy || watchlists.length === 0}
                          aria-pressed={watchedSet.has(S)}
                          aria-label={label}
                          title={label}
                        >
                          {watchedSet.has(S) ? "★" : "☆"}
                        </button>
                      );
                    })()}
                  </div>
                  <div className="ex" style={{ lineHeight: 1.25 }} title={[data.name, ex, group].filter(Boolean).join(" · ")}>
                    {[ex, group].filter(Boolean).join(" · ") || data.name}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 10, display: "flex", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => enterSI(sym)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    height: 24,
                    padding: "0 10px",
                    background: "rgba(89, 128, 166, 0.14)",
                    border: "1px solid rgba(127, 168, 208, 0.35)",
                    borderRadius: 99,
                    color: "#a9c6e3",
                    fontFamily: "var(--f-sans, -apple-system, sans-serif)",
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    letterSpacing: "0.02em",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(89, 128, 166, 0.28)";
                    e.currentTarget.style.borderColor = "#7fa8d0";
                    e.currentTarget.style.color = "#ffffff";
                    e.currentTarget.style.boxShadow = "0 0 12px rgba(127, 168, 208, 0.35)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(89, 128, 166, 0.14)";
                    e.currentTarget.style.borderColor = "rgba(127, 168, 208, 0.35)";
                    e.currentTarget.style.color = "#a9c6e3";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                  title={`Open Stock Intelligence for ${sym}`}
                >
                  <span style={{ color: "#7fa8d0", fontSize: "0.70rem", lineHeight: 1 }}>✦</span>
                  <span>Open Stock Intelligence</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}>
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
            {/* Price and its meta row sit together, centred in the strip: the
                class default (space-between) pushed the meta row to the bottom
                edge whenever the About box made the strip taller. */}
            <div className="sd-snap-px" style={{ justifyContent: "center" }}>
              <div style={{ display: "flex", alignItems: "center" }}>
                <QuoteHeadline q={hq} />
              </div>
              <div className="sd-snap-meta" style={{ marginTop: 14, display: "flex", alignItems: "center" }}>
                <span>Vol <b>{sessionVol != null ? fmt(sessionVol, 0) : "—"}</b></span>
                {mc != null && <span>Mkt cap <b>{cap(mc)}</b></span>}
                {inSectorRank != null && inSectorTotal != null && (
                  <span className="pill" style={{ background: "var(--surface-3)", color: "var(--text-hi)", fontSize: ".52rem", padding: "1px 5px" }}>
                    #{inSectorRank} of {inSectorTotal} in sector
                  </span>
                )}
                {isLiveStock && (
                  <span className="pill" style={{ background: "var(--surface-3)", color: "var(--up)", fontSize: ".52rem", padding: "1px 5px" }}>
                    live quote · {vendorLabel(liveCompany?.source)}
                  </span>
                )}
              </div>
            </div>
            <div className="sd-snap-about">
              {data.description ? (
                <p>
                  {data.description}
                  {data.homepageUrl && (
                    <> <a href={data.homepageUrl} target="_blank" rel="noreferrer">Company website ↗</a></>
                  )}
                </p>
              ) : (
                <p className="dim">{data.name}</p>
              )}
              {(() => {
                const ceoVal = liveCompany?.ceo ?? (keyStats as any)?.ceo ?? (data as any)?.ceo ?? null;
                const empVal = liveCompany?.employees ?? (keyStats as any)?.employees ?? (data as any)?.employees ?? null;
                const listingDateVal = liveCompany?.listingDate ?? (keyStats as any)?.listingDate ?? (data as any)?.listingDate ?? (data as any)?.listDate ?? null;
                return (ceoVal || empVal != null || listingDateVal) && (
                  <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", marginTop: 8, fontSize: ".72rem", color: "var(--text-mid)" }}>
                    {ceoVal && <span><b style={{ color: "var(--text-hi)" }}>CEO:</b> {ceoVal}</span>}
                    {empVal != null && <span><b style={{ color: "var(--text-hi)" }}>Employees:</b> {Number(empVal).toLocaleString("en-US")}</span>}
                    {listingDateVal && <span><b style={{ color: "var(--text-hi)" }}>Listed:</b> {fmtDate(listingDateVal)}</span>}
                  </div>
                );
              })()}
            </div>
            {/* <span className="sd-snap-src"><VendorTag v={["fmp", "polygon"]} /></span> */}
            {headerActions && <div className="sd-snap-actions">{headerActions}</div>}
          </section>
        </div>
      )}

      <div
        className="sd-grid"
        style={hideHeader ? { paddingTop: 0 } : (showRail ? undefined : { gridTemplateColumns: "minmax(0, 1fr)" })}
      >

        {/* ── Tab bar — Chart / Overview / Analysis / Earnings / Financials / Holdings /
             News. Full-view only; the compact embed (hideHeader, used inline in
             StockPanelLayout) keeps its original single stacked-card layout,
             rendered unchanged in the `hideHeader &&` branch below. */}
        {!hideHeader && (
          <nav className="sd-tabbar" style={{ gridColumn: "1 / -1" }} role="tablist" aria-label="Stock detail sections">
            {TABS.map(t => (
              <button
                key={t.id}
                className="sd-tabbtn"
                role="tab"
                aria-selected={activeTab === t.id}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
                {t.count ? <span className="count">{t.count}</span> : null}
              </button>
            ))}
          </nav>
        )}

        {/* Full-width chart — above Overview's content (and its Peers rail) in
            the full view, as in the design; always shown in compact embed mode. */}
        {((!hideHeader && !hideChart && activeTab === "overview") || (hideHeader && !hideChart)) && (
          <div style={{ gridColumn: "1 / -1" }}>
            {/* Chart card */}
            <div className="card">
              <div id="chartHost" ref={chartRef} onContextMenu={handleChartRightClick} style={{ padding: "0 14px 6px" }}>
                {/* The shared chart every panel uses (Earnings Hub, watchlist, …),
                    handed the data this page already holds so nothing is
                    fetched twice. */}
                <StockChart
                  sym={sym}
                  name={data.name}
                  interval={barInterval}
                  onIntervalChange={setBarInterval}
                  data={{
                    live,
                    bars: { bars: realBars, loading: barsLoading },
                    yearBars: yearBars ?? null,
                    news: tickerNews,
                    earnings: chartEarnings,
                  }}
                />
              </div>

                {/* The hard-coded "Pattern: cup-with-handle breakout / breakdown
                    below support" line was removed (QA row 259): it wasn't a
                    real pattern detector, and showed "breakout" even for
                    stocks that were down. */}
          </div>
        </div>)}

      {hideHeader && (<>
        {/* LEFT COLUMN — natural height (no stretch) so leftColRef measures the
            true content bottom (Financials); the right column is pinned to it. */}
        <div ref={leftColRef} style={{ display: "flex", flexDirection: "column", gap: 14, alignSelf: "start" }}>

          {/* Keystats */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 12px 0" }}><VendorTag v={["fmp", "polygon"]} /></div>
            <div className="keystats">
              {([
                ["Mkt Cap",        mc != null ? cap(mc) : null],
                ["P/E",            eps != null && eps <= 0 ? "n/a" : (data.peRatio != null ? data.peRatio.toFixed(1) : null)],
                ["EPS (TTM)",      eps != null ? "$" + eps.toFixed(2) : null],
                ["Next ER",        erDate !== "—" ? `${fmtDate(erDate)}${!isErConfirmed ? " (Estimated)" : ""}` : null],
                ["52W Range",      hi != null && lo != null ? "$" + nf(lo) + " – $" + nf(hi) : null],
                // Distance from the 52-week extremes. Both are computed nightly
                // and were sitting unused while the range they refer to was
                // already on screen. "% off high" is the IBD-style read.
                ["Off 52W High",   offHigh52Shown != null ? offHigh52Shown.toFixed(1) + "%" : null],
                ["Off 52W Low",    offLow52Shown != null ? "+" + offLow52Shown.toFixed(1) + "%" : null],
                ["Avg Vol (20d)",  avgVol20 != null ? nf(avgVol20 / 1e6) + "M" : null],
                ["Sector",         titleCaseLabel(data.sector)],
                ["Industry",       titleCaseLabel(data.industry)],
                ["Div Yield",      divMetrics.isPayer && divMetrics.forwardYieldPct != null ? `${divMetrics.forwardYieldPct.toFixed(2)}% (fwd)` : (divMetrics.isPayer ? null : "None")],
                ["Div / Share",    divMetrics.isPayer && divMetrics.forwardPerShare != null ? `$${divMetrics.forwardPerShare.toFixed(2)} (fwd)` : (divMetrics.isPayer ? null : "None")],
              ] as [string, string | null][]).map(k => (
                <div key={k[0]} className="kstat">
                  <div className="k">{k[0]}</div>
                  <div className="v">{k[1] ?? <NotAvailable />}</div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Technical Analysis */}
          <div className="ai-block">
            <div className="card-h">
              <h3 className="ai-c">◆ AI Technical Analysis</h3>
              <VendorTag v={["fmp", "polygon"]} />
            </div>
            <div className="card-b" style={{ maxHeight: "none" }}>
              {([
                ["Trend",            trendTxt],
                ["Support / Resist.", hi != null
                  ? (<>52-week high <b>${nf(hi)}</b>{lo != null ? <>; 52-week low <b>${nf(lo)}</b></> : null}.</>)
                  : "Support/resistance levels not available."],
                ["MA posture",       maTxt],
                ["Rel. strength",    rs != null
                  ? (<>Relative-strength rank <b className={rs >= 70 ? "up" : rs < 40 ? "down" : ""}>{rs}/99</b> vs the market — {rs >= 70 ? "group leader." : rs < 40 ? "lagging the tape." : "roughly in line."}</>)
                  : "Not ranked yet — this ticker isn't in the synced RS universe."],
                ["Volume",           rv != null ? (<>Relative volume <b>{rv.toFixed(1)}×</b> — {rv > 2 ? "well above average (event-driven)." : "near normal."}</>) : "Relative volume not available."],
                ["Event risk",       erDate !== "—" ? `Next earnings ${erDate}.` : "No upcoming earnings date on record."],
              ] as [string, ReactNode][]).map(l => (
                <div key={l[0]} className="ai-line">
                  <span className="k">{l[0]}</span>
                  <span className="v">{l[1]}</span>
                </div>
              ))}
              <div style={{ marginTop: 10, fontSize: ".7rem", color: "var(--text-dim-solid)" }}>
                Source: rs-rating.job, technical-indicators.job, a year of daily bars · informational purposes only, not investment advice.
              </div>

              {/* ── AI read — technicals + news synthesised by OpenRouter,
                  appended below the deterministic rows. The raw headline list
                  that used to sit here was removed: this read already covers the
                  news, and the full list lives in the News card further down. AI
                  output is rendered as PLAIN TEXT (never dangerouslySetInnerHTML)
                  since it's model-generated / untrusted. ── */}
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-soft)" }}>
                <div style={{ fontSize: ".66rem", fontWeight: 700, color: "var(--ai)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span>◆ AI Read</span>
                  {aiAnalysis?.ok && (
                    <span className="pill" style={{ fontSize: ".54rem", background: "var(--surface-3)", color: "var(--text-dim-solid)", textTransform: "none", letterSpacing: 0 }}>
                      {aiAnalysis.model}{aiAnalysis.usedWebSearch ? " · web" : ""}
                    </span>
                  )}
                </div>
                {aiLoading && <DataState loading label="Generating AI analysis…" />}
                {!aiLoading && (!!aiError || aiAnalysis?.ok === false) && (
                  <div style={{ fontSize: ".76rem", color: "var(--text-dim-solid)", padding: "2px 0" }}>AI analysis unavailable right now.</div>
                )}
                {!aiLoading && aiAnalysis?.ok && aiAnalysis.analysis && (() => {
                  const a = aiAnalysis.analysis!;
                  return (
                    <>
                      {a.headline && <div style={{ fontSize: ".82rem", fontWeight: 600, color: "var(--text-hi)", marginBottom: 8 }}>{a.headline}</div>}
                      {a.volatility && (
                        <div className="ai-line"><span className="k">Volatility</span><span className="v"><b style={{ color: "var(--text-hi)", textTransform: "capitalize" }}>{a.volatility.flag}</b> — {a.volatility.note}</span></div>
                      )}
                      {a.momentum && (
                        <div className="ai-line"><span className="k">Momentum</span><span className="v"><b style={{ color: "var(--text-hi)", textTransform: "capitalize" }}>{a.momentum.state}</b> — {a.momentum.note}</span></div>
                      )}
                      {a.newsSummary && (
                        <div className="ai-line"><span className="k">News</span><span className="v">{a.newsSummary}</span></div>
                      )}
                      {a.technicalSummary && (
                        <div className="ai-line"><span className="k">Setup</span><span className="v">{a.technicalSummary}</span></div>
                      )}
                      <div style={{ marginTop: 8, fontSize: ".64rem", color: "var(--text-dim-solid)" }}>
                        AI-generated · informational only, not investment advice.
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Financials — grouped bar chart */}
          {(() => {
            const inc     = incRowsFromFinancials(finPeriod, financialsDoc, () => []);
            const epsSales = epsSalesSeries(finPeriod, financialsDoc);
            const histEps = hist10.slice(0, 10);
            const beatsOf = histEps.filter(h => h.surp >= 0).length;
            const latestA = histEps[0]?.a ?? 0;
            const prevA   = histEps[4]?.a;
            // Suppress a YoY built on a ~0 base (spin-off / first period), which
            // otherwise prints an absurd four-digit percentage.
            const yoyRaw  = prevA != null && Math.abs(prevA) >= 0.05 ? ((latestA - prevA) / Math.abs(prevA)) * 100 : null;
            const yoy     = yoyRaw != null && Math.abs(yoyRaw) <= 1000 ? yoyRaw : null;
            return (
              <div className="card">
                <div className="card-h">
                  <h3>Financials</h3>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <VendorTag v={["fmp", "polygon"]} />
                    {financialsDoc && (
                      <span className="pill" style={{ background: "var(--surface-3)", color: "var(--up)", fontSize: ".62rem" }}>live · FMP</span>
                    )}
                    <div className="tf-pills">
                      <button
                        className={`rng${finPeriod === "Q" ? " on" : ""}`}
                        onClick={() => setFinPeriod("Q")}
                      >Quarterly</button>
                      <button
                        className={`rng${finPeriod === "A" ? " on" : ""}`}
                        onClick={() => setFinPeriod("A")}
                      >Annual</button>
                    </div>
                    <span className="link" onClick={() => setInnerDrawer("financials")}>View all →</span>
                    <ExpandBtn title={`${sym} · Financials (${finPeriod === "Q" ? "Quarterly" : "Annual"})`} node={<EarnIncChart inc={inc} />} />
                  </div>
                </div>
                <div className="card-b" style={{ paddingTop: 8 }}>
                  {epsSales.length > 0 && (
                    <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: "1px solid var(--border-soft)" }}>
                      <EpsSalesBars data={epsSales} />
                      <div style={{ fontSize: ".68rem", color: "var(--text-dim-solid)", marginTop: 2 }}>
                        {finPeriod === "Q" ? "Reported quarters" : "Reported fiscal years"} · actuals only
                      </div>
                    </div>
                  )}
                  {inc.length === 0 ? (
                    <DataState loading={financialsLoading} label={
                      // Not "not synced yet" — for a foreign private issuer filing
                      // 20-F/6-K there is no SEC quarterly series to sync and there
                      // never will be. Saying "yet" sent people looking for a sync bug.
                      financialsDoc && (financialsDoc.epsHistory?.length ?? 0) > 0
                        ? `No ${finPeriod === "Q" ? "quarterly" : "annual"} income statement is published for ${sym} — reported EPS is shown above where available.`
                        : `No ${finPeriod === "Q" ? "quarterly" : "annual"} financials on file for ${sym}.`
                    } />
                  ) : (
                    <>
                      <div className="ec-legend">
                        <span><i style={{ background: INC_COLORS.rev }} />Revenue</span>
                        <span><i style={{ background: INC_COLORS.gp }} />Gross profit</span>
                        <span><i style={{ background: INC_COLORS.ni }} />Net income</span>
                      </div>
                      <EarnIncChart inc={inc} />
                      <div style={{ fontSize: ".68rem", color: "var(--text-dim-solid)", marginTop: 6 }}>
                        {finPeriod === "Q"
                          ? "Last 10 quarters · revenue, gross profit & net income"
                          : "Last 10 fiscal years · revenue, gross profit & net income"}
                        {" · tap "}&#8220;View all&#8221; for the full statement.
                      </div>
                    </>
                  )}

                  <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--border-soft)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <div style={{ fontSize: ".78rem", fontWeight: 700, color: "var(--text-hi)" }}>Earnings Growth (EPS)</div>
                      {histEps.length > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span className="ec-legend" style={{ margin: 0 }}>
                            <span><i style={{ background: "var(--up)" }} />Beat</span>
                            <span><i style={{ background: "var(--down)" }} />Miss</span>
                            <span><i className="ln" style={{ background: "var(--brand-2)" }} />Trend</span>
                          </span>
                          <ExpandBtn title={`${sym} · Earnings Growth (EPS)`} node={<EarningsGrowthChart hist={histEps} />} />
                        </div>
                      )}
                    </div>
                    {histEps.length === 0 ? (
                      <DataState loading={earningsLoading} label={`No live earnings history synced for ${sym} yet.`} />
                    ) : (
                      <>
                        <EarningsGrowthChart hist={histEps} />
                        <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
                          <div style={{ fontSize: ".7rem", color: "var(--text-dim-solid)" }}>
                            <b style={{ color: "var(--text-hi)" }}>{beatsOf}/{histEps.length}</b> beats
                          </div>
                          <div style={{ fontSize: ".7rem", color: "var(--text-dim-solid)" }}>
                            Latest qtr EPS <b style={{ color: "var(--text-hi)" }}>${latestA.toFixed(2)}</b>
                          </div>
                          {yoy !== null && (
                            <div style={{ fontSize: ".7rem" }}>
                              YoY <b style={{ color: yoy >= 0 ? "var(--up)" : "var(--down)" }}>{yoy >= 0 ? "+" : ""}{yoy.toFixed(1)}%</b>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Earnings Playbook — how the stock trades when it reports.
                      Derived from the live earnings feed (report dates + EPS)
                      and the Polygon daily bars already fetched here. */}
                  <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--border-soft)" }}>
                    <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                      <div style={{ fontSize: ".78rem", fontWeight: 700, color: "var(--text-hi)" }}>Earnings Playbook</div>
                      <div style={{ fontSize: ".7rem", color: "var(--text-dim-solid)" }}>how {sym} trades when it reports</div>
                    </div>
                    <EarningsPlaybook
                      sym={sym}
                      reports={playbookReports(financialsDoc)}
                    />
                  </div>
                </div>
              </div>
            );
          })()}

        </div>

        {/* RIGHT COLUMN — pinned to the LEFT column's height (rightColH) with
            overflow hidden, so Peers flex-fills/scrolls and Key levels sits at
            the base, level with Financials' bottom. Falls back to natural height
            (undefined) when stacked on narrow screens. */}
        <div className="sd-rail" style={{ height: rightColH, minHeight: 0, overflow: rightColH ? "auto" : undefined }}>

          {/* Technical Rating */}
          <div className="card sd-rail-full">
            <div className="card-h">
              <h3>Technical Rating</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <VendorTag v={["fmp", "polygon"]} />
                <span className="link" onClick={() => setInnerDrawer("techrating")}>View all →</span>
              </div>
            </div>
            <div className="card-b">
              <div className="trgroup" style={{ borderColor: "var(--ai-dim)", marginBottom: 10 }}>
                <div className="gl ai-c">Summary · {ratingBasis}</div>
                <TrGauge val={gv} label={rating} />
                {techRating && <RatingTally t={techRating.all} />}
              </div>
              {consensusDoc && (
                <div className="trgroup" style={{ marginBottom: 12 }}>
                  <div className="gl">Analyst Consensus</div>
                  <div className="rate" style={{ color: consensusTone(consensusDoc.consensus) }}>{consensusDoc.consensus}</div>
                  <div className="counts">
                    <span style={{ color: "var(--down)" }}>Sell<b>{consensusDoc.sell + consensusDoc.strongSell}</b></span>
                    <span style={{ color: "var(--text-dim-solid)" }}>Hold<b>{consensusDoc.hold}</b></span>
                    <span style={{ color: "var(--up)" }}>Buy<b>{consensusDoc.strongBuy + consensusDoc.buy}</b></span>
                  </div>
                  {consensusDoc.priceTargetConsensus != null && (
                    <div className="counts" style={{ marginTop: 8, borderTop: "1px solid var(--border-soft)", paddingTop: 8 }}>
                      <span style={{ color: "var(--text-dim-solid)" }}>Target<b style={{ color: "var(--text-hi)" }}>${consensusDoc.priceTargetConsensus.toFixed(0)}</b></span>
                      {dispPrice != null && dispPrice > 0 && (
                        <span style={{ color: consensusDoc.priceTargetConsensus >= dispPrice ? "var(--up)" : "var(--down)" }}>
                          Upside<b>{consensusDoc.priceTargetConsensus >= dispPrice ? "+" : ""}{(((consensusDoc.priceTargetConsensus - dispPrice) / dispPrice) * 100).toFixed(1)}%</b>
                        </span>
                      )}
                      {consensusDoc.priceTargetLow != null && consensusDoc.priceTargetHigh != null && (
                        <span style={{ color: "var(--text-dim-solid)" }}>Range<b>${consensusDoc.priceTargetLow.toFixed(0)}–${consensusDoc.priceTargetHigh.toFixed(0)}</b></span>
                      )}
                      {consensusDoc.ptAvgLastYear != null && (
                        <span style={{ color: "var(--text-dim-solid)" }}>1Y Avg<b>${consensusDoc.ptAvgLastYear.toFixed(0)}</b></span>
                      )}
                    </div>
                  )}
                </div>
              )}
              {consensusDoc?.recentGrades && consensusDoc.recentGrades.length > 0 && (
                <div className="trgroup" style={{ marginBottom: 12, textAlign: "left" }}>
                  <div className="gl">Recent analyst actions</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 6 }}>
                    {consensusDoc.recentGrades.slice(0, 6).map((g, i) => {
                      const a = (g.action ?? "").toLowerCase();
                      const col = a.includes("upgrade") ? "var(--up)" : a.includes("downgrade") ? "var(--down)" : "var(--text-dim-solid)";
                      return (
                        // 4 columns on a shared grid template, so action / firm /
                        // grade / target line up across every row (the parent
                        // .trgroup centres text — overridden to left here). The
                        // target is THIS firm's own, not the ticker consensus,
                        // and is right-aligned with tabular figures so the
                        // amounts read as a column.
                        <div key={i} style={{ display: "grid", gridTemplateColumns: "60px minmax(0, 1fr) minmax(0, 1.15fr) 46px", alignItems: "center", gap: 8, fontSize: ".72rem", textAlign: "left" }}>
                          <span style={{ color: col, fontWeight: 700, textTransform: "capitalize" }}>{g.action ?? "—"}</span>
                          <span style={{ color: "var(--text-hi)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.firm ?? "—"}</span>
                          <span style={{ color: "var(--text-dim-solid)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {(g.previousGrade || g.newGrade) ? `${g.previousGrade ?? "—"} → ${g.newGrade ?? "—"}` : ""}
                          </span>
                          <span
                            title={g.priceTarget != null ? `${g.firm ?? "This firm"}'s price target` : "No price target posted with this action"}
                            style={{ color: g.priceTarget != null ? "var(--text-hi)" : "var(--text-dim-solid)", fontFamily: "var(--f-mono)", fontWeight: 600, textAlign: "right", fontVariantNumeric: "tabular-nums" }}
                          >
                            {g.priceTarget != null ? `$${Math.round(g.priceTarget)}` : "—"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <table className="ind-tbl" style={{ marginTop: 12 }}>
                <tbody>
                  {indRows.map(r => (
                    <tr key={r[0]}>
                      <td>
                        {r[0]}
                        {/* RSI(14) history is already computed nightly and shipped
                            on the company doc; it was unused. Drawn inline on a
                            fixed 0-100 scale with the 30/70 bands marked, so the
                            number reads in context instead of as a bare value. */}
                        {r[0] === "RSI (14)" && rsiSeries && rsiSeries.length > 1 && (() => {
                          const pts = rsiSeries.slice(-40);
                          const W = 62, H = 16;
                          const d = pts
                            .map((v, i) => `${(i / (pts.length - 1)) * W},${H - (Math.min(100, Math.max(0, v)) / 100) * H}`)
                            .join(" ");
                          return (
                            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ marginLeft: 8, verticalAlign: "middle", overflow: "visible" }} aria-hidden="true">
                              <line x1="0" y1={H - 0.7 * H} x2={W} y2={H - 0.7 * H} stroke="var(--border-soft)" strokeWidth="1" />
                              <line x1="0" y1={H - 0.3 * H} x2={W} y2={H - 0.3 * H} stroke="var(--border-soft)" strokeWidth="1" />
                              <polyline points={d} fill="none" stroke="var(--ai)" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
                            </svg>
                          );
                        })()}
                      </td>
                      <td className="v">{r[1] ?? <NotAvailable />}</td>
                      <td className="a" style={{ color: ac(r[2]) }}>{r[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ fontSize: ".66rem", color: "var(--text-dim-solid)", marginTop: 8 }}>
                RSI/MACD/Stoch %K/ADX from technical-indicators.job · RSI sparkline is the last 40 sessions on a 0-100 scale with the 30/70 bands marked · EMA/SMA computed from a year of daily bars. Indicators only — not investment advice.
              </div>
            </div>
          </div>

          {/* Peers — flex-grows to fill the RIGHT column (the prominent card
              here); a long list scrolls inside it. minHeight:0 lets it shrink
              within the pinned column so Key levels below stays visible. */}
          <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div className="card-h">
              <h3>Peers</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {peersTotal > 1 && (
                  <button
                    onClick={() => setPeerSort(s => (s === "desc" ? "asc" : "desc"))}
                    title={`Sort by % change — ${peerSort === "desc" ? "highest first" : "lowest first"}`}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      fontSize: ".62rem", fontWeight: 700, letterSpacing: ".02em",
                      color: "var(--text-dim-solid)", background: "var(--surface-3)",
                      border: "1px solid var(--border-soft)", borderRadius: 6,
                      padding: "3px 7px", cursor: "pointer",
                    }}
                  >
                    % <span style={{ color: "var(--brand-2)" }}>{peerSort === "desc" ? "▼" : "▲"}</span>
                  </button>
                )}
                <VendorTag v={["fmp", "polygon"]} />
                {peersTotal > peers.length && <span className="link" onClick={() => setInnerDrawer("peers")}>View all →</span>}
              </div>
            </div>
            <div className="card-b" style={{ paddingTop: 6, flex: 1, minHeight: 0, overflowY: "auto" }}>
              {sortedPeers.length ? sortedPeers.map(peer => {
                const tag = peer.c === pmx ? "Leader" : peer.c === pmn ? "Laggard" : "";
                return (
                  <div key={peer.t} className="minirow"
                    style={{ cursor: "pointer" }} onClick={() => openStock(peer.t)}>
                    <StockLogo sym={peer.t} size={22} />
                    <span className="tkr">{peer.t}</span>
                    <span className="mid">
                      {tag && <span className={`pill ${tag === "Leader" ? "up" : "dn"}`}>{tag}</span>}
                      {peer.rsRating != null && (
                        <span className="pill" style={{ background: "var(--surface-3)", color: "var(--text-dim-solid)", marginLeft: 4, fontSize: ".62rem" }}>RS {peer.rsRating}</span>
                      )}
                    </span>
                    <span className={`r ${cls(peer.c)}`}>{sign(peer.c)}</span>
                  </div>
                );
              }) : <DataState loading={companiesLoading} label="No live peers found in this sector yet." />}
            </div>
          </div>

          {/* Key levels (pivots) — content-sized, sits at the base of the RIGHT
              column below the flex-grown Peers. */}
          <div className="card">
            <div className="card-h">
              <h3>Key levels (pivots)</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <VendorTag v={["fmp", "polygon"]} />
                <span className="link" onClick={() => setInnerDrawer("keylevels")}>View all →</span>
              </div>
            </div>
            <div className="card-b" style={{ paddingTop: 6 }}>
              <div style={{ fontSize: ".72rem", fontWeight: 700, color: "var(--text-dim-solid)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>
                Weekly pivots
              </div>
              {(["R2", "R1", "Pivot", "S1", "S2"] as const).map(label => {
                const wk = klWeekly;
                const v = wk ? ({ R2: wk.r2, R1: wk.r1, Pivot: wk.pivot, S1: wk.s1, S2: wk.s2 } as Record<string, number | null>)[label] : null;
                const tone = label.startsWith("R") ? "var(--down)" : label.startsWith("S") ? "var(--up)" : "var(--text-hi)";
                return (
                  <div key={label} className="minirow">
                    <span className="tkr" style={{ width: 50, color: tone }}>{label}</span>
                    <span className="mid" />
                    <span className="r mono">{v != null ? `$${v.toFixed(2)}` : <NotAvailable />}</span>
                  </div>
                );
              })}
              <div style={{ height: 1, background: "var(--border-soft)", margin: "12px 0 8px" }} />
              <div style={{ fontSize: ".72rem", fontWeight: 700, color: "var(--text-dim-solid)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>
                Moving averages &amp; range
              </div>
              {hi == null && lo == null && ema50 == null && sma200 == null ? (
                <DataState loading={liveCompanyLoading || yearBarsLoading} label="No historical price data synced for this ticker yet." />
              ) : (
                ([
                  ["52W High", hi,     isUp ? "up"   : "dim"],
                  ["EMA 50",   ema50,  ema50 == null || sigPx == null ? "dim" : sigPx > ema50 ? "up" : "down"],
                  ["SMA 200",  sma200, sma200 == null || sigPx == null ? "dim" : sigPx > sma200 ? "up" : "down"],
                  ["52W Low",  lo,     isUp ? "dim"  : "down"],
                ] as [string, number | null, string][]).map(x => (
                  <div key={x[0]} className="minirow">
                    <span className="tkr" style={{ width: 70 }}>{x[0]}</span>
                    <span className="mid" />
                    <span className="r mono" style={{ color: x[2] === "dim" ? "var(--text-hi)" : `var(--${x[2]})` }}>
                      {x[1] != null ? `$${nf(x[1])}` : <NotAvailable />}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Dividend & split history + Insider & institutional — full-width row
            BELOW the two-column section, so the left column ends at Financials
            and Key levels (base of the right column) aligns with Financials'
            bottom border. Side-by-side pair, each with its own scroll. */}
        <div className="sd-rowflex">
          {(() => {
            const dh = dividendHistory;
            const hasReal = divMetrics.isPayer;
            const yieldPct = divMetrics.forwardYieldPct ?? (hasReal ? dh?.yieldPct : null);
            const annualDiv = divMetrics.trailingPerShare ?? (hasReal ? (dh?.ttmTotal ?? 0) : 0);
            const payoutRatio = eps != null && eps > 0 && yieldPct != null && yieldPct > 0
              ? Math.min(99, Math.round((annualDiv / eps) * 100)) : null;
            const growthLabel = hasReal && dh?.cagr5yPct != null
              ? `${dh.cagr5yPct >= 0 ? "+" : ""}${dh.cagr5yPct.toFixed(1)}% / yr`
              : null;
            const streakLabel = hasReal && dh && dh.increaseStreakYears > 0 ? ` · ${dh.increaseStreakYears}-yr streak` : "";
            const divRows = hasReal && dh
              ? dh.history.slice(0, 5).map(h => ({
                  label: h.exDividendDate ?? "—",
                  perShare: h.amount,
                  note: h.exDividendDate ? `ex ${h.exDividendDate.slice(5)}` : "",
                }))
              : [];
            return (
              <div className="card" style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                <div className="card-h">
                  <h3>Dividend &amp; split history</h3>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <VendorTag v={["fmp", "polygon"]} />
                    {hasReal ? (<>
                      {divMetrics.forwardYieldPct != null && <span className="pill up">{divMetrics.forwardYieldPct.toFixed(2)}% fwd</span>}
                      {divMetrics.trailingYieldPct != null && <span className="pill" style={{ background: "var(--surface-3)", color: "var(--text-hi)", fontSize: ".65rem" }}>{divMetrics.trailingYieldPct.toFixed(2)}% trailing</span>}
                    </>) : (
                      <span className="pill" style={{ background: "var(--surface-3)", color: "var(--text-dim-solid)" }}>None</span>
                    )}
                    {hasReal && <span className="pill" style={{ background: "var(--surface-3)", color: "var(--up)", fontSize: ".62rem" }}>live · FMP</span>}
                    <span className="link" onClick={() => setInnerDrawer("dividend")}>View all →</span>
                  </div>
                </div>
                <div className="card-b" style={{ paddingTop: 6, flex: 1, minHeight: 0, overflowY: "auto" }}>
                  {!dh ? (
                    <DataState loading={dividendLoading} label={`Dividend data not synced for ${sym} yet.`} />
                  ) : !hasReal ? (
                    <div style={{ fontSize: ".8rem", color: "var(--text-dim-solid)", padding: "8px 0" }}>{sym} does not currently pay a dividend.</div>
                  ) : (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                        <div>
                          <div style={{ fontSize: ".66rem", color: "var(--text-dim-solid)", marginBottom: 4 }}>5-yr dividend growth</div>
                          <div style={{ fontSize: ".78rem", color: "var(--text-hi)" }}>
                            {growthLabel ?? "—"}{payoutRatio != null ? ` · payout ${payoutRatio}%` : ""}{streakLabel}
                          </div>
                        </div>
                      </div>
                      {divRows.map(q => (
                        <div key={q.label} className="minirow">
                          <span className="tkr" style={{ width: 82, flexShrink: 0, whiteSpace: "nowrap" }}>{q.label}</span>
                          <span className="mid mono">{q.perShare != null ? `$${q.perShare.toFixed(4)}/sh` : "—"}</span>
                          <span className="r" style={{ color: "var(--text-dim-solid)", fontSize: ".72rem" }}>{q.note}</span>
                        </div>
                      ))}
                      <div className="minirow" style={{ marginTop: 8, borderTop: "1px solid var(--border-soft)", paddingTop: 6 }}>
                        <span className="mid">Forward run-rate</span>
                        <span className="r" style={{ color: "var(--text-hi)" }}>${divMetrics.forwardPerShare != null ? divMetrics.forwardPerShare.toFixed(2) : annualDiv.toFixed(2)}/sh</span>
                      </div>
                      <div className="minirow" style={{ paddingTop: 4 }}>
                        <span className="mid">Trailing ({dh.ttmPayments ?? 4} payments)</span>
                        <span className="r" style={{ color: "var(--text-dim-solid)" }}>${annualDiv.toFixed(2)}/sh</span>
                      </div>
                    </>
                  )}

                  <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--border-soft)" }}>
                    <div style={{ fontSize: ".66rem", fontWeight: 700, color: "var(--text-dim-solid)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>
                      Stock splits
                    </div>
                    {splitsDoc && splitsDoc.splits.length > 0 ? splitsDoc.splits.slice(0, 3).map(s => (
                      <div key={s.executionDate} className="minirow">
                        <span className="mid">{s.executionDate}</span>
                        <span className="r" style={{ color: "var(--text-hi)" }}>{s.splitFrom}:{s.splitTo}</span>
                      </div>
                    )) : (
                      <div style={{ fontSize: ".72rem", color: "var(--text-dim-solid)" }}>No splits on record.</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Insider & institutional — right half of the side-by-side pair; own scroll. */}
          <div className="card" style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            <div className="card-h">
              <h3>Insider &amp; institutional</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <VendorTag v={insiderVendor} />
                <span className="link" onClick={() => setInnerDrawer("insider")}>View all →</span>
              </div>
            </div>
            <div className="card-b" style={{ paddingTop: 6, flex: 1, minHeight: 0, overflowY: "auto" }}>
              <div style={{ fontSize: ".72rem", fontWeight: 700, color: "var(--text-dim-solid)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>
                Recent insider transactions
              </div>
              {data.insiderActivity.length > 0 ? (
                data.insiderActivity.slice(0, 8).map((n, idx) => {
                  const isSell = n.isSell;
                  return (
                    <div key={idx} className="minirow" style={{ cursor: "pointer", alignItems: "flex-start", gap: 10 }}>
                      <span className="tkr" style={{ flex: "none" }}>{sym}</span>
                      <span className="mid" style={{ whiteSpace: "normal", lineHeight: 1.45 }}>
                        {n.name} {n.action} <span style={{ color: "var(--text-dim-solid)" }}>({n.date})</span>
                      </span>
                      <span className={`r ${isSell ? "down" : "up"}`} style={{ flex: "none" }}>
                        {n.valueUsd != null ? `${isSell ? "−" : "+"}$${(n.valueUsd / 1e6).toFixed(1)}M` : <NotAvailable />}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div style={{ fontSize: ".8rem", color: "var(--text-dim-solid)", padding: "4px 0 8px" }}>
                  No recent Form 4 activity.
                </div>
              )}
              <div style={{ height: 1, background: "var(--border-soft)", margin: "12px 0 8px" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: ".72rem", fontWeight: 700, color: "var(--text-dim-solid)", textTransform: "uppercase", letterSpacing: ".05em" }}>
                  Institutional
                </span>
                <VendorTag v={["fmp", "polygon"]} />
              </div>
              {(() => {
                const io = instPct;
                const holders = instHolders;
                const chg = instHoldersChg;
                const rows: [string, ReactNode][] = [
                  ["Inst. ownership", io != null ? `${io.toFixed(1)}%` : null],
                  // FMP has no short-interest feed; FINRA data via Polygon.
                  ["Short interest", shortInt ? (
                    <span title={`FINRA settlement ${shortInt.settlementDate}`}>
                      {compactNum(shortInt.shortInterest)} sh
                      {shortInt.daysToCover != null && (
                        <span style={{ marginLeft: 6, fontSize: ".7rem", color: "var(--text-dim-solid)" }}>{shortInt.daysToCover.toFixed(1)}d</span>
                      )}
                    </span>
                  ) : null],
                  // "filers", NOT "funds": FMP's investorsHolding counts 13F
                  // FILERS, and one filer (BlackRock Inc.) files a single report
                  // covering hundreds of individual funds. Labelling it "funds"
                  // invited comparison with fund-count screens that report ~10.9K
                  // for MSFT where we report ~6.4K — different populations.
                  ["13F filers holding", holders != null ? (
                    <>
                      {holders.toLocaleString()}
                      {chg != null && chg !== 0 && (
                        <span className={chg > 0 ? "up" : "down"} style={{ marginLeft: 6, fontSize: ".7rem" }}>
                          {chg > 0 ? "+" : ""}{chg} QoQ
                        </span>
                      )}
                    </>
                  ) : null],
                ];
                return rows.map(([label, val]) => (
                  <div key={label} className="minirow">
                    <span className="mid">{label}</span>
                    <span className="r">{val ?? <NotAvailable />}</span>
                  </div>
                ));
              })()}
              {instAsOf && (
                <div style={{ fontSize: ".64rem", color: "var(--text-dim-solid)", marginTop: 6 }}>
                  13F rollup · {instAsOf}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Industry Group rank + Earnings history — full-width row, 50/50, equal
            height (grid align-items: stretch + flex-column cards). */}
        <div className="sd-row2">
          {/* Industry Group rank */}
          <div className="card" style={{ display: "flex", flexDirection: "column" }}>
            <div className="card-h">
              <h3>Industry Group rank</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <VendorTag v={["fmp", "polygon"]} />
                <span className="link" onClick={() => setInnerDrawer("industry")}>View all →</span>
              </div>
            </div>
            <div className="card-b" style={{ flex: 1 }}>
              {topSectors.length === 0 ? (
                <DataState loading={sectorsLoading} label="No live sector performance data yet." />
              ) : (
                <>
                  {topSectors.map((s, i) => (
                    <div key={s.sector} className="grouprow" style={s.sector === group ? { color: "var(--brand-2)" } : undefined}>
                      <span className="rk">{i + 1}</span>
                      <span className="gn">{s.sector}</span>
                      <div className="bar"><i style={{ width: Math.max(8, (s.pctChange - pmnSector) / (pmxSector - pmnSector || 1) * 100) + "%" }} /></div>
                      <span className="mono" style={{ fontSize: ".72rem", color: "var(--text-dim-solid)" }}>{sign(s.pctChange)}</span>
                    </div>
                  ))}
                  <div style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", marginTop: 8 }}>
                    {group ? <>{group} ranks <b style={{ color: grank <= 10 ? "var(--up)" : "var(--text-hi)" }}>#{grank || "—"} of {rankedSectors.length}</b> sectors by today&apos;s performance.</>
                      : "This ticker has no sector on record."}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Earnings history */}
          <div className="card" style={{ display: "flex", flexDirection: "column" }}>
            <div className="card-h">
              <h3>Earnings history</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <VendorTag v={["fmp", "polygon"]} />
                {hist10.length > 0 && (
                  <span className={`pill ${beatStreak >= 0 ? "up" : "dn"}`}>{Math.abs(beatStreak)}-qtr {beatStreak >= 0 ? "beat" : "miss"} streak</span>
                )}
                <span className="link" onClick={() => setInnerDrawer("earnings")}>View all →</span>
              </div>
            </div>
            <div className="card-b" style={{ paddingTop: 6, flex: 1, display: "flex", flexDirection: "column" }}>
              {hist10.length === 0 ? (
                <DataState loading={earningsLoading} label={`No live earnings-estimate history synced for ${sym} yet.`} height="100%" />
              ) : (
                <>
                  <div style={{ fontSize: ".66rem", color: "var(--text-dim-solid)", marginBottom: 8 }}>Next report: {erDate}</div>
                  {hist10.slice(0, 5).map(q => (
                    <div key={q.q} className="minirow">
                      <span className="tkr" style={{ width: 60 }} title={q.label}>{q.q}</span>
                      <span className="mid mono" title={`EPS (GAAP diluted)${q.e !== 0 ? `; ${ADJUSTED_SURPRISE_LABEL}: adj. $${fmt(q.a, 2)} vs est. $${fmt(q.e, 2)}` : ""}`}>
                        {q.gaap != null ? `$${fmt(q.gaap, 2)} GAAP` : "—"}
                      </span>
                      {q.surpStr && q.surpStr !== "—"
                        ? <span className={`r ${q.surp >= 0 ? "up" : "down"}`}>{q.surpStr.includes("vs est") ? q.surpStr : `${q.surp >= 0 ? "beat" : "miss"} ${q.surpStr}`}</span>
                        : (q.e !== 0
                          ? <span className={`r ${q.surp >= 0 ? "up" : "down"}`}>{q.surp >= 0 ? "beat" : "miss"} {Math.abs(q.surp)}%</span>
                          : <span className="r" style={{ color: "var(--text-dim-solid)" }}>—</span>)}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>

        {/* News — last card, alone in its row: span both grid columns so it
            fills the full width instead of leaving the 400px right column
            empty beside it. */}
        <div className="card" style={{ gridColumn: "1 / -1" }}>
          <div className="card-h">
            <h3>News</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <VendorTag v={["fmp", "polygon"]} />
              {tickerNews && tickerNews.length > 0 && (
                <span className="pill" style={{ background: "var(--surface-3)", color: "var(--up)", fontSize: ".62rem" }}>live</span>
              )}
            </div>
          </div>
          <div className="card-b" style={{ paddingTop: 6 }}>
            {tickerNews && tickerNews.length > 0 ? (
              tickerNews.slice(0, 6).map(n => (
                <a key={n.id} href={n.url} target="_blank" rel="noreferrer"
                  className="minirow" style={{ alignItems: "flex-start", gap: 10, textDecoration: "none", cursor: "pointer" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: ".8rem", color: "var(--text)" }}>{n.headline}</div>
                    <div style={{ fontSize: ".68rem", color: "var(--text-dim-solid)", marginTop: 3, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span>{n.source} · {new Date(n.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })}</span>
                      {n.vendor && <span className="pill" style={{ fontSize: ".54rem", background: "var(--surface-3)", textTransform: "uppercase", letterSpacing: ".03em" }}>{n.vendor}</span>}
                      {n.sentiment && <span className="pill" style={{ fontSize: ".54rem", textTransform: "capitalize", background: "var(--surface-3)", color: n.sentiment === "positive" ? "var(--up)" : n.sentiment === "negative" ? "var(--down)" : "var(--text-dim-solid)" }}>{n.sentiment}</span>}
                    </div>
                  </div>
                </a>
              ))
            ) : (
              <div style={{ fontSize: ".8rem", color: "var(--text-dim-solid)", padding: "4px 0" }}>
                No recent news synced for {sym} yet.
              </div>
            )}
          </div>
        </div>
      </>)}

      {/* ══════════════ TABBED FULL VIEW ══════════════
          Overview / Analysis / Earnings / Financials / Holdings / News. Each
          card below is the same markup as its flat-mode counterpart above
          (same data, same "View all" drawers) — just regrouped per the
          reorganized layout, with a couple of cards split into two (Technical
          Rating vs. Indicators vs. Recent analyst actions; Financials vs.
          Earnings Growth/Playbook; Dividend history vs. Stock splits) to match
          how the tabs divide the data. */}
      {!hideHeader && (<>
        <div ref={leftColRef} style={{ display: "flex", flexDirection: "column", gap: 14, alignSelf: "start", gridColumn: showRail ? undefined : "1 / -1" }}>

          {activeTab === "overview" && (() => {
            // Two label/value columns, one stat per row (quote-page style)
            // instead of a 4-wide tile grid — each label sits on the same line
            // as its value, so the card scans top to bottom.
            // The latest session's daily bar gives Open / Day's range / Volume;
            // the bar before it gives Previous close.
            // Live quote first (current session, consistent with the price);
            // the stored bars only when the quote lacks the session fields —
            // and only a bar dated for this session counts as it (see
            // lastBarIsSession). Otherwise the last bar IS the previous close.
            const lastBar = lastBarIsSession ? lastYrBar : null;
            const prevBar = lastBarIsSession ? (yr.length > 1 ? yr[yr.length - 2] : null) : lastYrBar;
            const dayBar = hasSessionQuote
              ? { o: sessOpen as number, h: sessHigh as number, l: sessLow as number }
              : lastBar;
            const prevClose = hasSessionQuote
              ? sessPrevClose
              : (prevBar?.c ?? companySummary?.prevClose ?? null);
            const px = (v: number) => "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const pct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
            // A non-payer's lone 1998 $0.001 record is history, not a current
            // ex-date: show one only if paid within 12 months or upcoming.
            const latestExDiv = (dividendHistory?.history ?? [])
              .map(h => h.exDividendDate)
              .filter((d): d is string => !!d)
              .sort()
              .pop() ?? null;
            const yearAgoIso = new Date(Date.parse(`${etTodayIso()}T00:00:00Z`) - 365 * 86_400_000).toISOString().slice(0, 10);
            const exDiv = latestExDiv && latestExDiv >= yearAgoIso ? latestExDiv : null;
            const target = consensusDoc?.priceTargetConsensus ?? null;
            const targetUp = target != null && dispPrice != null && dispPrice > 0 ? (target - dispPrice) / dispPrice * 100 : null;
            type Row = { k: string; v: ReactNode | null; delta?: { txt: string; up: boolean } | null };
            const left: Row[] = [
              { k: "Market cap",    v: mc != null ? cap(mc) : null },
              { k: "P/E ratio",     v: eps != null && eps <= 0 ? "n/a" : (data.peRatio != null ? data.peRatio.toFixed(2) : null) },
              { k: "EPS (TTM)",     v: eps != null ? "$" + eps.toFixed(2) : null },
              // Forward-annualized (latest declared rate × frequency ÷ price).
              { k: "Dividend (fwd)", v: divMetrics.isPayer
                  ? (divMetrics.forwardPerShare != null
                      ? `$${divMetrics.forwardPerShare.toFixed(2)}${divMetrics.forwardYieldPct != null ? ` (${divMetrics.forwardYieldPct.toFixed(2)}%)` : ""}`
                      : divMetrics.forwardYieldPct != null ? divMetrics.forwardYieldPct.toFixed(2) + "%" : null)
                  : "None" },
              { k: "Ex-dividend date", v: exDiv ? fmtDate(exDiv) : (divMetrics.isPayer ? null : "None") },
              { k: "Beta",          v: data.beta != null ? data.beta.toFixed(2) : ((keyStats as any)?.beta != null ? Number((keyStats as any).beta).toFixed(2) : ((liveCompany as any)?.beta != null ? Number((liveCompany as any).beta).toFixed(2) : null)) },
              { k: "Avg volume (20D)", v: avgVol20 != null ? Math.round(avgVol20).toLocaleString("en-US") : null },
              { k: "Sector",        v: data.sector ? titleCaseLabel(data.sector) : null },
              { k: "Industry",      v: data.industry ? titleCaseLabel(data.industry) : null },
              { k: "CEO",           v: liveCompany?.ceo ?? (keyStats as any)?.ceo ?? (data as any)?.ceo ?? null },
              { k: "Employees",     v: (liveCompany?.employees ?? (keyStats as any)?.employees ?? (data as any)?.employees) != null ? Number(liveCompany?.employees ?? (keyStats as any)?.employees ?? (data as any)?.employees).toLocaleString("en-US") : null },
              { k: "Listing date",  v: (() => {
                  // A vendor placeholder (GE: 1900-01-01) is no listing date.
                  const d = String(liveCompany?.listingDate ?? (keyStats as any)?.listingDate ?? (data as any)?.listingDate ?? (data as any)?.listDate ?? "").slice(0, 10);
                  return /^\d{4}-\d{2}-\d{2}$/.test(d) && d > "1900-12-31" ? fmtDate(d) : null;
                })() },
            ];
            const right: Row[] = [
              { k: "Volume",        v: sessionVol != null ? Math.round(sessionVol).toLocaleString("en-US") : null },
              { k: "Open",          v: dayBar ? px(dayBar.o) : null },
              { k: "Previous close", v: prevClose != null ? px(prevClose) : null },
              { k: "Day's range",   v: dayBar ? `${px(dayBar.l)} – ${px(dayBar.h)}` : null },
              { k: "52-week range", v: hi != null && lo != null ? `${px(lo)} – ${px(hi)}` : null },
              { k: "Off 52W high / low", v: offHigh52Shown != null || offLow52Shown != null
                  ? <><span className={offHigh52Shown != null && offHigh52Shown < 0 ? "down" : undefined}>{offHigh52Shown != null ? offHigh52Shown.toFixed(1) + "%" : "—"}</span>
                      {" / "}<span className="up">{offLow52Shown != null ? "+" + offLow52Shown.toFixed(1) + "%" : "—"}</span></>
                  : null },
              { k: "Analysts",      v: consensusDoc?.consensus
                  ? <span style={{ color: consensusTone(consensusDoc.consensus) }}>{consensusDoc.consensus}</span>
                  : null },
              { k: "Price target",  v: target != null ? px(target) : null,
                delta: targetUp != null ? { txt: pct(targetUp), up: targetUp >= 0 } : null },
              { k: "Earnings date", v: erDate !== "—" ? <>{fmtDate(erDate)}{!isErConfirmed && <span className="pill" style={{ marginLeft: 6, fontSize: ".65rem", padding: "1px 5px", background: "var(--surface-3)", color: "var(--text-dim-solid)" }}>Estimated</span>}</> : null },
            ];
            const col = (rows: Row[]) => (
              <dl className="sd-kv">
                {rows.map(r => (
                  <div key={r.k} className="sd-kv-row">
                    <dt>{r.k}</dt>
                    <dd>
                      {r.v ?? <NotAvailable />}
                      {r.v != null && r.delta && <span className={`sd-kv-delta ${r.delta.up ? "up" : "down"}`}>{r.delta.txt}</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            );
            return (
              <div className="card">
                <div className="card-h">
                  <h3>Key statistics</h3>
                  <VendorTag v={["fmp", "polygon"]} />
                </div>
                <div className="sd-kv-grid">
                  {col(left)}
                  {col(right)}
                </div>
              </div>
            );
          })()}

          {activeTab === "analysis" && (<>
            <div className="ai-block sd-ai">
              <div className="card-h">
                <h3 className="ai-c">◆ AI technical analysis</h3>
                <VendorTag v={["fmp", "polygon"]} />
              </div>
              <div className="card-b" style={{ maxHeight: "none" }}>
                {([
                  ["Trend",            trendTxt],
                  ["Support / Resist.", hi != null
                    ? (<>52-week high <b>${nf(hi)}</b>{lo != null ? <>; 52-week low <b>${nf(lo)}</b></> : null}.</>)
                    : "Support/resistance levels not available."],
                  ["MA posture",       maTxt],
                  ["Rel. strength",    rs != null
                    ? (<>Relative-strength rank <b className={rs >= 70 ? "up" : rs < 40 ? "down" : ""}>{rs}/99</b> vs the market — {rs >= 70 ? "group leader." : rs < 40 ? "lagging the tape." : "roughly in line."}</>)
                    : "Not ranked yet — this ticker isn't in the synced RS universe."],
                  ["Volume",           rv != null ? (<>Relative volume <b>{rv.toFixed(1)}×</b> — {rv > 2 ? "well above average (event-driven)." : "near normal."}</>) : "Relative volume not available."],
                  ["Event risk",       erDate !== "—" ? `Next earnings ${erDate}.` : "No upcoming earnings date on record."],
                ] as [string, ReactNode][]).map(l => (
                  <div key={l[0]} className="ai-line">
                    <span className="k">{l[0]}</span>
                    <span className="v">{l[1]}</span>
                  </div>
                ))}
              </div>
              <div className="sd-foot">
                Source: rs-rating.job, technical-indicators.job, a year of daily bars · informational only, not investment advice.
              </div>
            </div>

            <div className="ai-block sd-ai">
              <div className="card-h">
                <h3 className="ai-c">◆ AI Read</h3>
                {aiAnalysis?.ok && (
                  <span className="pill" style={{ fontSize: ".58rem", background: "var(--surface-3)", color: "var(--text-dim-solid)" }}>
                    {aiAnalysis.model}{aiAnalysis.usedWebSearch ? " · web" : ""}
                  </span>
                )}
              </div>
              <div className="card-b" style={{ maxHeight: "none" }}>
                <div>
                  {aiLoading && <DataState loading label="Generating AI analysis…" />}
                  {!aiLoading && (!!aiError || aiAnalysis?.ok === false) && (
                    <div style={{ fontSize: ".76rem", color: "var(--text-dim-solid)", padding: "2px 0" }}>AI analysis unavailable right now.</div>
                  )}
                  {!aiLoading && aiAnalysis?.ok && aiAnalysis.analysis && (() => {
                    const a = aiAnalysis.analysis!;
                    return (
                      <>
                        {a.headline && <div style={{ fontSize: ".86rem", fontWeight: 500, color: "var(--text-hi)", margin: "2px 0 8px" }}>{a.headline}</div>}
                        {a.volatility && (
                          <div className="ai-line"><span className="k">Volatility</span><span className="v"><b style={{ color: "var(--text-hi)", textTransform: "capitalize" }}>{a.volatility.flag}</b> — {a.volatility.note}</span></div>
                        )}
                        {a.momentum && (
                          <div className="ai-line"><span className="k">Momentum</span><span className="v"><b style={{ color: "var(--text-hi)", textTransform: "capitalize" }}>{a.momentum.state}</b> — {a.momentum.note}</span></div>
                        )}
                        {a.newsSummary && (
                          <div className="ai-line"><span className="k">News</span><span className="v">{a.newsSummary}</span></div>
                        )}
                        {a.technicalSummary && (
                          <div className="ai-line"><span className="k">Setup</span><span className="v">{a.technicalSummary}</span></div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
              {aiAnalysis?.ok && <div className="sd-foot">AI-generated · informational only, not investment advice.</div>}
            </div>

            <div className="card sd-card">
              <div className="card-h">
                <h3>Industry group rank</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <VendorTag v={["fmp", "polygon"]} />
                  <span className="link" onClick={() => setInnerDrawer("industry")}>View all →</span>
                </div>
              </div>
              {topSectors.length === 0 ? (
                <div className="card-b"><DataState loading={sectorsLoading} label="No live sector performance data yet." /></div>
              ) : (() => {
                const maxAbs = Math.max(0.01, ...topSectors.map(x => Math.abs(x.pctChange)));
                return (<>
                  {topSectors.map((x, i) => {
                    const mine = x.sector === group;
                    return (
                      <div key={x.sector} className={`sd-row${mine ? " mine" : ""}`}>
                        <span className="sd-dot">{i + 1}</span>
                        <span className="grow">
                          {x.sector}
                          {mine && <span className="pill" style={{ marginLeft: 6, background: "var(--brand-dim)", color: "var(--brand)" }}>{sym}</span>}
                        </span>
                        <span className="sd-bar-track">
                          <span className={`sd-bar${x.pctChange < 0 ? " neg" : ""}`} style={{ width: `${(Math.abs(x.pctChange) / maxAbs) * 100}%` }} />
                        </span>
                        <span className={`num ${x.pctChange >= 0 ? "up" : "down"}`} style={{ width: 56, textAlign: "right" }}>{sign(x.pctChange)}</span>
                      </div>
                    );
                  })}
                  <div className="sd-foot">
                    {group
                      ? <>{group} ranks <strong>#{grank || "—"} of {rankedSectors.length}</strong> sectors by today&apos;s performance.</>
                      : "This ticker has no sector on record."}
                  </div>
                </>);
              })()}
            </div>
          </>)}

          {activeTab === "earnings" && (() => {
            return (<>
              <StockEarningsEpsSales sym={sym} financialsDoc={financialsDoc} loading={earningsLoading || financialsLoading} />

              <EarningsPlaybookCards
                sym={sym}
                reports={playbookReports(financialsDoc)}
                onViewAll={() => setInnerDrawer("earnings")}
              />
            </>);
          })()}

          {activeTab === "financials" && (<>
            <SegToggle label="Period" value={finPeriod} onChange={setFinPeriod}
              options={[["Q", "Quarterly"], ["A", "Annual"]]} />
            {(() => {
              const isQ = finPeriod === "Q";
              const inc = incRowsFromFinancials(finPeriod, financialsDoc, () => []);
              // Oldest → newest, sales in $M.
              const series = epsSalesSeries(finPeriod, financialsDoc);
              const reported = series.filter(r => r.sales != null);
              const last = reported[reported.length - 1];
              // Next quarter's consensus sales, labelled by the quarter end that
              // follows the last reported one. Quarterly only — no annual feed.
              const est = isQ && last?.end && upcomingEr?.revenueEstimate != null && upcomingEr.date > last.end
                ? (() => {
                    const d = new Date(`${last.end}T00:00:00Z`);
                    const nextEnd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 4, 0)).toISOString().slice(0, 10);
                    return { label: fmtDate(nextEnd, { month: "short", year: "2-digit" }).replace(" ", "-"), v: (upcomingEr.revenueEstimate as number) / 1e9 };
                  })()
                : null;
              const back = isQ ? 4 : 1;
              const pctCell = (v: number | null) => v == null
                ? <span className="dim">—</span>
                : <span className={v < 0 ? "down" : "up"}>{v > 0 ? "+" : ""}{Math.round(v)}%</span>;
              const chgVs = (cur: number | null, prior: number | null | undefined) =>
                cur != null && prior != null && prior !== 0 ? ((cur - prior) / Math.abs(prior)) * 100 : null;
              const tbl = series.map((r, i) => ({
                ...r,
                chg: chgVs(r.sales, series[i - back]?.sales),
                surp: isQ ? salesSurpriseFor(r.end) : null,
              }));
              const estChg = est ? chgVs(est.v * 1e3, series[series.length - back]?.sales) : null;

              return (<>
                <div className="sd-two">
                  <div className="card sd-card">
                    <div className="card-h">
                      <h3>Sales<span className="sd-unit">$B</span></h3>
                      <VendorTag v={["fmp", "polygon"]} />
                    </div>
                    {reported.length > 0 ? (<>
                      <div className="sd-chart">
                        <SalesBars data={[
                          ...reported.map(r => ({ label: r.label, v: (r.sales as number) / 1e3 })),
                          ...(est ? [{ label: est.label, v: est.v, est: true }] : []),
                        ]} />
                      </div>
                      <div className="sd-foot">
                        <span className="sd-keys">
                          <span><i className="sd-key" />Reported</span>
                          {est && <span><i className="sd-key est" />Estimate</span>}
                        </span>
                      </div>
                    </>) : (
                      <div className="card-b">
                        <DataState loading={financialsLoading} label={`No reported ${isQ ? "quarterly" : "annual"} sales on file for ${sym}.`} />
                      </div>
                    )}
                  </div>

                  <div className="card sd-card">
                    <div className="card-h">
                      <h3>{isQ ? "Quarterly" : "Annual"} income<span className="sd-unit">$B</span></h3>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <VendorTag v={["fmp", "polygon"]} />
                        <span className="link" onClick={() => setInnerDrawer("financials")}>View all →</span>
                        <ExpandBtn title={`${sym} · Financials (${isQ ? "Quarterly" : "Annual"})`} node={<EarnIncChart inc={inc} />} />
                      </div>
                    </div>
                    {inc.length === 0 ? (
                      <div className="card-b">
                        <DataState loading={financialsLoading} label={
                          financialsDoc && (financialsDoc.epsHistory?.length ?? 0) > 0
                            ? `No ${isQ ? "quarterly" : "annual"} income statement is published for ${sym} — reported EPS is on the Earnings tab.`
                            : `No ${isQ ? "quarterly" : "annual"} financials on file for ${sym}.`
                        } />
                      </div>
                    ) : (<>
                      <div className="sd-chart"><EarnIncChart inc={inc} /></div>
                      <div className="sd-foot"><IncLegend /></div>
                    </>)}
                  </div>
                </div>

                <div className="sd-two" style={{ alignItems: "start" }}>
                  <div className="card">
                    {tbl.length === 0 ? (
                      <div className="card-b">
                        <DataState loading={financialsLoading} label={`No reported sales on file for ${sym}.`} />
                      </div>
                    ) : (
                      <div style={{ overflowX: "auto" }}>
                        <table className="sd-ftab">
                          <thead>
                            <tr>
                              <th>{isQ ? "Quarter" : "Fiscal year"}</th>
                              <th>Sales (B)</th>
                              <th>%Chg</th>
                              {isQ && <th>Surp</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {tbl.map((r, i) => (
                              <tr key={r.label} className={i === tbl.length - 1 ? "latest" : undefined}>
                                <td>{r.label}</td>
                                <td>{r.sales != null ? (r.sales / 1e3).toFixed(2) : <span className="dim">—</span>}</td>
                                <td>{pctCell(r.chg)}</td>
                                {isQ && <td>{pctCell(r.surp)}</td>}
                              </tr>
                            ))}
                            {est && (
                              <tr className="est">
                                <td>*{est.label}</td>
                                <td>{est.v.toFixed(2)}</td>
                                <td>{pctCell(estChg)}</td>
                                <td>•••</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {(() => {
                    const dh = dividendHistory;
                    const hasReal = divMetrics.isPayer;
                    const yieldPct = divMetrics.forwardYieldPct ?? (hasReal ? dh?.yieldPct : null);
                    const annualDiv = divMetrics.trailingPerShare ?? (hasReal ? (dh?.ttmTotal ?? 0) : 0);
                    const payoutRatio = eps != null && eps > 0 && yieldPct != null && yieldPct > 0
                      ? Math.min(99, Math.round((annualDiv / eps) * 100)) : null;
                    const cagr = hasReal && dh ? dh.cagr5yPct : null;
                    return (
                      <div className="card">
                        <div className="card-h">
                          <h3>Dividend history</h3>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <VendorTag v={["fmp", "polygon"]} />
                            {hasReal ? (<>
                              {divMetrics.forwardYieldPct != null && <span className="pill up">{divMetrics.forwardYieldPct.toFixed(2)}% fwd</span>}
                              {divMetrics.trailingYieldPct != null && <span className="pill" style={{ background: "var(--surface-3)", color: "var(--text-hi)", fontSize: ".65rem" }}>{divMetrics.trailingYieldPct.toFixed(2)}% trailing</span>}
                            </>) : (
                              <span className="pill" style={{ background: "var(--surface-3)", color: "var(--text-dim-solid)" }}>None</span>
                            )}
                            <span className="link" onClick={() => setInnerDrawer("dividend")}>View all →</span>
                          </div>
                        </div>
                        {!dh ? (
                          <div className="card-b"><DataState loading={dividendLoading} label={`Dividend data not synced for ${sym} yet.`} /></div>
                        ) : !hasReal ? (
                          <div className="sd-note" style={{ paddingBottom: 14 }}>{sym} does not currently pay a dividend.</div>
                        ) : (<>
                          <div className="sd-note">
                            5-yr dividend growth{" "}
                            {cagr != null
                              ? <span style={{ color: cagr < 0 ? "var(--down)" : "var(--up)" }}>{cagr >= 0 ? "+" : "−"}{Math.abs(cagr).toFixed(1)}%/yr</span>
                              : "—"}
                            {payoutRatio != null && <> · payout {payoutRatio}%</>}
                            {dh.increaseStreakYears > 0 && <> · {dh.increaseStreakYears}-yr streak</>}
                          </div>
                          {dh.history.slice(0, 5).map((h, i) => (
                            <div key={(h.exDividendDate ?? "") + i} className="sd-row">
                              <span className="grow num">{h.exDividendDate ?? "—"}</span>
                              <span className="num">{h.amount != null ? `$${h.amount.toFixed(4)}/sh` : "—"}</span>
                              <span className="num dim" style={{ width: 64, textAlign: "right" }}>{h.exDividendDate ? `ex ${h.exDividendDate.slice(5)}` : ""}</span>
                            </div>
                          ))}
                          <div className="sd-row">
                            <span className="grow">Forward run-rate</span>
                            <span className="num">${divMetrics.forwardPerShare != null ? divMetrics.forwardPerShare.toFixed(2) : annualDiv.toFixed(2)}/sh</span>
                          </div>
                          <div className="sd-row">
                            <span className="grow">Trailing ({dh.ttmPayments ?? 4} payments)</span>
                            <span className="num">${annualDiv.toFixed(2)}/sh</span>
                          </div>
                        </>)}
                      </div>
                    );
                  })()}
                </div>
              </>);
            })()}
          </>)}

          {activeTab === "holdings" && (
            isEtf ? (
              <EtfHoldingsView symbol={sym} />
            ) : (
              <div className="sd-hold" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="card" style={{ width: "100%" }}>
                <div className="card-h" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <h3>Insider transactions<span className="sd-unit">{allSymInsiderTxns.length} transactions</span></h3>
                    <VendorTag v={insiderVendor} />
                  </div>
                </div>

                <div className="card-b" style={{ padding: 0 }}>
                  {allSymInsiderTxns.length === 0 ? (
                    <div style={{ padding: 36 }}>
                      <DataState loading={insiderLoading} label={`No Form 4 insider transactions recorded for ${sym}.`} />
                    </div>
                  ) : (
                    <div className="table-wrap" style={{ overflowX: "auto", width: "100%" }}>
                        <table className="tbl" style={{ width: "100%", tableLayout: "fixed", fontSize: ".8rem" }}>
                          <colgroup>
                            <col style={{ width: "12%" }} />
                            <col style={{ width: "21%" }} />
                            <col style={{ width: "22%" }} />
                            <col style={{ width: "8%" }} />
                            <col style={{ width: "12%" }} />
                            <col style={{ width: "12%" }} />
                            <col style={{ width: "13%" }} />
                          </colgroup>
                          <thead>
                            <tr style={{ background: "var(--surface-1)", borderBottom: "1px solid var(--border-soft)" }}>
                              <th
                                onClick={() => {
                                  if (insTxSortCol === "date") {
                                    setInsTxSortDir(d => (d === "asc" ? "desc" : "asc"));
                                  } else {
                                    setInsTxSortCol("date");
                                    setInsTxSortDir("desc");
                                  }
                                }}
                                style={{ textAlign: "left", padding: "8px 6px 8px 18px", cursor: "pointer", userSelect: "none" }}
                                title="Click to sort by date"
                              >
                                Date {insTxSortCol === "date" ? (insTxSortDir === "desc" ? "▼" : "▲") : ""}
                              </th>
                              <th style={{ textAlign: "left", padding: "8px 6px" }}>Insider / Owner</th>
                              <th style={{ textAlign: "left", padding: "8px 6px" }}>Role / Title</th>
                              <th style={{ textAlign: "center", padding: "8px 4px" }}>Side</th>
                              <th
                                onClick={() => {
                                  if (insTxSortCol === "shares") {
                                    setInsTxSortDir(d => (d === "asc" ? "desc" : "asc"));
                                  } else {
                                    setInsTxSortCol("shares");
                                    setInsTxSortDir("desc");
                                  }
                                }}
                                style={{ textAlign: "right", padding: "8px 6px", cursor: "pointer", userSelect: "none" }}
                                title="Click to sort by shares"
                              >
                                Shares {insTxSortCol === "shares" ? (insTxSortDir === "desc" ? "▼" : "▲") : ""}
                              </th>
                              <th style={{ textAlign: "right", padding: "8px 6px" }}>Price / Share</th>
                              <th style={{ textAlign: "right", padding: "8px 18px 8px 6px" }}>Total Value</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pagedInsiderTxns.map((tx, idx) => {
                              // Only open-market trades (Form 4 codes P / S) are buys or sells.
                              // Awards, tax withholding, gifts and exercises carry the same
                              // acquired/disposed flag but are not trades, so they show their
                              // own code tag: keyed off that flag, MSFT's tax-withheld shares
                              // read "Sell" and STRL's stock awards "Buy".
                              const isBuy = tx.transactionCode === "P";
                              const isSell = tx.transactionCode === "S";
                              const price = tx.pricePerShare != null && tx.pricePerShare > 0 ? tx.pricePerShare : null;
                              const valUsd = price != null && tx.shares > 0 ? tx.shares * price : null;
                              const codeLabel = TX_CODE_LABEL[tx.transactionCode] ?? `Code ${tx.transactionCode}`;
                              const noPriceTip = `${codeLabel} (code ${tx.transactionCode}) — no market price reported on the Form 4`;
                              return (
                                <tr key={`${tx.id || idx}`} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                                  <td className="mono" style={{ padding: "8px 6px 8px 18px", color: "var(--text-dim-solid)", fontSize: ".76rem", whiteSpace: "nowrap" }}>
                                    {formatUsDate(tx.transactionDate)}
                                  </td>
                                  <td style={{ padding: "8px 6px" }}>
                                    <div style={{ color: "var(--text-hi)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={tx.ownerName ?? "Insider"}>
                                      {tx.ownerName ?? "Insider"}
                                    </div>
                                  </td>
                                  <td style={{ padding: "8px 6px", color: "var(--text-dim-solid)", fontSize: ".74rem", whiteSpace: "normal", lineHeight: 1.25, wordBreak: "break-word" }}>
                                    {tx.officerTitle || (tx.isOfficer ? "Officer" : "Director / 10% Owner")}
                                  </td>
                                  <td style={{ textAlign: "center", padding: "8px 4px" }}>
                                    <span
                                      className="tr-badge"
                                      style={{
                                        background: isBuy ? "var(--up)22" : isSell ? "var(--down)22" : "var(--surface-3)",
                                        color: isBuy ? "var(--up)" : isSell ? "var(--down)" : "var(--text-dim-solid)",
                                        fontWeight: 700,
                                        padding: "2px 8px",
                                        borderRadius: 5,
                                        fontSize: ".7rem",
                                      }}
                                    >
                                      {isBuy ? "Buy" : isSell ? "Sell" : INSIDER_TAG[tx.transactionCode] ?? (tx.transactionCode || "TX")}
                                    </span>
                                  </td>
                                  <td className="mono" style={{ textAlign: "right", padding: "8px 6px", color: "var(--text-hi)" }}>
                                    {Math.round(tx.shares ?? 0).toLocaleString("en-US")}
                                  </td>
                                  <td className="mono" style={{ textAlign: "right", padding: "8px 6px", color: "var(--text-dim-solid)" }}>
                                    {price != null ? `$${price.toFixed(2)}` : (
                                      <span title={noPriceTip} style={{ fontSize: ".7rem", fontFamily: "var(--f-sans, inherit)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block", maxWidth: "100%" }}>
                                        {codeLabel}
                                      </span>
                                    )}
                                  </td>
                                  <td className="mono" style={{ textAlign: "right", padding: "8px 18px 8px 6px" }}>
                                    {valUsd != null ? (
                                      <span className={isBuy ? "up" : isSell ? "down" : undefined} style={{ fontWeight: 700, color: isBuy || isSell ? undefined : "var(--text-dim-solid)" }}>
                                        {isBuy ? "+" : isSell ? "−" : ""}${Math.abs(valUsd) >= 1e6 ? `${(Math.abs(valUsd) / 1e6).toFixed(1)}M` : Math.round(Math.abs(valUsd)).toLocaleString("en-US")}
                                      </span>
                                    ) : (
                                      <span title={noPriceTip} style={{ color: "var(--text-dim-solid)" }}>—</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      <Pager page={insTxPage} total={sortedSymInsiderTxns.length} pageSize={INSIDER_PAGE_SIZE} onPage={setInsTxPage} />
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, width: "100%" }}>
                <div className="card">
                  <div className="card-h"><h3>Institutional</h3><VendorTag v={["fmp", "polygon"]} /></div>
                  {(() => {
                    const io = instPct;
                    const holders = instHolders;
                    const chg = instHoldersChg;
                    return (<>
                      <div className="sd-row"><span className="grow">Institutional ownership</span><span className="num">{io != null ? `${io.toFixed(1)}%` : <NotAvailable />}</span></div>
                      {/* FMP has no short-interest feed; FINRA data via Polygon. */}
                      <div className="sd-row">
                        <span className="grow">Short interest</span>
                        <span className="num" title={shortInt ? `FINRA settlement ${shortInt.settlementDate}` : undefined}>
                          {shortInt ? (<>
                            {compactNum(shortInt.shortInterest)} sh
                            {shortInt.daysToCover != null && <span className="dim" style={{ marginLeft: 6 }}>{shortInt.daysToCover.toFixed(1)} days</span>}
                          </>) : <NotAvailable />}
                        </span>
                      </div>
                      {/* "filers", not "funds": FMP counts 13F FILERS, and one filer can cover hundreds of funds. */}
                      <div className="sd-row">
                        <span className="grow">13F filers holding</span>
                        <span className="num">
                          {holders != null ? holders.toLocaleString() : <NotAvailable />}
                          {holders != null && chg != null && chg !== 0 && (
                            <span className={chg > 0 ? "up" : "down"} style={{ marginLeft: 6 }}>{chg > 0 ? "+" : ""}{chg} QoQ</span>
                          )}
                        </span>
                      </div>
                      {instAsOf && <div className="sd-foot">13F rollup · {instAsOf}</div>}
                    </>);
                  })()}
                </div>

                <div className="card">
                  <div className="card-h"><h3>Stock splits</h3><VendorTag v={["fmp", "polygon"]} /></div>
                  {splitsDoc && splitsDoc.splits.length > 0 ? splitsDoc.splits.slice(0, 5).map(x => (
                    <div key={x.executionDate} className="sd-row">
                      <span className="grow num">{x.executionDate}</span>
                      <span className="num">{x.splitFrom}:{x.splitTo}</span>
                    </div>
                  )) : (
                    <div className="sd-note" style={{ paddingBottom: 14 }}>No splits on record.</div>
                  )}
                </div>
              </div>
              </div>
            )
          )}

          {activeTab === "13f" && (
            <Stock13FFilingsView symbol={sym} />
          )}

          {activeTab === "analyst" && (
            <StockAnalystActionsView
              symbol={sym}
              consensusDocs={liveConsensus}
              companies={companies}
              livePrice={dispPrice ?? sessionQuote?.price ?? null}
              loading={liveConsensusLoading}
            />
          )}

          {activeTab === "news" && (() => {
            const now = new Date();
            const items = (tickerNews ?? []).map(n => ({ n, ms: Date.parse(n.publishedAt) })).filter(x => Number.isFinite(x.ms));
            const counts = Object.fromEntries(
              NEWS_PERIODS.map(([k]) => [k, items.filter(x => inNewsPeriod(k, x.ms, now)).length]),
            ) as Record<NewsPeriod, number>;
            const period = newsPeriod ?? NEWS_PERIODS.find(([k]) => counts[k] > 0)?.[0] ?? "w";
            const list = items.filter(x => inNewsPeriod(period, x.ms, now)).sort((a, b) => b.ms - a.ms);
            const CAP = 40;
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Summary — the same "Why It Moved" card as the Movers screen. */}
                <StockCatalystSummary ticker={sym} pctChange={hq.regPct} newsList={tickerNews ?? []} />

                <div className="card">
                  <div className="card-h">
                    <h3>News</h3>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <VendorTag v={["fmp", "polygon"]} />
                      {items.length > 0 && (
                        <span className="pill" style={{ background: "var(--surface-3)", color: "var(--up)", fontSize: ".62rem" }}>live</span>
                      )}
                    </div>
                  </div>
                  {items.length === 0 ? (
                    <div className="sd-note" style={{ paddingBottom: 14 }}>No recent news synced for {sym} yet.</div>
                  ) : (<>
                    <div className="sd-newsbar">
                      <SegToggle label="News period" value={period} onChange={setNewsPeriod}
                        options={NEWS_PERIODS.map(([k, l]) => [k, <>{l}<span className="n">{counts[k]}</span></>] as [NewsPeriod, ReactNode])} />
                    </div>
                    {list.length === 0 ? (
                      <div className="sd-note" style={{ padding: "26px 16px", textAlign: "center" }}>No stories in this period.</div>
                    ) : list.slice(0, CAP).map(({ n, ms }) => (
                      <a key={n.id} href={n.url} target="_blank" rel="noreferrer" className="sd-news">
                        <h4>{n.headline}</h4>
                        <p>
                          <span>{n.source} · {formatUsDate(n.publishedAt || ms)}</span>
                          {n.vendor && <span className="pill" style={{ fontSize: ".54rem", background: "var(--surface-3)", textTransform: "uppercase", letterSpacing: ".03em" }}>{n.vendor}</span>}
                          {n.sentiment && <span className="pill" style={{ fontSize: ".54rem", textTransform: "capitalize", background: "var(--surface-3)", color: n.sentiment === "positive" ? "var(--up)" : n.sentiment === "negative" ? "var(--down)" : "var(--text-dim-solid)" }}>{n.sentiment}</span>}
                        </p>
                      </a>
                    ))}
                    {list.length > CAP && <div className="sd-foot">Showing the latest {CAP} of {list.length} stories in this period.</div>}
                  </>)}
                </div>
              </div>
            );
          })()}

          {activeTab === "peers" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Peer Comparison Table Card */}
              <div className="card">
                <div className="card-h" style={{ flexWrap: "wrap", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <h3 style={{ margin: 0 }}>Peers<span className="sd-unit">{displayPeers.length} companies</span></h3>
                    <VendorTag v={["fmp", "polygon"]} />
                    {/* Search box */}
                    <input
                      type="text"
                      placeholder="Filter by symbol or name..."
                      value={peerQuery}
                      onChange={e => setPeerQuery(e.target.value)}
                      className="sd-search"
                    />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: ".7rem", color: "var(--text-dim-solid)" }}>Sort</span>
                    <div className="sd-seg" role="group" aria-label="Sort peers">
                      {([["c", "% Change", "desc"], ["w", "Weekly", "desc"], ["m", "Monthly", "desc"], ["mcap", "Market cap", "desc"], ["rs", "RS rating", "desc"], ["sym", "Ticker", "asc"]] as const).map(([k, l, first]) => (
                        <button key={k} type="button" aria-pressed={peerSortBy === k}
                          onClick={() => {
                            if (peerSortBy === k) setPeerSort(x => (x === "desc" ? "asc" : "desc"));
                            else { setPeerSortBy(k); setPeerSort(first); }
                          }}>
                          {l}{peerSortBy === k ? (peerSort === "desc" ? " ▼" : " ▲") : ""}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="card-b" style={{ padding: 0 }}>
                  {displayPeers.length ? (
                    <div className="table-wrap" style={{ overflowX: "auto" }}>
                      <table className="tbl" style={{ width: "100%", fontSize: ".8rem" }}>
                        <thead>
                          <tr style={{ background: "var(--surface-1)", borderBottom: "1px solid var(--border-soft)" }}>
                            <th style={{ textAlign: "left", padding: "10px 14px" }}>Company</th>
                            <th style={{ textAlign: "right", padding: "10px 14px" }}>Price</th>
                            <th style={{ textAlign: "right", padding: "10px 14px" }}>Today's Change</th>
                            <th style={{ textAlign: "right", padding: "10px 14px" }}>Weekly Change</th>
                            <th style={{ textAlign: "right", padding: "10px 14px" }}>Monthly Change</th>
                            <th style={{ textAlign: "right", padding: "10px 14px" }}>Market Cap</th>
                            <th style={{ textAlign: "right", padding: "10px 14px" }}>P/E Ratio</th>
                            <th style={{ textAlign: "center", padding: "10px 14px" }}>RS Rating</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayPeers.map(peer => {
                            const isCurrent = peer.t === sym;
                            const tag = peer.c === pmx ? "Leader" : peer.c === pmn ? "Laggard" : "";

                            return (
                              <tr
                                key={peer.t}
                                className={isCurrent ? "mine" : undefined}
                                onClick={() => openStockDetail(peer.t, displayPeers.map(x => x.t))}
                                style={{ cursor: "pointer" }}
                              >
                                <td style={{ padding: "10px 14px" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <StockLogo sym={peer.t} size={28} />
                                    <div>
                                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <span className="mono" style={{ fontWeight: 700, color: isCurrent ? "var(--brand-2)" : "var(--text-hi)" }}>
                                          {peer.t}
                                        </span>
                                        {isCurrent && <span className="sd-rs cur">Current</span>}
                                        {tag && <span className={`sd-rs ${tag === "Leader" ? "lead" : "lag"}`}>{tag}</span>}
                                      </div>
                                      <div style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {peer.name || "N/A"}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="mono" style={{ textAlign: "right", padding: "10px 14px", fontWeight: 600 }}>
                                  {peer.price != null ? "$" + (peer.price >= 10 ? peer.price.toFixed(2) : peer.price.toFixed(3)) : "N/A"}
                                </td>
                                <td className="mono" style={{ textAlign: "right", padding: "10px 14px" }}>
                                  <span className={cls(peer.c)} style={{ fontWeight: 600 }}>{sign(peer.c)}</span>
                                </td>
                                <td className="mono" style={{ textAlign: "right", padding: "10px 14px" }}>
                                  {peer.weeklyChange != null ? (
                                    <span className={cls(peer.weeklyChange)} style={{ fontWeight: 600 }}>{sign(peer.weeklyChange)}</span>
                                  ) : "N/A"}
                                </td>
                                <td className="mono" style={{ textAlign: "right", padding: "10px 14px" }}>
                                  {peer.monthlyChange != null ? (
                                    <span className={cls(peer.monthlyChange)} style={{ fontWeight: 600 }}>{sign(peer.monthlyChange)}</span>
                                  ) : "N/A"}
                                </td>
                                <td className="mono" style={{ textAlign: "right", padding: "10px 14px", color: "var(--text-dim-solid)" }}>
                                  {peer.marketCap != null ? cap(peer.marketCap) : "N/A"}
                                </td>
                                <td className="mono" style={{ textAlign: "right", padding: "10px 14px", color: "var(--text-dim-solid)" }}>
                                  {peer.peRatio != null ? (peer.peRatio > 0 ? peer.peRatio.toFixed(1) : "n/a") : "N/A"}
                                </td>
                                <td style={{ textAlign: "center", padding: "10px 14px" }}>
                                  {peer.rsRating != null ? (
                                    <span className={`sd-rs${peer.rsRating >= 70 ? " lead" : peer.rsRating < 40 ? " lag" : ""}`}>RS {peer.rsRating}</span>
                                  ) : "N/A"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ padding: 24 }}>
                      <DataState loading={companiesLoading} label={peerQuery ? "No peers match your search query." : "No live peers found for this company."} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

        {showRail && (
          // Pinned to the left column's height on Analysis (so Key levels sits
          // level with its last card); Overview's column is short, so its
          // rail keeps its natural height and Peers scrolls inside its card.
          <div className="sd-rail" style={{ height: rightColH, minHeight: 0, overflow: rightColH ? "auto" : undefined }}>


            {activeTab === "analysis" && (
              <div className="card sd-rail-full">
                <div className="card-h">
                  <h3>Technical rating</h3>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <VendorTag v={["fmp", "polygon"]} />
                    <span className="link" onClick={() => setInnerDrawer("techrating")}>View all →</span>
                  </div>
                </div>
                <div className="sd-gauge">
                  <div className="cap">Summary · {ratingBasis}</div>
                  <TrGauge val={gv} label={rating} />
                  {techRating && <RatingTally t={techRating.all} />}
                </div>
                {consensusDoc && (<>
                  <div className="sd-consensus">
                    <div className="cap">Analyst consensus</div>
                    <div className="big" style={{ color: consensusTone(consensusDoc.consensus) }}>{consensusDoc.consensus}</div>
                    <div className="split">
                      <span style={{ color: "var(--down)" }}><i>Sell</i>{consensusDoc.sell + consensusDoc.strongSell}</span>
                      <span style={{ color: "var(--text-dim-solid)" }}><i>Hold</i>{consensusDoc.hold}</span>
                      <span style={{ color: "var(--up)" }}><i>Buy</i>{consensusDoc.strongBuy + consensusDoc.buy}</span>
                    </div>
                  </div>
                  {consensusDoc.priceTargetConsensus != null && (
                    <div className="sd-target">
                      <div><span>Target</span>${consensusDoc.priceTargetConsensus.toFixed(0)}</div>
                      {dispPrice != null && dispPrice > 0 && (
                        <div>
                          <span>Upside</span>
                          <b style={{ color: consensusDoc.priceTargetConsensus >= dispPrice ? "var(--up)" : "var(--down)" }}>
                            {consensusDoc.priceTargetConsensus >= dispPrice ? "+" : ""}{(((consensusDoc.priceTargetConsensus - dispPrice) / dispPrice) * 100).toFixed(1)}%
                          </b>
                        </div>
                      )}
                      {consensusDoc.priceTargetLow != null && consensusDoc.priceTargetHigh != null && (
                        <div><span>Range</span>${consensusDoc.priceTargetLow.toFixed(0)}–${consensusDoc.priceTargetHigh.toFixed(0)}</div>
                      )}
                    </div>
                  )}
                </>)}
              </div>
            )}

            {activeTab === "analysis" && (
              <div className="card">
                <div className="card-h">
                  <h3>Indicators</h3>
                  <VendorTag v={["fmp", "polygon"]} />
                </div>
                {indRows.map(r => (
                  <div key={r[0]} className="sd-ind">
                    <span className="name">
                      {r[0]}
                      {r[0] === "RSI (14)" && rsiSeries && rsiSeries.length > 1 && (() => {
                        const pts = rsiSeries.slice(-40);
                        const W = 62, H = 16;
                        const d = pts
                          .map((v, i) => `${(i / (pts.length - 1)) * W},${H - (Math.min(100, Math.max(0, v)) / 100) * H}`)
                          .join(" ");
                        return (
                          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ marginLeft: 8, verticalAlign: "middle", overflow: "visible" }} aria-hidden="true">
                            <line x1="0" y1={H - 0.7 * H} x2={W} y2={H - 0.7 * H} stroke="var(--border-soft)" strokeWidth="1" />
                            <line x1="0" y1={H - 0.3 * H} x2={W} y2={H - 0.3 * H} stroke="var(--border-soft)" strokeWidth="1" />
                            <polyline points={d} fill="none" stroke="var(--ai)" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
                          </svg>
                        );
                      })()}
                    </span>
                    <span className="val">{r[1] ?? <NotAvailable />}</span>
                    <span className="verdict" style={{ color: ac(r[2]) }}>{r[2]}</span>
                  </div>
                ))}
                <div className="sd-foot">
                  RSI/MACD/Stoch %K/ADX from technical-indicators.job · RSI sparkline is the last 40 sessions on a 0-100 scale with the 30/70 bands marked · EMA/SMA computed from a year of daily bars. Indicators only — not investment advice.
                </div>
              </div>
            )}


            {activeTab === "analysis" && (
              <div className="card">
                <div className="card-h">
                  <h3>Key levels (pivots)</h3>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <VendorTag v={["fmp", "polygon"]} />
                    <span className="link" onClick={() => setInnerDrawer("keylevels")}>View all →</span>
                  </div>
                </div>
                <h6 className="sd-sec">Weekly pivots</h6>
                {(["R2", "R1", "Pivot", "S1", "S2"] as const).map(label => {
                  const wk = klWeekly;
                  const v = wk ? ({ R2: wk.r2, R1: wk.r1, Pivot: wk.pivot, S1: wk.s1, S2: wk.s2 } as Record<string, number | null>)[label] : null;
                  const tone = label.startsWith("R") ? "var(--down)" : label.startsWith("S") ? "var(--up)" : "var(--text-hi)";
                  return (
                    <div key={label} className="sd-row">
                      <span className="grow num" style={{ color: tone }}>{label}</span>
                      <span className="num">{v != null ? `$${v.toFixed(2)}` : <NotAvailable />}</span>
                    </div>
                  );
                })}
                <h6 className="sd-sec">Moving averages &amp; range</h6>
                {hi == null && lo == null && ema50 == null && sma200 == null ? (
                  <div className="card-b"><DataState loading={liveCompanyLoading || yearBarsLoading} label="No historical price data synced for this ticker yet." /></div>
                ) : (
                  ([
                    ["52W High", hi,     isUp ? "up"   : "dim"],
                    ["EMA 50",   ema50,  ema50 == null || sigPx == null ? "dim" : sigPx > ema50 ? "up" : "down"],
                    ["SMA 200",  sma200, sma200 == null || sigPx == null ? "dim" : sigPx > sma200 ? "up" : "down"],
                    ["52W Low",  lo,     isUp ? "dim"  : "down"],
                  ] as [string, number | null, string][]).map(x => (
                    <div key={x[0]} className="sd-row">
                      <span className="grow num">{x[0]}</span>
                      <span className="num" style={{ color: x[2] === "dim" ? "var(--text-hi)" : `var(--${x[2]})` }}>
                        {x[1] != null ? `$${nf(x[1])}` : <NotAvailable />}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}



          </div>
        )}
      </>)}

      </div>

      {/* ── Right-click context menu ── */}
      {ctxMenu && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 90 }} onClick={() => setCtxMenu(null)} />
          <div style={{
            position: "fixed", left: ctxMenu.x, top: ctxMenu.y,
            background: "var(--surface-1)", border: "1px solid var(--border)",
            borderRadius: 10, padding: "6px 0", minWidth: 160, zIndex: 91,
            boxShadow: "0 8px 24px rgba(0,0,0,.4)",
          }}>
            <button style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 14px", background: "none", border: "none", color: "var(--text)", fontSize: ".84rem", cursor: "pointer" }}
              onClick={() => { setCtxMenu(null); setNoteOpen(true); }}>
              📝 Add chart note
            </button>
            <button style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 14px", background: "none", border: "none", color: "var(--text-dim-solid)", fontSize: ".84rem", cursor: "pointer" }}
              onClick={() => setCtxMenu(null)}>
              Cancel
            </button>
          </div>
        </>
      )}

      {/* ── Inner drawers (View all) ── */}
      {innerDrawer && (
        <>
          <div className="scrim" style={{ zIndex: 52 }} onClick={() => setInnerDrawer(null)} />

          {/* Technical Rating */}
          {innerDrawer === "techrating" && (
            <div className="side-drawer" style={{ zIndex: 52 }}>
              <div className="drawer-h">
                <StockLogo sym={sym} size={34} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--text-hi)" }}>Technical Rating · {sym}</div>
                  <div style={{ fontSize: ".78rem", color: "var(--text-dim-solid)" }}>8 oscillators · 12 moving averages · {ratingBasis} candles</div>
                </div>
                <VendorTag v={["fmp", "polygon"]} />
                <button className="closebtn" onClick={() => setInnerDrawer(null)}>✕</button>
              </div>
              <div className="drawer-b">
                {techRating ? (
                  <>
                    <div className="tr-gauges">
                      <div className="trgroup">
                        <div className="gl">Oscillators</div>
                        <TrGauge val={scoreOf(techRating.osc)} label={labelOfTally(techRating.osc)} />
                        <RatingTally t={techRating.osc} />
                      </div>
                      <div className="trgroup" style={{ borderColor: "var(--ai-dim)" }}>
                        <div className="gl ai-c">Summary</div>
                        <TrGauge val={techRating.score} label={techRating.label} />
                        <RatingTally t={techRating.all} />
                      </div>
                      <div className="trgroup">
                        <div className="gl">Moving averages</div>
                        <TrGauge val={scoreOf(techRating.ma)} label={labelOfTally(techRating.ma)} />
                        <RatingTally t={techRating.ma} />
                      </div>
                    </div>
                    <RatingSection title="Oscillators" rows={techRating.oscillators} />
                    <RatingSection title="Moving Averages" rows={techRating.movingAverages} />
                    <div style={{ fontSize: ".66rem", color: "var(--text-dim-solid)", marginTop: 8 }}>
                      Computed from the {techRating.count} {ratingBasis} candles on the chart — change the chart&apos;s interval to re-rate.
                      Readings marked &ldquo;–&rdquo; need more candles than this interval has and count as neutral. Not investment advice.
                    </div>
                  </>
                ) : (
                  <DataState loading={barsLoading} label={`Not enough ${ratingBasis} candles to rate ${sym} yet.`} />
                )}
              </div>
            </div>
          )}

          {/* Peers */}
          {innerDrawer === "peers" && (
            <div className="side-drawer" style={{ zIndex: 52 }}>
              <div className="drawer-h">
                <StockLogo sym={sym} size={34} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--text-hi)" }}>Peers · {sym}</div>
                  <div style={{ fontSize: ".78rem", color: "var(--text-dim-solid)" }}>
                    {peersTotal} peer{peersTotal === 1 ? "" : "s"} with live data
                    {rawPeerTickers.length > peersTotal ? ` · ${rawPeerTickers.length} returned by Polygon` : ""}
                  </div>
                </div>
                <VendorTag v={["fmp", "polygon"]} />
                <button className="closebtn" onClick={() => setInnerDrawer(null)}>✕</button>
              </div>
              <div className="drawer-b">
                {sortedPeers.length === 0 ? (
                  <DataState loading={companiesLoading || liveCompanyLoading} label={`No live peers found for ${sym}.`} />
                ) : sortedPeers.map(peer => {
                  return (
                      <div key={peer.t} className="minirow" style={{ cursor: "pointer" }}
                        onClick={() => { setInnerDrawer(null); openStockDetail(peer.t, sortedPeers.map(x => x.t)); }}>
                        <StockLogo sym={peer.t} size={22} />
                        <span className="mono" style={{
                          fontWeight: 700, minWidth: 52,
                          color: peer.t === sym ? "var(--brand-2)" : "var(--text-hi)",
                        }}>{peer.t}</span>
                        <span className="mid" style={{ fontSize: ".76rem" }}>{peer.name ?? peer.t}</span>
                        {peer.rsRating != null && <span className="pill" style={{ fontSize: ".66rem", background: "var(--surface-3)", color: "var(--text-dim-solid)" }}>RS {peer.rsRating}</span>}
                        <span className={`mono ${cls(peer.c)}`} style={{ fontSize: ".82rem" }}>{sign(peer.c)}</span>
                      </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Industry Group rank */}
          {innerDrawer === "industry" && (
            <div className="side-drawer" style={{ zIndex: 52 }}>
              <div className="drawer-h">
                <StockLogo sym={sym} size={34} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--text-hi)" }}>Industry Group Rank</div>
                  <div style={{ fontSize: ".78rem", color: "var(--text-dim-solid)" }}>All sectors by today&apos;s performance</div>
                </div>
                <VendorTag v={["fmp", "polygon"]} />
                <button className="closebtn" onClick={() => setInnerDrawer(null)}>✕</button>
              </div>
              <div className="drawer-b">
                {rankedSectors.length === 0 ? <DataState loading={sectorsLoading} label="No live sector performance data yet." /> : rankedSectors.map((s, i) => (
                  <div key={s.sector} className="grouprow" style={{ cursor: "pointer" }}
                    onClick={() => { setInnerDrawer(null); openSector(s.sector); }}>
                    <span className="rk">{i + 1}</span>
                    <span className="gn" style={{
                      color: s.sector === group ? "var(--brand-2)" : undefined,
                      fontWeight: s.sector === group ? 700 : undefined,
                    }}>{s.sector}</span>
                    <div className="bar"><i style={{ width: Math.max(8, (s.pctChange - pmnSector) / (pmxSector - pmnSector || 1) * 100) + "%" }} /></div>
                    <span className="mono" style={{ fontSize: ".72rem", color: "var(--text-dim-solid)" }}>{sign(s.pctChange)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Insider transactions */}
          {innerDrawer === "insider" && (
            <div className="side-drawer" style={{ zIndex: 52 }}>
              <div className="drawer-h">
                <StockLogo sym={sym} size={34} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--text-hi)" }}>Insider &amp; Institutional · {sym}</div>
                  <div style={{ fontSize: ".78rem", color: "var(--text-dim-solid)" }}>Form 4 filings · 13F institutional data</div>
                </div>
                <VendorTag v={[insiderVendor, "fmp", "polygon"].filter((v, i, a) => a.indexOf(v) === i) as VendorKey[]} />
                <button className="closebtn" onClick={() => setInnerDrawer(null)}>✕</button>
              </div>
              <div className="drawer-b">
                <div className="metric-grid" style={{ marginBottom: 14 }}>
                  <div className="m"><div className="k">Inst. ownership</div><div className="v">{instPct != null ? `${instPct.toFixed(1)}%` : <NotAvailable />}</div></div>
                  <div className="m">
                    <div className="k">Short interest</div>
                    <div className="v" title={shortInt ? `FINRA settlement ${shortInt.settlementDate}` : undefined}>
                      {shortInt ? `${compactNum(shortInt.shortInterest)}${shortInt.daysToCover != null ? ` · ${shortInt.daysToCover.toFixed(1)}d` : ""}` : <NotAvailable />}
                    </div>
                  </div>
                  <div className="m"><div className="k">13F filers</div><div className="v">{instHolders != null ? instHolders.toLocaleString() : <NotAvailable />}</div></div>
                </div>
                <div className="ai-sec"><div className="h">Insider transactions ({data.insiderActivity.length})</div></div>
                {data.insiderActivity.length > 0 ? data.insiderActivity.slice(insDrawerPage * INSIDER_PAGE_SIZE, (insDrawerPage + 1) * INSIDER_PAGE_SIZE).map((n, i) => {
                  const isSell = n.isSell;
                  return (
                    <div key={insDrawerPage * INSIDER_PAGE_SIZE + i} className="minirow" style={{ alignItems: "flex-start", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border-soft)" }}>
                      <span className={`pill ${isSell ? "dn" : "up"}`} style={{ flex: "none", fontSize: ".66rem" }}>{n.tag}</span>
                      <span className="mid" style={{ whiteSpace: "normal", lineHeight: 1.45 }}>
                        <b style={{ color: "var(--text-hi)" }}>{n.name}</b> {n.action}{" "}
                        <span style={{ color: "var(--text-dim-solid)" }}>({n.date})</span>
                      </span>
                      <span className={`r mono ${isSell ? "down" : "up"}`} style={{ flex: "none" }}>
                        {n.valueUsd != null ? `${isSell ? "−" : "+"}$${(n.valueUsd / 1e6).toFixed(1)}M` : <NotAvailable />}
                      </span>
                    </div>
                  );
                }) : (
                  <DataState loading={insiderLoading} label="No insider transactions found for this ticker." />
                )}
                <Pager page={insDrawerPage} total={data.insiderActivity.length} pageSize={INSIDER_PAGE_SIZE} onPage={setInsDrawerPage} />
                <div className="ai-sec" style={{ marginTop: 14 }}>
                  <div className="h">Top institutional holders (13F{instAsOf ? ` · ${instAsOf}` : ""})</div>
                </div>
                {topHolders.length > 0 ? topHolders.map((h) => (
                  <div key={h.cik ?? h.name} className="minirow" style={{ gap: 10, padding: "6px 0", borderBottom: "1px solid var(--border-soft)" }}>
                    <span className="mid" style={{ whiteSpace: "normal", lineHeight: 1.4 }}>
                      <b style={{ color: "var(--text-hi)" }}>{titleCaseLabel(h.name)}</b>
                      {h.isNew && <span className="pill up" style={{ marginLeft: 6, fontSize: ".6rem" }}>NEW</span>}
                      <span style={{ display: "block", color: "var(--text-dim-solid)", fontSize: ".72rem" }}>
                        {compactNum(h.shares)} sh
                        {h.sharesChange != null && h.sharesChange !== 0 && (
                          <span className={h.sharesChange > 0 ? "up" : "down"}> · {h.sharesChange > 0 ? "+" : "−"}{compactNum(Math.abs(h.sharesChange))} QoQ</span>
                        )}
                      </span>
                    </span>
                    <span className="r mono">{h.ownershipPct != null ? `${h.ownershipPct.toFixed(2)}%` : <NotAvailable />}</span>
                  </div>
                )) : (
                  <DataState loading={ownershipLoading} label="No 13F holder data for this ticker." />
                )}
              </div>
            </div>
          )}

          {/* Key levels */}
          {innerDrawer === "keylevels" && (
            <div className="side-drawer" style={{ zIndex: 52 }}>
              <div className="drawer-h">
                <StockLogo sym={sym} size={34} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--text-hi)" }}>Key Levels · {sym}</div>
                  <div style={{ fontSize: ".78rem", color: "var(--text-dim-solid)" }}>Pivot points · support &amp; resistance</div>
                </div>
                <VendorTag v={["fmp", "polygon"]} />
                <button className="closebtn" onClick={() => setInnerDrawer(null)}>✕</button>
              </div>
              <div className="drawer-b">
                {([["Classic pivot (daily)", klDaily], ["Weekly pivot", klWeekly]] as const).map(([title, lv]) => (
                  <div key={title} style={{ marginBottom: 14 }}>
                    <div className="ai-sec"><div className="h">{title}</div></div>
                    {lv ? (["R3", "R2", "R1", "Pivot", "S1", "S2", "S3"] as const).map(label => {
                      const v = ({ R3: lv.r3, R2: lv.r2, R1: lv.r1, Pivot: lv.pivot, S1: lv.s1, S2: lv.s2, S3: lv.s3 } as Record<string, number | null>)[label];
                      const tone = label === "Pivot" ? "var(--text-hi)" : label.startsWith("R") ? "var(--down)" : "var(--up)";
                      return (
                        <div key={label} className="minirow">
                          <span className="tkr" style={{ width: 50, color: tone }}>{label}</span>
                          <span className="mid" style={{ fontSize: ".76rem", color: "var(--text-dim-solid)" }}>
                            {label === "Pivot" ? "Pivot point" : label.startsWith("R") ? `Resistance ${label[1]}` : `Support ${label[1]}`}
                          </span>
                          <span className="r mono">{v != null ? `$${v.toFixed(2)}` : <NotAvailable />}</span>
                        </div>
                      );
                    }) : (
                      <div style={{ fontSize: ".66rem", color: "var(--text-dim-solid)", margin: "6px 0" }}>
                        No pivot levels synced for this ticker yet.
                      </div>
                    )}
                  </div>
                ))}

                {hi == null && lo == null ? (
                  <DataState loading={liveCompanyLoading || yearBarsLoading} label="No historical price data synced for this ticker yet." />
                ) : (
                  <>
                    <div className="ai-sec"><div className="h">52-week levels</div></div>
                    <div className="metric-grid">
                      <div className="m"><div className="k">52W High</div><div className="v up">{hi != null ? `$${nf(hi)}` : <NotAvailable />}</div></div>
                      <div className="m"><div className="k">52W Low</div><div className="v down">{lo != null ? `$${nf(lo)}` : <NotAvailable />}</div></div>
                      <div className="m"><div className="k">From High</div><div className={hi != null ? cls((p - hi) / hi * 100) : ""}>{hi != null ? sign((p - hi) / hi * 100) : <NotAvailable />}</div></div>
                      <div className="m"><div className="k">From Low</div><div className={lo != null ? cls((p - lo) / lo * 100) : ""}>{lo != null ? sign((p - lo) / lo * 100) : <NotAvailable />}</div></div>
                    </div>
                    <div className="ai-sec" style={{ marginTop: 14 }}><div className="h">Moving averages</div></div>
                    <div className="metric-grid">
                      <div className="m"><div className="k">EMA 50</div><div className="v">{ema50 != null ? `$${nf(ema50)}` : <NotAvailable />}</div></div>
                      <div className="m"><div className="k">SMA 200</div><div className="v">{sma200 != null ? `$${nf(sma200)}` : <NotAvailable />}</div></div>
                    </div>
                  </>
                )}
                <div style={{ fontSize: ".66rem", color: "var(--text-dim-solid)", marginTop: 14 }}>
                  52-week range and moving averages are computed from a year of real daily closes. Not investment advice.
                </div>
              </div>
            </div>
          )}

          {/* Earnings History */}
          {innerDrawer === "earnings" && (
            <div className="side-drawer" style={{ zIndex: 52 }}>
              <div className="drawer-h">
                <StockLogo sym={sym} size={34} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--text-hi)" }}>{sym}</div>
                  <div style={{ fontSize: ".78rem", color: "var(--text-dim-solid)" }}>Earnings history · last 10 quarters</div>
                </div>
                <VendorTag v={["fmp", "polygon"]} />
                <button className="closebtn" onClick={() => setInnerDrawer(null)}>✕</button>
              </div>
              <div className="drawer-b">
                {hist10.length === 0 ? (
                  <DataState loading={earningsLoading} label={`No live earnings-estimate history synced for ${sym} yet.`} />
                ) : (
                  <>
                    <div style={{ fontSize: ".78rem", color: "var(--text-dim-solid)", marginBottom: 12 }}>
                      {Math.abs(beatStreak)}-qtr {beatStreak >= 0 ? "beat" : "miss"} streak
                    </div>
                    <div className="ec-legend">
                      <span><i style={{ background: "var(--text-dim-solid)" }} />EPS estimate</span>
                      <span><i style={{ background: "var(--up)" }} />Beat</span>
                      <span><i style={{ background: "var(--down)" }} />Miss</span>
                    </div>
                    <EarnEpsChart hist={hist10} />
                    <div style={{ overflowX: "auto", marginTop: 12 }}>
                      <table className="tbl">
                        <thead>
                          <tr>
                            <th>Quarter</th>
                            <th className="num" title="GAAP diluted EPS">EPS (GAAP)</th>
                            <th className="num" title="FMP adjusted EPS — the basis of the estimate">Adj. EPS</th>
                            <th className="num">Est. (adj.)</th>
                            <th className="num" title={ADJUSTED_SURPRISE_LABEL}>{ADJUSTED_SURPRISE_LABEL}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {hist10.map(q => (
                            <tr key={q.q}>
                              <td><b style={{ color: "var(--text-hi)" }}>{q.label || q.q}</b></td>
                              <td className="num">{q.gaap != null ? `$${q.gaap.toFixed(2)}` : "—"}</td>
                              <td className="num">${q.a.toFixed(2)}</td>
                              <td className="num">{q.e !== 0 ? `$${q.e.toFixed(2)}` : "—"}</td>
                              <td className={`num ${q.surp >= 0 ? "up" : "down"}`}>{q.surpStr && q.surpStr !== "—" ? q.surpStr : `${q.surp >= 0 ? "+" : ""}${q.surp}%`}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ fontSize: ".7rem", color: "var(--text-dim-solid)", marginTop: 8 }}>
                      {hist10.filter(h => h.surp >= 0).length}/{hist10.length} beats.
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Financials */}
          {innerDrawer === "financials" && (() => {
            const inc = incRowsFromFinancials(finPeriod, financialsDoc, () => []);
            const fb = (v: number) => v >= 1 ? `$${v.toFixed(2)}B` : `$${(v * 1000).toFixed(0)}M`;
            const beats10 = hist10.filter(h => h.surp >= 0).length;
            const reportedAnnualRows = annualEpsSalesRows(financialsDoc?.annual ?? [], financialsDoc?.epsHistory ?? []);
            const reportedYears = new Set(reportedAnnualRows.map(r => r.year));
            const fwd = forwardAnnualEstimates(financialsDoc).filter(e => !reportedYears.has(e.fiscalYear));
            const startEps = reportedAnnualRows.length ? reportedAnnualRows[reportedAnnualRows.length - 1].eps : null;
            const startSales = reportedAnnualRows.length ? reportedAnnualRows[reportedAnnualRows.length - 1].sales : null;
            const salesM = (v: number | null | undefined) => (v != null ? v / 1e6 : null);
            const forwardRows: typeof reportedAnnualRows = fwd.map((e, i) => {
              const prevEps = i === 0 ? startEps : fwd[i - 1].epsEstimate;
              const prevSales = i === 0 ? startSales : salesM(fwd[i - 1].revenueEstimate);
              return {
                year: `*${e.fiscalYear}`,
                eps: e.epsEstimate,
                epsEst: null,
                epsChg: pctChangeStr(e.epsEstimate, prevEps),
                epsSurp: "—",
                sales: salesM(e.revenueEstimate),
                salesChg: pctChangeStr(salesM(e.revenueEstimate), prevSales),
              };
            });
            const annualRows = [...reportedAnnualRows, ...forwardRows];
            const quarterlyRows = quarterlyEpsSalesRows(financialsDoc?.quarters ?? [], financialsDoc?.epsHistory ?? []);
            return (
              <div className="side-drawer" style={{ zIndex: 52 }}>
                <div className="drawer-h">
                  {/* The company logo, as every ticker row draws it. */}
                  <StockLogo sym={sym} size={31} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--text-hi)" }}>{sym}</div>
                    <div style={{ fontSize: ".78rem", color: "var(--text-dim-solid)" }}>Financials · income statement</div>
                  </div>
                  <VendorTag v={["fmp", "polygon"]} />
                  <button className="closebtn" onClick={() => setInnerDrawer(null)}>✕</button>
                </div>
                <div className="drawer-b">
                  {/* 10-quarter EPS chart */}
                  <div className="card" style={{ marginBottom: 14 }}>
                    <div className="card-h">
                      <h3>{sym} · earnings history</h3>
                      {hist10.length > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span className="pill" style={{ background: "var(--surface-3)", color: "var(--text-dim-solid)" }}>{beats10}/{hist10.length} beats</span>
                          <ExpandBtn title={`${sym} · earnings history`} node={<EarnEpsChart hist={hist10} />} />
                        </div>
                      )}
                    </div>
                    <div className="card-b" style={{ paddingTop: 8 }}>
                      {hist10.length === 0 ? <DataState loading={earningsLoading} label={`No live earnings-estimate history synced for ${sym} yet.`} /> : (
                        <>
                          <div className="ec-legend">
                            <span><i style={{ background: "var(--text-dim-solid)" }} />EPS estimate</span>
                            <span><i style={{ background: "var(--up)" }} />Beat</span>
                            <span><i style={{ background: "var(--down)" }} />Miss</span>
                          </div>
                          <EarnEpsChart hist={hist10} />
                        </>
                      )}
                    </div>
                  </div>
                  {/* Annual EPS & Sales */}
                  <div className="card" style={{ marginBottom: 14 }}>
                    <div className="card-h">
                      <h3>Fiscal year</h3>
                      <span className="pill" style={{ background: "var(--surface-3)", color: "var(--text-dim-solid)" }}>EPS &amp; sales</span>
                    </div>
                    <div className="card-b" style={{ paddingTop: 4 }}>
                      {annualRows.length === 0 ? (
                        <DataState loading={financialsLoading} label={`No live annual financials synced for ${sym} yet.`} />
                      ) : (
                        <div style={{ overflowX: "auto" }}>
                          <table className="tbl">
                            <thead>
                              <tr>
                                <th>Fiscal year</th>
                                <th className="num">EPS</th>
                                <th className="num">%chg</th>
                                <th className="num">Sales (mil)</th>
                                <th className="num">%chg</th>
                              </tr>
                            </thead>
                            <tbody>
                              {annualRows.map(r => (
                                <tr key={r.year}>
                                  <td style={{ fontWeight: 700, color: "var(--text-hi)" }}>{r.year}</td>
                                  <td className="num">{r.eps != null ? `$${r.eps.toFixed(2)}` : <NotAvailable />}</td>
                                  <td className={`num${r.epsChg.startsWith("+") ? " up" : r.epsChg.startsWith("-") ? " down" : ""}`}>{r.epsChg}</td>
                                  <td className="num">{r.sales != null ? r.sales.toFixed(1) : <NotAvailable />}</td>
                                  <td className={`num${r.salesChg.startsWith("+") ? " up" : r.salesChg.startsWith("-") ? " down" : ""}`}>{r.salesChg}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      <div style={{ fontSize: ".68rem", color: "var(--text-dim-solid)", marginTop: 8 }}>
                        Reported fiscal years and forward analyst estimates (*). %chg is year-over-year.
                      </div>
                    </div>
                  </div>

                  {/* Quarterly EPS & Sales */}
                  <div className="card" style={{ marginBottom: 14 }}>
                    <div className="card-h">
                      <h3>Quarter</h3>
                      <span className="pill" style={{ background: "var(--surface-3)", color: "var(--text-dim-solid)" }}>EPS &amp; sales</span>
                    </div>
                    <div className="card-b" style={{ paddingTop: 4 }}>
                      {quarterlyRows.length === 0 ? (
                        <DataState loading={financialsLoading} label={`No live quarterly financials synced for ${sym} yet.`} />
                      ) : (
                        <div style={{ overflowX: "auto" }}>
                          <table className="tbl">
                            <thead>
                              <tr>
                                <th>Quarter</th>
                                <th className="num">EPS</th>
                                <th className="num">%chg</th>
                                <th className="num">%surp</th>
                                <th className="num">Sales (mil)</th>
                                <th className="num">%chg</th>
                                <th className="num">%surp</th>
                              </tr>
                            </thead>
                            <tbody>
                              {quarterlyRows.map((r, i) => (
                                <tr key={`${r.label}-${i}`}>
                                  <td style={{ fontWeight: 700, color: "var(--text-hi)" }}>{r.label}</td>
                                  <td className="num">{r.eps != null ? `$${r.eps.toFixed(2)}` : <NotAvailable />}</td>
                                  <td className={`num${r.epsChg.startsWith("+") ? " up" : r.epsChg.startsWith("-") ? " down" : ""}`}>{r.epsChg}</td>
                                  <td className={`num${r.epsSurp.startsWith("+") ? " up" : r.epsSurp.startsWith("-") ? " down" : ""}`}>{r.epsSurp}</td>
                                  <td className="num">{r.sales != null ? r.sales.toFixed(1) : <NotAvailable />}</td>
                                  <td className={`num${r.salesChg.startsWith("+") ? " up" : r.salesChg.startsWith("-") ? " down" : ""}`}>{r.salesChg}</td>
                                  <td className="num">{r.salesSurp}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      <div style={{ fontSize: ".68rem", color: "var(--text-dim-solid)", marginTop: 8 }}>
                        %chg is year-over-year (same quarter, prior year). %surp is actual vs the FMP analyst consensus for that report.
                      </div>
                    </div>
                  </div>

                  {/* Income statement */}
                  <div className="card" style={{ marginBottom: 14 }}>
                    <div className="card-h">
                      <h3>Income statement</h3>
                      {inc.length > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span className="pill" style={{ background: "var(--surface-3)", color: "var(--text-dim-solid)" }}>Quarterly</span>
                          <ExpandBtn title={`${sym} · Income statement`} node={<EarnIncChart inc={inc} />} />
                        </div>
                      )}
                    </div>
                    <div className="card-b" style={{ paddingTop: 8 }}>
                      {inc.length === 0 ? <DataState loading={financialsLoading} label={`No live financials synced for ${sym} yet.`} /> : (
                        <>
                          <div className="ec-legend">
                            <span><i style={{ background: INC_COLORS.rev }} />Revenue</span>
                            <span><i style={{ background: INC_COLORS.gp }} />Gross profit</span>
                            <span><i style={{ background: INC_COLORS.ni }} />Net income</span>
                          </div>
                          <EarnIncChart inc={inc} />
                          <div style={{ overflowX: "auto", marginTop: 12 }}>
                            <table className="tbl">
                              <thead>
                                <tr>
                                  <th>Item</th>
                                  {inc.map(c => <th key={c.c} className="num">{c.c}</th>)}
                                </tr>
                              </thead>
                              <tbody>
                                {([
                                  ["Revenue",           "rev",  true],
                                  ["Cost of revenue",   "cogs", false],
                                  ["Gross profit",      "gp",   true],
                                  ["Operating expenses","opex", false],
                                  ["Operating income",  "oi",   true],
                                  ["Net income",        "ni",   true],
                                  ["Diluted EPS",       "eps",  false],
                                ] as [string, keyof IncRow, boolean][]).map(([lbl, key, bold]) => (
                                  <tr key={lbl}>
                                    <td style={bold ? { fontWeight: 700, color: "var(--text-hi)" } : {}}>{lbl}</td>
                                    {inc.map(c => (
                                      <td key={c.c} className="num" style={bold ? { fontWeight: 700, color: "var(--text-hi)" } : {}}>
                                        {key === "eps" ? `$${(c[key] as number).toFixed(2)}` : fb(c[key] as number)}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {innerDrawer === "dividend" && (() => {
            const dh = dividendHistory;
            const hasReal = !!dh && dh.isPayer;
            const yieldPct = hasReal ? dh!.yieldPct : null;
            const annualDiv = hasReal ? (dh!.ttmTotal ?? 0) : 0;
            const qDiv = annualDiv / 4;
            const growthPct = hasReal ? dh!.cagr5yPct : null;
            const growthLabel = growthPct != null ? `${growthPct >= 0 ? "+" : ""}${growthPct.toFixed(1)}%/yr` : null;
            const payoutRatio = eps != null && eps > 0 && yieldPct != null && yieldPct > 0
              ? Math.round((annualDiv / eps) * 100) : null;

            // Real history is newest-first; reverse to chronological for the bar
            // chart, oldest→newest left-to-right, matching every other chart here.
            const barSource = hasReal
              ? [...dh!.history].reverse().slice(-8).map(h => ({
                  label: h.exDividendDate ? h.exDividendDate.slice(2, 7).replace("-", "'") : "—",
                  amt: h.amount,
                }))
              : [];
            const maxAmt = barSource.length ? Math.max(...barSource.map(b => b.amt ?? 0)) * 1.15 || 1 : 1;
            const W = 420, H = 110, PADB = 22, PADT = 14;
            const bw = barSource.length ? W / barSource.length * 0.55 : 0;
            const gap = barSource.length ? W / barSource.length : 0;
            return (
              <div className="side-drawer" style={{ zIndex: 52 }}>
                <div className="drawer-h">
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--text-hi)" }}>Dividend History · {sym}</div>
                    <div style={{ fontSize: ".78rem", color: "var(--text-dim-solid)" }}>
                      {yieldPct != null ? `${yieldPct.toFixed(2)}% yield · $${annualDiv.toFixed(2)}/yr` : dh ? "No dividend paid" : "Not synced yet"}
                    </div>
                  </div>
                  <VendorTag v={["fmp", "polygon"]} />
                  <button className="closebtn" onClick={() => setInnerDrawer(null)}>✕</button>
                </div>
                <div className="drawer-b">
                  {!dh ? (
                    <DataState loading={dividendLoading} label={`Dividend data not synced for ${sym} yet.`} />
                  ) : !hasReal ? (
                    <div style={{ padding: "24px 0", textAlign: "center", fontSize: ".9rem", color: "var(--text-dim-solid)" }}>
                      {sym} does not currently pay a dividend.
                    </div>
                  ) : (
                    <>
                      <div className="metric-grid" style={{ marginBottom: 14 }}>
                        <div className="m"><div className="k">Annual</div><div className="v">${annualDiv.toFixed(2)}</div></div>
                        <div className="m"><div className="k">Quarterly</div><div className="v">${qDiv.toFixed(2)}</div></div>
                        <div className="m"><div className="k">Yield</div><div className="v up">{yieldPct!.toFixed(2)}%</div></div>
                        <div className="m"><div className="k">5-yr growth</div><div className="v up">{growthLabel ?? <NotAvailable />}</div></div>
                        <div className="m"><div className="k">Payout ratio</div><div className="v">{payoutRatio != null ? `${payoutRatio}%` : <NotAvailable />}</div></div>
                        <div className="m"><div className="k">Frequency</div><div className="v">{dh!.frequency ? `${dh!.frequency}x/yr` : <NotAvailable />}</div></div>
                      </div>
                      {barSource.length > 0 && (
                        <>
                          <div className="ai-sec"><div className="h">Dividend per share (recent payments)</div></div>
                          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", margin: "10px 0 14px" }}>
                            {barSource.map((b, i) => {
                              const bh = ((b.amt ?? 0) / maxAmt) * (H - PADT - PADB);
                              const bx = gap * i + (gap - bw) / 2;
                              const by = PADT + (H - PADT - PADB) - bh;
                              const isLast = i === barSource.length - 1;
                              return (
                                <g key={i}>
                                  <rect x={bx} y={by} width={bw} height={bh} rx={2}
                                    style={{ fill: isLast ? "var(--brand-2)" : "var(--surface-3)" }} />
                                  <text x={bx + bw / 2} y={by - 3} textAnchor="middle"
                                    style={{ fill: isLast ? "var(--brand-2)" : "var(--text-dim-solid)", fontSize: "0.4375rem" }}>
                                    {b.amt != null ? `$${b.amt.toFixed(2)}` : "—"}
                                  </text>
                                  <text x={bx + bw / 2} y={H - 5} textAnchor="middle"
                                    style={{ fill: "var(--text-dim-solid)", fontSize: "0.5rem" }}>
                                    {b.label}
                                  </text>
                                </g>
                              );
                            })}
                          </svg>
                        </>
                      )}

                      <div className="ai-sec"><div className="h">Stock splits</div></div>
                      {splitsDoc && splitsDoc.splits.length > 0 ? splitsDoc.splits.map(s => (
                        <div key={s.executionDate} className="minirow">
                          <span className="mid">{s.executionDate}</span>
                          <span className="r" style={{ color: "var(--text-hi)" }}>{s.splitFrom}:{s.splitTo}</span>
                        </div>
                      )) : (
                        <div style={{ fontSize: ".8rem", color: "var(--text-dim-solid)", padding: "4px 0" }}>No splits on record.</div>
                      )}

                      <div style={{ fontSize: ".66rem", color: "var(--text-dim-solid)", marginTop: 10 }}>
                        Historical payments and splits are real (Polygon). No upcoming ex-div/pay-date schedule is available — verify with company IR and SEC filings.
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })()}
        </>
      )}

      {/* ── Add note modal ── */}
      {noteOpen && (
        <>
          <div className="scrim" style={{ zIndex: 53 }} onClick={() => setNoteOpen(false)} />
          <div className="side-drawer" style={{ zIndex: 53, width: "min(420px, 98vw)" }}>
            <div className="drawer-h">
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--text-hi)" }}>
                  Add note · {sym}
                </div>
                <div style={{ fontSize: ".74rem", color: "var(--text-dim-solid)", marginTop: 2 }}>
                  Saved to your account with date &amp; time
                </div>
              </div>
              <button className="closebtn" onClick={() => setNoteOpen(false)}>✕</button>
            </div>
            <div className="drawer-b">
              <textarea
                placeholder="Record your trading decision, price level, or observation…"
                value={noteInput}
                onChange={e => setNoteInput(e.target.value)}
                rows={5}
                style={{
                  width: "100%", background: "var(--surface-3)", border: "1px solid var(--border-soft)",
                  borderRadius: 8, padding: "10px 12px", color: "var(--text)", fontSize: ".85rem",
                  lineHeight: 1.5, resize: "vertical", fontFamily: "var(--f-body)",
                }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button className="btn primary" style={{ flex: 1 }} onClick={submitNote}
                  disabled={!noteInput.trim()}>
                  Save note
                </button>
                <button className="btn" onClick={() => { setNoteOpen(false); setNoteInput(""); }}>Cancel</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Which-watchlist picker (opened from the star when the ticker is in
          several lists) */}
      {wlPicker && (
        <WatchlistPicker
          sym={wlPicker.sym}
          watchlists={watchlists}
          onAdd={id => addTicker(id, wlPicker.sym)}
          tickerLimit={tickerLimit}
          onRemove={id => removeTicker(id, wlPicker.sym)}
          onCreate={name => createList(name)}
          onClose={() => setWlPicker(null)}
          anchor={{ x: wlPicker.x, y: wlPicker.y }}
        />
      )}

      {/* Watchlist confirmation toast for the star — same look as Movers'. */}
      {wlToast && (
        <div
          role={wlToast.kind === "error" ? "alert" : "status"}
          aria-live={wlToast.kind === "error" ? "assertive" : "polite"}
          style={{
            position: "fixed", top: 22, left: "50%", transform: "translateX(-50%)",
            zIndex: 999, background: "var(--surface-1)",
            border: `1px solid ${wlToast.kind === "error" ? "var(--down)" : "var(--brand)"}`,
            color: "var(--text-hi)", borderRadius: 10, padding: "11px 20px",
            fontSize: ".85rem", fontWeight: 600, lineHeight: 1.4,
            whiteSpace: wlToast.kind === "error" ? "normal" : "nowrap",
            maxWidth: "min(560px, calc(100vw - 32px))",
            boxShadow: "0 14px 40px -10px rgba(0,0,0,.6)",
            display: "inline-flex", alignItems: "center", gap: 9,
          }}
        >
          <span style={{ color: wlToast.kind === "error" ? "var(--down)" : "var(--brand)", fontSize: "1rem", flexShrink: 0 }}>
            {wlToast.kind === "error" ? "!" : "★"}
          </span>
          {wlToast.text}
        </div>
      )}

      {/* ── No-data popup — the searched ticker has no market data ── */}
      {showNoDataPopup && (
        <div onClick={() => setDismissedNoData(sym)}
          style={{ position: "fixed", inset: 0, zIndex: 9500, background: "rgba(7,8,10,.62)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 14, width: "min(400px,100%)", padding: "26px 24px", textAlign: "center", boxShadow: "0 24px 64px rgba(0,0,0,.5)" }}>
            <div style={{ fontSize: "1.9rem", marginBottom: 8 }}>🔍</div>
            <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-hi)", marginBottom: 6, fontFamily: "var(--f-display)" }}>Data not available</div>
            <div style={{ fontSize: ".82rem", color: "var(--text-dim-solid)", lineHeight: 1.55, marginBottom: 18 }}>
              No market data is available for <b style={{ color: "var(--text-hi)" }}>{sym}</b> yet. It may be a newly listed, delisted, or non-US-listed ticker. Try another symbol.
            </div>
            <button className="btn primary" onClick={() => setDismissedNoData(sym)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
