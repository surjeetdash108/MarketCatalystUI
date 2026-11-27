"use client";

/**
 * The charts, tables and cards inside the "What Matters Now" slides. Props are
 * plain data; the wording and arithmetic live in wmn-model.ts.
 */
import { useEffect, useState } from "react";
import {
  analystRowText,
  contributorBars,
  countdown,
  dayLabel,
  epsLine,
  etClock,
  figure,
  guidanceLabel,
  revenueLine,
  sessionLabel,
  signedPoints,
  versusLabel,
} from "./wmn-model";
import type { WmnAnalystRow, WmnCatalyst, WmnContributor, WmnEarningsItem } from "./types/wmn";

/** A clock that re-renders its consumer every `ms`, for the countdowns. */
function useNow(ms: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

const toneOf = (n: number) => (n > 0 ? "up" : n < 0 ? "down" : "flat");

// ───────────────────────────── Slide 1 ─────────────────────────────

/**
 * Diverging bars: who added to (right, green) and who took from (left, red) the
 * S&P 500's move, longest bar = the biggest contribution.
 */
export function ContributorBars({ rows, onTicker }: { rows: WmnContributor[]; onTicker?: (t: string) => void }) {
  const bars = contributorBars(rows);
  return (
    <div className="wmnv-bars" role="img" aria-label="Contribution of the five biggest movers to the S&P 500's move, in percentage points">
      <div className="wmnv-cap">What moved the S&amp;P 500 · points of its % move</div>
      {bars.map((r) => (
        <div className="wmnv-bar-row" key={r.ticker} title={`${r.name}: ${r.changePct > 0 ? "+" : ""}${r.changePct}% on a ${r.weightPct}% weight`}>
          {onTicker ? (
            <button type="button" className="wmnv-t link" onClick={() => onTicker(r.ticker)}>{r.ticker}</button>
          ) : (
            <span className="wmnv-t">{r.ticker}</span>
          )}
          <span className="wmnv-axis">
            <span className="neg">{r.contributionPct < 0 && <i style={{ width: `${r.widthPct}%` }} />}</span>
            <span className="pos">{r.contributionPct > 0 && <i style={{ width: `${r.widthPct}%` }} />}</span>
          </span>
          <span className={`wmnv-v ${toneOf(r.contributionPct)}`}>{signedPoints(r.contributionPct)}</span>
        </div>
      ))}
    </div>
  );
}

// ───────────────────────────── Slide 2 ─────────────────────────────

/** The next 24 hours of releases: time and countdown, then the forecast and prior reading, then the print. */
export function CatalystList({ items }: { items: WmnCatalyst[] }) {
  const now = useNow(30_000);
  return (
    <div className="wmnv-cat">
      {items.map((c) => {
        const cd = c.time && c.status === "upcoming" ? countdown(c.time, now) : null;
        const hasFigures = c.kind !== "speech" && (c.estimate != null || c.previous != null || c.actual != null);
        return (
          <div className="wmnv-cat-row" key={c.id}>
            <span className={`wmnv-dot ${c.importance}`} title={`${c.importance === "high" ? "High" : "Medium"} importance`} />
            <span className="wmnv-cat-name">{c.name}</span>
            <span className="wmnv-cat-when">
              {c.time ? `${dayLabel(c.date, now)} ${etClock(c.time)}` : dayLabel(c.date, now)}
              {cd && <b className={cd.state === "due" ? "due" : undefined}> · {cd.text}</b>}
            </span>
            <span className="wmnv-cat-fig">
              {c.status === "released" ? (
                <>
                  <b>{figure(c.actual, c.unit)}</b>
                  {c.versus && <em className={`vs ${c.versus}`}>{versusLabel(c.versus)}</em>}
                  <span className="dim">Forecast {figure(c.estimate, c.unit)} · Prior {figure(c.previous, c.unit)}</span>
                </>
              ) : hasFigures ? (
                <span className="dim">
                  Forecast {figure(c.estimate, c.unit)} · Prior {figure(c.previous, c.unit)}
                </span>
              ) : (
                <span className="dim">{c.kind === "speech" ? "Speech" : "Figures not yet published"}</span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ───────────────────────────── Slide 3 ─────────────────────────────

export interface EarningsCardData {
  item: WmnEarningsItem;
  /** The move since the regular close, when the latest trade is extended-hours. */
  extended: { pct: number; label: string } | null;
}

/** Up to three report cards: numbers against estimates, guidance, and how the stock reacted. */
export function EarningsCards({ cards, onTicker }: { cards: EarningsCardData[]; onTicker?: (t: string) => void }) {
  return (
    <div className="wmnv-earn">
      {cards.map(({ item, extended }) => {
        const g = guidanceLabel(item.guidance);
        const rev = revenueLine(item);
        const sess = sessionLabel(item.session);
        return (
          <div className="wmnv-earn-card" key={item.ticker}>
            <div className="wmnv-earn-head">
              {onTicker ? (
                <button type="button" className="wmnv-earn-t link" onClick={() => onTicker(item.ticker)}>{item.ticker}</button>
              ) : (
                <span className="wmnv-earn-t">{item.ticker}</span>
              )}
              <span className="wmnv-earn-n" title={item.name}>{item.name}</span>
            </div>
            {sess && <div className="wmnv-earn-s">{sess}</div>}
            <div className="wmnv-earn-l">{epsLine(item)}</div>
            {rev && <div className="wmnv-earn-l">{rev}</div>}
            {g && <div className={`wmnv-chip ${g.tone}`}>{g.text}</div>}
            <div className="wmnv-earn-r">
              {extended ? (
                <>
                  {extended.label} <b className={toneOf(extended.pct)}>{extended.pct > 0 ? "+" : ""}{extended.pct.toFixed(2)}%</b>
                </>
              ) : item.reactionPct != null ? (
                <>
                  Price reaction <b className={toneOf(item.reactionPct)}>{item.reactionPct > 0 ? "+" : ""}{item.reactionPct.toFixed(2)}%</b>
                </>
              ) : (
                <span className="dim">{item.reported ? "Reaction not yet recorded" : "Reaction after the report"}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ───────────────────────────── Slide 6 ─────────────────────────────

/** The company a Stock in Focus note is about: ticker (opens the stock), name, and its live price and move. */
export function FocusTicker({
  ticker,
  name,
  price,
  pct,
  onTicker,
}: {
  ticker: string;
  name: string | null;
  price: string | null;
  pct: number | null;
  onTicker?: (t: string) => void;
}) {
  return (
    <div className="wmnv-focus">
      {onTicker ? (
        <button type="button" className="wmnv-focus-t link" onClick={() => onTicker(ticker)}>{ticker}</button>
      ) : (
        <span className="wmnv-focus-t">{ticker}</span>
      )}
      {name && <span className="wmnv-focus-n">{name}</span>}
      {price && <span className="wmnv-focus-p">{price}</span>}
      {pct != null && <span className={`wmnv-v ${toneOf(pct)}`}>{pct > 0 ? "+" : ""}{pct.toFixed(2)}%</span>}
    </div>
  );
}

// ───────────────────────────── Slide 5 ─────────────────────────────

/** What the biggest names' analysts did, one plain line each. */
export function AnalystRows({ rows }: { rows: WmnAnalystRow[] }) {
  return (
    <div className="wmnv-an">
      {rows.map((r, i) => (
        <div className="wmnv-an-row" key={`${r.ticker}-${r.firm}-${i}`}>
          <span className={`wmnv-an-k ${r.action}`}>{r.action === "upgrade" ? "▲ Upgrade" : r.action === "downgrade" ? "▼ Downgrade" : "● Initiate"}</span>
          <span className="wmnv-an-x">{analystRowText(r)}</span>
        </div>
      ))}
    </div>
  );
}
