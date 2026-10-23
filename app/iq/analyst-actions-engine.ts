import type { AnalystConsensusDoc, CompanyDoc } from "./types";

/*
 * Analyst action rows + Signal Score — shared by the Analyst Actions screen
 * (Moving the needle / All Actions) and the stock page's Analyst Actions tab,
 * so a call shows the same action, target and signal in both places.
 */

/** Measured firm track record (GET /market-data/analyst-firm-stats; analyst-firm-stats job). */
export interface FirmStat {
  firmKey: string;
  name: string;
  ratingChanges: number;
  avgMoveAfterCall: number | null;
  avgMoveAfterUpgrade: number | null;
  avgMoveAfterDowngrade: number | null;
  targetsResolved: number;
  hitRatePct: number | null;
  bullishPct: number | null;
  recentResolved?: Array<{ ticker: string; date: string; target: number; priceWhenPosted: number; hit: boolean }>;
}
/** "J.P. Morgan" / "JP Morgan" / "JPMorgan" → "jpmorgan" (matches the backend key). */
export const firmKey = (name: string) => name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
/** Calls within this many days count as "recent" for the header and needle list. */
export const RECENT_DAYS = 7;
export const BULLISH_GRADE = /buy|outperform|overweight|positive|accumulate/i;
export const BEARISH_GRADE = /sell|underperform|underweight|negative|reduce/i;
export const pctTxt = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`);

export interface ProcessedAction {
  id: string;
  t: string; // Ticker
  co: string; // Company Name
  firm: string;
  act: string; // "Upgrade", "Downgrade", "PT Raise", "PT Cut", "Initiate", "Maintain"
  dir: number; // 1 = bullish, -1 = bearish, 0 = neutral
  from: string;
  to: string;
  pt1: number; // Price target for this call (the firm's own, else the Street consensus — see ptSource)
  /** "firm": the firm's own target with this call; "consensus": the firm gave none, so the Street consensus stands in. */
  ptSource: "firm" | "consensus";
  /** Date the firm posted `pt1` (firm targets only). Earlier than `date` means
   *  the firm reiterated without a new target and this is its standing one. */
  ptDate: string | null;
  prevPt: number | null;
  px: number; // Current price
  date: string;
  score: number; // 0-100 Signal Score
  comp: [number, number, number, number, number]; // Factor components
  cluster: number; // Number of firms acting on this ticker
  clusterFirms: string[];
  street: number[]; // All Street targets
  hit: string; // Firm's measured 12-month target hit rate, "—" when unmeasured
  move: string; // Firm's measured avg 5-day move after calls like this one, "—" when unmeasured
  headline: string;
  why: string[];
  held: boolean;
  watched: boolean;
  sector: string;
  cap: string;
  tags: string[];
  upPct: number | null; // % upside to this target
}

const RATING_RANK: Record<string, number> = {
  "strong buy": 5,
  "top pick": 5,
  "outperform": 4,
  "buy": 4,
  "overweight": 4,
  "positive": 4,
  "accumulate": 4,
  "sector outperform": 4,
  "hold": 3,
  "neutral": 3,
  "equal-weight": 3,
  "equal weight": 3,
  "peer perform": 3,
  "market perform": 3,
  "sector perform": 3,
  "underperform": 2,
  "underweight": 2,
  "reduce": 2,
  "sector underperform": 2,
  "sell": 1,
  "strong sell": 1,
  "negative": 1,
};

function getRatingRank(grade?: string | null): number | null {
  if (!grade) return null;
  const g = grade.toLowerCase().trim();
  if (RATING_RANK[g] != null) return RATING_RANK[g];
  for (const [key, rank] of Object.entries(RATING_RANK)) {
    if (g.includes(key)) return rank;
  }
  return null;
}

export function resolveActionMeta(
  actionRaw?: string | null,
  previousGrade?: string | null,
  newGrade?: string | null,
  pt?: number | null,
  prevPt?: number | null,
) {
  const act = (actionRaw ?? "").toLowerCase().trim();
  const prev = (previousGrade ?? "").trim();
  const next = (newGrade ?? "").trim();
  const prevRank = getRatingRank(prev);
  const nextRank = getRatingRank(next);

  let shownAction = "Maintain";
  let dir = 0;

  // 1. Initiation when there is no prior rating
  if (act.includes("init") || (!prev && next && !act.includes("upgrade") && !act.includes("downgrade"))) {
    shownAction = "Initiate";
    dir = (nextRank ?? 3) > 3 ? 1 : (nextRank ?? 3) < 3 ? -1 : 0;
  }
  // 2. Upgrade or Downgrade by comparing rating ranks
  else if (prevRank != null && nextRank != null && prevRank !== nextRank) {
    if (nextRank > prevRank) {
      shownAction = "Upgrade";
      dir = 1;
    } else {
      shownAction = "Downgrade";
      dir = -1;
    }
  } else if (act.includes("upgrade") && (!prevRank || !nextRank || nextRank >= prevRank)) {
    shownAction = "Upgrade";
    dir = 1;
  } else if (act.includes("downgrade") && (!prevRank || !nextRank || nextRank <= prevRank)) {
    shownAction = "Downgrade";
    dir = -1;
  }
  // 3. PT Raise or PT Cut when current target is above or below prior target
  else if (pt != null && prevPt != null && pt !== prevPt) {
    if (pt > prevPt) {
      shownAction = "PT Raise";
      dir = 1;
    } else {
      shownAction = "PT Cut";
      dir = -1;
    }
  }
  // 4. Reiterate/Maintain only when rating and target are unchanged
  else {
    shownAction = act.includes("reiterat") ? "Reiterate" : "Maintain";
    dir = (nextRank ?? 3) > 3 ? 1 : (nextRank ?? 3) < 3 ? -1 : 0;
  }

  return {
    shownAction,
    dir,
    from: prev || "—",
    to: next || "—",
  };
}

export function capCategory(cap?: number | null): string {
  if (cap == null || cap <= 0) return "—";
  if (cap >= 200e9) return "Mega";
  if (cap >= 10e9) return "Large";
  if (cap >= 2e9) return "Mid";
  if (cap >= 300e6) return "Small";
  return "Micro";
}

export interface BuildAnalystActionsInput {
  consensusDocs: AnalystConsensusDoc[];
  companyMap: Map<string, CompanyDoc>;
  /** Live price for a stock the company list has none for. */
  livePrice: (sym: string) => number | null;
  firmStatsByKey: Map<string, FirmStat>;
  holdings: Set<string>;
  watchedTickers: Set<string>;
}

/** One row per real analyst call, highest Signal Score first. */
export function buildAnalystActions({
  consensusDocs,
  companyMap,
  livePrice,
  firmStatsByKey,
  holdings,
  watchedTickers,
}: BuildAnalystActionsInput): ProcessedAction[] {
    const DAY = 86_400_000;
    const dayMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
    const rows: ProcessedAction[] = [];

    consensusDocs.forEach((c, cIdx) => {
      const sym = (c.ticker || "").trim().toUpperCase();
      // Only real rating changes; a stock with none contributes no actions.
      const grades = (c.recentGrades ?? []).filter((g) => g.firm && g.date);
      if (!sym || grades.length === 0) return;
      const comp = companyMap.get(sym);
      const live = livePrice(sym);
      const px = live != null && live > 0 ? live : (comp?.price && comp.price > 0 ? comp.price : 0);
      const coName = comp?.name || sym;
      const sec = comp?.sector || "—";
      const cap = capCategory(comp?.marketCap);

      // Every target the Street has posted for the stock (real values only).
      const allPtValues = grades.map((g) => g.priceTarget).filter((v): v is number => v != null && v > 0);
      if (c.priceTargetConsensus) allPtValues.push(c.priceTargetConsensus);
      if (c.priceTargetHigh) allPtValues.push(c.priceTargetHigh);
      if (c.priceTargetLow) allPtValues.push(c.priceTargetLow);
      const streetTargets = [...new Set(allPtValues)].sort((a, b) => a - b);

      const metas = grades.map((g) => resolveActionMeta(g.action, g.previousGrade, g.newGrade, g.priceTarget, g.previousPriceTarget));

      grades.forEach((g, gIdx) => {
        const firmName = (g.firm as string).trim();
        const meta = metas[gIdx];
        const targetPt = g.priceTarget != null && g.priceTarget > 0 ? g.priceTarget : null;
        const prevPt = g.previousPriceTarget ?? null;
        const upPct = targetPt != null && px > 0 ? ((targetPt - px) / px) * 100 : null;

        // Cluster: distinct firms making a same-direction call on this stock
        // within 72 hours of this one.
        const clusterFirmsList = [...new Set(
          grades
            .filter((o, oIdx) => metas[oIdx].dir === meta.dir && meta.dir !== 0 && Math.abs(dayMs(o.date as string) - dayMs(g.date as string)) <= 3 * DAY)
            .map((o) => (o.firm as string).trim()),
        )];
        const clusterCount = Math.max(1, clusterFirmsList.length);

        const stat = firmStatsByKey.get(firmKey(firmName)) ?? null;
        const hitRate = stat?.hitRatePct ?? null;
        const movePct = meta.dir > 0 ? stat?.avgMoveAfterUpgrade ?? null : meta.dir < 0 ? stat?.avgMoveAfterDowngrade ?? null : null;

        // Signal Score (0-100). Firm accuracy uses the measured hit rate; a firm
        // without enough resolved targets scores the neutral midpoint.
        const firmAccScore = hitRate != null ? Math.min(35, Math.max(12, Math.round((hitRate / 100) * 35))) : 20;
        const clusterScore = clusterCount >= 4 ? 25 : clusterCount === 3 ? 21 : clusterCount === 2 ? 15 : 7;
        const strengthScore = meta.shownAction === "Upgrade" || meta.shownAction === "Downgrade" ? 20 :
          meta.shownAction.includes("PT") ? 15 : meta.shownAction === "Initiate" ? 14 : 9;
        const movePctVal = prevPt && prevPt > 0 && targetPt != null ? Math.abs((targetPt - prevPt) / prevPt) * 100 : upPct != null ? Math.abs(upPct) : 0;
        const moveScore = movePctVal >= 20 ? 10 : movePctVal >= 12 ? 8 : movePctVal >= 5 ? 6 : 4;
        const isHeld = holdings.has(sym);
        const isWatched = watchedTickers.has(sym);
        const contextScore = isHeld ? 10 : isWatched ? 9 : clusterCount >= 2 ? 8 : 6;
        const totalScore = Math.min(100, Math.max(25, firmAccScore + clusterScore + strengthScore + moveScore + contextScore));
        const factorsComp: [number, number, number, number, number] = [firmAccScore, clusterScore, strengthScore, moveScore, contextScore];

        const headline = clusterCount >= 2
          ? `${clusterCount} ${meta.dir >= 0 ? "bullish" : "bearish"} calls within 72h: ${clusterFirmsList.slice(0, 3).join(", ")}${clusterFirmsList.length > 3 ? " and others" : ""}`
          : targetPt != null
          ? `${firmName} ${meta.shownAction.toLowerCase()}s ${sym}${meta.to !== "—" ? ` to ${meta.to}` : ""} with $${targetPt.toFixed(2)} target`
          : `${firmName} ${meta.shownAction.toLowerCase()}s ${sym}${meta.to !== "—" ? ` to ${meta.to}` : ""}`;

        const whyBullets: string[] = [];
        if (isHeld) whyBullets.push(`You hold this stock in your portfolio`);
        if (isWatched) whyBullets.push(`In your watchlist`);
        if (clusterCount >= 2) whyBullets.push(`${clusterCount} Firms made same-direction calls within 72 hours`);
        if (targetPt != null) {
          if (streetTargets.length >= 2 && targetPt >= streetTargets[streetTargets.length - 1]) {
            whyBullets.push(`New $${targetPt.toFixed(2)} PT is the highest on the Street`);
          } else if (streetTargets.length >= 2 && targetPt <= streetTargets[0]) {
            whyBullets.push(`New PT is the lowest on the Street`);
          } else if (upPct != null) {
            whyBullets.push(`Target is ${upPct >= 0 ? "+" : ""}${upPct.toFixed(1)}% vs current market price`);
          } else {
            whyBullets.push(`New price target: $${targetPt.toFixed(2)}`);
          }
        }
        if (hitRate != null && stat) {
          whyBullets.push(`${firmName}'s price targets were hit within 12 months ${hitRate}% of the time (${stat.targetsResolved} resolved)`);
        }

        const tags: string[] = [];
        if (isHeld) tags.push("HOLDING");
        if (isWatched) tags.push("WATCHLIST");
        if (clusterCount >= 2) tags.push(`${clusterCount}× CLUSTER`);

        rows.push({
          id: `${sym}-${firmName}-${g.date || cIdx}-${gIdx}`,
          t: sym,
          co: coName,
          firm: firmName,
          act: meta.shownAction,
          dir: meta.dir,
          from: meta.from,
          to: meta.to,
          pt1: targetPt ?? 0,
          ptSource: targetPt != null ? "firm" : "consensus",
          ptDate: targetPt != null ? (g.priceTargetDate ?? null) : null,
          prevPt,
          px,
          date: g.date as string,
          score: totalScore,
          comp: factorsComp,
          cluster: clusterCount,
          clusterFirms: clusterFirmsList,
          street: streetTargets.length ? streetTargets : (targetPt != null ? [targetPt] : []),
          hit: hitRate != null ? `${hitRate}%` : "—",
          move: pctTxt(movePct),
          headline,
          why: whyBullets,
          held: isHeld,
          watched: isWatched,
          sector: sec,
          cap,
          tags,
          upPct,
        });
      });
    });

    return rows.sort((a, b) => b.score - a.score);
}
