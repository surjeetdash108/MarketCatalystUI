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
    t, n, status: "ok", asOf, last: L.close,
    sig: ev ? ev.status : null, ago: ev ? ev.ago : null, met: ev ? ev.met : 0, total: ev ? ev.total : 0,
    cagr: r.m.cagr, bcagr: r.mb.cagr, tot: r.m.tot, btot: r.mb.tot, sh: r.m.sharpe, dd: r.m.dd, win: r.m.win,
    trades: r.m.trades, closed: closed.length, wins: closed.filter((x) => x.ret > 0).length,
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
