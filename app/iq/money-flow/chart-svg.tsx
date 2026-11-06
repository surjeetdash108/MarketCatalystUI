/**
 * Money Flow chart SVGs — sparkline, volume profile and the hover chart — drawn
 * from real bars and the board's levels (pivots, order-block zone, previous
 * day high/low). A level that does not exist is not drawn.
 */

import React, { useEffect, useId, useRef } from "react";
import type { BoardStock, IntradayView, OHLCVBar, SwingPoint } from "./engine";
import { detectPatterns, layoutCallouts, patternGlyphs, patternsToShow } from "../patterns";
import { candleIndexAt, chartFrame, chartRightGutter, computeFvgs, computeOrderBlocks, computeSwings, calloutLaneRows, formatCurrency, fullSessionView, layoutEdgeLabels, declutterLabels, levelTag, type ChartLabel, type LabelBox, liveLevels, panIntradayView, popLevelRows, popText, timeTicks, zoomIntradayView, type EdgeLabelIn } from "./engine";

/** Levels close enough to the day's candles to plot without flattening them. */
function levelsInView(levels: Array<number | null | undefined>, lo: number, hi: number): number[] {
  const range = Math.max(hi - lo, hi * 0.004);
  return levels.filter(
    (v): v is number => v != null && Number.isFinite(v) && v >= lo - range * 1.6 && v <= hi + range * 1.6,
  );
}

export function SparklineSvg({ stock, candles }: { stock: BoardStock; candles: OHLCVBar[] }) {
  const W = 200;
  const H = 80;
  if (candles.length === 0) return null;
  const cl = candles.map((x) => x.c);
  const cMin = Math.min(...candles.map((x) => x.l));
  const cMax = Math.max(...candles.map((x) => x.h));
  const zone = stock.zone;
  const pv = stock.pivots;
  const live = liveLevels(pv, cl[cl.length - 1], candles);
  const lvl = (n: string) => live.find((l) => l.name === n)?.v ?? null;
  const lv = levelsInView([zone?.lo, zone?.hi, lvl("S1"), lvl("R1"), lvl("R2")], cMin, cMax);
  const mx = Math.max(cMax, ...lv);
  const mn = Math.min(cMin, ...lv);
  const y = (v: number) => 4 + ((mx - v) / (mx - mn || 1)) * (H - 8);
  const col = stock.pctChange >= 0 ? "var(--th-3ddc84)" : "var(--th-f0565a)";
  // x spans the full 78-bar session, so the line's length shows time elapsed.
  const x = (i: number) => (i / 78) * W;
  const k = candles.length - 1;
  const zi = zone ? candleIndexAt(candles, zone.startT) : -1;
  const inView = (v: number | null | undefined): v is number => v != null && lv.includes(v);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: "block", width: "100%", height: "100%" }}>
      {zone && zi >= 0 && inView(zone.hi) && inView(zone.lo) && (
        <rect style={{ fill: "rgba(201,162,74,.22)", stroke: "var(--th-c9a24a)" }}
          x={x(zi)}
          y={y(zone.hi)}
          width={W - x(zi)}
          height={Math.max(2, y(zone.lo) - y(zone.hi))}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {(
        [
          ["s", lvl("S1"), "rgb(var(--thr-e6ebe8) / .45)"],
          ["r1", lvl("R1"), "rgba(224,187,94,.6)"],
          ["r2", lvl("R2"), "rgba(224,187,94,.6)"],
        ] as Array<[string, number | null | undefined, string]>
      )
        .filter(([, v]) => inView(v))
        .map(([key, v, cc]) => (
          <line style={{ stroke: cc }}
            key={key}
            x1={0}
            x2={W}
            y1={y(v as number)}
            y2={y(v as number)}
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      <polyline style={{ fill: "none", stroke: col }}
        points={cl.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      <line style={{ stroke: "rgb(var(--thr-ffffff) / .15)" }} x1={x(k)} x2={x(k)} y1={0} y2={H} vectorEffect="non-scaling-stroke" />
      <circle style={{ fill: "var(--th-ffffff)" }} cx={x(k)} cy={y(cl[k])} r={2.5} />
    </svg>
  );
}

export function MiniProfileSvg({ stock, candles }: { stock: BoardStock; candles: OHLCVBar[] }) {
  const W = 120;
  const H = 60;
  if (candles.length === 0) return null;
  const obs = computeOrderBlocks(candles).filter((b) => !b.mit);
  const hi = Math.max(...candles.map((x) => x.h));
  const lo = Math.min(...candles.map((x) => x.l));
  const NB = 14;
  const bs = (hi - lo) / NB || 1;
  const bins = Array(NB)
    .fill(0)
    .map(() => ({ u: 0, d: 0 }));

  // Volume at price: each bar's volume in the bin of its mid price, split by candle colour.
  candles.forEach((x) => {
    const j = Math.min(NB - 1, Math.max(0, Math.floor(((x.h + x.l) / 2 - lo) / bs)));
    bins[j][x.c >= x.o ? "u" : "d"] += x.v;
  });

  const tot = bins.map((b) => b.u + b.d);
  const mx = Math.max(...tot) || 1;
  const poc = tot.indexOf(mx);
  const y = (v: number) => 2 + ((hi - v) / (hi - lo || 1)) * (H - 4);
  const bh = (H - 4) / NB;
  const LW = 78;

  const last = candles[candles.length - 1];
  const vw = last.vw;
  const ly = y(last.c);
  const lc = stock.pctChange >= 0 ? "var(--th-3ddc84)" : "var(--th-f0565a)";

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ display: "block", width: "100%", height: "100%" }}
    >
      {obs.slice(-2).map((o, i) => {
        const col = o.bull ? "61,220,132" : "240,86,90";
        return (
          <rect style={{ fill: `rgba(${col},.14)`, stroke: `rgba(${col},.6)` }}
            key={`ob_${i}`}
            x={0}
            y={y(o.hi)}
            width={W}
            height={Math.max(2, y(o.lo) - y(o.hi))}
            strokeWidth={0.5}
            strokeDasharray="2 1.5"
          />
        );
      })}

      {bins.map((b, j) => {
        const yy = H - 2 - (j + 1) * bh;
        const wu = (b.u / mx) * LW;
        const wd = (b.d / mx) * LW;
        const isP = j === poc;
        return (
          <g key={`b_${j}`}>
            <rect style={{ fill: isP ? "var(--th-3ddc84)" : "rgba(61,220,132,.5)" }}
              x={W - wu - wd}
              y={yy + 0.4}
              width={wu}
              height={Math.max(1, bh - 0.8)}
            />
            <rect style={{ fill: isP ? "var(--th-f0565a)" : "rgba(240,86,90,.5)" }}
              x={W - wd}
              y={yy + 0.4}
              width={wd}
              height={Math.max(1, bh - 0.8)}
            />
          </g>
        );
      })}

      <line style={{ stroke: "var(--th-e0bb5e)" }}
        x1={0}
        x2={W}
        y1={H - 2 - (poc + 0.5) * bh}
        y2={H - 2 - (poc + 0.5) * bh}
        strokeWidth={0.6}
      />
      <line style={{ stroke: "var(--th-8b7cf6)" }}
        x1={0}
        x2={W}
        y1={y(vw)}
        y2={y(vw)}
        strokeWidth={0.6}
        strokeDasharray="2 1.5"
      />
      <line style={{ stroke: "var(--th-ffffff)" }}
        x1={0}
        x2={W}
        y1={ly}
        y2={ly}
        strokeWidth={0.5}
        strokeOpacity={0.7}
      />
      <polygon style={{ fill: lc }}
        points={`0,${ly - 2.5} 4,${ly} 0,${ly + 2.5}`}
      />
    </svg>
  );
}

export function FullChartSvg({
  stock,
  candles,
  layers,
  tf = 5,
  width = 900,
  height = 340,
  scale = 1,
  view,
  onView,
}: {
  stock: BoardStock;
  candles: OHLCVBar[];
  layers: { ob: boolean; vwap: boolean; fvg: boolean; liq: boolean; str: boolean; pat?: boolean };
  tf?: number;
  width?: number;
  height?: number;
  /** The pop-up's on-screen scale: text is drawn large enough to stay ≥ 12px on screen (popText). */
  scale?: number;
  /** Visible window in candle slots (zoom / scroll); the whole session when omitted. */
  view?: IntradayView | null;
  /** Wheel zooms around the pointer, drag scrolls, double-click resets — all within today's session. */
  onView?: (v: IntradayView) => void;
}) {
  const T = (n: number) => popText(n, scale);
  const NB = Math.round(390 / tf) + 1;
  const vw = view ?? fullSessionView(NB);
  const clipId = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  // Latest geometry for the native wheel listener and the drag (set below, read in handlers).
  const geo = useRef({ vw, NB, PL: 6, plotW: 1, W: width, onView });
  const drag = useRef<{ x: number; v: IntradayView } | null>(null);
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    // Non-passive, so the wheel zooms the chart instead of scrolling the page.
    const onWheel = (e: WheelEvent) => {
      const g = geo.current;
      if (!g.onView) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const sx = ((e.clientX - r.left) / (r.width || 1)) * g.W; // pointer in chart units (works in the scaled pop-up)
      const span = g.vw.to - g.vw.from;
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        g.onView(panIntradayView(g.vw, ((e.deltaX || e.deltaY) / 100) * span * 0.1, g.NB));
      } else {
        g.onView(zoomIntradayView(g.vw, e.deltaY > 0 ? 1.1 : 1 / 1.1, (sx - g.PL) / g.plotW, g.NB));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);
  const zone = stock.zone;
  const ZI = zone ? candleIndexAt(candles, zone.startT) : -1;
  const KI = candles.length - 1;
  // The live price, as the header and the cards show it (the levels are named from
  // it too); the last bar's close can lag it. The bar close is the fallback.
  const lastPx = candles.length ? candles[candles.length - 1].c : NaN;
  const safeStockPx = Number.isFinite(stock.price) && stock.price > 0 ? stock.price : lastPx;
  const pv = stock.pivots;

  // Two levels each side of price, renumbered from price (liveLevels): past R1, R2 shows as R1, R3 as R2.
  const rawLevels: Array<[string, number | null]> = liveLevels(pv, safeStockPx, candles).map((l) => [l.name, l.v]);

  // Every level is shown, however far from price: each has its own fixed row (popLevelRows).
  const lv: Array<[string, number]> = rawLevels.filter(
    (x): x is [string, number] => typeof x[1] === "number" && Number.isFinite(x[1]) && x[1] > 0
  );

  const W = width;
  const H = height;
  const PL = 6;
  // Right gutter sized to the R1/R2/S1/S2 boxes and the last-price tag so they are never clipped.
  const PR = chartRightGutter(
    lv.map(([n, v]) => `${n} ${formatCurrency(v)}`),
    formatCurrency(safeStockPx),
    T(14),
    T(13),
  );
  const PT = 10;
  const PB = Math.max(22, Math.ceil(T(12) + 12));
  const cw = (W - PL - PR) / (vw.to - vw.from || 1);
  /** Left edge of candle slot i, in the zoomed / scrolled window. */
  const sx = (i: number) => PL + (i - vw.from) * cw;
  const plotW = W - PL - PR;
  useEffect(() => {
    geo.current = { vw, NB, PL, plotW, W, onView };
  });
  const fz = T(14);

  if (!candles || candles.length === 0) {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} style={{ display: "block", width: "100%", height: "100%" }}>
        <text style={{ fill: "var(--th-7a8481)" }} x={width / 2} y={height / 2} textAnchor="middle" fontSize={T(13)} fontFamily="'JetBrains Mono', monospace">
          No regular-session bars yet
        </text>
      </svg>
    );
  }
  const safeCandles = candles;

  // Price scale fits the candles in view.
  const i0 = Math.max(0, Math.floor(vw.from)), i1 = Math.ceil(vw.to);
  const inView = safeCandles.slice(i0, i1 + 1);
  const candleVals = (inView.length ? inView : safeCandles)
    .flatMap((x) => [x.h, x.l, x.o, x.c])
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0);

  // The candles are scaled to their own range only: the levels sit on fixed rows, not on this scale.
  let mx = candleVals.length ? Math.max(...candleVals, safeStockPx) : safeStockPx * 1.015;
  let mn = candleVals.length ? Math.min(...candleVals, safeStockPx) : safeStockPx * 0.985;
  const pad = Math.max((mx - mn) * 0.04, safeStockPx * 0.002);
  mx += pad;
  mn -= pad;

  if (!Number.isFinite(mx) || !Number.isFinite(mn) || mx <= mn) {
    mx = safeStockPx * 1.015;
    mn = safeStockPx * 0.985;
  }

  // R2/R1 on fixed rows at the top, S1/S2 at the bottom; with Patterns on, a lane
  // between them and the candles holds the pattern callouts — only as many rows,
  // on each side, as the callouts in view need (calloutLaneRows).
  const calloutFz = T(11.5);
  // Only patterns whose callout points at a candle in view (slot i is visible while i < view end).
  const last = Math.min(Math.ceil(vw.to) - 1, safeCandles.length - 1);
  const patGlyphs = layers.pat
    ? patternsToShow(detectPatterns(safeCandles), i0, last, { candles: 3, others: 4 })
        .map((h) => patternGlyphs(h))
        .filter((g) => g.label.i >= vw.from - 0.5 && g.label.i <= last)
    : [];
  const laneRows = calloutLaneRows(patGlyphs.map((g) => g.label));
  const laneRowH = calloutFz + 8;
  // On 1m charts, keep candles at full height without callout lane intrusion; off-scale levels sit as edge markers
  const laneTop = tf === 1 ? 0 : laneRows.above * laneRowH;
  const laneBottom = tf === 1 ? 0 : laneRows.below * laneRowH;
  const rows = popLevelRows(PT, H - PB, fz + 8, laneTop, laneBottom);
  const pTop = rows.band.top, pBot = rows.band.bottom;
  const y = (v: number) => {
    const val = Number.isFinite(v) ? v : safeStockPx;
    return pTop + ((mx - val) / (mx - mn || 1)) * (pBot - pTop);
  };

  const zx = sx(Math.max(0, ZI));
  const obs = layers.ob ? computeOrderBlocks(safeCandles) : [];
  const swings = layers.liq || layers.str ? computeSwings(safeCandles, tf <= 3 ? 4 : tf >= 15 ? 2 : 3) : [];

  // Liquidity: of the swings not yet swept, the three nearest the price on each side;
  // of the swept ones, the two most recent per side (1m had ~14 "✕ swept" tags).
  const liq = swings.map((p) => {
    let sw: number | null = null;
    for (let j = p.i + 1; j < safeCandles.length; j++) {
      if (p.hi ? safeCandles[j].h > p.p : safeCandles[j].l < p.p) { sw = j; break; }
    }
    return { p, sw };
  });
  const keepSwept = new Set(
    [true, false].flatMap((hi) => liq.filter((l) => l.p.hi === hi && l.sw != null).sort((a, b) => b.sw! - a.sw!).slice(0, 2)),
  );
  const keepOpen = new Set(
    [true, false].flatMap((hi) => liq.filter((l) => l.p.hi === hi && l.sw == null).sort((a, b) => Math.abs(a.p.p - safeStockPx) - Math.abs(b.p.p - safeStockPx)).slice(0, 3)),
  );
  const liqShown = liq.filter((l) => keepOpen.has(l) || keepSwept.has(l));

  // Structure levels (also used by the edge labels below).
  const hiAll = Math.max(...safeCandles.map((q) => q.h));
  const loAll = Math.min(...safeCandles.map((q) => q.l));
  const eq = (hiAll + loAll) / 2;
  const orb = safeCandles.slice(0, Math.min(safeCandles.length, Math.max(1, Math.round(30 / tf))));
  const orh = Math.max(...orb.map((q) => q.h));
  const orl = Math.min(...orb.map((q) => q.l));
  const pdh = stock.prevHigh ?? NaN;
  const pdl = stock.prevLow ?? NaN;

  // Right-edge labels, merged by price and spaced apart; off-scale ones pinned to the edge (layoutEdgeLabels).
  const edgeIn: EdgeLabelIn[] = [];
  if (layers.liq) for (const l of liqShown) if (l.sw == null) edgeIn.push({ price: l.p.p, name: l.p.hi ? "BSL" : "SSL", color: l.p.hi ? "var(--th-f0a24a)" : "var(--th-4ad0c9)" });
  if (layers.str) {
    edgeIn.push(
      { price: eq, name: "EQ 50%", color: "var(--th-aab3b0)" },
      { price: orh, name: "ORH", color: "var(--th-9aa7ff)" },
      { price: orl, name: "ORL", color: "var(--th-9aa7ff)" },
      { price: hiAll, name: "HOD", color: "var(--th-e0bb5e)" },
      { price: loAll, name: "LOD", color: "var(--th-e0bb5e)" },
    );
    if (Number.isFinite(pdh)) edgeIn.push({ price: pdh, name: "PDH", color: "var(--th-9aa7ff)" });
    if (Number.isFinite(pdl)) edgeIn.push({ price: pdl, name: "PDL", color: "var(--th-9aa7ff)" });
  }
  const edgeFz = T(12);
  const edgeLabels = layoutEdgeLabels(edgeIn, y, pTop + edgeFz * 0.5, pBot - edgeFz * 0.3, edgeFz + 4);
  // In-chart labels from every layer are collected while the layers render and
  // drawn last, spread apart so none print over another (declutterLabels).
  const chartLabels: ChartLabel[] = [];
  // Boxes the labels must avoid but not move: pattern callouts, the pattern badge, and the live price marker line.
  const priceY = y(safeStockPx);
  const fixedLabelBoxes: LabelBox[] = [
    { x0: PL, x1: W - PR, y0: priceY - 7, y1: priceY + 7 },
  ];
  const label = (l: Omit<ChartLabel, "anchor" | "dir"> & Partial<Pick<ChartLabel, "anchor" | "dir">>): null => {
    chartLabels.push({ anchor: "start", dir: -1, ...l });
    return null;
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ display: "block", width: "100%", height: "100%", minWidth: W, cursor: onView ? "grab" : undefined, touchAction: "none" }}
      onPointerDown={(e) => {
        if (!onView || e.button !== 0) return;
        drag.current = { x: e.clientX, v: vw };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || !onView) return;
        const r = e.currentTarget.getBoundingClientRect();
        const dx = ((e.clientX - d.x) / (r.width || 1)) * W; // chart units
        onView(panIntradayView(d.v, -dx / cw, NB));
      }}
      onPointerUp={() => { drag.current = null; }}
      onPointerCancel={() => { drag.current = null; }}
      onDoubleClick={() => onView?.(fullSessionView(NB))}
    >
      <defs>
        {/* Candles and layers stay inside the price area when zoomed or scrolled */}
        <clipPath id={`${clipId}p`}><rect x={0} y={rows.y.R1} width={W - PR} height={rows.y.S1 - rows.y.R1} /></clipPath>
        <clipPath id={`${clipId}x`}><rect x={0} y={0} width={W - PR + 1} height={H} /></clipPath>
      </defs>
      {/* Chart box: the price area only — the level column to its right sits outside it */}
      {(() => { const f = chartFrame(W, H, PR); return <rect style={{ fill: "var(--th-08090a)", stroke: "var(--th-171c1e)" }} x={f.x + 0.5} y={f.y + 0.5} width={f.w - 1} height={f.h - 1} rx={8} />; })()}

      {/* Grid lines */}
      {[1, 2, 3, 4, 5].map((g) => {
        const gy = PT + (g * (H - PT - PB)) / 6;
        return (
          <line style={{ stroke: "var(--th-12171a)" }}
            key={`g_${g}`}
            x1={PL}
            x2={W - PR}
            y1={gy}
            y2={gy}
          />
        );
      })}

      <g clipPath={`url(#${clipId}p)`}>
      {/* Order Block Base Zone */}
      {layers.ob && (
        <>
          {zone && ZI >= 0 && (
          <>
          <rect style={{ fill: "rgba(201,162,74,.16)", stroke: "var(--th-c9a24a)" }}
            x={zx}
            y={y(zone.hi)}
            width={Math.max(2, W - PR - zx)}
            height={Math.max(2, y(zone.lo) - y(zone.hi))}
            strokeWidth={1}
          />
          {label({ key: "zone", text: `ZONE ${formatCurrency(zone.lo)}–${formatCurrency(zone.hi)}`, x: zx + 5, y: y(zone.hi) - 5, fz: fz - 0.5, color: "var(--th-e0bb5e)" })}
          </>
          )}

          {obs.map((b, bi) => {
            const x1 = sx(b.i);
            const x2 = b.mit ? sx(b.end + 1) : W - PR;
            const col = b.bull ? "61,220,132" : "240,86,90";
            return (
              <g key={`ob_rect_${bi}`}>
                <rect style={{ fill: `rgba(${col},${b.mit ? 0.06 : 0.16})`, stroke: `rgba(${col},${b.mit ? 0.3 : 0.85})` }}
                  x={x1}
                  y={y(b.hi)}
                  width={Math.max(2, x2 - x1)}
                  height={Math.max(2, y(b.lo) - y(b.hi))}
                  strokeDasharray={b.mit ? "3 3" : undefined}
                  strokeWidth={1}
                />
                {!b.mit && label({ key: `ob_${bi}`, text: b.bull ? "BULL OB" : "BEAR OB", x: x1 + 3, y: b.bull ? y(b.lo) + 12 : y(b.hi) - 4, fz: T(12.5), color: `rgb(${col})`, dir: b.bull ? 1 : -1 })}
              </g>
            );
          })}
        </>
      )}

      </g>

      {/* Pivots R1, R2, S1, S2: fixed rows; the name in the box, the value beside it */}
      {lv.map(([n, v]) => {
        const col =
          n === "R2"
            ? "var(--th-ff9f43)"
            : n === "R1"
            ? "var(--th-f5c542)"
            : n === "S1"
            ? "var(--th-4fd1e8)"
            : "var(--th-6ea8ff)";
        const tg = levelTag(n, v, fz, W - PR + 2);
        const ly = rows.y[n as keyof typeof rows.y];
        return (
          <g key={n}>
            <line style={{ stroke: col }}
              x1={PL}
              x2={W - PR}
              y1={ly}
              y2={ly}
              strokeOpacity={0.6}
              strokeDasharray="5 4"
            />
            <rect style={{ fill: "rgb(var(--thr-08090a) / .88)", stroke: col }}
              x={tg.box.x}
              y={ly - fz * 0.75 - 2}
              width={tg.box.w}
              height={fz + 4}
              rx={3}
              strokeOpacity={0.55}
            />
            <text style={{ fill: col }}
              x={tg.box.x + 4}
              y={ly + fz * 0.36}
              fontSize={fz}
              fontFamily="'JetBrains Mono', monospace"
              fontWeight={700}
            >
              {tg.name}
            </text>
            <text style={{ fill: col }}
              x={tg.value.x}
              y={ly + fz * 0.36}
              fontSize={fz}
              fontFamily="'JetBrains Mono', monospace"
              fontWeight={700}
            >
              {tg.value.text}
            </text>
          </g>
        );
      })}

      <g clipPath={`url(#${clipId}p)`}>
      {/* VWAP */}
      {layers.vwap && (
        <polyline style={{ fill: "none", stroke: "var(--th-8b7cf6)" }}
          points={safeCandles
            .map((b, i) => `${sx(i) + cw / 2},${y(b.vw)}`)
            .join(" ")}
          strokeWidth={1.3}
          strokeDasharray="4 3"
        />
      )}

      {/* Fair Value Gaps (FVG) */}
      {layers.fvg && (() => {
        return computeFvgs(safeCandles).map((g, gi) => {
          const end = g.end;
          const x1 = sx(g.i);
          const x2 = end != null ? sx(end + 1) : W - PR;
          const col = g.bull ? "90,169,230" : "230,120,190";
          return (
            <g key={`fvg_${gi}`}>
              <rect style={{ fill: `rgba(${col},${end != null ? 0.07 : 0.2})`, stroke: `rgba(${col},${end != null ? 0.35 : 0.8})` }}
                x={x1}
                y={y(g.hi)}
                width={Math.max(2, x2 - x1)}
                height={Math.max(1.5, y(g.lo) - y(g.hi))}
                strokeWidth={0.8}
                strokeDasharray="2 2"
              />
              {end == null && label({ key: `fvg_${gi}`, text: "FVG", x: x1 + 2, y: y(g.hi) - 4, fz: T(12), color: `rgb(${col})` })}
            </g>
          );
        });
      })()}

      {/* Liquidity (BSL / SSL): unswept lines (their prices are edge labels) + the two latest swept per side */}
      {layers.liq && liqShown.map(({ p, sw }, pi) => {
        const x1 = sx(p.i) + cw / 2;
        const x2 = sw != null ? sx(sw) + cw / 2 : W - PR;
        const col = p.hi ? "var(--th-f0a24a)" : "var(--th-4ad0c9)";
        return (
          <g key={`liq_${pi}`}>
            <line style={{ stroke: col }}
              x1={x1}
              x2={x2}
              y1={y(p.p)}
              y2={y(p.p)}
              strokeWidth={sw != null ? 0.8 : 1.2}
              strokeOpacity={sw != null ? 0.45 : 0.9}
              strokeDasharray="1 3"
            />
            {sw != null && (
              <text style={{ fill: col }}
                x={x2}
                y={y(p.p) + (p.hi ? -4 : 12)}
                fontSize={T(12)}
                fontFamily="'JetBrains Mono', monospace"
                fontWeight={700}
                textAnchor="middle"
              >
                ✕
              </text>
            )}
          </g>
        );
      })}

      {/* Structure Layer */}
      {layers.str && (() => {
        const xi = (i: number) => sx(i) + cw / 2;

        const ih = safeCandles.findIndex((q) => q.h === hiAll);
        const il = safeCandles.findIndex((q) => q.l === loAll);

        let lH: SwingPoint | null = null;
        let lL: SwingPoint | null = null;
        const swingSorted = swings.slice().sort((a, b) => a.i - b.i);

        const ev: Array<{ p: SwingPoint; j: number }> = [];
        swingSorted.forEach((p) => {
          for (let j = p.i + 3; j < safeCandles.length; j++) {
            if (p.hi ? safeCandles[j].c > p.p : safeCandles[j].c < p.p) {
              ev.push({ p, j });
              break;
            }
          }
        });

        const SH = swingSorted.filter((p) => p.hi);
        const SL = swingSorted.filter((p) => !p.hi);
        let pattern = "";
        let s1: number | null = null;
        let s2: number | null = null;

        if (SH.length >= 2) {
          const tlhA = SH[SH.length - 2];
          const tlhB = SH[SH.length - 1];
          s1 = (tlhB.p - tlhA.p) / (tlhB.i - tlhA.i || 1);
        }
        if (SL.length >= 2) {
          const tllA = SL[SL.length - 2];
          const tllB = SL[SL.length - 1];
          s2 = (tllB.p - tllA.p) / (tllB.i - tllA.i || 1);
        }
        if (s1 != null && s2 != null) {
          pattern =
            s1 < 0 && s2 > 0
              ? "SYMMETRICAL TRIANGLE"
              : s1 < 0 && s2 < 0 && s1 < s2
              ? "FALLING WEDGE"
              : s1 > 0 && s2 > 0 && s2 > s1
              ? "RISING WEDGE"
              : Math.abs(s1) < safeStockPx * 0.00002 && s2 > 0
              ? "ASCENDING TRIANGLE"
              : s1 < 0 && Math.abs(s2) < safeStockPx * 0.00002
              ? "DESCENDING TRIANGLE"
              : s1 > 0 && s2 > 0
              ? "ASCENDING CHANNEL"
              : s1 < 0 && s2 < 0
              ? "DESCENDING CHANNEL"
              : "RANGE";
        }

        return (
          <g key="str_layer">
            <rect style={{ fill: "rgba(240,86,90,.035)" }}
              x={PL}
              y={y(hiAll)}
              width={W - PR - PL}
              height={Math.max(0, y(eq) - y(hiAll))}
            />
            <rect style={{ fill: "rgba(61,220,132,.035)" }}
              x={PL}
              y={y(eq)}
              width={W - PR - PL}
              height={Math.max(0, y(loAll) - y(eq))}
            />
            <line style={{ stroke: "rgb(var(--thr-e6ebe8) / .35)" }}
              x1={PL}
              x2={W - PR}
              y1={y(eq)}
              y2={y(eq)}
              strokeDasharray="1 4"
            />
            {label({ key: "premium", text: `PREMIUM ${formatCurrency(eq)}–${formatCurrency(hiAll)}`, x: PL + 4, y: y(hiAll) + 12, fz: T(11), color: "rgba(240,86,90,.7)", dir: 1 })}
            {label({ key: "discount", text: `DISCOUNT ${formatCurrency(loAll)}–${formatCurrency(eq)}`, x: PL + 4, y: y(loAll) - 5, fz: T(11), color: "rgba(61,220,132,.7)" })}

            {pdh <= mx && pdh >= mn && (
              <>
                <line style={{ stroke: "var(--th-9aa7ff)" }}
                  x1={PL}
                  x2={W - PR}
                  y1={y(pdh)}
                  y2={y(pdh)}
                  strokeWidth={1}
                  strokeOpacity={0.6}
                  strokeDasharray="2 5"
                />
              </>
            )}
            {pdl <= mx && pdl >= mn && (
              <>
                <line style={{ stroke: "var(--th-9aa7ff)" }}
                  x1={PL}
                  x2={W - PR}
                  y1={y(pdl)}
                  y2={y(pdl)}
                  strokeWidth={1}
                  strokeOpacity={0.6}
                  strokeDasharray="2 5"
                />
              </>
            )}

            <rect style={{ fill: "rgba(154,167,255,.07)", stroke: "rgba(154,167,255,.35)" }}
              x={sx(0)}
              y={y(orh)}
              width={Math.max(2, xi(orb.length - 1) - sx(0) + cw / 2)}
              height={Math.max(1, y(orl) - y(orh))}
              strokeDasharray="3 3"
            />
            <line style={{ stroke: "rgba(154,167,255,.5)" }}
              x1={PL}
              x2={W - PR}
              y1={y(orh)}
              y2={y(orh)}
              strokeDasharray="6 4"
            />
            <line style={{ stroke: "rgba(154,167,255,.5)" }}
              x1={PL}
              x2={W - PR}
              y1={y(orl)}
              y2={y(orl)}
              strokeDasharray="6 4"
            />

            {ih >= 0 && (
              <>
                <path style={{ fill: "var(--th-e0bb5e)" }}
                  d={`M${xi(ih) - 4},${y(hiAll) - 9} L${xi(ih) + 4},${y(hiAll) - 9} L${xi(ih)},${y(hiAll) - 3}Z`}
                />
              </>
            )}
            {il >= 0 && (
              <>
                <path style={{ fill: "var(--th-e0bb5e)" }}
                  d={`M${xi(il) - 4},${y(loAll) + 9} L${xi(il) + 4},${y(loAll) + 9} L${xi(il)},${y(loAll) + 3}Z`}
                />
              </>
            )}

            {swingSorted.map((p) => {
              let tag = "";
              if (p.hi) {
                tag = lH == null ? "H" : p.p > lH.p ? "HH" : "LH";
                lH = p;
              } else {
                tag = lL == null ? "L" : p.p > lL.p ? "HL" : "LL";
                lL = p;
              }
              return { p, tag };
            }).slice(-6).map(({ p, tag }, pi) => {
              // Only the six most recent swing tags (1m drew a wall of HH / HL along the candles).
              const cx = xi(p.i);
              const col =
                tag === "HH" || tag === "HL"
                  ? "var(--th-3ddc84)"
                  : tag === "LH" || tag === "LL"
                  ? "var(--th-f0565a)"
                  : "var(--th-aab3b0)";
              return label({ key: `sw_${pi}`, text: tag, x: cx, y: p.hi ? y(p.p) - 7 : y(p.p) + 15, fz: T(12), color: col, anchor: "middle", dir: p.hi ? -1 : 1 });
            })}

            {ev.slice(-3).map((e, ei) => {
              const up = e.p.hi;
              const x1 = xi(e.p.i);
              const x2 = xi(e.j);
              const col = up ? "var(--th-3ddc84)" : "var(--th-f0565a)";
              return (
                <g key={`bos_${ei}`}>
                  <line style={{ stroke: col }}
                    x1={x1}
                    x2={x2}
                    y1={y(e.p.p)}
                    y2={y(e.p.p)}
                    strokeWidth={1}
                  />
                  {label({ key: `bos_${ei}`, text: "BOS", x: (x1 + x2) / 2, y: y(e.p.p) + (up ? -4 : 12), fz: T(12), color: col, anchor: "middle", dir: up ? -1 : 1 })}
                </g>
              );
            })}

            {pattern && (fixedLabelBoxes.push({ x0: PL + 4, x1: PL + 18 + pattern.length * 7.5, y0: PT + 2, y1: PT + 20 }), true) && (
              <g key="pat_badge">
                <rect style={{ fill: "rgb(var(--thr-08090a) / .85)", stroke: "var(--th-5a4a22)" }}
                  x={PL + 4}
                  y={PT + 2}
                  width={pattern.length * 7.5 + 14}
                  height={18}
                  rx={3}
                />
                <text style={{ fill: "var(--th-f0d68c)" }}
                  x={PL + 10}
                  y={PT + 15}
                  fontSize={T(12)}
                  fontFamily="'JetBrains Mono', monospace"
                  fontWeight={700}
                >
                  {pattern}
                </text>
              </g>
            )}
          </g>
        );
      })()}

      {/* Candles */}
      {safeCandles.map((b, i) => {
        const cx = sx(i) + cw / 2;
        const cyO = y(b.o);
        const cyC = y(b.c);
        const cyH = y(b.h);
        const cyL = y(b.l);
        const green = b.c >= b.o;
        const color = green ? "var(--th-3ddc84)" : "var(--th-f0565a)";
        const bodyTop = Math.min(cyO, cyC);
        const bodyH = Math.max(1, Math.abs(cyC - cyO));
        const bw = Math.max(2, cw - 2);

        return (
          <g key={`c_${i}`}>
            <line style={{ stroke: color }}
              x1={cx}
              x2={cx}
              y1={cyH}
              y2={cyL}
              strokeWidth={1}
            />
            <rect style={{ fill: color }}
              x={cx - bw / 2}
              y={bodyTop}
              width={bw}
              height={bodyH}
            />
          </g>
        );
      })}

      {/* Patterns (app/iq/patterns): latest candle marks + chart patterns, each with its rule as the tooltip */}
      {layers.pat && (() => {
        const xi = (i: number) => sx(i) + cw / 2;
        const lf = calloutFz;
        const glyphs = patGlyphs;
        // Callouts in the bands above / below the price with an arrow to each pattern (layoutCallouts).
        const tags = layoutCallouts(
          glyphs.map((g) => ({
            ax: xi(Math.min(g.label.i, safeCandles.length - 1)),
            ay: y(g.label.p) + (g.label.above ? -4 : 4),
            w: g.label.text.length * lf * 0.56 + 10,
            h: lf + 6,
            above: g.label.above,
          })),
          rows.lanes,
          PL + 2,
          W - PR - 4,
        );
        for (const t of tags) fixedLabelBoxes.push({ x0: t.x, x1: t.x + t.w, y0: t.y, y1: t.y + t.h });
        const colors = [...new Set(glyphs.map((g) => g.color))];
        return (
          <g>
            <defs>
              {colors.map((c) => (
                <marker key={c} id={`mfArrow${c.slice(1)}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path style={{ fill: c }} d="M0,0 L8,4 L0,8 z" />
                </marker>
              ))}
            </defs>
            {glyphs.map((g, hi) => {
              const tg = tags[hi];
              return (
                <g key={`pat_${hi}`}>
                  <title>{g.title}</title>
                  {g.lines.map((l, li) => (
                    <line style={{ stroke: g.color }} key={li} x1={xi(l.i0)} y1={y(l.p0)} x2={xi(Math.min(l.i1, safeCandles.length - 1))} y2={y(l.p1)} strokeWidth={1.3} strokeOpacity={0.8} strokeDasharray={l.dash.join(" ") || undefined} />
                  ))}
                  {/* The pattern's point labels (LS, H, T2, B1 …) join the other labels, so two patterns' points never print over each other. */}
                  {g.points.map((p, pi) => label({ key: `pp${hi}_${pi}`, text: p.label, x: xi(p.i), y: y(p.p) + (g.label.above ? -5 : lf + 3), fz: T(10.5), color: g.color, anchor: "middle", dir: g.label.above ? -1 : 1 }))}
                  <line style={{ stroke: g.color }} x1={tg.arrow.x1} y1={tg.arrow.y1} x2={tg.arrow.x2} y2={tg.arrow.y2} strokeWidth={1.2} strokeOpacity={0.9} markerEnd={`url(#mfArrow${g.color.slice(1)})`} />
                  <rect style={{ fill: "rgb(var(--thr-08090a) / .92)", stroke: g.color }} x={tg.x} y={tg.y} width={tg.w} height={tg.h} rx={4} strokeOpacity={0.75} />
                  <text style={{ fill: g.color }} x={tg.x + 5} y={tg.y + tg.h / 2 + lf * 0.36} fontSize={lf} fontFamily="Manrope, sans-serif" fontWeight={700}>{g.label.text}</text>
                </g>
              );
            })}
          </g>
        );
      })()}

      </g>

      {/* In-chart labels from every layer, spread apart (and clear of the right-edge tags) so none overlap */}
      <g clipPath={`url(#${clipId}x)`}>
        {declutterLabels(chartLabels, { top: rows.y.R1, bottom: rows.y.S1, left: PL + 2, right: W - PR - 4 }, 2,
          [...fixedLabelBoxes, ...edgeLabels.map((l) => { const w = l.text.length * edgeFz * 0.6 + 8; return { x0: W - PR - 4 - w, x1: W - PR - 4, y0: l.y - edgeFz * 0.75, y1: l.y + edgeFz * 0.25 + 3 }; })],
        ).filter((l) => !l.hidden).map((l) => (
          <text key={l.key} style={{ fill: l.color }} x={l.x} y={l.y} fontSize={l.fz} fontFamily="'JetBrains Mono', monospace" fontWeight={700} textAnchor={l.anchor}>
            {l.text}
          </text>
        ))}
      </g>

      {/* Right-edge labels: one per price, spaced apart, off-scale ones pinned with ▲ / ▼ */}
      <g clipPath={`url(#${clipId}x)`}>
        {edgeLabels.map((l, li) => {
          const w = l.text.length * edgeFz * 0.6 + 8;
          return (
            <g key={`edge_${li}`}>
              <rect style={{ fill: "rgb(var(--thr-08090a) / .82)" }} x={W - PR - 4 - w} y={l.y - edgeFz * 0.75} width={w} height={edgeFz + 3} rx={3} />
              <text style={{ fill: l.color }} x={W - PR - 8} y={l.y + edgeFz * 0.35} fontSize={edgeFz} fontFamily="'JetBrains Mono', monospace" fontWeight={700} textAnchor="end">
                {l.text}
              </text>
            </g>
          );
        })}
      </g>

      <g clipPath={`url(#${clipId}x)`}>
      {/* Time axis (ET) */}
      {(() => {
        const ticks = timeTicks(tf).filter((k) => k.i < NB);
        let lastRenderedX = -Infinity;
        const minGapPx = 48;
        return ticks.map((k) => {
          const tx = sx(k.i);
          if (tx - lastRenderedX < minGapPx && k.i !== 0) {
            return null;
          }
          lastRenderedX = tx;
          return (
            <g key={`tt_${k.i}`}>
              <line style={{ stroke: "rgb(var(--thr-ffffff) / .05)" }} x1={tx} x2={tx} y1={PT} y2={H - PB} strokeWidth={1} />
              <text style={{ fill: "var(--th-7a8481)" }} x={tx} y={H - PB + T(12) + 5} textAnchor={k.i === 0 ? "start" : "middle"} fontSize={T(12)} fontFamily="'JetBrains Mono', monospace">
                {k.label}
              </text>
            </g>
          );
        });
      })()}

      </g>

      {/* Current Price Marker */}
      <line style={{ stroke: "var(--th-ffffff)" }}
        x1={PL}
        x2={W - PR}
        y1={y(safeStockPx)}
        y2={y(safeStockPx)}
        strokeWidth={0.8}
        strokeDasharray="2 2"
      />
      <text style={{ fill: "var(--th-ffffff)" }}
        x={W - PR + 4}
        y={y(safeStockPx) + 4}
        fontSize={T(13)}
        fontFamily="'JetBrains Mono', monospace"
        fontWeight={700}
      >
        {formatCurrency(safeStockPx)}
      </text>
    </svg>
  );
}
