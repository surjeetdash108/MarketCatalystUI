"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { errorBody, getContact, updateContact, type Contact } from "../billing/api";
import { DEFAULT_DIAL_COUNTRY, DIAL_COUNTRIES, phonePlaceholder, toE164 } from "../billing/checkout/phone";
import { Button, Notice } from "../billing/ui";

/** Staff full access: no plans, checkout, upgrade prompts or retention — nothing is billed. */
export function StaffPlan() {
  return (
    <>
      <div className="page-head"><div><div className="page-title">Manage Plan</div><div className="page-sub">Staff access</div></div></div>
      <div className="dash" style={{ maxWidth: 980, gridTemplateColumns: "1fr" }}>
        <div className="card col-12" data-testid="staff-plan">
          <div className="card-h"><h3>Staff access</h3></div>
          <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: "1.05rem", color: "var(--text-hi)" }}><b>Staff</b> · every feature</div>
            <div style={{ fontSize: ".84rem", color: "var(--text-dim-solid)" }}>Your account has full access to every feature and is never billed. It doesn&apos;t include the admin console.</div>
            <Link href="/dashboard" style={{ color: "var(--brand-2)", fontSize: ".84rem" }}>Back to the dashboard</Link>
          </div>
        </div>
      </div>
    </>
  );
}

/** Mobile number (E.164, stored backend-only and sent to the billing provider) + product-updates opt-in. */
export function ContactCard() {
  const [contact, setContact] = useState<Contact | null>(null);
  const [editing, setEditing] = useState(false);
  const [dialIso, setDialIso] = useState(DEFAULT_DIAL_COUNTRY);
  const [national, setNational] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    void getContact().then(setContact).catch(() => setContact(null));
  }, []);

  if (!contact) return null;
  const dial = DIAL_COUNTRIES.find((d) => d.iso === dialIso)?.dial ?? "+1";
  const e164 = toE164(dial, national);

  async function save(patch: { phone?: string; marketingOptIn?: boolean }) {
    setMsg(null);
    try {
      setContact(await updateContact(patch));
      setEditing(false);
      setMsg({ tone: "ok", text: "Saved." });
    } catch (e) {
      setMsg({ tone: "error", text: errorBody(e).message ?? "Couldn't save." });
    }
  }

  return (
    <div className="card col-12" data-testid="contact-card">
      <div className="card-h"><h3>Mobile number</h3></div>
      <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {!editing ? (
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span data-testid="contact-phone" style={{ color: "var(--text-hi)" }}>{contact.phone ?? "Not set"}</span>
            <Button kind="secondary" testId="contact-edit" onClick={() => setEditing(true)}>{contact.phone ? "Change" : "Add"}</Button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select aria-label="Country code" value={dialIso} onChange={(e) => setDialIso(e.target.value)} style={{ height: 34, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-hi)" }}>
              {DIAL_COUNTRIES.map((d) => <option key={d.iso} value={d.iso}>{d.iso} {d.dial}</option>)}
            </select>
            <input data-testid="contact-input" type="tel" inputMode="tel" value={national} onChange={(e) => setNational(e.target.value)} placeholder={phonePlaceholder(dialIso)} style={{ height: 34, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-hi)", padding: "0 10px" }} />
            <Button testId="contact-save" disabled={!e164} onClick={() => e164 && void save({ phone: e164 })}>Save</Button>
            <Button kind="secondary" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        )}
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: ".82rem" }}>
          <input type="checkbox" data-testid="contact-optin" checked={contact.marketingOptIn.optedIn} onChange={(e) => void save({ marketingOptIn: e.target.checked })} />
          Text me product updates
        </label>
        <div style={{ fontSize: ".74rem", color: "var(--text-dim-solid)" }}>Used for account and billing contact. We never send marketing texts unless you opt in.</div>
        {msg && <Notice tone={msg.tone} testId="contact-msg">{msg.text}</Notice>}
      </div>
    </div>
  );
}
