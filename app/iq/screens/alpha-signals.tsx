"use client";

import { useMemo, useState } from "react";
import { useApiList } from "../hooks/useApiList";
import { useIQActions } from "../shell";
import { INDEX_MEMBERS } from "../index-constituents";
import type { CompanyDoc } from "../types";
import { StockLogo, DataState, VendorTag, cls, sign, fmtPrice } from "../utils";

/*
 * Alpha Signals — S&P 500 names ranked by an "Emergence score".
 *
 * The score is a transparent composite of fields we already hold, not a
 * back-tested model: relative strength (50%), trend posture vs the 50/200-DMA
 * (25%), RSI momentum band (15%) and relative volume (10%).
 */

type Status = "Emerging" | "Forming" | "Watching";

interface Pick {
  c: CompanyDoc;
  score: number;
  status: Status;
  parts: Array<{ label: string; value: number }>;
}

function score(c: CompanyDoc): Pick | null {
  if (c.price == null || c.rsRating == null) return null;
  const rs = c.rsRating;
  const trend = c.aboveSma50 == null || c.aboveSma200 == null ? 40
    : (c.aboveSma50 ? 50 : 0) + (c.aboveSma200 ? 50 : 0);
  const rsi = c.rsi14;
  // Constructive momentum: best between 50 and 70, fading outside it.
  const mom = rsi == null ? 40 : rsi >= 50 && rsi <= 70 ? 100 : Math.max(0, 100 - Math.min(Math.abs(rsi - 60) - 10, 50) * 2);
  const vol = Math.min(c.rvol ?? 1, 3) / 3 * 100;
  const total = Math.round(rs * 0.5 + trend * 0.25 + mom * 0.15 + vol * 0.1);
  return {
    c, score: total,
    status: total >= 75 ? "Emerging" : total >= 60 ? "Forming" : "Watching",
    parts: [
      { label: "Relative strength", value: Math.round(rs) },
      { label: "Trend", value: Math.round(trend) },
      { label: "Momentum", value: Math.round(mom) },
      { label: "Volume", value: Math.round(vol) },
    ],
  };
}

function summary(p: Pick): string {
  const bits: string[] = [];
  if (p.c.rsRating != null) bits.push(p.c.rsRating >= 80 ? "Relative strength is high" : p.c.rsRating >= 60 ? "Relative strength is improving" : "Relative strength is middling");
  if (p.c.aboveSma50 != null && p.c.aboveSma200 != null)
    bits.push(p.c.aboveSma50 && p.c.aboveSma200 ? "price holds above both moving averages" : "trend is not yet confirmed by both moving averages");
  if (p.c.rvol != null) bits.push(p.c.rvol >= 1.5 ? "volume is running well above normal" : "volume is near normal");
  return bits.join(", ") + ".";
}

export function AlphaSignals() {
  const { openStock } = useIQActions();
  const { data: companies, loading } = useApiList<CompanyDoc>("/market-data/companies");
  const [top, setTop] = useState<10 | 20 | 50>(10);
  const [sel, setSel] = useState<string | null>(null);

  const ranked = useMemo(
    () => companies
      .filter(c => INDEX_MEMBERS.SP500.has(c.ticker))
      .map(score)
      .filter((p): p is Pick => p !== null)
      .sort((a, b) => b.score - a.score),
    [companies],
  );

  if (loading && ranked.length === 0) return <DataState loading label="Scanning the S&P 500…" />;
  if (ranked.length === 0) return <DataState loading={false} label="No S&P 500 signals available yet." />;

  const picks = ranked.slice(0, 8);
  const rows = ranked.slice(0, top);
  const cur = ranked.find(p => p.c.ticker === sel) ?? ranked[0];
  const emerging = ranked.filter(p => p.status === "Emerging").length;
  const forming = ranked.filter(p => p.status === "Forming").length;
  const statusCls = (s: Status) => s === "Emerging" ? "up" : s === "Forming" ? "warn" : "dim";

  return (
    <div className="alp">
      <div className="alp-head">
        <h2>MarketCatalyst Top Picks of the Day</h2>
        <span className="alp-pill"><i className="up" />{emerging} emerging</span>
        <span className="alp-pill"><i className="warn" />{forming} forming</span>
        <VendorTag v={["fmp", "polygon"]} />
      </div>

      <div className="alp-cards">
        {picks.map(p => (
          <button key={p.c.ticker} type="button" className={`alp-card${cur.c.ticker === p.c.ticker ? " on" : ""}`} onClick={() => setSel(p.c.ticker)}>
            <div className="alp-card-top">
              <StockLogo sym={p.c.ticker} size={26} />
              <b>{p.c.ticker}</b>
              <span className={`mono ${cls(p.c.pctChange ?? 0)}`}>{sign(p.c.pctChange ?? 0)}</span>
            </div>
            <div className="alp-card-mid">
              <span className="alp-ring">{p.score}</span>
              <span className={`alp-status ${statusCls(p.status)}`}>{p.status}</span>
            </div>
            <div className="alp-card-foot">RS {Math.round(p.c.rsRating ?? 0)} · RVOL {(p.c.rvol ?? 0).toFixed(1)}×</div>
          </button>
        ))}
      </div>

      <div className="alp-main">
        <div className="alp-list">
          <div className="alp-list-h">
            <b>Top S&amp;P 500</b><span>Ranked by Emergence score</span>
            <div className="alp-seg">
              {([10, 20, 50] as const).map(n => (
                <button key={n} type="button" className={top === n ? "on" : ""} onClick={() => setTop(n)}>Top {n}</button>
              ))}
            </div>
          </div>
          <div className="alp-rows">
            {rows.map((p, i) => (
              <button key={p.c.ticker} type="button" className={`alp-row${cur.c.ticker === p.c.ticker ? " on" : ""}`} onClick={() => setSel(p.c.ticker)}>
                <span className="n">{i + 1}</span>
                <StockLogo sym={p.c.ticker} size={28} />
                <span className="nm"><b>{p.c.ticker}</b><small>{p.c.name ?? "—"}</small></span>
                <span className="sc">{p.score}</span>
                <span className="px mono">{fmtPrice(p.c.price as number)}<small className={cls(p.c.pctChange ?? 0)}>{sign(p.c.pctChange ?? 0)}</small></span>
              </button>
            ))}
          </div>
        </div>

        <div className="alp-detail">
          <div className="alp-detail-h">
            <StockLogo sym={cur.c.ticker} size={44} />
            <div className="t"><b>{cur.c.ticker}</b><small>{cur.c.name}{cur.c.sector ? ` · ${cur.c.sector}` : ""}</small>
              <span className="mono">{fmtPrice(cur.c.price as number)} <i className={cls(cur.c.pctChange ?? 0)}>{sign(cur.c.pctChange ?? 0)}</i></span>
            </div>
            <span className="alp-ring big">{cur.score}</span>
          </div>
          <div className="alp-detail-s">
            <span>Emergence</span>
            <span className={`alp-status ${statusCls(cur.status)}`}>{cur.status}</span>
          </div>
          <p className="alp-sum">{summary(cur)}</p>
          <div className="alp-parts">
            {cur.parts.map(x => (
              <div key={x.label} className="alp-part">
                <span>{x.label}</span>
                <div className="bar"><i style={{ width: `${x.value}%` }} /></div>
                <b>{x.value}</b>
              </div>
            ))}
          </div>
          <button type="button" className="alp-open" onClick={() => openStock(cur.c.ticker)}>Open in Stock Intelligence →</button>
          <div className="alp-note">Composite of relative strength, trend, momentum and volume. Not a prediction or investment advice.</div>
        </div>
      </div>
    </div>
  );
}
