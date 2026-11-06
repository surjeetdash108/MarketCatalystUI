/**
 * Light mode for the full-screen modules drawn with inline colours (Strategy
 * Lab, Money Flow). Their markup was written for the dark theme with literal
 * colours; every literal now reads a variable instead — var(--th-RRGGBB) for a
 * solid colour, rgb(var(--thr-RRGGBB) / a) for a translucent neutral — so one
 * stylesheet repaints them when .iq-root switches to data-theme="light".
 *
 * Dark: each variable is its original colour, so the dark theme is unchanged.
 * Light: each colour is mapped by lightOf(), which keeps how far it stands out
 * from the page. The dark page (#08090a) becomes white; a surface or border
 * that was slightly lighter than the dark page becomes slightly darker than
 * white; text keeps its contrast (capped so nothing is harsher than near
 * black); and saturated accents (gold, green, red, blue) keep their hue but are
 * darkened to a readable contrast on white rather than the dark theme's glow.
 */

const DARK_PAGE = "#08090a";
const LIGHT_PAGE = "#ffffff";
/** Text and neutrals: contrast against the page is kept, up to this much. */
const MAX_NEUTRAL_CONTRAST = 16;
/** Saturated accents: kept readable on white without turning muddy. */
const MAX_ACCENT_CONTRAST = 4.8;
const ACCENT_SATURATION = 0.3;
const MAX_ACCENT_SATURATION = 0.72;

const hex6 = (h) => {
  const s = h.replace("#", "").toLowerCase();
  return s.length === 3 ? s.split("").map((c) => c + c).join("") : s;
};
const toRgb = (h) => { const s = hex6(h); return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16)); };
const toHex = (rgb) => "#" + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");

function luminance(h) {
  const [r, g, b] = toRgb(h).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** WCAG contrast ratio between two colours (1 … 21). */
export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

function toHsl(h) {
  const [r, g, b] = toRgb(h).map((v) => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const hh = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(hh * 60 + 360) % 360, s, l];
}
function fromHsl([h, s, l]) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return toHex([r, g, b].map((v) => (v + m) * 255));
}

/** Whether a colour is a saturated accent (gold, green, red, blue …) rather than a grey. */
export const isAccent = (h) => { const [, s, l] = toHsl(h); return s >= ACCENT_SATURATION && l > 0.12 && l < 0.92; };

/** The light-theme counterpart of a dark-theme colour (see the header). */
export function lightOf(h) {
  const want = Math.min(contrast(h, DARK_PAGE), isAccent(h) ? MAX_ACCENT_CONTRAST : MAX_NEUTRAL_CONTRAST);
  // Darker than the dark page (or the page itself): the white page.
  if (luminance(h) <= luminance(DARK_PAGE) || want <= 1.0001) return LIGHT_PAGE;
  const [hue, s0] = toHsl(h);
  // Bright accents at full saturation turn neon once darkened (pure red / blue): soften them a little.
  const sat = isAccent(h) ? Math.min(s0, MAX_ACCENT_SATURATION) : s0;
  // Same hue and saturation; the lightness whose contrast with white is `want` (darker = more contrast).
  let lo = 0, hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (contrast(fromHsl([hue, sat, mid]), LIGHT_PAGE) > want) lo = mid; else hi = mid;
  }
  return fromHsl([hue, sat, (lo + hi) / 2]);
}

/** Every solid colour the modules use (RRGGBB). A test keeps this in step with the code. */
export const THEME_HEX = [
  "05210f", "08090a", "0b0c0d", "0b0d0e", "0b0e10", "0c0f10", "0d0f10", "0f1213", "121314", "121618", "12171a", "15130c",
  "15191b", "151c20", "161b1d", "171c1e", "1a0e0f", "1a160c", "1a1d1f", "1a1f21", "1a2328", "1d130b", "1e2427", "1e293b",
  "1f4a33", "22c55e", "233038", "263033", "2a2618", "2a3235", "2a3236", "2e2614", "3a2224", "3a4448", "3c4446", "3ddc84",
  "416180", "4ad0c9", "4ade80", "4fd1e8", "5a2224", "5a4a22", "5aa9e6", "5d6764", "5f6966", "6b3a1c", "6b5216", "6b5a2a",
  "6ea8ff", "7a8481", "7fa8d0", "8b7cf6", "8b9592", "94a3b8", "9aa7ff", "aab3b0", "c39bff", "c9a24a", "cfd6d3", "e0bb5e",
  "e6ebe8", "eef2f4", "f0565a", "f08a4b", "f0a0a2", "f0a24a", "f0d68c", "f2b33d", "f5c542", "f7c9a8", "fbefc9", "ff7a7d",
  "ff9f43", "ffffff",
];
/** Neutral colours the modules use with an alpha, as rgb(var(--thr-RRGGBB) / a). */
export const THEME_RGB = ["040506", "08090a", "0b0d0e", "ffffff", "e6ebe8"];

const triplet = (h) => toRgb(h).join(" ");

/** The variables for both themes, scoped to the app root that carries data-theme. */
export const MODULE_THEME_CSS =
  ".iq-root{" + THEME_HEX.map((h) => `--th-${h}:#${h};`).join("") + THEME_RGB.map((h) => `--thr-${h}:${triplet(h)};`).join("") + "}" +
  '.iq-root[data-theme="light"]{' + THEME_HEX.map((h) => `--th-${h}:${lightOf(h)};`).join("") + THEME_RGB.map((h) => `--thr-${h}:${triplet(lightOf(h))};`).join("") + "}";
