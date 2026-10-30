// Strategy Lab settings — the ONE place the exit plan, costs and period become
// the engine config. Every consumer (multi-stock run, single-stock report, chart
// levels, stale-result signature, Save / Edit) goes through valCfg().
//
// labCfg keys (strings, as the controls store them):
//   stopM  'none' | 'pct' | 'atr'   stop   percent (e.g. '8')   stopA  ATR multiple
//   tpM    'none' | 'pct' | 'r'     tp     percent              tpR    R multiple
//   trA    'never' | 'entry' | '1r' | percent-up (e.g. '10')    trD    percent | 'atr2'
//   be     'off' | 'on'             maxB   'none' | bars
//   cost   basis points             yrs    years (daily / weekly)
//   idays_<tf>  calendar days (intraday candles)

import { TF } from "./engine.js";

/** Intraday backtest periods offered per candle, in calendar days. */
export const IPER = { "1m": [1, 2, 5, 7], "5m": [7, 14, 21, 30], "15m": [14, 30, 60, 90], "30m": [30, 60, 90, 180], "1h": [30, 90, 180, 365], "4h": [90, 180, 365, 730] };
export const YEAR_OPTS = ["1", "3", "5", "10"];
export const COST_OPTS = ["0", "5", "10"];

const num = (v) => (v === "" || v == null ? NaN : +v);

/** Normalised exit plan from labCfg. A stop of "none" is a real choice: no stop. */
export function exitPlanKeys(cfg = {}) {
  const g = (k, d) => (cfg[k] == null ? d : String(cfg[k]));
  const stopM = g("stopM", "none"), hasStop = stopM !== "none";
  let tpM = g("tpM", "none");
  if (tpM === "r" && !hasStop) tpM = "none";
  let trA = g("trA", "never");
  if (trA === "1r" && !hasStop) trA = "never";
  return {
    stopM, stop: g("stop", "8"), stopA: g("stopA", "2"),
    tpM, tp: g("tp", "10"), tpR: g("tpR", "2"),
    trA, trD: g("trD", "5"),
    be: g("be", "off") === "on" && hasStop ? "on" : "off",
    maxB: g("maxB", "none"),
  };
}

/** Engine fields for the exit plan. */
export function exitPlanEngine(cfg = {}) {
  const k = exitPlanKeys(cfg);
  const trailOn = k.trA !== "never";
  return {
    stop: k.stopM === "pct" ? num(k.stop) / 100 : 0,
    stopAtr: k.stopM === "atr" ? num(k.stopA) : null,
    tp: k.tpM === "pct" ? num(k.tp) / 100 : null,
    tpR: k.tpM === "r" ? num(k.tpR) : null,
    trail: trailOn && k.trD !== "atr2" ? num(k.trD) / 100 : null,
    trailAtr: trailOn && k.trD === "atr2" ? 2 : null,
    trailAct: !trailOn ? null : k.trA === "entry" || k.trA === "1r" ? 0 : num(k.trA) / 100,
    trailActR: k.trA === "1r" ? 1 : null,
    be: k.be === "on",
    maxBars: k.maxB === "none" ? null : num(k.maxB),
  };
}

/** One-line description of the exit plan. */
export function exitPlanSummary(cfg = {}) {
  const k = exitPlanKeys(cfg);
  const parts = [
    k.stopM === "pct" ? "Stop " + k.stop + "% below entry" : k.stopM === "atr" ? "Stop " + k.stopA + "× ATR(14) below entry" : "No stop",
    k.tpM === "pct" ? "target +" + k.tp + "%" : k.tpM === "r" ? "target " + k.tpR + "R" : "no target",
  ];
  if (k.be === "on") parts.push("stop to breakeven at +1R");
  if (k.trA !== "never") parts.push("trail " + (k.trD === "atr2" ? "2× ATR(14)" : k.trD + "%") + " below the high " + (k.trA === "entry" ? "from entry" : "once up " + (k.trA === "1r" ? "1R" : "+" + k.trA + "%")));
  if (k.maxB !== "none") parts.push("exit after " + k.maxB + " bars");
  return parts.join(" · ");
}

/**
 * labCfg keys for an AI / parser risk object {stop, tp, trail} given as
 * fractions. Exact values, no snapping; a stated 0 / "no stop" is None; an
 * unstated field is left at None.
 */
export function riskToCfg(risk = {}) {
  const pct = (f) => String(+(f * 100).toFixed(4));
  const out = { stopM: "none", tpM: "none", trA: "never", be: "off", maxB: "none" };
  if (risk.stop != null && risk.stop > 0) Object.assign(out, { stopM: "pct", stop: pct(risk.stop) });
  if (risk.tp != null && risk.tp > 0) Object.assign(out, { tpM: "pct", tp: pct(risk.tp) });
  if (risk.trail != null && risk.trail > 0) Object.assign(out, { trA: "entry", trD: pct(risk.trail) });
  return out;
}

/** Period for a candle: { years } for daily / weekly, { days } for intraday. */
export function periodOf(cfg = {}, tf = "d") {
  const T = TF[tf] || TF.d;
  if (!T.fmp) {
    const y = num(cfg.yrs);
    return { years: YEAR_OPTS.includes(String(cfg.yrs)) || (y >= 1 && y <= 10) ? y : 5 };
  }
  const opts = IPER[tf] || [T.days], v = num(cfg["idays_" + tf]);
  return { days: opts.includes(v) ? v : T.days };
}

export const periodLabel = (p) => (p.years != null ? p.years + "Y" : p.days >= 365 ? Math.round(p.days / 365) + "Y" : p.days >= 30 ? Math.round(p.days / 30) + "M" : p.days + "D");

/** The engine config for every run, report, chart and signature. */
export function valCfg(cfg = {}, tf = "d") {
  const T = TF[tf] || TF.d;
  const p = periodOf(cfg, tf);
  const c = { ...exitPlanEngine(cfg), costBps: num(cfg.cost ?? "5"), tf, intraday: !!T.fmp, flatEOD: T.fmp ? !!T.flat : true };
  if (!Number.isFinite(c.costBps)) c.costBps = 5;
  return p.years != null ? { ...c, years: p.years } : { ...c, idays: p.days };
}

/** Stale-result signature: rules + candle + engine config. */
export const runSig = (spec, tf, cfg) => JSON.stringify([{ entry: spec && spec.entry, exit: spec && spec.exit }, tf, cfg]);

/** The labCfg subset Save stores and Edit restores (exit plan + costs + period). */
export function savedCfgOf(cfg = {}, tf = "d") {
  const k = exitPlanKeys(cfg), p = periodOf(cfg, tf);
  const out = { ...k, cost: String(cfg.cost ?? "5") };
  if (p.years != null) out.yrs = String(p.years);
  else out["idays_" + tf] = String(p.days);
  return out;
}

/** First test-window date for a run ending at `lastDate` (daily / weekly: `years` back; intraday: `days` back). */
export function windowStart(lastDate, cfg) {
  const d = new Date(String(lastDate).slice(0, 10) + "T00:00:00Z");
  if (cfg.years != null) d.setUTCFullYear(d.getUTCFullYear() - cfg.years);
  else d.setUTCDate(d.getUTCDate() - cfg.idays + 1);
  return d.toISOString().slice(0, 10);
}
