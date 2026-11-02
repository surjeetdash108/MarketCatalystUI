"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useApiList } from "../hooks/useApiList";
import { useBackendBars } from "../hooks/useBackendBars";
import { useWatchlistsContext } from "../hooks/useWatchlists";
import { useIQActions } from "../shell";
import { WatchlistPicker } from "../watchlist-picker";
import { exchangeLabel } from "../exchange";
import { useSI } from "../si/si-context";
import type { AnalystConsensusDoc, CompanyDoc, IpoEventDoc } from "../types";
import { StockLogo, DataState, VendorTag, cls, sign, fmtPrice } from "../utils";
import {
  COMP_INFO, KEYS, LABEL, SCREENS, WEIGHTS, pickTop, planOf, scoreCompany,
  type ActionKey, type Comp, type ScreenRow, type Signal, type Trend,
} from "../alpha-signals-model";

/*
 * Alpha Signals — discover stocks whose setup is improving.
 *
 * Layout follows the "Alpha Signals v2" design: Top Picks carousel → Stock
 * Screens / screen list / stock detail → action-plan modal and score-info modal.
 * Scoring and the 13 screens live in alpha-signals-model.ts; every figure shown
 * here comes from the live company, analyst and IPO feeds. Not shown because
 * there is no data behind it: score history / "1W score change" and the
 * implied-volatility and short-interest screens.
 */

const TREND_COLOR: Record<Trend, string> = {
  Emerging: "var(--up)", Strengthening: "var(--alp-up2)", Stable: "var(--text-dim-solid)", Weakening: "var(--down)",
};
const ACTION_CLS: Record<ActionKey, string> = { act: "up", alert: "vio", watch: "dim", avoid: "down" };
const DAY = 86_400_000;

const fmtDay = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
const pctTxt = (n: number | null | undefined) => (n == null ? "" : sign(n));

function InfoDot({ onOpen }: { onOpen: () => void }) {
  return (
    <span
      role="button" tabIndex={0} className="alp-i" title="How the Emergence Score is calculated"
      onClick={e => { e.stopPropagation(); e.preventDefault(); onOpen(); }}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); e.preventDefault(); onOpen(); } }}
    >i</span>
  );
}

function Ring({ score, size = 32 }: { score: number; size?: number }) {
  return <span className="alp-ring" style={{ width: size, height: size, fontSize: size >= 50 ? "1.1rem" : size >= 40 ? ".95rem" : ".74rem" }}>{score}</span>;
}

function ActionPill({ s }: { s: Signal }) {
  return <span className={`alp-pill ${ACTION_CLS[s.action.key]}`} title="Action">{s.action.short}</span>;
}

function TrendTag({ t }: { t: Trend }) {
  return <span className="alp-trend" style={{ color: TREND_COLOR[t] }} title="Trend"><i style={{ background: TREND_COLOR[t] }} />{t}</span>;
}

/** Last five sessions' closes from the company doc — real prices, no extra request. */
function Spark5({ c }: { c: CompanyDoc }) {
  const pts = (c.week5Closes ?? []).map(x => x.close).filter(Number.isFinite);
  if (pts.length < 3) return <div className="alp-spark empty" aria-hidden />;
  const lo = Math.min(...pts), hi = Math.max(...pts), span = hi - lo || 1;
  const line = pts.map((v, i) => `${i ? "L" : "M"}${((i * 160) / (pts.length - 1)).toFixed(1)},${(32 - ((v - lo) / span) * 28).toFixed(1)}`).join(" ");
  return (
    <svg className="alp-spark" viewBox="0 0 160 36" preserveAspectRatio="none" role="img" aria-label="Closing prices, last 5 sessions">
      <title>Closing prices, last 5 sessions</title>
      <path d={`${line} L160,36 L0,36 Z`} className="a" />
      <path d={line} className="l" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function CardFoot({ c, now }: { c: CompanyDoc; now: number }) {
  const er = c.nextEarningsDate && Date.parse(c.nextEarningsDate) >= now - DAY ? fmtDay(c.nextEarningsDate) : null;
  const txt = er ? `Earnings ${er}`
    : c.pctFromHigh52 != null ? (c.pctFromHigh52 > -0.05 ? "At 52W high" : `${Math.abs(c.pctFromHigh52).toFixed(1)}% below 52W high`)
    : `RS ${Math.round(c.rsRating ?? 0)} · RVOL ${(c.rvol ?? 0).toFixed(1)}×`;
  return (
    <div className="alp-card-foot">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
      <span>{txt}</span>
    </div>
  );
}

function CompRow({ x }: { x: Comp }) {
  const col = x.value == null ? "var(--text-dim-solid)" : x.value >= 65 ? "var(--up)" : x.value >= 50 ? "var(--warn)" : "var(--down)";
  return (
    <div className="alp-comp" title={x.metric}>
      <div className="nm"><b>{x.label}</b><small>{x.status} · {x.weight}% weight</small></div>
      <div className="bar"><i style={{ width: `${x.value ?? 0}%`, background: col }} /></div>
      <span className="v" style={{ color: col }}>{x.value ?? "—"}</span>
    </div>
  );
}

/** Line + area of the last month's daily closes — the real price path, not a score history. */
function PriceChart({ sym }: { sym: string }) {
  const { bars, loading } = useBackendBars(sym, "3M");
  const [now] = useState(() => Date.now());
  const pts = useMemo(() => {
    const ms = (t: number) => (t < 1e11 ? t * 1000 : t);
    return (bars ?? []).filter(b => ms(b.t) >= now - 31 * DAY).map(b => ({ t: ms(b.t), c: b.c }));
  }, [bars, now]);
  if (loading && pts.length === 0) return <div className="alp-chart-empty">Loading price history…</div>;
  if (pts.length < 3) return <div className="alp-chart-empty">No price history available.</div>;
  const lo = Math.min(...pts.map(p => p.c)), hi = Math.max(...pts.map(p => p.c)), span = hi - lo || 1;
  // Left gutter is wide enough for a 4-digit price with cents ("1,380.00").
  const L = 58, Rt = 552;
  const X = (i: number) => L + (i * (Rt - L)) / (pts.length - 1);
  const Y = (v: number) => 130 - ((v - lo) / span) * 104;
  const line = pts.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(p.c).toFixed(1)}`).join(" ");
  const lab = (i: number) => new Date(pts[i].t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const price = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const mid = Math.floor((pts.length - 1) / 2);
  return (
    <svg className="alp-chart" viewBox="0 0 560 160" role="img" aria-label={`${sym} closing price, last month`}>
      <line x1={L} x2={Rt} y1="26" y2="26" className="g" /><line x1={L} x2={Rt} y1="130" y2="130" className="g2" />
      <text x={L - 6} y="29" textAnchor="end">{price(hi)}</text>
      <text x={L - 6} y="133" textAnchor="end">{price(lo)}</text>
      <path d={`${line} L${X(pts.length - 1)},130 L${L},130 Z`} className="a" />
      <path d={line} className="l" />
      <text x={L} y="152" textAnchor="start">{lab(0)}</text>
      <text x={X(mid)} y="152" textAnchor="middle">{lab(mid)}</text>
      <text x={Rt} y="152" textAnchor="end">{lab(pts.length - 1)}</text>
    </svg>
  );
}

export function AlphaSignals() {
  const { openStockDetail } = useIQActions();
  const { enterSI } = useSI();
  const { watchlists, addTicker, removeTicker, createList, tickerLimit } = useWatchlistsContext();
  const { data: companies, loading } = useApiList<CompanyDoc>("/market-data/companies");
  const { data: analystDocs } = useApiList<AnalystConsensusDoc>("/market-data/analyst-actions");
  const { data: ipos } = useApiList<IpoEventDoc>("/market-data/ipos");
  const [now] = useState(() => Date.now());

  const [screenId, setScreenId] = useState(SCREENS[0].id);
  const [topN, setTopN] = useState<10 | 20 | 50>(10);
  const [sel, setSel] = useState<string | null>(null);
  const [pickSym, setPickSym] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [toast, setToast] = useState<{ text: string; kind: "ok" | "error" } | null>(null);
  const [wlPicker, setWlPicker] = useState<{ sym: string; x: number; y: number } | null>(null);
  const [modalHost, setModalHost] = useState<Element | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const carRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const analyst = useMemo(() => new Map(analystDocs.map(a => [a.ticker, a])), [analystDocs]);
  const sigs = useMemo(
    () => companies.map(c => scoreCompany(c, analyst.get(c.ticker), now)).filter((s): s is Signal => s !== null),
    [companies, analyst, now],
  );
  const sigBy = useMemo(() => new Map(sigs.map(s => [s.c.ticker, s])), [sigs]);
  const picks = useMemo(() => pickTop(sigs, 10), [sigs]);

  const ctx = useMemo(() => ({ companies, sigs, analyst, ipos, now }), [companies, sigs, analyst, ipos, now]);
  const rowsBy = useMemo(() => new Map(SCREENS.map(s => [s.id, s.rows(ctx)])), [ctx]);

  const screen = SCREENS.find(s => s.id === screenId) ?? SCREENS[0];
  const allRows = rowsBy.get(screen.id) ?? [];
  const rows = allRows.slice(0, topN);
  const curRow: ScreenRow | undefined = rows.find(r => r.ticker === sel) ?? rows[0];
  const curSig = curRow ? sigBy.get(curRow.ticker) : undefined;
  const pickIdx = pickSym ? picks.findIndex(p => p.c.ticker === pickSym) : -1;
  const pick = pickIdx >= 0 ? picks[pickIdx] : null;

  const flash = useCallback((text: string, kind: "ok" | "error" = "ok") => {
    clearTimeout(toastTimer.current);
    setToast({ text, kind });
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // Modals portal into the themed .iq-root (see candle-chart.tsx): a hovered
  // .card is transformed and would otherwise trap position:fixed.
  const openModal = useCallback((open: () => void) => {
    setModalHost(rootRef.current?.closest(".iq-root") ?? document.body);
    open();
  }, []);
  const openInfo = useCallback(() => openModal(() => setInfoOpen(true)), [openModal]);
  const openPick = useCallback((t: string) => openModal(() => setPickSym(t)), [openModal]);

  useEffect(() => {
    if (!pickSym && !infoOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (infoOpen) setInfoOpen(false);
      else setPickSym(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pickSym, infoOpen]);

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

  const scrollCards = (dir: -1 | 1) => carRef.current?.scrollBy({ left: dir * carRef.current.clientWidth * 0.8, behavior: "smooth" });

  if (loading && companies.length === 0) return <DataState loading label="Scanning the market…" />;
  if (sigs.length === 0) return <DataState loading={false} label="No Alpha Signals available yet." />;

  const nextPick = (d: -1 | 1) => { if (pickIdx >= 0) setPickSym(picks[(pickIdx + d + picks.length) % picks.length].c.ticker); };

  return (
    <div className="alp" ref={rootRef}>
      <div className="alp-tag">Discover emerging opportunities before they become obvious.</div>

      <section className="alp-sec">
        <div className="alp-sec-h">
          <b>MarketCatalyst Top Picks</b>
          <span className="alp-chip">Swing trades · 2–6 wks</span>
          <span className="alp-sub">Stocks heating up — tap one for the action plan</span>
          <VendorTag v={["fmp", "polygon"]} />
          {picks.length > 0 && (
            <div className="alp-nav">
              <button type="button" aria-label="Previous picks" onClick={() => scrollCards(-1)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg></button>
              <button type="button" aria-label="Next picks" onClick={() => scrollCards(1)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg></button>
            </div>
          )}
        </div>
        {picks.length === 0 && (
          <div className="alp-none">No stocks are heating up with complete enough data right now. The screens below still work.</div>
        )}
        <div className="alp-cards" ref={carRef} hidden={picks.length === 0}>
          {picks.map(p => (
            <button key={p.c.ticker} type="button" className="alp-card" onClick={() => openPick(p.c.ticker)}>
              <div className="alp-card-top">
                <StockLogo sym={p.c.ticker} size={17} />
                <b>{p.c.ticker}</b>
                <span className={`mono ${cls(p.c.pctChange ?? 0)}`} title="Change today">{pctTxt(p.c.pctChange ?? 0)}</span>
              </div>
              <Spark5 c={p.c} />
              <div className="alp-card-mid">
                <Ring score={p.score} />
                <span className="alp-stack"><ActionPill s={p} /><TrendTag t={p.trend} /></span>
                <InfoDot onOpen={openInfo} />
              </div>
              <CardFoot c={p.c} now={now} />
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
              <small>{screen.src}</small>
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
                {curSig && <div className="alp-detail-sc"><InfoDot onOpen={openInfo} /><Ring score={curSig.score} size={56} /></div>}
              </div>
              {curSig ? (
                <div className="alp-detail-b">
                  <div className="alp-meta">
                    <span className="k up">MarketCatalyst Emergence</span>
                    <span className="k2">Action</span><ActionPill s={curSig} />
                    <span className="k2">Trend</span><TrendTag t={curSig.trend} />
                    {curSig.c.week5ChangePct != null && (
                      <span className={`d mono ${cls(curSig.c.week5ChangePct)}`} title="5-session price change">{sign(curSig.c.week5ChangePct)} 5D</span>
                    )}
                  </div>
                  <div className="alp-on">
                    <span className="k">On {screen.label}</span>
                    <span className="w">{curRow.why}{screen.model && <small>Based on MarketCatalyst Emergence components</small>}</span>
                  </div>
                  <p className="alp-sum">{curSig.why.map(w => w.title).join(", ")}. {curSig.action.why}</p>
                  <div>
                    <div className="alp-k">Structure</div>
                    {curSig.comps.map(x => <CompRow key={x.key} x={x} />)}
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
                  <p>{curRow.why}</p>
                  <small>{curRow.ticker} doesn&apos;t have enough signal inputs yet to be scored — at least two of the five components need data.</small>
                </div>
              )}
              <div className="alp-detail-f">
                <button type="button" className="alp-btn ghost" onClick={() => openStockDetail(curRow.ticker, rows.map(r => r.ticker))}>Open Stock</button>
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

      {pick && modalHost && createPortal(
        <div className="alp-scrim" onClick={() => setPickSym(null)}>
          <div className="alp-modal" role="dialog" aria-modal="true" aria-label={`${pick.c.ticker} action plan`} onClick={e => e.stopPropagation()}>
            <PickBody
              p={pick} pos={`${pickIdx + 1} / ${picks.length}`} now={now}
              starred={watchlists.some(w => w.tickers.includes(pick.c.ticker.toUpperCase()))}
              onStar={e => void toggleWatch(pick.c.ticker, e)}
              onInfo={openInfo} onPrev={() => nextPick(-1)} onNext={() => nextPick(1)} onClose={() => setPickSym(null)}
              onExplore={() => { setPickSym(null); enterSI(pick.c.ticker); }}
            />
          </div>
        </div>, modalHost)}

      {infoOpen && modalHost && createPortal(
        <div className="alp-scrim hi" onClick={() => setInfoOpen(false)}>
          <div className="alp-modal sm" role="dialog" aria-modal="true" aria-label="How the Emergence Score works" onClick={e => e.stopPropagation()}>
            <InfoBody onClose={() => setInfoOpen(false)} />
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

function PickBody({ p, pos, now, starred, onStar, onInfo, onPrev, onNext, onClose, onExplore }: {
  p: Signal; pos: string; now: number; starred: boolean;
  onStar: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onInfo: () => void; onPrev: () => void; onNext: () => void; onClose: () => void; onExplore: () => void;
}) {
  const c = p.c;
  const plan = planOf(c.price, p.risk);
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
    c.pctFromHigh52 != null ? `${c.pctFromHigh52 > -0.05 ? "at" : `${Math.abs(c.pctFromHigh52).toFixed(1)}% below`} its 52-week high` : null,
  ].filter(Boolean).join(" · ");

  return (
    <>
      <div className="alp-modal-h">
        <StockLogo sym={c.ticker} size={28} />
        <div className="who">
          <div className="l1">
            <b>{c.ticker}</b>
            <button type="button" className={`alp-star${starred ? " on" : ""}`} aria-pressed={starred} title={starred ? "Remove from Watchlist" : "Add to Watchlist"} onClick={onStar}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill={starred ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" /></svg>
            </button>
            <span className="nm">{c.name}</span>
            <TrendTag t={p.trend} />
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
        <div className="step">
          <button type="button" aria-label="Previous pick" title="Previous pick" onClick={onPrev}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg></button>
          <span className="mono">{pos}</span>
          <button type="button" aria-label="Next pick" title="Next pick" onClick={onNext}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg></button>
        </div>
        <button type="button" className="x" aria-label="Close" onClick={onClose}>×</button>
      </div>

      <div className="alp-modal-b">
        <div className={`alp-act ${ACTION_CLS[p.action.key]}`}>
          <div className="top">
            <span className="alp-k">Suggested action</span>
            <b>{p.action.label}</b>
            <span className="why">{p.action.why}</span>
          </div>
          <div className="plan">
            <div><span className="alp-k">Entry zone</span><b className="mono">{plan.entry}</b></div>
            <div><span className="alp-k">Invalidation</span><b className="mono down">{plan.stop} <small>{plan.stopPct}</small></b></div>
            <div><span className="alp-k">Horizon</span><b>{plan.horizon}</b></div>
            <div><span className="alp-k">Position size</span><b>{plan.size}</b></div>
          </div>
          <small className="fn">{plan.review} · Rule-based levels on the live price, not personalised advice</small>
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
            {p.comps.map(x => <CompRow key={x.key} x={x} />)}
          </div>
          <div className="alp-hist">
            <div className="alp-k-row"><span className="alp-k">Price · 1M</span></div>
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

      <div className="alp-modal-f"><button type="button" className="alp-btn" onClick={onExplore}>Stock Intelligence →</button></div>
    </>
  );
}

function InfoBody({ onClose }: { onClose: () => void }) {
  const total = KEYS.reduce((a, k) => a + WEIGHTS[k], 0);
  const trend: Array<[Trend, string]> = [
    ["Emerging", "5-day gain of +4% or more, pace ahead of the 1-month average, above the 50-day average."],
    ["Strengthening", "5-day gain of +1.5% or more, above the 50-day average."],
    ["Stable", "5-day move between those bounds."],
    ["Weakening", "5-day loss of −3% or more, or negative and below the 50-day average."],
  ];
  const action: Array<[ActionKey, string, string]> = [
    ["act", "Setup active", "Score 75+, trend rising, data coverage ≥70% — the setup is in play."],
    ["alert", "Building", "Trend rising but the score is below 75 — keep an eye on it."],
    ["watch", "Watch", "No clear direction yet — keep it on radar."],
    ["avoid", "Avoid", "Trend is weakening — stay away for now."],
  ];
  return (
    <>
      <div className="alp-info-h"><span className="dot">i</span><b>How the Emergence Score works</b><button type="button" className="x" aria-label="Close" onClick={onClose}>×</button></div>
      <p className="alp-info-p">A 0–100 ranking of how compelling a stock&apos;s setup looks right now, built from five independent signal families. Higher means more signals are lined up together. <b>It is not a probability of profit.</b></p>
      <div>
        {KEYS.map(k => (
          <div key={k} className="alp-info-row">
            <b>{LABEL[k]}</b><span className="pct mono">{Math.round((WEIGHTS[k] / total) * 100)}%</span>
            <span className="d">{COMP_INFO[k].desc}</span>
            <span className="s mono">{COMP_INFO[k].src}</span>
          </div>
        ))}
      </div>
      <div className="alp-info-box">
        <span className="alp-k">Formula</span>
        <span className="mono">Score = Σ (weight × component) ÷ Σ weights available</span>
        <span className="d">Each component is scored 0–100 from live fields (levels, growth rates, ratings). The score is a snapshot — no score history is stored, so there is no &ldquo;change in score&rdquo;.</span>
      </div>
      <div className="alp-info-note"><b>Missing data.</b> Components without data are excluded and the rest re-weighted — never scored as zero. “Data %” shows how much of the total weight had data; below 70% is flagged.</div>
      <div className="alp-info-two">
        <div>
          <b>Trend <small>· how the price is moving</small></b>
          {trend.map(([t, d]) => <div key={t} className="r"><span style={{ color: TREND_COLOR[t] }}>● {t}</span><span>{d}</span></div>)}
        </div>
        <div>
          <b>Action <small>· what to do with it</small></b>
          {action.map(([k, l, d]) => <div key={k} className="r"><span className={`alp-pill ${ACTION_CLS[k]}`}>{l}</span><span>{d}</span></div>)}
        </div>
      </div>
      <div className="alp-info-foot">Weights and cut-offs are initial design choices, not empirically validated. Not investment advice.</div>
    </>
  );
}
