"use client";

import Link from "next/link";
import { featureDecision, hiddenInTrial, useEntitlements } from "../hooks/useEntitlements";
import { useAlphaPicks } from "../hooks/useAlphaPicks";
import { useSI } from "../si/si-context";
import { StockLogo, sign } from "../utils";
import { POOL_DASHBOARD, type IntradaySignal } from "../alpha-intraday";
import type { ActionKey, Signal } from "../alpha-signals-model";

/** Dashboard picks per side and horizon. */
const DASH_LIMIT = 2;
/** 5-minute bars re-read cadence on the Dashboard while the market is open. */
const DASH_BARS_MS = 60_000;

const stCls = (k: ActionKey) => (k === "act" ? "st-setup-active" : k === "alert" ? "st-building" : "st-watch");

interface ChipData {
  ticker: string;
  score: number;
  move: number | null;
  key: ActionKey;
  title?: string;
}

function Chip({ c }: { c: ChipData }) {
  return (
    <span className={`alpha-chip ${stCls(c.key)}`} title={c.title}>
      <StockLogo sym={c.ticker} size={12} />
      {c.ticker}
      <b>{c.score}</b>
      {c.move != null && <span className={c.move >= 0 ? "up" : "down"}>{sign(c.move)}</span>}
    </span>
  );
}

function Group({ side, chips, loading }: { side: "bull" | "bear"; chips: ChipData[]; loading: boolean }) {
  return (
    <span className={`alpha-grp ${side}`}>
      <i title={side === "bull" ? "Bullish" : "Bearish"}>{side === "bull" ? "▲" : "▼"}</i>
      {chips.length > 0
        ? chips.map(c => <Chip key={c.ticker} c={c} />)
        : loading
          ? [0, 1].map(i => <span key={i} className="alpha-chip ph" aria-hidden="true">&nbsp;</span>)
          : <span className="alpha-none">None qualify</span>}
    </span>
  );
}

const intraChip = (s: IntradaySignal): ChipData => ({
  ticker: s.ticker, score: s.score, move: s.m.chg == null ? null : s.m.chg * 100, key: s.action.key,
  title: `${s.setup.name} · ${s.action.label}`,
});
const swingChip = (s: Signal, bear: boolean): ChipData => ({
  ticker: s.c.ticker, score: s.score, move: s.c.pctChange, key: bear ? s.bear.key : s.action.key,
  title: `${s.label} · ${bear ? s.bear.short : s.action.short}`,
});

function Card() {
  const { enterAS } = useSI();
  const A = useAlphaPicks({ limit: DASH_LIMIT, pool: POOL_DASHBOARD, barsPollMs: DASH_BARS_MS, fill: true });
  const swingLoading = A.companiesLoading && A.companies.length === 0;
  const intraLoading = swingLoading || (A.barsLoading && A.intraAll.length === 0);
  return (
    <Link
      className="alpha-bar"
      href="/alpha-signals"
      title="Open Alpha Signals"
      onClick={e => { if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) { e.preventDefault(); enterAS(); } }}
    >
      <div className="alpha-ic">
        <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M19.07 4.93A10 10 0 1 0 22 12" /><path d="M16.24 7.76A6 6 0 1 0 18 12" /><circle cx="12" cy="12" r="1.6" /><path d="M12 12l6-6" /></svg>
      </div>
      <div className="alpha-txt">
        <b>Alpha Signals</b>
        <span>Top 2 bullish and top 2 bearish · intraday and swing · {A.open ? "live" : "market closed, last session"}</span>
      </div>
      <div className="alpha-rows">
        <div className="alpha-row">
          <em className="alp-mode intraday">Intraday</em>
          <Group side="bull" chips={A.intraBull.map(intraChip)} loading={intraLoading} />
          <Group side="bear" chips={A.intraBear.map(intraChip)} loading={intraLoading} />
        </div>
        <div className="alpha-row">
          <em className="alp-mode swing">Swing</em>
          <Group side="bull" chips={A.swingBull.map(s => swingChip(s, false))} loading={swingLoading} />
          <Group side="bear" chips={A.swingBear.map(s => swingChip(s, true))} loading={swingLoading} />
        </div>
      </div>
      <span className="alpha-go" aria-hidden="true">
        <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
      </span>
    </Link>
  );
}

/**
 * Dashboard "Alpha Signals" card (top 2 bullish + top 2 bearish, for intraday
 * and for swing). Shown only to accounts whose plan includes Alpha Signals —
 * never during the free trial — so no one else loads its data.
 */
export function AlphaDashboardCard() {
  const state = useEntitlements();
  if (hiddenInTrial(state.data, "alphaSignals")) return null;
  // Computed in the browser from shared feeds: unknown entitlements stay closed.
  if (!state.data) return null;
  if (featureDecision(state, "alphaSignals").kind !== "allow") return null;
  return <Card />;
}
