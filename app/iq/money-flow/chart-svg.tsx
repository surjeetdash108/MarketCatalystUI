/**
 * Money Flow Chart SVG Components
 * Sparklines, Volume Profiles, and Multi-layer Order Block Charts
 */

import React from "react";
import type { StockSession, OHLCVBar, OrderBlock, SwingPoint } from "./engine";
import { computeOrderBlocks, computeSwings, formatCurrency } from "./engine";

export function SparklineSvg({
  stock,
  candles,
}: {
  stock: StockSession;
  candles: OHLCVBar[];
}) {
  const cl = candles.map((x) => x.c);
  const lv = [stock.zLo, stock.zHi, stock.S1, stock.R1, stock.R2];
  const mx = Math.max(...cl, ...lv);
  const mn = Math.min(...cl, ...lv);
  const W = 200;
  const H = 80;
  const y = (v: number) => 4 + ((mx - v) / (mx - mn || 1)) * (H - 8);
  const col = stock.bull ? "#3ddc84" : "#f0565a";
  const x = (i: number) => (i / 78) * W;

  const points = cl.map((v, i) => `${x(i)},${y(v)}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ display: "block", width: "100%", height: "100%" }}
    >
      <rect
        x={x(stock.zi)}
        y={y(stock.zHi)}
        width={W - x(stock.zi)}
        height={Math.max(2, y(stock.zLo) - y(stock.zHi))}
        fill="rgba(201,162,74,.22)"
        stroke="#c9a24a"
        vectorEffect="non-scaling-stroke"
      />
      {[
        ["s", stock.S1, "rgba(230,235,232,.45)"],
        ["r1", stock.R1, "rgba(224,187,94,.6)"],
        ["r2", stock.R2, "rgba(224,187,94,.6)"],
      ].map(([k, v, cc]) => (
        <line
          key={k as string}
          x1={0}
          x2={W}
          y1={y(v as number)}
          y2={y(v as number)}
          stroke={cc as string}
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <polyline
        points={points}
        fill="none"
        stroke={col}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={x(stock.k)}
        x2={x(stock.k)}
        y1={0}
        y2={H}
        stroke="rgba(255,255,255,.15)"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={x(stock.k)} cy={y(stock.px)} r={2.5} fill="#fff" />
    </svg>
  );
}

export function MiniProfileSvg({
  stock,
  candles,
}: {
  stock: StockSession;
  candles: OHLCVBar[];
}) {
  const W = 120;
  const H = 60;
  const obs = computeOrderBlocks(stock, candles).filter((b) => !b.mit);
  const hi = Math.max(...candles.map((x) => x.h));
  const lo = Math.min(...candles.map((x) => x.l));
  const NB = 14;
  const bs = (hi - lo) / NB || 1;
  const bins = Array(NB)
    .fill(0)
    .map(() => ({ u: 0, d: 0 }));

  candles.forEach((x, i) => {
    const v = stock.vb[i] || 0;
    const j = Math.min(NB - 1, Math.max(0, Math.floor(((x.h + x.l) / 2 - lo) / bs)));
    bins[j][x.c >= x.o ? "u" : "d"] += v;
  });

  const tot = bins.map((b) => b.u + b.d);
  const mx = Math.max(...tot) || 1;
  const poc = tot.indexOf(mx);
  const y = (v: number) => 2 + ((hi - v) / (hi - lo || 1)) * (H - 4);
  const bh = (H - 4) / NB;
  const LW = 78;

  const vw = candles[candles.length - 1]?.vw ?? stock.px;
  const ly = y(stock.px);
  const lc = stock.bull ? "#3ddc84" : "#f0565a";

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ display: "block", width: "100%", height: "100%" }}
    >
      {obs.slice(-2).map((o, i) => {
        const col = o.bull ? "61,220,132" : "240,86,90";
        return (
          <rect
            key={`ob_${i}`}
            x={0}
            y={y(o.hi)}
            width={W}
            height={Math.max(2, y(o.lo) - y(o.hi))}
            fill={`rgba(${col},.14)`}
            stroke={`rgba(${col},.6)`}
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
            <rect
              x={W - wu - wd}
              y={yy + 0.4}
              width={wu}
              height={Math.max(1, bh - 0.8)}
              fill={isP ? "#3ddc84" : "rgba(61,220,132,.5)"}
            />
            <rect
              x={W - wd}
              y={yy + 0.4}
              width={wd}
              height={Math.max(1, bh - 0.8)}
              fill={isP ? "#f0565a" : "rgba(240,86,90,.5)"}
            />
          </g>
        );
      })}

      <line
        x1={0}
        x2={W}
        y1={H - 2 - (poc + 0.5) * bh}
        y2={H - 2 - (poc + 0.5) * bh}
        stroke="#e0bb5e"
        strokeWidth={0.6}
      />
      <line
        x1={0}
        x2={W}
        y1={y(vw)}
        y2={y(vw)}
        stroke="#8b7cf6"
        strokeWidth={0.6}
        strokeDasharray="2 1.5"
      />
      <line
        x1={0}
        x2={W}
        y1={ly}
        y2={ly}
        stroke="#fff"
        strokeWidth={0.5}
        strokeOpacity={0.7}
      />
      <polygon
        points={`0,${ly - 2.5} 4,${ly} 0,${ly + 2.5}`}
        fill={lc}
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
}: {
  stock: StockSession;
  candles: OHLCVBar[];
  layers: { ob: boolean; vwap: boolean; fvg: boolean; liq: boolean; str: boolean };
  tf?: number;
  width?: number;
  height?: number;
}) {
  const NB = Math.round(390 / tf) + 1;
  const ZI = Math.floor((stock.zi * 5) / tf);
  const KI = candles.length - 1;
  const W = width;
  const H = height;
  const PL = 6;
  const PR = 62;
  const PT = 10;
  const PB = 22;
  const cw = (W - PL - PR) / (NB || 1);
  const fz = 11;

  const safeStockPx = Number.isFinite(stock.px) && stock.px > 0 ? stock.px : (stock.p0 || 100);

  const rawLevels: Array<[string, number]> = [
    ["R2", stock.R2],
    ["R1", stock.R1],
    ["S1", stock.S1],
    ["S2", stock.S2],
  ];

  const lv: Array<[string, number]> = rawLevels.filter(
    (x): x is [string, number] =>
      typeof x[1] === "number" &&
      Number.isFinite(x[1]) &&
      x[1] > 0 &&
      Math.abs(x[1] - safeStockPx) / safeStockPx < 0.25
  );

  const safeCandles = (candles && candles.length > 0)
    ? candles
    : [{ o: safeStockPx, c: safeStockPx, h: safeStockPx * 1.002, l: safeStockPx * 0.998, vw: safeStockPx }];

  const candleVals = safeCandles
    .flatMap((x) => [x.h, x.l, x.o, x.c])
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0);

  const candleMin = candleVals.length ? Math.min(...candleVals) : safeStockPx * 0.985;
  const candleMax = candleVals.length ? Math.max(...candleVals) : safeStockPx * 1.015;
  const candleRange = Math.max(candleMax - candleMin, safeStockPx * 0.008);

  const levelVals = lv.map((x) => x[1]);
  // Filter out extreme pivot levels so they don't crush the intraday candles into a flat line
  const relevantLevels = levelVals.filter(
    (lvl) => lvl >= candleMin - candleRange * 1.6 && lvl <= candleMax + candleRange * 1.6
  );

  const displayVals = candleVals.concat(relevantLevels.length ? relevantLevels : [safeStockPx]);

  let mx = Math.max(...displayVals, safeStockPx);
  let mn = Math.min(...displayVals, safeStockPx);
  const pad = Math.max((mx - mn) * 0.08, safeStockPx * 0.003);
  mx += pad;
  mn -= pad;

  if (!Number.isFinite(mx) || !Number.isFinite(mn) || mx <= mn) {
    mx = safeStockPx * 1.015;
    mn = safeStockPx * 0.985;
  }

  const y = (v: number) => {
    const val = Number.isFinite(v) ? v : safeStockPx;
    return PT + ((mx - val) / (mx - mn || 1)) * (H - PT - PB);
  };

  const zx = PL + ZI * cw;
  const obs = layers.ob ? computeOrderBlocks(stock, safeCandles) : [];
  const swings = layers.liq || layers.str ? computeSwings(safeCandles, tf <= 3 ? 4 : tf >= 15 ? 2 : 3) : [];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ display: "block", width: "100%", height: "100%", minWidth: W }}
    >
      {/* Grid lines */}
      {[1, 2, 3, 4, 5].map((g) => {
        const gy = PT + (g * (H - PT - PB)) / 6;
        return (
          <line
            key={`g_${g}`}
            x1={PL}
            x2={W - PR}
            y1={gy}
            y2={gy}
            stroke="#12171a"
          />
        );
      })}

      {/* Order Block Base Zone */}
      {layers.ob && (
        <>
          <rect
            x={zx}
            y={y(stock.zHi)}
            width={Math.max(2, W - PR - zx)}
            height={Math.max(2, y(stock.zLo) - y(stock.zHi))}
            fill="rgba(201,162,74,.16)"
            stroke="#c9a24a"
            strokeWidth={1}
          />
          <text
            x={Math.min(zx + 5, W - PR - 150)}
            y={y(stock.zHi) - 5}
            fontSize={fz - 0.5}
            fill="#e0bb5e"
            fontFamily="'JetBrains Mono', monospace"
            fontWeight={700}
          >
            {`OB ${formatCurrency(stock.zLo)}–${formatCurrency(stock.zHi)}`}
          </text>

          {obs.map((b, bi) => {
            const x1 = PL + b.i * cw;
            const x2 = b.mit ? PL + (b.end + 1) * cw : W - PR;
            const col = b.bull ? "61,220,132" : "240,86,90";
            return (
              <g key={`ob_rect_${bi}`}>
                <rect
                  x={x1}
                  y={y(b.hi)}
                  width={Math.max(2, x2 - x1)}
                  height={Math.max(2, y(b.lo) - y(b.hi))}
                  fill={`rgba(${col},${b.mit ? 0.06 : 0.16})`}
                  stroke={`rgba(${col},${b.mit ? 0.3 : 0.85})`}
                  strokeDasharray={b.mit ? "3 3" : undefined}
                  strokeWidth={1}
                />
                {!b.mit && (
                  <text
                    x={x1 + 3}
                    y={b.bull ? y(b.lo) + 11 : y(b.hi) - 4}
                    fontSize={9.5}
                    fill={`rgb(${col})`}
                    fontFamily="'JetBrains Mono', monospace"
                    fontWeight={700}
                  >
                    {b.bull ? "BULL OB" : "BEAR OB"}
                  </text>
                )}
              </g>
            );
          })}
        </>
      )}

      {/* Pivots R1, R2, S1, S2 */}
      {lv.map(([n, v]) => {
        const col =
          n === "R2"
            ? "#ff9f43"
            : n === "R1"
            ? "#f5c542"
            : n === "S1"
            ? "#4fd1e8"
            : "#6ea8ff";
        const txt = `${n} ${formatCurrency(v)}`;
        const tw = txt.length * fz * 0.62 + 8;
        const lx = Math.max(
          PL + 2,
          Math.min(PL + (KI + 1) * cw + 10, W - PR - tw - 2)
        );
        const ly = y(v);
        return (
          <g key={n}>
            <line
              x1={PL}
              x2={W - PR}
              y1={ly}
              y2={ly}
              stroke={col}
              strokeOpacity={0.6}
              strokeDasharray="5 4"
            />
            <rect
              x={lx}
              y={ly - fz * 0.75 - 2}
              width={tw}
              height={fz + 4}
              rx={3}
              fill="rgba(8,9,10,.88)"
              stroke={col}
              strokeOpacity={0.55}
            />
            <text
              x={lx + 4}
              y={ly + fz * 0.36}
              fontSize={fz}
              fill={col}
              fontFamily="'JetBrains Mono', monospace"
              fontWeight={700}
            >
              {txt}
            </text>
          </g>
        );
      })}

      {/* VWAP */}
      {layers.vwap && (
        <polyline
          points={safeCandles
            .map((b, i) => `${PL + i * cw + cw / 2},${y(b.vw)}`)
            .join(" ")}
          fill="none"
          stroke="#8b7cf6"
          strokeWidth={1.3}
          strokeDasharray="4 3"
        />
      )}

      {/* Fair Value Gaps (FVG) */}
      {layers.fvg && (() => {
        const F: Array<{ i: number; lo: number; hi: number; bull: boolean }> = [];
        for (let i = 1; i < safeCandles.length - 1; i++) {
          const a = safeCandles[i - 1];
          const b = safeCandles[i + 1];
          if (b.l > a.h && (b.l - a.h) / (a.h || 1) > 0.0006) F.push({ i, lo: a.h, hi: b.l, bull: true });
          if (b.h < a.l && (a.l - b.h) / (a.l || 1) > 0.0006) F.push({ i, lo: b.h, hi: a.l, bull: false });
        }
        return F.slice(-7).map((g, gi) => {
          let end: number | null = null;
          for (let j = g.i + 2; j < safeCandles.length; j++) {
            if (g.bull ? safeCandles[j].l <= g.lo : safeCandles[j].h >= g.hi) {
              end = j;
              break;
            }
          }
          const x1 = PL + g.i * cw;
          const x2 = end != null ? PL + (end + 1) * cw : W - PR;
          const col = g.bull ? "90,169,230" : "230,120,190";
          return (
            <g key={`fvg_${gi}`}>
              <rect
                x={x1}
                y={y(g.hi)}
                width={Math.max(2, x2 - x1)}
                height={Math.max(1.5, y(g.lo) - y(g.hi))}
                fill={`rgba(${col},${end != null ? 0.07 : 0.2})`}
                stroke={`rgba(${col},${end != null ? 0.35 : 0.8})`}
                strokeWidth={0.8}
                strokeDasharray="2 2"
              />
              {end == null && (
                <text
                  x={x1 + 2}
                  y={y(g.hi) - 3}
                  fontSize={9}
                  fill={`rgb(${col})`}
                  fontFamily="'JetBrains Mono', monospace"
                  fontWeight={700}
                >
                  FVG
                </text>
              )}
            </g>
          );
        });
      })()}

      {/* Liquidity (BSL / SSL) */}
      {layers.liq && swings.map((p, pi) => {
        let sw: number | null = null;
        for (let j = p.i + 1; j < safeCandles.length; j++) {
          if (p.hi ? safeCandles[j].h > p.p : safeCandles[j].l < p.p) {
            sw = j;
            break;
          }
        }
        const x1 = PL + p.i * cw + cw / 2;
        const x2 = sw != null ? PL + sw * cw + cw / 2 : W - PR;
        const col = p.hi ? "#f0a24a" : "#4ad0c9";
        return (
          <g key={`liq_${pi}`}>
            <line
              x1={x1}
              x2={x2}
              y1={y(p.p)}
              y2={y(p.p)}
              stroke={col}
              strokeWidth={sw != null ? 0.8 : 1.2}
              strokeOpacity={sw != null ? 0.45 : 0.9}
              strokeDasharray="1 3"
            />
            {sw == null ? (
              <text
                x={W - PR - 4}
                y={y(p.p) + (p.hi ? -3 : 10)}
                fontSize={9}
                fill={col}
                fontFamily="'JetBrains Mono', monospace"
                fontWeight={700}
                textAnchor="end"
              >
                {`${p.hi ? "BSL " : "SSL "}${formatCurrency(p.p)}`}
              </text>
            ) : (
              <text
                x={x2}
                y={y(p.p) + (p.hi ? -3 : 10)}
                fontSize={9}
                fill={col}
                fontFamily="'JetBrains Mono', monospace"
                fontWeight={700}
                textAnchor="middle"
              >
                ✕ swept
              </text>
            )}
          </g>
        );
      })}

      {/* Structure Layer */}
      {layers.str && (() => {
        const N = safeCandles.length;
        const xi = (i: number) => PL + i * cw + cw / 2;
        const hiAll = Math.max(...safeCandles.map((q) => q.h));
        const loAll = Math.min(...safeCandles.map((q) => q.l));
        const eq = (hiAll + loAll) / 2;
        const pdh = stock.p0 * 1.0065;
        const pdl = stock.p0 * 0.9938;

        const orn = Math.max(1, Math.round(30 / tf));
        const orb = safeCandles.slice(0, Math.min(N, orn));
        const orh = Math.max(...orb.map((q) => q.h));
        const orl = Math.min(...orb.map((q) => q.l));

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
              : Math.abs(s1) < stock.p0 * 0.00002 && s2 > 0
              ? "ASCENDING TRIANGLE"
              : s1 < 0 && Math.abs(s2) < stock.p0 * 0.00002
              ? "DESCENDING TRIANGLE"
              : s1 > 0 && s2 > 0
              ? "ASCENDING CHANNEL"
              : s1 < 0 && s2 < 0
              ? "DESCENDING CHANNEL"
              : "RANGE";
        }

        return (
          <g key="str_layer">
            <rect
              x={PL}
              y={y(hiAll)}
              width={W - PR - PL}
              height={Math.max(0, y(eq) - y(hiAll))}
              fill="rgba(240,86,90,.035)"
            />
            <rect
              x={PL}
              y={y(eq)}
              width={W - PR - PL}
              height={Math.max(0, y(loAll) - y(eq))}
              fill="rgba(61,220,132,.035)"
            />
            <line
              x1={PL}
              x2={W - PR}
              y1={y(eq)}
              y2={y(eq)}
              stroke="rgba(230,235,232,.35)"
              strokeDasharray="1 4"
            />
            <text
              x={W - PR - 4}
              y={y(eq) - 3}
              fontSize={9}
              fill="#aab3b0"
              fontFamily="'JetBrains Mono', monospace"
              fontWeight={700}
              textAnchor="end"
            >
              EQ 50%
            </text>
            <text
              x={W - PR - 4}
              y={y(hiAll) + 10}
              fontSize={9}
              fill="rgba(240,86,90,.7)"
              fontFamily="'JetBrains Mono', monospace"
              fontWeight={700}
              textAnchor="end"
            >
              PREMIUM
            </text>
            <text
              x={W - PR - 4}
              y={y(loAll) - 4}
              fontSize={9}
              fill="rgba(61,220,132,.7)"
              fontFamily="'JetBrains Mono', monospace"
              fontWeight={700}
              textAnchor="end"
            >
              DISCOUNT
            </text>

            {pdh <= mx && pdh >= mn && (
              <>
                <line
                  x1={PL}
                  x2={W - PR}
                  y1={y(pdh)}
                  y2={y(pdh)}
                  stroke="#9aa7ff"
                  strokeWidth={1}
                  strokeOpacity={0.6}
                  strokeDasharray="2 5"
                />
                <text
                  x={PL + 4}
                  y={y(pdh) - 3}
                  fontSize={9}
                  fill="#9aa7ff"
                  fontFamily="'JetBrains Mono', monospace"
                  fontWeight={700}
                >
                  {`PDH ${formatCurrency(pdh)}`}
                </text>
              </>
            )}
            {pdl <= mx && pdl >= mn && (
              <>
                <line
                  x1={PL}
                  x2={W - PR}
                  y1={y(pdl)}
                  y2={y(pdl)}
                  stroke="#9aa7ff"
                  strokeWidth={1}
                  strokeOpacity={0.6}
                  strokeDasharray="2 5"
                />
                <text
                  x={PL + 4}
                  y={y(pdl) + 10}
                  fontSize={9}
                  fill="#9aa7ff"
                  fontFamily="'JetBrains Mono', monospace"
                  fontWeight={700}
                >
                  {`PDL ${formatCurrency(pdl)}`}
                </text>
              </>
            )}

            <rect
              x={PL}
              y={y(orh)}
              width={Math.max(2, xi(orb.length - 1) - PL + cw / 2)}
              height={Math.max(1, y(orl) - y(orh))}
              fill="rgba(154,167,255,.07)"
              stroke="rgba(154,167,255,.35)"
              strokeDasharray="3 3"
            />
            <line
              x1={PL}
              x2={W - PR}
              y1={y(orh)}
              y2={y(orh)}
              stroke="rgba(154,167,255,.5)"
              strokeDasharray="6 4"
            />
            <line
              x1={PL}
              x2={W - PR}
              y1={y(orl)}
              y2={y(orl)}
              stroke="rgba(154,167,255,.5)"
              strokeDasharray="6 4"
            />
            <text
              x={W - PR - 4}
              y={y(orh) - 3}
              fontSize={9}
              fill="#9aa7ff"
              fontFamily="'JetBrains Mono', monospace"
              fontWeight={700}
              textAnchor="end"
            >
              ORH
            </text>
            <text
              x={W - PR - 4}
              y={y(orl) + 10}
              fontSize={9}
              fill="#9aa7ff"
              fontFamily="'JetBrains Mono', monospace"
              fontWeight={700}
              textAnchor="end"
            >
              ORL
            </text>

            {ih >= 0 && (
              <>
                <path
                  d={`M${xi(ih) - 4},${y(hiAll) - 9} L${xi(ih) + 4},${y(hiAll) - 9} L${xi(ih)},${y(hiAll) - 3}Z`}
                  fill="#e0bb5e"
                />
                <text
                  x={xi(ih)}
                  y={y(hiAll) - 12}
                  fontSize={9}
                  fill="#e0bb5e"
                  fontFamily="'JetBrains Mono', monospace"
                  fontWeight={700}
                  textAnchor="middle"
                >
                  HOD
                </text>
              </>
            )}
            {il >= 0 && (
              <>
                <path
                  d={`M${xi(il) - 4},${y(loAll) + 9} L${xi(il) + 4},${y(loAll) + 9} L${xi(il)},${y(loAll) + 3}Z`}
                  fill="#e0bb5e"
                />
                <text
                  x={xi(il)}
                  y={y(loAll) + 20}
                  fontSize={9}
                  fill="#e0bb5e"
                  fontFamily="'JetBrains Mono', monospace"
                  fontWeight={700}
                  textAnchor="middle"
                >
                  LOD
                </text>
              </>
            )}

            {swingSorted.map((p, pi) => {
              const cx = xi(p.i);
              let tag = "";
              if (p.hi) {
                tag = lH == null ? "H" : p.p > lH.p ? "HH" : "LH";
                lH = p;
              } else {
                tag = lL == null ? "L" : p.p > lL.p ? "HL" : "LL";
                lL = p;
              }
              const col =
                tag === "HH" || tag === "HL"
                  ? "#3ddc84"
                  : tag === "LH" || tag === "LL"
                  ? "#f0565a"
                  : "#aab3b0";
              return (
                <text
                  key={`sw_${pi}`}
                  x={cx}
                  y={p.hi ? y(p.p) - 6 : y(p.p) + 13}
                  fontSize={9}
                  fill={col}
                  fontFamily="'JetBrains Mono', monospace"
                  fontWeight={700}
                  textAnchor="middle"
                >
                  {tag}
                </text>
              );
            })}

            {ev.slice(-4).map((e, ei) => {
              const up = e.p.hi;
              const x1 = xi(e.p.i);
              const x2 = xi(e.j);
              const col = up ? "#3ddc84" : "#f0565a";
              return (
                <g key={`bos_${ei}`}>
                  <line
                    x1={x1}
                    x2={x2}
                    y1={y(e.p.p)}
                    y2={y(e.p.p)}
                    stroke={col}
                    strokeWidth={1}
                  />
                  <text
                    x={(x1 + x2) / 2}
                    y={y(e.p.p) + (up ? -3 : 10)}
                    fontSize={9}
                    fill={col}
                    fontFamily="'JetBrains Mono', monospace"
                    fontWeight={700}
                    textAnchor="middle"
                  >
                    BOS
                  </text>
                </g>
              );
            })}

            {pattern && (
              <g key="pat_badge">
                <rect
                  x={PL + 4}
                  y={PT + 2}
                  width={pattern.length * 6.2 + 12}
                  height={15}
                  rx={3}
                  fill="rgba(8,9,10,.85)"
                  stroke="#5a4a22"
                />
                <text
                  x={PL + 10}
                  y={PT + 13}
                  fontSize={9}
                  fill="#f0d68c"
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
        const cx = PL + i * cw + cw / 2;
        const cyO = y(b.o);
        const cyC = y(b.c);
        const cyH = y(b.h);
        const cyL = y(b.l);
        const green = b.c >= b.o;
        const color = green ? "#3ddc84" : "#f0565a";
        const bodyTop = Math.min(cyO, cyC);
        const bodyH = Math.max(1, Math.abs(cyC - cyO));
        const bw = Math.max(2, cw - 2);

        return (
          <g key={`c_${i}`}>
            <line
              x1={cx}
              x2={cx}
              y1={cyH}
              y2={cyL}
              stroke={color}
              strokeWidth={1}
            />
            <rect
              x={cx - bw / 2}
              y={bodyTop}
              width={bw}
              height={bodyH}
              fill={color}
            />
          </g>
        );
      })}

      {/* Current Price Marker */}
      <line
        x1={PL}
        x2={W - PR}
        y1={y(stock.px)}
        y2={y(stock.px)}
        stroke="#ffffff"
        strokeWidth={0.8}
        strokeDasharray="2 2"
      />
      <text
        x={W - PR + 4}
        y={y(stock.px) + 4}
        fontSize={10}
        fill="#ffffff"
        fontFamily="'JetBrains Mono', monospace"
        fontWeight={700}
      >
        {formatCurrency(stock.px)}
      </text>
    </svg>
  );
}
