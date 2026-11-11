"use client";

import type { CSSProperties } from "react";
import type { BillingAddress } from "./model";

export const ADDRESS_COUNTRIES: Array<[string, string]> = [
  ["US", "United States"], ["CA", "Canada"], ["GB", "United Kingdom"], ["AU", "Australia"], ["DE", "Germany"],
  ["FR", "France"], ["IE", "Ireland"], ["IN", "India"], ["NL", "Netherlands"], ["SG", "Singapore"], ["ES", "Spain"],
];
export const US_STATES = "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ");

export const fieldStyle: CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-hi)", fontSize: ".86rem", fontFamily: "var(--f-body)" };
export const labelStyle: CSSProperties = { display: "block", fontSize: ".7rem", fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--text-dim-solid)", marginBottom: 6 };

/**
 * Same fields and order as Stripe's Address Element (full name, country, line 1,
 * line 2, city, state, ZIP). Used by the FAKE provider's simulated form only —
 * with Stripe the Address Element renders these.
 */
export function SimulatedAddressFields({ value, onChange, disabled }: { value: BillingAddress; onChange: (a: BillingAddress) => void; disabled?: boolean }) {
  const set = (k: keyof BillingAddress, v: string) => onChange({ ...value, [k]: v === "" && (k === "line2" || k === "state" || k === "postalCode") ? null : v });
  return (
    <div className="co-grid2" data-testid="address-element">
      <label className="co-span2">
        <span style={labelStyle}>Full name <span style={{ color: "#ef4444" }}>*</span></span>
        <input style={fieldStyle} autoComplete="name" disabled={disabled} value={value.name} onChange={(e) => set("name", e.target.value)} data-testid="addr-name" />
      </label>
      <label className="co-span2">
        <span style={labelStyle}>Country <span style={{ color: "#ef4444" }}>*</span></span>
        <select style={fieldStyle} autoComplete="country" disabled={disabled} value={value.country} onChange={(e) => set("country", e.target.value)} data-testid="addr-country">
          {ADDRESS_COUNTRIES.map(([iso, name]) => <option key={iso} value={iso}>{name}</option>)}
        </select>
      </label>
      <label className="co-span2">
        <span style={labelStyle}>Address line 1 <span style={{ color: "#ef4444" }}>*</span></span>
        <input style={fieldStyle} autoComplete="address-line1" disabled={disabled} value={value.line1} onChange={(e) => set("line1", e.target.value)} data-testid="addr-line1" />
      </label>
      <label className="co-span2">
        <span style={labelStyle}>Address line 2 (optional)</span>
        <input style={fieldStyle} autoComplete="address-line2" disabled={disabled} value={value.line2 ?? ""} onChange={(e) => set("line2", e.target.value)} data-testid="addr-line2" />
      </label>
      <label>
        <span style={labelStyle}>City <span style={{ color: "#ef4444" }}>*</span></span>
        <input style={fieldStyle} autoComplete="address-level2" disabled={disabled} value={value.city} onChange={(e) => set("city", e.target.value)} data-testid="addr-city" />
      </label>
      <label>
        <span style={labelStyle}>
          {value.country === "US" ? "State" : "State / region"} <span style={{ color: "#ef4444" }}>*</span>
        </span>
        {value.country === "US" ? (
          <select style={fieldStyle} autoComplete="address-level1" disabled={disabled} value={value.state ?? ""} onChange={(e) => set("state", e.target.value)} data-testid="addr-state">
            <option value="">Select…</option>
            {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        ) : (
          <input style={fieldStyle} autoComplete="address-level1" disabled={disabled} value={value.state ?? ""} onChange={(e) => set("state", e.target.value)} data-testid="addr-state" />
        )}
      </label>
      <label>
        <span style={labelStyle}>
          {value.country === "US" ? "ZIP" : "Postal code"} <span style={{ color: "#ef4444" }}>*</span>
        </span>
        <input style={fieldStyle} autoComplete="postal-code" disabled={disabled} value={value.postalCode ?? ""} onChange={(e) => set("postalCode", e.target.value)} data-testid="addr-zip" />
      </label>
    </div>
  );
}
