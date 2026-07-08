export interface MacroSeriesDef {
  name: string;
  seriesId: string;
  unit: string;
  importance: 'high' | 'medium' | 'low';
  country: string;
}

/**
 * Curated list of key US macro indicators synced from FRED — an editorial
 * choice (which series matter), not vendor data itself, same pattern as
 * TICKER_UNIVERSE. Series IDs are FRED's standard, stable identifiers.
 */
export const MACRO_SERIES: MacroSeriesDef[] = [
  {
    name: 'CPI (All Items)',
    seriesId: 'CPIAUCSL',
    unit: 'index',
    importance: 'high',
    country: 'US',
  },
  {
    name: 'Core CPI (ex Food & Energy)',
    seriesId: 'CPILFESL',
    unit: 'index',
    importance: 'high',
    country: 'US',
  },
  {
    name: 'Unemployment Rate',
    seriesId: 'UNRATE',
    unit: '%',
    importance: 'high',
    country: 'US',
  },
  {
    name: 'Nonfarm Payrolls',
    seriesId: 'PAYEMS',
    unit: 'thousands',
    importance: 'high',
    country: 'US',
  },
  {
    name: 'Effective Fed Funds Rate',
    seriesId: 'FEDFUNDS',
    unit: '%',
    importance: 'high',
    country: 'US',
  },
  {
    name: '10-Year Treasury Yield',
    seriesId: 'DGS10',
    unit: '%',
    importance: 'medium',
    country: 'US',
  },
  {
    name: 'PPI (Final Demand, Commodities)',
    seriesId: 'PPIACO',
    unit: 'index',
    importance: 'medium',
    country: 'US',
  },
  {
    name: 'Retail Sales',
    seriesId: 'RSAFS',
    unit: '$ millions',
    importance: 'medium',
    country: 'US',
  },
  {
    name: 'Initial Jobless Claims',
    seriesId: 'ICSA',
    unit: 'claims',
    importance: 'medium',
    country: 'US',
  },
  {
    name: 'Real GDP',
    seriesId: 'GDP',
    unit: '$ billions',
    importance: 'high',
    country: 'US',
  },
  {
    name: 'Industrial Production',
    seriesId: 'INDPRO',
    unit: 'index',
    importance: 'low',
    country: 'US',
  },
  {
    name: 'Consumer Sentiment (UMich)',
    seriesId: 'UMCSENT',
    unit: 'index',
    importance: 'medium',
    country: 'US',
  },
];
