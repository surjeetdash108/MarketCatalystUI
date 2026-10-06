/**
 * Display label for a listing venue.
 *
 * The backend's `exchange` field isn't one vocabulary: FMP profiles carry short
 * names ("NASDAQ", "NYSE", "AMEX", "OTC", "PNK") or long ones ("NASDAQ Global
 * Select", "Other OTC"), while Polygon reference data carries ISO MIC codes
 * ("XNAS", "XNYS", "OTCM"). Normalises all of them to the label a trader
 * expects, so an OTC name like TCEHY reads "OTC" rather than whatever raw code
 * the vendor happened to send. Returns null for a missing value so callers can
 * omit the venue rather than guess one.
 */
const MIC_LABELS: Record<string, string> = {
  XNAS: "NASDAQ", XNGS: "NASDAQ", XNMS: "NASDAQ", XNCM: "NASDAQ",
  XNYS: "NYSE",
  ARCX: "NYSE Arca",
  XASE: "NYSE American", AMEX: "NYSE American",
  BATS: "Cboe", XCBO: "Cboe", BZX: "Cboe",
  IEXG: "IEX",
  // OTC Markets tiers (OTCQX / OTCQB / Pink / Expert) and FMP's "PNK".
  OTC: "OTC", OTCM: "OTC", OOTC: "OTC", PINX: "OTC", PNK: "OTC",
  OTCQX: "OTC", OTCQB: "OTC", EXPM: "OTC", OTCB: "OTC", PSGM: "OTC",
};

export function exchangeLabel(raw: string | null | undefined): string | null {
  const v = raw?.trim();
  if (!v) return null;
  const up = v.toUpperCase();
  if (MIC_LABELS[up]) return MIC_LABELS[up];
  // Long-form names: check OTC before NASDAQ/NYSE so "OTC (via NASDAQ)"-style
  // strings don't get promoted to a listed exchange.
  if (/\bOTC\b|PINK/.test(up)) return "OTC";
  if (up.includes("NASDAQ")) return "NASDAQ";
  if (up.includes("ARCA")) return "NYSE Arca";
  if (up.includes("AMERICAN") || up.includes("MKT")) return "NYSE American";
  if (up.includes("NYSE") || up.includes("NEW YORK STOCK EXCHANGE")) return "NYSE";
  if (up.includes("CBOE") || up.includes("BATS")) return "Cboe";
  return v;
}
