"use client";

import { useMemo, useRef, useState } from "react";
import { DataState } from "./utils";
import { useApiResource } from "./hooks/useApiResource";
import { fmtDate } from "./calendar-range";
import type { FinancialsDoc } from "./types";
import { annualEpsSalesRows, epsSalesSeries, forwardAnnualEstimates, pctChangeStr, quarterlyEpsSalesRows } from "./eps-sales-data";

/** GET /live/estimates — FMP quarterly analyst consensus (oldest first). */
interface QuarterlyEstimate {
  date: string;
  epsAvg: number | null;
  revenueAvg: number | null;
  numAnalystsEps: number | null;
  numAnalystsRevenue: number | null;
}

/** GET /live/estimates `next` — consensus for the next report on the calendar. */
interface NextReportEstimate {
  date: string;
  epsEstimate: number | null;
  revenueEstimate: number | null;
}

/**
 * Forward quarters with the next one taken from the earnings calendar.
 *
 * The calendar's estimate for the next report is the one Stock Intelligence
 * shows and the one that matches the report; FMP's quarterly estimates can
 * file it under the wrong quarter-end (KR: two quarters early). When one of
 * those rows carries the calendar's revenue figure, the run of rows from it
 * on is used in order, so later quarters line up too; otherwise only the
 * first forward quarter takes the calendar's numbers.
 */
export function alignForwardQuarters(
  all: QuarterlyEstimate[],
  fwd: QuarterlyEstimate[],
  next: NextReportEstimate | null | undefined,
): QuarterlyEstimate[] {
  if (!next || fwd.length === 0) return fwd;
  const rev = next.revenueEstimate;
  const m = rev != null && rev !== 0
    ? all.findIndex((q) => q.revenueAvg != null && Math.abs(q.revenueAvg - rev) / Math.abs(rev) < 0.002)
    : -1;
  if (m !== -1) {
    fwd = fwd.map((q, i) => {
      const src = all[m + i];
      return src ? { ...src, date: q.date } : { ...q, epsAvg: null, revenueAvg: null };
    });
  }
  // The next quarter always shows the calendar's figures (as SI does).
  return fwd.map((q, i) => i === 0
    ? { ...q, epsAvg: next.epsEstimate ?? q.epsAvg, revenueAvg: next.revenueEstimate ?? q.revenueAvg }
    : q);
}

type Bar = { label: string; eps: number | null; sales: number | null; est: boolean };

const REPORTED_Q = 8;
const FORWARD_Q = 4;
const REPORTED_A = 5;
const FORWARD_A = 3;
const ACTUAL = "#6c9dff";
const ESTIMATE = "#3a4252";
const TEXT = "#c9d3e6";
const MUTED = "#8a96ad";

const monthLabel = (iso: string) => fmtDate(iso, { month: "short", year: "2-digit" }).replace(" ", "-");
const epsTxt = (v: number | null) => (v == null ? "—" : v.toFixed(2));
const salesTxt = (v: number | null) => (v == null ? "—" : v.toFixed(1));
const chgClass = (s: string) => (s.startsWith("-") ? "down" : s.startsWith("+") ? "up" : "dim");

/** One panel of bars (EPS or Sales), value on top, label angled below. The card heading names it. */
function Panel({ x, w, bars, value, fmt }: {
  x: number; w: number; bars: Bar[];
  value: (b: Bar) => number | null; fmt: (v: number) => string;
}) {
  const TOP = 30, BOTTOM = 232;
  const vals = bars.map(value).filter((v): v is number => v != null);
  const max = Math.max(0, ...vals), min = Math.min(0, ...vals);
  const span = max - min || 1;
  const y = (v: number) => TOP + ((max - v) / span) * (BOTTOM - TOP);
  const gw = w / Math.max(1, bars.length);
  const bw = Math.min(gw * 0.78, 34);
  const font = Math.max(8, Math.min(12, gw / 3.6));
  return (
    <g>
      {bars.map((b, i) => {
        const v = value(b);
        const cx = x + gw * i + gw / 2;
        const lx = cx - 2, ly = BOTTOM + 14;
        return (
          <g key={`${b.label}-${i}`}>
            {v != null && (<>
              <rect x={cx - bw / 2} y={Math.min(y(v), y(0))} width={bw} height={Math.max(1, Math.abs(y(v) - y(0)))} rx={2}
                fill={b.est ? ESTIMATE : ACTUAL}>
                <title>{`${b.label}${b.est ? " (estimate)" : ""}: ${fmt(v)}`}</title>
              </rect>
              <text x={cx} y={v >= 0 ? y(v) - 5 : y(v) + font + 3} textAnchor="middle" fill={b.est ? MUTED : TEXT} fontSize={font} fontWeight={600}>
                {fmt(v)}
              </text>
            </>)}
            <text x={lx} y={ly} transform={`rotate(-40 ${lx} ${ly})`} textAnchor="end" fill={MUTED} fontSize={11}>{b.label}</text>
          </g>
        );
      })}
      <line x1={x} x2={x + w} y1={y(0)} y2={y(0)} stroke="#2a3242" strokeWidth={1} />
    </g>
  );
}

/**
 * Earnings tab — EPS and Sales bar charts (reported in blue, forward analyst
 * consensus in grey, Quarterly/Annual), then the fiscal-year table (forward
 * years marked *) and the quarterly table with YoY %chg and surprises.
 * Reported figures: the financials doc (FMP-first). Estimates: FMP quarterly
 * consensus (/live/estimates) and the doc's annual consensus.
 */
export function StockEarningsEpsSales({ sym, financialsDoc, loading }: {
  sym: string;
  financialsDoc: FinancialsDoc | null;
  loading: boolean;
}) {
  const [period, setPeriod] = useState<"Q" | "A">("Q");
  const [note, setNote] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const { data: est } = useApiResource<{ quarterly: QuarterlyEstimate[]; next?: NextReportEstimate | null }>(
    sym ? `/live/estimates?ticker=${encodeURIComponent(sym)}` : null,
  );

  // ── Quarterly ────────────────────────────────────────────────────────────
  const qRows = useMemo(
    () => (financialsDoc ? quarterlyEpsSalesRows(financialsDoc.quarters ?? [], financialsDoc.epsHistory ?? []) : []),
    [financialsDoc],
  );
  // Year-ago EPS for the oldest rows can predate the stored quarterly
  // statements; FMP's ~10-year reported EPS history covers it ("Q3 2024" →
  // fiscal 2023 Q3). Sales has no deeper source, so its %chg stays "—".
  const histEps = new Map(
    (financialsDoc?.epsHistory ?? [])
      .filter((h) => h.epsActual != null)
      .map((h) => [`${h.fiscalPeriod} ${h.fiscalYear}`, h.epsActual as number]),
  );
  const reportedQ = qRows
    .filter((r) => r.eps != null || r.sales != null)
    .slice(-REPORTED_Q)
    .map((r) => {
      if (r.epsChg !== "—") return r;
      const m = r.label.match(/^(Q[1-4]) (\d{4})$/);
      const ago = m ? histEps.get(`${m[1]} ${Number(m[2]) - 1}`) : undefined;
      return ago != null ? { ...r, epsChg: pctChangeStr(r.eps, ago) } : r;
    });
  const lastEnd = qRows.filter((r) => r.eps != null || r.sales != null).at(-1)?.end ?? null;
  const fwdQ = useMemo(() => {
    if (!lastEnd) return [];
    // Quarters ending after the last reported one (20-day slack: FMP dates
    // fiscal quarter ends loosely, e.g. 12-30 vs 12-31).
    const after = Date.parse(lastEnd) + 20 * 86_400_000;
    const all = est?.quarterly ?? [];
    return alignForwardQuarters(all, all.filter((q) => Date.parse(q.date) > after).slice(0, FORWARD_Q), est?.next);
  }, [est, lastEnd]);
  const epsByMonth = new Map(qRows.map((r) => [r.monthLabel, r.eps]));
  const salesByMonth = new Map(qRows.map((r) => [r.monthLabel, r.sales]));
  const yearAgo = (label: string) => {
    const [m, yy] = label.split("-");
    return `${m}-${String(Number(yy) - 1).padStart(2, "0")}`;
  };
  const fwdQRows = fwdQ.map((q) => {
    const label = monthLabel(q.date);
    const eps = q.epsAvg;
    const sales = q.revenueAvg != null ? q.revenueAvg / 1e6 : null;
    return {
      label,
      eps,
      sales,
      epsChg: pctChangeStr(eps, epsByMonth.get(yearAgo(label)) ?? null),
      salesChg: pctChangeStr(sales, salesByMonth.get(yearAgo(label)) ?? null),
      analysts: q.numAnalystsEps,
    };
  });

  // ── Annual ───────────────────────────────────────────────────────────────
  const aRows = useMemo(
    () => (financialsDoc ? annualEpsSalesRows(financialsDoc.annual ?? [], financialsDoc.epsHistory ?? []) : []),
    [financialsDoc],
  );
  const reportedA = aRows.filter((r) => r.eps != null || r.sales != null).slice(-REPORTED_A);
  const lastYear = reportedA.at(-1)?.year ?? null;
  const fwdA = forwardAnnualEstimates(financialsDoc)
    .filter((e) => lastYear == null || Number(e.fiscalYear) > Number(lastYear))
    .slice(0, FORWARD_A);
  const fwdARows = fwdA.map((e, i) => {
    const prev = i === 0 ? reportedA.at(-1) : null;
    const prevEst = i > 0 ? fwdA[i - 1] : null;
    const eps = e.epsEstimate;
    const sales = e.revenueEstimate != null ? e.revenueEstimate / 1e6 : null;
    const prevEps = prev ? prev.eps : prevEst?.epsEstimate ?? null;
    const prevSales = prev ? prev.sales : prevEst?.revenueEstimate != null ? prevEst.revenueEstimate / 1e6 : null;
    return { year: e.fiscalYear, eps, sales, epsChg: pctChangeStr(eps, prevEps), salesChg: pctChangeStr(sales, prevSales) };
  });

  // ── Chart bars ───────────────────────────────────────────────────────────
  const bars: Bar[] = period === "Q"
    ? [
        ...epsSalesSeries("Q", financialsDoc)
          .filter((p) => p.eps != null || p.sales != null)
          .slice(-REPORTED_Q)
          .map((p) => ({ label: p.label, eps: p.eps, sales: p.sales, est: false })),
        ...fwdQRows.map((r) => ({ label: r.label, eps: r.eps, sales: r.sales, est: true })),
      ]
    : [
        ...reportedA.map((r) => ({ label: r.year, eps: r.eps, sales: r.sales, est: false })),
        ...fwdARows.map((r) => ({ label: r.year, eps: r.eps, sales: r.sales, est: true })),
      ];

  const flash = (msg: string) => { setNote(msg); setTimeout(() => setNote(null), 2200); };

  const copyData = async () => {
    const lines = [
      `${sym} — ${period === "Q" ? "Quarterly" : "Annual"} EPS & Sales ($M)`,
      ["Period", "EPS", "Sales ($M)", "Type"].join("\t"),
      ...bars.map((b) => [b.label, epsTxt(b.eps), salesTxt(b.sales), b.est ? "Estimate" : "Reported"].join("\t")),
    ];
    try { await navigator.clipboard.writeText(lines.join("\n")); flash("Copied"); }
    catch { flash("Copy failed"); }
  };

  const savePng = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bg.setAttribute("width", "100%"); bg.setAttribute("height", "100%"); bg.setAttribute("fill", "#121a2b");
    clone.insertBefore(bg, clone.firstChild);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" }));
    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const c = document.createElement("canvas");
      c.width = 1000 * scale; c.height = 270 * scale;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, 1000, 270);
      URL.revokeObjectURL(url);
      const a = document.createElement("a");
      a.download = `${sym}-eps-sales-${period === "Q" ? "quarterly" : "annual"}.png`;
      a.href = c.toDataURL("image/png");
      a.click();
      flash("Image saved");
    };
    img.src = url;
  };

  const iconBtn: React.CSSProperties = {
    width: 34, height: 30, display: "grid", placeItems: "center", borderRadius: 8,
    border: "1px solid var(--border-soft)", background: "transparent", color: "var(--text-dim-solid)", cursor: "pointer",
  };
  const segBtn = (on: boolean): React.CSSProperties => ({
    padding: "6px 14px", borderRadius: 8, border: 0, cursor: "pointer", fontWeight: 600, fontSize: ".82rem",
    background: on ? "var(--surface-3)" : "transparent", color: on ? "var(--text-hi)" : "var(--text-dim-solid)",
  });
  const th: React.CSSProperties = { padding: "10px 14px", fontSize: ".72rem", letterSpacing: ".06em", color: "var(--text-dim-solid)", fontWeight: 700, textAlign: "right", whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "9px 14px", textAlign: "right", fontFamily: "var(--f-mono, ui-monospace, monospace)", whiteSpace: "nowrap" };
  const firstCol: React.CSSProperties = { ...td, textAlign: "left", fontWeight: 700, color: "var(--text-hi)" };

  if (!financialsDoc || (qRows.length === 0 && aRows.length === 0)) {
    return (
      <div className="card"><div className="card-b">
        <DataState loading={loading} label={`No earnings history synced for ${sym} yet.`} />
      </div></div>
    );
  }

  const valStyle = (s: string): React.CSSProperties => {
    if (!s || s === "—") return { ...td, color: "var(--text-dim-solid)" };
    const isPos = s.startsWith("+") || (!s.startsWith("-") && !s.startsWith("−") && parseFloat(s) > 0);
    const isNeg = s.startsWith("-") || s.startsWith("−") || parseFloat(s) < 0;
    return {
      ...td,
      color: isPos ? "var(--up, #10b981)" : isNeg ? "var(--down, #ef4444)" : "var(--text-dim-solid)",
      fontWeight: isPos || isNeg ? 700 : 500,
    };
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))", gap: 16, alignItems: "start" }}>
      {/* LEFT HALF: EPS on top, Sales on bottom */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* EPS Chart Card */}
        <div className="card">
          <div className="card-b" style={{ paddingBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "var(--text-hi)" }}>EPS</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {note && <span style={{ fontSize: ".75rem", color: "var(--up)" }}>{note}</span>}
                <button type="button" style={iconBtn} onClick={copyData} title="Copy chart data">
                  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                  </svg>
                </button>
                <button type="button" style={iconBtn} onClick={savePng} title="Save chart as image">
                  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
                  </svg>
                </button>
                <div style={{ display: "flex", gap: 2, padding: 2, borderRadius: 10, background: "var(--surface-1)" }}>
                  <button type="button" style={segBtn(period === "Q")} onClick={() => setPeriod("Q")}>Quarterly</button>
                  <button type="button" style={segBtn(period === "A")} onClick={() => setPeriod("A")}>Annual</button>
                </div>
              </div>
            </div>
            <svg ref={svgRef} viewBox="0 0 500 240" width="100%" role="img" aria-label={`${sym} EPS`} style={{ display: "block" }}>
              <Panel x={10} w={480} bars={bars} value={(b) => b.eps} fmt={(v) => v.toFixed(2)} />
            </svg>
            <div style={{ display: "flex", gap: 16, fontSize: ".74rem", color: "var(--text-dim-solid)", padding: "4px 4px 2px" }}>
              <span><i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: ACTUAL, marginRight: 6 }} />Reported</span>
              <span><i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: ESTIMATE, marginRight: 6 }} />Analyst consensus estimate</span>
            </div>
          </div>
        </div>

        {/* Sales Chart Card */}
        <div className="card">
          <div className="card-b" style={{ paddingBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "var(--text-hi)" }}>Sales ($Mil)</h3>
            </div>
            <svg viewBox="0 0 500 240" width="100%" role="img" aria-label={`${sym} Sales`} style={{ display: "block" }}>
              <Panel x={10} w={480} bars={bars} value={(b) => b.sales} fmt={(v) => String(Math.round(v))} />
            </svg>
            <div style={{ display: "flex", gap: 16, fontSize: ".74rem", color: "var(--text-dim-solid)", padding: "4px 4px 2px" }}>
              <span><i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: ACTUAL, marginRight: 6 }} />Reported</span>
              <span><i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: ESTIMATE, marginRight: 6 }} />Analyst consensus estimate</span>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT HALF: Fiscal Year on top, Quarterly on bottom */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Fiscal-year table */}
        <div className="card">
          <div className="card-b" style={{ padding: 0, overflowX: "auto" }}>
            <table className="tbl" style={{ width: "100%" }}>
              <thead>
                <tr style={{ background: "var(--surface-1)" }}>
                  <th style={{ ...th, textAlign: "left" }}>Fiscal Year</th>
                  <th style={th}>EPS</th>
                  <th style={th}>% Chg</th>
                  <th style={th}>Sales ($M)</th>
                  <th style={th}>% Chg</th>
                </tr>
              </thead>
              <tbody>
                {reportedA.map((r) => (
                  <tr key={r.year}>
                    <td style={firstCol}>{r.year}</td>
                    <td style={td}>{epsTxt(r.eps)}</td>
                    <td style={valStyle(r.epsChg)}>{r.epsChg}</td>
                    <td style={td}>{salesTxt(r.sales)}</td>
                    <td style={valStyle(r.salesChg)}>{r.salesChg}</td>
                  </tr>
                ))}
                {fwdARows.map((r) => (
                  <tr key={`e${r.year}`} title="Analyst consensus estimate">
                    <td style={firstCol}>*{r.year}</td>
                    <td style={td}>{epsTxt(r.eps)}</td>
                    <td style={valStyle(r.epsChg)}>{r.epsChg}</td>
                    <td style={td}>{salesTxt(r.sales)}</td>
                    <td style={valStyle(r.salesChg)}>{r.salesChg}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quarterly table */}
        <div className="card">
          <div className="card-b" style={{ padding: 0, overflowX: "auto" }}>
            <table className="tbl" style={{ width: "100%" }}>
              <thead>
                <tr style={{ background: "var(--surface-1)" }}>
                  <th style={{ ...th, textAlign: "left" }}>Quarter</th>
                  <th style={th}>EPS</th>
                  <th style={th}>% Chg</th>
                  <th style={th}>Surprise</th>
                  <th style={th}>Sales ($M)</th>
                  <th style={th}>% Chg</th>
                  <th style={th}>Surprise</th>
                </tr>
              </thead>
              <tbody>
                {reportedQ.map((r) => (
                  <tr key={r.end}>
                    <td style={firstCol}>{r.monthLabel}</td>
                    <td style={td}>{epsTxt(r.eps)}</td>
                    <td style={valStyle(r.epsChg)}>{r.epsChg}</td>
                    <td style={valStyle(r.epsSurp)}>{r.epsSurp}</td>
                    <td style={td}>{salesTxt(r.sales)}</td>
                    <td style={valStyle(r.salesChg)}>{r.salesChg}</td>
                    <td style={valStyle(r.salesSurp)}>{r.salesSurp}</td>
                  </tr>
                ))}
                {fwdQRows.map((r) => (
                  <tr key={`e${r.label}`} title={`Analyst consensus estimate${r.analysts ? ` (${r.analysts} analysts)` : ""}`}>
                    <td style={firstCol}>*{r.label}</td>
                    <td style={td}>{epsTxt(r.eps)}</td>
                    <td style={valStyle(r.epsChg)}>{r.epsChg}</td>
                    <td style={td} className="dim">—</td>
                    <td style={td}>{salesTxt(r.sales)}</td>
                    <td style={valStyle(r.salesChg)}>{r.salesChg}</td>
                    <td style={td} className="dim">—</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: "8px 14px 12px", fontSize: ".72rem", color: "var(--text-dim-solid)" }}>
              * Analyst consensus estimate (FMP). % Chg is year-over-year; Surprise is reported vs. the consensus estimate for that report.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
