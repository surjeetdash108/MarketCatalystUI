"use client";

import { useCallback, useEffect, useState } from "react";
import { firebaseAuth } from "../../firebase";
import { apiGet, apiPost, apiDelete } from "../backend";
import { useApiList } from "../hooks/useApiList";
import { useApiResource } from "../hooks/useApiResource";
import { useLiveQuotes } from "../live-quotes-context";
import type { CompanyDoc, HoldingDoc, HoldingHistory, HoldingTransaction } from "../types";
import { cls, arr, sign, DataState, VendorTag } from "../utils";
import { StockPanelLayout, StockListCard, StockRow } from "../stock-panel";
import { TickerSearchField } from "../ticker-search-field";
import { DatePicker, formatDisplayDate } from "../date-picker";
import { AiSummaryCard } from "../ai-summary-card";
import { AiAggregateBlock } from "../ai-aggregate-block";

interface Holding {
  ticker: string;
  /** 0 for a closed position (every share sold); its history is kept. */
  shares: number;
  costBasis: number | null;
  realizedPL: number;
  purchaseDate: string | null;
}

type TxType = "buy" | "sell";

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
    if (typeof msg === "string" && msg) {
      const text = msg.charAt(0).toUpperCase() + msg.slice(1);
      return /[.!?]$/.test(text) ? text : `${text}.`;
    }
  } catch { /* not JSON */ }
  return "Couldn't save this transaction. Please try again.";
}

/** Signed currency for P/L, e.g. +$120.00 / −$45.10. */
function signedUsd(v: number) {
  return `${v >= 0 ? "+" : "−"}${usdExact(Math.abs(v))}`;
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
  const [txType, setTxType]         = useState<TxType>("buy");
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

  // Transaction history dialog.
  const [historySym, setHistorySym] = useState<string | null>(null);
  const [history, setHistory]       = useState<HoldingHistory | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  // Single-transaction delete: the row awaiting confirmation.
  const [txnToDelete, setTxnToDelete] = useState<HoldingTransaction | null>(null);
  const [txnDeleting, setTxnDeleting] = useState(false);
  const [txnDeleteError, setTxnDeleteError] = useState<string | null>(null);

  const refreshHoldings = useCallback(async () => {
    if (!uid) return;
    try {
      const { holdings: rows } = await apiGet<{ holdings: HoldingDoc[] }>("/api/portfolio");
      setHoldings(rows.map(r => ({ ticker: r.ticker, shares: r.shares, costBasis: r.costBasis ?? null, realizedPL: r.realizedPL ?? 0, purchaseDate: r.purchaseDate ?? null })));
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
      closed: h.shares <= 0,
    };
  });
  // Closed positions stay listed (for their history) but hold no shares, so
  // they are left out of every total below.
  const openHoldings = merged.filter(h => !h.closed);
  const priced = openHoldings.filter((h): h is typeof h & { price: number; pctChange: number } => h.price != null);
  // Open holdings with no live price are listed but left out of every total.
  const unpriced = openHoldings.length - priced.length;
  const closedCount = merged.length - openHoldings.length;
  const realizedTotal = holdings.reduce((sum, h) => sum + (h.realizedPL || 0), 0);
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

  // ── Add transaction form (buy / sell) ──
  // A buy of a symbol already held is appended to it; a sell reduces it. The
  // backend replays the history to recompute shares, average cost and realized
  // P/L, and rejects a sell larger than the position on its trade date.
  const today = localToday();
  const isSell = txType === "sell";
  const addSymbol = newSym.trim().toUpperCase();
  const existing = holdings.find(h => h.ticker === addSymbol) ?? null;
  const heldNow = existing?.shares ?? 0;
  const addShares = Number(newShares);
  const addPrice = Number(newCost);
  const addErrors: AddHoldingErrors = {};
  if (!addSymbol) addErrors.symbol = isSell ? "Choose a holding to sell." : "Enter a symbol.";
  else if (isSell && heldNow <= 0) addErrors.symbol = `You don't hold ${addSymbol}.`;
  if (newShares.trim() === "") addErrors.shares = "Enter the number of shares.";
  else if (!Number.isFinite(addShares) || addShares <= 0) addErrors.shares = "Must be greater than 0.";
  else if (addShares > MAX_SHARES) addErrors.shares = "That quantity is too large.";
  else if (isSell && heldNow > 0 && addShares > heldNow + 1e-9) addErrors.shares = `You hold ${qty(heldNow)} shares.`;
  if (newCost.trim() === "") addErrors.price = isSell ? "Enter the price you sold at per share." : "Enter the price you paid per share.";
  else if (!Number.isFinite(addPrice) || addPrice <= 0) addErrors.price = "Must be greater than 0.";
  else if (addPrice > MAX_PRICE) addErrors.price = "That price is too large.";
  if (!newDate) addErrors.date = "Choose the trade date.";
  else if (newDate > today) addErrors.date = "Can't be in the future.";
  const addValid = Object.keys(addErrors).length === 0;
  const shownErrors: AddHoldingErrors = addTried ? addErrors : {};
  // Previews need only a valid quantity and price — not a valid symbol or date.
  const previewOk = !addErrors.shares && !addErrors.price;
  const addAmount = previewOk ? addShares * addPrice : null;
  // Buy: the new position. Sell: what is left, and the gain or loss realized.
  const newPosShares = existing && previewOk ? (isSell ? heldNow - addShares : heldNow + addShares) : null;
  const newPosAvg = !isSell && existing && previewOk && heldNow > 0 && existing.costBasis != null && newPosShares
    ? (heldNow * existing.costBasis + addShares * addPrice) / newPosShares : null;
  const saleRealized = isSell && previewOk && existing?.costBasis != null ? addShares * (addPrice - existing.costBasis) : null;
  const sellable = openHoldings.map(h => h.ticker);

  /** Opens the form. With a symbol, the transaction is for that holding and
   *  the symbol can't be changed. */
  function openAddHolding(lockedSymbol = "", type: TxType = "buy") {
    setTxType(type);
    setNewSym(lockedSymbol); setNewShares(""); setNewCost(""); setNewDate(localToday());
    setAddTried(false); setAddFailed(null);
    setAddLocked(lockedSymbol !== "");
    setAddOpen(true);
  }

  function closeAddHolding() {
    setAddOpen(false);
    setNewSym(""); setNewShares(""); setNewCost(""); setNewDate("");
    setAddTried(false); setAddFailed(null); setAddLocked(false); setTxType("buy");
  }

  /** Wraps a field setter so editing any field clears a stale server error. */
  const edit = <T,>(set: (v: T) => void) => (v: T) => { setAddFailed(null); set(v); };

  function switchTxType(next: TxType) {
    if (next === txType) return;
    setTxType(next);
    setAddFailed(null);
    // Selling needs a holding; keep the symbol only if it is one.
    if (next === "sell" && !addLocked && !sellable.includes(addSymbol)) setNewSym("");
  }

  async function addHolding() {
    setAddTried(true);
    if (!addValid || addSaving) return;
    if (!uid) { setAddFailed("Please sign in to save holdings."); return; }
    setAddSaving(true); setAddFailed(null);
    try {
      await apiPost<HoldingDoc>("/api/portfolio/holdings", {
        ticker: addSymbol,
        type: txType,
        shares: addShares,
        price: addPrice,
        tradeDate: newDate,
      });
      // The server owns the replayed shares, average and realized P/L —
      // reload rather than recomputing them here.
      await refreshHoldings();
      setPfSel(prev => prev || addSymbol);
      const reopenHistory = historySym === addSymbol;
      closeAddHolding();
      if (reopenHistory) void loadHistory(addSymbol);
    } catch (e) {
      setAddFailed(e instanceof Error && e.message ? friendlyError(e.message) : "Couldn't save this transaction. Please try again.");
    } finally {
      setAddSaving(false);
    }
  }

  // ── Transaction history ──
  const loadHistory = useCallback(async (sym: string) => {
    setHistory(null); setHistoryError(null);
    try {
      setHistory(await apiGet<HoldingHistory>(`/api/portfolio/holdings/${encodeURIComponent(sym)}/transactions`));
    } catch {
      setHistoryError("Couldn't load transaction history. Please try again.");
    }
  }, []);

  function openHistory(sym: string) {
    setHistorySym(sym);
    void loadHistory(sym);
  }

  function askDeleteTxn(t: HoldingTransaction) {
    setTxnDeleteError(null);
    setTxnToDelete(t);
  }

  async function confirmDeleteTxn() {
    if (!txnToDelete || !historySym || txnDeleting) return;
    const sym = historySym;
    setTxnDeleting(true); setTxnDeleteError(null);
    try {
      const res = await apiDelete<{ holding: HoldingDoc | null }>(
        `/api/portfolio/holdings/${encodeURIComponent(sym)}/transactions/${encodeURIComponent(txnToDelete.id)}`,
      );
      setTxnToDelete(null);
      await refreshHoldings();
      if (res.holding) {
        void loadHistory(sym);
      } else {
        // That was the only transaction, so the holding itself is gone.
        setHistorySym(null); setHistory(null);
        setPfSel(prev => (prev === sym ? holdings.find(h => h.ticker !== sym)?.ticker ?? "" : prev));
      }
    } catch (e) {
      setTxnDeleteError(e instanceof Error && e.message ? friendlyError(e.message) : "Couldn't delete this transaction. Please try again.");
    } finally {
      setTxnDeleting(false);
    }
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
              </>}{Math.abs(realizedTotal) >= 0.005 && <> ·{" "}
                <span className={cls(realizedTotal)}>{realizedTotal >= 0 ? "+" : "−"}{usd(Math.abs(realizedTotal))} realized</span>
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
              titleCount={merged.length > 0
                ? [String(openHoldings.length), unpriced > 0 ? `${unpriced} unpriced` : "", closedCount > 0 ? `${closedCount} closed` : ""].filter(Boolean).join(" · ")
                : undefined}
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
              {/* Open positions first; closed ones (all shares sold) after, dimmed. */}
              {[...openHoldings, ...merged.filter(h => h.closed)].map((f, i) => (
                <StockRow
                  muted={f.closed}
                  tag={f.closed ? undefined : qty(f.shares)}
                  tagTitle={`${qty(f.shares)} ${f.shares === 1 ? "share" : "shares"} held`}
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
                  valueBottom={f.closed ? "Closed" : f.pctChange == null ? "—" : `${arr(f.pctChange)} ${sign(f.pctChange)}`}
                  valueBottomClass={f.closed || f.pctChange == null ? "" : f.pctChange >= 0 ? "up" : "down"}
                />
              ))}
            </StockListCard>
          }
        />

      </div>

      {/* ── Add transaction modal (buy / sell) ── */}
      {addOpen && (
        <>
          <div className="scrim" onClick={closeAddHolding} />
          <div className="drawer hf-drawer" role="dialog" aria-modal="true" aria-labelledby="hf-title">
            <div className="drawer-h">
              <div style={{ flex: 1 }}>
                <div id="hf-title" className="drawer-title">
                  {isSell ? `Sell${addSymbol ? ` · ${addSymbol}` : ""}` : existing ? `Buy more · ${existing.ticker}` : "Add holding"}
                </div>
                <div className="drawer-sub">
                  {isSell
                    ? "Record a sale. Your average cost stays the same and the gain or loss is realized."
                    : existing
                      ? "Record another buy. Your average cost updates automatically."
                      : "Record a purchase to track its market value and P/L."}
                </div>
              </div>
              <button className="closebtn" onClick={closeAddHolding} aria-label="Close">✕</button>
            </div>
            <form
              className="drawer-b hf-form"
              noValidate
              onSubmit={e => { e.preventDefault(); void addHolding(); }}
            >
              <div className="hf-seg" role="radiogroup" aria-label="Transaction type">
                <button type="button" role="radio" aria-checked={!isSell} className={`buy${!isSell ? " on" : ""}`} onClick={() => switchTxType("buy")}>Buy</button>
                <button
                  type="button" role="radio" aria-checked={isSell}
                  className={`sell${isSell ? " on" : ""}`}
                  onClick={() => switchTxType("sell")}
                  disabled={sellable.length === 0 || (addLocked && heldNow <= 0)}
                  title={sellable.length === 0 || (addLocked && heldNow <= 0) ? "No shares to sell" : undefined}
                >Sell</button>
              </div>

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
                ) : isSell ? (
                  // Selling is only possible from an open holding, so offer those.
                  <div className={`hf-field hf-select${shownErrors.symbol ? " err" : ""}`}>
                    <select id="hf-symbol" value={addSymbol} onChange={e => edit(setNewSym)(e.target.value)} autoFocus>
                      <option value="">Choose a holding…</option>
                      {openHoldings.map(h => (
                        <option key={h.ticker} value={h.ticker}>{h.ticker} · {qty(h.shares)} shares</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <TickerSearchField id="hf-symbol" value={newSym} onChange={edit(setNewSym)} placeholder="Search by symbol or company name" />
                )}
                {shownErrors.symbol && <div className="hf-msg err" role="alert">{shownErrors.symbol}</div>}
              </div>

              {existing && (heldNow > 0 || !isSell) && (
                <div className={`hf-note${isSell ? " sell" : ""}`} role="status">
                  <span className="hf-note-ic" aria-hidden="true">i</span>
                  <span>
                    {heldNow > 0 ? (
                      <>
                        You hold <b>{qty(heldNow)} shares</b> of {existing.ticker}
                        {existing.costBasis != null && <> at an average cost of <b>{usdExact(existing.costBasis)}</b></>}.
                        {isSell ? " Sell up to that many shares." : " This purchase will be added to that position."}
                      </>
                    ) : (
                      <>You sold all your {existing.ticker} shares earlier. This buy opens a new position.</>
                    )}
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
                      value={newShares} onChange={e => edit(setNewShares)(e.target.value)}
                      aria-invalid={!!shownErrors.shares}
                    />
                    {isSell && heldNow > 0 && (
                      <button type="button" className="hf-max" onClick={() => edit(setNewShares)(String(heldNow))}>Max</button>
                    )}
                    <span className="hf-affix">shares</span>
                  </div>
                  {shownErrors.shares
                    ? <div className="hf-msg err" role="alert">{shownErrors.shares}</div>
                    : <div className="hf-msg">Fractional shares supported.</div>}
                </div>

                <div className="hf-row">
                  <label className="hf-label" htmlFor="hf-cost">{isSell ? "Sale price per share" : "Price per share"}</label>
                  <div className={`hf-field${shownErrors.price ? " err" : ""}`}>
                    <span className="hf-affix pre">$</span>
                    <input
                      id="hf-cost" type="number" inputMode="decimal" min="0" step="any" placeholder="0.00"
                      value={newCost} onChange={e => edit(setNewCost)(e.target.value)}
                      aria-invalid={!!shownErrors.price}
                    />
                  </div>
                  {shownErrors.price
                    ? <div className="hf-msg err" role="alert">{shownErrors.price}</div>
                    : <div className="hf-msg">Execution price, excluding fees.</div>}
                </div>
              </div>

              <div className="hf-row">
                <label className="hf-label" htmlFor="hf-date">Trade date</label>
                <DatePicker id="hf-date" value={newDate} onChange={edit(setNewDate)} max={today} invalid={!!shownErrors.date} />
                {shownErrors.date && <div className="hf-msg err" role="alert">{shownErrors.date}</div>}
              </div>

              <div className="hf-summary">
                <div className="hf-sum-row">
                  <span>{isSell ? "Sale proceeds" : "Purchase amount"}</span>
                  <b>{addAmount != null ? usdExact(addAmount) : "—"}</b>
                </div>
                {isSell && (
                  <div className="hf-sum-row sub">
                    <span>Realized P/L</span>
                    <b className={saleRealized != null ? cls(saleRealized) : ""}>{saleRealized != null ? signedUsd(saleRealized) : "—"}</b>
                  </div>
                )}
                {existing && (
                  <div className="hf-sum-row sub">
                    <span>{isSell ? "Remaining position" : "New position"}</span>
                    <b>
                      {newPosShares == null ? "—" : newPosShares <= 1e-9 ? "Position closed" : `${qty(newPosShares)} shares`}
                      {newPosAvg != null && <> · avg. {usdExact(newPosAvg)}</>}
                      {isSell && newPosShares != null && newPosShares > 1e-9 && existing.costBasis != null && <> · avg. {usdExact(existing.costBasis)}</>}
                    </b>
                  </div>
                )}
              </div>

              {addFailed && <div className="hf-msg err hf-fail" role="alert">{addFailed}</div>}

              <div className="hf-actions">
                <button type="button" className="btn" onClick={closeAddHolding} disabled={addSaving}>Cancel</button>
                <button type="submit" className={`btn primary${isSell ? " sell" : ""}`} disabled={addSaving}>
                  {addSaving ? "Saving…" : isSell ? "Record sale" : existing ? "Add purchase" : "Add holding"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* ── Transaction history modal ── */}
      {/* Hidden (not closed) while the add form is open over it. */}
      {historySym && !addOpen && (() => {
        const h = merged.find(x => x.ticker === historySym);
        const sum = history?.summary;
        const isClosed = !!sum && sum.shares <= 0;
        const mktValue = h?.price != null && sum && !isClosed ? h.price * sum.shares : null;
        const unreal = mktValue != null && sum?.totalCost != null && !sum.partialCost ? mktValue - sum.totalCost : null;
        const unrealPct = unreal != null && sum?.totalCost ? unreal / sum.totalCost * 100 : null;
        const close = () => { setHistorySym(null); setHistory(null); setHistoryError(null); };
        return (
          <>
            <div className="scrim" onClick={close} />
            <div className="drawer hh-drawer" role="dialog" aria-modal="true" aria-labelledby="hh-title">
              <div className="drawer-h">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div id="hh-title" className="drawer-title">
                    {historySym} <span className="hh-name">{h?.name && h.name !== historySym ? h.name : ""}</span>
                    {isClosed && <span className="pill flat" style={{ marginLeft: 8, verticalAlign: "middle" }}>Closed</span>}
                  </div>
                  <div className="drawer-sub">Transaction history · newest first</div>
                </div>
                <div className="hh-actions">
                  <button className="btn hh-buy" onClick={() => openAddHolding(historySym, "buy")}>Buy</button>
                  <button className="btn hh-sell" onClick={() => openAddHolding(historySym, "sell")} disabled={!sum || isClosed} title={isClosed ? "No shares to sell" : undefined}>Sell</button>
                </div>
                <button className="closebtn" onClick={close} aria-label="Close">✕</button>
              </div>
              <div className="drawer-b hh-body">
                {historyError ? (
                  <div className="hh-state">
                    <span>{historyError}</span>
                    <button className="btn" onClick={() => void loadHistory(historySym)}>Retry</button>
                  </div>
                ) : !history || !sum ? (
                  <DataState loading label="Loading transaction history…" />
                ) : (
                  <>
                    <div className="hh-stats">
                      <div className="hh-stat"><span>Shares held</span><b>{qty(sum.shares)}</b></div>
                      <div className="hh-stat"><span>Avg. cost / share</span><b>{sum.avgCost != null ? usdExact(sum.avgCost) : "—"}</b></div>
                      <div className="hh-stat"><span>Cost basis</span><b>{sum.totalCost != null ? usdExact(sum.totalCost) : "—"}</b></div>
                      <div className="hh-stat"><span>Market value</span><b>{mktValue != null ? usdExact(mktValue) : "—"}</b></div>
                      <div className="hh-stat">
                        <span>Unrealized P/L</span>
                        <b className={unreal != null ? cls(unreal) : ""}>{unreal != null ? signedUsd(unreal) : "—"}</b>
                        {unrealPct != null && <em className={cls(unrealPct)}>{unrealPct >= 0 ? "+" : "−"}{Math.abs(unrealPct).toFixed(2)}%</em>}
                      </div>
                      <div className="hh-stat">
                        <span>Realized P/L</span>
                        <b className={sum.sellCount > 0 ? cls(sum.realizedPL) : ""}>{sum.sellCount > 0 ? signedUsd(sum.realizedPL) : "—"}</b>
                      </div>
                    </div>

                    <div className="hh-table-wrap">
                      <table className="hh-table">
                        {/* Fixed widths so every column gets even spacing instead
                            of being sized by its header text. */}
                        <colgroup>
                          <col style={{ width: "13%" }} />
                          <col style={{ width: "8%" }} />
                          <col style={{ width: "9%" }} />
                          <col style={{ width: "11%" }} />
                          <col style={{ width: "12%" }} />
                          <col style={{ width: "13%" }} />
                          <col style={{ width: "12%" }} />
                          <col style={{ width: "17%" }} />
                          <col style={{ width: "5%" }} />
                        </colgroup>
                        <thead>
                          <tr>
                            <th>Trade date</th>
                            <th>Type</th>
                            <th className="num" title="Shares bought or sold">Quantity</th>
                            <th className="num" title="Price per share">Price</th>
                            <th className="num" title="Quantity × price — cost for a buy, proceeds for a sell">Amount</th>
                            <th className="num" title="Gain or loss locked in by a sale: (sale price − average cost) × shares sold">Realized P/L</th>
                            <th className="num" title="Total shares you held right after this transaction">Total shares</th>
                            <th className="num" title="Your average cost per share right after this transaction">Running avg. cost</th>
                            <th aria-label="Actions" />
                          </tr>
                        </thead>
                        <tbody>
                          {history.transactions.map(t => (
                            <tr key={t.id}>
                              <td>{formatDisplayDate(t.date)}</td>
                              <td><span className={`pill ${t.type === "sell" ? "dn" : "up"}`}>{t.type === "sell" ? "Sell" : "Buy"}</span></td>
                              <td className="num">{t.type === "sell" ? "−" : ""}{qty(t.shares)}</td>
                              <td className="num">{t.price != null ? usdExact(t.price) : "—"}</td>
                              <td className="num">{t.amount != null ? usdExact(t.amount) : "—"}</td>
                              <td className={`num ${t.realizedPL != null ? cls(t.realizedPL) : ""}`}>{t.realizedPL != null ? signedUsd(t.realizedPL) : "—"}</td>
                              <td className="num">{qty(t.sharesAfter)}</td>
                              <td className="num strong">{t.avgCostAfter != null ? usdExact(t.avgCostAfter) : "—"}</td>
                              <td className="hh-act">
                                <button
                                  className="hh-del"
                                  title="Delete transaction"
                                  aria-label={`Delete ${t.type} of ${qty(t.shares)} on ${formatDisplayDate(t.date)}`}
                                  onClick={() => askDeleteTxn(t)}
                                >
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6l-1 14H6L5 6" />
                                    <path d="M10 11v6M14 11v6" />
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="hh-foot">
                      {sum.buyCount} buy{sum.buyCount === 1 ? "" : "s"}
                      {sum.sellCount > 0 && <> · {sum.sellCount} sell{sum.sellCount === 1 ? "" : "s"}</>}
                      {sum.firstDate && sum.lastDate && sum.firstDate !== sum.lastDate && <> · {formatDisplayDate(sum.firstDate)} – {formatDisplayDate(sum.lastDate)}</>}
                      {" · "}Average-cost method: a buy updates the average, a sale keeps it and realizes the gain or loss.
                      {sum.partialCost && <> Part of this position has no recorded price, so it is excluded from the average and P/L.</>}
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        );
      })()}

      {/* ── Delete one transaction: confirmation ── */}
      {txnToDelete && historySym && (() => {
        const t = txnToDelete;
        const isOnly = (history?.transactions.length ?? 0) <= 1;
        const cancel = () => { if (!txnDeleting) { setTxnToDelete(null); setTxnDeleteError(null); } };
        return (
          <>
            <div className="scrim" style={{ zIndex: 60 }} onClick={cancel} />
            <div className="txd-dialog" role="alertdialog" aria-modal="true" aria-labelledby="txd-title" aria-describedby="txd-desc">
              <div id="txd-title" className="txd-title">Delete transaction</div>
              <div id="txd-desc" className="txd-body">
                <div className="txd-row">
                  <span className={`pill ${t.type === "sell" ? "dn" : "up"}`}>{t.type === "sell" ? "Sell" : "Buy"}</span>
                  <b>{qty(t.shares)} {historySym}</b>
                  {t.price != null && <span>at {usdExact(t.price)}</span>}
                  <span className="txd-date">{formatDisplayDate(t.date)}</span>
                </div>
                <p>
                  {isOnly
                    ? <>This is the only transaction for <b>{historySym}</b>, so the holding will be removed from your portfolio.</>
                    : <>Shares, average cost and realized P/L will be recalculated without it.</>}
                  {" "}This can&apos;t be undone.
                </p>
              </div>
              {txnDeleteError && <div className="hf-msg err txd-err" role="alert">{txnDeleteError}</div>}
              <div className="txd-actions">
                <button className="btn" onClick={cancel} disabled={txnDeleting}>Cancel</button>
                <button className="btn primary sell" onClick={() => void confirmDeleteTxn()} disabled={txnDeleting} autoFocus>
                  {txnDeleting ? "Deleting…" : isOnly ? "Delete and remove holding" : "Delete"}
                </button>
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
