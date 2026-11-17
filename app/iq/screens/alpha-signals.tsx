"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useApiList } from "../hooks/useApiList";
import { useBackendBars } from "../hooks/useBackendBars";
import { useWatchlistsContext } from "../hooks/useWatchlists";
import { useAlphaPicks } from "../hooks/useAlphaPicks";
import { useLiveQuotes } from "../live-quotes-context";
import { useIQActions } from "../shell";
import { WatchlistPicker } from "../watchlist-picker";
import { exchangeLabel } from "../exchange";
import { useSI } from "../si/si-context";
import type { CompanyDoc, IpoEventDoc } from "../types";
import { StockLogo, DataState, cls, sign, fmtPrice } from "../utils";
import {
  COMP_INFO, DAY, KEYS, LABEL, LABEL_COLOR, MAX_PICKS, SCREENS, WEIGHTS, bearWhy, planOf,
  type ActionKey, type Comp, type DisplayLabel, type ScreenRow, type Signal, type Trend,
} from "../alpha-signals-model";
import { POOL_SCREENER, type IComp, type IntradaySignal } from "../alpha-intraday";

/*
 * Alpha Signals — ranks US stocks into bullish and bearish ideas on two
 * horizons: Intraday (5-minute bars, exit by the close) and Swing (2–6 weeks).
 * Engines: alpha-intraday.ts and alpha-signals-model.ts; data and cadence:
 * hooks/useAlphaPicks.ts. Every figure comes from the live company, analyst,
 * IPO and 5-minute bar feeds.
 */

export type Mode = "Intraday" | "Swing";
export type Dir = "Bullish" | "Bearish";

const VIEW_KEY = "iq-alpha-view";
/** 5-minute bars are re-read this often on this screen while the market is open. */
const BARS_POLL_MS = 30_000;

const TREND_TONE: Record<Trend, string> = {
  Emerging: "var(--up)", Strengthening: "var(--alp-up2)", "Pulling back": "var(--warn)", Stable: "var(--text-dim-solid)",
  "Losing momentum": "#f0883e", "Under pressure": "#f5a623", Weakening: "var(--down)",
};

/** Pill / action-box class: a bearish Setup active is red, a bullish one green. */
const actCls = (k: ActionKey, bear: boolean) => (k === "act" ? (bear ? "down" : "up") : k === "alert" ? "vio" : k === "watch" ? "dim" : "down");

/** Colours explicitly signed percentages in a screen's "why" sentence: +N% green, -N% red. */
const SIGNED_PCT = /((?<![\w.])[+\-−]\d[\d,]*(?:\.\d+)?%)/g;
const colorSigned = (text: string) =>
  text.split(SIGNED_PCT).map((part, i) =>
    i % 2 === 1 ? <span key={i} className={part.startsWith("+") ? "up" : "down"}>{part}</span> : part,
  );

const fmtDay = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
const pctTxt = (n: number | null | undefined) => (n == null ? "" : sign(n));
const fracPct = (f: number | null | undefined) => (f == null ? "—" : sign(f * 100));
const usd = (v: number | null | undefined) => fmtPrice(v);
const etTime = (t: number) => new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });

function InfoDot({ onOpen }: { onOpen: () => void }) {
  return (
    <span
      role="button" tabIndex={0} className="alp-i" title="How the Emergence Score is calculated"
      onClick={e => { e.stopPropagation(); e.preventDefault(); onOpen(); }}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); e.preventDefault(); onOpen(); } }}
    >i</span>
  );
}

function Ring({ score, size = 32, bear = false }: { score: number; size?: number; bear?: boolean }) {
  return <span className={`alp-ring${bear ? " bear" : ""}`} style={{ width: size, height: size, fontSize: size >= 50 ? "1.1rem" : size >= 40 ? ".95rem" : ".74rem" }}>{score}</span>;
}

function Pill({ k, text, bear }: { k: ActionKey; text: string; bear: boolean }) {
  return <span className={`alp-pill ${actCls(k, bear)}`} title="Action">{text}</span>;
}

function LabelTag({ text, color, title = "Trend" }: { text: string; color: string; title?: string }) {
  return <span className="alp-trend" style={{ color }} title={title}><i style={{ background: color }} />{text}</span>;
}
const SwingTag = ({ l }: { l: DisplayLabel }) => <LabelTag text={l} color={LABEL_COLOR[l]} />;
const setupColor = (s: IntradaySignal) => (s.setup.trend ? TREND_TONE[s.setup.trend] : "var(--text-dim-solid)");
const SetupTag = ({ s }: { s: IntradaySignal }) => <LabelTag text={s.setup.name} color={setupColor(s)} title={s.desc} />;

function Spark({ pts, title }: { pts: number[]; title: string }) {
  const clean = pts.filter(Number.isFinite);
  if (clean.length < 3) return <div className="alp-spark empty" aria-hidden />;
  const lo = Math.min(...clean), hi = Math.max(...clean), span = hi - lo || 1;
  const line = clean.map((v, i) => `${i ? "L" : "M"}${((i * 160) / (clean.length - 1)).toFixed(1)},${(32 - ((v - lo) / span) * 28).toFixed(1)}`).join(" ");
  return (
    <svg className="alp-spark" viewBox="0 0 160 36" preserveAspectRatio="none" role="img" aria-label={title}>
      <title>{title}</title>
      <path d={`${line} L160,36 L0,36 Z`} className="a" />
      <path d={line} className="l" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

const CalIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
);

function SwingFoot({ c, now }: { c: CompanyDoc; now: number }) {
  const er = c.nextEarningsDate && Date.parse(c.nextEarningsDate) >= now - DAY ? fmtDay(c.nextEarningsDate) : null;
  const fh = c.price != null && c.high52 ? (c.price / c.high52 - 1) * 100 : c.pctFromHigh52 ?? null;
  const txt = er ? `Earnings ${er}`
    : fh != null ? (fh > -0.05 ? "At 52W high" : `${Math.abs(fh).toFixed(1)}% below 52W high`)
      : `RS ${Math.round(c.rsRating ?? 0)} · RVOL ${(c.rvol ?? 0).toFixed(1)}×`;
  return <div className="alp-card-foot"><CalIcon /><span>{txt}</span></div>;
}

function compColor(v: number | null) {
  return v == null ? "var(--text-dim-solid)" : v >= 65 ? "var(--up)" : v >= 50 ? "var(--warn)" : "var(--down)";
}

function CompRow({ x, small }: { x: Comp | IComp; small?: string }) {
  const col = compColor(x.value);
  return (
    <div className="alp-comp" title={x.metric}>
      <div className="nm"><b>{x.label}</b><small>{small ?? x.metric}</small></div>
      <div className="bar"><i style={{ width: `${x.value ?? 0}%`, background: col }} /></div>
      <span className="v" style={{ color: col }}>{x.value ?? "—"}</span>
    </div>
  );
}

/** Price-history windows: 5D is the last five sessions; 1M–9M are cut from daily closes. */
const PRICE_RANGES = [
  { key: "5D", tf: "5D", days: 0, aria: "five sessions" },
  { key: "1M", tf: "3M", days: 31, aria: "month" },
  { key: "3M", tf: "3M", days: 92, aria: "3 months" },
  { key: "6M", tf: "6M", days: 184, aria: "6 months" },
  { key: "9M", tf: "1Y", days: 275, aria: "9 months" },
] as const;
type PriceRangeKey = (typeof PRICE_RANGES)[number]["key"];

function PriceChart({ sym }: { sym: string }) {
  const [rangeKey, setRangeKey] = useState<PriceRangeKey>("5D");
  const range = PRICE_RANGES.find(r => r.key === rangeKey)!;
  const { bars, loading } = useBackendBars(sym, range.tf);
  const [now] = useState(() => Date.now());
  const pts = useMemo(() => {
    const ms = (t: number) => (t < 1e11 ? t * 1000 : t);
    const all = (bars ?? []).map(b => ({ t: ms(b.t), c: b.c }));
    return range.days ? all.filter(p => p.t >= now - range.days * DAY) : all;
  }, [bars, now, range.days]);
  const head = (
    <div className="alp-k-row">
      <span className="alp-k">Price · {range.key}</span>
      <div className="alp-seg" role="group" aria-label="Price history range" style={{ marginLeft: "auto" }}>
        {PRICE_RANGES.map(r => (
          <button key={r.key} type="button" className={r.key === rangeKey ? "on" : ""} onClick={() => setRangeKey(r.key)}>{r.key}</button>
        ))}
      </div>
    </div>
  );
  if (loading && pts.length === 0) return <>{head}<div className="alp-chart-empty">Loading price history…</div></>;
  if (pts.length < 3) return <>{head}<div className="alp-chart-empty">No price history available.</div></>;
  const lo = Math.min(...pts.map(p => p.c)), hi = Math.max(...pts.map(p => p.c)), span = hi - lo || 1;
  const L = 58, Rt = 552;
  const X = (i: number) => L + (i * (Rt - L)) / (pts.length - 1);
  const Y = (v: number) => 130 - ((v - lo) / span) * 104;
  const line = pts.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(p.c).toFixed(1)}`).join(" ");
  const lab = (i: number) => new Date(pts[i].t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });
  const price = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const mid = Math.floor((pts.length - 1) / 2);
  return (
    <>
      {head}
      <svg className="alp-chart" viewBox="0 0 560 160" role="img" aria-label={`${sym} price, last ${range.aria}`}>
        <line x1={L} x2={Rt} y1="26" y2="26" className="g" /><line x1={L} x2={Rt} y1="130" y2="130" className="g2" />
        <text x={L - 6} y="29" textAnchor="end">{price(hi)}</text>
        <text x={L - 6} y="133" textAnchor="end">{price(lo)}</text>
        <path d={`${line} L${X(pts.length - 1)},130 L${L},130 Z`} className="a" />
        <path d={line} className="l" />
        <text x={L} y="152" textAnchor="start">{lab(0)}</text>
        <text x={X(mid)} y="152" textAnchor="middle">{lab(mid)}</text>
        <text x={Rt} y="152" textAnchor="end">{lab(pts.length - 1)}</text>
      </svg>
    </>
  );
}

const Chevron = ({ dir }: { dir: "l" | "r" }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={dir === "l" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} /></svg>
);

function readView(): { mode: Mode; dir: Dir } {
  try {
    const v = JSON.parse(localStorage.getItem(VIEW_KEY) ?? "null") as { mode?: string; dir?: string } | null;
    return { mode: v?.mode === "Swing" ? "Swing" : "Intraday", dir: v?.dir === "Bearish" ? "Bearish" : "Bullish" };
  } catch {
    return { mode: "Intraday", dir: "Bullish" };
  }
}

type Popup = { kind: "side" } | { kind: "rules"; sym: string };

export function AlphaSignals() {
  const { openStockDetail } = useIQActions();
  const { enterSI } = useSI();
  const { watchlists, addTicker, removeTicker, createList, tickerLimit } = useWatchlistsContext();
  const A = useAlphaPicks({ limit: MAX_PICKS, pool: POOL_SCREENER, barsPollMs: BARS_POLL_MS });
  const { data: ipos } = useApiList<IpoEventDoc>("/market-data/ipos");

  const [mode, setMode] = useState<Mode>("Intraday");
  const [dir, setDir] = useState<Dir>("Bullish");
  useEffect(() => {
    const v = readView();
    queueMicrotask(() => { setMode(v.mode); setDir(v.dir); });
  }, []);
  const setView = (m: Mode, d: Dir) => {
    setMode(m);
    setDir(d);
    setPickSym(null);
    try { localStorage.setItem(VIEW_KEY, JSON.stringify({ mode: m, dir: d })); } catch { /* private mode */ }
  };

  const [screenId, setScreenId] = useState(SCREENS[0].id);
  const [topN, setTopN] = useState<10 | 20 | 50>(10);
  const [sel, setSel] = useState<string | null>(null);
  const [pickSym, setPickSym] = useState<string | null>(null);
  const [popup, setPopup] = useState<Popup | null>(null);
  const [toast, setToast] = useState<{ text: string; kind: "ok" | "error" } | null>(null);
  const [wlPicker, setWlPicker] = useState<{ sym: string; x: number; y: number } | null>(null);
  const [modalHost, setModalHost] = useState<Element | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const carRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const ctx = useMemo(() => ({ companies: A.companies, sigs: A.sigs, analyst: A.analyst, ipos, now: A.now }), [A.companies, A.sigs, A.analyst, ipos, A.now]);
  const rowsBy = useMemo(() => new Map(SCREENS.map(s => [s.id, s.rows(ctx)])), [ctx]);

  const screen = SCREENS.find(s => s.id === screenId) ?? SCREENS[0];
  const allRows = rowsBy.get(screen.id) ?? [];
  const rows = allRows.slice(0, topN);
  const curRow: ScreenRow | undefined = rows.find(r => r.ticker === sel) ?? rows[0];
  const curSig = curRow ? A.sigBy.get(curRow.ticker) : undefined;
  // Live prices for the rows on screen — the same shared quotes Market Catalyst
  // shows; A.companies already carries every quote in that map.
  useLiveQuotes(rows.map(r => r.ticker));

  const bear = dir === "Bearish";
  const swingList = bear ? A.swingBear : A.swingBull;
  const intraList = bear ? A.intraBear : A.intraBull;
  const listTickers = mode === "Swing" ? swingList.map(s => s.c.ticker) : intraList.map(s => s.ticker);
  const pickIdx = pickSym ? listTickers.indexOf(pickSym) : -1;

  const flash = useCallback((text: string, kind: "ok" | "error" = "ok") => {
    clearTimeout(toastTimer.current);
    setToast({ text, kind });
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // Modals portal into the themed .iq-root: a hovered .card is transformed and
  // would otherwise trap position:fixed.
  const openModal = useCallback((open: () => void) => {
    setModalHost(rootRef.current?.closest(".iq-root") ?? document.body);
    open();
  }, []);
  const openSideInfo = () => openModal(() => setPopup({ kind: "side" }));
  const openRules = (sym: string) => openModal(() => setPopup({ kind: "rules", sym }));
  const openPick = (t: string) => openModal(() => setPickSym(t));

  useEffect(() => {
    if (!pickSym && !popup) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (popup) setPopup(null);
      else setPickSym(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pickSym, popup]);

  // The open pick left its list (a refresh re-ranked it): close the popup.
  useEffect(() => {
    if (pickSym && pickIdx < 0) queueMicrotask(() => setPickSym(null));
  }, [pickSym, pickIdx]);

  async function toggleWatch(sym: string, e: React.MouseEvent<HTMLButtonElement>) {
    const S = sym.toUpperCase();
    const saved = watchlists.filter(w => w.tickers.includes(S));
    if (saved.length > 1) {
      const r = e.currentTarget.getBoundingClientRect();
      setWlPicker({ sym: S, x: r.right - 250, y: r.bottom });
      return;
    }
    if (saved.length === 1) {
      void removeTicker(saved[0].id, S);
      flash(`${S} removed from ${saved[0].name}`);
      return;
    }
    const list = watchlists[0];
    if (!list) return;
    const res = await addTicker(list.id, S);
    if (res.ok) flash(`${S} added to ${list.name}`); else flash(res.message, "error");
  }

  const scrollCards = (d: -1 | 1) => carRef.current?.scrollBy({ left: d * carRef.current.clientWidth * 0.8, behavior: "smooth" });
  const nextPick = (d: -1 | 1) => { if (pickIdx >= 0) setPickSym(listTickers[(pickIdx + d + listTickers.length) % listTickers.length]); };

  if (A.companiesLoading && A.companies.length === 0) return <DataState loading label="Scanning the market…" />;
  if (A.sigs.length === 0) return <DataState loading={false} label="No Alpha Signals available yet." />;

  const sub = bear
    ? "Short ideas — confirmed downtrends with a setup · shorting carries extra risk"
    : mode === "Intraday"
      ? A.open ? "Live scan — 5-minute bars re-read every 30 seconds, stock list every minute" : "Market closed — showing the last session"
      : "Stocks heating up — tap one for the action plan";
  const subTitle = mode === "Intraday" && A.lastBarAt ? `Latest 5-minute bar: ${etTime(A.lastBarAt)} ET` : undefined;
  const count = mode === "Swing" ? swingList.length : intraList.length;
  const intraMinutes = A.intraAll[0]?.m.minutes ?? null;
  const empty = mode === "Swing"
    ? bear
      ? "No confirmed downtrend has a short setup right now."
      : "No stocks are heating up with complete enough data right now. The screens below still work."
    : A.barsLoading && A.intraAll.length === 0
      ? "Reading 5-minute bars…"
      : A.candidates.length === 0
        ? "No stocks qualify for the intraday scan right now."
        : A.open && intraMinutes != null && intraMinutes < 15
          ? "The opening range is still forming — intraday setups appear after 9:45 ET."
          : bear
            ? "No short setup qualifies right now — the rules need a confirmed weak tape, a nearby trigger and volume."
            : "No long setup qualifies right now — the rules need a trigger nearby, volume and price above VWAP.";

  const swingPick = mode === "Swing" && pickSym ? swingList.find(s => s.c.ticker === pickSym) ?? null : null;
  const intraPick = mode === "Intraday" && pickSym ? intraList.find(s => s.ticker === pickSym) ?? null : null;
  const pos = `${pickIdx + 1} / ${listTickers.length}`;
  const starOf = (t: string) => watchlists.some(w => w.tickers.includes(t.toUpperCase()));
  const rulesSig = popup?.kind === "rules" ? A.sigBy.get(popup.sym) : undefined;

  return (
    <div className="alp" ref={rootRef}>
      <div className="alp-tag">Discover emerging opportunities before they become obvious.</div>

      <section className="alp-sec">
        <div className="alp-sec-h">
          <b>MarketCatalyst Top Picks</b>
          <div className="alp-modes" role="tablist" aria-label="Top picks style">
            {(["Intraday", "Swing"] as const).map(m => (
              <button key={m} type="button" role="tab" aria-selected={mode === m} className={mode === m ? "on" : ""} onClick={() => setView(m, dir)}>{m}</button>
            ))}
          </div>
          <div className="alp-modes dir" role="tablist" aria-label="Direction">
            {(["Bullish", "Bearish"] as const).map(d => (
              <button key={d} type="button" role="tab" aria-selected={dir === d} className={`${dir === d ? "on " : ""}${d === "Bullish" ? "bull" : "bear"}`} onClick={() => setView(mode, d)}>{d}</button>
            ))}
          </div>
          <span className="alp-chip">{mode === "Intraday" ? "Intraday · exit by close" : "Swing trades · 2–6 wks"}</span>
          <span className="alp-sub" title={subTitle}>{sub}</span>
          {count > 0 && (
            <div className="alp-nav">
              <button type="button" aria-label="Previous picks" onClick={() => scrollCards(-1)}><Chevron dir="l" /></button>
              <button type="button" aria-label="Next picks" onClick={() => scrollCards(1)}><Chevron dir="r" /></button>
            </div>
          )}
        </div>
        {count === 0 && <div className="alp-none">{empty}</div>}
        <div className="alp-cards" ref={carRef} hidden={count === 0}>
          {mode === "Swing"
            ? swingList.map(s => {
              const a = bear ? s.bear : s.action;
              return (
                <button key={s.c.ticker} type="button" className="alp-card" onClick={() => openPick(s.c.ticker)}>
                  <div className="alp-card-top">
                    <StockLogo sym={s.c.ticker} size={17} />
                    <b>{s.c.ticker}</b>
                    <span className={`mono ${cls(s.c.pctChange ?? 0)}`} title="Change today">{pctTxt(s.c.pctChange ?? 0)}</span>
                  </div>
                  <Spark pts={(s.c.week5Closes ?? []).map(x => x.close)} title="Closing prices, last 5 sessions" />
                  <div className="alp-card-mid">
                    <Ring score={s.score} bear={bear} />
                    <span className="alp-stack"><Pill k={a.key} text={a.short} bear={bear} /><SwingTag l={s.label} /></span>
                    <InfoDot onOpen={openSideInfo} />
                  </div>
                  <SwingFoot c={s.c} now={A.now} />
                </button>
              );
            })
            : intraList.map(s => (
              <button key={s.ticker} type="button" className="alp-card" onClick={() => openPick(s.ticker)}>
                <div className="alp-card-top">
                  <StockLogo sym={s.ticker} size={17} />
                  <b>{s.ticker}</b>
                  <span className={`mono ${cls(s.m.chg ?? 0)}`} title="Change today">{fracPct(s.m.chg)}</span>
                </div>
                <Spark pts={s.m.closes} title="Today's 5-minute closes" />
                <div className="alp-card-mid">
                  <Ring score={s.score} bear={bear} />
                  <span className="alp-stack"><Pill k={s.action.key} text={s.action.label} bear={bear} /><SetupTag s={s} /></span>
                  <InfoDot onOpen={openSideInfo} />
                </div>
                <div className="alp-card-foot">
                  <span title="Relative volume at this time of day · distance from VWAP">
                    RVOL {s.m.rvol == null ? "—" : `${s.m.rvol.toFixed(1)}×`} · {sign(((s.m.price - s.m.vwap) / s.m.vwap) * 100)} vs VWAP
                  </span>
                </div>
              </button>
            ))}
        </div>
      </section>

      <div className="alp-grid">
        <div className="alp-panel alp-screens">
          <div className="alp-panel-h"><b>Stock Screens</b><span>{SCREENS.length} screens</span></div>
          <div className="alp-screen-list">
            {SCREENS.map(s => {
              const n = rowsBy.get(s.id)?.length ?? 0;
              return (
                <button key={s.id} type="button" className={`alp-screen${s.id === screen.id ? " on" : ""}`} onClick={() => { setScreenId(s.id); setSel(null); }}>
                  <span className="t"><b>{s.label}</b><em>{s.pending ? "No feed" : `${n} ${n === 1 ? "stock" : "stocks"}`}</em></span>
                  <span className="d">{s.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="alp-panel alp-list">
          <div className="alp-panel-h wrap">
            <b>{screen.label}</b>
            <span className="grow">{screen.desc}</span>
            <div className="alp-seg" role="group" aria-label="Rows to show">
              {([10, 20, 50] as const).map(n => (
                <button key={n} type="button" className={topN === n ? "on" : ""} onClick={() => setTopN(n)}>Top {n}</button>
              ))}
            </div>
          </div>
          {rows.length === 0 ? (
            <div className="alp-empty">
              <b>{screen.pending ? "Awaiting live data" : "No matches right now"}</b>
              <span>{screen.pending ?? "No stocks currently meet this screen."}</span>
            </div>
          ) : (
            <>
              <div className="alp-cols"><span>#</span><span>Stock</span><span className="r">Price</span></div>
              <div className="alp-rows">
                {rows.map((r, i) => (
                  <button key={r.ticker} type="button" className={`alp-row${curRow?.ticker === r.ticker ? " on" : ""}`} onClick={() => setSel(r.ticker)}>
                    <span className="n">{i + 1}</span>
                    <span className="who"><StockLogo sym={r.ticker} size={21} /><span className="nm"><b>{r.ticker}</b><small>{r.name}</small></span></span>
                    <span className="px mono">
                      <span>{r.price == null ? "—" : fmtPrice(r.price)}</span>
                      {r.pct != null && <small className={cls(r.pct)}>{r.pct > 0 ? "▲ " : r.pct < 0 ? "▼ " : ""}{sign(r.pct)}</small>}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="alp-panel alp-detail">
          {curRow ? (
            <>
              <div className="alp-detail-h">
                <StockLogo sym={curRow.ticker} size={27} />
                <div className="t">
                  <span className="l1"><b>{curRow.ticker}</b><span>{curRow.name}</span></span>
                  <span className="l2 mono">
                    {curRow.sector ? `${curRow.sector} · ` : ""}<b>{curRow.price == null ? "—" : fmtPrice(curRow.price)}</b>{" "}
                    {curRow.pct != null && <i className={cls(curRow.pct)}>{sign(curRow.pct)}</i>}
                  </span>
                </div>
                {curSig && <div className="alp-detail-sc"><InfoDot onOpen={() => openRules(curRow.ticker)} /><Ring score={curSig.score} size={56} /></div>}
              </div>
              <div className="alp-detail-chart">
                <PriceChart key={curRow.ticker} sym={curRow.ticker} />
              </div>
              {curSig ? (
                <div className="alp-detail-b">
                  <div className="alp-meta">
                    <span className="k up">MarketCatalyst Emergence</span>
                    <span className="k2">Action</span><Pill k={curSig.action.key} text={curSig.action.short} bear={false} />
                    <span className="k2">Trend</span><SwingTag l={curSig.label} />
                    {curSig.c.week5ChangePct != null && (
                      <span className={`d mono ${cls(curSig.c.week5ChangePct)}`} title="5-session price change">{sign(curSig.c.week5ChangePct)} 5D</span>
                    )}
                  </div>
                  <div className="alp-on">
                    <span className="k">On {screen.label}</span>
                    <span className="w">{colorSigned(curRow.why)}{screen.model && <small>Based on MarketCatalyst Emergence components</small>}</span>
                  </div>
                  <p className="alp-sum">{curSig.why.map(w => w.title).join(", ")}. {curSig.action.why}</p>
                  <div>
                    <div className="alp-k">Structure</div>
                    {curSig.comps.map(x => <CompRow key={x.key} x={x} small={`${x.status} · ${x.weight}% weight`} />)}
                  </div>
                  <div className="alp-two">
                    <div><div className="alp-k up">Supporting</div>{curSig.sup.map(x => <div key={x} className="alp-li">{x}</div>)}</div>
                    <div><div className="alp-k down">Challenging</div>{curSig.opp.map(x => <div key={x} className="alp-li">{x}</div>)}</div>
                  </div>
                  <div className="alp-kr"><i /><div><b>Key risk.</b> <span>{curSig.keyRisk}</span></div></div>
                </div>
              ) : (
                <div className="alp-unscored">
                  <span className="ring">—</span>
                  <b>Emergence Score pending</b>
                  <p>{colorSigned(curRow.why)}</p>
                  <small>{curRow.ticker} doesn&apos;t have enough signal inputs yet to be scored — at least two of the five components need data.</small>
                </div>
              )}
              <div className="alp-detail-f">
                <button type="button" className="alp-btn ghost" onClick={() => openStockDetail(curRow.ticker, rows.map(r => r.ticker))}>Open Full Chart</button>
                <button type="button" className="alp-btn" onClick={() => enterSI(curRow.ticker)}>Stock Intelligence →</button>
              </div>
            </>
          ) : (
            <div className="alp-unscored"><b>Nothing selected</b><p>Pick a screen with matches to see a stock&apos;s Emergence breakdown.</p></div>
          )}
        </div>
      </div>

      <div className="alp-foot">
        MarketCatalyst LLC is not a registered investment advisor and does not manage client assets. Alpha Signals scores are model outputs for research purposes, not recommendations or probabilities of return.
      </div>

      {(swingPick || intraPick) && modalHost && createPortal(
        <div className="alp-scrim" onClick={() => setPickSym(null)}>
          <div
            className="alp-modal" role="dialog" aria-modal="true"
            aria-label={`${pickSym} ${bear ? "under pressure" : mode === "Intraday" ? "intraday plan" : "action plan"}`}
            onClick={e => e.stopPropagation()}
          >
            {swingPick && !bear && (
              <SwingBullBody
                p={swingPick} pos={pos} now={A.now} starred={starOf(swingPick.c.ticker)}
                onStar={e => void toggleWatch(swingPick.c.ticker, e)}
                onInfo={openSideInfo} onPrev={() => nextPick(-1)} onNext={() => nextPick(1)} onClose={() => setPickSym(null)}
                onExplore={() => { setPickSym(null); enterSI(swingPick.c.ticker); }}
                onViewFullChart={() => { setPickSym(null); openStockDetail(swingPick.c.ticker, listTickers); }}
              />
            )}
            {swingPick && bear && (
              <SwingBearBody
                p={swingPick} onInfo={openSideInfo} onClose={() => setPickSym(null)}
                onExplore={() => { setPickSym(null); enterSI(swingPick.c.ticker); }}
                onViewFullChart={() => { setPickSym(null); openStockDetail(swingPick.c.ticker, listTickers); }}
              />
            )}
            {intraPick && !bear && (
              <IntraBullBody
                s={intraPick} pos={pos} open={A.open} starred={starOf(intraPick.ticker)}
                onStar={e => void toggleWatch(intraPick.ticker, e)}
                onInfo={openSideInfo} onPrev={() => nextPick(-1)} onNext={() => nextPick(1)} onClose={() => setPickSym(null)}
                onExplore={() => { setPickSym(null); enterSI(intraPick.ticker); }}
                onViewFullChart={() => { setPickSym(null); openStockDetail(intraPick.ticker, listTickers); }}
              />
            )}
            {intraPick && bear && (
              <IntraBearBody
                s={intraPick} onInfo={openSideInfo} onClose={() => setPickSym(null)}
                onExplore={() => { setPickSym(null); enterSI(intraPick.ticker); }}
                onViewFullChart={() => { setPickSym(null); openStockDetail(intraPick.ticker, listTickers); }}
              />
            )}
          </div>
        </div>, modalHost)}

      {popup && modalHost && createPortal(
        <div className="alp-scrim hi" onClick={() => setPopup(null)}>
          <div className="alp-modal sm" role="dialog" aria-modal="true" aria-label="How the Emergence Score works" onClick={e => e.stopPropagation()}>
            {popup.kind === "side"
              ? <SideInfo mode={mode} dir={dir} onClose={() => setPopup(null)} />
              : rulesSig
                ? <Rulebook s={rulesSig} onClose={() => setPopup(null)} />
                : <SideInfo mode="Swing" dir="Bullish" onClose={() => setPopup(null)} />}
          </div>
        </div>, modalHost)}

      {wlPicker && (
        <WatchlistPicker
          sym={wlPicker.sym} watchlists={watchlists} tickerLimit={tickerLimit}
          onAdd={id => addTicker(id, wlPicker.sym)} onRemove={id => removeTicker(id, wlPicker.sym)}
          onCreate={name => createList(name)} onClose={() => setWlPicker(null)} anchor={{ x: wlPicker.x, y: wlPicker.y }}
        />
      )}

      {toast && <div className={`alp-toast${toast.kind === "error" ? " err" : ""}`} role={toast.kind === "error" ? "alert" : "status"}>{toast.text}</div>}
    </div>
  );
}

// ───────────────────────────── Pick popups ─────────────────────────────

function Star({ starred, onStar }: { starred: boolean; onStar: (e: React.MouseEvent<HTMLButtonElement>) => void }) {
  return (
    <button type="button" className={`alp-star${starred ? " on" : ""}`} aria-pressed={starred} title={starred ? "Remove from Watchlist" : "Add to Watchlist"} onClick={onStar}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill={starred ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" /></svg>
    </button>
  );
}

function Step({ pos, onPrev, onNext }: { pos: string; onPrev: () => void; onNext: () => void }) {
  return (
    <div className="step">
      <button type="button" aria-label="Previous pick" title="Previous pick" onClick={onPrev}><Chevron dir="l" /></button>
      <span className="mono">{pos}</span>
      <button type="button" aria-label="Next pick" title="Next pick" onClick={onNext}><Chevron dir="r" /></button>
    </div>
  );
}

const Close = ({ onClose }: { onClose: () => void }) => <button type="button" className="x" aria-label="Close" onClick={onClose}>×</button>;

const SHORT_RISK = "Short idea — shorting carries extra risk: losses are not capped, shares must be borrowed (fees, recalls) and squeezes can be sharp. Rule-based levels on live prices, not personalised advice.";

function Foot({ onExplore, onViewFullChart }: { onExplore: () => void; onViewFullChart?: () => void }) {
  return (
    <div className="alp-modal-f" style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
      {onViewFullChart && <button type="button" className="alp-btn ghost" onClick={onViewFullChart}>View Full Chart</button>}
      <button type="button" className="alp-btn" onClick={onExplore}>Stock Intelligence →</button>
    </div>
  );
}

function SwingBullBody({ p, pos, now, starred, onStar, onInfo, onPrev, onNext, onClose, onExplore, onViewFullChart }: {
  p: Signal; pos: string; now: number; starred: boolean;
  onStar: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onInfo: () => void; onPrev: () => void; onNext: () => void; onClose: () => void; onExplore: () => void;
  onViewFullChart: () => void;
}) {
  const c = p.c;
  const plan = planOf(c, p.risk, "bull");
  const best = [...p.comps].filter(x => x.value != null).sort((a, b) => (b.value as number) - (a.value as number));
  const weakest = best[best.length - 1];
  const er = c.nextEarningsDate && Date.parse(c.nextEarningsDate) >= now - DAY ? fmtDay(c.nextEarningsDate) : null;
  const ex = exchangeLabel(c.exchange);
  const strengthens = [
    best[0] ? `${best[0].label} stays strong` : null,
    c.sma50 != null ? `Price holds above its 50-day average (${fmtPrice(c.sma50)})` : "Price holds its current trend",
    "More signal families line up behind the setup",
  ].filter((x): x is string => !!x);
  const weakens = [
    weakest ? `${weakest.label} deteriorates` : null,
    c.sma50 != null ? `Price closes below its 50-day average (${fmtPrice(c.sma50)})` : "Price loses its current trend",
    c.rsi14 != null && c.rsi14 >= 50 ? "RSI falls back under 50" : "Signal confluence falls below 50",
  ].filter((x): x is string => !!x);
  const story = [
    c.monthChangePct != null ? `${sign(c.monthChangePct)} over the last month` : null,
    p.fromHigh != null ? `${p.fromHigh > -0.05 ? "at" : `${Math.abs(p.fromHigh).toFixed(1)}% below`} its 52-week high` : null,
  ].filter(Boolean).join(" · ");

  return (
    <>
      <div className="alp-modal-h">
        <StockLogo sym={c.ticker} size={28} />
        <div className="who">
          <div className="l1">
            <b>{c.ticker}</b>
            <Star starred={starred} onStar={onStar} />
            <span className="nm">{c.name}</span>
            <span className="alp-mode swing">Swing</span>
            <SwingTag l={p.label} />
            {p.tags.length > 0 && <span className="alp-tags">{p.tags.map(t => <i key={t.text} className={t.warn ? "w" : undefined}>{t.text}</i>)}</span>}
          </div>
          <div className="l2 mono">
            {[ex, c.sector].filter(Boolean).join(" · ")}{ex || c.sector ? " · " : ""}<b>{fmtPrice(c.price)}</b>{" "}
            <i className={cls(c.pctChange ?? 0)}>{pctTxt(c.pctChange)}</i>
          </div>
        </div>
        <div className="sc">
          <div className="r"><InfoDot onOpen={onInfo} /><Ring score={p.score} size={44} /></div>
          <small>Emergence{c.week5ChangePct != null && <> · <span className={cls(c.week5ChangePct)}>{sign(c.week5ChangePct)} 5D</span></>}</small>
        </div>
        <Step pos={pos} onPrev={onPrev} onNext={onNext} />
        <Close onClose={onClose} />
      </div>

      <div className="alp-modal-b">
        <div className={`alp-act ${actCls(p.action.key, false)}`}>
          <div className="top">
            <span className="alp-k">Suggested action</span>
            <b>{p.action.label}</b>
            <span className="why">{p.action.why}</span>
          </div>
          <div className="plan">
            <div><span className="alp-k">Entry zone</span><b className="mono">{plan.entry}</b></div>
            <div><span className="alp-k">Invalidation</span><b className="mono down" title={`Set ${plan.stopWhy}`}>{plan.stop} <small>{plan.stopPct}</small></b></div>
            <div><span className="alp-k">Horizon</span><b>{plan.horizon}</b></div>
            <div><span className="alp-k">Position size</span><b>{plan.size}</b></div>
          </div>
          <small className="fn">{plan.fn}</small>
        </div>

        <div className="alp-why">
          <div className="alp-k vio">Why it&apos;s a top pick</div>
          {p.why.map(w => (
            <div key={w.title} className="li"><i style={{ background: w.good ? "var(--up)" : "var(--down)" }} /><div><b>{w.title}.</b> <span>{w.body}</span></div></div>
          ))}
          <div className="li"><i style={{ background: "var(--warn)" }} /><div><b className="warn">Key risk.</b> <span>{p.keyRisk}</span></div></div>
        </div>

        <div className="alp-cols2">
          <div>
            <div className="alp-k-row"><span className="alp-k">Signal breakdown</span><InfoDot onOpen={onInfo} /></div>
            {p.comps.map(x => <CompRow key={x.key} x={x} small={`${x.status} · ${x.weight}% weight`} />)}
          </div>
          <div className="alp-hist">
            <PriceChart sym={c.ticker} />
            {story && <div className="story">{story[0].toUpperCase() + story.slice(1)}.</div>}
            <div className="stats">
              <div><span className="alp-k">Risk</span><b style={{ color: p.risk === "Elevated" || p.risk === "High" ? "var(--warn)" : p.risk === "Low" ? "var(--up)" : undefined }}>{p.risk ?? "—"}</b></div>
              <div><span className="alp-k">Next earnings</span><b>{er ?? "—"}</b></div>
              <div><span className="alp-k">Data</span><b className="mono">{p.coverage}%</b></div>
            </div>
          </div>
        </div>

        <div className="alp-four">
          <div><div className="alp-k up">Supporting</div>{p.sup.map(x => <div key={x} className="alp-li">{x}</div>)}</div>
          <div><div className="alp-k down">Challenging</div>{p.opp.map(x => <div key={x} className="alp-li">{x}</div>)}</div>
          <div><div className="alp-k">Strengthens if</div>{strengthens.map(x => <div key={x} className="alp-li">{x}</div>)}</div>
          <div><div className="alp-k">Weakens if</div>{weakens.map(x => <div key={x} className="alp-li">{x}</div>)}</div>
        </div>
      </div>
      <Foot onExplore={onExplore} onViewFullChart={onViewFullChart} />
    </>
  );
}

function SwingBearBody({ p, onInfo, onClose, onExplore, onViewFullChart }: { p: Signal; onInfo: () => void; onClose: () => void; onExplore: () => void; onViewFullChart: () => void }) {
  const c = p.c;
  const plan = planOf(c, p.risk, "bear");
  const w = bearWhy(p);
  const vs = (lvl: number | null | undefined) => (lvl && c.price ? ` ${sign((c.price / lvl - 1) * 100)}` : "");
  return (
    <>
      <div className="alp-modal-h">
        <StockLogo sym={c.ticker} size={28} />
        <div className="who">
          <div className="l1">
            <b>{c.ticker}</b>
            <span className="nm">{c.name}</span>
            <span className="alp-mode swing">Swing</span>
            <SwingTag l={p.label} />
          </div>
          <div className="l2 mono">
            {c.sector ? `${c.sector} · ` : ""}<b>{fmtPrice(c.price)}</b>{" "}
            <i className={cls(c.pctChange ?? 0)}>{pctTxt(c.pctChange)}</i>
          </div>
        </div>
        <div className="sc">
          <div className="r"><InfoDot onOpen={onInfo} /><Ring score={p.score} size={44} bear /></div>
          <small>Emergence · lower = weaker</small>
        </div>
        <Close onClose={onClose} />
      </div>
      <div className="alp-modal-b">
        <div className="alp-closed">{SHORT_RISK}</div>
        <div className={`alp-act ${actCls(p.bear.key, true)}`}>
          <div className="top">
            <span className="alp-k">Suggested action</span>
            <b>{p.bear.label}</b>
            <span className="why">{p.bear.why}</span>
          </div>
          <div className="plan">
            <div><span className="alp-k">Short entry zone</span><b className="mono">{plan.entry}</b></div>
            <div><span className="alp-k">Cover stop (above)</span><b className="mono down" title={`Set ${plan.stopWhy}`}>{plan.stop} <small>{plan.stopPct}</small></b></div>
            <div><span className="alp-k">Horizon</span><b>{plan.horizon}</b></div>
            <div><span className="alp-k">Position size</span><b>{plan.size}</b></div>
          </div>
          <small className="fn">{plan.fn}</small>
        </div>
        <div className="alp-why">
          <div className="alp-k down">Why it&apos;s on the short list</div>
          <div className="li"><i style={{ background: "var(--down)" }} /><div><b>{w.title}.</b> <span>{w.body}</span></div></div>
        </div>
        <div className="alp-cols2">
          <div>
            <div className="alp-k-row"><span className="alp-k">Signal breakdown</span><InfoDot onOpen={onInfo} /></div>
            {p.comps.map(x => <CompRow key={x.key} x={x} />)}
          </div>
          <div className="alp-hist">
            <div className="alp-k">Levels to watch</div>
            <div className="stats lv">
              <div><span className="alp-k">50-day average</span><b className="mono">{c.sma50 != null ? `${usd(c.sma50)}${vs(c.sma50)}` : "—"}</b></div>
              <div><span className="alp-k">52-week high</span><b className="mono">{c.high52 != null ? `${usd(c.high52)}${vs(c.high52)}` : "—"}</b></div>
              <div><span className="alp-k">5-day move</span><b className="mono">{c.week5ChangePct != null ? sign(c.week5ChangePct) : "—"}</b></div>
              <div><span className="alp-k">1-month move</span><b className="mono">{c.monthChangePct != null ? sign(c.monthChangePct) : "—"}</b></div>
              <div><span className="alp-k">RSI (14)</span><b className="mono">{c.rsi14 != null ? Math.round(c.rsi14) : "—"}</b></div>
              <div><span className="alp-k">Risk</span><b className="mono">{p.risk ?? "—"}</b></div>
            </div>
          </div>
        </div>
        <div className="alp-four">
          <div>
            <div className="alp-k">Cover / reassess if</div>
            <div className="alp-li">{c.sma50 != null ? `Price closes back above its 50-day average (${fmtPrice(c.sma50)})` : "Price reclaims its recent trend"}</div>
            <div className="alp-li">The 5-day move turns positive</div>
          </div>
        </div>
      </div>
      <Foot onExplore={onExplore} onViewFullChart={onViewFullChart} />
    </>
  );
}

function IntraHead({ s, children }: { s: IntradaySignal; children?: React.ReactNode }) {
  const c = s.c;
  return (
    <>
      <StockLogo sym={s.ticker} size={28} />
      <div className="who">
        <div className="l1">
          <b>{s.ticker}</b>
          {children}
          {c?.name && <span className="nm">{c.name}</span>}
          <span className="alp-mode intraday">Intraday</span>
          <SetupTag s={s} />
        </div>
        <div className="l2 mono">
          {c?.sector ? `${c.sector} · ` : ""}<b>{fmtPrice(s.m.price)}</b>{" "}
          <i className={cls(s.m.chg ?? 0)}>{fracPct(s.m.chg)}</i>
        </div>
      </div>
    </>
  );
}

function stopPct(s: IntradaySignal) {
  if (!s.plan) return "";
  const p = ((s.plan.stop / s.m.price) - 1) * 100;
  return `${p > 0 ? "+" : "−"}${Math.abs(p).toFixed(1)}%`;
}

function IntraBullBody({ s, pos, open, starred, onStar, onInfo, onPrev, onNext, onClose, onExplore, onViewFullChart }: {
  s: IntradaySignal; pos: string; open: boolean; starred: boolean;
  onStar: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onInfo: () => void; onPrev: () => void; onNext: () => void; onClose: () => void; onExplore: () => void;
  onViewFullChart: () => void;
}) {
  const m = s.m;
  const plan = s.plan;
  const avail = s.comps.filter(x => x.value != null).sort((a, b) => (b.value as number) - (a.value as number));
  const weakest = avail[avail.length - 1];
  const keyRisk = s.caps.length
    ? `Held at Building by ${s.caps.join("; ")}.`
    : weakest && plan
      ? `${weakest.label} is the weakest input (${weakest.value}/100); a stop at ${(plan.stopDist * 100).toFixed(1)}% leaves little room if VWAP is lost.`
      : "A loss of VWAP would undo the setup.";
  return (
    <>
      <div className="alp-modal-h">
        <IntraHead s={s}><Star starred={starred} onStar={onStar} /></IntraHead>
        <div className="sc">
          <div className="r"><InfoDot onOpen={onInfo} /><Ring score={s.score} size={44} /></div>
          <small>Intraday · {s.status}</small>
        </div>
        <Step pos={pos} onPrev={onPrev} onNext={onNext} />
        <Close onClose={onClose} />
      </div>
      <div className="alp-modal-b">
        {!open && <div className="alp-closed">Market closed — this is the last session. Levels refresh at the next open.</div>}
        <div className={`alp-act ${actCls(s.action.key, false)}`}>
          <div className="top">
            <span className="alp-k">Suggested action</span>
            <b>{s.action.label}</b>
            <span className="why">{s.action.why}</span>
          </div>
          <div className="plan five">
            <div><span className="alp-k">Entry zone</span><b className="mono">{plan ? `${usd(plan.zoneLo)} – ${usd(plan.zoneHi)}` : "—"}</b></div>
            <div><span className="alp-k">Invalidation</span><b className="mono down">{plan ? usd(plan.stop) : "—"} <small>{stopPct(s)}</small></b></div>
            <div><span className="alp-k">Targets (1R · 2R)</span><b className="mono up">{plan?.t1 != null && plan.t2 != null ? `${usd(plan.t1)} · ${usd(plan.t2)}` : "—"}</b></div>
            <div><span className="alp-k">Horizon</span><b>Intraday · exit by close</b></div>
            <div><span className="alp-k">Position size</span><b>{plan?.size ?? "—"}</b></div>
          </div>
          <small className="fn">Book half at 1R, trail the rest to 2R · Rule-based levels on live prices, not personalised advice</small>
        </div>
        <div className="alp-why">
          <div className="alp-k vio">Why it&apos;s on the list</div>
          <div className="li"><i style={{ background: "var(--up)" }} /><div><b>{s.setup.name}.</b> <span>{s.desc}</span></div></div>
          <div className="li"><i style={{ background: "var(--warn)" }} /><div><b className="warn">Key risk.</b> <span>{keyRisk}</span></div></div>
        </div>
        <div className="alp-cols2">
          <div>
            <div className="alp-k-row"><span className="alp-k">Signal breakdown</span><InfoDot onOpen={onInfo} /></div>
            {s.comps.map(x => <CompRow key={x.key} x={x} />)}
          </div>
          <div className="alp-hist">
            <div className="alp-k">Session levels</div>
            <div className="stats lv">
              <div><span className="alp-k">VWAP</span><b className="mono">{usd(m.vwap)}</b></div>
              <div><span className="alp-k">Open range</span><b className="mono">{usd(m.orLow)}–{usd(m.orHigh)}</b></div>
              <div><span className="alp-k">Prior day high</span><b className="mono">{usd(m.priorHigh)}</b></div>
              <div><span className="alp-k">Day range</span><b className="mono">{usd(m.dayLow)}–{usd(m.dayHigh)}</b></div>
              <div><span className="alp-k">RVOL</span><b className="mono">{m.rvol == null ? "—" : `${m.rvol.toFixed(1)}×`}</b></div>
              <div><span className="alp-k">Data</span><b className="mono">{s.coverage}%</b></div>
            </div>
          </div>
        </div>
        <div className="alp-four">
          <div><div className="alp-k up">Supporting</div>{s.comps.filter(x => (x.value ?? 0) >= 60).map(x => <div key={x.key} className="alp-li">{x.label} — {x.metric}</div>)}</div>
          <div><div className="alp-k down">Challenging</div>{s.comps.filter(x => x.value != null && x.value < 50).map(x => <div key={x.key} className="alp-li">{x.label} — {x.metric}</div>)}</div>
          <div>
            <div className="alp-k">Strengthens if</div>
            <div className="alp-li">Holds above the trigger level ({usd(s.setup.trigger)}) and VWAP ({usd(m.vwap)})</div>
            <div className="alp-li">Volume stays above its normal pace for this time of day</div>
          </div>
          <div>
            <div className="alp-k">Weakens if</div>
            <div className="alp-li">Closes back below VWAP ({usd(m.vwap)})</div>
            <div className="alp-li">Trades through the invalidation level ({plan ? usd(plan.stop) : "—"})</div>
          </div>
        </div>
      </div>
      <Foot onExplore={onExplore} onViewFullChart={onViewFullChart} />
    </>
  );
}

function IntraBearBody({ s, onInfo, onClose, onExplore, onViewFullChart }: { s: IntradaySignal; onInfo: () => void; onClose: () => void; onExplore: () => void; onViewFullChart: () => void }) {
  const m = s.m;
  const plan = s.plan;
  return (
    <>
      <div className="alp-modal-h">
        <IntraHead s={s} />
        <div className="sc">
          <div className="r"><InfoDot onOpen={onInfo} /><Ring score={s.score} size={44} bear /></div>
          <small>Emergence · lower = weaker</small>
        </div>
        <Close onClose={onClose} />
      </div>
      <div className="alp-modal-b">
        <div className="alp-closed">{SHORT_RISK}</div>
        <div className={`alp-act ${actCls(s.action.key, true)}`}>
          <div className="top">
            <span className="alp-k">Suggested action</span>
            <b>{s.action.label}</b>
            <span className="why">{s.action.why}</span>
          </div>
          <div className="plan five">
            <div><span className="alp-k">Short entry zone</span><b className="mono">{plan ? `${usd(plan.zoneLo)} – ${usd(plan.zoneHi)}` : "—"}</b></div>
            <div><span className="alp-k">Cover stop (above)</span><b className="mono down">{plan ? usd(plan.stop) : "—"} <small>{stopPct(s)}</small></b></div>
            <div><span className="alp-k">Targets (1R · 2R down)</span><b className="mono up">{plan?.t1 != null && plan.t2 != null ? `${usd(plan.t1)} · ${usd(plan.t2)}` : "—"}</b></div>
            <div><span className="alp-k">Horizon</span><b>Intraday · cover by close</b></div>
            <div><span className="alp-k">Position size</span><b>{plan?.size ?? "—"}</b></div>
          </div>
          <small className="fn">Book half at 1R, trail the rest to 2R · Check borrow availability before trading</small>
        </div>
        <div className="alp-why">
          <div className="alp-k down">Why it&apos;s on the short list</div>
          <div className="li"><i style={{ background: "var(--down)" }} /><div><b>{s.setup.name}.</b> <span>{s.desc}</span></div></div>
          {s.caps.length > 0 && <div className="li"><i style={{ background: "var(--warn)" }} /><div><b className="warn">Held back.</b> <span>{s.caps.join("; ")}.</span></div></div>}
        </div>
        <div className="alp-cols2">
          <div>
            <div className="alp-k-row"><span className="alp-k">Signal breakdown</span><InfoDot onOpen={onInfo} /></div>
            {s.comps.map(x => <CompRow key={x.key} x={x} />)}
          </div>
          <div className="alp-hist">
            <div className="alp-k">Levels to watch</div>
            <div className="stats lv">
              <div><span className="alp-k">VWAP</span><b className="mono">{usd(m.vwap)}</b></div>
              <div><span className="alp-k">Prior-day low</span><b className="mono">{usd(m.priorLow)}</b></div>
              <div><span className="alp-k">Open range</span><b className="mono">{usd(m.orLow)}–{usd(m.orHigh)}</b></div>
              <div><span className="alp-k">Day range</span><b className="mono">{usd(m.dayLow)}–{usd(m.dayHigh)}</b></div>
              <div><span className="alp-k">RVOL</span><b className="mono">{m.rvol == null ? "—" : `${m.rvol.toFixed(1)}×`}</b></div>
              <div><span className="alp-k">Today</span><b className="mono">{fracPct(m.chg)}</b></div>
            </div>
          </div>
        </div>
        <div className="alp-four">
          <div>
            <div className="alp-k">Cover / reassess if</div>
            <div className="alp-li">Price reclaims VWAP ({usd(m.vwap)})</div>
            <div className="alp-li">Volume dries up on the next leg down</div>
          </div>
        </div>
      </div>
      <Foot onExplore={onExplore} onViewFullChart={onViewFullChart} />
    </>
  );
}

// ───────────────────────────── "i" popups ─────────────────────────────

function InfoHead({ title, onClose }: { title: string; onClose: () => void }) {
  return <div className="alp-info-h"><span className="dot">i</span><b>{title}</b><Close onClose={onClose} /></div>;
}

const Row = ({ name, pct, d }: { name: string; pct: number; d: string }) => (
  <div className="alp-info-row"><b>{name}</b><span className="pct mono">{pct}%</span><span className="d">{d}</span></div>
);

type RuleRow = [label: React.ReactNode, desc: string];

function Two({ left, leftTitle, right }: { left: RuleRow[]; leftTitle: [string, string]; right: RuleRow[] }) {
  return (
    <div className="alp-info-two">
      <div>
        <b>{leftTitle[0]} <small>· {leftTitle[1]}</small></b>
        {left.map(([l, d], i) => <div key={i} className="r">{l}<span>{d}</span></div>)}
      </div>
      <div>
        <b>Action <small>· what to do with it</small></b>
        {right.map(([l, d], i) => <div key={i} className="r">{l}<span>{d}</span></div>)}
      </div>
    </div>
  );
}

const dot = (name: string, color?: string) => <span style={color ? { color } : undefined}>● {name}</span>;
const pill = (cl: string, t: string) => <span className={`alp-pill ${cl}`}>{t}</span>;

function SwingComponents({ bear }: { bear: boolean }) {
  const total = KEYS.reduce((a, k) => a + WEIGHTS[k], 0);
  return (
    <div>
      {KEYS.map(k => <Row key={k} name={LABEL[k]} pct={Math.round((WEIGHTS[k] / total) * 100)} d={`${COMP_INFO[k].desc}${bear ? " A weak reading lowers the score." : ""}`} />)}
    </div>
  );
}

const FORMULA = "Score = Σ (weight × component) ÷ Σ weights available";
const MISSING = "Components without data are excluded and the rest re-weighted — never scored as zero. “Data %” shows how much of the total weight had data; below 70% is flagged.";
const SHORT_FOOT = "Shorting carries extra risk: losses are not capped, shares must be borrowed (fees, recalls) and squeezes can be sharp. Cut-offs are design choices, not back-tested. Rule-based levels on live prices — not advice.";

function SideInfo({ mode, dir, onClose }: { mode: Mode; dir: Dir; onClose: () => void }) {
  if (mode === "Intraday" && dir === "Bullish") {
    return (
      <>
        <InfoHead title="How the Intraday score works" onClose={onClose} />
        <p className="alp-info-p">A 0–100 read of how clean today&apos;s setup is, from 5-minute bars. Setups are checked top to bottom and the first match wins; falling and over-stretched names are checked first so they can never show Setup active. <b>It is not a probability of profit.</b></p>
        <Row name="Momentum" pct={25} d="Position in the day's range + distance from VWAP." />
        <Row name="Relative strength" pct={25} d="Today's move vs the S&P 500." />
        <Row name="Volume confirmation" pct={20} d="RVOL vs the same time of day on earlier sessions (not the daily average)." />
        <Row name="Catalyst potential" pct={15} d="News / earnings today + gap size." />
        <Row name="Signal confluence" pct={15} d="Five checks: above VWAP, open-range high, the open, prior-day high, and beating the index." />
        <Two
          leftTitle={["Setups", "what is happening"]}
          left={[
            [dot("Gap & go"), "Gapped up 2–8% and still extending above the open-range high, above VWAP. (Mirror of Gap & drop.)"],
            [dot("Breakout"), "Clears yesterday's high with RVOL ≥ 1.5×, above VWAP. (Mirror of Breakdown.)"],
            [dot("Reversal up"), "Gapped down 2–8%, then reclaimed the open and VWAP. (Mirror of Gap fade.)"],
            [dot("Opening range breakout"), "Broke the first-15-minute high on volume, above VWAP. (Mirror of Opening range breakdown.)"],
            [dot("Failed breakdown"), "Traded below the open-range low, then recovered above it and above VWAP — trapped sellers. (Mirror of Failed breakout.)"],
            [dot("VWAP pullback"), "Up on the day and resting 0–0.5% above VWAP — the classic dip entry. (Mirror of VWAP rejection.)"],
            [dot("Extended"), "More than 3% above VWAP — strong, but too stretched to chase. (Mirror of Extended down.)"],
          ]}
          right={[
            [pill("up", "Setup active"), "Score 70+ (75+ midday), price inside the entry zone, stop 0.3–1.5%, data ≥70%, fresh bars, no choppy tape (4+ VWAP crossings after 10:00), S&P not down 1.5%+, and not against the stock's swing downtrend."],
            [pill("vio", "Building"), "Score 55–69, below the midday bar, or capped by stale or sparse bars, a choppy tape, a heavy sell-off or a swing-trend conflict — wait for the trigger."],
            [pill("dim", "Watch"), "Past the entry zone, stop too wide, extended, or score under 55."],
          ]}
        />
        <div className="alp-info-foot">Thresholds are starting values, not back-tested. Entry zone, stop and targets are rule-based arithmetic on live prices — not advice.</div>
      </>
    );
  }
  if (mode === "Intraday") {
    return (
      <>
        <InfoHead title="How the Intraday short setups work" onClose={onClose} />
        <p className="alp-info-p">The same 0–100 score as everywhere else, from 5-minute bars — <b>the lower it is, the weaker (more bearish) the setup</b>. Setups are checked top to bottom and the first match wins. <b>It is not a probability of profit.</b></p>
        <Row name="Momentum" pct={25} d="Low in the day's range and below VWAP — the weaker, the higher the score." />
        <Row name="Relative strength" pct={25} d="Lagging the S&P 500 today." />
        <Row name="Volume confirmation" pct={20} d="RVOL vs the same time of day on earlier sessions (not the daily average)." />
        <Row name="Catalyst potential" pct={15} d="News / earnings today + gap size." />
        <Row name="Signal confluence" pct={15} d="Five bearish checks: below VWAP, the open-range low, the open, the prior-day low, and lagging the index." />
        <Two
          leftTitle={["Setups", "what is happening"]}
          left={[
            [dot("Gap & drop"), "Gapped down 2–8% and still extending below the open-range low, under VWAP. (Mirror of Gap & go.)"],
            [dot("Breakdown"), "Trades 0.1%+ below yesterday's low, under VWAP, with RVOL ≥ 1.5×. (Mirror of Breakout.)"],
            [dot("Gap fade"), "Gapped up 2%+ and is now below the open and below VWAP — the gap is failing. (Mirror of Reversal up.)"],
            [dot("Failed breakout"), "Traded above the open-range high, then fell back below it and below VWAP — trapped buyers. (Mirror of Failed breakdown.)"],
            [dot("Opening range breakdown"), "Broke the first-15-minute low on volume, under VWAP. (Mirror of Opening range breakout.)"],
            [dot("VWAP rejection"), "Down on the day and bouncing into VWAP (within 0.5% below it) — the classic short entry. (Mirror of VWAP pullback.)"],
            [dot("Extended down"), "More than 3% below VWAP — weak, but too stretched to chase; wait for a bounce. (Mirror of Extended.)"],
          ]}
          right={[
            [pill("down", "Setup active"), "Score 30 or lower (25 or lower midday), price inside the short entry zone just below the trigger, cover stop 0.3–1.5% above price, data ≥70%, fresh bars, no choppy tape (4+ VWAP crossings after 10:00), S&P not up 1.5%+, and not against the stock's swing uptrend."],
            [pill("vio", "Building"), "Score 31–45, or above the midday bar — wait for the break below the trigger."],
            [pill("dim", "Watch"), "Already well below the trigger, cover stop too wide, or score above 45."],
          ]}
        />
        <div className="alp-info-foot">{SHORT_FOOT}</div>
      </>
    );
  }
  if (dir === "Bullish") {
    return (
      <>
        <InfoHead title="How the Emergence Score works — bullish picks" onClose={onClose} />
        <p className="alp-info-p">A 0–100 ranking of how compelling a stock&apos;s setup looks right now, built from five independent signal families. Higher means more signals are lined up together. <b>It is not a probability of profit.</b></p>
        <SwingComponents bear={false} />
        <div className="alp-info-box">
          <span className="alp-k">Formula</span>
          <span className="mono">{FORMULA}</span>
          <span className="d">Each component is scored 0–100 from live fields (levels, growth rates, ratings). The score is a snapshot — no score history is stored, so there is no &ldquo;change in score&rdquo;.</span>
        </div>
        <div className="alp-info-note"><b>Missing data.</b> {MISSING}</div>
        <Two
          leftTitle={["Trend", "how the price is moving"]}
          left={[
            [dot("Emerging", "var(--up)"), "Fresh momentum: 5-day gain of +4% or more, pace ahead of the 1-month average, above the 50-day average, today not red — and not yet stretched (otherwise it reads Extended)."],
            [dot("Strengthening", "var(--alp-up2)"), "5-day gain of +1.5% or more, above the 50-day average."],
            [dot("Pulling back", "var(--warn)"), "5-day gain of +4% or more and above the 50-day, but today is red — a healthy pause."],
            [dot("Breakout", "var(--up)"), "At or within 1.5% of its 52-week high on an up day of 2%+ with RVOL 1.5×+ — a confirmed trigger, not yet stretched."],
            [dot("Extended", "var(--warn)"), "Emerging, Strengthening or Pulling back — but already stretched: up 5%+ today, up 25%+ in 5 days, RSI 80+, or 40%+ above its 50-day average. Momentum is real, but it is a chase; wait for a pullback."],
          ]}
          right={[
            [pill("up", "Setup active"), "Score 75+, trend rising, data ≥70%, no earnings within 5 days, above $5 / $20M traded value, and not stretched: under +5% today, under +25% in 5 days, RSI under 80, within 40% of its 50-day average."],
            [pill("vio", "Building"), "Trend rising with a score of 60–74, or 75+ but capped by earnings within 5 days, an over-extended move (a chase), a deep rebound or low liquidity."],
          ]}
        />
        <div className="alp-info-foot">Lists skip OTC names, quotes older than 5 days and duplicate share classes (one line per company).</div>
      </>
    );
  }
  return (
    <>
      <InfoHead title="How the bearish score works" onClose={onClose} />
      <p className="alp-info-p">The same 0–100 Emergence score used everywhere in the app, built from five signal families — for a stock in a confirmed downtrend <b>the lower the number, the weaker (more bearish) the stock</b>, so the lowest scores are listed first. <b>It is not a probability of profit.</b></p>
      <SwingComponents bear />
      <div className="alp-info-box">
        <span className="alp-k">Formula</span>
        <span className="mono">{FORMULA}</span>
        <span className="d">{MISSING}</span>
      </div>
      <Two
        leftTitle={["Trend", "how the price is moving"]}
        left={[
          [dot("Downtrend", "var(--down)"), "5-day loss of −3% or more, or negative and below the 50-day average."],
          [dot("Rolling over", "var(--down)"), "A fresh turn down: still above its 50-day average but falling 3%+ in 5 days — the mirror of Emerging."],
          [dot("Breakdown", "var(--down)"), "At or within 3% of its 52-week low on a down day of 2%+ with RVOL 1.5×+ — the mirror of Breakout."],
          [dot("Oversold", "var(--warn)"), "Already dropped 20%+ in 5 days or RSI under 25 — a bounce is likely, so wait for it to fail before shorting (the mirror of Extended)."],
        ]}
        right={[
          [pill("down", "Setup active"), "Score 30 or lower, downtrend confirmed, data ≥70%, not up 1.5%+ today, RSI above 25, not already down 20%+ in 5 days, market cap over $500M, no earnings within 5 days, not already down 50%+ from its high, above $5 / $20M traded value."],
          [pill("vio", "Building"), "Score 31–45, or 30 or lower but capped by a bounce today, a washed-out RSI, a drop that already happened, a small cap (squeeze risk), earnings within 5 days or low liquidity."],
          [pill("dim", "Watch"), "Score above 45, data under 70%, or a rally of 3%+ today — wait for the bounce to fade."],
        ]}
      />
      <div className="alp-info-foot">Lists skip OTC names, quotes older than 5 days and duplicate share classes (one line per company). {SHORT_FOOT}</div>
    </>
  );
}

const TREND_RULES: Array<[Trend, string]> = [
  ["Weakening", "5-day ≤ −3%, or 5-day negative and price below its 50-day average."],
  ["Losing momentum", "Price not above its 50-day average while the 5-day is flat or up. Reads Recovering if the 5-day is +4% or more and price is within 5% of the average."],
  ["Under pressure", "Above the 50-day average but down 5% or more today — wait for the close."],
  ["Pulling back", "5-day ≥ +4% and above the 50-day, but today is red — a healthy pause."],
  ["Emerging", "5-day ≥ +4% and faster than the 1-month pace (5-day > 1-month × 5/21), above the 50-day, today not red."],
  ["Strengthening", "5-day ≥ +1.5% and above the 50-day average."],
  ["Stable", "Anything else — no clear direction."],
];
const BULL_LABELS: Array<[DisplayLabel, string]> = [
  ["Extended", "A rising trend that already ran: up 5%+ today, up 25%+ in 5 days, RSI 80+, or price 40%+ above its 50-day. Checked first."],
  ["Breakout", "Within 1.5% of the 52-week high, up 2%+ today, RVOL 1.5×+ — and not Extended."],
  ["Recovering", "Losing momentum, but up 4%+ in 5 days and within 5% of the 50-day — a turn in progress."],
];
const BEAR_LABELS: Array<[DisplayLabel, string]> = [
  ["Oversold", "5-day ≤ −20% or RSI under 25. Checked first."],
  ["Breakdown", "Within 3% of the 52-week low, down 2%+ today, RVOL 1.5×+."],
  ["Bouncing", "Up 1.5%+ today."],
  ["Rolling over", "Still above its 50-day average — a fresh turn down."],
  ["Downtrend", "Otherwise."],
];

/** The full rulebook (Stock Screens "i"): every trend, label and action, the ones that apply highlighted. */
function Rulebook({ s, onClose }: { s: Signal; onClose: () => void }) {
  const t = s.c.ticker;
  const weak = s.trend === "Weakening";
  const rule = (now: boolean, k: React.ReactNode, d: string, key: string, color?: string) => (
    <div key={key} className={`alp-rule${now ? " now" : ""}`}><span className="k" style={color ? { color } : undefined}>{k}</span><span className="d">{d}</span></div>
  );
  const named = (name: string, n?: number) => <>{n != null && <em>{n}</em>}● {name}</>;
  return (
    <>
      <InfoHead title={`How ${t}'s score reads`} onClose={onClose} />
      <p className="alp-info-p">A 0–100 ranking of how compelling a stock&apos;s setup looks right now, built from five independent signal families. Higher means more signals are lined up together. <b>It is not a probability of profit.</b></p>
      <SwingComponents bear={false} />
      <div className="alp-info-box">
        <span className="alp-k">Formula</span>
        <span className="mono">{FORMULA}</span>
        <span className="d">Each component is scored 0–100 from live fields (levels, growth rates, ratings). The score is a snapshot — no score history is stored, so there is no &ldquo;change in score&rdquo;.</span>
      </div>
      <div className="alp-info-note"><b>Missing data.</b> {MISSING}</div>
      <div className="alp-info-note">
        <b>{t} right now.</b> Score {s.score} · data {s.coverage}%{s.c.week5ChangePct != null ? ` · 5-day ${sign(s.c.week5ChangePct)}` : ""}. Every rule is listed below, in the order it is applied; the rows that apply to {t} are highlighted.
      </div>
      <div className="alp-rulebook">
        <div className="alp-rb-h">Trend rules <small>· checked top to bottom, the first match wins</small></div>
        {TREND_RULES.map(([tr, d], i) => rule(s.trend === tr, named(tr, i + 1), d, `t-${tr}`, TREND_TONE[tr]))}
        <div className="alp-rb-sub">Then, on a rising trend (Emerging / Strengthening / Pulling back) or Losing momentum, one of these labels can replace the name</div>
        {BULL_LABELS.map(([l, d]) => rule(s.label === l, named(l), d, `b-${l}`, LABEL_COLOR[l]))}
        <div className="alp-rb-sub">On a Weakening stock (the bearish side), the label is the first that matches</div>
        {BEAR_LABELS.map(([l, d], i) => rule(weak && s.label === l, named(l, i + 1), d, `r-${l}`, LABEL_COLOR[l]))}
        <div className="alp-rb-h">Action rules <small>· what to do with it</small></div>
        <div className="alp-rb-sub">Bullish side (rising trends)</div>
        {rule(s.action.key === "avoid", pill("down", "Avoid"), "Trend is Weakening.", "a-avoid")}
        {rule(s.action.key === "watch", pill("dim", "Watch"), "Trend is Losing momentum, Under pressure or Stable — or data is under 70%, or the score is under 60.", "a-watch")}
        {rule(s.action.key === "alert", pill("vio", "Building"), "Score 60–74. Or 75+ but capped by: earnings within 5 days; Extended (a chase); 50%+ below the 52-week high; price under $5 or traded value under $20M.", "a-build")}
        {rule(s.action.key === "act", pill("up", "Setup active"), "Score 75+, data ≥70%, and none of the caps above.", "a-act")}
        <div className="alp-rb-sub">Bearish side (Weakening stocks · the same score — the lower, the weaker)</div>
        {rule(weak && s.bear.key === "watch", pill("dim", "Watch"), "Data under 70%, up 3%+ today, or score above 45.", "s-watch")}
        {rule(weak && s.bear.key === "alert", pill("vio", "Building"), "Score 31–45. Or 30 or lower but capped by: earnings within 5 days; up 1.5%+ today; RSI under 25; down 20%+ in 5 days; market cap under $500M; 50%+ below the 52-week high; low liquidity.", "s-build")}
        {rule(weak && s.bear.key === "act", pill("down", "Setup active"), "Score 30 or lower and none of the caps above.", "s-act")}
      </div>
    </>
  );
}
