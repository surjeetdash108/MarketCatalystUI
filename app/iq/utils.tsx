"use client";

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

// ---- Semicircular gauge SVG ----
export function gaugeSVG(v: number, label: string, color: string): string {
  const r = 38, cx = 50, cy = 50, sw = 7;
  const startAngle = -150 * Math.PI / 180;
  const sweep = 300 * Math.PI / 180;
  const angle = startAngle + (v / 100) * sweep;
  const sx = cx + r * Math.cos(startAngle);
  const sy = cy + r * Math.sin(startAngle);
  const ex = cx + r * Math.cos(angle);
  const ey = cy + r * Math.sin(angle);
  const endFull = { x: cx + r * Math.cos(startAngle + sweep), y: cy + r * Math.sin(startAngle + sweep) };
  const lf = (v / 100) > 0.5 ? 1 : 0;
  return `<svg viewBox="0 0 100 60" width="100" height="60" style="overflow:visible">
    <path d="M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${r} ${r} 0 1 1 ${endFull.x.toFixed(2)} ${endFull.y.toFixed(2)}"
      fill="none" stroke="var(--border)" stroke-width="${sw}" stroke-linecap="round"/>
    <path d="M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${r} ${r} 0 ${lf} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}"
      fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>
    <text x="${cx}" y="${cy - 6}" text-anchor="middle" font-size="14" font-weight="700"
      fill="${color}" font-family="var(--f-display)">${label}</text>
  </svg>`;
}

export function Gauge({ v, label, color, sublabel }: { v: number; label: string; color: string; sublabel?: string }) {
  return (
    <div className="gauge-wrap">
      <div dangerouslySetInnerHTML={{ __html: gaugeSVG(v, label, color) }} />
      {sublabel && <div className="gauge-label">{sublabel}</div>}
    </div>
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
