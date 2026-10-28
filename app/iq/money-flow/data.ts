/**
 * Money Flow Constituent Data & Sector Mappings
 * Extracted from MarketCatalystDashboard.html
 */

export interface ConstituentDef {
  ticker: string;
  name: string;
  sector: string;
  basePrice: number;
  realMove?: number;
  realVol?: number;
}

export const SECTORS_LIST = [
  "Technology Services",
  "Electronic Technology",
  "Energy Minerals",
  "Communications",
  "Finance",
  "Health Technology",
  "Health Services",
  "Consumer Durables",
  "Consumer Non-Durables",
  "Consumer Services",
  "Consumer Defensive",
  "Retail Trade",
  "Transportation",
  "Process Industries",
  "Producer Manufacturing",
  "Industrial Services",
  "Non-Energy Minerals",
  "Utilities",
  "Commercial Services",
  "Distribution Services",
] as const;

export type SectorName = (typeof SECTORS_LIST)[number];

export const SECTOR_BIAS: Record<string, number> = {
  Semis: 1.4,
  Software: 0.5,
  Comm: 0.4,
  Consumer: -0.3,
  Financials: 0.2,
  Energy: -1.3,
  Health: -0.8,
  Industrials: 0.1,
  "Real Estate": -0.5,
  "Tech HW": 0.7,
  Utilities: 0.3,
  Materials: -0.7,
  Staples: 0.15,
};

/** S&P 500 Constituent Universe */
export const SP500_CONSTITUENTS: Array<[string, string, string, number, number?, number?]> = [
  ["MSFT", "Microsoft", "Technology Services", 524.51, 0.66, 1.1],
  ["GOOGL", "Alphabet", "Technology Services", 320.21, -1.24, 1.2],
  ["META", "Meta Platforms", "Technology Services", 642.62, -0.96, 1.3],
  ["CRM", "Salesforce", "Technology Services", 262.15, 0.41, 1.0],
  ["ADBE", "Adobe", "Technology Services", 358.70, -0.27, 0.9],
  ["NOW", "ServiceNow", "Technology Services", 948.30, 0.88, 1.1],
  ["ACN", "Accenture", "Technology Services", 249.37, -3.62, 2.1],
  ["NVDA", "NVIDIA", "Electronic Technology", 210.96, -0.59, 1.06],
  ["AAPL", "Apple", "Electronic Technology", 347.73, -0.14, 1.0],
  ["AVGO", "Broadcom", "Electronic Technology", 343.72, -0.48, 1.1],
  ["MU", "Micron", "Electronic Technology", 198.30, 2.46, 1.6],
  ["AMD", "AMD", "Electronic Technology", 241.05, 1.74, 1.4],
  ["INTC", "Intel", "Electronic Technology", 38.42, 1.72, 1.5],
  ["CSCO", "Cisco", "Electronic Technology", 107.59, 1.53, 1.3],
  ["TSM", "TSMC", "Electronic Technology", 296.10, 1.49, 1.2],
  ["ASML", "ASML", "Electronic Technology", 1012.40, 0.72, 1.1],
  ["XOM", "Exxon Mobil", "Energy Minerals", 121.75, 2.79, 1.5],
  ["CVX", "Chevron", "Energy Minerals", 158.40, 2.88, 1.6],
  ["COP", "ConocoPhillips", "Energy Minerals", 112.40, 2.10, 1.3],
  ["OXY", "Occidental", "Energy Minerals", 52.30, 1.95, 1.4],
  ["VZ", "Verizon", "Communications", 39.80, -4.62, 2.2],
  ["T", "AT&T", "Communications", 25.10, -4.10, 2.0],
  ["TMUS", "T-Mobile US", "Communications", 228.40, -4.42, 1.9],
  ["JPM", "JPMorgan Chase", "Finance", 301.22, -1.47, 1.2],
  ["BAC", "Bank of America", "Finance", 49.20, -1.10, 1.1],
  ["GS", "Goldman Sachs", "Finance", 891.30, -0.85, 1.0],
  ["BK", "BNY Mellon", "Finance", 104.30, -0.72, 1.0],
  ["V", "Visa", "Finance", 351.20, -0.36, 0.9],
  ["LLY", "Eli Lilly", "Health Technology", 812.40, -2.54, 1.5],
  ["JNJ", "Johnson & Johnson", "Health Technology", 257.74, -1.42, 1.2],
  ["ABBV", "AbbVie", "Health Technology", 224.60, 0.16, 0.9],
  ["MRK", "Merck", "Health Technology", 147.24, -0.90, 1.0],
  ["PFE", "Pfizer", "Health Technology", 24.70, -0.64, 1.0],
  ["UNH", "UnitedHealth", "Health Services", 512.30, 0.92, 1.1],
  ["CVS", "CVS Health", "Health Services", 71.20, 1.30, 1.2],
  ["TSLA", "Tesla", "Consumer Durables", 372.22, -0.63, 1.1],
  ["GM", "General Motors", "Consumer Durables", 58.40, -1.10, 1.1],
  ["LEN", "Lennar", "Consumer Durables", 84.45, -1.00, 1.1],
  ["KO", "Coca-Cola", "Consumer Non-Durables", 66.10, -2.76, 1.6],
  ["PG", "Procter & Gamble", "Consumer Non-Durables", 165.59, -1.80, 1.3],
  ["PEP", "PepsiCo", "Consumer Non-Durables", 142.30, -2.10, 1.4],
  ["PM", "Philip Morris", "Consumer Defensive", 158.20, 0.50, 1.0],
  ["MO", "Altria", "Consumer Defensive", 59.40, -0.20, 0.9],
  ["MCD", "McDonald’s", "Consumer Services", 252.63, 0.40, 1.0],
  ["SBUX", "Starbucks", "Consumer Services", 88.40, 1.10, 1.2],
  ["DIS", "Walt Disney", "Consumer Services", 112.30, -0.44, 1.0],
  ["AMZN", "Amazon", "Retail Trade", 248.00, -0.95, 1.2],
  ["HD", "Home Depot", "Retail Trade", 398.10, -0.58, 1.0],
  ["COST", "Costco", "Retail Trade", 918.40, 0.22, 0.9],
  ["WMT", "Walmart", "Retail Trade", 104.60, 0.31, 0.9],
  ["CSX", "CSX", "Transportation", 51.67, 1.10, 1.2],
  ["UNP", "Union Pacific", "Transportation", 236.40, 0.85, 1.1],
  ["UPS", "UPS", "Transportation", 98.20, -0.60, 1.0],
  ["DOW", "Dow Inc", "Process Industries", 31.81, 1.40, 1.3],
  ["LIN", "Linde", "Process Industries", 468.30, 0.60, 1.0],
  ["CAT", "Caterpillar", "Producer Manufacturing", 704.05, 1.20, 1.2],
  ["AMAT", "Applied Materials", "Producer Manufacturing", 375.58, 1.05, 1.2],
  ["LRCX", "Lam Research", "Producer Manufacturing", 230.15, 0.90, 1.1],
  ["PWR", "Quanta Services", "Industrial Services", 552.44, 1.80, 1.4],
  ["SLB", "Schlumberger", "Industrial Services", 41.20, 2.20, 1.5],
  ["FCX", "Freeport-McMoRan", "Non-Energy Minerals", 48.60, 2.60, 1.6],
  ["NEM", "Newmont", "Non-Energy Minerals", 82.10, -0.90, 1.2],
  ["NEE", "NextEra Energy", "Utilities", 82.30, 0.70, 1.0],
  ["DUK", "Duke Energy", "Utilities", 124.60, 0.45, 0.9],
  ["SO", "Southern Co", "Utilities", 91.80, 0.30, 0.9],
  ["SPGI", "S&P Global", "Commercial Services", 512.40, 0.20, 0.9],
  ["ADP", "ADP", "Commercial Services", 298.70, -0.30, 0.9],
  ["MCK", "McKesson", "Distribution Services", 742.10, 0.55, 1.0],
  ["SYY", "Sysco", "Distribution Services", 78.30, -0.40, 0.9],
  ["NFLX", "Netflix", "Technology Services", 1182.40, -2.10, 1.5],
  ["INTU", "Intuit", "Technology Services", 684.20, 0.35, 1.0],
  ["QCOM", "Qualcomm", "Electronic Technology", 172.40, 1.90, 1.4],
  ["TXN", "Texas Instruments", "Electronic Technology", 184.30, 1.20, 1.2],
  ["PANW", "Palo Alto Networks", "Technology Services", 198.60, -1.60, 1.3],
  ["CRWD", "CrowdStrike", "Technology Services", 468.90, -2.30, 1.5],
  ["MRVL", "Marvell", "Electronic Technology", 92.40, 2.90, 1.7],
  ["KLAC", "KLA", "Electronic Technology", 884.10, 1.40, 1.2],
  ["CDNS", "Cadence Design", "Technology Services", 338.20, -0.80, 1.0],
  ["ISRG", "Intuitive Surgical", "Health Technology", 552.10, -1.30, 1.1],
  ["GILD", "Gilead", "Health Technology", 118.40, -1.90, 1.3],
  ["VRTX", "Vertex", "Health Technology", 462.50, -1.10, 1.1],
  ["BKNG", "Booking", "Consumer Services", 5320.40, 0.90, 1.0],
  ["MELI", "MercadoLibre", "Retail Trade", 2104.30, 1.60, 1.2],
  ["PYPL", "PayPal", "Commercial Services", 68.90, 0.74, 1.1],
  ["ABNB", "Airbnb", "Consumer Services", 132.60, 1.40, 1.2],
  ["HON", "Honeywell", "Producer Manufacturing", 212.40, 0.60, 1.0],
  ["MDLZ", "Mondelez", "Consumer Non-Durables", 61.20, -2.40, 1.4],
];

/** Nasdaq 100 Constituent Subset (implemented for filtering, toggle commented in UI) */
export const NASDAQ_SET = new Set([
  "MSFT", "GOOGL", "META", "ADBE", "NVDA", "AAPL", "AVGO", "MU", "AMD",
  "INTC", "CSCO", "ASML", "TSLA", "AMZN", "COST", "SBUX", "PEP", "TMUS",
  "AMAT", "LRCX", "CSX", "ADP", "LIN", "NFLX", "INTU", "QCOM", "TXN",
  "PANW", "CRWD", "MRVL", "KLAC", "CDNS", "ISRG", "GILD", "VRTX", "BKNG",
  "MELI", "PYPL", "ABNB", "HON", "MDLZ",
]);

export const NON_SPX_SET = new Set(["ASML", "TSM", "MELI"]);

export const SP500_TICKERS = SP500_CONSTITUENTS.map((c) => c[0]);
