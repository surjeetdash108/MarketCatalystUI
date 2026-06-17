"use client";

import { useState, useRef, useCallback } from "react";

// ---- Number formatting ----
export function fmt(n: number, d = 2): string {
  if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  return n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function sign(n: number): string {
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
}

export function cls(n: number): string {
  return n > 0 ? 'up' : n < 0 ? 'down' : 'flat';
}

export function arr(n: number): string {
  return n >= 0 ? '▲' : '▼';
}

// ---- Sparkline SVG (deterministic from seed) ----
function _hash3(s: number): number { return s * s * s % 7; }

export function sparkSVG(seed: number, up: boolean): string {
  let p = 50;
  const pts = Array.from({ length: 20 }, (_, i) => {
    p = Math.min(90, Math.max(10, p + (_hash3(seed * (i + 3)) % 11) - 5));
    return p;
  });
  if (up) pts[pts.length - 1] = Math.max(pts[pts.length - 2], pts[pts.length - 1]);
  else pts[pts.length - 1] = Math.min(pts[pts.length - 2], pts[pts.length - 1]);
  const w = 80, h = 26;
  const xs = (i: number) => (i / (pts.length - 1)) * w;
  const ys = (v: number) => (1 - v / 100) * h;
  const d = 'M' + pts.map((v, i) => `${xs(i).toFixed(1)},${ys(v).toFixed(1)}`).join('L');
  const fill = `${d}L${w},${h}L0,${h}Z`;
  const color = up ? '#2FE6A6' : '#FF5470';
  const id = `sg${seed}`;
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:${h}px">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity=".3"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>
    <path d="${fill}" fill="url(#${id})"/>
    <path d="${d}" fill="none" stroke="${color}" stroke-width="1.5"/>
  </svg>`;
}

export function Spark({ seed, up }: { seed: number; up: boolean }) {
  return (
    <div
      className="spark"
      dangerouslySetInnerHTML={{ __html: sparkSVG(seed, up) }}
    />
  );
}

// ---- Semicircular gauge (matches HTML v5 gaugeSVG) ----
export function SemiGauge({ val, label, id = "sg" }: { val: number; label: string; id?: string }) {
  const cx = 70, cy = 66, r = 54;
  const a = Math.PI * (1 - val / 100);
  const nx = cx + r * Math.cos(a);
  const ny = cy - r * Math.sin(a);
  const arcLen = 170;
  const dashOffset = arcLen - arcLen * val / 100;
  const color = val >= 60 ? "var(--up)" : val >= 40 ? "var(--warn)" : "var(--down)";
  const gradId = `${id}-grad`;
  return (
    <svg viewBox="0 0 140 90" width={150} style={{ display: "block" }}>
      <defs>
        <linearGradient id={gradId} x1="0" x2="1">
          <stop offset="0" stopColor="#FF5470" />
          <stop offset=".5" stopColor="#FFB547" />
          <stop offset="1" stopColor="#2FE6A6" />
        </linearGradient>
      </defs>
      <path d="M16 66 A54 54 0 0 1 124 66" fill="none" stroke="var(--surface-3)" strokeWidth="11" strokeLinecap="round" />
      <path d="M16 66 A54 54 0 0 1 124 66" fill="none" stroke={`url(#${gradId})`} strokeWidth="11" strokeLinecap="round"
        strokeDasharray={arcLen} strokeDashoffset={dashOffset} />
      <circle cx={nx} cy={ny} r="6" fill="var(--text-hi)" stroke="var(--bg)" strokeWidth="3" />
      <text x="70" y="53" textAnchor="middle" fontSize="22" fontWeight="700"
        fontFamily="var(--f-mono)" fill={color}>{val}</text>
      <text x="70" y="79" textAnchor="middle" fontSize="8" fontWeight="600"
        letterSpacing="2" fontFamily="var(--f-display)" fill={color}>{label.toUpperCase()}</text>
    </svg>
  );
}

export function gaugeSVG(v: number, label: string, color: string): string { return ""; }
export function Gauge({ v, label, color, sublabel }: { v: number; label: string; color: string; sublabel?: string }) {
  return null;
}

// ---- Technical rating gauge (TradingView-style segmented semicircle) ----
const TR_TONE: Record<string, string> = {
  "Strong Buy": "var(--up)", "Buy": "#7bdcae", "Neutral": "var(--text-dim-solid)",
  "Sell": "#ff9aab", "Strong Sell": "var(--down)",
};
export const RATING_VAL: Record<string, number> = {
  "Strong Buy": 0.9, "Buy": 0.55, "Neutral": 0, "Sell": -0.55, "Strong Sell": -0.9,
};

export function TrGauge({ val, label }: { val: number; label: string }) {
  const cx = 90, cy = 82, r = 66;
  const t = (val + 1) / 2;
  const a = Math.PI * (1 - t);
  const nx = (cx + r * Math.cos(a)).toFixed(1);
  const ny = (cy - r * Math.sin(a)).toFixed(1);
  const arc = (s: number, e: number) => {
    const a0 = Math.PI * (1 - s), a1 = Math.PI * (1 - e);
    return `M ${(cx + r * Math.cos(a0)).toFixed(1)} ${(cy - r * Math.sin(a0)).toFixed(1)} A ${r} ${r} 0 0 1 ${(cx + r * Math.cos(a1)).toFixed(1)} ${(cy - r * Math.sin(a1)).toFixed(1)}`;
  };
  const tone = TR_TONE[label] ?? "var(--text-dim-solid)";
  return (
    <svg viewBox="0 0 180 104" width="190">
      <path d={arc(0, .2)} fill="none" stroke="#FF5470" strokeWidth="13" strokeLinecap="butt" />
      <path d={arc(.2, .4)} fill="none" stroke="#ff9aab" strokeWidth="13" strokeLinecap="butt" />
      <path d={arc(.4, .6)} fill="none" stroke="#697486" strokeWidth="13" strokeLinecap="butt" />
      <path d={arc(.6, .8)} fill="none" stroke="#7bdcae" strokeWidth="13" strokeLinecap="butt" />
      <path d={arc(.8, 1)} fill="none" stroke="#2FE6A6" strokeWidth="13" strokeLinecap="butt" />
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="var(--text-hi)" strokeWidth="3" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="6" fill="var(--text-hi)" />
      <text x={cx} y="100" textAnchor="middle" fill={tone} fontFamily="Space Grotesk" fontWeight="700" fontSize="15">{label}</text>
    </svg>
  );
}

// ---- Heatmap color (matches HTML heatCol) ----
export function heatCol(p: number): { bg: string; fg: string } {
  const a = Math.min(Math.abs(p) / 3, 1);
  const L = (x: number, y: number) => Math.round(x + (y - x) * a);
  let r: number, g: number, b: number;
  if (p >= 0) { r = L(206, 8); g = L(240, 120); b = L(220, 62); }
  else         { r = L(250, 168); g = L(214, 12); b = L(222, 32); }
  return { bg: `rgb(${r},${g},${b})`, fg: a > 0.42 ? "#ffffff" : "#0c1a13" };
}

// ---- Candlestick chart (matches HTML genOHLC + candleChart) ----
type OHLCBar = { o: number; h: number; l: number; c: number; v: number };

function _hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function _seed(n: number) {
  let s = n;
  return () => { s = (Math.imul(1664525, s) + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}

function _sma(data: OHLCBar[], p: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < p - 1) return null;
    let sum = 0;
    for (let j = i - p + 1; j <= i; j++) sum += data[j].c;
    return sum / p;
  });
}

function genOHLC(sym: string, tf: string, px: number): OHLCBar[] {
  const C: Record<string, [number, number]> = {
    "1D": [78, 0.5], "1W": [65, 0.9], "1M": [44, 1.5],
    "3M": [64, 1.1], "6M": [78, 1.3], "1Y": [90, 1.8], "5Y": [90, 2.6],
  };
  const [n, volat] = C[tf] ?? [64, 1.1];
  const rnd = _seed(_hash(sym + tf) + 7);
  let price = px * (tf === "5Y" ? 0.32 : tf === "1Y" ? 0.6 : 0.86);
  const out: OHLCBar[] = [];
  const bias = 0.08;
  for (let i = 0; i < n; i++) {
    const o = price;
    const ch = (rnd() - 0.5) * volat * 2 + bias * volat * 0.9;
    const c = Math.max(0.5, o * (1 + ch / 100));
    const h = Math.max(o, c) * (1 + rnd() * volat / 160);
    const l = Math.min(o, c) * (1 - rnd() * volat / 160);
    const v = 0.5 + rnd() * 0.7 + (Math.abs(ch) > volat ? 0.9 : 0);
    out.push({ o, h, l, c, v });
    price = c;
  }
  const k = px / out[out.length - 1].c;
  out.forEach(d => { d.o *= k; d.h *= k; d.l *= k; d.c *= k; });
  return out;
}

export function CandleChart({
  sym, tf, px, showMA = true, showVol = true,
}: { sym: string; tf: string; px: number; showMA?: boolean; showVol?: boolean }) {
  const [tip, setTip] = useState<{ html: string; left: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const data = genOHLC(sym, tf, px);
  const n = data.length;
  const W = 720, PH = 224, VH = showVol ? 54 : 0, GAP = showVol ? 10 : 0, PADT = 12, PADB = 18, axisW = 46;
  const H = PADT + PH + GAP + VH + PADB;
  const plotW = W - axisW - 8;
  const cw = plotW / n;
  const X = (i: number) => 6 + i * cw + cw / 2;
  const mn = Math.min(...data.map(x => x.l)), mx2 = Math.max(...data.map(x => x.h)), rng = (mx2 - mn) || 1;
  const Y = (p: number) => PADT + PH * (1 - (p - mn) / rng);
  const vmax = Math.max(...data.map(x => x.v)) || 1;
  const VY0 = PADT + PH + GAP, VYb = VY0 + VH;

  const gridLines = Array.from({ length: 5 }, (_, g) => {
    const yy = PADT + PH * g / 4;
    const val = mx2 - rng * g / 4;
    return { yy, val };
  });

  const m20 = showMA ? _sma(data, 20) : [];
  const m50 = showMA ? _sma(data, 50) : [];
  const ma20Path = showMA ? m20.map((v, i) => v == null ? "" : `${m20.slice(0, i).every(x => x == null) ? "M" : "L"}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).filter(Boolean).join(" ") : "";
  const ma50Path = showMA ? m50.map((v, i) => v == null ? "" : `${m50.slice(0, i).every(x => x == null) ? "M" : "L"}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).filter(Boolean).join(" ") : "";

  const erIdx = Math.round(n * 0.82);

  const handleMove = useCallback((e: React.MouseEvent<SVGRectElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = W / rect.width;
    const mx = (e.clientX - rect.left) * sx;
    let i = Math.round((mx - 6) / cw - 0.5);
    i = Math.max(0, Math.min(n - 1, i));
    const d = data[i];
    const chg = ((d.c - d.o) / d.o * 100);
    const col = chg >= 0 ? "var(--up)" : "var(--down)";
    const hostW = rect.width;
    const px2 = (X(i) / W) * hostW;
    setTip({
      html: `O <b>$${d.o.toFixed(2)}</b>  H <b>$${d.h.toFixed(2)}</b>  L <b>$${d.l.toFixed(2)}</b>  C <b>$${d.c.toFixed(2)}</b> <span style="color:${col}">${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%</span>`,
      left: Math.min(hostW - 200, Math.max(4, px2 + 10)),
    });
  }, [data, cw, n, W]);

  return (
    <div style={{ position: "relative" }}>
      {tip && (
        <div className="chart-tip" style={{ opacity: 1, left: tip.left, top: 14 }}
          dangerouslySetInnerHTML={{ __html: tip.html }} />
      )}
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block" }}>
        {/* Grid */}
        {gridLines.map(({ yy, val }) => (
          <g key={yy}>
            <line x1="6" x2={W - axisW} y1={yy} y2={yy} stroke="var(--border-soft)" strokeWidth="1" />
            <text className="caxis" x={W - axisW + 4} y={yy + 3}>${val > 500 ? Math.round(val) : val.toFixed(2)}</text>
          </g>
        ))}
        {/* Volume bars */}
        {showVol && data.map((d, i) => {
          const bh = Math.max(1, (d.v / vmax) * (VH - 4));
          const bw = Math.max(1.2, cw * 0.62);
          return (
            <rect key={`v${i}`} x={X(i) - bw / 2} y={VYb - bh} width={bw} height={bh}
              fill={d.c >= d.o ? "var(--up)" : "var(--down)"} opacity={0.34} />
          );
        })}
        {showVol && <text className="caxis" x="6" y={VY0 + 10}>Vol</text>}
        {/* Candles */}
        {data.map((d, i) => {
          const isUp = d.c >= d.o;
          const col = isUp ? "var(--up)" : "var(--down)";
          const bt = Y(Math.max(d.o, d.c)), bb = Y(Math.min(d.o, d.c));
          const bw = Math.max(1.2, cw * 0.62);
          return (
            <g key={i}>
              <line x1={X(i)} x2={X(i)} y1={Y(d.h)} y2={Y(d.l)} stroke={col} strokeWidth="1" />
              <rect x={X(i) - bw / 2} y={bt} width={bw} height={Math.max(1, bb - bt)} fill={col} />
            </g>
          );
        })}
        {/* MA overlays */}
        {showMA && ma20Path && <path d={ma20Path} fill="none" stroke="var(--ai)" strokeWidth="1.4" opacity={0.95} />}
        {showMA && ma50Path && <path d={ma50Path} fill="none" stroke="var(--brand-2)" strokeWidth="1.4" opacity={0.95} />}
        {showMA && (
          <>
            <text className="caxis" x={W - axisW - 86} y={PADT + 11} fill="var(--ai)">— MA20</text>
            <text className="caxis" x={W - axisW - 44} y={PADT + 11} fill="var(--brand-2)">— MA50</text>
          </>
        )}
        {/* ER event marker */}
        {erIdx < n && (
          <>
            <circle cx={X(erIdx)} cy={Y(data[erIdx].h) - 10} r="4" fill="var(--ai)" />
            <text className="caxis" x={X(erIdx)} y={Y(data[erIdx].h) - 16} textAnchor="middle" fill="var(--ai)">◆ ER</text>
          </>
        )}
        {/* Invisible hover rect */}
        <rect x="6" y={PADT} width={plotW} height={PH + GAP + VH} fill="transparent"
          onMouseMove={handleMove} onMouseLeave={() => setTip(null)} />
      </svg>
    </div>
  );
}

export function RsiPane({ sym, tf }: { sym: string; tf: string }) {
  const w = 720, h = 72;
  const rnd = _seed(_hash(sym + tf + "rsi"));
  let v = 52;
  const r: number[] = [];
  for (let i = 0; i < 90; i++) {
    v += Math.sin(i * 0.22) * 4 + (rnd() - 0.5) * 6 + (i > 72 ? 2.2 : 0);
    v = Math.max(22, Math.min(86, v));
    r.push(v);
  }
  const X = (i: number) => 40 + i * ((w - 60) / 89);
  const Yp = (p: number) => 8 + (h - 16) * (1 - p / 100);
  const line = r.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Yp(p).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", display: "block" }}>
      <line x1="40" x2={w - 20} y1={Yp(70)} y2={Yp(70)} stroke="#FF547055" strokeWidth="1" strokeDasharray="3 3" />
      <line x1="40" x2={w - 20} y1={Yp(30)} y2={Yp(30)} stroke="#2FE6A655" strokeWidth="1" strokeDasharray="3 3" />
      <text x={w - 16} y={Yp(70) + 3} fill="#69748680" fontSize="8" fontFamily="JetBrains Mono">70</text>
      <text x={w - 16} y={Yp(30) + 3} fill="#69748680" fontSize="8" fontFamily="JetBrains Mono">30</text>
      <path d={line} fill="none" stroke="#FFB547" strokeWidth="1.6" />
    </svg>
  );
}

// ---- Tag chip helper ----
export function tagClass(tag: string): string {
  const t = tag.toLowerCase();
  if (t === 'beat') return 'beat';
  if (t === 'miss') return 'miss';
  if (t === 'raised') return 'raised';
  if (t === 'lowered') return 'lowered';
  if (t === 'owned') return 'owned';
  return '';
}

// ---- Analyst action color ----
export function actionColor(type: string): string {
  if (type === 'upgrade') return 'var(--up)';
  if (type === 'downgrade') return 'var(--down)';
  return 'var(--brand-2)';
}
