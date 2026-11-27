import { FG_ZONES, fgZone, type FgPast } from "./fear-greed";

/*
 * The Fear & Greed card, laid out like CNN's: a large semicircular gauge in five
 * labelled zones with the current zone lit, a needle and the number in a hub, and
 * beside it the readings for the previous close and 1 week / 1 month / 1 year ago.
 * The value itself is ours (see fear-greed.job); only the presentation follows CNN's.
 */

const CX = 120, CY = 112, R1 = 98, R0 = 68, HUB = 28;
/** Hairline between zones, in value units (0.45 of 100 is about 0.8 degrees). */
const GAP = 0.45;

const ang = (v: number) => Math.PI * (1 - v / 100);
const pt = (r: number, v: number): [number, number] => [CX + r * Math.cos(ang(v)), CY - r * Math.sin(ang(v))];
const xy = ([x, y]: [number, number]) => `${x.toFixed(2)} ${y.toFixed(2)}`;

/** The band between R0 and R1 from value v0 to v1, left to right over the top. */
function sector(v0: number, v1: number): string {
  const a = v0 + GAP, b = v1 - GAP;
  return `M ${xy(pt(R1, a))} A ${R1} ${R1} 0 0 1 ${xy(pt(R1, b))} L ${xy(pt(R0, b))} A ${R0} ${R0} 0 0 0 ${xy(pt(R0, a))} Z`;
}

/** An arc to run a label along, at radius r, left to right (the glyphs' tops point outward). */
function arc(r: number, v0: number, v1: number): string {
  return `M ${xy(pt(r, v0 + GAP))} A ${r} ${r} 0 0 1 ${xy(pt(r, v1 - GAP))}`;
}

/** Label lines per zone, and their size. The Neutral band is too narrow to hold its name, so that one sits just above it. */
const LABELS: Record<string, { lines: string[]; fs: number; outside?: boolean }> = {
  "extreme-fear": { lines: ["EXTREME", "FEAR"], fs: 8.5 },
  fear: { lines: ["FEAR"], fs: 9 },
  neutral: { lines: ["NEUTRAL"], fs: 5.8, outside: true },
  greed: { lines: ["GREED"], fs: 9 },
  "extreme-greed": { lines: ["EXTREME", "GREED"], fs: 8.5 },
};

export function FearGreedGauge({ value, id = "fg" }: { value: number; id?: string }) {
  const zone = fgZone(value);
  const v = Math.max(0, Math.min(100, value));
  const tip = pt(R0 - 4, v);
  const RM = (R0 + R1) / 2;
  return (
    <svg viewBox="14 -3 212 145" role="img" aria-label={`Fear and Greed index ${Math.round(value)}, ${zone.label}`}>
      {FG_ZONES.map(z => {
        const on = z.key === zone.key;
        const lab = LABELS[z.key];
        return (
          <g key={z.key}>
            <path d={sector(z.from, z.to)} fill={on ? z.color : "var(--surface-3)"} fillOpacity={on ? 0.3 : 1}
              stroke={on ? z.color : "none"} strokeWidth={on ? 1.25 : 0} />
            {lab.lines.map((line, i) => {
              // Two-line labels sit on two arcs either side of the band's middle.
              const off = lab.lines.length === 2 ? (i === 0 ? 1 : -1) * lab.fs * 0.6 : 0;
              const pid = `${id}-${z.key}-${i}`;
              return (
                <g key={pid}>
                  <path id={pid} d={arc(lab.outside ? R1 + 4 : RM + off - lab.fs * 0.35, z.from, z.to)} fill="none" />
                  <text fontSize={lab.fs} fontWeight={700} letterSpacing={lab.outside ? 0.1 : 0.6}
                    fontFamily="var(--f-display)" textAnchor="middle" fill={on ? z.color : "var(--text-dim-solid)"}>
                    <textPath href={`#${pid}`} startOffset="50%">{line}</textPath>
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}
      {/* Scale: 25 / 50 / 75 inside the band, 0 and 100 under its ends. */}
      {[25, 50, 75].map(n => {
        const [x, y] = pt(R0 - 10, n);
        return <text key={n} x={x} y={y + 2.5} textAnchor="middle" fontSize={7.5} fontFamily="var(--f-mono)" fill="var(--text-dim-solid)">{n}</text>;
      })}
      <text x={CX - (R0 + R1) / 2} y={CY + 11} textAnchor="middle" fontSize={7.5} fontFamily="var(--f-mono)" fill="var(--text-dim-solid)">0</text>
      <text x={CX + (R0 + R1) / 2} y={CY + 11} textAnchor="middle" fontSize={7.5} fontFamily="var(--f-mono)" fill="var(--text-dim-solid)">100</text>
      {/* Needle, then the hub that carries the number. */}
      <line x1={CX} y1={CY} x2={tip[0]} y2={tip[1]} stroke="var(--text-hi)" strokeWidth={4.5} strokeLinecap="round" />
      <circle cx={CX} cy={CY} r={HUB} fill="var(--surface-1)" stroke="var(--border-strong)" strokeWidth={1.5} />
      <text x={CX} y={CY + 11} textAnchor="middle" fontSize={26} fontWeight={800} fontFamily="var(--f-mono)" fill={zone.color}>{Math.round(value)}</text>
    </svg>
  );
}

/** Previous close / 1 week / 1 month / 1 year ago: a small label over the zone name, and the number in a ring. */
export function FearGreedPast({ rows }: { rows: FgPast[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="fg-past">
      {rows.map(r => {
        const z = fgZone(r.value);
        return (
          <div className="fg-past-row" key={r.label} title={`${r.date}: ${r.value}`}>
            <div>
              <div className="fg-past-k">{r.label}</div>
              <div className="fg-past-v">{z.label}</div>
            </div>
            <span className="fg-badge" style={{ color: z.color, background: `color-mix(in srgb, ${z.color} 18%, transparent)` }}>{r.value}</span>
          </div>
        );
      })}
    </div>
  );
}

/** The whole panel: gauge with the past readings beside it (stacked when there is no room). */
export function FearGreedPanel({ value, past, id = "fg", maxWidth = 280 }: { value: number; past: FgPast[]; id?: string; maxWidth?: number }) {
  return (
    <div className="fg-cnn">
      <div className="fg-cnn-gauge" style={{ maxWidth }}>
        <FearGreedGauge value={value} id={id} />
      </div>
      <FearGreedPast rows={past} />
    </div>
  );
}
