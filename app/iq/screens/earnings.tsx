"use client";

import { useState } from "react";
import { useIQActions } from "../shell";
import { earnings, stockInfo } from "../data";
import { cls, sign } from "../utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface HistRow { q: string; e: number; a: number; surp: number; mv: number; }
interface IncRow  { c: string; rev: number; cogs: number; gp: number; opex: number; oi: number; ni: number; eps: number; }

type TabKey = "yest" | "today" | "tom" | "week" | "next" | "prev" | "month";
const RANGES: [TabKey, string][] = [
  ["yest",  "Yesterday"],
  ["today", "Today"],
  ["tom",   "Tomorrow"],
  ["week",  "This Week"],
  ["next",  "Next Week"],
  ["prev",  "Last Week"],
  ["month", "Month"],
];

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOWS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// ── Deterministic data helpers ───────────────────────────────────────────────

function parseMcNum(mc: string): number {
  const m = mc.replace(/[$,\s]/g, "");
  if (m.endsWith("T")) return parseFloat(m) * 1000;
  if (m.endsWith("B")) return parseFloat(m);
  if (m.endsWith("M")) return parseFloat(m) / 1000;
  return parseFloat(m) || 60;
}

function earnHistory(s: string): HistRow[] {
  const si = stockInfo[s];
  const p  = si?.px  ?? 100;
  const pe = si?.pe   ?? 25;
  const base = Math.max(0.05, (p / pe) / 4);
  const qs = ["Q2 25","Q1 25","Q4 24","Q3 24","Q2 24","Q1 24","Q4 23","Q3 23","Q2 23","Q1 23"];
  return qs.map((q, i) => {
    const r    = (Math.abs(s.charCodeAt(0) * 31 + (s.charCodeAt(1) || 7) * 17 + i * 13) % 97) / 97;
    const e    = +(base * (1 - i * 0.03)).toFixed(2);
    const surp = +((r - 0.4) * 18).toFixed(1);
    const a    = +(e * (1 + surp / 100)).toFixed(2);
    const mv   = +((r - 0.45) * 22).toFixed(1);
    return { q, e, a, surp, mv };
  });
}

function earnIncome(s: string, mcStr: string): IncRow[] {
  const si    = stockInfo[s];
  const mc    = parseMcNum(mcStr);
  const price = si?.px ?? 100;
  const rev0  = Math.max(2, mc * 0.02);
  const sh    = Math.max(0.3, mc / price);
  const cols  = ["Q2 25","Q1 25","Q4 24","Q3 24","Q2 24","Q1 24","Q4 23","Q3 23","Q2 23","Q1 23"];
  return cols.map((c, i) => {
    const rev  = rev0 * (1 - i * 0.05);
    const cogs = rev * 0.55;
    const gp   = rev - cogs;
    const opex = rev * 0.22;
    const oi   = gp - opex;
    const ni   = oi * 0.82;
    const eps  = ni / sh;
    return { c, rev, cogs, gp, opex, oi, ni, eps };
  });
}

// Assign weekday (0=Mon … 4=Fri) and BMO/AMC from the earnings `t` field
function parseT(t: string): { d: number; sess: "BMO" | "AMC" } {
  const lower = t.toLowerCase();
  const dayMap: Record<string, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4 };
  const dayKey = Object.keys(dayMap).find(k => lower.includes(k)) ?? "wed";
  const sess: "BMO" | "AMC" = lower.includes("pre") ? "BMO" : "AMC";
  return { d: dayMap[dayKey] ?? 2, sess };
}

// Generate month calendar — returns { Y, M, first, days, map }
function monthCalData(off: number): { Y: number; M: number; first: number; days: number; map: Record<number, string[]> } {
  const base  = new Date(2026, 5 + off, 1);
  const Y = base.getFullYear(), M = base.getMonth();
  const first = new Date(Y, M, 1).getDay();
  const days  = new Date(Y, M + 1, 0).getDate();
  const pool  = earnings.map(e => e.s);
  const map: Record<number, string[]> = {};
  for (let d = 1; d <= days; d++) {
    const dow = new Date(Y, M, d).getDay();
    if (dow === 0 || dow === 6) { map[d] = []; continue; }
    const h = Math.abs((M + 1) * 101 + d * 13 + 7);
    const n = h % 4;
    const arr: string[] = [];
    for (let i = 0; i < n; i++) arr.push(pool[(h + i * 5) % pool.length]);
    map[d] = arr;
  }
  return { Y, M, first, days, map };
}

// ── SVG Charts ───────────────────────────────────────────────────────────────

function EpsChart({ hist }: { hist: HistRow[] }) {
  const d = [...hist].reverse();
  const W = 580, H = 210, PADL = 30, PADR = 18, PADT = 14, PADB = 30;
  const iw = W - PADL - PADR, ih = H - PADT - PADB;
  const allVals = d.flatMap(x => [x.e, x.a]);
  const maxE = Math.max(...allVals) * 1.15 || 1;
  const maxM = Math.max(1, ...d.map(x => Math.abs(x.mv)));
  const n = d.length, gw = iw / n, bw = gw * 0.28;

  const bars: React.ReactElement[] = [];
  const linePts: [number, number][] = [];
  const dots: React.ReactElement[] = [];
  const labels: React.ReactElement[] = [];

  d.forEach((x, i) => {
    const cx = PADL + gw * i + gw / 2;
    const eh = x.e / maxE * ih, ah = x.a / maxE * ih;
    const ex = cx - bw - 2, ax = cx + 2;
    bars.push(
      <rect key={`e${i}`} x={ex} y={PADT + ih - eh} width={bw} height={eh} rx={2} style={{ fill: "var(--surface-3)" }} />,
      <rect key={`a${i}`} x={ax} y={PADT + ih - ah} width={bw} height={ah} rx={2}
        style={{ fill: x.surp >= 0 ? "var(--up)" : "var(--down)" }} />,
    );
    const my = PADT + ih / 2 - (x.mv / maxM) * (ih / 2 - 8);
    linePts.push([cx, my]);
    dots.push(<circle key={`d${i}`} cx={cx} cy={my} r={2.6} style={{ fill: "var(--brand-2)" }} />);
    if (i % 2 === 0 || i === n - 1) {
      labels.push(
        <text key={`l${i}`} x={cx} y={H - 10} textAnchor="middle"
          style={{ fill: "var(--text-dim-solid)", fontSize: "9px" }}>
          {x.q.replace(" ", "'")}
        </text>
      );
    }
  });

  const linePath = linePts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, display: "block" }}>
      <line x1={PADL} y1={PADT + ih / 2} x2={W - PADR} y2={PADT + ih / 2}
        style={{ stroke: "var(--border)" }} strokeDasharray="3 3" />
      {bars}
      <path d={linePath} style={{ fill: "none", stroke: "var(--brand-2)", strokeWidth: 1.6 }} />
      {dots}
      {labels}
    </svg>
  );
}

function IncChart({ inc }: { inc: IncRow[] }) {
  const d = [...inc].reverse();
  const W = 580, H = 200, PADL = 8, PADR = 8, PADT = 14, PADB = 26;
  const iw = W - PADL - PADR, ih = H - PADT - PADB;
  const max = Math.max(...d.map(x => x.rev)) * 1.12 || 1;
  const n = d.length, gw = iw / n, bw = gw * 0.18;

  type IncKey = "rev" | "gp" | "ni";
  const series: [IncKey, string][] = [
    ["rev", "var(--brand)"],
    ["gp",  "var(--ai)"],
    ["ni",  "var(--up)"],
  ];

  const bars: React.ReactElement[] = [];
  const labels: React.ReactElement[] = [];

  d.forEach((x, i) => {
    const gx = PADL + gw * i;
    series.forEach(([key, color], si) => {
      const v = x[key];
      const h = v / max * ih;
      const bx = gx + gw * 0.1 + si * (bw + 3);
      bars.push(
        <rect key={`${i}${si}`} x={bx} y={PADT + ih - h} width={bw} height={h} rx={2}
          style={{ fill: color }} />
      );
    });
    labels.push(
      <text key={`l${i}`} x={gx + gw / 2} y={H - 8} textAnchor="middle"
        style={{ fill: "var(--text-dim-solid)", fontSize: "9px" }}>
        {x.c.replace(" ", "'")}
      </text>
    );
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, display: "block" }}>
      {bars}{labels}
    </svg>
  );
}

// ── Company logo chip ─────────────────────────────────────────────────────────

function EcChip({ sym, selected, onSelect }: { sym: string; selected: boolean; onSelect: (s: string) => void }) {
  return (
    <button className={`ec-chip${selected ? " on" : ""}`} onClick={() => onSelect(sym)}>
      <span className="ec-logo" style={{ background: "#27314a", color: "#cdd6e6" }}>
        {sym[0]}
        <img
          src={`https://assets.parqet.com/logos/symbol/${sym}?format=png`}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          alt=""
        />
      </span>
      {sym}
    </button>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export function EarningsScreen() {
  const { openStockFull } = useIQActions();
  const [tab, setTab] = useState<TabKey>("week");
  const [sel, setSel]     = useState<string>(earnings[0]?.s ?? "NVDA");
  const [monthOff, setMonthOff] = useState(0);
  const [earnDay, setEarnDay]   = useState<number | null>(null);

  const isDay  = tab === "today" || tab === "tom" || tab === "yest";
  const isWeek = tab === "week"  || tab === "next" || tab === "prev";

  // Assign each earning a weekday + session from its `t` field
  const enriched = earnings.map(e => ({ ...e, ...parseT(e.t) }));

  // ── Calendar rendering ────────────────────────────────────────────────────

  let calNode: React.ReactNode = null;

  if (isDay) {
    const lbl = tab === "today" ? "Today" : tab === "tom" ? "Tomorrow" : "Yesterday";
    const bmo = enriched.filter(e => e.sess === "BMO");
    const amc = enriched.filter(e => e.sess === "AMC");
    calNode = (
      <div className="card">
        <div className="card-h">
          <h3>{lbl} · {enriched.length} companies reporting</h3>
          <span className="pill" style={{ background: "var(--surface-3)", color: "var(--text-dim-solid)" }}>
            tap a logo for history
          </span>
        </div>
        <div className="card-b" style={{ paddingTop: 10 }}>
          <div className="ec-lbl">Before open</div>
          <div style={{ marginBottom: 12 }}>
            {bmo.length
              ? bmo.map(e => <EcChip key={e.s} sym={e.s} selected={sel === e.s} onSelect={setSel} />)
              : <span className="ec-none">None</span>}
          </div>
          <div className="ec-lbl">After close</div>
          <div>
            {amc.length
              ? amc.map(e => <EcChip key={e.s} sym={e.s} selected={sel === e.s} onSelect={setSel} />)
              : <span className="ec-none">None</span>}
          </div>
        </div>
      </div>
    );
  } else if (isWeek) {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    calNode = (
      <div className="ec-grid">
        {days.map((dn, di) => {
          const bmo = enriched.filter(e => e.d === di && e.sess === "BMO");
          const amc = enriched.filter(e => e.d === di && e.sess === "AMC");
          const isToday = tab === "week" && di === 1;
          return (
            <div key={dn} className={`ec-day${isToday ? " is-today" : ""}`}>
              <div className="ec-dh">{dn}{isToday ? " · Today" : ""}</div>
              <div className="ec-sess">
                <div className="ec-lbl">Before open</div>
                {bmo.length
                  ? bmo.map(e => <EcChip key={e.s} sym={e.s} selected={sel === e.s} onSelect={setSel} />)
                  : <span className="ec-none">—</span>}
              </div>
              <div className="ec-sess">
                <div className="ec-lbl">After close</div>
                {amc.length
                  ? amc.map(e => <EcChip key={e.s} sym={e.s} selected={sel === e.s} onSelect={setSel} />)
                  : <span className="ec-none">—</span>}
              </div>
            </div>
          );
        })}
      </div>
    );
  } else {
    // Month view
    const md = monthCalData(monthOff);
    const dayList = earnDay ? (md.map[earnDay] ?? []) : [];
    const todayMark = monthOff === 0 ? 18 : -1;

    calNode = (
      <>
        <div className="ecm-wrap">
          <div className="ecm-monthbar">
            <button className="ecm-nav" onClick={() => { setMonthOff(o => o - 1); setEarnDay(null); }}>←</button>
            <div className="ecm-month">{MONTHS[md.M]} {md.Y} · earnings calendar</div>
            <button className="ecm-nav" onClick={() => { setMonthOff(o => o + 1); setEarnDay(null); }}>→</button>
          </div>
          <div className="ecm-head">
            {DOWS.map(d => <div key={d}>{d}</div>)}
          </div>
          <div className="ecm-grid">
            {Array.from({ length: md.first }, (_, i) => (
              <div key={`e${i}`} className="ecm-cell ecm-empty" />
            ))}
            {Array.from({ length: md.days }, (_, i) => {
              const d   = i + 1;
              const lst = md.map[d] ?? [];
              const isT = d === todayMark;
              const isSel = d === earnDay;
              const hasSel = lst.length > 0;
              return (
                <div
                  key={d}
                  className={`ecm-cell${hasSel ? " has" : ""}${isT ? " is-today" : ""}${isSel ? " sel" : ""}`}
                  onClick={hasSel ? () => { setEarnDay(d); if (lst[0]) setSel(lst[0]); } : undefined}
                >
                  <div className="ecm-d">
                    {d}
                    {isT && <span className="ecm-t">Today</span>}
                  </div>
                  {lst.length > 0 && (
                    <>
                      <div className="ecm-logos">
                        {lst.slice(0, 3).map(sym => (
                          <span key={sym} className="ecm-logo" style={{ background: "#27314a", color: "#cdd6e6" }}>
                            {sym[0]}
                            <img
                              src={`https://assets.parqet.com/logos/symbol/${sym}?format=png`}
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                              alt=""
                            />
                          </span>
                        ))}
                        {lst.length > 3 && <span className="ecm-more">+{lst.length - 3}</span>}
                      </div>
                      <div className="ecm-n">{lst.length} report{lst.length > 1 ? "s" : ""}</div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {earnDay && (
          <div className="card" style={{ marginTop: 14 }}>
            <div className="card-h">
              <h3>{MONTHS[md.M]} {earnDay}, {md.Y} · {dayList.length} reporting</h3>
              <span className="pill" style={{ background: "var(--surface-3)", color: "var(--text-dim-solid)" }}>
                tap a logo for history
              </span>
            </div>
            <div className="card-b" style={{ paddingTop: 10, display: "flex", flexWrap: "wrap" }}>
              {dayList.length
                ? dayList.map(sym => <EcChip key={sym} sym={sym} selected={sel === sym} onSelect={setSel} />)
                : <span className="ec-none">No earnings scheduled for this date.</span>}
            </div>
          </div>
        )}

        {!earnDay && (
          <div className="card" style={{ marginTop: 14 }}>
            <div className="card-b" style={{ color: "var(--text-dim-solid)" }}>
              Click a date with reports to see the companies.
            </div>
          </div>
        )}
      </>
    );
  }

  // ── Detail section ────────────────────────────────────────────────────────

  const selEarning = earnings.find(e => e.s === sel) ?? earnings[0];
  const hist = earnHistory(sel);
  const inc  = earnIncome(sel, selEarning?.mc ?? "$60B");
  const beats = hist.filter(h => h.surp > 0).length;
  const avgMv = (hist.reduce((a, h) => a + Math.abs(h.mv), 0) / hist.length).toFixed(1);

  const fmtB = (v: number) => v >= 1 ? `$${v.toFixed(2)}B` : `$${(v * 1000).toFixed(0)}M`;

  const aiRead = selEarning
    ? `${sel} ${selEarning.epsA != null
        ? (selEarning.epsA >= selEarning.epsE ? "beat" : "missed") + " EPS estimates"
        : "reports " + selEarning.t
      }. Guidance ${selEarning.guide === "Raised" ? "was raised — bullish" : selEarning.guide === "Lowered" ? "was lowered — watch downside" : "was maintained"}. ${selEarning.react != null ? `Shares reacted ${sign(selEarning.react)} on the print.` : `Options imply a ±${selEarning.implied}% move.`}`
    : `${sel} reports next quarter.`;

  return (
    <>
      {/* ── Page head ──────────────────────────────────────────────────── */}
      <div className="page-head">
        <div>
          <div className="eyebrow">Earnings Workspace</div>
          <h1 className="page-title">Earnings Calendar</h1>
          <div className="page-sub">
            Company logos by day · before-open vs after-close · or switch to{" "}
            <b style={{ color: "var(--text-hi)" }}>Month</b> for the full calendar
          </div>
        </div>
        <div className="tabs">
          {RANGES.map(([k, l]) => (
            <button
              key={k}
              className={`tab${tab === k ? " active" : ""}`}
              onClick={() => { setTab(k); setEarnDay(null); }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* ── Calendar ───────────────────────────────────────────────────── */}
      {calNode}

      {/* ── Selected company inline detail (below calendar, no drawer) ── */}
      {selEarning && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="card-h">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="ec-logo" style={{ background: "#27314a", color: "#cdd6e6", width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: ".9rem", flexShrink: 0 }}>
                {sel[0]}
                <img src={`https://assets.parqet.com/logos/symbol/${sel}?format=png`}
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} alt="" />
              </span>
              <div>
                <span style={{ fontWeight: 700, color: "var(--text-hi)", fontSize: ".95rem" }}>{sel}</span>
                <span style={{ color: "var(--text-dim-solid)", fontSize: ".78rem", marginLeft: 8 }}>{selEarning.n} · {selEarning.sec}</span>
              </div>
              <span className={`pill ${selEarning.t.includes("Before") || selEarning.t === "BMO" ? "bmo" : "amc"}`} style={{ marginLeft: 4 }}>
                {selEarning.t}
              </span>
            </div>
          </div>
          <div className="card-b" style={{ paddingTop: 10 }}>
            <div className="metric-grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 12 }}>
              <div className="m">
                <div className="k">EPS estimate</div>
                <div className="v">${selEarning.epsE.toFixed(2)}</div>
              </div>
              <div className="m">
                <div className="k">EPS actual</div>
                {selEarning.epsA != null
                  ? <div className={`v ${selEarning.epsA >= selEarning.epsE ? "up" : "down"}`}>${selEarning.epsA.toFixed(2)}</div>
                  : <div className="v" style={{ color: "var(--text-dim-solid)" }}>Pending</div>}
              </div>
              <div className="m">
                <div className="k">Guidance</div>
                <div className={`v ${selEarning.guide === "Raised" ? "up" : selEarning.guide === "Lowered" ? "down" : ""}`} style={{ fontSize: ".95rem" }}>
                  {selEarning.guide ?? "—"}
                </div>
              </div>
              <div className="m">
                <div className="k">{selEarning.react != null ? "Reaction" : "Implied move"}</div>
                {selEarning.react != null
                  ? <div className={`v ${cls(selEarning.react)}`}>{sign(selEarning.react)}</div>
                  : <div className="v" style={{ color: "var(--warn)" }}>±{selEarning.implied}%</div>}
              </div>
            </div>
            <p style={{ fontSize: ".82rem", color: "var(--text-dim-solid)", margin: 0 }}>{aiRead}</p>
          </div>
        </div>
      )}

      {/* ── Detail: EPS history + Income statement ─────────────────────── */}
      <div className="dash" style={{ marginTop: 16 }}>
        {/* col-6: 10-quarter EPS history */}
        <div className="col-6">
          <div className="card">
            <div className="card-h">
              <h3>{sel} · 10-quarter earnings history</h3>
              {selEarning?.react != null
                ? <span className={`pill ${selEarning.react >= 0 ? "up" : "dn"}`}>{sign(selEarning.react)} last reaction</span>
                : beats >= 7
                  ? <span className="pill up">{beats}/10 beats</span>
                  : beats < 5
                  ? <span className="pill dn">{beats}/10 beats</span>
                  : <span className="pill" style={{ background: "var(--surface-3)", color: "var(--text-dim-solid)" }}>{beats}/10 beats</span>}
            </div>
            <div className="card-b" style={{ paddingTop: 8 }}>
              <div className="ec-legend">
                <span><i style={{ background: "var(--surface-3)" }} /> EPS estimate</span>
                <span><i style={{ background: "var(--up)" }} /> Beat</span>
                <span><i style={{ background: "var(--down)" }} /> Miss</span>
                <span><i className="ln" style={{ background: "var(--brand-2)" }} /> Stock move %</span>
              </div>
              <EpsChart hist={hist} />
              <details className="ec-det">
                <summary>Show quarterly table</summary>
                <div style={{ overflowX: "auto", marginTop: 8 }}>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Quarter</th>
                        <th className="num">EPS est</th>
                        <th className="num">EPS act</th>
                        <th className="num">Surprise</th>
                        <th className="num">Stock move</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hist.map(h => (
                        <tr key={h.q}>
                          <td><b style={{ color: "var(--text-hi)" }}>{h.q}</b></td>
                          <td className="num">${h.e.toFixed(2)}</td>
                          <td className="num">${h.a.toFixed(2)}</td>
                          <td className={`num ${cls(h.surp)}`}>{sign(h.surp)}</td>
                          <td className={`num ${cls(h.mv)}`}>{sign(h.mv)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          </div>
        </div>

        {/* col-6: Income statement */}
        <div className="col-6">
          <div className="card">
            <div className="card-h">
              <h3>Income statement</h3>
              <span className="pill" style={{ background: "var(--surface-3)", color: "var(--text-dim-solid)" }}>
                Quarterly
              </span>
            </div>
            <div className="card-b" style={{ paddingTop: 8 }}>
              <div className="ec-legend">
                <span><i style={{ background: "var(--brand)" }} /> Revenue</span>
                <span><i style={{ background: "var(--ai)" }} /> Gross profit</span>
                <span><i style={{ background: "var(--up)" }} /> Net income</span>
              </div>
              <IncChart inc={inc} />
              <details className="ec-det">
                <summary>Show statement table</summary>
                <div style={{ overflowX: "auto", marginTop: 8 }}>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Item</th>
                        {inc.map(c => <th key={c.c} className="num">{c.c}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        [
                          ["Revenue",            "rev",  true ],
                          ["Cost of revenue",    "cogs", false],
                          ["Gross profit",       "gp",   true ],
                          ["Operating expenses", "opex", false],
                          ["Operating income",   "oi",   true ],
                          ["Net income",         "ni",   true ],
                          ["Diluted EPS",        "eps",  false],
                        ] as [string, keyof IncRow, boolean][]
                      ).map(([lbl, key, bold]) => (
                        <tr key={lbl}>
                          <td style={bold ? { fontWeight: 700, color: "var(--text-hi)" } : undefined}>{lbl}</td>
                          {inc.map(c => (
                            <td key={c.c} className="num"
                              style={bold ? { fontWeight: 700, color: "var(--text-hi)" } : undefined}>
                              {key === "eps" ? `$${(c[key] as number).toFixed(2)}` : fmtB(c[key] as number)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          </div>
        </div>
      </div>

      {/* ── AI earnings read ──────────────────────────────────────────────── */}
      <div className="ai-block" style={{ marginTop: 2 }}>
        <div className="card-h">
          <h3 className="ai-c">◆ AI earnings read · {sel}</h3>
        </div>
        <div className="card-b">
          <p style={{ fontSize: ".85rem", lineHeight: 1.6, color: "var(--text)" }}>
            {aiRead}{" "}History shows{" "}
            <b style={{ color: "var(--text-hi)" }}>{beats}/10 beats</b>{" "}
            and an average post-print move of{" "}
            <b style={{ color: "var(--text-hi)" }}>{avgMv}%</b>.{" "}
            Watch revenue growth and forward guidance most.{" "}
            <button className="btn" style={{ marginLeft: 8, padding: "4px 10px" }}
              onClick={() => openStockFull(sel)}>
              Open full stock page →
            </button>
          </p>
        </div>
      </div>
    </>
  );
}
