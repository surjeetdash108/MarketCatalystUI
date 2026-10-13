import { StockItem, DetailStock, SITab, UpcomingEvent } from "./types";

export const UP = "#4ade80";
export const DN = "#f05656";
export const STEEL = "#7fa8d0";

export const TABS: [SITab, string][] = [
  ["overview", "OVERVIEW"],
  ["moved", "WHY IT MOVED"],
  ["could", "WHY IT COULD MOVE"],
  ["fund", "FUNDAMENTALS"],
  ["tech", "TECHNICALS"],
  ["cat", "CATALYSTS"],
  ["ai", "AI RESEARCH"],
  ["lab", "THESIS LAB"],
  ["mon", "THESIS MONITOR"],
];

export const LG_COL: Record<string, [string, string]> = {
  NVDA: ["#76b900", "#fff"],
  AAPL: ["#f4f4f4", "#111"],
  MSFT: ["#f4f4f4", "#f25022"],
  AVGO: ["#f4f4f4", "#cc092f"],
  GOOGL: ["#f4f4f4", "#4285f4"],
  AMZN: ["#ff9900", "#111"],
  META: ["#0866ff", "#fff"],
  TSLA: ["#e31937", "#fff"],
  AMD: ["#141414", "#fff"],
  TSM: ["#c4161c", "#fff"],
  MU: ["#0b3d91", "#fff"],
  PLTR: ["#141414", "#fff"],
  INTC: ["#0068b5", "#fff"],
  QCOM: ["#3253dc", "#fff"],
  ARM: ["#0091bd", "#fff"],
  SNOW: ["#29b5e8", "#fff"],
  CRWD: ["#e3171b", "#fff"],
  NOW: ["#1f3a3a", "#81b5a1"],
  ORCL: ["#f80000", "#fff"],
  STRL: ["#1e3a8a", "#fff"],
};

export function LG(t: string) {
  const c = LG_COL[t] || ["#2a3a4a", "#e8eef4"];
  return {
    bg: c[0],
    fg: c[1],
    lbl: t.slice(0, t.length > 3 ? 2 : 1),
  };
}

export const KEYS = [
  "Momentum",
  "Volume",
  "Relative Strength",
  "Sector",
  "News",
  "Options",
  "Market Regime",
];

export const STK: Record<string, StockItem> = {
  NVDA: { t: "NVDA", name: "NVIDIA Corporation", p: 183.42, c: 3.21, setup: "AI Momentum", cf: 4, conf: 87, sig: ["Unusual volume", "Semiconductor strength", "Breakout", "Positive catalyst"], mcap: "$4.47T", pe: 52.4, fpe: 33.1, rev: 62.4, eps: 59.1, hi: 195.62, lo: 108.13, sector: "Semiconductor", lbg: "#76b900", lfg: "#fff" },
  AMD: { t: "AMD", name: "Advanced Micro Devices", p: 168.30, c: 2.84, setup: "Breakout", cf: 4, conf: 81, sig: ["Range breakout", "Volume expansion", "Sector tailwind", "Analyst upgrade"], mcap: "$272B", pe: 98.6, fpe: 31.2, rev: 31.7, eps: 42.0, hi: 186.65, lo: 76.48, sector: "Semiconductor", lbg: "#141414", lfg: "#fff" },
  MU: { t: "MU", name: "Micron Technology", p: 132.75, c: 4.12, setup: "Earnings Run-up", cf: 4, conf: 79, sig: ["HBM demand", "Unusual volume", "Estimate revisions ↑", "Sector strength"], mcap: "$148B", pe: 24.1, fpe: 9.8, rev: 61.6, eps: 84.2, hi: 157.50, lo: 65.20, sector: "Semiconductor", lbg: "#0b3d91", lfg: "#fff" },
  AAPL: { t: "AAPL", name: "Apple Inc.", p: 246.80, c: -0.42, setup: "Range Consolidation", cf: 3, conf: 72, sig: ["Support hold", "Hardware upgrade cycle", "Low volatility", "Services growth"], mcap: "$3.74T", pe: 34.8, fpe: 31.5, rev: 6.8, eps: 12.4, hi: 250.00, lo: 164.08, sector: "Hardware / Tech", lbg: "#f4f4f4", lfg: "#111" },
  MSFT: { t: "MSFT", name: "Microsoft Corporation", p: 494.20, c: 0.61, setup: "Cloud Compounder", cf: 3, conf: 76, sig: ["Azure acceleration", "Copilot adoption", "Stable free cash flow", "Margin resilience"], mcap: "$3.67T", pe: 36.2, fpe: 30.8, rev: 15.3, eps: 17.8, hi: 512.40, lo: 388.00, sector: "Software / Cloud", lbg: "#f4f4f4", lfg: "#f25022" },
  META: { t: "META", name: "Meta Platforms, Inc.", p: 712.50, c: 1.42, setup: "Ad-Tech Leader", cf: 4, conf: 84, sig: ["Ad spend strength", "AI recommendation lift", "Reels monetization", "Buyback support"], mcap: "$1.81T", pe: 28.4, fpe: 23.6, rev: 22.1, eps: 29.4, hi: 738.00, lo: 450.00, sector: "Internet / Social", lbg: "#0866ff", lfg: "#fff" },
  GOOGL: { t: "GOOGL", name: "Alphabet Inc.", p: 202.10, c: 0.84, setup: "Search & Cloud", cf: 3, conf: 74, sig: ["Cloud profitability", "Search volume stable", "YouTube ad lift", "Hardware integration"], mcap: "$2.48T", pe: 24.6, fpe: 20.8, rev: 14.1, eps: 21.2, hi: 208.50, lo: 145.20, sector: "Internet / Search", lbg: "#f4f4f4", lfg: "#4285f4" },
  AMZN: { t: "AMZN", name: "Amazon.com, Inc.", p: 216.40, c: 0.92, setup: "Retail Margin Lift", cf: 4, conf: 80, sig: ["AWS growth re-acceleration", "Retail efficiency", "Advertising expansion", "North America profit jump"], mcap: "$2.28T", pe: 42.1, fpe: 32.4, rev: 11.8, eps: 38.6, hi: 232.00, lo: 166.00, sector: "E-Commerce / Cloud", lbg: "#ff9900", lfg: "#111" },
  TSLA: { t: "TSLA", name: "Tesla, Inc.", p: 238.60, c: -1.12, setup: "Volatile Pivot", cf: 2, conf: 58, sig: ["Support test ($225)", "Energy storage growth", "FSD progress", "Delivery estimate risk"], mcap: "$762B", pe: 72.8, fpe: 54.2, rev: 8.4, eps: -2.1, hi: 271.00, lo: 138.80, sector: "Automotive / Clean Energy", lbg: "#e31937", lfg: "#fff" },
  PLTR: { t: "PLTR", name: "Palantir Technologies", p: 134.10, c: 1.95, setup: "AIP Hyper-growth", cf: 4, conf: 82, sig: ["Commercial AIP demand", "Government contract pipeline", "Margin expansion", "S&P 500 inclusion"], mcap: "$302B", pe: 112.0, fpe: 86.4, rev: 41.2, eps: 52.8, hi: 145.00, lo: 21.00, sector: "Enterprise Software", lbg: "#141414", lfg: "#fff" },
  AVGO: { t: "AVGO", name: "Broadcom Inc.", p: 342.10, c: 2.06, setup: "Custom Silicon Leader", cf: 4, conf: 83, sig: ["Hyperscaler XPU ramps", "Tomahawk networking", "VMware synergy", "High dividend growth"], mcap: "$1.62T", pe: 38.4, fpe: 26.5, rev: 44.8, eps: 31.2, hi: 360.00, lo: 128.50, sector: "Semiconductor", lbg: "#f4f4f4", lfg: "#cc092f" },
  STRL: { t: "STRL", name: "Sterling Infrastructure", p: 501.19, c: -2.30, setup: "Data Center Infrastructure", cf: 4, conf: 78, sig: ["E-Infrastructure demand", "Data Center build-out", "Record backlog", "Margin expansion"], mcap: "$15.6B", pe: 31.4, fpe: 24.2, rev: 23.5, eps: 34.8, hi: 515.48, lo: 210.00, sector: "Industrial / Infrastructure", lbg: "#1e3a8a", lfg: "#fff" },
};

export const ORDER = Object.keys(STK);

export function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function rng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function usd(v: number): string {
  return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function pct(v: number): string {
  return (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2) + "%";
}

export function pct1(v: number): string {
  return (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(1) + "%";
}

export function sc(v: number): string {
  return v >= 65 ? UP : v <= 45 ? DN : STEEL;
}

export function series(seed: string, len: number, start: number, vol: number, trend: number): number[] {
  const r = rng(hash(seed));
  const out = [start];
  for (let i = 1; i < len; i++) {
    const prev = out[i - 1];
    const d = prev * (trend + (r() - 0.5) * vol * 2);
    out.push(Math.max(1, prev + d));
  }
  return out;
}

export function scoresFor(t: string): number[] {
  const s = STK[t] || getStock(t);
  const up = s.c >= 0;
  const base = up ? [84, 78, 88, 72, 70, 74, 68] : [42, 60, 36, 48, 52, 40, 58];
  const r = rng(hash(t));
  return base.map((b) => Math.round(Math.max(20, Math.min(95, b + (r() - 0.5) * 16))));
}

export const CATS_T: [string, string][] = [
  ["BUS", "Business / Fundamentals"],
  ["EARN", "Earnings / Estimate Revisions"],
  ["TECH", "Technical / Market"],
  ["CAT", "Catalysts"],
  ["VAL", "Valuation"],
  ["POS", "Positioning / Options"],
  ["MAC", "Macro / Market Regime"],
];

export const SHORT: Record<string, string> = {
  BUS: "BUSINESS",
  EARN: "EARNINGS",
  TECH: "TECHNICALS",
  CAT: "CATALYSTS",
  VAL: "VALUATION",
  POS: "FLOWS",
  MAC: "MACRO",
};

export const TP: Record<string, any> = {
  NVDA: {
    eps: [5.2, 6.4, 7.4],
    pe: [26, 36, 44],
    cons: 225,
    res: 195.6,
    sup: 172,
    sup2: 158,
    cat: "Q3 earnings · Nov 18",
    risk: "Export limits on China data-center sales",
    fi: ["Forward EPS estimates fall >10%", "Data Center growth slows below 60% y/y", "Gross-margin guide cut below 70%"],
    fiB: ["Forward EPS estimates rise >10%", "Data Center growth re-accelerates above 120% y/y"],
    d: [
      ["BUS", "Data Center revenue growth", "+112% y/y · 88% of sales", 92, "CK", 2],
      ["BUS", "Blackwell / Rubin backlog", "sold out into 2027", 88, "C", 1],
      ["BUS", "Gross margin trend", "74.8% · guide 73–75%", 78, "", -1],
      ["EARN", "Forward EPS revisions (90d)", "+14%", 90, "CK", 3],
      ["EARN", "Revenue estimate revisions (90d)", "+11%", 86, "C", 2],
      ["EARN", "Beat / raise record", "8 of 8 quarters", 84, "", 0],
      ["TECH", "Price vs 50- / 200-DMA", "above both", 86, "@trend", 1],
      ["TECH", "50-DMA slope", "rising", 82, "@trend", 0],
      ["TECH", "Relative strength vs SOX", "RS rank 94", 90, "C", 2],
      ["TECH", "RSI (14)", "63 · not overbought", 64, "@mom", -2],
      ["TECH", "Volume confirmation", "1.3× 20-day avg", 74, "", 4],
      ["CAT", "Q3 earnings · Nov 18", "high impact", 72, "", 0],
      ["CAT", "GTC DC · Rubin preview", "Oct 28", 70, "", 1],
      ["VAL", "Fwd P/E vs 5-yr avg", "33× vs 38×", 68, "", 0],
      ["VAL", "PEG ratio", "0.9", 72, "", 0],
      ["POS", "Options skew (30d)", "call-skewed", 68, "", 2],
      ["POS", "Institutional flow (13F)", "net +2.1% held", 74, "", 1],
      ["MAC", "Market regime", "risk-on · VIX 16", 72, "", 1],
      ["MAC", "Rates · 10Y trend", "easing", 62, "", 2],
    ],
  },
  AMD: {
    eps: [4.1, 5.6, 6.8],
    pe: [24, 32, 40],
    cons: 195,
    res: 186.65,
    sup: 155,
    sup2: 138,
    cat: "Q3 earnings · Oct 28",
    risk: "Premium valuation if the MI-series ramp slips",
    fi: ["Forward EPS estimates fall >10%", "Q4 Data Center guide below $5B", "Gross-margin guide below 52%"],
    fiB: ["Forward EPS estimates rise >10%", "Data Center guide above $6B"],
    d: [
      ["BUS", "AI / Data Center GPU growth", "MI350 ramp · DC +57% y/y", 84, "CK", 3],
      ["BUS", "Data Center share of sales", "48% (+9 pts y/y)", 78, "C", 1],
      ["BUS", "Gross margin trend", "53% · expanding", 70, "", 1],
      ["EARN", "Forward EPS revisions (90d)", "+9%", 80, "CK", 4],
      ["EARN", "Revenue estimate revisions (90d)", "+7%", 76, "C", 2],
      ["EARN", "Q4 guide vs consensus", "above street", 72, "", 0],
      ["TECH", "Range breakout", "above $160 shelf", 82, "@trend", 3],
      ["TECH", "Price vs 50- / 200-DMA", "above both", 80, "@trend", 2],
      ["TECH", "Semiconductor strength (SOX)", "SOX +4.1% 1M", 78, "", 1],
      ["TECH", "Relative strength vs SOX", "RS rank 86", 80, "C", 2],
      ["TECH", "Volume expansion", "1.6× avg", 76, "", 5],
      ["CAT", "Q3 earnings · Oct 28", "high impact", 70, "", 0],
      ["CAT", "Hyperscaler GPU deployments", "6 GW agreement", 78, "", 2],
      ["VAL", "Fwd P/E vs semis peers", "31× vs 30×", 52, "", 0],
      ["VAL", "EV / Sales vs 5-yr", "9.4× vs 7.1×", 44, "", -1],
      ["POS", "Options skew (30d)", "call-skewed", 66, "", 3],
      ["POS", "Short interest", "2.4% of float", 64, "", 0],
      ["MAC", "Market regime", "risk-on", 72, "", 1],
      ["MAC", "Rates · 10Y trend", "easing", 62, "", 2],
    ],
  },
  MU: {
    eps: [9, 13.5, 17],
    pe: [7, 10.5, 13],
    cons: 160,
    res: 157.5,
    sup: 120,
    sup2: 104,
    cat: "FQ1 earnings · Dec 17",
    risk: "Memory cycle peaks — DRAM pricing rolls over",
    fi: ["Forward EPS estimates fall >10%", "HBM pricing / mix guide cut", "DRAM contract prices turn negative q/q"],
    fiB: ["Forward EPS estimates rise >10%", "HBM supply sold out through 2027"],
    d: [
      ["BUS", "HBM revenue growth", "sold out through 2026", 90, "CK", 2],
      ["BUS", "DRAM / NAND pricing", "contract +12% q/q", 84, "C", 3],
      ["BUS", "Gross margin trajectory", "45% → 50%+ guide", 80, "", 2],
      ["EARN", "Forward EPS revisions (90d)", "+22%", 92, "CK", 5],
      ["EARN", "Revenue estimate revisions (90d)", "+15%", 86, "C", 3],
      ["EARN", "Guide vs consensus", "raised", 82, "", 0],
      ["TECH", "Price vs 50- / 200-DMA", "above both", 80, "@trend", 1],
      ["TECH", "50-DMA slope", "rising", 76, "@trend", 1],
      ["TECH", "Relative strength vs SOX", "RS rank 88", 82, "C", 2],
      ["TECH", "RSI (14)", "71 · stretched", 48, "@mom", -4],
      ["TECH", "Unusual volume", "2.1× avg", 78, "", 4],
      ["CAT", "FQ1 earnings · Dec 17", "high impact", 74, "", 0],
      ["CAT", "Monthly memory pricing", "next: Nov 3", 70, "", 1],
      ["VAL", "Fwd P/E vs cycle avg", "9.8× vs 11×", 78, "", 0],
      ["VAL", "P / Book vs peak-cycle", "2.6× vs 3.0×", 64, "", 0],
      ["POS", "Options skew (30d)", "call-skewed", 70, "", 2],
      ["POS", "Institutional flow (13F)", "net adds", 72, "", 1],
      ["MAC", "Market regime", "risk-on", 72, "", 1],
      ["MAC", "Cycle / PMI trend", "expanding", 60, "", 1],
    ],
  },
  PLTR: {
    eps: [0.55, 0.72, 0.9],
    pe: [150, 210, 260],
    cons: 150,
    res: 190,
    sup: 140,
    sup2: 118,
    cat: "Q3 earnings · Nov 3",
    risk: "Extreme valuation — any growth miss compresses the multiple",
    fi: ["Forward EPS estimates fall >10%", "US commercial growth below 50% y/y", "Net dollar retention below 115%"],
    fiB: ["US commercial growth above 100% y/y", "Forward EPS estimates rise >15%"],
    d: [
      ["BUS", "US commercial revenue growth", "+93% y/y", 88, "CK", 1],
      ["BUS", "AIP customer count", "+45% y/y", 82, "C", 0],
      ["BUS", "Net dollar retention", "128%", 78, "", 0],
      ["EARN", "Forward EPS revisions (90d)", "+6%", 70, "CK", -2],
      ["EARN", "Revenue estimate revisions (90d)", "+5%", 68, "C", -1],
      ["EARN", "Rule of 40 score", "94", 86, "", 0],
      ["TECH", "Higher highs / higher lows", "intact", 72, "@trend", -3],
      ["TECH", "Price vs 50-DMA", "above, narrowing", 62, "@trend", -4],
      ["TECH", "Relative strength vs IGV", "RS rank 78", 70, "C", -3],
      ["TECH", "RSI (14)", "58", 56, "@mom", -3],
      ["CAT", "Q3 earnings · Nov 3", "high impact", 66, "", 0],
      ["CAT", "Government contract awards", "Army enterprise deal", 72, "", 0],
      ["VAL", "EV / Sales vs software", "72× vs 9×", 18, "", 0],
      ["VAL", "Fwd P/E", "214×", 22, "", 0],
      ["POS", "Institutional accumulation", "net adds", 70, "", -1],
      ["POS", "Retail / options heat", "elevated", 46, "", -2],
      ["MAC", "Market regime", "risk-on", 72, "", 1],
      ["MAC", "Rates · 10Y trend", "easing", 60, "", 2],
    ],
  },
  TSLA: {
    eps: [1.6, 2.4, 3.4],
    pe: [80, 105, 140],
    cons: 270,
    res: 290,
    sup: 225,
    sup2: 214,
    cat: "Q4 delivery report · Jan 2",
    risk: "Deliveries and estimate revisions are still falling",
    fi: ["Forward EPS estimates fall a further >10%", "Q4 deliveries below 400k", "Auto gross margin below 14%"],
    fiB: ["Deliveries return to y/y growth", "Forward EPS revisions turn positive"],
    d: [
      ["BUS", "Auto deliveries growth", "−9% y/y", 28, "CK", -3],
      ["BUS", "Auto gross margin ex-credits", "15.4% · falling", 32, "C", -2],
      ["BUS", "Energy storage growth", "+59% y/y", 80, "", 2],
      ["BUS", "Robotaxi / FSD progress", "Austin pilot expanding", 62, "", 3],
      ["EARN", "Forward EPS revisions (90d)", "−11%", 22, "CK", -4],
      ["EARN", "Revenue estimate revisions (90d)", "−4%", 36, "C", -1],
      ["TECH", "Price vs 200-DMA", "below", 34, "@trend", -2],
      ["TECH", "Support test", "holding $225", 58, "", 2],
      ["TECH", "RSI (14)", "31 · oversold", 64, "@mom", 4],
      ["TECH", "Relative strength vs S&P", "RS rank 22", 26, "C", -2],
      ["CAT", "Q4 delivery report · Jan 2", "high impact", 55, "", 0],
      ["CAT", "Robotaxi network launch", "2026 target", 64, "", 1],
      ["VAL", "Fwd P/E vs auto peers", "118× vs 7×", 20, "", 0],
      ["VAL", "EV / Sales", "9.8×", 30, "", 0],
      ["POS", "Options skew (30d)", "put-skewed", 38, "", -1],
      ["POS", "Short interest", "2.9% of float", 52, "", 0],
      ["MAC", "Market regime", "risk-on", 70, "", 1],
      ["MAC", "Consumer / EV demand", "soft", 38, "", -1],
    ],
  },
  AVGO: {
    eps: [8.2, 9.6, 11],
    pe: [28, 37, 44],
    cons: 385,
    res: 356.4,
    sup: 318,
    sup2: 290,
    cat: "FQ4 earnings · Dec 11",
    risk: "Customer concentration in custom AI silicon",
    fi: ["Forward EPS estimates fall >10%", "AI revenue guide below $7B", "Loss of a hyperscaler XPU program"],
    fiB: ["AI revenue guide above $10B", "Forward EPS estimates rise >10%"],
    d: [
      ["BUS", "Custom AI accelerator (XPU) revenue", "+63% y/y", 90, "CK", 2],
      ["BUS", "AI networking demand", "Tomahawk 6 ramp", 84, "C", 1],
      ["BUS", "VMware software margin", "76% op. margin", 80, "", 0],
      ["EARN", "Forward EPS revisions (90d)", "+8%", 82, "CK", 2],
      ["EARN", "Revenue estimate revisions (90d)", "+9%", 84, "C", 2],
      ["EARN", "AI revenue guide vs consensus", "above", 80, "", 1],
      ["TECH", "Breakout retest", "held $330", 80, "@trend", 2],
      ["TECH", "Price vs 50- / 200-DMA", "above both", 82, "@trend", 1],
      ["TECH", "Relative strength vs SOX", "RS rank 91", 88, "C", 1],
      ["TECH", "RSI (14)", "66", 60, "@mom", -1],
      ["CAT", "FQ4 earnings · Dec 11", "high impact", 72, "", 0],
      ["CAT", "New hyperscaler XPU win", "4th customer ramp", 76, "", 1],
      ["VAL", "Fwd P/E vs 5-yr avg", "37× vs 26×", 40, "", 0],
      ["VAL", "FCF yield", "2.1%", 54, "", 0],
      ["POS", "Options skew (30d)", "neutral → call", 62, "", 1],
      ["POS", "Institutional flow (13F)", "net adds", 72, "", 0],
      ["MAC", "Market regime", "risk-on", 72, "", 1],
      ["MAC", "Rates · 10Y trend", "easing", 62, "", 2],
    ],
  },
  STRL: {
    eps: [12.4, 15.6, 18.2],
    pe: [24, 31, 38],
    cons: 540,
    res: 515.5,
    sup: 468,
    sup2: 420,
    cat: "Q3 earnings · Nov 04",
    risk: "Hyperscaler data center buildout capex slowdown",
    fi: ["E-Infrastructure backlog growth falls below 15% y/y", "Data center bidding margins compress below 14%", "Close below 50-day moving average"],
    fiB: ["Data center pipeline awards accelerate > 35% y/y", "EPS estimates raised > 10%"],
    d: [
      ["BUS", "Data center E-Infrastructure backlog", "Record $2.4B backlog (+28% y/y)", 92, "CK", 3],
      ["BUS", "Operating margin trend", "18.2% · expanding on mix", 86, "C", 2],
      ["BUS", "Building Solutions growth", "+18% organic growth", 80, "", 1],
      ["EARN", "Forward EPS revisions (90d)", "+16% upward revisions", 90, "CK", 4],
      ["EARN", "Beat / raise consistency", "7 consecutive quarters", 88, "C", 2],
      ["TECH", "Price vs 50- / 200-DMA", "Above both moving averages", 86, "@trend", 1],
      ["TECH", "50-DMA slope", "Rising steeply", 84, "@trend", 0],
      ["TECH", "Relative strength vs S&P 500", "RS rank 96", 92, "C", 2],
      ["TECH", "Volume confirmation", "1.4× 20-day average", 76, "", 3],
      ["CAT", "Q3 earnings · Nov 04", "high impact", 74, "", 0],
      ["VAL", "Forward P/E vs 5-yr avg", "24× vs 18× (growth justified)", 66, "", 0],
      ["POS", "Institutional ownership trend", "+3.2% net accumulation", 76, "", 1],
      ["MAC", "Data Center Capex Cycle", "Secular hyperscaler AI buildout", 88, "", 2],
      ["MAC", "Infrastructure Bill / Onshoring", "Strong public & private demand", 78, "", 1],
    ],
  },
};

export function getTP(t: string): any {
  const sym = t.toUpperCase().trim();
  if (TP[sym]) return TP[sym];
  const s = getStock(sym);
  const p = s.p;
  const res = +(p * 1.08).toFixed(2);
  const sup = +(p * 0.94).toFixed(2);
  const sup2 = +(p * 0.88).toFixed(2);
  const epsVal = +(p / Math.max(10, s.fpe)).toFixed(2);
  return {
    eps: [+(epsVal * 0.8).toFixed(2), epsVal, +(epsVal * 1.25).toFixed(2)],
    pe: [+(s.fpe * 0.8).toFixed(1), +s.fpe.toFixed(1), +(s.fpe * 1.25).toFixed(1)],
    cons: +(p * 1.15).toFixed(2),
    res,
    sup,
    sup2,
    cat: `Next earnings report · ${sym}`,
    risk: "Valuation multiple compression or macroeconomic rotation",
    fi: ["Forward EPS estimates cut >10%", "Revenue growth decelerates below peer median", "Daily close below 50-day moving average"],
    fiB: ["Forward EPS estimates raised >10%", "Revenue acceleration exceeds upper guidance range"],
    d: [
      ["BUS", "Top-line revenue expansion", `+${pct1(s.rev)} y/y`, Math.min(95, Math.max(30, s.conf + 4)), "CK", 2],
      ["BUS", "Operating margin trend", "High cash generation", Math.min(90, Math.max(35, s.conf)), "C", 1],
      ["BUS", "Industry market share", "Market leadership in sector", Math.min(90, Math.max(35, s.conf - 2)), "", 0],
      ["EARN", "Forward EPS revisions", "+9% over last 90 days", Math.min(95, Math.max(30, s.conf + 5)), "CK", 3],
      ["EARN", "Beat / raise consistency", "Positive track record", Math.min(90, Math.max(35, s.conf + 1)), "C", 1],
      ["TECH", "Price vs 50- & 200-DMA", s.c >= 0 ? "Above both key averages" : "Testing support shelf", s.c >= 0 ? 84 : 46, "@trend", 1],
      ["TECH", "Relative strength", `RS rank ${Math.min(98, Math.max(25, s.conf + 8))}`, Math.min(96, Math.max(30, s.conf)), "C", 2],
      ["TECH", "Volume confirmation", "1.3× 20-day average volume", 74, "", 3],
      ["CAT", "Upcoming catalyst", "High market impact", 72, "", 0],
      ["VAL", "Valuation multiple", `${s.fpe}× forward P/E`, Math.max(25, Math.min(85, Math.round(110 - s.fpe * 1.1))), "", 0],
      ["POS", "Institutional positioning", "Net accumulation", 72, "", 1],
      ["MAC", "Market regime", "Constructive backdrop", 70, "", 1],
    ],
  };
}

export function getStock(t: string, live?: { price?: number; change?: number; name?: string; sector?: string; mcap?: number }): StockItem {
  const sym = t.toUpperCase().trim();
  if (STK[sym]) {
    const item = { ...STK[sym], t: sym };
    if (live?.price != null && live.price > 0) item.p = live.price;
    if (live?.change != null) item.c = live.change;
    return item;
  }
  const r = rng(hash(sym));
  const p = live?.price ?? +(80 + r() * 150).toFixed(2);
  const c = live?.change ?? +((r() - 0.48) * 5).toFixed(2);
  const up = c >= 0;
  return {
    t: sym,
    name: live?.name || `${sym} Corporation`,
    p,
    c,
    setup: up ? "Bullish Trend" : "Mean Reversion",
    cf: up ? 4 : 2,
    conf: up ? Math.round(75 + r() * 15) : Math.round(55 + r() * 15),
    sig: up ? ["Unusual volume", "Sector momentum", "Trend continuation"] : ["Support test", "Consolidation", "Oversold bounce"],
    mcap: live?.mcap ? `$${(live.mcap / 1e9).toFixed(1)}B` : `$${Math.round(15 + r() * 120)}B`,
    pe: +(20 + r() * 40).toFixed(1),
    fpe: +(16 + r() * 30).toFixed(1),
    rev: +(10 + r() * 35).toFixed(1),
    eps: +(12 + r() * 40).toFixed(1),
    hi: +(p * (1.1 + r() * 0.25)).toFixed(2),
    lo: +(p * (0.7 + r() * 0.15)).toFixed(2),
    sector: live?.sector || "Technology",
    lbg: LG_COL[sym]?.[0] || "#1e3a8a",
    lfg: LG_COL[sym]?.[1] || "#ffffff",
  };
}

export function thesisWeights(dir: "Bull" | "Bear", hz: string) {
  let w: Record<string, number> =
    hz === "1M"
      ? { BUS: 10, EARN: 15, TECH: 30, CAT: 20, VAL: 5, POS: 10, MAC: 10 }
      : hz === "12M"
        ? { BUS: 30, EARN: 20, TECH: 10, CAT: 5, VAL: 20, POS: 5, MAC: 10 }
        : { BUS: 25, EARN: 20, TECH: 20, CAT: 10, VAL: 10, POS: 5, MAC: 10 };
  w = { ...w };
  if (dir === "Bear") {
    w.VAL += 5;
    w.MAC += 5;
    w.BUS -= 5;
    w.TECH -= 5;
  }
  return w;
}

export function normW(o: Record<string, number>) {
  const s = Object.values(o).reduce((a, b) => a + b, 0) || 1;
  const w: Record<string, number> = {};
  Object.keys(o).forEach((k) => {
    w[k] = (o[k] / s) * 100;
  });
  return w;
}

export const CAT_KINDS = [
  "All",
  "Earnings",
  "Analyst actions",
  "Product launches",
  "Industry events",
  "Regulatory",
  "Macro",
  "News",
  "Insider activity",
  "13F filings",
];

export function thesisRun(t: string, dir: "Bull" | "Bear", hz: string, adj?: any, wO?: any) {
  const sym = t.toUpperCase().trim();
  const P = getTP(sym);
  const W = wO ? normW(wO) : thesisWeights(dir, hz);
  const bull = dir === "Bull";
  const drv = P.d.map(([cat, name, val, scVal, fl, dd]: any) => {
    const s2 = Math.max(0, Math.min(100, scVal + (adj ? adj(cat, name, fl, dd) : 0)));
    return {
      cat,
      name,
      val,
      sc: s2,
      ev: bull ? s2 : 100 - s2,
      core: fl.indexOf("C") >= 0,
      crit: fl.indexOf("K") >= 0,
      grp: fl.split("@")[1] || null,
      dd: bull ? dd : -dd,
    };
  });
  let conf = 0;
  const cats = CATS_T.map(([k, label]) => {
    const ds = drv.filter((d: any) => d.cat === k);
    const slots: Record<string, any[]> = {};
    ds.forEach((d: any) => {
      const key = d.grp || d.name;
      (slots[key] = slots[key] || []).push(d);
    });
    let sw = 0,
      sv = 0;
    const sl = Object.values(slots).map((a) => {
      const w = a.some((d: any) => d.core) ? 2 : 1;
      const v = a.reduce((s: number, d: any) => s + d.ev, 0) / a.length;
      sw += w;
      sv += w * v;
      return { a, w };
    });
    const score = sw ? sv / sw : 50;
    const pts = (score * W[k]) / 100;
    conf += pts;
    sl.forEach(({ a, w }) =>
      a.forEach((d: any) => {
        d.share = (W[k] * (w / sw)) / a.length;
        d.pts = (d.share * d.ev) / 100;
        d.shared = a.length > 1;
      })
    );
    return { k, label, w: W[k], score, pts, ds };
  });
  const core = drv.filter((d: any) => d.core);
  const crit = drv.filter((d: any) => d.crit);
  return {
    drv,
    cats,
    conf,
    bull,
    W,
    core,
    coreOk: core.filter((d: any) => d.ev >= 55).length,
    critFail: crit.filter((d: any) => d.ev < 40),
    crit,
  };
}

const HZF: Record<string, number> = { "1M": 0.3, "3M": 0.55, "6M": 0.8, "12M": 1 };

export function thesisTargets(t: string, dir: "Bull" | "Bear", hz: string, run: any, p: number) {
  const sym = t.toUpperCase().trim();
  const P = getTP(sym);
  const f = HZF[hz] || 0.8;
  const bull = dir === "Bull";
  const earn = run.cats.find((c: any) => c.k === "EARN");
  const revAdj = Math.max(-0.08, Math.min(0.08, (earn.score - 50) / 600)) * (bull ? 1 : -1);
  const fund = P.eps[1] * P.pe[1];
  const mm = P.res + (P.res - P.sup);
  const base12 = (0.45 * fund + 0.35 * P.cons + 0.2 * mm) * (1 + revAdj);
  const bull12 = P.eps[2] * P.pe[2];
  const bear12 = P.eps[0] * P.pe[0];
  const at = (v: number) => p + (v - p) * f;
  const base = at(base12);
  const up = at(bull12);
  const dn = at(bear12);
  const target = bull ? base : Math.min((dn + base) / 2, p * 0.94);
  const lvl = hz === "12M" ? P.sup2 : P.sup;
  const stop = bull ? Math.min(lvl * 0.985, p * 0.95) : Math.max(P.res * 1.015, p * 1.05);
  const src: [string, string, number][] = [
    ["EPS × historical P/E", P.eps[1].toFixed(2) + " × " + P.pe[1] + "×", fund],
    ["Analyst consensus PT", "mean of 40+ analysts", P.cons],
    ["Technical measured move", usd(P.res) + " resistance + range", mm],
  ];
  return { target, stop, base, up, dn, src, revAdj, lvl, f };
}

export function fundSeries(t: string): number[][] {
  const sym = t.toUpperCase().trim();
  if (sym === "NVDA") {
    return [
      [26.0, 30.0, 35.1, 39.3, 44.1, 46.7, 51.2, 57.0],
      [0.60, 0.68, 0.81, 0.89, 0.96, 1.05, 1.12, 1.24],
      [78.4, 75.1, 74.6, 73.0, 61.0, 72.4, 73.5, 74.8],
      [15.1, 13.5, 16.8, 15.6, 26.1, 13.5, 22.0, 24.6],
      [69, 74, 78, 82, 79, 81, 84, 86],
      [9.7, 9.7, 8.5, 8.5, 8.5, 8.4, 8.4, 8.4],
    ];
  }
  const r = rng(hash(sym + "fd"));
  const s = getStock(sym);
  const g = 1 + s.rev / 400;
  const mk = (st: number, gr: number, nz: number) => {
    let v = st;
    return Array.from({ length: 8 }, () => {
      v *= gr * (1 + (r() - 0.5) * nz);
      return +v.toFixed(2);
    });
  };
  return [
    mk(4 + r() * 6, g, 0.05),
    mk(0.4 + r() * 0.6, g * 1.01, 0.08),
    mk(40 + r() * 30, 1.005, 0.03),
    mk(0.8 + r() * 2, g, 0.25),
    mk(8 + r() * 20, 1.01, 0.08),
    mk(2 + r() * 10, 0.99, 0.04),
  ];
}

export function detail(t: string, live?: any): DetailStock {
  const sym = t.toUpperCase().trim();
  const s = getStock(sym, live);
  const sv = scoresFor(sym);
  const up = s.c >= 0;

  const assess =
    sym === "NVDA"
      ? "NVDA is showing a high-conviction bullish setup driven primarily by semiconductor relative strength, unusual volume and positive AI-sector momentum. Valuation remains the principal counterweight."
      : `${sym} is showing a ${s.conf >= 80 ? "high-conviction" : s.conf >= 70 ? "moderate-conviction" : "low-conviction"} ${up ? "bullish" : "tentative"} setup driven primarily by ${s.sig[0].toLowerCase()} and ${s.sig[1].toLowerCase()}. ${s.fpe > 60 ? "An elevated forward multiple is the principal counterweight." : !up ? "The broader trend remains the principal counterweight." : "Macro sensitivity is the principal counterweight."}`;

  const assessEv = [
    `${s.cf} of 7 signal categories aligned (business, earnings, technical, catalysts, valuation, positioning, macro)`,
    `Strongest input: ${KEYS[sv.indexOf(Math.max(...sv))]} (${Math.max(...sv)}/100)`,
    `Weakest input: ${KEYS[sv.indexOf(Math.min(...sv))]} (${Math.min(...sv)}/100) · forward P/E ${s.fpe}×`,
  ];

  const att = sym === "NVDA"
    ? [42, 28, 18, 12, 0, 0]
    : [36, 24, 22, 18, 0, 0];

  const movedTxt =
    sym === "NVDA"
      ? "Today’s move is primarily sector-driven and supported by positive company news flow, with semiconductor relative strength and Blackwell ramp confirmations explaining 70% of intraday performance."
      : up
      ? `Today's +${Math.abs(s.c).toFixed(2)}% move appears primarily sector-driven and confirmed by volume expansion following constructive catalyst follow-through.`
      : `Today's ${s.c.toFixed(2)}% decline reflects short-term profit taking and broad sector consolidation ahead of upcoming earnings checkpoints.`;

  const movedEv = [
    `${s.sector} sector beta contributed ${(Math.abs(s.c) * 0.42).toFixed(2)}% to today's net performance`,
    `Volume tracking at ${(1.1 + sv[1] / 120).toFixed(1)}× 20-day historical average`,
    `Institutional block flow indicates net ${up ? "accumulation" : "trimming"} throughout regular market hours`,
    `Options call/put ratio standing at ${(1.2 + (sv[5] || 50) / 100).toFixed(2)} into the close`,
  ];

  const whyEv = [
    `${s.sector} sector beta contributed ${up ? "+1.42" : "-0.85"}% to today's net move`,
    `Volume tracking at ${(1.1 + sv[1] / 120).toFixed(1)}× 20-day average`,
    `Institutional block flow indicates net ${up ? "accumulation" : "trimming"}`,
    `Options call/put ratio standing at ${(1.2 + (sv[5] || 50) / 100).toFixed(2)}`,
  ];

  const whyChg: [string, string, number, string][] = [
    ["Earnings Revisions", "Street EPS estimates raised +12% over last 90 days", 88, UP],
    ["Sector Momentum", `${s.sector} outperforming S&P 500 index by +3.4% this month`, 82, UP],
    ["Institutional Flow", "13F filings show net +1.8% position additions", 74, UP],
    ["Macro Tailwinds", "Treasury yields stabilizing, supporting equity valuation multiples", 68, STEEL],
    ["Valuation Multiple", `Trading at ${s.fpe}× forward earnings vs historical 5-yr mean`, 45, DN],
  ];

  const signals: [string, string, string][] = [
    ["MOMENTUM", "Strong Relative Strength", "Top decile RS rating vs broader market"],
    ["FLOW", "Unusual Option Volume", "Heavy OTM call buying detected in front-month contracts"],
    ["TREND", "Multi-Week Breakout", "Price confirmed above key multi-month resistance pivot"],
  ];

  const fwdScn: [string, string, string, string, string, string][] = [
    ["BULL CASE", usd(s.p * 1.25), "+25.0%", "35%", "Accelerating revenue growth + margin expansion", UP],
    ["BASE CASE", usd(s.p * 1.10), "+10.0%", "50%", "Consensus execution + in-line guide", STEEL],
    ["BEAR CASE", usd(s.p * 0.85), "−15.0%", "15%", "Macro pullback + multiple compression", DN],
  ];

  const upcoming: UpcomingEvent[] = [
    { date: "Oct 22", days: "in 9 days", n: "Q3 Earnings Release", txt: "Consensus revenue and EPS print; historic average move ±6.4%", imp: "HIGH", col: "#f5b031" },
    { date: "Nov 05", days: "in 23 days", n: "Product Roadmap Day", txt: "Keynote announcements and new customer contract milestones", imp: "MED", col: STEEL },
    { date: "Nov 19", days: "in 37 days", n: "Monthly Options Expiry", txt: "Pinning pressure expected around key open interest strikes", imp: "LOW", col: "#93a1af" },
  ];

  const fwd = {
    cats: [
      { k: "BUS", label: "Business Momentum", score: sv[0], cells: [["Top-line acceleration", 85, UP], ["Market share gains", 80, UP]] as [string, number, string][] },
      { k: "EARN", label: "Estimate Revisions", score: sv[1], cells: [["EPS revisions", 88, UP], ["Revenue revisions", 82, UP]] as [string, number, string][] },
      { k: "TECH", label: "Technical Setup", score: sv[2], cells: [["Moving average alignment", 84, UP], ["Volume confirmation", 76, UP]] as [string, number, string][] },
      { k: "VAL", label: "Valuation Attractiveness", score: sv[4], cells: [["Forward P/E", 48, STEEL], ["PEG ratio", 62, STEEL]] as [string, number, string][] },
    ],
  };

  const invalid: [string, string][] = [
    ["Price loses 50-day moving average", `Daily close below ${usd(s.p * 0.92)}`],
    ["Sector relative strength deteriorates", "Sector RS rank falls below 50"],
    ["Forward EPS cuts", "Consensus revisions turn negative (> -3%)"],
  ];

  const fundTxt = `${sym} maintains a healthy balance sheet with competitive margins. Revenue growth remains ${s.rev > 20 ? "above" : "consistent with"} sector peers.`;

  const fundEv = [
    `Forward P/E of ${s.fpe}× vs industry median of 28.5×`,
    `Revenue growth of ${pct1(s.rev)} y/y`,
    `Return on equity tracking in the top quartile of peers`,
  ];

  const read = [
    { k: "TREND", v: up ? "Bullish" : "Bearish", col: up ? UP : DN },
    { k: "MOMENTUM", v: s.conf >= 75 ? "Strong" : s.conf >= 60 ? "Neutral" : "Weak", col: s.conf >= 75 ? UP : "#f5b031" },
    { k: "BREAKOUT", v: up ? "Confirmed" : "Consolidating", col: up ? UP : STEEL },
    { k: "RISK", v: s.conf >= 80 ? "Moderate" : s.conf >= 65 ? "Elevated" : "High", col: s.conf >= 80 ? UP : DN },
  ];

  const levels = [
    { k: "Resistance 2", v: usd(s.p * 1.08), col: DN },
    { k: "Resistance 1", v: usd(s.p * 1.04), col: DN },
    { k: "Last Price", v: usd(s.p), col: "#e8eef4" },
    { k: "Support 1", v: usd(s.p * 0.96), col: UP },
    { k: "Support 2 (50-DMA)", v: usd(s.p * 0.92), col: UP },
    { k: "ATR (14)", v: usd(s.p * 0.026), col: "#93a1af" },
  ];

  const ev: Record<string, string[]> = {
    Momentum: [`${sym} is ${pct1(s.c * 4.1)} over 20 sessions vs +2.3% for the S&P 500`, `Price sits ${up ? "above" : "below"} its 20-, 50- and 200-day averages`, `RSI(14) at ${up ? 66 : 38} — ${up ? "strong, not yet overbought" : "approaching oversold"}`],
    Volume: [`Session volume ${(1.1 + sv[1] / 120).toFixed(1)}× the 20-day average`, `3 of the last 5 sessions closed on above-average volume`, `Accumulation/distribution line at a 3-month ${up ? "high" : "low"}`],
    "Relative Strength": [`Top ${Math.max(3, 100 - sv[2])}% of the S&P 500 by 3-month relative strength`, `${up ? "Outperforming" : "Lagging"} its sector ETF by ${Math.abs(s.c * 1.3).toFixed(1)}% over 1 month`, `RS line made a new 52-week ${up ? "high" : "low"} this week`],
    Sector: [`${s.sector} group ${up ? "outperforming" : "underperforming"} the index today`, "8 of the 10 largest sector stocks are higher", "Sector fund flows positive for a 4th straight week"],
    News: [`${up ? 4 : 1} positive / ${up ? 1 : 3} negative headlines in the last 48 hours`, "Latest analyst action: target revised", "No negative guidance headlines detected"],
    Options: [`Call volume ${up ? "1.6" : "0.8"}× put volume today`, `Implied volatility ${up ? 41 : 56}% — ${up ? "below" : "above"} its 30-day average`, `Largest open-interest strike ${usd(Math.round(s.p * 1.04))}`],
    "Market Regime": ["S&P 500 above its 50-day average; VIX 15.3", "Breadth constructive — mega-caps supported", "Rates volatile after jobs and CPI data"],
  };

  const events = [
    { time: "09:30", label: "Market open · gap detected", kind: "OPEN", fr: 0.05, mv: +(s.c * 0.15).toFixed(2) },
    { time: "10:15", label: `${s.sector} sector momentum surge`, kind: "SECTOR", fr: 0.22, mv: +(s.c * 0.45).toFixed(2) },
    { time: "11:30", label: "Institutional block flow & volume expansion", kind: "FLOW", fr: 0.48, mv: +(s.c * 0.72).toFixed(2) },
    { time: "14:05", label: "Breakout pivot confirmation above intraday shelf", kind: "TECHNICAL", fr: 0.75, mv: +(s.c * 0.88).toFixed(2) },
    { time: "16:00", label: `Regular session close · ${pct(s.c)} total`, kind: "CLOSE", fr: 1.0, mv: s.c },
  ];

  return {
    sv,
    ev,
    events,
    assess,
    assessEv,
    att,
    movedTxt,
    movedEv,
    upcoming,
    invalid,
    fundTxt,
    fundEv,
    read,
    levels,
    drivers: [
      ["Business Momentum", "Revenue Growth", "+42% y/y", UP, "High secular tailwinds", 88],
      ["Earnings Quality", "Revisions Trend", "+14% upward revisions", UP, "Street raising estimates", 84],
      ["Technical Setup", "Trend Alignment", "Above 50d & 200d", UP, "Bullish market structure", 80],
      ["Valuation Check", "P/E Multiple", `${s.fpe}× Forward`, STEEL, "Moderate valuation premium", 52],
    ],
    whyEv,
    whyChg,
    signals,
    fwdScn,
    fwd,
    svDetails: {
      dir: up ? "Bull" : "Bear",
      hz: "6M",
      tgt: +(s.p * 1.15).toFixed(2),
      stop: +(s.p * 0.92).toFixed(2),
      conf: s.conf,
      at: "Today",
      ev: { "Data Center": 88, "Revisions": 90, "Trend": 82 },
    },
  };
}
