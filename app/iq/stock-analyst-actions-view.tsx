"use client";

import { useEffect, useMemo, useState } from "react";
import { DataState, VendorTag, formatUsDate } from "./utils";
import { useApiList } from "./hooks/useApiList";
import { apiGet } from "./backend";
import { useWatchlistsContext } from "./hooks/useWatchlists";
import type { AnalystConsensusDoc, AnalystRatingChange, CompanyDoc } from "./types";
import { buildAnalystActions, type FirmStat, type ProcessedAction } from "./analyst-actions-engine";
import { trendLine, trendWindow } from "./analyst-trend";

type SortKey = "date" | "firm" | "act" | "to" | "pt" | "up" | "score";
const PAGE_SIZE = 20;
/**
 * Calls older than this are hidden until "Show older" is clicked. FMP's full
 * history reaches back to 2012; rows from firms that left coverage years ago
 * (HOFT / Sidoti 2018–2020) read as current and cannot be checked against
 * today's public feeds.
 */
const RECENT_MONTHS = 12;
const COLS = "minmax(95px,.7fr) minmax(150px,1.3fr) minmax(100px,.8fr) minmax(150px,1.2fr) minmax(120px,.9fr) minmax(90px,.7fr) minmax(100px,.9fr)";

/**
 * The stock's own rows from the Analyst Actions screen's "All Actions" table —
 * same calls, same action labels, same % to target and Signal Score, built by
 * the shared analyst-actions-engine from the stock's FMP rating history.
 */
export function StockAnalystActionsView({
  symbol,
  consensusDocs,
  companies,
  livePrice,
  loading,
}: {
  symbol: string;
  consensusDocs: AnalystConsensusDoc[];
  companies: CompanyDoc[];
  livePrice: number | null;
  loading: boolean;
}) {
  const sym = symbol.trim().toUpperCase();
  const { data: firmStatsList } = useApiList<FirmStat>("/market-data/analyst-firm-stats");
  const firmStatsByKey = useMemo(() => new Map(firmStatsList.map((f) => [f.firmKey, f] as const)), [firmStatsList]);

  // Fetch complete rating change history for this stock from FMP grades
  const { data: fullHistory, loading: historyLoading } = useApiList<AnalystRatingChange>(
    sym ? `/market-data/analyst-history?ticker=${encodeURIComponent(sym)}` : null
  );

  const [holdings, setHoldings] = useState<Set<string>>(new Set());
  useEffect(() => {
    apiGet<{ holdings: Array<{ ticker: string }> }>("/api/portfolio")
      .then((res) => setHoldings(new Set((res?.holdings ?? []).map((h) => (h.ticker || "").trim().toUpperCase()))))
      .catch(() => {});
  }, []);
  const { watchlists } = useWatchlistsContext();
  const watchKey = watchlists.map((w) => `${w.id}:${(w.tickers ?? []).join(",")}`).join(";");
  const watchedTickers = useMemo(() => {
    const s = new Set<string>();
    for (const w of watchlists) for (const t of w.tickers ?? []) s.add((t || "").trim().toUpperCase());
    return s;
    // watchKey is the stable identity of the lists.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchKey]);

  const companyMap = useMemo(() => {
    const m = new Map<string, CompanyDoc>();
    for (const c of companies) if (c.ticker) m.set(c.ticker.trim().toUpperCase(), c);
    return m;
  }, [companies]);

  const effectiveConsensusDocs = useMemo(() => {
    const existing = consensusDocs.find((c) => (c.ticker || "").trim().toUpperCase() === sym);
    if (fullHistory && fullHistory.length > 0) {
      if (existing) {
        return [{ ...existing, recentGrades: fullHistory }];
      }
      return [{
        id: sym,
        ticker: sym,
        strongBuy: 0,
        buy: 0,
        hold: 0,
        sell: 0,
        strongSell: 0,
        consensus: "Hold",
        recentGrades: fullHistory,
      }];
    }
    return consensusDocs;
  }, [consensusDocs, fullHistory, sym]);

  const rows = useMemo<ProcessedAction[]>(
    () =>
      buildAnalystActions({
        consensusDocs: effectiveConsensusDocs.filter((c) => (c.ticker || "").trim().toUpperCase() === sym),
        companyMap,
        livePrice: (t) => (t === sym ? livePrice : null),
        firmStatsByKey,
        holdings,
        watchedTickers,
      }),
    [effectiveConsensusDocs, sym, companyMap, livePrice, firmStatsByKey, holdings, watchedTickers],
  );

  // Keyed by symbol, so another stock opens on the recent view again.
  const [olderFor, setOlderFor] = useState<string | null>(null);
  const showOlder = olderFor === sym;
  const cutoff = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - RECENT_MONTHS);
    return d.toISOString().slice(0, 10);
  }, []);
  const olderCount = useMemo(() => rows.filter((r) => r.date < cutoff).length, [rows, cutoff]);
  const visible = useMemo(() => (showOlder ? rows : rows.filter((r) => r.date >= cutoff)), [rows, showOlder, cutoff]);

  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<-1 | 1>(-1);
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [sym]);
  const sorted = useMemo(() => {
    const v = (r: ProcessedAction): string | number =>
      sortKey === "date" ? r.date : sortKey === "firm" ? r.firm : sortKey === "act" ? r.act
        : sortKey === "to" ? r.to : sortKey === "pt" ? r.pt1 : sortKey === "up" ? (r.upPct ?? -Infinity) : r.score;
    return [...visible].sort((a, b) => {
      const x = v(a), y = v(b);
      const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return c * sortDir || b.date.localeCompare(a.date);
    });
  }, [visible, sortKey, sortDir]);
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pg = Math.min(page, pages - 1);
  const shown = sorted.slice(pg * PAGE_SIZE, (pg + 1) * PAGE_SIZE);

  const head = (k: SortKey, label: string, right = false) => (
    <span
      onClick={() => {
        if (sortKey === k) setSortDir((d) => (d === -1 ? 1 : -1));
        else { setSortKey(k); setSortDir(-1); }
      }}
      style={{ cursor: "pointer", userSelect: "none", textAlign: right ? "right" : "left" }}
      title={`Sort by ${label.toLowerCase()}`}
    >
      {label} {sortKey === k ? (sortDir === -1 ? "▼" : "▲") : ""}
    </span>
  );

  // Summary above the table: consensus, average target, and the last 30/90 days' direction.
  const consensus = consensusDocs.find((c) => (c.ticker || "").trim().toUpperCase() === sym) ?? null;
  const today = new Date().toISOString().slice(0, 10);
  const w30 = trendWindow(rows, today, 30);
  const w90 = trendWindow(rows, today, 90);
  const line = trendLine(w30, w90);
  const lineTone = line.startsWith("Leaning bullish") ? "var(--up)" : line.startsWith("Leaning bearish") ? "var(--down)" : "var(--text-hi)";
  const buys = consensus ? consensus.strongBuy + consensus.buy : 0;
  const sells = consensus ? consensus.sell + (consensus.strongSell ?? 0) : 0;
  const holds = consensus ? consensus.hold : 0;
  const rated = buys + holds + sells;
  const target = consensus?.priceTargetConsensus ?? w90.avgTarget;
  const upside = target != null && target > 0 && livePrice != null && livePrice > 0 ? ((target - livePrice) / livePrice) * 100 : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%" }}>
    {(rows.length > 0 || rated > 0) && (
      <div className="card" style={{ width: "100%" }}>
        <div className="card-h"><h3>Analyst summary<span className="sd-unit">what the Street is recommending for {sym}</span></h3><VendorTag v="fmp" /></div>
        <div className="card-b">
          <div style={{ fontSize: ".95rem", fontWeight: 700, color: lineTone, marginBottom: 12 }}>{line}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
            <div>
              <div style={{ fontSize: ".7rem", color: "var(--text-dim-solid)", textTransform: "uppercase", letterSpacing: ".05em" }}>Consensus</div>
              <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--text-hi)" }}>{rated > 0 ? consensus?.consensus : "—"}</div>
              {rated > 0 && (
                <>
                  <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", margin: "6px 0 4px", background: "var(--surface-3)" }}>
                    <div style={{ width: `${(buys / rated) * 100}%`, background: "var(--up)" }} />
                    <div style={{ width: `${(holds / rated) * 100}%`, background: "var(--text-dim-solid)" }} />
                    <div style={{ width: `${(sells / rated) * 100}%`, background: "var(--down)" }} />
                  </div>
                  <div style={{ fontSize: ".72rem", color: "var(--text-dim-solid)" }}>{buys} buy · {holds} hold · {sells} sell</div>
                </>
              )}
            </div>
            <div>
              <div style={{ fontSize: ".7rem", color: "var(--text-dim-solid)", textTransform: "uppercase", letterSpacing: ".05em" }}>Average target</div>
              <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--text-hi)" }}>{target != null && target > 0 ? `$${target.toFixed(2)}` : "—"}</div>
              {upside != null && (
                <div style={{ fontSize: ".72rem", color: upside >= 0 ? "var(--up)" : "var(--down)" }}>{upside >= 0 ? "+" : ""}{upside.toFixed(1)}% from the current price</div>
              )}
            </div>
            {[w30, w90].map((w) => (
              <div key={w.days}>
                <div style={{ fontSize: ".7rem", color: "var(--text-dim-solid)", textTransform: "uppercase", letterSpacing: ".05em" }}>Last {w.days} days</div>
                <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--text-hi)" }}>{w.calls} call{w.calls === 1 ? "" : "s"}</div>
                <div style={{ fontSize: ".72rem", color: "var(--text-dim-solid)" }}>
                  <span className="up">▲ {w.upgrades + w.raises}</span> upgrades / raises · <span className="down">▼ {w.downgrades + w.cuts}</span> downgrades / cuts
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )}
    <div className="card" style={{ width: "100%" }}>
      <div className="card-h" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <h3>Analyst Actions<span className="sd-unit">{visible.length} {visible.length === 1 ? "call" : "calls"}{showOlder ? "" : ` · last ${RECENT_MONTHS} months`}</span></h3>
        <VendorTag v="fmp" />
        {olderCount > 0 && (
          <button type="button" className="pill" onClick={() => { setOlderFor(showOlder ? null : sym); setPage(0); }} style={{ marginLeft: "auto" }}>
            {showOlder ? `Hide older` : `Show older (${olderCount})`}
          </button>
        )}
      </div>
      <div className="card-b" style={{ padding: 0 }}>
        {visible.length === 0 ? (
          <div style={{ padding: 36 }}>
            <DataState
              loading={loading || historyLoading}
              label={rows.length > 0 ? `No analyst actions on ${sym} in the last ${RECENT_MONTHS} months.` : `No analyst rating actions on file for ${sym}.`}
            />
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 880 }}>
              <div style={{ display: "grid", gridTemplateColumns: COLS, gap: 12, padding: "10px 18px", borderBottom: "1px solid var(--border-soft)", background: "var(--surface-1)", fontSize: ".7rem", fontWeight: 700, letterSpacing: ".08em", color: "var(--text-dim-solid)" }}>
                {head("date", "Date")}
                {head("firm", "Firm")}
                {head("act", "Action")}
                {head("to", "Previous → New")}
                {head("pt", "Price Target", true)}
                {head("up", "To Target", true)}
                {head("score", "Signal", true)}
              </div>
              {shown.map((r) => {
                const sc = r.score >= 75 ? "var(--up)" : r.score >= 50 ? "var(--warn)" : "var(--text-dim-solid)";
                return (
                  <div
                    key={r.id}
                    title={r.headline}
                    style={{ display: "grid", gridTemplateColumns: COLS, gap: 12, alignItems: "center", padding: "11px 18px", borderBottom: "1px solid var(--border-soft)", fontSize: ".82rem" }}
                  >
                    <span className="mono" style={{ color: "var(--text-dim-solid)", whiteSpace: "nowrap" }}>{formatUsDate(r.date)}</span>
                    <span style={{ color: "var(--text-hi)", fontWeight: 700 }}>{r.firm}</span>
                    <span style={{ color: r.dir > 0 ? "var(--up)" : r.dir < 0 ? "var(--down)" : "var(--text-dim-solid)", fontWeight: 700 }}>
                      {r.dir > 0 ? "▲ " : r.dir < 0 ? "▼ " : ""}{r.act}
                    </span>
                    <span style={{ color: "var(--text-dim-solid)" }}>
                      {r.from} → <b style={{ color: "var(--text-hi)" }}>{r.to}</b>
                    </span>
                    {r.ptSource === "firm" ? (
                      <span className="mono" style={{ textAlign: "right", color: "var(--text-hi)", fontWeight: 700 }}>
                        ${r.pt1.toFixed(2)}
                      </span>
                    ) : (
                      <span className="mono" title="Not available from data source" style={{ textAlign: "right", color: "var(--text-dim-solid)" }}>—</span>
                    )}
                    <span className="mono" style={{ textAlign: "right", fontWeight: 700, color: r.upPct != null && r.upPct >= 0 ? "var(--up)" : "var(--down)" }}>
                      {r.ptSource === "firm" && r.upPct != null ? `${r.upPct >= 0 ? "+" : ""}${r.upPct.toFixed(1)}%` : "—"}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                      <div style={{ width: 44, height: 4, borderRadius: 2, background: "var(--surface-3)", overflow: "hidden" }}>
                        <div style={{ height: 4, width: `${r.score}%`, background: sc }} />
                      </div>
                      <span className="mono" style={{ fontWeight: 700, color: sc }}>{r.score}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", borderTop: "1px solid var(--border-soft)", fontSize: ".78rem", color: "var(--text-dim-solid)", flexWrap: "wrap", gap: 10 }}>
              <span>Showing {sorted.length === 0 ? 0 : pg * PAGE_SIZE + 1}–{Math.min((pg + 1) * PAGE_SIZE, sorted.length)} of {sorted.length} (Page {pg + 1} of {pages})</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  className="pill"
                  disabled={pg <= 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  style={{ opacity: pg <= 0 ? 0.45 : 1, cursor: pg <= 0 ? "not-allowed" : "pointer" }}
                >
                  ‹ Prev
                </button>
                <span style={{ fontFamily: "var(--f-mono, monospace)", fontSize: ".75rem", padding: "0 6px" }}>
                  {pg + 1} / {pages}
                </span>
                <button
                  type="button"
                  className="pill"
                  disabled={pg >= pages - 1}
                  onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
                  style={{ opacity: pg >= pages - 1 ? 0.45 : 1, cursor: pg >= pages - 1 ? "not-allowed" : "pointer" }}
                >
                  Next ›
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
