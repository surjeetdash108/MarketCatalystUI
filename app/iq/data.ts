// ============================================================
// INVESTIQ — MOCK DATA (TypeScript)
// ============================================================

export interface PulseItem { l: string; v: number; c: number; }
export interface WMNItem { h: string; t: string; tag: 'macro' | 'earn' | 'sector'; }
export interface Earning {
  s: string; n: string; t: string; mc: string; sec: string;
  epsE: number; epsA: number | null;
  revE: number; revA: number | null;
  guide: string | null; react: number | null;
  tags: string[]; owned: boolean; implied: number;
}
export interface Mover { s: string; n: string; c: number; v: string; reason: string; sec: string; }
export interface AnalystAction {
  s: string; n: string; from: string; to: string;
  tgt: number; prev: number; firm: string; type: string;
}
export interface FolioItem { s: string; n: string; qty: number; avg: number; px: number; sec: string; }
export interface Fund { name: string; ticker: string; atm: string; top: string[]; }
export interface WatchItem { s: string; n: string; px: number; c: number; tgt: number; note: string; }
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
export interface ScreenerStock { s: string; n: string; sec: string; px: number; mc: number; pe: number; rev: number; eg: number; moat: string; roe: number; yld: number; alpha: number; }
export interface MacroEvent { dt: string; ev: string; sub?: string; type: string; }
export interface CommentaryItem { by: string; dt: string; title: string; blurb: string; tag: string; }
export interface RecapData { date: string; mkt: string; items: { dt: string; title: string; body: string; }[]; }

// ---- Market Pulse (10 items) ----
export const pulse: PulseItem[] = [
  { l: 'S&P 500', v: 5312.08, c: 0.73 },
  { l: 'Nasdaq', v: 16973.17, c: 1.02 },
  { l: 'Dow', v: 39872.4, c: 0.41 },
  { l: 'Russell 2K', v: 2061.3, c: -0.32 },
  { l: 'VIX', v: 14.18, c: -2.51 },
  { l: '10Y Yield', v: 4.32, c: -0.04 },
  { l: 'WTI Crude', v: 78.64, c: -1.21 },
  { l: 'Gold', v: 2344.10, c: 0.31 },
  { l: 'Dollar (DXY)', v: 104.21, c: 0.12 },
  { l: 'Bitcoin', v: 67840, c: 2.18 },
];

// ---- What Matters Now ----
export const wmn: WMNItem[] = [
  { h: 'Cooler CPI print', t: 'May core inflation came in at <b>0.2% m/m</b>, below the 0.3% estimate — yields fell and rate-cut odds for September rose.', tag: 'macro' },
  { h: 'NVDA earnings beat', t: '<span class="sym up">NVDA</span> beat EPS by 18% and raised FY25 guidance on Data Center demand. Stock <b class="up">+8.2%</b>.', tag: 'earn' },
  { h: 'Fed minutes: higher-for-longer tone', t: 'FOMC minutes reiterated patience; committee needs <b>more evidence</b> before cutting. September cut probability fell to 38%.', tag: 'macro' },
  { h: 'Target misses and guides down', t: '<span class="sym down">TGT</span> Q1 EPS missed by 11%; full-year guidance cut. Consumer discretionary facing <b class="warn">margin pressure</b>.', tag: 'earn' },
  { h: 'Oil slides on demand concerns', t: 'Brent crude fell below $80 as OPEC+ compliance data disappointed. Energy sector <b class="down">−1.8%</b>.', tag: 'sector' },
  { h: 'Semis rally on AI capex data', t: 'AMD, AVGO, MRVL all up 3–5% on strong hyperscaler spending signals from MSFT and GOOG earnings guidance.', tag: 'sector' },
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
  { s: 'NVDA', n: 'Nvidia', c: 8.2, v: '$6.2B', reason: 'Earnings beat + raised guide', sec: 'Semis' },
  { s: 'ARM', n: 'Arm Holdings', c: 6.1, v: '$4.1B', reason: 'NVDA halo + AI chip demand', sec: 'Semis' },
  { s: 'SMCI', n: 'Super Micro', c: -12.4, v: '$2.8B', reason: 'Weak gross margins reported', sec: 'Hardware' },
  { s: 'TGT', n: 'Target', c: -7.8, v: '$1.9B', reason: 'EPS miss, guide cut', sec: 'Retail' },
  { s: 'META', n: 'Meta', c: 3.2, v: '$3.5B', reason: 'Ad revenue beat, AI investment raised', sec: 'Social' },
  { s: 'PLTR', n: 'Palantir', c: 5.9, v: '$2.1B', reason: 'Gov contracts + AI momentum', sec: 'Software' },
  { s: 'COIN', n: 'Coinbase', c: 4.7, v: '$1.6B', reason: 'Bitcoin rally, trading volume up', sec: 'Fintech' },
  { s: 'TSLA', n: 'Tesla', c: -3.1, v: '$3.9B', reason: 'China EV competition & margin concern', sec: 'Auto' },
  { s: 'MRVL', n: 'Marvell', c: 4.2, v: '$1.2B', reason: 'Custom AI chip revenue guidance raised', sec: 'Semis' },
  { s: 'WMT', n: 'Walmart', c: 5.2, v: '$2.8B', reason: 'Beat + guide raised on grocery strength', sec: 'Retail' },
];

// ---- Analyst Actions ----
export const analyst: AnalystAction[] = [
  { s: 'NVDA', n: 'Nvidia', from: 'Buy', to: 'Strong Buy', tgt: 1250, prev: 1000, firm: 'Goldman Sachs', type: 'upgrade' },
  { s: 'TSLA', n: 'Tesla', from: 'Hold', to: 'Sell', tgt: 140, prev: 200, firm: 'UBS', type: 'downgrade' },
  { s: 'AAPL', n: 'Apple', from: 'Neutral', to: 'Buy', tgt: 215, prev: 195, firm: 'Morgan Stanley', type: 'upgrade' },
  { s: 'AMZN', n: 'Amazon', from: 'Buy', to: 'Buy', tgt: 225, prev: 205, firm: 'Citi', type: 'target raise' },
  { s: 'MSFT', n: 'Microsoft', from: 'Outperform', to: 'Outperform', tgt: 500, prev: 460, firm: 'Barclays', type: 'target raise' },
  { s: 'META', n: 'Meta', from: 'Hold', to: 'Buy', tgt: 520, prev: 450, firm: 'JPMorgan', type: 'upgrade' },
  { s: 'INTC', n: 'Intel', from: 'Buy', to: 'Neutral', tgt: 32, prev: 50, firm: 'Deutsche Bank', type: 'downgrade' },
  { s: 'GOOG', n: 'Alphabet', from: 'Buy', to: 'Buy', tgt: 210, prev: 195, firm: 'BofA', type: 'target raise' },
];

// ---- Portfolio ----
export const folio: FolioItem[] = [
  { s: 'NVDA', n: 'Nvidia', qty: 50, avg: 478, px: 1025, sec: 'Semis' },
  { s: 'MSFT', n: 'Microsoft', qty: 30, avg: 280, px: 415, sec: 'Software' },
  { s: 'AAPL', n: 'Apple', qty: 100, avg: 150, px: 191, sec: 'Hardware' },
  { s: 'META', n: 'Meta', qty: 20, avg: 280, px: 490, sec: 'Social' },
  { s: 'AMZN', n: 'Amazon', qty: 25, avg: 140, px: 182, sec: 'E-comm' },
  { s: 'TSLA', n: 'Tesla', qty: 15, avg: 220, px: 168, sec: 'Auto' },
  { s: 'PLTR', n: 'Palantir', qty: 200, avg: 16, px: 24, sec: 'Software' },
  { s: 'BRK.B', n: 'Berkshire B', qty: 40, avg: 310, px: 395, sec: 'Finance' },
];

// ---- 13F Funds ----
export const funds: Fund[] = [
  { name: 'Berkshire Hathaway', ticker: 'BRK', atm: '$1.6T', top: ['AAPL', 'BAC', 'AXP', 'KO', 'CVX'] },
  { name: 'Vanguard 500 Index', ticker: 'VOO', atm: '$1.1T', top: ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'META'] },
  { name: 'ARK Innovation', ticker: 'ARKK', atm: '$6.8B', top: ['TSLA', 'COIN', 'ROKU', 'SHOP', 'PATH'] },
  { name: 'Bridgewater Pure Alpha', ticker: 'BW', atm: '$124B', top: ['SPY', 'GLD', 'EEM', 'IAU', 'TLT'] },
];

// ---- Watchlist ----
export const watch: WatchItem[] = [
  { s: 'AMD', n: 'Advanced Micro Devices', px: 162, c: 2.4, tgt: 200, note: 'AI GPU ramp' },
  { s: 'SOFI', n: 'SoFi Technologies', px: 8.2, c: -1.1, tgt: 12, note: 'Profitability turn' },
  { s: 'CRWD', n: 'CrowdStrike', px: 345, c: 0.8, tgt: 400, note: 'FedRAMP expansion' },
  { s: 'MRVL', n: 'Marvell Technology', px: 72, c: 4.2, tgt: 90, note: 'Custom silicon' },
  { s: 'PANW', n: 'Palo Alto Networks', px: 312, c: -0.3, tgt: 360, note: 'Platformization win' },
  { s: 'SNOW', n: 'Snowflake', px: 148, c: 1.7, tgt: 185, note: 'AI data cloud' },
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
  ['Semiconductors', 3.1, ['NVDA', 'AVGO', 'AMD', 'MU', 'INTC', 'TXN']],
  ['Mega-Cap Tech', 2.4, ['AAPL', 'MSFT', 'GOOG', 'META', 'AMZN']],
  ['Cloud Software', 1.8, ['CRM', 'NOW', 'SNOW', 'DDOG', 'MDB']],
  ['Social Media', 2.1, ['META', 'SNAP', 'PINS', 'RDDT']],
  ['E-Commerce', 1.5, ['AMZN', 'SHOP', 'EBAY', 'ETSY']],
  ['Cybersecurity', 0.9, ['CRWD', 'PANW', 'ZS', 'FTNT']],
  ['EV / Clean Energy', -1.3, ['TSLA', 'RIVN', 'NIO', 'LCID']],
  ['Consumer Disc.', 0.6, ['AMZN', 'HD', 'MCD', 'NKE', 'SBUX']],
  ['Financials', 0.8, ['JPM', 'BAC', 'GS', 'MS', 'BRK.B']],
  ['Healthcare', 0.2, ['JNJ', 'UNH', 'ABBV', 'PFE', 'MRK']],
  ['Energy', -0.7, ['XOM', 'CVX', 'COP', 'SLB', 'EOG']],
  ['Industrials', 0.4, ['CAT', 'GE', 'HON', 'RTX', 'UPS']],
  ['Real Estate', -0.5, ['AMT', 'PLD', 'EQIX', 'SPG', 'O']],
  ['Utilities', -0.3, ['NEE', 'DUK', 'SO', 'AEP', 'EXC']],
  ['Materials', 0.1, ['LIN', 'APD', 'SHW', 'FCX', 'NEM']],
  ['Consumer Staples', 0.3, ['PG', 'KO', 'PEP', 'WMT', 'COST']],
  ['Biotech', 1.2, ['AMGN', 'BIIB', 'REGN', 'VRTX', 'MRNA']],
  ['Med Devices', 0.5, ['MDT', 'ABT', 'BSX', 'SYK', 'EW']],
  ['Insurance', 0.6, ['CB', 'MET', 'AIG', 'PRU', 'AFL']],
  ['Banks', 0.9, ['JPM', 'BAC', 'WFC', 'C', 'USB']],
  ['Autos', -0.8, ['TSLA', 'GM', 'F', 'STLA']],
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
  { s: 'NVDA', n: 'Nvidia', sec: 'Semis', px: 1025, mc: 2910, pe: 78, rev: 96.3, eg: 120, moat: 'Wide', roe: 91, yld: 0, alpha: 8.2 },
  { s: 'MSFT', n: 'Microsoft', sec: 'Software', px: 415, mc: 3100, pe: 36, rev: 211, eg: 15, moat: 'Wide', roe: 38, yld: 0.8, alpha: 2.1 },
  { s: 'AAPL', n: 'Apple', sec: 'Hardware', px: 191, mc: 3000, pe: 29, rev: 383, eg: 8, moat: 'Wide', roe: 147, yld: 0.5, alpha: 0.4 },
  { s: 'AMZN', n: 'Amazon', sec: 'E-comm', px: 182, mc: 1900, pe: 55, rev: 575, eg: 32, moat: 'Wide', roe: 18, yld: 0, alpha: 1.9 },
  { s: 'META', n: 'Meta', sec: 'Social', px: 490, mc: 1200, pe: 27, rev: 134, eg: 28, moat: 'Wide', roe: 35, yld: 0.4, alpha: 3.2 },
  { s: 'AVGO', n: 'Broadcom', sec: 'Semis', px: 1330, mc: 612, pe: 31, rev: 47, eg: 20, moat: 'Narrow', roe: 52, yld: 1.2, alpha: 4.1 },
  { s: 'TSLA', n: 'Tesla', sec: 'Auto', px: 168, mc: 536, pe: 42, rev: 96, eg: 22, moat: 'Narrow', roe: 18, yld: 0, alpha: -3.1 },
  { s: 'AMD', n: 'AMD', sec: 'Semis', px: 162, mc: 262, pe: 46, rev: 22, eg: 45, moat: 'Narrow', roe: 4, yld: 0, alpha: 2.4 },
  { s: 'PLTR', n: 'Palantir', sec: 'Software', px: 24, mc: 51, pe: 80, rev: 2.7, eg: 20, moat: 'Narrow', roe: 8, yld: 0, alpha: 5.9 },
  { s: 'CRWD', n: 'CrowdStrike', sec: 'Cybersec', px: 345, mc: 84, pe: 500, rev: 3.1, eg: 33, moat: 'Wide', roe: 5, yld: 0, alpha: 0.8 },
];

export const screenerPresets = [
  { name: 'AI Infrastructure', f: { moat: 'Wide', eg: 30 } },
  { name: 'Quality + Value', f: { moat: 'Wide', pe_max: 35 } },
  { name: 'High Growth', f: { eg: 25 } },
  { name: 'Income & Stability', f: { yld: 0.5 } },
];

// ---- Macro Events ----
export const macro: MacroEvent[] = [
  { dt: 'Mon May 27', ev: 'Memorial Day — US Markets Closed', type: 'holiday' },
  { dt: 'Tue May 28', ev: 'Consumer Confidence (May)', sub: 'Prev: 97.0 | Est: 98.5', type: 'data' },
  { dt: 'Tue May 28', ev: 'Fed Governor Waller Speech', sub: 'Topic: Economic Outlook', type: 'fed' },
  { dt: 'Wed May 29', ev: 'GDP (Q1 2nd Estimate)', sub: 'Prev: 1.6% | Est: 1.5%', type: 'data' },
  { dt: 'Wed May 29', ev: 'FOMC Minutes Release', sub: 'April 30 – May 1 meeting', type: 'fed' },
  { dt: 'Thu May 30', ev: 'PCE Price Index (April)', sub: 'Prev: 0.3% | Est: 0.2%', type: 'data' },
  { dt: 'Thu May 30', ev: 'Jobless Claims', sub: 'Prev: 215K | Est: 218K', type: 'data' },
  { dt: 'Fri May 31', ev: 'ISM Manufacturing (May)', sub: 'Prev: 49.2 | Est: 49.8', type: 'survey' },
  { dt: 'Fri May 31', ev: 'Fed Chair Powell Speech', sub: 'Annual Economic Conference', type: 'speech' },
];

// ---- Commentary ----
export const commentary: CommentaryItem[] = [
  {
    by: 'InvestIQ Analysis', dt: 'May 24',
    title: 'The AI-Industrial Complex: How Hyperscalers Are Reshaping Capex',
    blurb: 'Microsoft, Google, and Meta collectively committed $250B+ in AI infrastructure spending over 2024-2025. We break down who wins and loses in the supply chain.',
    tag: 'AI',
  },
  {
    by: 'InvestIQ Analysis', dt: 'May 22',
    title: 'Reading the Fed: What the Pause Really Means for Equities',
    blurb: 'Rate cuts may be delayed, but the market has largely priced in "higher for longer". Here is what actually matters for multiple expansion.',
    tag: 'Macro',
  },
  {
    by: 'Sector Desk', dt: 'May 21',
    title: 'Semiconductor Cycle Watch: Where Are We Really?',
    blurb: 'Inventory digestion is nearly done for memory, but logic chips are seeing diverging demand. Our model points to a mid-2025 upturn.',
    tag: 'Sectors',
  },
  {
    by: 'InvestIQ Analysis', dt: 'May 20',
    title: 'Consumer Health Check: Bifurcation Is Real',
    blurb: "High-income consumers still splurging; low-income consumers pulling back sharply. Target's miss vs. Costco's beat tells the whole story.",
    tag: 'Consumer',
  },
];

// ---- Weekly Recap ----
export const recap: RecapData = {
  date: 'May 20–24, 2025',
  mkt: "S&P 500 gained 1.3%, led by Tech (+3.1%) and Communication Services (+2.4%). VIX fell to 14.2, its lowest since late 2019. NVIDIA's blowout earnings set the tone for the week.",
  items: [
    { dt: 'Mon May 20', title: 'NVDA blowout kicks off the week', body: 'Nvidia pre-market +8% after reporting EPS of $6.57 vs. $5.56 estimate. Data Center revenue hit $22.6B (+427% YoY). Raised FY25 Data Center forecast.' },
    { dt: 'Tue May 21', title: 'CPI benign, yields fall', body: 'May core CPI at 0.2% m/m, below the 0.3% estimate. 10Y yields fell 9 bps to 4.32%. September rate cut odds rose from 28% to 38%.' },
    { dt: 'Wed May 22', title: 'Target miss weighs on retail', body: 'TGT -7.8% after missing EPS by 11% and cutting full-year guidance. Discretionary categories weakest in 4 quarters. Rival WMT up 5% on their own beat.' },
    { dt: 'Thu May 23', title: 'Jobless claims steady', body: 'Weekly claims 215K, in-line with estimates. Continuing claims ticked up slightly to 1.79M. Labor market remains resilient despite elevated rates.' },
    { dt: 'Fri May 24', title: 'Markets close near highs', body: 'Broad rally Friday ahead of long weekend. S&P closed at 5,312, up 1.3% on the week. Tech and Semis led; Energy and Real Estate lagged.' },
  ],
};
