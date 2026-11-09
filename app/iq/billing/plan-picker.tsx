"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchPlans } from "./api";
import { displayPrice, INTERVALS, isPaid, type BillingInterval, type CatalogPlan } from "./catalog";
import { firebaseAuth } from "../../firebase";
import { loadIntent, managePlanPath, parsePlanParams, saveIntent, type PlanIntent } from "./plan-intent";
import { pill } from "./ui";

/**
 * Signup plan picker. Preselects ?plan=&interval= from the website tiles
 * (invalid params → no preselection, i.e. Free), keeps the choice in
 * sessionStorage so it survives Google sign-in, and offers a promo code field
 * for paid plans (validated server-side before checkout).
 */
export function PlanPicker({ onChange }: { onChange?: (intent: PlanIntent | null, plans: CatalogPlan[]) => void }) {
  const [plans, setPlans] = useState<CatalogPlan[]>([]);
  const [paidAvailable, setPaidAvailable] = useState(false);
  const [intent, setIntent] = useState<PlanIntent | null>(null);
  const [interval, setInterval] = useState<BillingInterval>("annual");
  const [promo, setPromo] = useState("");

  useEffect(() => {
    let live = true;
    fetchPlans()
      .then(({ plans: p, paidPlansAvailable }) => {
        if (!live) return;
        setPlans(p);
        setPaidAvailable(paidPlansAvailable);
        const ids = p.map((x) => x.id);
        const fromUrl = typeof window !== "undefined" ? parsePlanParams(window.location.search, ids) : null;
        const chosen = fromUrl ?? loadIntent(ids);
        if (chosen) {
          setIntent(chosen);
          setInterval(chosen.interval);
          setPromo(chosen.promoCode ?? "");
        }
        // Already signed in? Go to Manage Plan with that plan selected.
        void firebaseAuth.authStateReady?.().then(() => {
          if (live && firebaseAuth.currentUser && fromUrl) window.location.replace(managePlanPath(fromUrl));
        });
      })
      .catch(() => setPlans([]));
    return () => {
      live = false;
    };
  }, []);

  const selected = intent?.planId ?? "free";
  const effective = useMemo<PlanIntent | null>(() => {
    if (!paidAvailable || selected === "free") return null;
    return { planId: selected, interval, ...(promo.trim() ? { promoCode: promo.trim() } : {}) };
  }, [paidAvailable, selected, interval, promo]);

  useEffect(() => {
    saveIntent(effective);
    onChange?.(effective, plans);
  }, [effective, plans, onChange]);

  if (!plans.length) return null;

  return (
    <div data-testid="plan-picker" style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: ".72rem", fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--text-dim-solid)" }}>Choose your plan</span>
        <div role="group" aria-label="Billing period" style={{ display: "flex", gap: 6 }}>
          {INTERVALS.map((i) => (
            <button key={i} type="button" aria-pressed={interval === i} style={pill(interval === i)} onClick={() => setInterval(i)}>
              {i === "monthly" ? "Monthly" : "Annual"}
            </button>
          ))}
        </div>
      </div>
      <div role="radiogroup" aria-label="Plans" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 8 }}>
        {plans.map((p) => {
          const checked = selected === p.id;
          const price = isPaid(p) ? displayPrice(p, interval) : null;
          const disabled = isPaid(p) && !paidAvailable;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={checked}
              data-testid={`plan-${p.id}`}
              disabled={disabled}
              onClick={() => setIntent(p.id === "free" ? null : { planId: p.id, interval })}
              style={{
                textAlign: "left", padding: 12, borderRadius: 12, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1,
                border: `2px solid ${checked ? "var(--brand)" : "var(--border)"}`, background: checked ? "var(--brand-dim)" : "var(--surface-2)", color: "var(--text)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <b style={{ color: "var(--text-hi)" }}>{p.name}</b>
                {checked && <span aria-hidden style={{ color: "var(--brand-2)", fontWeight: 800 }}>✓ Selected</span>}
              </div>
              <div style={{ fontSize: ".95rem", fontWeight: 700, marginTop: 4 }}>{price ? `${price.perMonth}/mo` : "Free"}</div>
              <div style={{ fontSize: ".7rem", color: "var(--text-dim-solid)" }}>{disabled ? "Launching soon" : price ? price.billed : "Core screens"}</div>
            </button>
          );
        })}
      </div>
      {!paidAvailable && <div style={{ fontSize: ".74rem", color: "var(--text-dim-solid)" }}>Paid plans are launching soon. You can start on Free today.</div>}
      {effective && (
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: ".74rem", color: "var(--text-dim-solid)" }}>
          Promo code (optional)
          <input
            data-testid="promo-input"
            value={promo}
            maxLength={40}
            onChange={(e) => setPromo(e.target.value.toUpperCase())}
            placeholder="e.g. WELCOME10"
            style={{ height: 36, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-1)", color: "var(--text-hi)", padding: "0 10px" }}
          />
          <span>You'll see the discounted price before paying.</span>
        </label>
      )}
    </div>
  );
}
