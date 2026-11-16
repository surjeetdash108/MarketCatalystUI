import type { ReactNode } from "react";
import { highlightNumbers } from "./read-cards";

type Bar = { t: number; c: number; h: number; l: number; v: number };
type NewsItem = { publishedAt?: string | null; headline?: string | null; source?: string | null };

export type WeekMove = { pct: number; text: string; ev: ReactNode[] };

const signed = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
const day = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York" });

/**
 * "Why it moved" for the last five sessions, from the real daily bars: the move,
 * the biggest up and down days, the range, volume against the four weeks before,
 * and the stock's own headlines of the last seven days. Null with fewer than
 * seven bars (the page then falls back to the one-day explanation).
 */
export function weekMove(ticker: string, bars: Bar[] | undefined, news: NewsItem[] | undefined): WeekMove | null {
  if (!bars || bars.length < 7) return null;
  const n = bars.length;
  const last = bars[n - 1];
  const from = bars[n - 6];
  if (!(from.c > 0) || !(last.c > 0)) return null;
  const week = bars.slice(n - 5);
  const pct = (last.c / from.c - 1) * 100;
  const verb = pct >= 3 ? "rose sharply" : pct >= 0.5 ? "rose" : pct > -0.5 ? "was roughly flat" : pct > -3 ? "fell" : "fell sharply";
  const days = week.map((b, i) => ({ t: b.t, pct: (b.c / (i === 0 ? from.c : week[i - 1].c) - 1) * 100 }));
  const up = days.reduce((a, d) => (d.pct > a.pct ? d : a));
  const down = days.reduce((a, d) => (d.pct < a.pct ? d : a));
  const higher = days.filter((d) => d.pct > 0).length;
  const hi = Math.max(...week.map((b) => b.h));
  const lo = Math.min(...week.map((b) => b.l));
  const text = `${ticker} ${verb} ${signed(pct)} over the last week, from $${from.c.toFixed(2)} to $${last.c.toFixed(2)}, closing higher on ${higher} of 5 sessions.`;
  const ev: ReactNode[] = [
    highlightNumbers(`Closed $${last.c.toFixed(2)} on ${day(last.t)}, ${signed(pct)} from $${from.c.toFixed(2)} on ${day(from.t)}`),
    highlightNumbers(`Biggest up day ${day(up.t)} (${signed(up.pct)}); biggest down day ${day(down.t)} (${signed(down.pct)})`),
    highlightNumbers(`Traded between $${lo.toFixed(2)} and $${hi.toFixed(2)} (a ${((hi / lo - 1) * 100).toFixed(1)}% range)`),
  ];
  const prior = bars.slice(Math.max(0, n - 25), n - 5);
  if (prior.length >= 5) {
    const weekAvg = week.reduce((s, b) => s + b.v, 0) / week.length;
    const priorAvg = prior.reduce((s, b) => s + b.v, 0) / prior.length;
    if (priorAvg > 0) {
      const ratio = weekAvg / priorAvg;
      ev.push(
        <>
          Volume averaged{" "}
          <span style={{ color: ratio >= 1.2 ? "var(--up, #4ade80)" : ratio <= 0.8 ? "var(--down, #f87171)" : "#4fb3ff", fontWeight: 700 }}>{ratio.toFixed(1)}×</span> the prior four weeks
        </>,
      );
    }
  }
  const since = last.t - 7 * 86_400_000;
  const recent = (Array.isArray(news) ? news : []).filter((a) => a.publishedAt && Date.parse(a.publishedAt) >= since);
  if (recent.length) {
    const first = recent[0];
    ev.push(
      <>
        <span style={{ color: "#4fb3ff", fontWeight: 700 }}>{recent.length}</span> headline{recent.length === 1 ? "" : "s"} in the last 7 days; latest: &quot;{first.headline}&quot;
        {first.source ? ` (${first.source})` : ""}
      </>,
    );
  } else {
    ev.push("No headlines for this stock in the last 7 days");
  }
  return { pct, text, ev };
}
