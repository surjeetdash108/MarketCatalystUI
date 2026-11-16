import type { SiFacts } from "./data";
import { trendRead } from "./data";

const signed = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`;

/**
 * The Fundamental Read on Overview: up to three plain sentences (growth and
 * margin, earnings record, valuation), each built only from inputs that exist.
 * With none of them it says the quarterly numbers are not available yet.
 */
export function fundamentalReadText(name: string, f: SiFacts, forwardPe: number | null): string {
  const out: string[] = [];
  if (f.revGrowthYoY != null) {
    const g = f.revGrowthYoY;
    const verb = g >= 15 ? "is growing fast" : g >= 3 ? "is growing steadily" : g > -3 ? "is roughly flat" : "is shrinking";
    let s = `${name} ${verb}: revenue ${signed(g)} y/y`;
    if (f.opMargin != null) {
      const d = f.opMarginYearAgo != null ? f.opMargin - f.opMarginYearAgo : null;
      s += `, with an operating margin of ${f.opMargin.toFixed(1)}%${
        d != null && Math.abs(d) >= 0.5 ? ` (${d > 0 ? "up" : "down"} ${Math.abs(d).toFixed(1)} pts on a year ago)` : ""
      }`;
    }
    out.push(s + ".");
  }
  if (f.epsBeats != null && f.epsReports) {
    const rate = f.epsBeats / f.epsReports;
    let s = `It ${rate >= 0.75 ? "usually beats" : rate >= 0.5 ? "often beats" : "has missed"} earnings estimates (${f.epsBeats} of the last ${f.epsReports} reports)`;
    if (f.fwdEps != null && f.nextFyEps != null && f.fwdEps > 0) {
      s += ` and analysts expect EPS to ${f.nextFyEps >= f.fwdEps ? "grow" : "fall"} ${Math.abs((f.nextFyEps / f.fwdEps - 1) * 100).toFixed(1)}% next year`;
    }
    out.push(s + ".");
  }
  if (forwardPe != null && forwardPe > 0) {
    let s = `Valuation is ${forwardPe >= 35 ? "a rich" : forwardPe >= 18 ? "a moderate" : "a low"} ${forwardPe.toFixed(1)}× forward earnings`;
    if (f.consensus && f.targetMean != null && f.price) {
      s += `, and analysts rate it ${f.consensus} with a $${f.targetMean.toFixed(0)} target (${signed((f.targetMean / f.price - 1) * 100)})`;
    }
    out.push(s + ".");
  }
  return out.length ? out.join(" ") : `Quarterly fundamentals for ${name} are not available yet.`;
}

/**
 * The Technical Read on Overview: price against the 50 and 200 DMA (the same
 * sentence the Technicals tab uses, so the two never disagree), momentum from
 * the RSI, relative strength and volume, and the distance from the 52-week high.
 */
export function technicalReadText(f: SiFacts): string {
  const out: string[] = [trendRead(f.price, f.sma50, f.sma200)];
  if (f.rsi14 != null) {
    const r = f.rsi14;
    const word = r >= 70 ? "overbought" : r >= 55 ? "strong" : r > 45 ? "neutral" : r > 30 ? "weak" : "oversold";
    out.push(`Momentum is ${word} (RSI ${r.toFixed(0)}).`);
  }
  const bits: string[] = [];
  if (f.rsRating != null) {
    const rs = Math.round(f.rsRating);
    bits.push(
      f.rsRating >= 80
        ? `it is leading the market (RS rating ${rs}/99)`
        : f.rsRating >= 50
          ? `it is keeping pace with the market (RS rating ${rs}/99)`
          : `it is lagging the market (RS rating ${rs}/99)`,
    );
  }
  if (f.rvol != null) bits.push(`volume is ${f.rvol.toFixed(1)}× its 20-day average`);
  if (bits.length) out.push(bits[0].charAt(0).toUpperCase() + bits[0].slice(1) + (bits[1] ? `, and ${bits[1]}` : "") + ".");
  if (f.pctFromHigh52 != null) {
    out.push(`Price sits ${Math.abs(f.pctFromHigh52).toFixed(1)}% ${f.pctFromHigh52 <= 0 ? "below" : "above"} its 52-week high.`);
  }
  return out.join(" ");
}

/** Splits a paragraph into sentences for the bullet lists in the read cards. */
export function sentences(text: string): string[] {
  return text.split(/(?<=\.) (?=[A-Z])/).filter(Boolean);
}
