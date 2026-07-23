"use client";

import { useState } from "react";
import { useIQActions, ExpandBtn } from "../shell";
import { fmt, cls, sign, EarnQ, StockLogo, SampleBadge } from "../utils";
import { useCollection } from "../hooks/useCollection";
import { useFinancials } from "../hooks/useFinancials";
import { EarningsCalendar } from "./earnings-calendar";

/**
 * WHERE EVERY NUMBER ON THIS SCREEN COMES FROM
 *
 *   Identity, bio, market cap  `companies`       Polygon /v3/reference/tickers
 *   EPS estimate / actual      `earnings_events` FMP /stable/earnings-calendar
 *   10-quarter EPS history     `financials`      Polygon /vX/reference/financials
 *   Income statement           `financials`      same response as above
 *
 * FMP owns only the calendar — Polygon has no earnings-calendar product on this
 * plan, which is why earnings.job injects FmpService directly with no adapter.
 * Everything else here is Polygon, read from Firestore.
 *
 * This screen used to render `earnHistory()` and `earnIncome()` for its two
 * biggest panels: generators seeded on the ticker STRING and on market cap,
 * producing an identical 55%-gross / 22%-opex / 82%-net shape for every company
 * under hardcoded quarter labels — while the real Polygon quarters for those
 * same tickers sat unread in `financials`. Both generators are gone, along with
 * EARN_CAL (33 rows) and COMPANY_BIO (42 hand-written bios).
 *
 * What has NO vendor is now OMITTED rather than invented: session (BMO/AMC),
 * guidance, price reaction and implied move. FMP's calendar carries none of
 * them. The earnings-call drawer is still authored content and is badged.
 */
interface LiveEarningsDoc {
  id: string; ticker: string; date: string;
  epsEstimate: number | null; epsActual: number | null;
}

/**
 * Shown wherever `financials` has nothing for the selected ticker.
 *
 * Says WHY rather than going blank: financials.job walks 40 of ~241 tickers per
 * nightly run, so a given ticker refreshes roughly every 6 days and "not yet" is
 * a normal transient state, not an error worth acting on.
 */
function EarnEmpty({ what }: { what: string }) {
  return (
    <div style={{
      padding: "18px 14px", textAlign: "center",
      fontSize: ".76rem", color: "var(--text-dim-solid)",
      border: "1px dashed var(--border)", borderRadius: 8, margin: "8px 0",
    }}>
      {what} not available for this ticker yet.
      <div style={{ fontSize: ".68rem", marginTop: 4, opacity: 0.8 }}>
        Quarterly filings sync on a rolling nightly schedule.
      </div>
    </div>
  );
}

/** Polygon company profile via companies.job — 241/241 tickers carry these. */
interface CompanyDoc {
  id: string;
  ticker?: string;
  name?: string | null;
  description?: string | null;
  sector?: string | null;
  marketCap?: number | null;
}

// ── Types ────────────────────────────────────────────────────────────────────

interface IncRow  { c: string; rev: number; cogs: number; gp: number; opex: number; oi: number; ni: number; eps: number; }

// ── SVG Charts ───────────────────────────────────────────────────────────────

function EpsChart({ hist }: { hist: EarnQ[] }) {
  const d = [...hist].reverse();
  // Guarded in the component so every call site is covered at once. On an empty
  // array `Math.max(...[])` is -Infinity and `iw / n` divides by zero, so the
  // SVG would render with NaN coordinates — blank, and indistinguishable from a
  // chart that legitimately has no bars.
  if (d.length === 0) return <EarnEmpty what="EPS history" />;
  const W = 580, H = 210, PADL = 30, PADR = 18, PADT = 14, PADB = 30;
  const iw = W - PADL - PADR, ih = H - PADT - PADB;
  const allVals = d.flatMap(x => [x.e, x.a]);
  const maxE = Math.max(...allVals) * 1.15 || 1;
  const maxM = Math.max(1, ...d.map(x => Math.abs(x.mv)));
  const n = d.length, gw = iw / n, bw = gw * 0.28;

  const bars: React.ReactElement[] = [];
  const linePts: [number, number][] = [];
  const dots: React.ReactElement[] = [];
  const labels: React.ReactElement[] = [];

  d.forEach((x, i) => {
    const cx = PADL + gw * i + gw / 2;
    const eh = x.e / maxE * ih, ah = x.a / maxE * ih;
    const ex = cx - bw - 2, ax = cx + 2;
    bars.push(
      <rect key={`e${i}`} x={ex} y={PADT + ih - eh} width={bw} height={eh} rx={2} style={{ fill: "var(--surface-3)" }} />,
      <rect key={`a${i}`} x={ax} y={PADT + ih - ah} width={bw} height={ah} rx={2}
        style={{ fill: x.surp >= 0 ? "var(--up)" : "var(--down)" }} />,
    );
    const my = PADT + ih / 2 - (x.mv / maxM) * (ih / 2 - 8);
    linePts.push([cx, my]);
    dots.push(<circle key={`d${i}`} cx={cx} cy={my} r={2.6} style={{ fill: "var(--brand-2)" }} />);
    if (i % 2 === 0 || i === n - 1) {
      labels.push(
        <text key={`l${i}`} x={cx} y={H - 10} textAnchor="middle"
          style={{ fill: "var(--text-dim-solid)", fontSize: "0.5625rem" }}>
          {x.q.replace(" ", "'")}
        </text>
      );
    }
  });

  const linePath = linePts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, display: "block" }}>
      <line x1={PADL} y1={PADT + ih / 2} x2={W - PADR} y2={PADT + ih / 2}
        style={{ stroke: "var(--border)" }} strokeDasharray="3 3" />
      {bars}
      <path d={linePath} style={{ fill: "none", stroke: "var(--brand-2)", strokeWidth: 1.6 }} />
      {dots}
      {labels}
    </svg>
  );
}

function IncChart({ inc }: { inc: IncRow[] }) {
  const d = [...inc].reverse();
  if (d.length === 0) return <EarnEmpty what="Income statement" />;
  const W = 580, H = 200, PADL = 8, PADR = 8, PADT = 14, PADB = 26;
  const iw = W - PADL - PADR, ih = H - PADT - PADB;
  const max = Math.max(...d.map(x => x.rev)) * 1.12 || 1;
  const n = d.length, gw = iw / n, bw = gw * 0.18;

  type IncKey = "rev" | "gp" | "ni";
  const series: [IncKey, string][] = [
    ["rev", "var(--brand)"],
    ["gp",  "var(--ai)"],
    ["ni",  "var(--up)"],
  ];

  const bars: React.ReactElement[] = [];
  const labels: React.ReactElement[] = [];

  d.forEach((x, i) => {
    const gx = PADL + gw * i;
    series.forEach(([key, color], si) => {
      const v = x[key];
      const h = v / max * ih;
      const bx = gx + gw * 0.1 + si * (bw + 3);
      bars.push(
        <rect key={`${i}${si}`} x={bx} y={PADT + ih - h} width={bw} height={h} rx={2}
          style={{ fill: color }} />
      );
    });
    labels.push(
      <text key={`l${i}`} x={gx + gw / 2} y={H - 8} textAnchor="middle"
        style={{ fill: "var(--text-dim-solid)", fontSize: "0.5625rem" }}>
        {x.c.replace(" ", "'")}
      </text>
    );
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, display: "block" }}>
      {bars}{labels}
    </svg>
  );
}

// ── Earnings Calls data ──────────────────────────────────────────────────────

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



function CallDrawer({ call, onClose, playing, onTogglePlay, initialTab = "summary" }: {
  call: CallEntry; onClose: () => void; playing: boolean; onTogglePlay: () => void;
  initialTab?: "summary" | "transcript";
}) {
  const [activeTab, setActiveTab] = useState<"summary" | "transcript">(initialTab);

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
            {/* CALLS_DATA is 28 hand-authored calls — summaries, bullet points
                and transcripts. No transcript vendor is wired (FMP transcripts
                are paid, BENZINGA_API_KEY is blank), so unlike the panels above
                there is nothing real to swap in. Badged rather than deleted so
                the feature survives until a source is funded; remove the badge
                the moment one is. */}
            <div style={{ fontFamily: "var(--f-display)", fontWeight: 700, fontSize: "1rem", color: "var(--text-hi)" }}>
              {call.sym} · {call.name} <SampleBadge title="Call summaries and transcripts are illustrative — no transcript vendor is wired yet" />
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
              onClick={onTogglePlay}
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


// ── Main screen ───────────────────────────────────────────────────────────────

export function EarningsScreen() {
  const { openStockFull } = useIQActions();
  const { data: liveEarnings } = useCollection<LiveEarningsDoc>("earnings_events");
  const { data: companies } = useCollection<CompanyDoc>("companies");
  // The calendar owns the date; this screen only tracks which company the user
  // picked, since the detail card below is driven by it.
  const [sel, setSel] = useState<string>("AAPL");
  const [selectedCall,   setSelectedCall]   = useState<CallEntry | null>(null);
  const [playingCallSym, setPlayingCallSym] = useState<string | null>(null);
  const [cardPlaying,     setCardPlaying]     = useState<string | null>(null);
  const [aiModalSym,      setAiModalSym]      = useState<string | null>(null);


  // ── Detail section ────────────────────────────────────────────────────────

  // Identity + bio — Polygon company profile. This replaces a lookup chain that
  // ended in `calToEarning(EARN_CAL[0])`, i.e. AMD: any ticker outside the 8-row
  // mock and the 33-row EARN_CAL rendered AMD's name, sector, guidance and
  // reaction under the symbol the user had selected. The calendar above can
  // select ANY synced ticker, so that was reachable for most of the universe.
  const company = companies.find(c => (c.ticker ?? c.id) === sel);

  // EPS estimate/actual — FMP, the only source for these. Newest print first.
  const liveMatch = liveEarnings
    .filter(e => e.ticker === sel)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const epsEstimate = liveMatch?.epsEstimate ?? null;
  const epsActual = liveMatch?.epsActual ?? null;
  const hasLiveEps = epsEstimate != null || epsActual != null;

  // 10-quarter history + income statement — Polygon, via the same doc.
  const fin = useFinancials(sel);
  const hist = fin.epsHistory;
  const inc = fin.incomeRows;
  // `surp > 0` counted a beat; a quarter with no vendor estimate has surp === 0
  // and is genuinely UNKNOWN, so it must not land in either bucket. Only 6 of
  // 226 financials docs carry an epsEstimate today (the Finnhub backfill in
  // financials.job is rate-limited and its failure is swallowed), so `scored`
  // is usually 0 and the badge correctly hides rather than claiming 10/10.
  const scored = hist.filter(h => h.e !== h.a);
  const beats = scored.filter(h => h.surp > 0).length;

  const fmtB = (v: number) => v >= 1 ? `$${v.toFixed(2)}B` : `$${(v * 1000).toFixed(0)}M`;

  // Built only from figures we actually hold. The previous version asserted
  // "Guidance was maintained" for every company (the ternary's else-branch) and
  // "Options imply a ±X% move" from a hardcoded EARN_CAL field — with no
  // guidance feed and no options feed wired, both were assertions about a
  // company's quarter that nothing backed. Each clause below is now conditional
  // on its own data, so an unsourced sentence is absent rather than confident.
  const aiRead = (() => {
    const parts: string[] = [];
    if (epsActual != null && epsEstimate != null) {
      const beat = epsActual >= epsEstimate;
      parts.push(`${sel} ${beat ? "beat" : "missed"} consensus at $${epsActual.toFixed(2)} vs. $${epsEstimate.toFixed(2)} estimated.`);
    } else if (epsActual != null) {
      parts.push(`${sel} reported $${epsActual.toFixed(2)} EPS.`);
    } else if (epsEstimate != null) {
      parts.push(`${sel} is expected to report $${epsEstimate.toFixed(2)} EPS${liveMatch?.date ? ` on ${liveMatch.date}` : ""}.`);
    } else {
      parts.push(`No synced earnings print for ${sel}.`);
    }
    if (scored.length > 0) {
      parts.push(`Of the last ${scored.length} quarters with a published estimate, ${beats} beat.`);
    }
    // Year-over-year (4 quarters back), not sequential. Retail and hardware are
    // strongly seasonal — comparing Apple's March quarter to its holiday quarter
    // reports a 22.7% "fall" that is just the calendar. Falls back to sequential
    // only when fewer than 5 quarters are synced, and says which it used.
    const rows = fin.incomeRows;
    if (rows.length > 1) {
      const prior = rows.length > 4 ? rows[4] : rows[1];
      const basis = rows.length > 4 ? "year-over-year" : "quarter-over-quarter";
      if (prior.rev > 0) {
        const g = ((rows[0].rev - prior.rev) / Math.abs(prior.rev)) * 100;
        parts.push(`Revenue ${g >= 0 ? "grew" : "fell"} ${Math.abs(g).toFixed(1)}% ${basis} to ${fmtB(rows[0].rev)}.`);
      }
    }
    return parts.join(" ");
  })();

  return (
    <>
      {/* ── Calendar ───────────────────────────────────────────────────────
          Date-anchored Day/Week views. The eight fixed range tabs (Last Month …
          Month) are gone: they could only reach eight preset windows, so any
          other date was unreachable. Selecting a row drives the detail card
          below, which is what the old logo chips did. */}
      <EarningsCalendar selected={sel} onSelect={setSel} />

      {/* ── Selected company inline detail (below calendar, no drawer) ── */}
      {(
        <div className="card" style={{ marginTop: 14 }}>
          <div className="card-h">
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <StockLogo sym={sel} size={36} />
              <div>
                <span style={{ fontWeight: 700, color: "var(--text-hi)", fontSize: ".95rem" }}>{sel}</span>
                {(company?.name || company?.sector) && (
                  <span style={{ color: "var(--text-dim-solid)", fontSize: ".78rem", marginLeft: 8 }}>
                    {[company?.name, company?.sector].filter(Boolean).join(" · ")}
                  </span>
                )}
              </div>
              {/* The BMO/AMC pill is gone: FMP's earnings calendar has no session
                  field, so it was always read off the static EARN_CAL row — and
                  after the AMD fallback, often off the WRONG row. Finnhub's
                  /calendar/earnings does return an `hour`, so this can come back
                  as real data once earnings.job reads it. */}
              {hasLiveEps && (
                <span className="pill" style={{ background: "var(--surface-3)", color: "var(--up)" }}>live EPS · FMP</span>
              )}
              {/* Action buttons — inline, same row */}
              <div style={{ display: "flex", gap: 6, marginLeft: 4 }}>
              <button
                title={cardPlaying === sel ? "Pause earnings call" : "Play earnings call"}
                onClick={() => setCardPlaying(p => p === sel ? null : sel)}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  background: cardPlaying === sel ? "var(--brand-dim, rgba(99,102,241,.15))" : "var(--surface-2)",
                  border: `1px solid ${cardPlaying === sel ? "var(--brand-2)" : "var(--border-soft)"}`,
                  borderRadius: 8, padding: "5px 10px", cursor: "pointer",
                  color: cardPlaying === sel ? "var(--brand-2)" : "var(--text)", fontSize: ".75rem", fontWeight: 600,
                  transition: ".15s",
                }}
              >
                {cardPlaying === sel
                  ? <svg viewBox="0 0 24 24" width={12} height={12} fill="currentColor"><path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z"/></svg>
                  : <svg viewBox="0 0 24 24" width={12} height={12} fill="currentColor"><path d="M5 3l14 9-14 9V3z"/></svg>}
                Earnings call
              </button>
              <button
                title="AI earnings analysis"
                onClick={() => setAiModalSym(sel)}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  background: "var(--surface-2)", border: "1px solid var(--border-soft)",
                  borderRadius: 8, padding: "5px 10px", cursor: "pointer",
                  color: "var(--ai)", fontSize: ".75rem", fontWeight: 600,
                }}
              >
                <span style={{ fontSize: ".85rem", lineHeight: 1 }}>◆</span>
                AI analysis
              </button>
              </div>{/* end buttons */}
            </div>{/* end outer flex */}
          </div>{/* end card-h */}
          <div className="card-b" style={{ paddingTop: 10 }}>
            {/* The vendor's own business description, not a hand-written bio.
                COMPANY_BIO covered 42 tickers; `companies.description` covers
                241/241, so this is both real and broader. */}
            {company?.description && (
              <p style={{ fontSize: ".82rem", color: "var(--text)", lineHeight: 1.6, marginBottom: 14, marginTop: 0 }}>
                {company.description}
              </p>
            )}
            {/* Was four tiles; Guidance and Reaction/Implied-move are gone.
                Neither had a vendor: guidance needs a transcript feed and the
                implied move needs an options feed, so both rendered EARN_CAL
                constants. A specific "Raised" or "±5.2%" reads as a filed fact,
                which is exactly the kind of claim a "—" cannot walk back. The
                two that remain are FMP, plus market cap from Polygon. */}
            <div className="metric-grid" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 12 }}>
              <div className="m">
                <div className="k">EPS estimate</div>
                <div className="v">{epsEstimate != null ? `$${epsEstimate.toFixed(2)}` : "—"}</div>
              </div>
              <div className="m">
                <div className="k">EPS actual</div>
                {epsActual != null
                  ? <div className={`v ${epsEstimate != null && epsActual >= epsEstimate ? "up" : "down"}`}>${epsActual.toFixed(2)}</div>
                  : <div className="v" style={{ color: "var(--text-dim-solid)" }}>Pending</div>}
              </div>
              <div className="m">
                <div className="k">Market cap</div>
                <div className="v">{company?.marketCap != null ? fmtB(company.marketCap / 1e9) : "—"}</div>
              </div>
            </div>
            <p style={{ fontSize: ".82rem", color: "var(--text-dim-solid)", margin: 0 }}>{aiRead}</p>
          </div>
        </div>
      )}


      {/* ── Detail: EPS history + Income statement ─────────────────────── */}
      <div className="dash" style={{ marginTop: 16 }}>
        {/* col-6: 10-quarter EPS history */}
        <div className="col-6">
          <div className="card">
            <div className="card-h">
              {/* Says how many quarters we actually hold, not a fixed 10. */}
              <h3>{sel} · {hist.length ? `${hist.length}-quarter` : "Quarterly"} earnings history</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {/* Only quarters with a real vendor estimate can be scored, so
                    the denominator is `scored.length`. The old badge divided by
                    a hardcoded 10 and, once the generator was removed, would
                    have read "10/10 beats" for almost every ticker — because a
                    quarter with no estimate has surprise 0, which `>= 0` counted
                    as a beat. No estimates means no badge. */}
                {scored.length > 0 && (
                  <span
                    className={`pill ${beats / scored.length >= 0.7 ? "up" : beats / scored.length < 0.5 ? "dn" : ""}`}
                    style={beats / scored.length >= 0.5 && beats / scored.length < 0.7
                      ? { background: "var(--surface-3)", color: "var(--text-dim-solid)" } : undefined}
                  >
                    {beats}/{scored.length} beats
                  </span>
                )}
                {hist.length > 0 && (
                  <ExpandBtn title={`${sel} · earnings history`} node={<EpsChart hist={hist} />} />
                )}
              </div>
            </div>
            <div className="card-b" style={{ paddingTop: 8 }}>
              <div className="ec-legend">
                <span><i style={{ background: "var(--surface-3)" }} /> EPS estimate</span>
                <span><i style={{ background: "var(--up)" }} /> Beat</span>
                <span><i style={{ background: "var(--down)" }} /> Miss</span>
                <span><i className="ln" style={{ background: "var(--brand-2)" }} /> Stock move %</span>
              </div>
              <EpsChart hist={hist} />
              <details className="ec-det">
                <summary>Show quarterly table</summary>
                <div style={{ overflowX: "auto", marginTop: 8 }}>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Quarter</th>
                        <th className="num">EPS est</th>
                        <th className="num">EPS act</th>
                        <th className="num">Surprise</th>
                        <th className="num">Stock move</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hist.map(h => (
                        <tr key={h.q}>
                          <td><b style={{ color: "var(--text-hi)" }}>{h.q}</b></td>
                          <td className="num">${h.e.toFixed(2)}</td>
                          <td className="num">${h.a.toFixed(2)}</td>
                          <td className={`num ${cls(h.surp)}`}>{sign(h.surp)}</td>
                          <td className={`num ${cls(h.mv)}`}>{sign(h.mv)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          </div>
        </div>

        {/* col-6: Income statement */}
        <div className="col-6">
          <div className="card">
            <div className="card-h">
              <h3>{sel} · Income statement</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="pill" style={{ background: "var(--surface-3)", color: "var(--text-dim-solid)" }}>Quarterly</span>
                <ExpandBtn title={`${sel} · Income statement`} node={<IncChart inc={inc} />} />
              </div>
            </div>
            <div className="card-b" style={{ paddingTop: 8 }}>
              <div className="ec-legend">
                <span><i style={{ background: "var(--brand)" }} /> Revenue</span>
                <span><i style={{ background: "var(--ai)" }} /> Gross profit</span>
                <span><i style={{ background: "var(--up)" }} /> Net income</span>
              </div>
              <IncChart inc={inc} />
              <details className="ec-det">
                <summary>Show statement table</summary>
                <div style={{ overflowX: "auto", marginTop: 8 }}>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Item</th>
                        {inc.map(c => <th key={c.c} className="num">{c.c}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        [
                          ["Revenue",            "rev",  true ],
                          ["Cost of revenue",    "cogs", false],
                          ["Gross profit",       "gp",   true ],
                          ["Operating expenses", "opex", false],
                          ["Operating income",   "oi",   true ],
                          ["Net income",         "ni",   true ],
                          ["Diluted EPS",        "eps",  false],
                        ] as [string, keyof IncRow, boolean][]
                      ).map(([lbl, key, bold]) => (
                        <tr key={lbl}>
                          <td style={bold ? { fontWeight: 700, color: "var(--text-hi)" } : undefined}>{lbl}</td>
                          {inc.map(c => (
                            <td key={c.c} className="num"
                              style={bold ? { fontWeight: 700, color: "var(--text-hi)" } : undefined}>
                              {key === "eps" ? `$${(c[key] as number).toFixed(2)}` : fmtB(c[key] as number)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          </div>
        </div>
      </div>

      {/* ── AI earnings read ──────────────────────────────────────────────── */}
      <div className="ai-block" style={{ marginTop: 2 }}>
        <div className="card-h">
          <h3 className="ai-c">◆ AI earnings read · {sel}</h3>
        </div>
        <div className="card-b">
          {/* The beats clause now lives inside `aiRead`, conditioned on quarters
              that actually have a vendor estimate. The "average post-print move"
              sentence is gone with `avgMv`: it averaged EarnQ.mv, which
              useFinancials sets to a literal 0 because no synced field carries a
              price reaction — so it always described a 0.0% average move as
              though it were measured. Computing it for real needs a bar lookup
              per quarter (close after the print vs. prior close) and belongs in
              a backend field, not here. */}
          <p style={{ fontSize: ".85rem", lineHeight: 1.6, color: "var(--text)" }}>
            {aiRead}{" "}
            <button className="btn" style={{ marginLeft: 8, padding: "4px 10px" }}
              onClick={() => openStockFull(sel)}>
              Open full stock page →
            </button>
          </p>
        </div>
      </div>


      {/* Earnings call detail drawer */}
      {selectedCall && (
        <CallDrawer
          call={selectedCall}
          onClose={() => setSelectedCall(null)}
          playing={playingCallSym === selectedCall.sym}
          onTogglePlay={() => setPlayingCallSym(p => p === selectedCall.sym ? null : selectedCall.sym)}
          initialTab="summary"
        />
      )}

      {/* AI analysis modal */}
      {aiModalSym && (() => {
        const call = CALLS_DATA.find(c => c.sym === aiModalSym);
        return (
          <>
            <div className="scrim" style={{ zIndex: 60 }} onClick={() => setAiModalSym(null)} />
            <div style={{
              position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
              background: "var(--surface-1)", border: "1px solid var(--border)",
              borderRadius: "var(--r-lg)", zIndex: 61, width: "min(520px, 92vw)",
              boxShadow: "0 20px 60px rgba(0,0,0,.5)",
            }}>
              {/* Modal header */}
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "14px 16px", borderBottom: "1px solid var(--border-soft)",
              }}>
                <span style={{ color: "var(--ai)", fontSize: "1rem", lineHeight: 1 }}>◆</span>
                {/* Same CALLS_DATA as the drawer — authored, not generated by a
                    model. ANTHROPIC_API_KEY is provisioned but nothing calls it. */}
                <span style={{ fontWeight: 700, fontSize: ".95rem", color: "var(--text-hi)", flex: 1 }}>
                  AI Analysis · {aiModalSym} <SampleBadge title="Authored analysis — no model is called for this yet" />
                </span>
                <button className="closebtn" onClick={() => setAiModalSym(null)}>✕</button>
              </div>
              {/* Modal body */}
              <div style={{ padding: "16px 18px 20px" }}>
                {call ? (
                  <>
                    <div style={{ fontSize: ".72rem", color: "var(--ai)", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 10 }}>
                      {call.title} · {call.callDate}
                    </div>
                    <p style={{ fontSize: ".88rem", lineHeight: 1.65, color: "var(--text)", margin: "0 0 14px" }}>
                      {call.summary}
                    </p>
                    {call.points && call.points.length > 0 && (
                      <>
                        <div style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 8 }}>
                          Key takeaways
                        </div>
                        <ul style={{ margin: 0, padding: "0 0 0 16px", display: "flex", flexDirection: "column", gap: 6 }}>
                          {call.points.map((pt, i) => (
                            <li key={i} style={{ fontSize: ".83rem", color: "var(--text)", lineHeight: 1.5 }}>{pt}</li>
                          ))}
                        </ul>
                      </>
                    )}
                    <div style={{ marginTop: 16, fontSize: ".72rem", color: "var(--text-dim-solid)", fontStyle: "italic" }}>
                      AI-generated summary based on earnings call transcript. Full transcript integration coming soon.
                    </div>
                  </>
                ) : (
                  <p style={{ fontSize: ".88rem", color: "var(--text-dim-solid)", margin: 0 }}>
                    No AI analysis available for {aiModalSym} yet.
                  </p>
                )}
              </div>
            </div>
          </>
        );
      })()}
    </>
  );
}
