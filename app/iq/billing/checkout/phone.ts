/**
 * Mobile number input → E.164. Mirrors the backend rule
 * (MarketCatalystBackEnd/src/billing/checkout/phone.ts): +<country code><number>,
 * at most 15 digits; +1 (NANP) numbers are 10 digits with area code and
 * exchange not starting with 0 or 1. No verification.
 */
export interface DialCountry {
  iso: string;
  name: string;
  dial: string;
}

/** US first (preselected); the rest alphabetical. */
export const DIAL_COUNTRIES: DialCountry[] = [
  { iso: "US", name: "United States", dial: "+1" },
  { iso: "AU", name: "Australia", dial: "+61" },
  { iso: "BR", name: "Brazil", dial: "+55" },
  { iso: "CA", name: "Canada", dial: "+1" },
  { iso: "FR", name: "France", dial: "+33" },
  { iso: "DE", name: "Germany", dial: "+49" },
  { iso: "IN", name: "India", dial: "+91" },
  { iso: "IE", name: "Ireland", dial: "+353" },
  { iso: "JP", name: "Japan", dial: "+81" },
  { iso: "MX", name: "Mexico", dial: "+52" },
  { iso: "NL", name: "Netherlands", dial: "+31" },
  { iso: "SG", name: "Singapore", dial: "+65" },
  { iso: "ES", name: "Spain", dial: "+34" },
  { iso: "AE", name: "United Arab Emirates", dial: "+971" },
  { iso: "GB", name: "United Kingdom", dial: "+44" },
];
export const DEFAULT_DIAL_COUNTRY = "US";

const E164 = /^\+[1-9]\d{7,14}$/;
const NANP = /^\+1[2-9]\d{2}[2-9]\d{6}$/;

export function toE164(dial: string, national: string): string | null {
  let digits = String(national ?? "").replace(/\D/g, "");
  // People often type the trunk prefix (0…) or the country code again.
  const cc = dial.replace("+", "");
  if (digits.startsWith(cc) && digits.length > 10) digits = digits.slice(cc.length);
  if (dial !== "+1") digits = digits.replace(/^0+/, "");
  const e164 = `${dial}${digits}`;
  if (!E164.test(e164)) return null;
  if (dial === "+1" && !NANP.test(e164)) return null;
  return e164;
}
