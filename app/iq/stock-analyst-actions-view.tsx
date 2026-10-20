"use client";

import { useEffect, useMemo, useState } from "react";
import { DataState, VendorTag } from "./utils";
import { useApiList } from "./hooks/useApiList";
import { apiGet } from "./backend";
import { useWatchlistsContext } from "./hooks/useWatchlists";
import type { AnalystConsensusDoc, CompanyDoc } from "./types";
import { buildAnalystActions, type FirmStat, type ProcessedAction } from "./analyst-actions-engine";

type SortKey = "date" | "firm" | "act" | "to" | "pt" | "up" | "score";
const PAGE_SIZE = 20;
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

  const rows = useMemo<ProcessedAction[]>(
    () =>
      buildAnalystActions({
        consensusDocs: consensusDocs.filter((c) => (c.ticker || "").trim().toUpperCase() === sym),
        companyMap,
        livePrice: (t) => (t === sym ? livePrice : null),
        firmStatsByKey,
        holdings,
        watchedTickers,
      }),
    [consensusDocs, sym, companyMap, livePrice, firmStatsByKey, holdings, watchedTickers],
  );

  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<-1 | 1>(-1);
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [sym]);
  const sorted = useMemo(() => {
    const v = (r: ProcessedAction): string | number =>
      sortKey === "date" ? r.date : sortKey === "firm" ? r.firm : sortKey === "act" ? r.act
        : sortKey === "to" ? r.to : sortKey === "pt" ? r.pt1 : sortKey === "up" ? (r.upPct ?? -Infinity) : r.score;
    return [...rows].sort((a, b) => {
      const x = v(a), y = v(b);
      const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return c * sortDir || b.date.localeCompare(a.date);
    });
  }, [rows, sortKey, sortDir]);
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

  return (
    <div className="card" style={{ width: "100%" }}>
      <div className="card-h" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <h3>Analyst Actions<span className="sd-unit">{rows.length} {rows.length === 1 ? "call" : "calls"}</span></h3>
        <VendorTag v="fmp" />
      </div>
      <div className="card-b" style={{ padding: 0 }}>
        {rows.length === 0 ? (
          <div style={{ padding: 36 }}>
            <DataState loading={loading} label={`No analyst rating actions on file for ${sym}.`} />
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 880 }}>
              <div style={{ display: "grid", gridTemplateColumns: COLS, gap: 12, padding: "10px 18px", borderBottom: "1px solid var(--border-soft)", background: "var(--surface-1)", fontSize: ".7rem", fontWeight: 700, letterSpacing: ".08em", color: "var(--text-dim-solid)" }}>
                {head("date", "DATE")}
                {head("firm", "FIRM")}
                {head("act", "ACTION")}
                {head("to", "PREVIOUS → NEW")}
                {head("pt", "PRICE TARGET", true)}
                {head("up", "TO TARGET", true)}
                {head("score", "SIGNAL", true)}
              </div>
              {shown.map((r) => {
                const sc = r.score >= 75 ? "var(--up)" : r.score >= 50 ? "var(--warn)" : "var(--text-dim-solid)";
                return (
                  <div
                    key={r.id}
                    title={r.headline}
                    style={{ display: "grid", gridTemplateColumns: COLS, gap: 12, alignItems: "center", padding: "11px 18px", borderBottom: "1px solid var(--border-soft)", fontSize: ".82rem" }}
                  >
                    <span className="mono" style={{ color: "var(--text-dim-solid)", whiteSpace: "nowrap" }}>{r.date.slice(0, 10)}</span>
                    <span style={{ color: "var(--text-hi)", fontWeight: 700 }}>{r.firm}</span>
                    <span style={{ color: r.dir > 0 ? "var(--up)" : r.dir < 0 ? "var(--down)" : "var(--text-dim-solid)", fontWeight: 700 }}>{r.act}</span>
                    <span style={{ color: "var(--text-dim-solid)" }}>
                      {r.from} → <b style={{ color: "var(--text-hi)" }}>{r.to}</b>
                    </span>
                    {r.ptSource === "firm" ? (
                      <span className="mono" style={{ textAlign: "right", color: "var(--text-hi)", fontWeight: 700 }}>
                        ${r.pt1.toFixed(2)}
                        {r.prevPt != null && r.prevPt !== r.pt1 && (
                          <div style={{ fontSize: ".72rem", fontWeight: 500, color: "var(--text-dim-solid)" }}>was ${r.prevPt.toFixed(2)}</div>
                        )}
                      </span>
                    ) : (
                      <span
                        className="mono"
                        title="This firm posted no target with this call; % to target uses the Street consensus"
                        style={{ textAlign: "right", color: "var(--text-dim-solid)" }}
                      >
                        ${r.pt1.toFixed(2)}
                        <div style={{ fontSize: ".72rem" }}>consensus</div>
                      </span>
                    )}
                    <span className="mono" style={{ textAlign: "right", fontWeight: 700, color: r.upPct != null && r.upPct >= 0 ? "var(--up)" : "var(--down)" }}>
                      {r.upPct != null ? `${r.upPct >= 0 ? "+" : ""}${r.upPct.toFixed(1)}%` : "N/A"}
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
            {pages > 1 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 18px", fontSize: ".78rem", color: "var(--text-dim-solid)" }}>
                <span>Showing {pg * PAGE_SIZE + 1}–{Math.min((pg + 1) * PAGE_SIZE, sorted.length)} of {sorted.length}</span>
                <span style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="pill" disabled={pg === 0} onClick={() => setPage(pg - 1)}>‹ Prev</button>
                  <button type="button" className="pill" disabled={pg >= pages - 1} onClick={() => setPage(pg + 1)}>Next ›</button>
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
