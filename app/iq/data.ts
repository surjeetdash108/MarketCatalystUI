// ============================================================
// STOCKWISE — MOCK DATA (TypeScript)
// ============================================================

export interface PulseItem { l: string; v: number; c: number; o: number; pc: number; }
export interface WMNItem { h: string; t: string; tag: 'macro' | 'earn' | 'sector'; }
export interface Earning {
  s: string; n: string; t: string; mc: string; sec: string;
  epsE: number; epsA: number | null;
  revE: number; revA: number | null;
  guide: string | null; react: number | null;
  tags: string[]; owned: boolean; implied: number;
}
export interface Mover {
  s: string; n: string; p: number; c: number; rvol: number; rs: number;
  cat: string; ma: string; owned: boolean;
  sector: string; cap: 'Mega' | 'Large' | 'Mid' | 'Small';
  wk: number; tech: string; news: string;
}
export interface AnalystAction {
  s: string; n: string; firm: string;
  dir: 'up' | 'down' | 'init' | 'hold';
  from: string; to: string;
  ptF: number; ptT: number;
  react: number; n30: number; owned: boolean;
}
export interface FolioItem {
  s: string; n: string;
  p: number;    // current price
  c: number;    // day % change
  gl: number;   // total gain/loss %
  size: "Small" | "Medium" | "Large";
  conv: "High" | "Medium" | "Low";
  evt: string;
}
export interface Fund {
  nm: string; av: string; mgr: string;
  aum: string; pos: number; top: string;
  newPos: number; exits: number; q: string;
}
export interface FundDetail {
  holdings: [string, number, string][];
  buys: [string, string][];
  exits: [string, string][];
  theme: string;
  conc: string;
}
export interface WatchItem {
  s: string; n: string; px: number; c: number;
  er: string; analyst: string | null; opt: boolean; headline: string;
}
export interface StockInfo {
  name: string; px: number; c: number; mkt: string;
  pe: number; eps: number; wkh52: number; wkl52: number;
  div: number; beta: number; sec: string;
  ai_call: string; ai_thesis: string; ai_risk: string;
  ai_metrics: { l: string; v: string; }[];
  fin: { l: string; v: string; }[];
  news: { h: string; dt: string; }[];
  ins: { n: string; a: string; dt: string; }[];
}
export interface SectorRow { name: string; rank: number; trend: string; chg: number; items: [string, number, number][]; }
export interface ScreenerStock {
  s: string; n: string; sec: string;
  mc: number; pe: number;
  rs: number;     // relative strength 0–100
  salesG: number; // sales growth %
  epsG: number;   // EPS growth %
  mgn: number;    // gross margin %
  rvol: number;   // relative volume
  rating: string; // Strong Buy | Buy | Neutral | Sell | Strong Sell
}
export interface CommentaryItem {
  cat: string; accent: string; time: string; text: string; why: string;
}
export interface RecapData {
  date: string; subtitle: string; headline: string;
  indices: { l: string; v: number }[];
  stories: string[];
  tomorrow: { time: string; ev: string }[];
  movers: { s: string; reason: string; c: number }[];
  internals: { l: string; v: string; c: number }[];
}

// ---- Market Pulse (10 items) ----
export const pulse: PulseItem[] = [
  { l: 'S&P 500',     v: 5312.08,  c: 0.73,  o: 5281.4,  pc: 5273.66 },
  { l: 'Nasdaq',      v: 16973.17, c: 1.02,  o: 16800.0, pc: 16801.7 },
  { l: 'Dow',         v: 39872.4,  c: 0.41,  o: 39714.0, pc: 39709.6 },
  { l: 'Russell 2K',  v: 2061.3,   c: -0.32, o: 2071.4,  pc: 2067.9  },
  { l: 'VIX',         v: 14.18,    c: -2.51, o: 14.52,   pc: 14.54   },
  { l: '10Y Yield',   v: 4.32,     c: -0.04, o: 4.36,    pc: 4.36    },
  { l: 'WTI Crude',   v: 78.64,    c: -1.21, o: 79.42,   pc: 79.60   },
  { l: 'Gold',        v: 2344.10,  c: 0.31,  o: 2337.0,  pc: 2336.8  },
  { l: 'Dollar (DXY)',v: 104.21,   c: 0.12,  o: 104.08,  pc: 104.09  },
];

// ---- What Matters Now ----
export const wmn: WMNItem[] = [
  { h: 'Cooler CPI print', t: 'May core inflation came in at <b>0.2% m/m</b>, below the 0.3% estimate — yields fell and rate-cut odds for September rose.', tag: 'macro' },
  { h: 'NVDA earnings beat', t: '<span class="sym up">NVDA</span> beat EPS by 18% and raised FY25 guidance on Data Center demand. Stock <b class="up">+8.2%</b>.', tag: 'earn' },
  { h: 'Fed minutes: higher-for-longer tone', t: 'FOMC minutes reiterated patience; committee needs <b>more evidence</b> before cutting. September cut probability fell to 38%.', tag: 'macro' },
  { h: 'Target misses and guides down', t: '<span class="sym down">TGT</span> Q1 EPS missed by 11%; full-year guidance cut. Consumer discretionary facing <b class="warn">margin pressure</b>.', tag: 'earn' },
  { h: 'Oil slides on demand concerns', t: 'Brent crude fell below $80 as OPEC+ compliance data disappointed. Energy sector <b class="down">−1.8%</b>.', tag: 'sector' },
  { h: 'Semis rally on AI capex data', t: 'AMD, AVGO, MRVL all up 3–5% on strong hyperscaler spending signals from MSFT and GOOG earnings guidance.', tag: 'sector' },
  { h: 'Dollar weakens on soft data', t: 'DXY slipped to 104.1 after softer jobs and CPI prints. Emerging-market equities and commodities caught a bid.', tag: 'macro' },
  { h: 'JPM raises S&P 500 target', t: '<span class="sym">JPM</span> strategists lifted their year-end S&P 500 target to <b>5,800</b>, citing stronger-than-expected earnings resilience.', tag: 'macro' },
];

// ---- Earnings ----
export const earnings: Earning[] = [
  { s: 'NVDA', n: 'Nvidia', t: 'Wed post', mc: '$2.91T', sec: 'Semiconductors', epsE: 5.56, epsA: 6.57, revE: 24.6, revA: 26.0, guide: 'Raised', react: 8.2, tags: ['Beat', 'Raised'], owned: true, implied: 7.2 },
  { s: 'MSFT', n: 'Microsoft', t: 'Tue post', mc: '$3.1T', sec: 'Software', epsE: 2.82, epsA: 2.94, revE: 60.8, revA: 61.9, guide: 'In-line', react: 2.1, tags: ['Beat'], owned: true, implied: 4.1 },
  { s: 'AMZN', n: 'Amazon', t: 'Thu post', mc: '$1.9T', sec: 'E-Commerce', epsE: 0.98, epsA: null, revE: 142.6, revA: null, guide: null, react: null, tags: [], owned: false, implied: 5.8 },
  { s: 'GOOG', n: 'Alphabet', t: 'Mon post', mc: '$2.1T', sec: 'Internet', epsE: 1.84, epsA: 1.89, revE: 79.9, revA: 80.5, guide: 'In-line', react: 1.3, tags: ['Beat'], owned: false, implied: 3.9 },
  { s: 'META', n: 'Meta', t: 'Wed post', mc: '$1.2T', sec: 'Social Media', epsE: 4.71, epsA: 4.86, revE: 36.2, revA: 36.5, guide: 'Raised', react: 3.2, tags: ['Beat', 'Raised'], owned: true, implied: 5.5 },
  { s: 'AAPL', n: 'Apple', t: 'Thu post', mc: '$3.0T', sec: 'Hardware', epsE: 1.50, epsA: null, revE: 89.3, revA: null, guide: null, react: null, tags: [], owned: true, implied: 3.2 },
  { s: 'TGT', n: 'Target', t: 'Wed pre', mc: '$58B', sec: 'Retail', epsE: 2.05, epsA: 1.82, revE: 24.5, revA: 24.1, guide: 'Lowered', react: -7.8, tags: ['Miss', 'Lowered'], owned: false, implied: 4.6 },
  { s: 'WMT', n: 'Walmart', t: 'Thu pre', mc: '$480B', sec: 'Retail', epsE: 0.52, epsA: 0.60, revE: 159.5, revA: 161.5, guide: 'Raised', react: 5.2, tags: ['Beat', 'Raised'], owned: false, implied: 2.9 },
];

// ---- Market Movers ----
export const movers: Mover[] = [
  { s: 'NVDA', n: 'Nvidia',     p: 1181.75, c:  8.23, rvol: 5.8, rs: 96, cat: 'Earnings beat',      ma: 'Above 50/200', owned: true,  sector: 'Semis',    cap: 'Mega',  wk: 18.9, tech: 'Above 50/200 · RVOL 5.8× · RS 96/99. Buyers in control — momentum positive.', news: 'Earnings beat is driving today\'s move.' },
  { s: 'ZIM',  n: 'ZIM Int\'l', p:   18.42, c:  9.97, rvol: 4.2, rs: 81, cat: 'Earnings beat',      ma: 'Above 50/200', owned: false, sector: 'Shipping', cap: 'Small', wk: 22.1, tech: 'Above 50/200 · RVOL 4.2× · RS 81/99. Buyers in control — momentum positive.', news: 'Earnings beat is driving today\'s move.' },
  { s: 'PLTR', n: 'Palantir',   p:   24.88, c:  6.18, rvol: 3.4, rs: 88, cat: 'Guidance raise',     ma: 'Above 50/200', owned: false, sector: 'Software', cap: 'Large', wk: 14.2, tech: 'Above 50/200 · RVOL 3.4× · RS 88/99. Buyers in control — momentum positive.', news: 'Guidance raise is driving today\'s move.' },
  { s: 'AVGO', n: 'Broadcom',   p: 1402.50, c:  2.97, rvol: 1.9, rs: 77, cat: 'Sympathy (semis)',   ma: 'Above 50/200', owned: false, sector: 'Semis',    cap: 'Mega',  wk:  7.4, tech: 'Above 50/200 · RVOL 1.9× · RS 77/99. Buyers in control — momentum positive.', news: 'Sympathy (semis) is driving today\'s move.' },
  { s: 'CRM',  n: 'Salesforce', p:  316.50, c:  4.21, rvol: 2.6, rs: 73, cat: 'Analyst upgrade',    ma: 'Above 50/200', owned: false, sector: 'Software', cap: 'Large', wk:  9.6, tech: 'Above 50/200 · RVOL 2.6× · RS 73/99. Buyers in control — momentum positive.', news: 'Analyst upgrade is driving today\'s move.' },
  { s: 'DELL', n: 'Dell',       p:  161.80, c: -3.45, rvol: 3.1, rs: 42, cat: 'Margin miss',        ma: 'Below 50/200', owned: false, sector: 'Hardware', cap: 'Large', wk: -6.1, tech: 'Below 50/200 · RVOL 3.1× · RS 42/99. Under distribution — momentum negative.', news: 'Margin miss is driving today\'s move.' },
  { s: 'WBA',  n: 'Walgreens',  p:   15.30, c: -5.80, rvol: 2.7, rs: 18, cat: 'Guidance cut',       ma: 'Below 50/200', owned: false, sector: 'Retail',   cap: 'Mid',   wk:-11.3, tech: 'Below 50/200 · RVOL 2.7× · RS 18/99. Under distribution — momentum negative.', news: 'Guidance cut is driving today\'s move.' },
  { s: 'INTC', n: 'Intel',      p:   30.12, c: -1.80, rvol: 1.4, rs: 24, cat: 'No known catalyst',  ma: 'Below 50/200', owned: false, sector: 'Semis',    cap: 'Large', wk: -4.2, tech: 'Below 50/200 · RVOL 1.4× · RS 24/99. Under distribution — momentum negative.', news: 'No company-specific headline — trading with its sector and the broad tape.' },
];

// ---- Analyst Actions ----
export const analyst: AnalystAction[] = [
  // CRM — 6 actions (consensus shift flagged)
  { s: 'CRM',  n: 'Salesforce',  firm: 'Morgan Stanley', dir: 'up',   from: 'Equal Weight', to: 'Overweight', ptF: 280,  ptT: 340,  react:  3.80, n30: 6, owned: false },
  { s: 'CRM',  n: 'Salesforce',  firm: 'Bernstein',      dir: 'up',   from: 'Market Perform',to: 'Outperform', ptF: 260,  ptT: 320,  react:  2.90, n30: 6, owned: false },
  { s: 'CRM',  n: 'Salesforce',  firm: 'RBC Capital',    dir: 'up',   from: 'Sector Perform',to: 'Outperform', ptF: 270,  ptT: 330,  react:  3.10, n30: 6, owned: false },
  { s: 'CRM',  n: 'Salesforce',  firm: 'Piper Sandler',  dir: 'up',   from: 'Neutral',      to: 'Overweight', ptF: 265,  ptT: 315,  react:  1.80, n30: 6, owned: false },
  { s: 'CRM',  n: 'Salesforce',  firm: 'Wolfe Research', dir: 'up',   from: 'Peer Perform',  to: 'Outperform', ptF: 275,  ptT: 335,  react:  2.50, n30: 6, owned: false },
  { s: 'CRM',  n: 'Salesforce',  firm: 'Barclays',       dir: 'init', from: '—',            to: 'Overweight', ptF: 0,    ptT: 350,  react:  4.20, n30: 6, owned: false },
  // NVDA — 5 actions
  { s: 'NVDA', n: 'Nvidia',      firm: 'Goldman Sachs',  dir: 'up',   from: 'Buy',          to: 'Strong Buy', ptF: 1000, ptT: 1250, react:  8.23, n30: 5, owned: true  },
  { s: 'NVDA', n: 'Nvidia',      firm: 'JPMorgan',       dir: 'up',   from: 'Overweight',   to: 'Overweight', ptF: 950,  ptT: 1200, react:  5.10, n30: 5, owned: true  },
  { s: 'NVDA', n: 'Nvidia',      firm: 'Wedbush',        dir: 'up',   from: 'Outperform',   to: 'Outperform', ptF: 900,  ptT: 1180, react:  6.40, n30: 5, owned: true  },
  { s: 'NVDA', n: 'Nvidia',      firm: 'Bank of America',dir: 'up',   from: 'Buy',          to: 'Buy',        ptF: 1050, ptT: 1300, react:  7.80, n30: 5, owned: true  },
  { s: 'NVDA', n: 'Nvidia',      firm: 'Mizuho',         dir: 'up',   from: 'Outperform',   to: 'Outperform', ptF: 980,  ptT: 1220, react:  4.60, n30: 5, owned: true  },
  // Others
  { s: 'TSLA', n: 'Tesla',       firm: 'UBS',            dir: 'up',   from: 'Sell',         to: 'Neutral',    ptF: 120,  ptT: 135,  react:  3.45, n30: 2, owned: true  },
  { s: 'AAPL', n: 'Apple',       firm: 'Morgan Stanley', dir: 'up',   from: 'Neutral',      to: 'Buy',        ptF: 195,  ptT: 215,  react:  1.02, n30: 1, owned: true  },
  { s: 'AMZN', n: 'Amazon',      firm: 'Citi',           dir: 'hold', from: 'Buy',          to: 'Buy',        ptF: 205,  ptT: 225,  react:  2.11, n30: 2, owned: false },
  { s: 'INTC', n: 'Intel',       firm: 'Deutsche Bank',  dir: 'down', from: 'Buy',          to: 'Neutral',    ptF: 50,   ptT: 32,   react: -2.14, n30: 1, owned: false },
  { s: 'GOOG', n: 'Alphabet',    firm: 'BofA',           dir: 'hold', from: 'Buy',          to: 'Buy',        ptF: 195,  ptT: 210,  react:  1.30, n30: 2, owned: false },
  { s: 'META', n: 'Meta',        firm: 'Wells Fargo',    dir: 'init', from: '—',            to: 'Overweight', ptF: 0,    ptT: 550,  react:  2.40, n30: 1, owned: true  },
  { s: 'MSFT', n: 'Microsoft',   firm: 'Oppenheimer',    dir: 'up',   from: 'Perform',      to: 'Outperform', ptF: 380,  ptT: 450,  react:  1.90, n30: 1, owned: true  },
];

// ---- Portfolio ----
export const folio: FolioItem[] = [
  { s: 'NVDA', n: 'NVIDIA',       p: 1181.75, c:  8.23, gl:  42.60, size: 'Large',  conv: 'High',   evt: 'Earnings beat · raised guide' },
  { s: 'AAPL', n: 'Apple',        p:  189.98, c:  1.02, gl:  12.40, size: 'Large',  conv: 'High',   evt: 'Reports after close today' },
  { s: 'TSLA', n: 'Tesla',        p:  171.40, c:  3.45, gl:  -8.10, size: 'Medium', conv: 'Medium', evt: 'UBS upgrade to Neutral' },
  { s: 'META', n: 'Meta',         p:  415.32, c:  0.86, gl:  28.90, size: 'Medium', conv: 'High',   evt: 'WF initiates Overweight' },
  { s: 'HD',   n: 'Home Depot',   p:  342.10, c: -1.10, gl:   4.20, size: 'Small',  conv: 'Low',    evt: 'Lowered guidance' },
  { s: 'MSFT', n: 'Microsoft',    p:  415.50, c:  0.41, gl:  19.70, size: 'Large',  conv: 'High',   evt: '—' },
  { s: 'AMZN', n: 'Amazon',       p:  182.20, c:  2.11, gl:  30.14, size: 'Medium', conv: 'High',   evt: '—' },
  { s: 'PLTR', n: 'Palantir',     p:   24.88, c:  6.18, gl:  55.50, size: 'Small',  conv: 'High',   evt: 'Guidance raise' },
];

// ---- 13F Funds ----
export const funds: Fund[] = [
  { nm: 'Berkshire Hathaway', av: 'BH', mgr: 'Warren Buffett',    aum: '$331B',  pos: 42,  top: 'AAPL', newPos: 1,   exits: 2,  q: 'Q1 2024' },
  { nm: 'Pershing Square',    av: 'PS', mgr: 'Bill Ackman',       aum: '$10.4B', pos: 8,   top: 'CMG',  newPos: 1,   exits: 1,  q: 'Q1 2024' },
  { nm: 'Tiger Global',       av: 'TG', mgr: 'Chase Coleman',     aum: '$24.9B', pos: 34,  top: 'MSFT', newPos: 5,   exits: 6,  q: 'Q1 2024' },
  { nm: 'Scion Asset Mgmt',   av: 'SC', mgr: 'Michael Burry',     aum: '$1.6B',  pos: 11,  top: 'BABA', newPos: 4,   exits: 3,  q: 'Q1 2024' },
  { nm: 'Bridgewater',        av: 'BW', mgr: 'Ray Dalio (fmr)',   aum: '$19.8B', pos: 680, top: 'IVV',  newPos: 120, exits: 90, q: 'Q1 2024' },
];

// ---- Watchlist ----
export const watch: WatchItem[] = [
  { s: 'AMD',  n: 'Adv Micro Dev',  px: 165.20,   c: -2.10, er: 'Jul 30', analyst: 'JPM → Neutral',      opt: true,  headline: 'Downgraded on AI-share concerns' },
  { s: 'AVGO', n: 'Broadcom',       px: 1402.50,  c:  2.97, er: 'Jun 12', analyst: null,                  opt: true,  headline: 'Semis rally on NVDA read-through' },
  { s: 'SMCI', n: 'Super Micro',    px:  812.40,  c:  5.60, er: 'Aug 06', analyst: 'Barclays PT $1,000',  opt: true,  headline: 'Server demand commentary lifts shares' },
  { s: 'UBER', n: 'Uber',           px:   64.50,  c:  0.80, er: 'Aug 06', analyst: 'GS reiterates Buy',   opt: false, headline: '—' },
  { s: 'PLTR', n: 'Palantir',       px:   24.88,  c:  6.18, er: 'Aug 05', analyst: null,                  opt: true,  headline: 'Guidance raise drives momentum' },
];

// ---- Stock Detail ----
export const stockInfo: Record<string, StockInfo> = {
  NVDA: {
    name: 'Nvidia', px: 1025, c: 8.2, mkt: '$2.91T', pe: 78, eps: 13.14,
    wkh52: 1250, wkl52: 350, div: 0.04, beta: 1.72, sec: 'Semiconductors',
    ai_call: 'Strong Buy',
    ai_thesis: "NVDA's data center dominance, Hopper architecture moat, and accelerating AI inference demand make this the best-positioned semiconductor for the AI buildout cycle. H200 supply constraints are easing into H2 2025, with Blackwell ramping.",
    ai_risk: 'Valuation pricing in perfection; any miss on data center revenue could compress the multiple sharply. AMD/Intel competition timeline uncertain.',
    ai_metrics: [
      { l: 'AI Confidence', v: '94 / 100' }, { l: 'Moat', v: 'Wide' },
      { l: 'Insider Activity', v: 'Neutral' }, { l: 'Short Interest', v: '0.8%' },
    ],
    fin: [
      { l: 'Revenue', v: '$26.0B' }, { l: 'EPS', v: '$6.57' }, { l: 'Gross Margin', v: '78.4%' },
      { l: 'P/E', v: '78×' }, { l: 'P/S', v: '30×' }, { l: 'Debt/Equity', v: '0.43' },
    ],
    news: [
      { h: 'NVDA raises FY25 Data Center forecast above $100B', dt: 'May 22' },
      { h: 'Blackwell GPU shipments on track for Q2 ramp — CEO Jensen Huang', dt: 'May 21' },
      { h: 'Microsoft Azure expands NVDA H200 cluster to 50K GPUs', dt: 'May 19' },
    ],
    ins: [
      { n: 'Jensen Huang (CEO)', a: 'Plan 10b5-1 sale 50K sh', dt: 'May 10' },
      { n: 'Colette Kress (CFO)', a: 'Plan 10b5-1 sale 8K sh', dt: 'May 10' },
    ],
  },
  TSLA: {
    name: 'Tesla', px: 168, c: -3.1, mkt: '$536B', pe: 42, eps: 4.00,
    wkh52: 295, wkl52: 138, div: 0, beta: 2.34, sec: 'Auto / EV',
    ai_call: 'Neutral',
    ai_thesis: "Tesla's energy storage segment is growing rapidly, and FSD progress could unlock robotaxi optionality. However, near-term margin pressure from price cuts and China competition weigh on the thesis.",
    ai_risk: 'Margin deterioration from EV price war; execution risk on Cybertruck ramp; Elon distraction risk.',
    ai_metrics: [
      { l: 'AI Confidence', v: '51 / 100' }, { l: 'Moat', v: 'Narrow' },
      { l: 'Insider Activity', v: 'Selling' }, { l: 'Short Interest', v: '3.1%' },
    ],
    fin: [
      { l: 'Revenue', v: '$21.3B' }, { l: 'EPS', v: '$0.45' }, { l: 'Gross Margin', v: '17.4%' },
      { l: 'P/E', v: '42×' }, { l: 'P/S', v: '5.6×' }, { l: 'Debt/Equity', v: '0.15' },
    ],
    news: [
      { h: 'Tesla cuts Model Y price in Europe for second time in 2025', dt: 'May 23' },
      { h: 'China EV sales fall 8% MoM in April — CAAM data', dt: 'May 20' },
      { h: 'FSD v12.4 rollout begins in North America', dt: 'May 18' },
    ],
    ins: [{ n: 'Elon Musk (CEO)', a: 'No recent activity', dt: '—' }],
  },
  MSFT: {
    name: 'Microsoft', px: 415, c: 2.1, mkt: '$3.1T', pe: 36, eps: 11.53,
    wkh52: 430, wkl52: 310, div: 0.8, beta: 0.89, sec: 'Software',
    ai_call: 'Buy',
    ai_thesis: 'Azure AI services growing 29% YoY, Copilot integration driving ARPU expansion across M365. Nuance and Activision integrations maturing. Dominant enterprise position provides durable moat.',
    ai_risk: 'AI monetization slower than expected; regulatory scrutiny on Activision; cloud competition from AWS and GCP intensifying.',
    ai_metrics: [
      { l: 'AI Confidence', v: '87 / 100' }, { l: 'Moat', v: 'Wide' },
      { l: 'Insider Activity', v: 'Neutral' }, { l: 'Short Interest', v: '0.5%' },
    ],
    fin: [
      { l: 'Revenue', v: '$61.9B' }, { l: 'EPS', v: '$2.94' }, { l: 'Gross Margin', v: '69.4%' },
      { l: 'P/E', v: '36×' }, { l: 'P/S', v: '14×' }, { l: 'Debt/Equity', v: '0.31' },
    ],
    news: [
      { h: 'Azure OpenAI services available in 12 new regions', dt: 'May 20' },
      { h: 'Copilot for M365 reaches 1M paid seats — MSFT CEO', dt: 'May 17' },
    ],
    ins: [{ n: 'Satya Nadella (CEO)', a: 'No recent activity', dt: '—' }],
  },
};

// ---- Sector / Heatmap ----
function _hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
const _bigCap: Record<string, number> = {
  NVDA: 2910, MSFT: 3100, AAPL: 3000, AMZN: 1900, META: 1200,
  AVGO: 612, GOOG: 2100, TSLA: 536, 'BRK.B': 860, JPM: 560,
};
function _mcap(t: string): number { return _bigCap[t] || (12 + _hash(t) % 270); }

const SEC: [string, number, string[]][] = [
  ['Semiconductors',  3.1, ['NVDA','AVGO','TSM','QCOM','AMD','TXN','MU','AMAT','KLAC','LRCX','INTC','ON','MRVL','MPWR']],
  ['Mega-Cap Tech',   2.4, ['AAPL','MSFT','GOOG','AMZN','META','NFLX','ORCL','ADBE','CSCO','IBM','SAP','INTU']],
  ['Cloud Software',  1.8, ['CRM','NOW','SNOW','DDOG','MDB','WDAY','ADSK','VEEV','HUBS','OKTA','ZI','APP','TEAM']],
  ['Social Media',    2.1, ['META','SNAP','PINS','RDDT','YELP','MTCH','ZG','IAC','ANGI','BMBL','SOFI','HOOD']],
  ['E-Commerce',      1.5, ['AMZN','SHOP','BABA','MELI','JD','PDD','EBAY','ETSY','W','CHWY','WISH','CART']],
  ['Cybersecurity',   0.9, ['CRWD','PANW','ZS','FTNT','S','OKTA','CYBR','NET','GEN','TENB','QLYS','RPM']],
  ['EV / Clean Energy',-1.3,['TSLA','BYD','RIVN','NIO','LCID','GM','F','PLUG','FCEL','BLNK','BE','CHPT','NKLA']],
  ['Consumer Disc.',  0.6, ['AMZN','HD','MCD','NKE','SBUX','TGT','LULU','CMG','LOW','BKNG','MAR','HLT','DG']],
  ['Financials',      0.8, ['JPM','BAC','GS','MS','V','MA','AXP','BRK.B','WFC','C','SCHW','BX','KKR']],
  ['Healthcare',      0.2, ['UNH','JNJ','LLY','ABBV','MRK','TMO','DHR','PFE','BMY','GILD','CVS','CI','HUM']],
  ['Energy',         -0.7, ['XOM','CVX','COP','SLB','EOG','OXY','PSX','VLO','MPC','HAL','DVN','PXD','BKR']],
  ['Industrials',     0.4, ['CAT','GE','HON','RTX','UPS','LMT','NOC','GD','MMM','EMR','ETN','ITW','PH']],
  ['Real Estate',    -0.5, ['AMT','PLD','EQIX','SPG','O','WELL','DLR','PSA','VTR','AVB','EQR','ARE','WY']],
  ['Utilities',      -0.3, ['NEE','DUK','SO','AEP','EXC','D','PCG','SRE','ES','XEL','PEG','ED','WEC']],
  ['Materials',       0.1, ['LIN','APD','SHW','FCX','NEM','DOW','DD','NUE','ALB','MOS','IP','PKG','CE']],
  ['Consumer Staples',0.3, ['PG','KO','PEP','WMT','COST','PM','MO','CL','GIS','KMB','KHC','SYY','MKC']],
  ['Biotech',         1.2, ['AMGN','BIIB','REGN','VRTX','MRNA','GILD','ILMN','ALNY','EXAS','SGEN','SAGE','SRPT']],
  ['Med Devices',     0.5, ['MDT','ABT','ISRG','BSX','SYK','EW','ZBH','BDX','IQV','TMO','RMD','HOLX']],
  ['Insurance',       0.6, ['CB','MET','AIG','PRU','AFL','TRV','ALL','MKL','HIG','LNC','GL','EQH']],
  ['Banks',           0.9, ['JPM','BAC','WFC','C','USB','PNC','TFC','FITB','KEY','RF','HBAN','CFG','MTB']],
  ['Autos',          -0.8, ['TSLA','TM','GM','F','STLA','HMC','RIVN','NIO','LCID','RACE','BWM','VWAGY']],
];

export const sectorList: SectorRow[] = SEC.map((row, i) => {
  const [name, chg, tk] = row;
  return {
    name, rank: i + 1,
    trend: chg > 0.5 ? 'Improving' : chg < -0.5 ? 'Deteriorating' : 'Flat',
    chg,
    items: tk.map(t => [t, _mcap(t), +(chg + ((_hash(t + name) % 9) - 4) * 0.35).toFixed(2)] as [string, number, number]),
  };
});

export const sectorByName: Record<string, SectorRow> = Object.fromEntries(sectorList.map(s => [s.name, s]));

// ---- Screener ----
export const screenerStocks: ScreenerStock[] = [
  { s: 'NVDA', n: 'NVIDIA',       sec: 'Semis',    mc: 2910, pe: 71.4, rs: 98, salesG: 262, epsG: 486, mgn: 53, rvol: 4.2, rating: 'Strong Buy' },
  { s: 'AVGO', n: 'Broadcom',     sec: 'Semis',    mc: 648,  pe: 48.2, rs: 91, salesG: 34,  epsG: 12,  mgn: 46, rvol: 1.8, rating: 'Buy' },
  { s: 'CRM',  n: 'Salesforce',   sec: 'Software', mc: 281,  pe: 44.1, rs: 78, salesG: 11,  epsG: 44,  mgn: 30, rvol: 2.2, rating: 'Buy' },
  { s: 'PLTR', n: 'Palantir',     sec: 'Software', mc: 52,   pe: 66.0, rs: 88, salesG: 21,  epsG: 60,  mgn: 25, rvol: 3.4, rating: 'Strong Buy' },
  { s: 'META', n: 'Meta',         sec: 'Internet', mc: 1060, pe: 27.8, rs: 84, salesG: 27,  epsG: 117, mgn: 38, rvol: 1.3, rating: 'Buy' },
  { s: 'AMD',  n: 'Adv Micro Dev',sec: 'Semis',    mc: 266,  pe: 51.5, rs: 62, salesG: 2,   epsG: -7,  mgn: 11, rvol: 1.9, rating: 'Neutral' },
  { s: 'MU',   n: 'Micron',       sec: 'Semis',    mc: 152,  pe: 39.0, rs: 81, salesG: 58,  epsG: 120, mgn: 18, rvol: 1.6, rating: 'Buy' },
  { s: 'INTC', n: 'Intel',        sec: 'Semis',    mc: 128,  pe: 32.1, rs: 34, salesG: -9,  epsG: -40, mgn: 5,  rvol: 1.9, rating: 'Sell' },
  { s: 'SMCI', n: 'Super Micro',  sec: 'Hardware', mc: 48,   pe: 38.4, rs: 95, salesG: 200, epsG: 308, mgn: 14, rvol: 4.8, rating: 'Strong Buy' },
  { s: 'WBA',  n: 'Walgreens',    sec: 'Retail',   mc: 14,   pe: 6.2,  rs: 9,  salesG: 6,   epsG: -60, mgn: 2,  rvol: 2.7, rating: 'Strong Sell' },
  { s: 'ZIM',  n: 'ZIM Shipping', sec: 'Shipping', mc: 3,    pe: 5.0,  rs: 81, salesG: 30,  epsG: 120, mgn: 12, rvol: 4.2, rating: 'Buy' },
  { s: 'DELL', n: 'Dell Tech',    sec: 'Hardware', mc: 90,   pe: 18.0, rs: 42, salesG: 6,   epsG: 10,  mgn: 6,  rvol: 3.1, rating: 'Neutral' },
];

export interface ScreenerPreset {
  name: string;
  desc: string;
  f: { rs_min?: number; salesG_min?: number; epsG_min?: number; rvol_min?: number; rating?: string[]; mc_min?: number; };
}

export const screenerPresets: ScreenerPreset[] = [
  { name: 'Briefing growth screen',     desc: '6-mo RS ≥ 80 · sales & EPS growth · expanding margins', f: { rs_min: 80, salesG_min: 20, epsG_min: 25 } },
  { name: 'Post-earnings momentum',     desc: 'beat + raise · gap up · RVOL > 2×',                      f: { rvol_min: 2 } },
  { name: 'Oversold quality',           desc: 'RSI < 35 · positive FCF · above 200-DMA',                f: {} },
  { name: 'Unusual volume',             desc: 'RVOL > 3× · price > $5',                                 f: { rvol_min: 3 } },
  { name: 'CAN SLIM leaders',           desc: "O'Neil: EPS+sales accel · RS ≥ 90 · near highs",         f: { rs_min: 90, salesG_min: 15, epsG_min: 20 } },
  { name: 'Minervini trend template',   desc: 'price > 50 > 150 > 200-DMA, all rising',                 f: { rs_min: 75 } },
  { name: '52-week-high breakouts',     desc: 'new 52w high · volume surge',                             f: { rvol_min: 1.5, rs_min: 80 } },
  { name: 'Gap-and-go (premarket)',     desc: 'gap > 4% · premarket RVOL > 5×',                          f: { rvol_min: 3 } },
  { name: 'Relative-strength leaders', desc: 'RS ≥ 90 vs S&P over 6 months',                            f: { rs_min: 90 } },
  { name: 'Dividend growth aristocrats',desc: '25-yr dividend growth · payout < 60%',                   f: {} },
  { name: 'Magic Formula (Greenblatt)', desc: 'high ROIC · high earnings yield',                        f: {} },
  { name: 'GARP',                       desc: 'growth ≥ 15% · PEG < 1.5',                               f: { salesG_min: 15, epsG_min: 15 } },
  { name: 'Deep value (low P/E + FCF)', desc: 'P/E < 12 · FCF yield > 8%',                              f: {} },
  { name: 'Net-net / asset value',      desc: 'price < net current assets',                              f: {} },
  { name: 'Short-squeeze candidates',   desc: 'short interest > 20% · rising price',                    f: { rs_min: 60 } },
  { name: 'Insider-buying cluster',     desc: '3+ insider buys in 90 days',                              f: {} },
  { name: 'Analyst-upgrade momentum',   desc: '2+ upgrades in 30 days · PT raised',                     f: { rs_min: 70 } },
  { name: 'Golden cross (50>200)',       desc: '50-DMA crossing above 200-DMA',                          f: { rs_min: 65 } },
  { name: 'Bollinger squeeze breakout', desc: 'low volatility → expansion',                              f: { rvol_min: 2 } },
  { name: 'Cup-with-handle setups',     desc: 'classic base · breakout pivot',                           f: { rs_min: 80 } },
];

// ---- Commentary (live intraday feed) ----
export const commentary: CommentaryItem[] = [
  { cat: 'Macro',       accent: 'var(--warn)',     time: '10:18a', text: 'Treasury yields extend decline; 10-year down to <b>4.32%</b>', why: 'Softer CPI keeps a September cut in play — supportive for long-duration growth names.' },
  { cat: 'Sector',      accent: 'var(--ai)',       time: '10:02a', text: 'Semiconductors lead all groups, <b>+3.1%</b>', why: "NVDA's print is lifting the whole complex; AVGO, MU, AMD all participating." },
  { cat: 'Earnings',    accent: 'var(--up)',       time: '9:31a',  text: '<b>NVDA</b> beats EPS by 18%, raises FY25 guidance', why: "Removes the market's biggest worry — that AI data-center demand was peaking." },
  { cat: 'Analyst',     accent: 'var(--brand-2)',  time: '9:18a',  text: 'Morgan Stanley upgrades <b>CRM</b> to Overweight, PT $340', why: 'Third upgrade this week; the sell-side is turning constructive on the margin story.' },
  { cat: 'Block Trade', accent: 'var(--ai)',       time: '9:05a',  text: '4.2M-share block in <b>XLF</b> crossed above VWAP', why: 'Large institutional buyer in financials aligns with today\'s risk-on rotation.' },
  { cat: 'Story Stock', accent: 'var(--warn)',     time: '8:58a',  text: '<b>ZIM</b> +10% on a blowout quarter and reinstated dividend', why: 'Freight-rate spike is flowing straight to the bottom line for shippers.' },
  { cat: 'Fed/Rates',   accent: 'var(--warn)',     time: '8:30a',  text: 'May core CPI <b>+0.2%</b> m/m vs +0.3% est.', why: 'First clean downside inflation surprise in months; rate-cut odds repriced higher.' },
];

// ---- End-of-Day Recap ----
export const recap: RecapData = {
  date: 'Tuesday, May 21',
  subtitle: 'auto-generated 4:31 ET',
  headline: 'Markets closed broadly higher on cooler inflation',
  indices: [
    { l: 'S&P 500',    v:  0.73 },
    { l: 'Nasdaq',     v:  1.02 },
    { l: 'Dow',        v:  0.41 },
    { l: 'Russell 2K', v: -0.32 },
  ],
  stories: [
    'Cooler-than-expected CPI lifted rate-cut hopes and sent yields lower.',
    "NVDA's beat-and-raise powered a 3.1% rally in semiconductors.",
    'Defensive sectors lagged as risk appetite returned across the tape.',
  ],
  tomorrow: [
    { time: '8:30a', ev: 'Initial jobless claims' },
    { time: 'BMO',   ev: 'Earnings: DELL, HD' },
    { time: '2:00p', ev: 'FOMC minutes' },
    { time: 'AMC',   ev: 'Earnings: SNOW, WDAY' },
  ],
  movers: [
    { s: 'NVDA', reason: 'Earnings beat',  c:  8.23 },
    { s: 'ZIM',  reason: 'Earnings beat',  c:  9.97 },
    { s: 'PLTR', reason: 'Guidance raise', c:  6.18 },
    { s: 'DELL', reason: 'Margin miss',    c: -3.45 },
    { s: 'WBA',  reason: 'Guidance cut',   c: -5.80 },
  ],
  internals: [
    { l: 'Advancers / Decliners', v: '2,810 / 1,140', c:  1 },
    { l: 'New 52-wk highs',       v: '184',            c:  1 },
    { l: 'New 52-wk lows',        v: '39',             c: -1 },
    { l: 'Up volume',             v: '71%',            c:  1 },
  ],
};

// ---- 13F Fund Detail (for drawer) ----
export const fundDetail: Record<string, FundDetail> = {
  'Berkshire Hathaway': {
    holdings: [['AAPL',42.8,'reduced'],['BAC',10.9,'unchanged'],['AXP',7.6,'unchanged'],['KO',6.1,'unchanged'],['CVX',5.8,'unchanged'],['OXY',4.2,'unchanged'],['MCO',3.2,'unchanged'],['CB',2.8,'new'],['KHC',2.2,'unchanged'],['DVA',1.1,'unchanged']],
    buys: [['CB','New position disclosed at ~$6.7B'],['OXY','Added 7.2M shares (+4.3%)']],
    exits: [['HP','Fully exited'],['PARA','Fully exited']],
    theme: 'Berkshire trimmed its largest position (Apple) by 13% while sharply building cash reserves. Net posture turned more defensive this quarter — rotation away from mega-cap tech toward insurance and energy.',
    conc: 'Slightly less concentrated: top-5 weight fell from 79% to 75% after the Apple trim. Still extremely concentrated by typical fund standards.',
  },
  'Pershing Square': {
    holdings: [['CMG',24.1,'unchanged'],['HLT',21.3,'unchanged'],['CP',15.6,'unchanged'],['GOOGL',11.3,'new'],['QSR',9.2,'unchanged'],['HHC',7.6,'reduced'],['FRPH',4.5,'unchanged'],['LOW',3.8,'new'],['OPK',1.6,'unchanged'],['UNH',1.0,'reduced']],
    buys: [['GOOGL','New position ~$2.1B (11.3% of portfolio)'],['LOW','Added $300M']],
    exits: [['NFLX','Fully exited after +62% gain']],
    theme: 'Ackman initiated a significant GOOGL position while adding to LOW, signaling conviction in AI-driven ad monetization and home improvement durability.',
    conc: 'Highly concentrated: top-5 positions = 81% of AUM. Deliberately concentrated, high-conviction style.',
  },
  'Tiger Global': {
    holdings: [['MSFT',18.2,'unchanged'],['NVDA',14.1,'added'],['META',9.8,'unchanged'],['AMZN',8.2,'unchanged'],['CRM',6.5,'new'],['GOOGL',6.1,'unchanged'],['DDOG',4.5,'added'],['CRWD',3.8,'new'],['NOW',3.1,'unchanged'],['SHOP',2.4,'reduced']],
    buys: [['NVDA','Added $1.1B (now #2 position)'],['CRM','New position $680M'],['CRWD','New position $450M']],
    exits: [['TSLA','Fully exited'],['NFLX','Fully exited'],['PTON','Fully exited'],['SPOT','Trimmed 80%'],['RBLX','Fully exited'],['LYFT','Fully exited']],
    theme: 'Tiger rotated aggressively into AI infrastructure plays — NVDA, CRM, CRWD — while exiting legacy/consumer tech names.',
    conc: 'Less concentrated than peers; top-10 = 77% of AUM. Showing high conviction in AI theme.',
  },
  'Scion Asset Mgmt': {
    holdings: [['BABA',31.5,'unchanged'],['JD',21.3,'added'],['REAL',14.8,'new'],['BIDU',8.6,'unchanged'],['PDD',7.4,'new'],['GOOG',6.5,'new'],['ACM',4.9,'unchanged'],['OLPX',2.3,'reduced'],['CPRI',1.8,'unchanged'],['GOOS',0.9,'unchanged']],
    buys: [['JD','Added 3.2M shares'],['REAL','New position'],['PDD','New position'],['GOOG','New position']],
    exits: [['GXO','Fully exited'],['WDC','Fully exited'],['HGV','Fully exited']],
    theme: 'Burry is doubling down on China + value plays. Significant new positions in Chinese e-commerce while adding a first U.S. tech position (GOOG).',
    conc: 'Extremely concentrated: top-5 = 84% of portfolio. Classic Burry high-conviction style.',
  },
  'Bridgewater': {
    holdings: [['IVV',14.3,'unchanged'],['SPY',11.2,'unchanged'],['EEM',8.6,'added'],['GLD',7.5,'added'],['VWO',6.2,'unchanged'],['IEMG',5.8,'unchanged'],['IEF',4.9,'new'],['TIP',4.2,'new'],['EFA',3.8,'unchanged'],['DIA',3.1,'reduced']],
    buys: [['EEM','Added $1.2B'],['GLD','Added $900M gold ETF'],['IEF','New position — rate positioning'],['TIP','New position — inflation hedge']],
    exits: [['BRK.B','Fully exited'],['MSFT','Reduced 60%'],['GOOG','Reduced 45%']],
    theme: 'Bridgewater shifted toward a classic all-weather defensive posture: more EM exposure, added gold and TIPS, reduced single-stock equity concentration.',
    conc: 'Portfolio is diversified across 680 positions — very low concentration by design (Ray Dalio philosophy).',
  },
};
