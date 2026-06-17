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
