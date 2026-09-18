/**
 * The market backdrop behind the auth screens.
 *
 * A session of price action running the full width of the page — grid, area,
 * price line, candles and volume — sitting behind the sign-in card. It is
 * decoration, so it is `aria-hidden` and drawn at low opacity with a soft
 * horizontal mask: the point is to say "this is a market terminal" at a glance,
 * not to be read.
 *
 * Rendered as SVG rather than shipped as an image so it stays crisp at any
 * size, inherits the palette from iq.css, and costs no extra request. The
 * series comes from sines rather than Math.random for two reasons: a random
 * walk would differ between the server render and the browser's (a hydration
 * mismatch), and a fixed shape can be composed — this one drifts up to the
 * right, which is the shape the page wants.
 *
 * This replaces `.sp-grid`, which was a sibling of `.lp-root` and therefore
 * painted UNDER that element's opaque background — it had never been visible
 * on these pages. This one is a child, behind the content but above the
 * backdrop, which is why it shows.
 */

const N = 56;
const W = 1600;
const H = 900;

/** The price band and the volume strip beneath it, in viewBox units. */
const TOP = 250;
const BOTTOM = 620;
const VOL_TOP = 665;
const VOL_H = 120;

type Candle = { o: number; h: number; l: number; c: number; v: number };

function series(): Candle[] {
  const out: Candle[] = [];
  let prev = 100;
  for (let i = 0; i < N; i++) {
    // Drift up and to the right, with two overlapping waves so the rhythm
    // never looks periodic, and a step near the end to give the eye a target.
    const base =
      100 +
      Math.sin(i * 0.38) * 3.4 +
      Math.sin(i * 0.13) * 6.2 +
      i * 0.42 +
      (i >= N - 12 ? 5.5 : 0);
    const o = prev;
    const c = base;
    const wick = 0.9 + Math.abs(Math.sin(i * 1.9)) * 1.7;
    out.push({
      o,
      c,
      h: Math.max(o, c) + wick,
      l: Math.min(o, c) - wick,
      v: 0.36 + Math.abs(Math.sin(i * 0.77)) * 0.42 + (i >= N - 12 ? 0.2 : 0),
    });
    prev = c;
  }
  return out;
}

const candles = series();
const lo = Math.min(...candles.map((c) => c.l));
const hi = Math.max(...candles.map((c) => c.h));

const slot = W / N;
const bodyW = Math.min(11, slot * 0.5);
const x = (i: number) => slot * (i + 0.5);
const y = (p: number) => TOP + (1 - (p - lo) / (hi - lo)) * (BOTTOM - TOP);

/** The closing line, and the same path closed along the bottom for the fill. */
const linePath = candles
  .map((c, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(c.c).toFixed(1)}`)
  .join(" ");
const areaPath = `${linePath} L${W} ${BOTTOM} L0 ${BOTTOM} Z`;

/** Four priced rules, the way a terminal would draw them. */
const rules = [0, 1, 2, 3].map((k) => y(lo + ((hi - lo) * k) / 3));

export function AuthBackdrop() {
  return (
    <>
    <div className="au-bg" aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        <defs>
          {/* Stop colours live in CSS (see .au-bg-stop* in auth-layout) so they
              read the palette tokens; var() is not reliably substituted inside
              an SVG presentation attribute. */}
          <linearGradient id="auArea" x1="0" y1="0" x2="0" y2="1">
            <stop className="au-bg-stop-a" offset="0%" />
            <stop className="au-bg-stop-b" offset="100%" />
          </linearGradient>
          {/* Fades into both edges so the chart reads as part of the page
              rather than a panel that stops. WHITE, not black: a mask is read
              by luminance, so black would hide everything it covers. */}
          <linearGradient id="auFade" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fff" stopOpacity="0" />
            <stop offset="20%" stopColor="#fff" stopOpacity="1" />
            <stop offset="80%" stopColor="#fff" stopOpacity="1" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <mask id="auMask">
            <rect width={W} height={H} fill="url(#auFade)" />
          </mask>
        </defs>

        <g mask="url(#auMask)">
          {rules.map((ry, i) => (
            <line key={i} className="au-bg-grid" x1="0" x2={W} y1={ry} y2={ry} />
          ))}

          <path className="au-bg-area" d={areaPath} />
          <path className="au-bg-line" d={linePath} />

          {candles.map((c, i) => {
            const up = c.c >= c.o;
            const top = y(Math.max(c.o, c.c));
            const h = Math.max(1.5, Math.abs(y(c.o) - y(c.c)));
            return (
              <g key={i} className={up ? "au-bg-up" : "au-bg-dn"}>
                <line className="au-bg-wick" x1={x(i)} x2={x(i)} y1={y(c.h)} y2={y(c.l)} />
                <rect className="au-bg-body" x={x(i) - bodyW / 2} y={top} width={bodyW} height={h} rx="1" />
                <rect
                  className="au-bg-vol"
                  x={x(i) - bodyW / 2}
                  y={VOL_TOP + VOL_H * (1 - c.v)}
                  width={bodyW}
                  height={VOL_H * c.v}
                  rx="1"
                />
              </g>
            );
          })}
        </g>
      </svg>
    </div>
    {/* Sits between the chart and the content: the copy on the left has to
        stay readable, and dimming the chart globally enough to guarantee that
        would leave nothing to see anywhere else. Its own element rather than
        part of .au-bg so it is not multiplied by that layer's opacity. */}
    <div className="au-scrim" aria-hidden="true" />
    </>
  );
}
