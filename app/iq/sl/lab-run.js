// Strategy Lab — the multi-stock run, per stock. Pure (no React, no fetch), so
// the Web Worker (lab-worker.js), the inline fallback and the tests share it.

import * as BT from "./engine.js";
import { windowStart } from "./lab-config.js";

/** Bars of the window in which a signal still counts as "now". */
export const lookbackFor = (tf) => (BT.isIntradayTf(tf) ? 6 : tf === "1w" ? 2 : 5);

/** Server caps (strategy-lab.controller.ts). */
export const MAX_DAILY_DAYS = 4026;
export const MAX_INTRADAY_DAYS = 730;

/**
 * Calendar days of bars to fetch: the test window plus the indicator warm-up
 * before it (with a margin for holidays). Weekly bars are folded from daily.
 */
export function fetchSpan(spec, tf, cfg) {
  const w = BT.warmup(spec);
  if (!BT.isIntradayTf(tf)) {
    const warmDays = tf === "1w" ? w * 7 + 21 : Math.ceil(((w * 7) / 5) * 1.05) + 15;
    return { tf: "d", days: Math.min(MAX_DAILY_DAYS, Math.ceil(cfg.years * 365.25) + warmDays) };
  }
  const T = BT.TF[tf], perSession = Math.ceil(390 / T.min), sessions = Math.ceil(w / perSession) + 1;
  return { tf, days: Math.min(MAX_INTRADAY_DAYS, cfg.idays + Math.ceil((sessions * 7) / 5) + 4) };
}

/** Engine bars for a candle from the server's rows ({date, open, …}). */
export function prepBars(rows, tf) {
  const b = BT.normalizeFmp(rows);
  return tf === "1w" ? BT.toWeekly(b) : b;
}

/** The engine config for one stock: the shared cfg plus its window start. */
export const engineCfg = (cfg, bars) => ({ ...cfg, startDate: windowStart(bars[bars.length - 1].date, cfg) });

/**
 * "Price chart · trades" (full report and the results row pop-up): closes over
 * the test window only, so its buy & hold matches the report; a band per trade
 * (green win, red loss) and dashed stop / target lines from the exit plan.
 * In a 1000 × 300 box; fmt formats a bar date, tfLabel names the candle.
 */
export function priceChart(bars, r, cfg, { fmt, tfLabel }) {
  const L = bars[bars.length - 1];
  const tb = bars.slice(r.start), step = Math.max(1, Math.ceil(tb.length / 1200)), pts = tb.filter((_, i) => i % step === 0 || i === tb.length - 1);
  const N = pts.length, cs = pts.map((q) => q.close), lo = Math.min(...tb.map((q) => q.low)), hi = Math.max(...tb.map((q) => q.high)), pad = (hi - lo) * 0.06 || 1, LL = lo - pad, HH = hi + pad;
  const CX = (i) => (i / Math.max(N - 1, 1)) * 1000, CY = (c) => (1 - (c - LL) / (HH - LL)) * 300, idx = new Map(tb.map((q, i) => [String(q.date), i])), atr = cfg.stopAtr ? BT.series(bars, { ind: "atr", n: 14 }) : null;
  const xi = (d) => { const i = idx.get(String(d)); return i == null ? null : CX(i / step); };
  const levels = [], bands = [];
  for (const tr of r.trades) {
    const a = xi(tr.inDate), b = xi(tr.outDate);
    if (a == null || b == null) continue;
    const win = tr.ret > 0, w = Math.max(2, b - a);
    bands.push({ x: a.toFixed(1), w: w.toFixed(1), fill: win ? "rgba(61,220,132,.14)" : "rgba(240,86,90,.14)", stroke: win ? "rgba(61,220,132,.45)" : "rgba(240,86,90,.45)" });
    const ei = bars.findIndex((q) => String(q.date) === String(tr.inDate)), A = atr && ei > 0 ? atr[ei - 1] : null;
    const sl = cfg.stopAtr && A ? tr.inPx - cfg.stopAtr * A : cfg.stop ? tr.inPx * (1 - cfg.stop) : null, risk = sl ? tr.inPx - sl : null;
    const tp = cfg.tpR && risk ? tr.inPx + cfg.tpR * risk : cfg.tp ? tr.inPx * (1 + cfg.tp) : null;
    if (sl) levels.push({ x1: a, x2: a + w, y: CY(sl), c: "rgba(240,86,90,.8)" });
    if (tp) levels.push({ x1: a, x2: a + w, y: CY(tp), c: "rgba(61,220,132,.8)" });
  }
  const line = "M" + cs.map((c, i) => CX(i).toFixed(1) + "," + CY(c).toFixed(1)).join("L");
  return { sub: tfLabel + " candles · " + fmt(tb[0].date) + " – " + fmt(L.date) + " · test window only", trades: bands, levels, line, area: line + "L1000,300L0,300Z", hi: hi.toFixed(2), lo: lo.toFixed(2), d0: fmt(tb[0].date), d1: fmt(L.date), legend: "bands = trades (green win, red loss) · dashed = stop / target from the exit plan" };
}

/** The period object evidence and labels use. */
export const periodOfCfg = (cfg) => (cfg.years != null ? { years: cfg.years } : { days: cfg.idays });

/** One stock's row: status ok / insufficient (too little history) / unavailable (no bars). */
export function computeRow(t, n, bars, spec, cfg, tf) {
  if (!bars || !bars.length) return { t, n, status: "unavailable" };
  const L = bars[bars.length - 1], asOf = String(L.date);
  const r = BT.runRules(bars, spec, engineCfg(cfg, bars));
  if (!r) return { t, n, status: "insufficient", asOf };
  const ev = BT.evalLast(bars, spec, lookbackFor(tf));
  const closed = r.trades.filter((x) => x.why !== "Still open");
  return {
    ...windowSeries(r, closed, tf),
    t, n, status: "ok", asOf, last: L.close,
    sig: ev ? ev.status : null, ago: ev ? ev.ago : null, met: ev ? ev.met : 0, total: ev ? ev.total : 0,
    cagr: r.m.cagr, bcagr: r.mb.cagr, tot: r.m.tot, btot: r.mb.tot, sh: r.m.sharpe, dd: r.m.dd, win: r.m.win,
    trades: r.m.trades, closed: closed.length, wins: closed.filter((x) => x.ret > 0).length,
    open: r.trades.length - closed.length,
  };
}

// ── "Return over" windows (results panel) ──────────────────────────────────
// Daily and weekly windows are calendar days; intraday windows are trading
// minutes (390 = one session). The third chip is the default.
const DAY_WIN = { d: [2, 3, 4, 5, 10, 20, 30], "1w": [7, 14, 21, 28, 35, 42, 56] };
const DAY_MORE = { d: [90, 180, 365], "1w": [91, 182, 364] };
const MIN_WIN = {
  "1m": [5, 15, 30, 60, 120, 240, 390], "5m": [15, 30, 60, 120, 180, 240, 390], "15m": [30, 60, 90, 120, 180, 240, 390],
  "30m": [60, 90, 120, 180, 240, 300, 390], "1h": [120, 240, 390, 780, 1170, 1950, 3900], "4h": [390, 585, 780, 1170, 1950, 3900, 7800],
};
const MIN_MORE = { "1m": [780, 1950, 3900], "5m": [780, 1950, 3900], "15m": [780, 1950, 3900], "30m": [780, 1950, 3900], "1h": [7800, 15600, 23400], "4h": [15600, 23400, 46800] };

/** Window chips for a candle: base chips, the "More" chips and the default. */
export function windowOpts(tf) {
  const intra = BT.isIntradayTf(tf);
  const base = intra ? MIN_WIN[tf] : DAY_WIN[tf] || DAY_WIN.d, more = intra ? MIN_MORE[tf] : DAY_MORE[tf] || DAY_MORE.d;
  return { base, more, def: base[2], intra };
}

/**
 * The picked "Return over" window, or null for none: the whole backtest period
 * (the default, matching the full report). Only a chip the candle offers counts.
 */
export function windowPick(tf, stored) {
  const o = windowOpts(tf), n = +stored;
  return stored != null && stored !== "" && [...o.base, ...o.more].includes(n) ? n : null;
}

/** Chip label: 2D, 3W, 3M, 1Y for calendar days; 30m, 2H, 1.5D for trading minutes. */
export function windowLabel(n, intraday) {
  if (intraday) return n >= 390 ? +(n / 390).toFixed(1) + "D" : n >= 60 ? +(n / 60).toFixed(2) + "H" : n + "m";
  return n % 365 === 0 ? n / 365 + "Y" : n % 30 === 0 ? n / 30 + "M" : n % 7 === 0 ? n / 7 + "W" : n + "D";
}

const SESSION_OPEN = 570, SESSION_CLOSE = 960; // 09:30 and 16:00 ET, in minutes
const hm = (m) => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0") + ":00";

/**
 * First timestamp inside a window of `n` ending at `last`. Daily: `n` calendar
 * days back. Intraday: whole sessions when `n` is a multiple of 390, otherwise
 * `n` trading minutes back, carried into earlier sessions of `days` (oldest first).
 */
export function cutoffOf(last, n, intraday, days = []) {
  const L = String(last);
  if (!intraday) {
    const c = new Date(L.slice(0, 10) + "T00:00:00Z");
    c.setUTCDate(c.getUTCDate() - n);
    return c.toISOString().slice(0, 10);
  }
  let d = L.slice(0, 10), i = days.indexOf(d);
  if (i < 0) i = days.length;
  if (n % 390 === 0) return days[Math.max(0, i - n / 390 + 1)] ?? d;
  let t = +L.slice(11, 13) * 60 + +L.slice(14, 16), rem = n;
  while (t - rem < SESSION_OPEN) {
    if (i <= 0) return d + " " + hm(SESSION_OPEN);
    rem -= t - SESSION_OPEN;
    d = days[--i];
    t = SESSION_CLOSE;
  }
  return d + " " + hm(t - rem);
}

/** Largest window a candle offers, so the row keeps only the tail it can show. */
const maxWindow = (tf) => { const o = windowOpts(tf); return Math.max(...o.base, ...o.more); };

/** The tail of the per-bar curves and the closed trades that any window can need. */
function windowSeries(r, closed, tf) {
  const intra = BT.isIntradayTf(tf), eq = r.eqBar || r.eq, bh = r.bhBar || r.bh;
  const ds = eq.map((x) => String(x.date)), days = intra ? [...new Set(ds.map((x) => x.slice(0, 10)))] : [];
  const cut = cutoffOf(ds[ds.length - 1], maxWindow(tf), intra, days);
  const k = Math.max(0, ds.findIndex((x) => (intra ? x : x.slice(0, 10)) >= cut));
  return {
    wd: ds.slice(k), we: eq.slice(k).map((x) => x.v), wb: bh.slice(k).map((x) => x.v),
    ct: closed.map((x) => [String(x.outDate), x.ret]).filter(([o]) => (intra ? o : o.slice(0, 10)) >= cut),
  };
}

/**
 * One stock over the last `n`: ret = strategy equity now ÷ equity at the first
 * point inside the window − 1; bret the same for buy & hold; ex = ret − bret;
 * n / w = closed trades (and winners) that exited inside the window; open = a
 * position still held at the end (it is in every window, and can be all of the
 * window's return). `n` null = the whole backtest period, as the full report.
 */
export function windowStats(row, n, intraday) {
  if (!row) return null;
  const open = row.open || 0;
  if (n == null) return row.tot == null ? null : { ret: row.tot, bret: row.btot, ex: row.tot - row.btot, n: row.closed, w: row.wins, open, from: null };
  if (!row.wd || !row.wd.length) return null;
  const key = (x) => (intraday ? x : x.slice(0, 10));
  const days = intraday ? [...new Set(row.wd.map((x) => x.slice(0, 10)))] : [];
  const cut = cutoffOf(row.wd[row.wd.length - 1], n, intraday, days);
  const k = Math.max(0, row.wd.findIndex((x) => key(x) >= cut)), j = row.we.length - 1;
  const ret = row.we[j] / row.we[k] - 1, bret = row.wb[j] / row.wb[k] - 1;
  const cl = row.ct.filter(([o]) => key(o) >= cut);
  return { ret, bret, ex: ret - bret, n: cl.length, w: cl.filter(([, r]) => r > 0).length, open, from: row.wd[k] };
}

/**
 * Summary tiles over the stocks whose entry fired on the last bar (or every
 * tested stock with `onlyNow` false): how many made money and beat buy & hold
 * over the window, the pooled win rate and trade count of the window, and the
 * median full-period Sharpe (upper median).
 */
export function windowSummary(rows, statOf, onlyNow = true) {
  const R = rows.filter((r) => r.status === "ok" && (!onlyNow || r.ago === 0)), W = R.map(statOf).filter(Boolean);
  const trades = W.reduce((a, q) => a + q.n, 0), wins = W.reduce((a, q) => a + q.w, 0);
  const sh = R.map((r) => r.sh).filter((x) => x != null && Number.isFinite(x)).sort((a, b) => a - b);
  return {
    n: R.length, profitable: W.filter((q) => q.ret > 0).length, beat: W.filter((q) => q.ret > q.bret).length,
    win: trades ? wins / trades : null, trades, open: W.reduce((a, q) => a + (q.open || 0), 0), medSharpe: sh.length ? sh[Math.floor(sh.length / 2)] : null,
  };
}

const median = (a) => {
  const s = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Summary over every tested stock. Win rate is pooled over all closed trades. */
export function summarize(rows) {
  const ok = rows.filter((r) => r.status === "ok");
  const annual = ok.length > 0 && ok.every((r) => r.cagr != null);
  const ret = (r) => (annual ? r.cagr : r.tot), bret = (r) => (annual ? r.bcagr : r.btot);
  const closed = ok.reduce((a, r) => a + r.closed, 0), wins = ok.reduce((a, r) => a + r.wins, 0);
  return {
    tested: ok.length,
    profitable: ok.filter((r) => r.tot > 0).length,
    beat: ok.filter((r) => ret(r) > bret(r)).length,
    annual,
    medRet: median(ok.map(ret)),
    medSharpe: median(ok.map((r) => r.sh)),
    medDd: median(ok.map((r) => r.dd)),
    win: closed ? wins / closed : null,
    trades: ok.reduce((a, r) => a + r.trades, 0),
  };
}

/** Signal order: triggered now, then N bars ago, then setting up, then nothing. */
export const signalRank = (r) => (r.ago === 0 ? 0 : r.ago != null ? r.ago : r.sig === "setup" ? 1000 : 10000);

/** Sort rows; key "sig" is Signal then Sharpe. */
export function sortRows(rows, key = "sig", desc = true, annual = true) {
  const v = (r) => {
    switch (key) {
      case "t": return r.t;
      case "px": return r.px ?? -Infinity;
      case "ret": return annual ? r.cagr : r.tot;
      case "bret": return annual ? r.bcagr : r.btot;
      case "ex": return (annual ? r.cagr - r.bcagr : r.tot - r.btot);
      case "sh": return r.sh;
      case "dd": return r.dd;
      case "win": return r.closed ? r.win : -1;
      case "tr": return r.trades;
      default: return 0;
    }
  };
  const out = [...rows];
  if (key === "sig") return out.sort((a, b) => signalRank(a) - signalRank(b) || b.sh - a.sh);
  return out.sort((a, b) => {
    const x = v(a), y = v(b);
    const c = typeof x === "string" ? x.localeCompare(y) : x - y;
    return (desc ? -c : c) || b.sh - a.sh;
  });
}

// ── Progressive scan ─────────────────────────────────────────────────────
// Results arrive per stock; the panel shows the first three matches at once
// (fixed), a row 4 that counts the rest, and tiles over every match so far.

/** Symbols per /bars request: small for each worker's first pull so the first matches show sooner, then the normal size. */
export const scanChunk = (tf, round) => (round === 0 ? 3 : BT.isIntradayTf(tf) ? 4 : 10);

/** The universe request for a candle (the server applies any per-candle cap). */
export const universeUrl = (tf) => "/live/strategy-lab/universe?tf=" + encodeURIComponent(tf);

/** A fresh run: id, stocks to test, counters, results in arrival order. */
export const newRunState = (runId, total) => ({ runId, total, done: 0, fail: 0, insuf: 0, rows: [], asOf: "", busy: true });

/**
 * One stock's result into the run. A result tagged with another run id is
 * ignored (the same state object comes back), so a cancelled or superseded run
 * can never add rows to the current one.
 */
export function acceptRow(state, runId, row) {
  if (!state || runId !== state.runId || !row) return state;
  const next = { ...state, done: state.done + 1 };
  if (row.status === "ok") next.rows = [...state.rows, row];
  else if (row.status === "insufficient") next.insuf = state.insuf + 1;
  else next.fail = state.fail + 1;
  if (row.asOf && row.asOf > (state.asOf || "")) next.asOf = row.asOf;
  return next;
}

/** Status text split so each "…" can blink while the run is busy (the panel animates the dots parts). */
export function blinkParts(text, busy) {
  if (!busy) return [{ t: text, dots: false }];
  return String(text).split(/(…)/).filter(Boolean).map((t) => ({ t, dots: t === "…" }));
}

const plural = (n, one, many) => n + " " + (n === 1 ? one : many);

/**
 * What the panel shows for a run: matches (entry fired on the last bar), the
 * visible rows (first three in arrival order, or every match in Signal-then-
 * Sharpe order when expanded), the row-4 label, the tiles and the state.
 */
export function progressiveView(state, statOf, expanded) {
  const ok = (state.rows || []).filter((r) => r.status === "ok");
  const matches = ok.filter((r) => r.ago === 0 && statOf(r));
  const N = matches.length, busy = !!state.busy;
  const kind = N ? "rows" : busy ? "scanning-empty" : ok.length ? "empty" : "none";
  const head = kind === "scanning-empty" ? "Scanning… no matches so far"
    : kind === "rows" || kind === "empty" ? plural(N, "stock meets", "stocks meet") + " the rules now" + (busy ? " · scanning…" : "")
    : "";

  const isAll = expanded === true;
  const limit = isAll ? N : typeof expanded === "number" ? expanded : 3;
  const hasMore = N > limit;

  let more = null;
  if (!isAll && hasMore) {
    if (busy) {
      more = { label: "+3 more matches", next: limit + 3 };
    } else {
      more = { label: "View all " + N + " matches", next: true };
    }
  }

  const isExpanded = isAll || limit > 3;
  const visibleRows = isAll ? sortRows(matches, "sig") : matches.slice(0, limit);

  return {
    state: kind, head, matches: N, soFar: busy && N > 0,
    visible: visibleRows,
    more, less: isExpanded && N > 3,
    // Every match so far; with none at the end, every tested stock (the existing empty state).
    summary: N ? windowSummary(ok, statOf, true) : !busy && ok.length ? windowSummary(ok, statOf, false) : null,
  };
}

const isAbortErr = (e, signal) => !!(signal && signal.aborted) || !!(e && (e.name === "AbortError" || /aborted/i.test(String(e && e.message))));

/**
 * Bars for a chunk of symbols: the chunk is tried twice, then any symbol still
 * missing is tried once on its own; what is still missing is unavailable.
 * Stops at once when the run is cancelled.
 */
export async function fetchWithRetry(symbols, fetchChunk, signal) {
  const ABORTED = { bars: {}, unavailable: [], err: "", aborted: true };
  let bars = {}, err = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    try { bars = (await fetchChunk(symbols)) || {}; err = ""; break; }
    catch (e) { if (isAbortErr(e, signal)) return ABORTED; err = String((e && e.message) || e); bars = {}; }
  }
  const out = {}, unavailable = [];
  for (const t of symbols) {
    let r = bars[t];
    if (!r || !r.length) {
      if (signal && signal.aborted) return ABORTED;
      try { r = ((await fetchChunk([t])) || {})[t]; }
      catch (e) { if (isAbortErr(e, signal)) return ABORTED; err = String((e && e.message) || e); r = null; }
    }
    out[t] = r && r.length ? r : null;
    if (!out[t]) unavailable.push(t);
  }
  return { bars: out, unavailable, err, aborted: false };
}
