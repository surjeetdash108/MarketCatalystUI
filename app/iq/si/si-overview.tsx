"use client";

import { Fragment, useState, type ReactNode } from "react";
import { OVX_OVERVIEW_CSS } from "./si-redesign-css";

/**
 * The Stock Intelligence Overview from the redesign: a growth chart and the MC Confidence ring with its
 * signal scores on top, and below them a left menu (MarketCatalyst read, Fundamentals, Technicals,
 * Why it moved, Why it could move) whose panel opens beside it.
 *
 * This file only draws. Every number and sentence arrives through `OverviewData`, built from the stock's
 * real data in stock-intelligence.tsx; a part with no data is left out rather than filled in.
 */

export type Tone = "up" | "down" | "flat";
export type PaneId = "read" | "fund" | "tech" | "moved" | "could";

/** One quarter of growth, in percent against the year-ago quarter (yoy) and the quarter before (qoq). */
export type GrowthRow = { label: string; yoy: number | null; qoq: number | null };
/** A growth series, oldest quarter first. */
export type GrowthSeries = { key: "rev" | "eps"; name: string; rows: GrowthRow[] };
export type ScoreRow = { k: string; v: number };
export type NavItem = { id: PaneId; label: string; status: string; tone: Tone };
export type ReadLevel = { price: number; title: string; priceText: string; sub: string };

export type OverviewData = {
  growth: GrowthSeries[];
  scores: ScoreRow[];
  conf: number | null;
  /** The ring and the score rows open the "how MC Confidence is calculated" view. */
  onScores: () => void;
  nav: NavItem[];
  read: {
    headline: string;
    body: string;
    now: number | null;
    nowText: string;
    low: ReadLevel | null;
    high: ReadLevel | null;
    onInfo: () => void;
  };
  panels: Record<Exclude<PaneId, "read">, ReactNode>;
};

const toneVar = (tone: Tone) => (tone === "up" ? "var(--ov-up)" : tone === "down" ? "var(--ov-dn)" : "var(--ov-mid)");
const scoreVar = (v: number) => (v >= 70 ? "var(--ov-up)" : v >= 40 ? "var(--ov-warn)" : "var(--ov-dn)");
export const scoreWord = (v: number) => (v >= 70 ? "Strong" : v >= 40 ? "Mixed" : "Weak");

/** "+12%", "−8.5%": whole numbers from 10 up, one decimal below. */
const fmtPct = (v: number) => `${v < 0 ? "−" : ""}${Math.abs(v).toFixed(Math.abs(v) >= 10 ? 0 : 1)}%`;
/** "Q3'27" -> "Q3 FY27". */
const fyLabel = (label: string) => label.replace(/^(Q\d)\s*'(\d{2})$/, "$1 FY$2");

const SCORE_GROUPS = [
  { name: "Company", keys: ["Business", "Earnings", "Valuation"] },
  { name: "Market", keys: ["Flows", "Macro", "Catalysts", "Technicals"] },
];

/** The headline over the growth chart: how many quarters in a row the latest pace has held. */
export function growthHeadline(series: GrowthSeries | undefined, mode: "yoy" | "qoq"): string {
  if (!series) return "";
  const values = series.rows.map((r) => (mode === "qoq" ? r.qoq : r.yoy));
  const n = values.length;
  const latest = values[n - 1];
  if (latest == null) return "";
  // Quarters in a row, counted back from the latest, that meet the test.
  const streak = (test: (v: number) => boolean) => {
    let count = 0;
    for (let i = n - 1; i >= 0; i--) {
      const v = values[i];
      if (v != null && test(v)) count++;
      else break;
    }
    return count;
  };
  const size = Math.abs(Math.round(latest));
  const name = series.name;
  if (mode === "yoy") {
    const doubled = streak((v) => v >= 100);
    if (doubled >= 2) return doubled === n ? `${name} has doubled in each of the last ${n} quarters` : `${name} has doubled for ${doubled} straight quarters`;
    if (doubled === 1) return `${name} has doubled year over year`;
    if (latest > 0) return `${name} is up ${size}% year over year`;
    if (latest < 0) return `${name} is down ${size}% year over year`;
    return `${name} is flat year over year`;
  }
  const grew = streak((v) => v > 0);
  if (grew >= 2) return grew === n ? `${name} has grown in each of the last ${n} quarters` : `${name} has grown for ${grew} straight quarters`;
  if (latest > 0) return `${name} grew ${size}% last quarter`;
  if (latest < 0) return `${name} fell ${size}% last quarter`;
  return `${name} was flat last quarter`;
}

const PLOT_H = 250;
const PLOT_PAD = 22;

function GrowthChart({ series, mode }: { series: GrowthSeries[]; mode: "yoy" | "qoq" }) {
  const quarters = series[0]?.rows.length ?? 0;
  if (!quarters) return null;
  const values = series.map((s) => s.rows.map((r) => (mode === "qoq" ? r.qoq : r.yoy)));
  const present = values.flat().filter((v): v is number => v != null);
  const maxUp = Math.max(0, ...present);
  const maxDown = Math.max(0, ...present.map((v) => -v));
  const below = maxDown > 0 ? PLOT_PAD : 0;
  const unit = (PLOT_H - PLOT_PAD - below) / Math.max(1, maxUp + maxDown);
  const baseline = below + maxDown * unit;
  const colWidth = 100 / quarters;
  const barColor = (key: GrowthSeries["key"], latest: boolean) =>
    key === "rev" ? (latest ? "var(--ov-up)" : "var(--ov-up-dk)") : latest ? "var(--ov-eps)" : "var(--ov-eps-dk)";

  return (
    <div>
      <div
        className="ovx-plot"
        style={{ height: PLOT_H }}
        role="img"
        aria-label={`${series.map((s) => s.name).join(" and ")} growth, ${mode === "qoq" ? "quarter over quarter" : "year over year"}`}
      >
        {Array.from({ length: quarters }, (_, col) => {
          const latest = col === quarters - 1;
          return (
            <div key={col} className={`ovx-grp${latest ? " last" : ""}`} style={{ left: `${col * colWidth}%`, width: `${colWidth}%` }}>
              {series.map((s, si) => {
                const v = values[si][col];
                const left =
                  series.length === 2 ? (si === 0 ? "calc(50% - min(52px, 38%) - 2px)" : "calc(50% + 2px)") : "calc(50% - min(26px, 19%))";
                const labelColor =
                  v == null
                    ? "var(--ov-sub)"
                    : v < 0
                      ? latest
                        ? "var(--ov-dn)"
                        : "var(--ov-body)"
                      : latest
                        ? s.key === "rev"
                          ? "var(--ov-up)"
                          : "var(--ov-eps)"
                        : "var(--ov-body)";
                if (v == null) {
                  return (
                    <span key={s.key} className="ovx-bv" style={{ left, width: "min(52px, 38%)", bottom: baseline + 4, color: labelColor }}>
                      {"—"}
                    </span>
                  );
                }
                const h = Math.max(3, Math.abs(v) * unit);
                return (
                  <Fragment key={s.key}>
                    <i
                      className={`ovx-bar${v < 0 ? " n" : ""}`}
                      style={{ left, width: "min(52px, 38%)", height: h, bottom: v >= 0 ? baseline : baseline - h, background: barColor(s.key, latest) }}
                    />
                    <span
                      className="ovx-bv"
                      style={{ left, width: "min(52px, 38%)", bottom: v >= 0 ? baseline + h + 4 : baseline - h - 4 - 14, color: labelColor }}
                    >
                      {fmtPct(v)}
                    </span>
                  </Fragment>
                );
              })}
            </div>
          );
        })}
        <div className="ovx-base" style={{ bottom: baseline }} />
      </div>
      <div className="ovx-xl">
        {series[0].rows.map((r, i) => (
          <span key={r.label} className={i === quarters - 1 ? "last" : undefined}>
            {fyLabel(r.label)}
            {i === quarters - 1 ? " · latest" : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

function ConfidenceRing({ conf }: { conf: number | null }) {
  const circumference = 2 * Math.PI * 50;
  const share = conf == null ? 0 : Math.max(0, Math.min(100, conf)) / 100;
  return (
    <svg viewBox="0 0 120 120" width="128" height="128" role="img" aria-label={`MC Confidence ${conf ?? "not available"} out of 100`}>
      <circle cx="60" cy="60" r={50} fill="none" strokeWidth="9" style={{ stroke: "var(--ov-track)" }} />
      {conf != null && (
        <circle
          cx="60"
          cy="60"
          r={50}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${share * circumference} ${circumference}`}
          transform="rotate(-90 60 60)"
          style={{ stroke: scoreVar(conf) }}
        />
      )}
      <text x="60" y="68" textAnchor="middle" fontSize="38" fontWeight="800" style={{ fill: "var(--ov-hi)" }}>
        {conf ?? "—"}
      </text>
      <text x="60" y="86" textAnchor="middle" fontSize="12.5" style={{ fill: "var(--ov-sub)" }}>
        of 100
      </text>
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  );
}

export function SiOverview({ data }: { data: OverviewData }) {
  const [pane, setPane] = useState<PaneId>("read");
  const [growthMode, setGrowthMode] = useState<"yoy" | "qoq">("yoy");
  const read = data.read;

  const hasRail = !!(read.low && read.high && read.now != null && read.high.price > read.low.price);
  const nowPct = hasRail
    ? Math.max(0, Math.min(100, ((read.now! - read.low!.price) / (read.high!.price - read.low!.price)) * 100))
    : null;

  const levelBox = (level: ReadLevel, right: boolean) => {
    const color = right ? "var(--ov-up)" : "var(--ov-dn)";
    return (
      <div
        key={level.title}
        className={`ovx-lvb${right ? " r" : ""}`}
        style={{ background: `color-mix(in srgb, ${color} 8%, transparent)`, borderColor: `color-mix(in srgb, ${color} 35%, transparent)` }}
      >
        <span data-caps style={{ color }}>
          {level.title.toUpperCase()}
        </span>
        <strong className="ovx-mono" style={{ color }}>
          {level.priceText}
        </strong>
        <span>{level.sub}</span>
      </div>
    );
  };

  const growth = data.growth.filter((s) => s.rows.length > 0);
  const hasQoq = growth.some((s) => s.rows.some((r) => r.qoq != null));
  const mode = hasQoq ? growthMode : "yoy";
  const headline = growthHeadline(growth.find((s) => s.key === "rev") ?? growth[0], mode);

  const groups = SCORE_GROUPS.map((g) => ({
    name: g.name,
    rows: data.scores.filter((s) => g.keys.includes(s.k)).sort((a, b) => b.v - a.v),
  })).filter((g) => g.rows.length > 0);
  const grouped = new Set(SCORE_GROUPS.flatMap((g) => g.keys));
  const others = data.scores.filter((s) => !grouped.has(s.k)).sort((a, b) => b.v - a.v);
  if (others.length) groups.push({ name: "Other", rows: others });

  const avg = (rows: ScoreRow[]) => Math.round(rows.reduce((sum, r) => sum + r.v, 0) / rows.length);
  const company = groups.find((g) => g.name === "Company");
  const technicals = data.scores.find((s) => s.k === "Technicals");
  const caption =
    company && technicals
      ? `${scoreWord(avg(company.rows))} company, ${scoreWord(technicals.v).toLowerCase()} technicals`
      : company
        ? `${scoreWord(avg(company.rows))} company`
        : technicals
          ? `${scoreWord(technicals.v)} technicals`
          : "";

  return (
    <div className="ovx">
      <style>{OVX_OVERVIEW_CSS}</style>
      <section className="ovx-top">
        {growth.length > 0 && (
          <div className="ovx-card ovx-growth">
            <div className="ovx-gh">
              <div>
                <span className="ovx-eb" data-caps>
                  GROWTH
                </span>
                {headline && <h2 className="ovx-gt">{headline}</h2>}
              </div>
              <div className="ovx-seg" role="tablist" aria-label="Growth basis">
                {hasQoq ? (
                  <>
                    <button type="button" role="tab" aria-selected={mode === "yoy"} onClick={() => setGrowthMode("yoy")}>
                      YoY
                    </button>
                    <button type="button" role="tab" aria-selected={mode === "qoq"} onClick={() => setGrowthMode("qoq")}>
                      QoQ
                    </button>
                  </>
                ) : (
                  <span role="tab" aria-selected="true">
                    YoY
                  </span>
                )}
              </div>
            </div>
            <div className="ovx-lg">
              {growth.map((s) => (
                <span key={s.key}>
                  <i style={{ background: s.key === "rev" ? "var(--ov-up)" : "var(--ov-eps)" }} />
                  {s.key === "rev" ? "Revenue" : "EPS"}
                </span>
              ))}
            </div>
            <GrowthChart series={growth} mode={mode} />
          </div>
        )}

        <div className="ovx-card ovx-sigs">
          <div className="ovx-mc">
            <div className="ovx-mch">
              <span className="ovx-eb" data-caps>
                MC CONFIDENCE
              </span>
              <button type="button" className="ovx-info" aria-label="How MC Confidence is calculated" title="How MC Confidence is calculated" onClick={data.onScores}>
                <InfoIcon />
              </button>
            </div>
            <ConfidenceRing conf={data.conf} />
            {caption && <p className="ovx-cap">{caption}</p>}
          </div>
          <div className="ovx-sl">
            <div className="ovx-sh">
              <span className="ovx-eb" data-caps>
                SIGNAL SCORES
              </span>
              <span className="ovx-sk">
                <span>Weak &lt;40</span>
                <span>Mixed 40{"–"}69</span>
                <span>Strong 70+</span>
              </span>
            </div>
            {groups.map((g, gi) => (
              <div key={g.name}>
                <p className={`ovx-gn${gi > 0 ? " sep" : ""}`} style={{ color: scoreVar(avg(g.rows)) }}>
                  {g.name}
                </p>
                {g.rows.map((r) => (
                  <button
                    key={r.k}
                    type="button"
                    className="ovx-sr"
                    onClick={data.onScores}
                    aria-label={`${r.k} ${r.v}, ${scoreWord(r.v)}. Open how MC Confidence is calculated`}
                  >
                    <span className="ovx-sn">{r.k}</span>
                    <span className="ovx-sbar" aria-hidden>
                      <i style={{ width: `${Math.max(0, Math.min(100, r.v))}%`, background: scoreVar(r.v) }} />
                      <u style={{ left: "40%" }} />
                      <u style={{ left: "70%" }} />
                    </span>
                    <span className="ovx-sv ovx-mono">{r.v}</span>
                    <span className="ovx-sw" style={{ color: scoreVar(r.v) }}>
                      {scoreWord(r.v)} {"›"}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="ovx-read">
        <nav className="ovx-nav" aria-label="Read sections">
          {data.nav.map((item) => (
            <button key={item.id} type="button" aria-current={pane === item.id ? "true" : undefined} onClick={() => setPane(item.id)}>
              {item.label}
              <small style={{ color: toneVar(item.tone) }}>{item.status}</small>
            </button>
          ))}
        </nav>
        <div className="ovx-pane" role="region" aria-label={data.nav.find((n) => n.id === pane)?.label}>
          {pane !== "read" ? (
            data.panels[pane]
          ) : (
            <article className="ovx-art">
              <button type="button" className="ovx-info ovx-art-i" aria-label="Why this verdict" title="How the verdict is decided" onClick={read.onInfo}>
                <InfoIcon />
              </button>
              <h2 className="ovx-h">{read.headline}</h2>
              {read.body && <p className="ovx-p">{read.body}</p>}
              {(read.low || read.high) && (
                <div className="ovx-lv">
                  <span className="ovx-lv-t" data-caps>
                    LEVELS TO WATCH
                  </span>
                  {hasRail && nowPct != null && (
                    <div className="ovx-rail" role="img" aria-label={`Now ${read.nowText}, between ${read.low!.priceText} and ${read.high!.priceText}`}>
                      <i />
                      <b style={{ left: 0, top: 18, height: 20, background: "var(--ov-dn)" }} />
                      <b style={{ left: `${nowPct}%`, top: 14, height: 28, background: "var(--ov-hi)" }} />
                      <span style={{ left: `${nowPct}%` }}>Now {read.nowText}</span>
                      <b style={{ left: "100%", top: 18, height: 20, background: "var(--ov-up)" }} />
                    </div>
                  )}
                  <div className="ovx-lvl" style={read.low && read.high ? undefined : { gridTemplateColumns: "minmax(0, 1fr)" }}>
                    {read.low && levelBox(read.low, false)}
                    {read.high && levelBox(read.high, true)}
                  </div>
                </div>
              )}
            </article>
          )}
        </div>
      </section>
    </div>
  );
}
