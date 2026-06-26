"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { movers, analyst, earnings, watch, folio } from "../data";
import { fmt, sign, cls, arr, Spark, StockLogo } from "../utils";

const StockScreenEmbed = dynamic<{ initialSym?: string }>(
  () => import("./stock").then(m => ({ default: m.StockScreen })),
  { ssr: false, loading: () => <div style={{ padding: 40, textAlign: "center", color: "var(--text-dim-solid)" }}>Loading…</div> }
);

const TABS = [
  ["win",  "Top Gainers"],
  ["lose", "Top Losers"],
  ["vol",  "Unusual Volume"],
  ["week", "Weekly Movers"],
] as const;
type TabKey = "win" | "lose" | "vol" | "week";
const CAPS = ["All", "Mega", "Large", "Mid", "Small"];

function computeTrending() {
  const srcs: Record<string, Set<string>> = {};
  const add = (s: string, src: string) => {
    if (!srcs[s]) srcs[s] = new Set();
    srcs[s].add(src);
  };
  movers.forEach(m  => add(m.s, "Movers"));
  analyst.forEach(a => add(a.s, "Analyst"));
  earnings.forEach(e => add(e.s, "Earnings"));
  watch.forEach(w   => add(w.s, "Watchlist"));
  folio.forEach(f   => add(f.s, "Portfolio"));
  return Object.entries(srcs)
    .map(([s, set]) => ({ s, n: set.size, srcs: [...set], days: 2 + (s.charCodeAt(0) % 4) }))
    .filter(o => o.n >= 2)
    .sort((a, b) => b.n - a.n || b.days - a.days);
}

/* ── Earnings Calls data ── */
interface CallEntry {
  sym: string;
  name: string;
  price: number;
  change: number;
  callDate: string;
  callTime: string;
  session: "BMO" | "AMC";
  title: string;
  duration?: string;
  epsEst: number | null;
  epsAct: number | null;
  revEst: string | null;
  revAct: string | null;
  guide: "Up" | "In-line" | "Down" | null;
  react: number | null;
  summary: string;
  points: string[];
}

const CALLS_DATA: CallEntry[] = [
  {
    sym: "NVDA", name: "NVIDIA Corporation", price: 135.82, change: 3.14,
    callDate: "Jun 4, 2026", callTime: "5:00 PM ET", session: "AMC", title: "Q1 2026 Earnings Call", duration: "62 min",
    epsEst: 0.89, epsAct: 1.04, revEst: "28.2B", revAct: "30.1B", guide: "Up", react: 8.2,
    summary: "NVIDIA posted a blowout quarter driven by relentless demand for its Blackwell GPU architecture across cloud hyperscalers and enterprise AI deployments. Data center revenue hit $26.3B, up 93% YoY. Management raised Q2 guidance significantly above consensus.",
    points: ["Data center revenue +93% YoY to $26.3B", "Blackwell backlog remains 'several quarters' long", "Q2 revenue guide $32–34B vs. $29.8B consensus", "Gross margin expanded 80bps to 73.5%", "Gaming revenue recovered +18% sequentially"],
  },
  {
    sym: "AAPL", name: "Apple Inc.", price: 211.45, change: 1.87,
    callDate: "May 1, 2026", callTime: "5:00 PM ET", session: "AMC", title: "Q2 FY2026 Earnings Call", duration: "55 min",
    epsEst: 1.58, epsAct: 1.65, revEst: "94.1B", revAct: "95.4B", guide: "Up", react: 2.4,
    summary: "Apple beat on both EPS and revenue, led by Services revenue hitting a new record of $26.9B. iPhone volumes came in ahead of expectations on strength in emerging markets. The company announced a $110B buyback authorization.",
    points: ["Services revenue record $26.9B, +15% YoY", "iPhone revenue $46.2B, beat by $1.4B", "New $110B share repurchase program authorized", "India and Southeast Asia drove unit upside", "Gross margin 46.6%, above 46.2% guide"],
  },
  {
    sym: "MSFT", name: "Microsoft Corporation", price: 432.10, change: 2.31,
    callDate: "Apr 30, 2026", callTime: "5:30 PM ET", session: "AMC", title: "Q3 FY2026 Earnings Call", duration: "68 min",
    epsEst: 3.21, epsAct: 3.46, revEst: "68.7B", revAct: "70.1B", guide: "Up", react: 4.6,
    summary: "Microsoft delivered strong beats across all three segments. Azure growth re-accelerated to 35% CC, materially ahead of the 31% consensus. Copilot monetization is ramping with $6B in ARR. Management guided next quarter well above street on continued AI infrastructure build-out.",
    points: ["Azure +35% CC vs. 31% consensus estimate", "Copilot ARR reached $6B, ahead of schedule", "Commercial bookings +23% on multi-year AI deals", "Operating margin expanded 120bps to 44.4%", "LinkedIn revenue +11%, gaming flat YoY"],
  },
  {
    sym: "AMZN", name: "Amazon.com Inc.", price: 198.73, change: 5.02,
    callDate: "May 1, 2026", callTime: "4:30 PM ET", session: "AMC", title: "Q1 2026 Earnings Call", duration: "74 min",
    epsEst: 1.29, epsAct: 1.59, revEst: "155.3B", revAct: "157.2B", guide: "Up", react: 6.8,
    summary: "Amazon's Q1 showed AWS re-acceleration to 21% growth and Advertising crossing $16B for the first time. North America retail returned to double-digit operating margins. Management increased FY2026 capex to $100B+ for AI infrastructure, signaling confidence in demand.",
    points: ["AWS revenue +21% YoY, re-acceleration from 17%", "Advertising $16.0B, +19% YoY", "North America operating margin 6.4%, best in 6 quarters", "Q2 op income guide $13–17.5B vs. $12.9B est.", "Capex raised to $100B+ for 2026"],
  },
  {
    sym: "GOOGL", name: "Alphabet Inc.", price: 174.50, change: -0.83,
    callDate: "Apr 29, 2026", callTime: "4:30 PM ET", session: "AMC", title: "Q1 2026 Earnings Call", duration: "65 min",
    epsEst: 2.01, epsAct: 2.12, revEst: "89.3B", revAct: "90.2B", guide: "In-line", react: 1.2,
    summary: "Alphabet reported solid but not spectacular results. Search revenue held steady with AI Overviews monetizing better than feared. YouTube Shorts ad load is approaching long-form levels. Google Cloud reached 30% growth. The $70B buyback announcement was the key post-market catalyst.",
    points: ["Search & Other $50.7B, +9% YoY — fears overdone", "YouTube ads $8.9B, +10% YoY — Shorts monetizing", "Google Cloud $12.3B, +30% YoY", "Announced $70B incremental buyback", "AI Overviews cost per query declining ahead of plan"],
  },
  {
    sym: "META", name: "Meta Platforms Inc.", price: 522.34, change: 4.55,
    callDate: "Apr 30, 2026", callTime: "4:30 PM ET", session: "AMC", title: "Q1 2026 Earnings Call", duration: "57 min",
    epsEst: 5.14, epsAct: 6.43, revEst: "41.2B", revAct: "42.3B", guide: "Up", react: 7.1,
    summary: "Meta delivered a spectacular quarter. Ad revenue accelerated on AI-driven Advantage+ campaigns, which now represent 42% of total ad spend. Llama 4 is powering recommendations and reducing content moderation costs. Reality Labs losses narrowed more than expected.",
    points: ["Ad revenue +19% YoY; Advantage+ = 42% of spend", "Daily active people 3.43B, +7% YoY", "Llama 4 deployment reducing infra costs by 20%", "Reality Labs op loss narrowed to -$3.4B (est. -$4.1B)", "Q2 revenue guide $42.5–45.5B — well above est."],
  },
  {
    sym: "TSLA", name: "Tesla Inc.", price: 178.92, change: -3.26,
    callDate: "Apr 22, 2026", callTime: "5:30 PM ET", session: "AMC", title: "Q1 2026 Earnings Call", duration: "72 min",
    epsEst: 0.41, epsAct: 0.27, revEst: "21.8B", revAct: "19.3B", guide: "Down", react: -8.4,
    summary: "Tesla missed across the board as automotive margins compressed to 12.5%, the lowest since 2019, amid aggressive price cuts in China and Europe. Deliveries were below even lowered expectations. Management focused heavily on autonomous and Optimus robot timelines, which offered limited near-term financial clarity.",
    points: ["Automotive gross margin 12.5% vs. 14.2% expected", "Deliveries 336K, -16% YoY — 5th consecutive decline", "FSD take rate only 4.2% of new buyers", "Optimus production target 1M units by 2030 reiterated", "Energy storage revenue $2.7B — bright spot"],
  },
  {
    sym: "JPM", name: "JPMorgan Chase & Co.", price: 224.60, change: 1.44,
    callDate: "Apr 11, 2026", callTime: "8:30 AM ET", session: "BMO", title: "Q1 2026 Earnings Call", duration: "61 min",
    epsEst: 4.12, epsAct: 4.44, revEst: "42.6B", revAct: "43.9B", guide: "Up", react: 3.1,
    summary: "JPMorgan crushed Q1 estimates. Net interest income came in ahead of expectations as the rate environment held favorable. Investment banking revenue surged 46% on a reopening deal pipeline. Management raised full-year NII guidance by $2B.",
    points: ["Net interest income $23.4B, +5% vs. est. $22.1B", "Investment banking fees +46% YoY to $2.7B", "Credit card net charge-offs stabilized at 3.6%", "Full-year NII guidance raised to $94B (+$2B)", "CET1 ratio 15.7% — excess capital building"],
  },
  {
    sym: "BAC", name: "Bank of America Corp.", price: 42.18, change: 0.34,
    callDate: "Apr 15, 2026", callTime: "6:30 AM ET", session: "BMO", title: "Q1 2026 Earnings Call", duration: "58 min",
    epsEst: 0.82, epsAct: 0.90, revEst: "25.4B", revAct: "26.1B", guide: "In-line", react: 1.7,
    summary: "BofA posted a solid beat driven by stronger NII and better-than-feared consumer credit quality. Wealth management AUM hit a record $4.1T. Management guided for flat NII sequentially in Q2, roughly in line with consensus.",
    points: ["NII $14.2B, beat by $400M on deposit repricing", "Merrill Lynch AUM record $4.1T, +12% YoY", "Consumer credit card losses declined 20bps QoQ", "Efficiency ratio improved to 63.8% vs. 65.1% prior", "Common equity Tier 1 ratio 13.4%"],
  },
  {
    sym: "AMD", name: "Advanced Micro Devices", price: 156.44, change: 6.23,
    callDate: "Apr 29, 2026", callTime: "5:00 PM ET", session: "AMC", title: "Q1 2026 Earnings Call", duration: "66 min",
    epsEst: 0.68, epsAct: 0.96, revEst: "7.1B", revAct: "7.7B", guide: "Up", react: 9.5,
    summary: "AMD shattered expectations. MI300X GPU sales are exceeding AMD's own forecasts with data center GPU revenue hitting $2.3B — a new record and triple the prior-year quarter. Client and embedded segments are recovering. Management raised the FY2026 data center GPU forecast to $10B+.",
    points: ["Data center GPU revenue $2.3B, triple YoY", "FY2026 data center GPU target raised to $10B+", "MI300X outperforming H100 in memory bandwidth benchmarks", "PC client segment +29% on Ryzen AI refresh", "Embedded recovery accelerating, +22% QoQ"],
  },
  {
    sym: "INTC", name: "Intel Corporation", price: 21.38, change: -4.12,
    callDate: "Apr 24, 2026", callTime: "4:30 PM ET", session: "AMC", title: "Q1 2026 Earnings Call", duration: "78 min",
    epsEst: 0.01, epsAct: -0.17, revEst: "12.8B", revAct: "12.7B", guide: "Down", react: -7.3,
    summary: "Intel's Q1 showed continued margin pressure as the foundry segment posted a $1.4B operating loss. PC client revenue held up but server share losses to AMD are ongoing. Management trimmed workforce by a further 3,000 and reduced the FY2026 capex plan. A Foundry strategic review is ongoing.",
    points: ["Foundry segment op loss -$1.4B, wider than -$1.1B est.", "Server (DCAI) revenue -8% YoY; AMD share gains accelerating", "FY2026 capex reduced to $18B (from $21B)", "Additional 3,000 headcount reduction announced", "Intel 18A process yield still below internal targets"],
  },
  {
    sym: "CRM", name: "Salesforce Inc.", price: 298.44, change: 2.77,
    callDate: "May 28, 2026", callTime: "5:00 PM ET", session: "AMC", title: "Q1 FY2027 Earnings Call", duration: "63 min",
    epsEst: 2.61, epsAct: 2.98, revEst: "9.12B", revAct: "9.38B", guide: "Up", react: 4.4,
    summary: "Salesforce had a standout quarter as Agentforce AI adoption drove a 17% beat in professional services and accelerated upsell across the existing base. RPO grew 22% to $63B — the strongest in six quarters. Management raised FY2027 revenue guide by $400M.",
    points: ["Agentforce deployed at 4,000+ customers, up from 200 in Q4", "RPO +22% to $63B — six-quarter high", "Operating margin 32.1%, +280bps YoY", "FY2027 revenue guide raised to $37.7–37.9B", "Data Cloud users +35% — new monetization layer emerging"],
  },
  {
    sym: "NFLX", name: "Netflix Inc.", price: 892.45, change: 3.88,
    callDate: "Apr 15, 2026", callTime: "4:00 PM ET", session: "AMC", title: "Q1 2026 Earnings Call", duration: "48 min",
    epsEst: 5.68, epsAct: 6.61, revEst: "10.4B", revAct: "10.5B", guide: "Up", react: 5.2,
    summary: "Netflix delivered a strong quarter with operating margin expanding to 29.2%, new subscriber disclosure replaced by engagement disclosures. Advertising tier now has 94M monthly active users. Live events strategy — sports and WWE — is driving a step-up in total viewing hours.",
    points: ["Ad-supported tier: 94M MAUs, 40% of new sign-ups", "Operating margin 29.2%, guide for 29.5% in Q2", "Engagement up 14% YoY to 98M hours/day globally", "WWE Raw and NFL Christmas games boosted Q1 hours", "Password-sharing enforcement now complete — tailwinds fading"],
  },
  {
    sym: "V", name: "Visa Inc.", price: 287.33, change: 1.22,
    callDate: "Apr 23, 2026", callTime: "5:00 PM ET", session: "AMC", title: "Q2 FY2026 Earnings Call", duration: "52 min",
    epsEst: 2.68, epsAct: 2.88, revEst: "9.0B", revAct: "9.3B", guide: "In-line", react: 2.0,
    summary: "Visa posted steady growth driven by cross-border travel volumes that remained 10% above 2019 levels. US consumer spending was resilient despite macro uncertainty. New flows and value-added services are the incremental growth drivers, now comprising 22% of net revenue.",
    points: ["Cross-border volume +14% YoY, still above 2019", "US consumer spending +7% — resilient through rate pressure", "New flows (B2B, gov) +20% YoY", "Value-added services 22% of net revenue — fastest growing segment", "Buyback $4.0B in Q2; $14B remaining authorization"],
  },
  {
    sym: "JNJ", name: "Johnson & Johnson", price: 157.82, change: 0.44,
    callDate: "Apr 15, 2026", callTime: "8:00 AM ET", session: "BMO", title: "Q1 2026 Earnings Call", duration: "56 min",
    epsEst: 2.55, epsAct: 2.71, revEst: "21.6B", revAct: "21.9B", guide: "In-line", react: 1.3,
    summary: "J&J delivered a solid in-line quarter. MedTech segment outperformed with robotic surgery driving procedure volumes higher. The pharmaceutical segment saw Darzalex continue its dominance in multiple myeloma while TREMFYA posted strong psoriasis share gains. Management reaffirmed FY2026 guidance.",
    points: ["Darzalex revenue $3.0B, +22% YoY — market share 57%", "MedTech +8% on robotic surgery and Abiomed strength", "TREMFYA $1.5B, gaining on Humira biosimilar entrants", "FY2026 EPS guidance reaffirmed at $10.50–10.70", "Innovative Med pipeline: 6 new FDA submissions in Q2"],
  },
  {
    sym: "WMT", name: "Walmart Inc.", price: 98.44, change: 2.11,
    callDate: "May 15, 2026", callTime: "8:00 AM ET", session: "BMO", title: "Q1 FY2027 Earnings Call", duration: "59 min",
    epsEst: 0.58, epsAct: 0.61, revEst: "168.0B", revAct: "169.6B", guide: "Up", react: 3.4,
    summary: "Walmart outperformed on all metrics. US comparable sales rose 5.0% led by grocery market share gains from higher-income households and strong private label penetration. Walmart+ membership is approaching 40M. Advertising revenue hit $1.6B — an 18-month consecutive record.",
    points: ["US comp sales +5.0% — 8th consecutive acceleration quarter", "Higher-income (>$100K) shopper growth driving mix", "Walmart+ approaching 40M members", "Advertising revenue $1.6B, +26% YoY", "FY2027 EPS guide raised by $0.10 to $2.52–2.57"],
  },
  {
    sym: "DIS", name: "The Walt Disney Company", price: 111.20, change: -2.55,
    callDate: "May 7, 2026", callTime: "5:00 PM ET", session: "AMC", title: "Q2 FY2026 Earnings Call", duration: "64 min",
    epsEst: 1.20, epsAct: 1.04, revEst: "22.6B", revAct: "22.1B", guide: "Down", react: -4.8,
    summary: "Disney missed consensus with weaker-than-expected Parks & Experiences revenue as domestic park attendance softened on macro pressures and rising competition. Streaming reached profitability but below the seasonal high. Management lowered Parks segment operating income guidance for the full year.",
    points: ["Parks & Experiences op income -9% on attendance softness", "Disney+ net adds 4.3M, slightly below 5.1M est.", "Streaming combined profit $0.9B — below Q1's $0.97B", "Parks full-year op income guide cut by ~$500M", "Content impairments $0.8B related to legacy IP writedowns"],
  },
  /* ── Upcoming calls ── */
  {
    sym: "ORCL", name: "Oracle Corporation", price: 148.30, change: 0.88,
    callDate: "Jun 9, 2026", callTime: "5:00 PM ET", session: "AMC", title: "Q4 FY2026 Earnings Call",
    epsEst: 1.62, epsAct: null, revEst: "14.7B", revAct: null, guide: null, react: null,
    summary: "", points: [],
  },
  {
    sym: "ADBE", name: "Adobe Inc.", price: 396.10, change: -0.41,
    callDate: "Jun 11, 2026", callTime: "5:00 PM ET", session: "AMC", title: "Q2 FY2026 Earnings Call",
    epsEst: 4.98, epsAct: null, revEst: "5.84B", revAct: null, guide: null, react: null,
    summary: "", points: [],
  },
  {
    sym: "FDX", name: "FedEx Corporation", price: 282.44, change: 1.03,
    callDate: "Jun 24, 2026", callTime: "5:30 PM ET", session: "AMC", title: "Q4 FY2026 Earnings Call",
    epsEst: 5.41, epsAct: null, revEst: "21.8B", revAct: null, guide: null, react: null,
    summary: "", points: [],
  },
  {
    sym: "COST", name: "Costco Wholesale", price: 918.75, change: 2.14,
    callDate: "Jun 26, 2026", callTime: "5:00 PM ET", session: "AMC", title: "Q3 FY2026 Earnings Call",
    epsEst: 4.01, epsAct: null, revEst: "61.4B", revAct: null, guide: null, react: null,
    summary: "", points: [],
  },
  {
    sym: "TGT", name: "Target Corporation", price: 138.90, change: -0.72,
    callDate: "Jun 18, 2026", callTime: "8:00 AM ET", session: "BMO", title: "Q1 FY2027 Earnings Call",
    epsEst: 1.88, epsAct: null, revEst: "24.0B", revAct: null, guide: null, react: null,
    summary: "", points: [],
  },
  {
    sym: "NKE", name: "Nike Inc.", price: 82.14, change: 0.31,
    callDate: "Jun 26, 2026", callTime: "4:15 PM ET", session: "AMC", title: "Q4 FY2026 Earnings Call",
    epsEst: 0.29, epsAct: null, revEst: "11.2B", revAct: null, guide: null, react: null,
    summary: "", points: [],
  },
  {
    sym: "SBUX", name: "Starbucks Corporation", price: 89.22, change: 0.57,
    callDate: "Jul 29, 2026", callTime: "5:00 PM ET", session: "AMC", title: "Q3 FY2026 Earnings Call",
    epsEst: 0.52, epsAct: null, revEst: "9.2B", revAct: null, guide: null, react: null,
    summary: "", points: [],
  },
  {
    sym: "GS", name: "Goldman Sachs Group", price: 544.80, change: 1.92,
    callDate: "Jul 14, 2026", callTime: "8:30 AM ET", session: "BMO", title: "Q2 2026 Earnings Call",
    epsEst: 9.18, epsAct: null, revEst: "13.8B", revAct: null, guide: null, react: null,
    summary: "", points: [],
  },
  {
    sym: "WDAY", name: "Workday Inc.", price: 268.30, change: 1.12,
    callDate: "Jun 30, 2026", callTime: "4:30 PM ET", session: "AMC", title: "Q1 FY2027 Earnings Call",
    epsEst: 1.82, epsAct: null, revEst: "2.21B", revAct: null, guide: null, react: null,
    summary: "", points: [],
  },
  {
    sym: "GIS", name: "General Mills Inc.", price: 72.40, change: -0.88,
    callDate: "Jul 2, 2026", callTime: "8:00 AM ET", session: "BMO", title: "Q4 FY2026 Earnings Call",
    epsEst: 1.02, epsAct: null, revEst: "5.11B", revAct: null, guide: null, react: null,
    summary: "", points: [],
  },
  {
    sym: "LULU", name: "Lululemon Athletica", price: 312.80, change: 0.54,
    callDate: "Jul 2, 2026", callTime: "4:15 PM ET", session: "AMC", title: "Q1 FY2027 Earnings Call",
    epsEst: 2.61, epsAct: null, revEst: "2.45B", revAct: null, guide: null, react: null,
    summary: "", points: [],
  },
];

// ── Earnings call calendar helpers ───────────────────────────────────────────

const CALL_DATES: Record<string, { month: number; day: number; weekDay: number }> = {
  NVDA:  { month: 6, day: 4,  weekDay: 3 },
  AAPL:  { month: 5, day: 1,  weekDay: 4 },
  MSFT:  { month: 4, day: 30, weekDay: 3 },
  AMZN:  { month: 5, day: 1,  weekDay: 4 },
  GOOGL: { month: 4, day: 29, weekDay: 2 },
  META:  { month: 4, day: 30, weekDay: 3 },
  TSLA:  { month: 4, day: 22, weekDay: 2 },
  JPM:   { month: 4, day: 11, weekDay: 4 },
  BAC:   { month: 4, day: 15, weekDay: 2 },
  AMD:   { month: 4, day: 29, weekDay: 2 },
  INTC:  { month: 4, day: 24, weekDay: 4 },
  CRM:   { month: 5, day: 28, weekDay: 3 },
  NFLX:  { month: 4, day: 15, weekDay: 2 },
  V:     { month: 4, day: 23, weekDay: 3 },
  JNJ:   { month: 4, day: 15, weekDay: 2 },
  WMT:   { month: 5, day: 15, weekDay: 4 },
  DIS:   { month: 5, day: 7,  weekDay: 3 },
  ORCL:  { month: 6, day: 9,  weekDay: 1 },
  ADBE:  { month: 6, day: 11, weekDay: 3 },
  FDX:   { month: 6, day: 24, weekDay: 2 },
  COST:  { month: 6, day: 26, weekDay: 4 },
  TGT:   { month: 6, day: 18, weekDay: 3 },
  NKE:   { month: 6, day: 26, weekDay: 4 },
  SBUX:  { month: 7, day: 29, weekDay: 2 },
  GS:    { month: 7, day: 14, weekDay: 1 },
  WDAY:  { month: 6, day: 30, weekDay: 1 },
  GIS:   { month: 7, day: 2,  weekDay: 3 },
  LULU:  { month: 7, day: 2,  weekDay: 3 },
};

type EcTabKey = "lmonth" | "prev" | "yest" | "today" | "tom" | "week" | "next" | "month";
const EC_RANGES: [EcTabKey, string][] = [
  ["lmonth", "Last Month"],
  ["prev",   "Last Week"],
  ["yest",   "Yesterday"],
  ["today",  "Today"],
  ["tom",    "Tomorrow"],
  ["week",   "This Week"],
  ["next",   "Next Week"],
  ["month",  "Month"],
];
const EC_DOWS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function ecCalFor(t: EcTabKey): CallEntry[] {
  return CALLS_DATA.filter(c => {
    const d = CALL_DATES[c.sym];
    if (!d) return false;
    switch (t) {
      case "today":  return d.month === 6 && d.day === 25;
      case "yest":   return d.month === 6 && d.day === 24;
      case "tom":    return d.month === 6 && d.day === 26;
      case "week":   return d.month === 6 && d.day >= 22 && d.day <= 26;
      case "prev":   return d.month === 6 && d.day >= 15 && d.day <= 19;
      case "next":   return (d.month === 6 && d.day >= 29) || (d.month === 7 && d.day <= 3);
      case "lmonth": return d.month === 5;
      case "month":  return d.month === 6;
    }
  });
}

function ecMonthMap(month1: number): Record<number, CallEntry[]> {
  const Y = 2026;
  const days = new Date(Y, month1, 0).getDate();
  const map: Record<number, CallEntry[]> = {};
  for (let d = 1; d <= days; d++) {
    map[d] = CALLS_DATA.filter(c => {
      const cd = CALL_DATES[c.sym];
      return cd && cd.month === month1 && cd.day === d;
    });
  }
  return map;
}

function CallChip({ entry, selected, onSelect }: {
  entry: CallEntry; selected: boolean; onSelect: (c: CallEntry) => void;
}) {
  return (
    <button className={`ec-chip${selected ? " on" : ""}`} onClick={() => onSelect(entry)}>
      <span className="ec-logo" style={{ background: "#27314a", color: "#cdd6e6" }}>
        {entry.sym[0]}
        <img
          src={`https://assets.parqet.com/logos/symbol/${entry.sym}?format=png`}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          alt=""
        />
      </span>
      {entry.sym}
    </button>
  );
}

/* ── CallDrawer ── */
function CallDrawer({ call, onClose }: { call: CallEntry; onClose: () => void }) {
  const [playing,   setPlaying]   = useState(false);
  const [activeTab, setActiveTab] = useState<"summary" | "transcript">("summary");

  const beat = call.epsAct !== null && call.epsEst !== null && call.epsAct > call.epsEst;
  const miss = call.epsAct !== null && call.epsEst !== null && call.epsAct < call.epsEst;

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="side-drawer">
        {/* Header */}
        <div className="drawer-h">
          <StockLogo sym={call.sym} size={38} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--f-display)", fontWeight: 700, fontSize: "1rem", color: "var(--text-hi)" }}>
              {call.sym} · {call.name}
            </div>
            <div style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", marginTop: 2 }}>
              ${fmt(call.price)}{" "}
              <span className={cls(call.change)}>{sign(call.change)}</span>
              {" · "}{call.callDate} · {call.session}
            </div>
          </div>
          <button className="closebtn" onClick={onClose}>✕</button>
        </div>

        <div className="drawer-b">
          {/* Call title + play button */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12, marginBottom: 14,
            background: "var(--surface-1)", borderRadius: 12, padding: 14,
            border: "1px solid var(--border-soft)",
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: "var(--text-hi)", fontSize: ".95rem" }}>{call.title}</div>
              <div style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", marginTop: 3 }}>
                {call.callTime}{call.duration ? ` · ${call.duration}` : ""}
                {call.epsAct === null && (
                  <span className="pill" style={{ background: "var(--warn-dim, rgba(255,186,0,.15))", color: "var(--warn)", marginLeft: 6, fontSize: ".64rem" }}>
                    Upcoming
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => setPlaying(p => !p)}
              style={{
                width: 42, height: 42, borderRadius: "50%",
                background: playing ? "var(--brand-2)" : "var(--surface-2)",
                border: `1px solid ${playing ? "var(--brand-2)" : "var(--border)"}`,
                color: playing ? "#000" : "var(--text-hi)",
                fontSize: "1rem", cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center", flexShrink: 0,
                transition: ".18s",
              }}
            >
              {playing ? "⏸" : "▶"}
            </button>
          </div>

          {/* Mock audio progress bar */}
          {playing && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ height: 4, background: "var(--border-soft)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: "22%", height: "100%", background: "var(--brand-2)", borderRadius: 2 }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".66rem", color: "var(--text-dim-solid)", marginTop: 4 }}>
                <span>12:43</span>
                <span>{call.duration ?? "—"}</span>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="tabs" style={{ marginBottom: 16 }}>
            <button className={`tab${activeTab === "summary" ? " on" : ""}`} onClick={() => setActiveTab("summary")}>AI Summary</button>
            <button className={`tab${activeTab === "transcript" ? " on" : ""}`} onClick={() => setActiveTab("transcript")}>Full Transcript</button>
          </div>

          {activeTab === "summary" && (
            <>
              {/* EPS / Rev metric grid */}
              {call.epsAct !== null && (
                <div className="metric-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
                  <div className="m">
                    <div className="k">EPS Est</div>
                    <div className="v">{call.epsEst ?? "—"}</div>
                  </div>
                  <div className="m">
                    <div className="k">EPS Act</div>
                    <div className={`v ${beat ? "up" : miss ? "dn" : ""}`}>{call.epsAct}</div>
                    {beat && <div className="s up">Beat</div>}
                    {miss && <div className="s dn">Miss</div>}
                  </div>
                  <div className="m">
                    <div className="k">Rev Est</div>
                    <div className="v" style={{ fontSize: ".9rem" }}>{call.revEst ?? "—"}</div>
                  </div>
                  <div className="m">
                    <div className="k">Rev Act</div>
                    <div className="v" style={{ fontSize: ".9rem" }}>{call.revAct ?? "—"}</div>
                  </div>
                </div>
              )}

              {/* Guidance + Reaction pills */}
              {(call.guide || call.react !== null) && (
                <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                  {call.guide && (
                    <span className="pill" style={{
                      background: call.guide === "Up" ? "var(--up-dim)" : call.guide === "Down" ? "var(--down-dim)" : "var(--surface-3)",
                      color: call.guide === "Up" ? "var(--up)" : call.guide === "Down" ? "var(--down)" : "var(--text-dim-solid)",
                    }}>
                      Guidance: {call.guide}
                    </span>
                  )}
                  {call.react !== null && (
                    <span className={`pill ${call.react >= 0 ? "up" : "dn"}`}>
                      Reaction: {call.react > 0 ? "+" : ""}{call.react}%
                    </span>
                  )}
                </div>
              )}

              {/* Summary */}
              {call.summary ? (
                <>
                  <p style={{ fontSize: ".88rem", color: "var(--text)", lineHeight: 1.65, marginBottom: 14 }}>
                    {call.summary}
                  </p>
                  <div style={{ fontSize: ".72rem", fontWeight: 700, color: "var(--text-dim-solid)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>
                    Main Points
                  </div>
                  <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                    {call.points.map((pt, i) => (
                      <li key={i} style={{ display: "flex", gap: 10, fontSize: ".85rem", color: "var(--text)", lineHeight: 1.5 }}>
                        <span style={{ width: 18, height: 18, borderRadius: 5, background: "var(--brand-2)", color: "#000", fontWeight: 800, fontSize: ".65rem", display: "grid", placeItems: "center", flexShrink: 0, marginTop: 1 }}>
                          {i + 1}
                        </span>
                        {pt}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <div style={{ padding: "28px 0", textAlign: "center", color: "var(--text-dim-solid)", fontSize: ".88rem" }}>
                  Call summary will be available after the call.
                </div>
              )}
            </>
          )}

          {activeTab === "transcript" && (
            <div style={{ fontSize: ".82rem", color: "var(--text)", lineHeight: 1.75 }}>
              {call.epsAct === null ? (
                <div style={{ padding: "28px 0", textAlign: "center", color: "var(--text-dim-solid)" }}>
                  Transcript will be available after the call.
                </div>
              ) : (
                <>
                  <p><b style={{ color: "var(--text-dim-solid)" }}>Operator:</b> Good {"BMO" === call.session ? "morning" : "afternoon"} and welcome to the {call.title} for {call.name}. As a reminder, this conference call is being recorded. I will now turn the call over to the Investor Relations team. Please go ahead.</p>
                  <p style={{ marginTop: 12 }}><b style={{ color: "var(--text-dim-solid)" }}>IR:</b> Thank you. Good {"BMO" === call.session ? "morning" : "afternoon"} everyone. Joining us today are our Chief Executive Officer and Chief Financial Officer. Before we begin, I would like to remind you that this call contains forward-looking statements that are subject to risks and uncertainties. Please refer to our most recent SEC filings for a description of the risk factors that may affect our results. We will now begin with prepared remarks.</p>
                  <p style={{ marginTop: 12 }}><b style={{ color: "var(--text-dim-solid)" }}>CEO:</b> Thank you, and good {"BMO" === call.session ? "morning" : "afternoon"} to everyone joining us. We are pleased to report strong results for the quarter. {call.summary.split(".")[0]}. Our team continues to execute exceptionally well against our long-term strategic priorities.</p>
                  <p style={{ marginTop: 12 }}><b style={{ color: "var(--text-dim-solid)" }}>CFO:</b> Thank you. Let me take you through the financial details. {call.points[0] ?? "We delivered solid results across all segments."}. {call.points[1] ?? "Margins expanded as we continue to optimize our cost structure."}. We remain confident in our guidance for the balance of the year.</p>
                  <p style={{ marginTop: 12, color: "var(--text-dim-solid)", fontStyle: "italic", fontSize: ".76rem" }}>— Transcript continues. Q&A session follows prepared remarks. —</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export function MoversScreen() {
  const [tab,          setTab]          = useState<TabKey>("win");
  const [sector,       setSector]       = useState("All");
  const [cap,          setCap]          = useState("All");
  const [selectedSym,  setSelectedSym]  = useState<string | null>(null);
  const [selectedCall, setSelectedCall] = useState<CallEntry | null>(null);
  const [ecTab,        setEcTab]        = useState<EcTabKey>("week");
  const [ecMonthDay,   setEcMonthDay]   = useState<number | null>(null);

  const sectors = ["All", ...Array.from(new Set(movers.map(m => m.sector))).sort()];

  const filtered = movers
    .filter(m => {
      if (sector !== "All" && m.sector !== sector) return false;
      if (cap    !== "All" && m.cap    !== cap)    return false;
      if (tab === "win")  return m.c > 0;
      if (tab === "lose") return m.c < 0;
      return true;
    })
    .sort((a, b) => {
      if (tab === "win")  return b.c    - a.c;
      if (tab === "lose") return a.c    - b.c;
      if (tab === "vol")  return b.rvol - a.rvol;
      return Math.abs(b.wk) - Math.abs(a.wk);
    })
    .slice(0, 15);

  const tally: Record<string, number> = {};
  filtered.forEach(m => { tally[m.sector] = (tally[m.sector] || 0) + 1; });
  const sectorTally = Object.entries(tally).sort((a, b) => b[1] - a[1]);

  const trending = computeTrending();
  const val = (m: typeof movers[0]) => tab === "week" ? m.wk : m.c;

  const upcomingCalls = CALLS_DATA.filter(c => c.epsAct === null);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Market Movers</div>
          <h1 className="page-title">Winners &amp; Losers</h1>
          <div className="page-sub">
            {{ win: "Top 15 gainers today", lose: "Top 15 losers today", vol: "Top 15 by relative volume", week: "Biggest 5-day movers" }[tab]}
            {" · click a row for the full breakdown"}
          </div>
        </div>
        <div className="tabs">
          {TABS.map(([k, l]) => (
            <button key={k} className={`tab${k === tab ? " on" : ""}`} onClick={() => setTab(k as TabKey)}>{l}</button>
          ))}
        </div>
      </div>

      {/* Trending across reports */}
      {trending.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-h">
            <h3>🔥 Trending across reports</h3>
            <span className="pill" style={{ background: "var(--surface-3)", color: "var(--text-dim-solid)" }}>
              {trending.length} names · in 2+ of today&apos;s reports
            </span>
          </div>
          <div className="card-b" style={{ paddingTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
            {trending.map(o => {
              const mv = movers.find(m => m.s === o.s);
              const isUp = (mv?.c ?? 0) >= 0;
              return (
                <button key={o.s} className="tr-pill" onClick={() => setSelectedSym(o.s)}>
                  <StockLogo sym={o.s} size={18} />
                  <span className="tr-tk">{o.s}</span>
                  <span className="tr-mt">{o.n} reports · {o.days}d</span>
                  <Spark seed={o.s.charCodeAt(0)} up={isUp} w={52} h={16} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="fbar">
        <span style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", alignSelf: "center" }}>Sector</span>
        <select className="mv-sel" value={sector} onChange={e => setSector(e.target.value)}>
          {sectors.map(s => <option key={s}>{s}</option>)}
        </select>
        <span style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", alignSelf: "center", marginLeft: 10 }}>Market cap</span>
        <select className="mv-sel" value={cap} onChange={e => setCap(e.target.value)}>
          {CAPS.map(c => <option key={c}>{c}</option>)}
        </select>
        <div className="spacer" />
        <span style={{ fontSize: ".72rem", color: "var(--text-dim-solid)" }}>{filtered.length} stocks</span>
      </div>

      {/* Sector tally */}
      {sectorTally.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {sectorTally.map(([sec, count]) => (
            <span key={sec} className="pill" style={{ background: "var(--surface-3)", color: "var(--text-dim-solid)" }}>
              {sec} <b style={{ color: "var(--text-hi)" }}>{count}</b>
            </span>
          ))}
        </div>
      )}

      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>Company</th>
              <th className="num">Price</th>
              <th className="num">{tab === "week" ? "5-day" : "Change"}</th>
              <th className="num">RVOL</th>
              <th>Cap · Sector</th>
              <th>Catalyst</th>
              <th className="num">Intraday</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 16, color: "var(--text-dim-solid)" }}>No stocks match these filters.</td>
              </tr>
            ) : filtered.map(m => {
              const v = val(m);
              return (
                <tr
                  key={m.s}
                  className={m.owned ? "owned" : ""}
                  onClick={() => setSelectedSym(m.s)}
                  style={{ cursor: "pointer" }}
                >
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <StockLogo sym={m.s} size={26} />
                      <div className="co">
                        <span className="s">
                          {m.owned && <span className="own-dot" />}
                          {m.s}
                        </span>
                        <span className="n">{m.n}</span>
                      </div>
                    </div>
                  </td>
                  <td className="num">${fmt(m.p)}</td>
                  <td className={`num ${cls(v)}`}>{arr(v)} {sign(v)}</td>
                  <td className="num">
                    <b style={{ color: m.rvol > 3 ? "var(--warn)" : "var(--text)" }}>{m.rvol.toFixed(1)}×</b>
                  </td>
                  <td>
                    <span style={{ fontSize: ".74rem" }}>
                      <b style={{ color: "var(--text-hi)" }}>{m.cap}</b>
                      {" · "}
                      <span style={{ color: "var(--text-dim-solid)" }}>{m.sector}</span>
                    </span>
                  </td>
                  <td className="mv-reason">
                    {m.cat === "No known catalyst"
                      ? <span style={{ color: "var(--text-dim-solid)" }}>{m.cat}</span>
                      : <span className="pill" style={{ background: "var(--surface-3)", color: "var(--brand-2)" }}>{m.cat}</span>
                    }
                  </td>
                  <td className="num">
                    <Spark seed={m.s.charCodeAt(0)} up={v >= 0} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Earnings Calls Calendar ── */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-h">
          <h3>Earnings Calls</h3>
          <span className="pill" style={{ background: "var(--surface-3)", color: "var(--text-dim-solid)" }}>
            {CALLS_DATA.length} calls · {upcomingCalls.length} upcoming
          </span>
        </div>

        {/* Time-period tabs */}
        <div style={{ padding: "0 16px 2px", borderBottom: "1px solid var(--border-soft)" }}>
          <div className="tabs" style={{ paddingBottom: 6 }}>
            {EC_RANGES.map(([k, l]) => (
              <button
                key={k}
                className={`tab${ecTab === k ? " on" : ""}`}
                onClick={() => { setEcTab(k); setEcMonthDay(null); }}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="card-b" style={{ paddingTop: 12 }}>
          {(() => {
            const isDay  = ecTab === "today" || ecTab === "yest" || ecTab === "tom";
            const isWeek = ecTab === "week"  || ecTab === "prev" || ecTab === "next";
            const isLMon = ecTab === "lmonth";
            const isMon  = ecTab === "month";

            if (isDay) {
              const items = ecCalFor(ecTab);
              const bmo = items.filter(c => c.session === "BMO");
              const amc = items.filter(c => c.session === "AMC");
              const dayLabel: Record<EcTabKey, string> = {
                today: "Today · Thu Jun 25", yest: "Yesterday · Wed Jun 24", tom: "Tomorrow · Fri Jun 26",
                week: "", next: "", prev: "", month: "", lmonth: "",
              };
              return (
                <>
                  <div style={{ fontSize: ".8rem", fontWeight: 700, color: "var(--text-hi)", marginBottom: 10 }}>
                    {dayLabel[ecTab]}
                    <span className="pill" style={{ background: "var(--surface-3)", color: "var(--text-dim-solid)", marginLeft: 8 }}>
                      {items.length} calls
                    </span>
                  </div>
                  {items.length === 0 ? (
                    <span className="ec-none">No earnings calls scheduled this day.</span>
                  ) : (
                    <>
                      <div className="ec-lbl">Before open</div>
                      <div style={{ marginBottom: 10 }}>
                        {bmo.length
                          ? bmo.map(c => <CallChip key={c.sym} entry={c} selected={selectedCall?.sym === c.sym} onSelect={setSelectedCall} />)
                          : <span className="ec-none">None</span>}
                      </div>
                      <div className="ec-lbl">After close</div>
                      <div>
                        {amc.length
                          ? amc.map(c => <CallChip key={c.sym} entry={c} selected={selectedCall?.sym === c.sym} onSelect={setSelectedCall} />)
                          : <span className="ec-none">None</span>}
                      </div>
                    </>
                  )}
                </>
              );
            }

            if (isWeek) {
              const items = ecCalFor(ecTab);
              const days  = ["Mon", "Tue", "Wed", "Thu", "Fri"];
              const weekLabel: Record<EcTabKey, string> = {
                week: "This Week · Jun 22–26", next: "Next Week · Jun 29–Jul 3",
                prev: "Last Week · Jun 15–19", today: "", tom: "", yest: "", month: "", lmonth: "",
              };
              const selDayIdx = selectedCall ? (CALL_DATES[selectedCall.sym]?.weekDay ?? -1) : -1;
              return (
                <>
                  <div style={{ fontSize: ".8rem", fontWeight: 700, color: "var(--text-hi)", marginBottom: 10 }}>
                    {weekLabel[ecTab]}
                    <span className="pill" style={{ background: "var(--surface-3)", color: "var(--text-dim-solid)", marginLeft: 8 }}>
                      {items.length} calls
                    </span>
                  </div>
                  <div className="ec-grid">
                    {days.map((dn, di) => {
                      const bmo = items.filter(c => c.session === "BMO" && CALL_DATES[c.sym]?.weekDay === di);
                      const amc = items.filter(c => c.session === "AMC" && CALL_DATES[c.sym]?.weekDay === di);
                      const isToday = ecTab === "week" && di === 3; // Thursday Jun 25
                      const isSel   = di === selDayIdx;
                      return (
                        <div key={dn} className={`ec-day${isToday ? " is-today" : ""}${isSel && !isToday ? " is-sel" : ""}`}>
                          <div className="ec-dh">{dn}{isToday ? " · Today" : ""}</div>
                          <div className="ec-sess">
                            <div className="ec-lbl">Before open</div>
                            {bmo.length
                              ? bmo.map(c => <CallChip key={c.sym} entry={c} selected={selectedCall?.sym === c.sym} onSelect={setSelectedCall} />)
                              : <span className="ec-none">—</span>}
                          </div>
                          <div className="ec-sess">
                            <div className="ec-lbl">After close</div>
                            {amc.length
                              ? amc.map(c => <CallChip key={c.sym} entry={c} selected={selectedCall?.sym === c.sym} onSelect={setSelectedCall} />)
                              : <span className="ec-none">—</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            }

            if (isLMon) {
              const items = ecCalFor("lmonth");
              return (
                <>
                  <div style={{ fontSize: ".8rem", fontWeight: 700, color: "var(--text-hi)", marginBottom: 10 }}>
                    May 2026 · earnings calls recap
                    <span className="pill" style={{ background: "var(--surface-3)", color: "var(--text-dim-solid)", marginLeft: 8 }}>
                      {items.length} calls
                    </span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {items.map(c => <CallChip key={c.sym} entry={c} selected={selectedCall?.sym === c.sym} onSelect={setSelectedCall} />)}
                  </div>
                </>
              );
            }

            if (isMon) {
              const M1 = 6; // June (1-based)
              const Y  = 2026, M0 = M1 - 1; // 0-based for Date
              const first = new Date(Y, M0, 1).getDay();
              const days  = new Date(Y, M0 + 1, 0).getDate();
              const map   = ecMonthMap(M1);
              const todayMark = 25; // Jun 25
              return (
                <div className="ecm-wrap" style={{ marginTop: 0 }}>
                  <div className="ecm-monthbar">
                    <div />
                    <div className="ecm-month">June 2026 · earnings calls</div>
                    <div />
                  </div>
                  <div className="ecm-head">
                    {EC_DOWS.map(d => <div key={d}>{d}</div>)}
                  </div>
                  <div className="ecm-grid">
                    {Array.from({ length: first }, (_, i) => (
                      <div key={`e${i}`} className="ecm-cell ecm-empty" />
                    ))}
                    {Array.from({ length: days }, (_, i) => {
                      const d   = i + 1;
                      const lst = map[d] ?? [];
                      const isT = d === todayMark;
                      const isSel = d === ecMonthDay;
                      const has   = lst.length > 0;
                      return (
                        <div
                          key={d}
                          className={`ecm-cell${has ? " has" : ""}${isT ? " is-today" : ""}${isSel ? " sel" : ""}`}
                          onClick={has ? () => { setEcMonthDay(d); setSelectedCall(lst[0]); } : undefined}
                        >
                          <div className="ecm-d">
                            {d}
                            {isT && <span className="ecm-t">Today</span>}
                          </div>
                          {lst.length > 0 && (
                            <>
                              <div className="ecm-logos">
                                {lst.slice(0, 3).map(c => (
                                  <span key={c.sym} className="ecm-logo" style={{ background: "#27314a", color: "#cdd6e6" }}>
                                    {c.sym[0]}
                                    <img
                                      src={`https://assets.parqet.com/logos/symbol/${c.sym}?format=png`}
                                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                                      alt=""
                                    />
                                  </span>
                                ))}
                                {lst.length > 3 && <span className="ecm-more">+{lst.length - 3}</span>}
                              </div>
                              <div className="ecm-n">{lst.length} call{lst.length > 1 ? "s" : ""}</div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {ecMonthDay && (
                    <div style={{ marginTop: 12 }}>
                      <div className="ec-lbl" style={{ marginBottom: 6 }}>Jun {ecMonthDay} · {(map[ecMonthDay] ?? []).length} call{(map[ecMonthDay] ?? []).length !== 1 ? "s" : ""}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {(map[ecMonthDay] ?? []).map(c => (
                          <CallChip key={c.sym} entry={c} selected={selectedCall?.sym === c.sym} onSelect={setSelectedCall} />
                        ))}
                      </div>
                    </div>
                  )}
                  {!ecMonthDay && (
                    <div style={{ marginTop: 10, color: "var(--text-dim-solid)", fontSize: ".82rem" }}>
                      Click a date with calls to see the companies.
                    </div>
                  )}
                </div>
              );
            }

            return null;
          })()}
        </div>
      </div>

      {/* Earnings call detail drawer */}
      {selectedCall && <CallDrawer call={selectedCall} onClose={() => setSelectedCall(null)} />}

      {/* Sliding stock detail drawer */}
      {selectedSym && (
        <>
          <div className="scrim" onClick={() => setSelectedSym(null)} />
          <div className="stock-side-drawer">
            <div className="drawer-h" style={{ paddingTop: 14, paddingBottom: 14 }}>
              <StockLogo sym={selectedSym} size={32} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "var(--f-display)", fontWeight: 700, fontSize: "1rem", color: "var(--text-hi)" }}>
                  {selectedSym} · Stock Details
                </div>
                <div style={{ fontSize: ".72rem", color: "var(--text-dim-solid)" }}>
                  Full analysis · chart · technicals · peers
                </div>
              </div>
              <button className="closebtn" onClick={() => setSelectedSym(null)}>✕</button>
            </div>
            <div className="drawer-b">
              <StockScreenEmbed initialSym={selectedSym} />
            </div>
          </div>
        </>
      )}
    </>
  );
}
