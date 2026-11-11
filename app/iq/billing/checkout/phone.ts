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
  placeholder?: string;
}

/** US first (preselected); the rest alphabetical. */
export const DIAL_COUNTRIES: DialCountry[] = [
  { iso: "US", name: "United States", dial: "+1", placeholder: "(512) 555-0147" },
  { iso: "AU", name: "Australia", dial: "+61", placeholder: "412 345 678" },
  { iso: "BR", name: "Brazil", dial: "+55", placeholder: "11 91234-5678" },
  { iso: "CA", name: "Canada", dial: "+1", placeholder: "(416) 555-0147" },
  { iso: "FR", name: "France", dial: "+33", placeholder: "6 12 34 56 78" },
  { iso: "DE", name: "Germany", dial: "+49", placeholder: "1512 3456789" },
  { iso: "IN", name: "India", dial: "+91", placeholder: "98765 43210" },
  { iso: "IE", name: "Ireland", dial: "+353", placeholder: "87 123 4567" },
  { iso: "JP", name: "Japan", dial: "+81", placeholder: "90 1234 5678" },
  { iso: "MX", name: "Mexico", dial: "+52", placeholder: "55 1234 5678" },
  { iso: "NL", name: "Netherlands", dial: "+31", placeholder: "6 12345678" },
  { iso: "SG", name: "Singapore", dial: "+65", placeholder: "8123 4567" },
  { iso: "ES", name: "Spain", dial: "+34", placeholder: "612 34 56 78" },
  { iso: "AE", name: "United Arab Emirates", dial: "+971", placeholder: "50 123 4567" },
  { iso: "GB", name: "United Kingdom", dial: "+44", placeholder: "7911 123456" },
];
export const DEFAULT_DIAL_COUNTRY = "US";

export function phonePlaceholder(iso: string): string {
  const c = DIAL_COUNTRIES.find((d) => d.iso === iso);
  return c?.placeholder ?? "(512) 555-0147";
}

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
