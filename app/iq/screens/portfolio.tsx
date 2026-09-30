"use client";

import { useCallback, useEffect, useState } from "react";
import { firebaseAuth } from "../../firebase";
import { apiGet, apiPost, apiDelete } from "../backend";
import { useApiList } from "../hooks/useApiList";
import { useApiResource } from "../hooks/useApiResource";
import { useLiveQuotes } from "../live-quotes-context";
import type { CompanyDoc, HoldingDoc, HoldingHistory } from "../types";
import { cls, arr, sign, DataState, VendorTag } from "../utils";
import { StockPanelLayout, StockListCard, StockRow } from "../stock-panel";
import { TickerSearchField } from "../ticker-search-field";
import { DatePicker, formatDisplayDate } from "../date-picker";
import { AiSummaryCard } from "../ai-summary-card";
import { AiAggregateBlock } from "../ai-aggregate-block";

interface Holding {
  ticker: string;
  shares: number;
  costBasis: number | null;
  purchaseDate: string | null;
}

/** Must match MAX_SHARES / MAX_PRICE in the backend's portfolio.controller.ts. */
const MAX_SHARES = 1_000_000_000;
const MAX_PRICE = 10_000_000;

function usd(v: number) {
  return v >= 1000 ? `$${(v / 1000).toFixed(1)}K` : `$${v.toFixed(2)}`;
}

/** Full-precision currency, e.g. $18,250.00. Sub-dollar prices keep 4 dp. */
function usdExact(v: number) {
  return v.toLocaleString("en-US", {
    style: "currency", currency: "USD",
    minimumFractionDigits: 2, maximumFractionDigits: Math.abs(v) < 1 ? 4 : 2,
  });
}

/** Share counts: whole numbers plain, fractional up to 6 dp, with separators. */
function qty(v: number) {
  return v.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

/** Today in the user's local timezone as YYYY-MM-DD — the date input's max. */
function localToday() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Backend errors arrive as a JSON body string; show just its message. */
function friendlyError(raw: string): string {
  try {
    const msg = (JSON.parse(raw) as { message?: unknown }).message;
    if (typeof msg === "string" && msg) return msg.charAt(0).toUpperCase() + msg.slice(1) + ".";
  } catch { /* not JSON */ }
  return "Couldn't save this purchase. Please try again.";
}

interface AddHoldingErrors { symbol?: string; shares?: string; price?: string; date?: string }

export function PortfolioScreen() {
  const uid = firebaseAuth.currentUser?.uid ?? null;
  const { data: companies, loading: companiesLoading } = useApiList<CompanyDoc>("/market-data/companies");
  const byTicker = new Map(companies.map(c => [c.ticker, c]));

  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [pfSel, setPfSel]       = useState("");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [addOpen, setAddOpen]       = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [newSym, setNewSym]         = useState("");
  const [newShares, setNewShares]   = useState("");
  const [newCost, setNewCost]       = useState("");
  const [newDate, setNewDate]       = useState("");
  // Errors show only after the first submit attempt, then update as the user types.
  const [addTried, setAddTried]     = useState(false);
  const [addSaving, setAddSaving]   = useState(false);
  // True when opened from a holding's history: the symbol is fixed to it.
  const [addLocked, setAddLocked]   = useState(false);
  const [addFailed, setAddFailed]   = useState<string | null>(null);

  // Purchase history dialog.
  const [historySym, setHistorySym] = useState<string | null>(null);
  const [history, setHistory]       = useState<HoldingHistory | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const refreshHoldings = useCallback(async () => {
    if (!uid) return;
    try {
      const { holdings: rows } = await apiGet<{ holdings: HoldingDoc[] }>("/api/portfolio");
      setHoldings(rows.map(r => ({ ticker: r.ticker, shares: r.shares, costBasis: r.costBasis ?? null, purchaseDate: r.purchaseDate ?? null })));
      setPfSel(prev => prev || rows[0]?.ticker || "");
    } catch { /* leave holdings empty */ }
  }, [uid]);

  useEffect(() => { void refreshHoldings(); }, [refreshHoldings]);

  // Live quotes for the holdings (polls /live/quotes every 30s), overlaid on the
  // synced company price so position values/P&L track the live market.
  const quoteTickers = holdings.map(h => h.ticker).slice(0, 25);
  // Shared app-wide poll — identical values to every other live surface.
  const quoteByTickerShared = useLiveQuotes(quoteTickers);

  // Cumulative AI read over the whole portfolio. Deferred until the summary
  // card is expanded: it is collapsed by default, and generating for a card
  // nobody opens wastes a scarce free-tier call. Cached 30 min server-side and
  // re-generated whenever the holdings change.
  const [aiOpen, setAiOpen] = useState(false);
  const aiPath = aiOpen ? "/api/ai/portfolio" : null;
  const quoteByTicker = quoteByTickerShared;

  // Every field beyond ticker/shares/positionSize/conviction comes from the
  // live quote (falling back to the synced companies collection) — a holding
  // with no match still lists (it's the user's data), but its price/change
  // render as "not available" and it's excluded from value/P&L totals.
  const merged = holdings.map(h => {
    const live = byTicker.get(h.ticker);
    const q = quoteByTicker.get(h.ticker);
    const price = q?.price ?? live?.price ?? null;
    const hasLive = price != null;
    // Unrealized = (live price − cost basis) × shares; null without a basis.
    const unrealized = price != null && h.costBasis != null && h.costBasis > 0
      ? (price - h.costBasis) * h.shares : null;
    const unrealizedPct = price != null && h.costBasis != null && h.costBasis > 0
      ? (price - h.costBasis) / h.costBasis * 100 : null;
    return {
      ...h,
      name: live?.name ?? h.ticker,
      price,
      // `live` may be undefined while `price` came from the quote alone, so the
      // old `live!.pctChange` threw and took the whole screen down for any
      // holding missing from the companies collection. Same precedence as
      // `price` above: quote first, companies doc as fallback.
      pctChange: hasLive ? (q?.pctChange ?? live?.pctChange ?? 0) : null,
      live: hasLive,
      unrealized,
      unrealizedPct,
    };
  });
  const priced = merged.filter((h): h is typeof h & { price: number; pctChange: number } => h.price != null);
  // Holdings with no live price are listed but left out of every total.
  const unpriced = merged.length - priced.length;
  // Total unrealized across holdings that carry a basis; null when none do.
  const withBasis = priced.filter(h => h.unrealized != null);
  const unrealizedTotal = withBasis.length ? withBasis.reduce((s, h) => s + (h.unrealized as number), 0) : null;

  const sel      = merged.find(h => h.ticker === pfSel);
  const totalVal = priced.reduce((s, h) => s + h.shares * h.price, 0);
  const dayPL    = priced.reduce((s, h) => s + h.shares * h.price * h.pctChange / 100, 0);
  const green    = priced.filter(h => h.pctChange > 0).length;
  const driver   = priced.length ? [...priced].sort((a, b) => b.shares * b.price - a.shares * a.price)[0] : null;
  const leader   = priced.length ? [...priced].sort((a, b) => b.pctChange - a.pctChange)[0] : null;
  const laggard  = priced.length ? [...priced].sort((a, b) => a.pctChange - b.pctChange)[0] : null;
  const driverWt = driver && totalVal > 0
    ? (driver.shares * driver.price / totalVal * 100).toFixed(0) : "0";

  // ── Add Holding form ──
  // Adding a symbol already held records one more purchase against it: the
  // backend appends a lot and recomputes shares + average cost.
  const today = localToday();
  const addSymbol = newSym.trim().toUpperCase();
  const existing = holdings.find(h => h.ticker === addSymbol) ?? null;
  const addShares = Number(newShares);
  const addPrice = Number(newCost);
  const addErrors: AddHoldingErrors = {};
  if (!addSymbol) addErrors.symbol = "Enter a symbol.";
  if (newShares.trim() === "") addErrors.shares = "Enter the number of shares.";
  else if (!Number.isFinite(addShares) || addShares <= 0) addErrors.shares = "Must be greater than 0.";
  else if (addShares > MAX_SHARES) addErrors.shares = "That quantity is too large.";
  if (newCost.trim() === "") addErrors.price = "Enter the price you paid per share.";
  else if (!Number.isFinite(addPrice) || addPrice <= 0) addErrors.price = "Must be greater than 0.";
  else if (addPrice > MAX_PRICE) addErrors.price = "That price is too large.";
  if (!newDate) addErrors.date = "Choose the purchase date.";
  else if (newDate > today) addErrors.date = "Can't be in the future.";
  const addValid = Object.keys(addErrors).length === 0;
  const shownErrors: AddHoldingErrors = addTried ? addErrors : {};
  // Previews need only a valid quantity and price — not a valid symbol or date.
  const previewOk = !addErrors.shares && !addErrors.price;
  const addTotalCost = previewOk ? addShares * addPrice : null;
  // New position after this buy, for a symbol already held.
  const newPosShares = existing && previewOk ? existing.shares + addShares : null;
  const newPosAvg = existing && previewOk && existing.costBasis != null && newPosShares
    ? (existing.shares * existing.costBasis + addShares * addPrice) / newPosShares : null;

  /** Opens the form. With a symbol, it records another purchase of that
   *  holding and the symbol can't be changed. */
  function openAddHolding(lockedSymbol = "") {
    setNewSym(lockedSymbol); setNewShares(""); setNewCost(""); setNewDate(localToday());
    setAddTried(false); setAddFailed(null);
    setAddLocked(lockedSymbol !== "");
    setAddOpen(true);
  }

  function closeAddHolding() {
    setAddOpen(false);
    setNewSym(""); setNewShares(""); setNewCost(""); setNewDate("");
    setAddTried(false); setAddFailed(null); setAddLocked(false);
  }

  async function addHolding() {
    setAddTried(true);
    if (!addValid || addSaving) return;
    if (!uid) { setAddFailed("Please sign in to save holdings."); return; }
    setAddSaving(true); setAddFailed(null);
    try {
      await apiPost<HoldingDoc>("/api/portfolio/holdings", {
        ticker: addSymbol,
        shares: addShares,
        price: addPrice,
        purchaseDate: newDate,
      });
      // The server owns the merged share count and average — reload rather
      // than recomputing it here.
      await refreshHoldings();
      setPfSel(prev => prev || addSymbol);
      const reopenHistory = historySym === addSymbol;
      closeAddHolding();
      if (reopenHistory) void loadHistory(addSymbol);
    } catch (e) {
      setAddFailed(e instanceof Error && e.message ? friendlyError(e.message) : "Couldn't save this purchase. Please try again.");
    } finally {
      setAddSaving(false);
    }
  }

  // ── Purchase history ──
  const loadHistory = useCallback(async (sym: string) => {
    setHistory(null); setHistoryError(null);
    try {
      setHistory(await apiGet<HoldingHistory>(`/api/portfolio/holdings/${encodeURIComponent(sym)}/lots`));
    } catch {
      setHistoryError("Couldn't load purchase history. Please try again.");
    }
  }, []);

  function openHistory(sym: string) {
    setHistorySym(sym);
    void loadHistory(sym);
  }

  async function removeHolding(sym: string) {
    const next = holdings.find(h => h.ticker !== sym);
    setHoldings(prev => prev.filter(h => h.ticker !== sym));
    if (pfSel === sym) setPfSel(next?.ticker ?? "");
    setConfirmDel(null);
    if (uid) {
      try {
        await apiDelete(`/api/portfolio/holdings/${encodeURIComponent(sym)}`);
      } catch { /* optimistic removal above already applied locally */ }
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-sub" style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span>
              {priced.length > 0 && <>{usd(totalVal)} ·{" "}
                <span className={cls(dayPL)}>{dayPL >= 0 ? "+" : ""}{usd(Math.abs(dayPL))} today</span>
              </>}{unrealizedTotal != null && <> ·{" "}
                <span className={cls(unrealizedTotal)}>{unrealizedTotal >= 0 ? "+" : "−"}{usd(Math.abs(unrealizedTotal))} unrealized</span>
              </>}
            </span>
            <VendorTag v="polygon" />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn" onClick={() => setImportOpen(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M4 16l5-5 4 4 3-3 4 4" />
              <circle cx="8.5" cy="8.5" r="1.5" />
            </svg>
            Import from photo
          </button>
          <button className="btn primary" onClick={() => openAddHolding()}>
            <svg viewBox="0 0 24 24" fill="none" style={{ width: 14, height: 14 }}>
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Add holding
          </button>
        </div>
      </div>

      <div style={{ padding: "0 18px 18px" }}>

        {/* AI portfolio summary */}
        <AiSummaryCard title="◆ AI portfolio summary" pill={<span className="pill ai">drivers · leaders · laggards</span>} onOpenChange={(o) => o && setAiOpen(true)} fullHeight>
            {priced.length === 0 ? (
              <DataState loading={companiesLoading} label="No live price data for any current holding yet." />
            ) : (
              <ul className="wmn-body" style={{ columns: 2 }}>
                <li>
                  <span className="bullet" />
                  <span>
                    <b>Biggest driver:</b>{" "}
                    <b style={{ color: "var(--text-hi)" }}>{driver?.ticker ?? "—"}</b> — {sign(driver?.pctChange ?? 0)} at {driverWt}% weight.
                  </span>
                </li>
                <li>
                  <span className="bullet" />
                  <span>
                    <b>Leader:</b> <b className="up">{leader?.ticker} {sign(leader?.pctChange ?? 0)}</b>;{" "}
                    <b>laggard:</b> <b className="down">{laggard?.ticker} {sign(laggard?.pctChange ?? 0)}</b>.
                  </span>
                </li>
                <li>
                  <span className="bullet" />
                  <span>
                    <b>Net:</b> {green} of {priced.length} green; day P/L{" "}
                    <b className={cls(dayPL)}>{dayPL >= 0 ? "+" : ""}{usd(Math.abs(dayPL))}</b>.
                  </span>
                </li>
                <li>
                  <span className="bullet" />
                  <span>Click any holding on the left to see its full analysis →</span>
                </li>
              </ul>
            )}
            <AiAggregateBlock path={aiPath} label="portfolio" />
        </AiSummaryCard>

        <StockPanelLayout
          selectedSym={pfSel}
          chartPx={sel?.price ?? 0}
          chartEmptyText="Select a holding to see chart"
          detailEmptyText="Add a holding to see its detail here."
          listCard={
            <StockListCard
              title="Holdings"
              titleCount={merged.length > 0 ? (unpriced > 0 ? `${merged.length} · ${unpriced} unpriced` : merged.length) : undefined}
              headerRight={
                <span
                  title={unpriced > 0 ? `Excludes ${unpriced} holding${unpriced === 1 ? "" : "s"} without a live price` : undefined}
                  style={{ fontFamily: "var(--f-mono)", fontSize: ".8rem", fontWeight: 700, color: "var(--text-hi)" }}
                >{usd(totalVal)}</span>
              }
              isEmpty={merged.length === 0}
              loading={companiesLoading}
              emptyMessage='No holdings — click "Add holding".'
            >
              {merged.map((f, i) => (
                <StockRow
                  key={f.ticker}
                  sym={f.ticker}
                  name={f.name}
                  seed={i + 3}
                  sparkUp={(f.pctChange ?? 0) >= 0}
                  isSelected={pfSel === f.ticker}
                  onClick={() => setPfSel(f.ticker)}
                  onDelete={() => setConfirmDel(f.ticker)}
                  onHistory={() => openHistory(f.ticker)}
                  valueTop={f.price == null ? "—" : f.price >= 1000 ? `$${(f.price / 1000).toFixed(2)}K` : `$${f.price.toFixed(2)}`}
                  valueBottom={f.pctChange == null ? "—" : `${arr(f.pctChange)} ${sign(f.pctChange)}`}
                  valueBottomClass={f.pctChange == null ? "" : f.pctChange >= 0 ? "up" : "down"}
                />
              ))}
            </StockListCard>
          }
        />

      </div>

      {/* ── Add Holding / Add Purchase modal ── */}
      {addOpen && (
        <>
          <div className="scrim" onClick={closeAddHolding} />
          <div className="drawer hf-drawer" role="dialog" aria-modal="true" aria-labelledby="hf-title">
            <div className="drawer-h">
              <div style={{ flex: 1 }}>
                <div id="hf-title" className="drawer-title">{existing ? `Add purchase · ${existing.ticker}` : "Add holding"}</div>
                <div className="drawer-sub">
                  {existing ? "Record another buy. Your average cost updates automatically." : "Record a purchase to track its market value and P/L."}
                </div>
              </div>
              <button className="closebtn" onClick={closeAddHolding} aria-label="Close">✕</button>
            </div>
            <form
              className="drawer-b hf-form"
              noValidate
              onSubmit={e => { e.preventDefault(); void addHolding(); }}
            >
              <div className="hf-row">
                <label className="hf-label" htmlFor="hf-symbol">Symbol</label>
                {addLocked ? (
                  <div id="hf-symbol" className="hf-field hf-locked" aria-readonly="true">
                    <span className="hf-locked-sym">{addSymbol}</span>
                    <span className="hf-locked-name">{merged.find(x => x.ticker === addSymbol)?.name ?? ""}</span>
                    <svg className="hf-locked-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="5" y="11" width="14" height="9" rx="2" />
                      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                    </svg>
                  </div>
                ) : (
                  <TickerSearchField id="hf-symbol" value={newSym} onChange={setNewSym} placeholder="Search by symbol or company name" />
                )}
                {shownErrors.symbol && <div className="hf-msg err" role="alert">{shownErrors.symbol}</div>}
              </div>

              {existing && (
                <div className="hf-note" role="status">
                  <span className="hf-note-ic" aria-hidden="true">i</span>
                  <span>
                    You hold <b>{qty(existing.shares)} shares</b> of {existing.ticker}
                    {existing.costBasis != null && <> at an average cost of <b>{usdExact(existing.costBasis)}</b></>}.
                    This purchase will be added to that position.
                  </span>
                </div>
              )}

              <div className="hf-grid">
                <div className="hf-row">
                  <label className="hf-label" htmlFor="hf-shares">Quantity</label>
                  <div className={`hf-field${shownErrors.shares ? " err" : ""}`}>
                    <input
                      id="hf-shares" type="number" inputMode="decimal" min="0" step="any" placeholder="0"
                      autoFocus={addLocked}
                      value={newShares} onChange={e => setNewShares(e.target.value)}
                      aria-invalid={!!shownErrors.shares}
                    />
                    <span className="hf-affix">shares</span>
                  </div>
                  {shownErrors.shares
                    ? <div className="hf-msg err" role="alert">{shownErrors.shares}</div>
                    : <div className="hf-msg">Fractional shares supported.</div>}
                </div>

                <div className="hf-row">
                  <label className="hf-label" htmlFor="hf-cost">Price per share</label>
                  <div className={`hf-field${shownErrors.price ? " err" : ""}`}>
                    <span className="hf-affix pre">$</span>
                    <input
                      id="hf-cost" type="number" inputMode="decimal" min="0" step="any" placeholder="0.00"
                      value={newCost} onChange={e => setNewCost(e.target.value)}
                      aria-invalid={!!shownErrors.price}
                    />
                  </div>
                  {shownErrors.price
                    ? <div className="hf-msg err" role="alert">{shownErrors.price}</div>
                    : <div className="hf-msg">Execution price, excluding fees.</div>}
                </div>
              </div>

              <div className="hf-row">
                <label className="hf-label" htmlFor="hf-date">Purchase date</label>
                <DatePicker id="hf-date" value={newDate} onChange={setNewDate} max={today} invalid={!!shownErrors.date} />
                {shownErrors.date && <div className="hf-msg err" role="alert">{shownErrors.date}</div>}
              </div>

              <div className="hf-summary">
                <div className="hf-sum-row">
                  <span>Purchase amount</span>
                  <b>{addTotalCost != null ? usdExact(addTotalCost) : "—"}</b>
                </div>
                {existing && (
                  <div className="hf-sum-row sub">
                    <span>New position</span>
                    <b>
                      {newPosShares != null ? `${qty(newPosShares)} shares` : "—"}
                      {newPosAvg != null && <> · avg. {usdExact(newPosAvg)}</>}
                    </b>
                  </div>
                )}
              </div>

              {addFailed && <div className="hf-msg err hf-fail" role="alert">{addFailed}</div>}

              <div className="hf-actions">
                <button type="button" className="btn" onClick={closeAddHolding} disabled={addSaving}>Cancel</button>
                <button type="submit" className="btn primary" disabled={addSaving}>
                  {addSaving ? "Saving…" : existing ? "Add purchase" : "Add holding"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* ── Purchase history modal ── */}
      {/* Hidden (not closed) while the Add purchase form is open over it. */}
      {historySym && !addOpen && (() => {
        const h = merged.find(x => x.ticker === historySym);
        const sum = history?.summary;
        const mktValue = h?.price != null && sum ? h.price * sum.shares : null;
        const unreal = mktValue != null && sum?.totalCost != null && !sum.partialCost ? mktValue - sum.totalCost : null;
        const unrealPct = unreal != null && sum?.totalCost ? unreal / sum.totalCost * 100 : null;
        const close = () => { setHistorySym(null); setHistory(null); setHistoryError(null); };
        return (
          <>
            <div className="scrim" onClick={close} />
            <div className="drawer hh-drawer" role="dialog" aria-modal="true" aria-labelledby="hh-title">
              <div className="drawer-h">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div id="hh-title" className="drawer-title">{historySym} <span className="hh-name">{h?.name && h.name !== historySym ? h.name : ""}</span></div>
                  <div className="drawer-sub">Purchase history · newest first</div>
                </div>
                <button className="btn" onClick={() => openAddHolding(historySym)}>+ Add purchase</button>
                <button className="closebtn" onClick={close} aria-label="Close">✕</button>
              </div>
              <div className="drawer-b hh-body">
                {historyError ? (
                  <div className="hh-state">
                    <span>{historyError}</span>
                    <button className="btn" onClick={() => void loadHistory(historySym)}>Retry</button>
                  </div>
                ) : !history || !sum ? (
                  <DataState loading label="Loading purchase history…" />
                ) : (
                  <>
                    <div className="hh-stats">
                      <div className="hh-stat"><span>Shares held</span><b>{qty(sum.shares)}</b></div>
                      <div className="hh-stat"><span>Avg. cost / share</span><b>{sum.avgCost != null ? usdExact(sum.avgCost) : "—"}</b></div>
                      <div className="hh-stat"><span>Total cost</span><b>{sum.totalCost != null ? usdExact(sum.totalCost) : "—"}</b></div>
                      <div className="hh-stat"><span>Market value</span><b>{mktValue != null ? usdExact(mktValue) : "—"}</b></div>
                      <div className="hh-stat">
                        <span>Unrealized P/L</span>
                        <b className={unreal != null ? cls(unreal) : ""}>
                          {unreal != null ? `${unreal >= 0 ? "+" : "−"}${usdExact(Math.abs(unreal))}` : "—"}
                        </b>
                        {unrealPct != null && <em className={cls(unrealPct)}>{unrealPct >= 0 ? "+" : "−"}{Math.abs(unrealPct).toFixed(2)}%</em>}
                      </div>
                    </div>

                    <div className="hh-table-wrap">
                      <table className="hh-table">
                        {/* Fixed widths so every column gets even spacing instead
                            of being sized by its header text. */}
                        <colgroup>
                          <col style={{ width: "17%" }} />
                          <col style={{ width: "11%" }} />
                          <col style={{ width: "11%" }} />
                          <col style={{ width: "13%" }} />
                          <col style={{ width: "16%" }} />
                          <col style={{ width: "14%" }} />
                          <col style={{ width: "18%" }} />
                        </colgroup>
                        <thead>
                          <tr>
                            <th>Trade date</th>
                            <th>Type</th>
                            <th className="num" title="Shares bought in this purchase">Quantity</th>
                            <th className="num" title="Price paid per share">Price</th>
                            <th className="num" title="Quantity × price">Amount</th>
                            <th className="num" title="Total shares you held right after this purchase">Total shares</th>
                            <th className="num" title="Your average cost per share right after this purchase">Running avg. cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {history.lots.map(l => (
                            <tr key={l.id}>
                              <td>{formatDisplayDate(l.date)}</td>
                              <td><span className={`pill ${l.opening ? "flat" : "up"}`}>{l.opening ? "Opening" : "Buy"}</span></td>
                              <td className="num">{qty(l.shares)}</td>
                              <td className="num">{l.price != null ? usdExact(l.price) : "—"}</td>
                              <td className="num">{l.amount != null ? usdExact(l.amount) : "—"}</td>
                              <td className="num">{qty(l.sharesAfter)}</td>
                              <td className="num strong">{l.avgCostAfter != null ? usdExact(l.avgCostAfter) : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="hh-foot">
                      {sum.lotCount} purchase{sum.lotCount === 1 ? "" : "s"}
                      {sum.firstDate && sum.lastDate && sum.firstDate !== sum.lastDate && <> · {formatDisplayDate(sum.firstDate)} – {formatDisplayDate(sum.lastDate)}</>}
                      {" · "}Total shares and running avg. cost show your position right after each purchase, using the weighted-average method.
                      {sum.partialCost && <> The opening position has no recorded price, so it is excluded from the average and P/L.</>}
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        );
      })()}

      {/* ── Import from photo modal ── */}
      {importOpen && (
        <>
          <div className="scrim" onClick={() => setImportOpen(false)} />
          <div className="drawer" style={{ maxHeight: "min(320px,85vh)" }}>
            <div className="drawer-h">
              <div style={{ flex: 1, fontWeight: 700, fontSize: "1.1rem", color: "var(--text-hi)" }}>Import from photo</div>
              <button className="closebtn" onClick={() => setImportOpen(false)}>✕</button>
            </div>
            <div className="drawer-b" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <DataState label="Photo import isn't connected to a live OCR service yet. Add holdings manually for now — this will wire up here once a vendor is integrated." />
            </div>
          </div>
        </>
      )}

      {/* ── Confirm remove holding ── */}
      {confirmDel && (
        <>
          <div className="scrim" style={{ zIndex: 60 }} onClick={() => setConfirmDel(null)} />
          <div style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            background: "var(--surface-1)", border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)", padding: 24, zIndex: 61,
            // maxWidth never binds above a 352px viewport, so the desktop
            // dialog is unchanged; it stops the 320px floor (plus 24px padding
            // each side) overflowing a small phone.
            minWidth: 320, maxWidth: "calc(100vw - 32px)",
            boxShadow: "0 16px 48px rgba(0,0,0,.5)",
          }}>
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-hi)", marginBottom: 8 }}>Remove holding</div>
            <div style={{ fontSize: ".88rem", color: "var(--text)", marginBottom: 20 }}>
              Remove <b style={{ color: "var(--text-hi)" }}>{confirmDel}</b> from your portfolio?
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setConfirmDel(null)}>Cancel</button>
              <button className="btn primary" style={{ background: "var(--down)", borderColor: "var(--down)" }}
                onClick={() => removeHolding(confirmDel)}>Remove</button>
            </div>
          </div>
        </>
      )}

    </>
  );
}
