/**
 * The "Scoring rules" table of the MC Confidence dialog: for every driver, the rule that scores it and what earns
 * 100 and 0. One row per driver `buildDrivers` can produce; a spec keeps the two lists in step.
 */

export type DriverDoc = {
  driver: string;
  /** The category it belongs to, as the dialog groups them. */
  cat: "Business" | "Earnings" | "Technicals" | "Catalysts" | "Valuation" | "Flows" | "Macro";
  /** True for the rows that compare the stock with the average of its top five competitors. */
  peers?: boolean;
  rule: string;
  full: string;
  zero: string;
};

export const DRIVER_CATEGORIES: ReadonlyArray<DriverDoc["cat"]> = ["Business", "Earnings", "Technicals", "Catalysts", "Valuation", "Flows", "Macro"];

export const DRIVER_DOCS: ReadonlyArray<DriverDoc> = [
  {
    driver: "Revenue growth",
    cat: "Business",
    rule: "On its own: four-quarter average of year-over-year revenue growth (each quarter capped at ±100%); the latest quarter's growth when the four-quarter figure is not available. 50 + 1.5 × growth.",
    full: "growth of +33% or more",
    zero: "growth of −33% or worse",
  },
  {
    driver: "Revenue growth vs peers",
    cat: "Business",
    peers: true,
    rule: "The same four-quarter average against the top five competitors' average. 50 + 50 × (gap ÷ 25 points).",
    full: "25+ points ahead of peers",
    zero: "25+ points behind",
  },
  {
    driver: "Gross margin",
    cat: "Business",
    rule: "On its own: four-quarter average gross margin. 30 + 0.8 × margin %.",
    full: "gross margin of 87.5% or more",
    zero: "never reached (a 0% margin scores 30)",
  },
  {
    driver: "Gross margin vs peers",
    cat: "Business",
    peers: true,
    rule: "The same average against the competitors' average. 50 + 50 × (gap ÷ 15 points).",
    full: "15+ points above peers",
    zero: "15+ points below",
  },
  {
    driver: "Operating margin",
    cat: "Business",
    rule: "On its own: four-quarter average operating margin. 30 + 1.0 × margin %.",
    full: "operating margin of 70% or more",
    zero: "a 0% or negative margin (0% scores 30)",
  },
  {
    driver: "Operating margin vs peers",
    cat: "Business",
    peers: true,
    rule: "The same average against the competitors' average. 50 + 50 × (gap ÷ 15 points).",
    full: "15+ points above peers",
    zero: "15+ points below",
  },
  {
    driver: "Beat record",
    cat: "Earnings",
    rule: "Share of the last four earnings reports that beat the EPS estimate. 50 + 100 × (beat rate − 0.5) × (reports on file ÷ 4, at most 1): a short record is pulled toward 50.",
    full: "4 of 4 beaten",
    zero: "0 of 4 beaten",
  },
  {
    driver: "EPS growth",
    cat: "Earnings",
    rule: "On its own: four-quarter average of year-over-year EPS growth (quarters with a zero or negative base are skipped; each capped at ±100%). 50 + 1.5 × growth.",
    full: "growth of +33% or more",
    zero: "decline of 33% or more",
  },
  {
    driver: "EPS growth vs peers",
    cat: "Earnings",
    peers: true,
    rule: "The same average against the competitors' average. 50 + 50 × (gap ÷ 25 points).",
    full: "25+ points ahead of peers",
    zero: "25+ points behind",
  },
  {
    driver: "Forward EPS growth",
    cat: "Earnings",
    rule: "Consensus EPS growth next fiscal year over this one. 50 + 1.2 × growth.",
    full: "growth of +42% or more",
    zero: "decline of 42% or more",
  },
  {
    driver: "Trend vs 50/200 DMA",
    cat: "Technicals",
    rule: "Price against its 50- and 200-day averages: above both 80, above the 200 only 60, above the 50 only 45, below both 25.",
    full: "not reachable on its own (best is 80)",
    zero: "not reachable (worst is 25)",
  },
  {
    driver: "Relative strength",
    cat: "Technicals",
    rule: "The stock's relative-strength rating against the market, 0–99, used as the score.",
    full: "rating of 100",
    zero: "rating of 0",
  },
  {
    driver: "Volume confirmation",
    cat: "Technicals",
    rule: "Volume against its 20-day average, in the direction of the day's move. 50 + 30 × (volume ratio − 1), reversed on a down day.",
    full: "2.7× normal volume on an up day",
    zero: "2.7× normal volume on a down day",
  },
  {
    driver: "RSI(14)",
    cat: "Technicals",
    rule: "40 + 0.9 × (RSI − 30). Overbought (75+) scores 40 and oversold (30 or less) scores 35: stretched either way is not rewarded.",
    full: "never reached (best is about 80, at RSI 74)",
    zero: "never reached (worst is 35, at RSI 30 or less)",
  },
  {
    driver: "Next earnings",
    cat: "Catalysts",
    rule: "65 when earnings fall within 30 days (a catalyst is close), otherwise 50.",
    full: "not reachable on its own",
    zero: "not reachable",
  },
  {
    // Kept from our own engine (the 14 November fix), not the design's plain headline count: headlines are weighted by
    // impact and the share is shrunk toward neutral, so a handful of them cannot swing the score to either end.
    driver: "News sentiment",
    cat: "Catalysts",
    rule: "Positive minus negative headlines in the last 7 days, each weighted by its impact, as a share of all of them plus 4 (so a few headlines cannot push it to an end). 50 + 50 × that share.",
    full: "never reached (a long run of only positive headlines comes close)",
    zero: "never reached (a long run of only negative headlines comes close)",
  },
  {
    driver: "Forward P/E",
    cat: "Valuation",
    rule: "100 − 1.5 × forward P/E, kept between 15 and 90: cheaper scores higher.",
    full: "never reached (best is 90, at P/E 5 or lower)",
    zero: "never reached (worst is 15, at P/E 57 or higher)",
  },
  {
    driver: "P/E",
    cat: "Valuation",
    rule: "On its own: trailing price-to-earnings, cheaper scores higher. 100 − 1.5 × P/E, kept between 15 and 90.",
    full: "never reached (best is 90, at P/E 5 or lower)",
    zero: "never reached (worst is 15, at P/E 57 or higher)",
  },
  {
    driver: "P/E vs peers",
    cat: "Valuation",
    peers: true,
    rule: "The same P/E against the top five competitors' average (competitors with no earnings are left out; three are needed). 50 + 50 × (how much cheaper than the average ÷ 50%).",
    full: "50% or more cheaper than peers",
    zero: "50% or more dearer than peers",
  },
  {
    driver: "13F holder count",
    cat: "Flows",
    rule: "Quarter-on-quarter change in institutional filers holding it. 50 + change ÷ 10, kept between 20 and 80.",
    full: "never reached (best is 80)",
    zero: "never reached (worst is 20)",
  },
  {
    driver: "Analyst rating changes",
    cat: "Flows",
    rule: "Upgrades minus downgrades in the last 90 days. 50 + 10 × the difference.",
    full: "5 more upgrades than downgrades",
    zero: "5 more downgrades than upgrades",
  },
  {
    driver: "Insider open-market trades",
    cat: "Flows",
    rule: "Net open-market insider buying in the last 90 days: net buying 75, net selling 42.",
    full: "not reachable on its own",
    zero: "not reachable",
  },
  {
    driver: "Sector rank",
    cat: "Macro",
    rule: "Where its sector ranks today among all sectors. 100 − rank share × 100 + 5.",
    full: "a top-ranked sector",
    zero: "never reached (a bottom-ranked sector scores 5)",
  },
  {
    driver: "Volatility regime",
    cat: "Macro",
    rule: "30-day realized volatility, calmer scores higher: 80 − 1.2 × (volatility − 20), kept between 20 and 80.",
    full: "never reached (best is 80)",
    zero: "never reached (worst is 20)",
  },
];
