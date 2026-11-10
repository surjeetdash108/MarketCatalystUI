"use client";

import { useEffect, useState } from "react";
import { PLANS } from "../feature-map.generated";
import { fetchPlans, checkSignupPromo, type SignupPromoResponse } from "./api";
import {
  displayPrice,
  formatMoney,
  INTERVALS,
  type BillingInterval,
  type CatalogPlan,
} from "./catalog";
import { pill } from "./ui";

export interface PlanPickerProps {
  selectedPlan: string;
  onSelectPlan: (planId: string) => void;
  interval: BillingInterval;
  onChangeInterval: (interval: BillingInterval) => void;
  promoCode: string;
  onPromoChange: (promo: string) => void;
  promoResult: SignupPromoResponse | null;
  setPromoResult: (res: SignupPromoResponse | null) => void;
  promoError: string | null;
  setPromoError: (err: string | null) => void;
}

export function PlanPicker({
  selectedPlan,
  onSelectPlan,
  interval,
  onChangeInterval,
  promoCode,
  onPromoChange,
  promoResult,
  setPromoResult,
  promoError,
  setPromoError,
}: PlanPickerProps) {
  const [catalogPlans, setCatalogPlans] = useState<CatalogPlan[]>([]);
  const [checkingPromo, setCheckingPromo] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchPlans()
      .then((res) => {
        if (active) setCatalogPlans(res.plans);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  async function handleApplyPromo() {
    if (!promoCode.trim()) return;
    setCheckingPromo(true);
    setPromoError(null);
    try {
      const res = await checkSignupPromo({
        code: promoCode.trim(),
        planId: selectedPlan,
        interval,
      });
      setPromoResult(res);
    } catch {
      setPromoResult(null);
      setPromoError("Invalid promo code");
    } finally {
      setCheckingPromo(false);
    }
  }

  return (
    <div
      data-testid="plan-picker"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        margin: "12px 0 6px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <label
          style={{
            fontSize: ".72rem",
            fontWeight: 700,
            letterSpacing: ".06em",
            textTransform: "uppercase",
            color: "var(--text-dim-solid)",
          }}
        >
          Choose your plan
        </label>
        <div
          role="group"
          aria-label="Billing interval"
          style={{
            display: "inline-flex",
            gap: 4,
            background: "var(--surface-0)",
            padding: 3,
            borderRadius: 99,
            border: "1px solid var(--border)",
          }}
        >
          {INTERVALS.map((i) => (
            <button
              key={i}
              type="button"
              aria-pressed={interval === i}
              style={{
                ...pill(interval === i),
                padding: "3px 10px",
                fontSize: ".72rem",
              }}
              onClick={() => {
                onChangeInterval(i);
                setPromoResult(null);
              }}
              data-testid={`signup-interval-${i}`}
            >
              {i === "monthly" ? "Monthly" : "Annual (save up to 25%)"}
            </button>
          ))}
        </div>
      </div>

      {/* Plan Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: 10,
        }}
      >
        {PLANS.map((p) => {
          const livePlan = catalogPlans.find((cp) => cp.id === p.id);
          const price = livePlan ? displayPrice(livePlan, interval) : null;
          const isSelected = selectedPlan === p.id;
          return (
            <div
              key={p.id}
              data-testid={`signup-plan-card-${p.id}`}
              onClick={() => {
                onSelectPlan(p.id);
                setPromoResult(null);
              }}
              style={{
                border: isSelected
                  ? "2px solid var(--brand)"
                  : "1px solid var(--border)",
                background: isSelected
                  ? "var(--brand-dim)"
                  : "var(--surface-1)",
                borderRadius: "var(--r, 8px)",
                padding: "10px 12px",
                cursor: "pointer",
                transition: "all .14s",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <b
                  style={{
                    fontSize: ".88rem",
                    color: isSelected ? "var(--brand-2)" : "var(--text-hi)",
                  }}
                >
                  {p.name}
                </b>
                {p.id === "pro" && (
                  <span
                    style={{
                      fontSize: ".6rem",
                      fontWeight: 700,
                      color: "var(--brand-2)",
                      textTransform: "uppercase",
                    }}
                  >
                    Popular
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: "1.05rem",
                  fontWeight: 800,
                  color: "var(--text-hi)",
                }}
              >
                {price ? price.perMonth : "—"}
                <span
                  style={{
                    fontSize: ".7rem",
                    fontWeight: 500,
                    color: "var(--text-dim-solid)",
                  }}
                >
                  /mo
                </span>
              </div>
              <div
                style={{
                  fontSize: ".68rem",
                  color: "var(--text-dim-solid)",
                }}
              >
                {price ? price.billed : "—"}
              </div>
              <div
                style={{
                  marginTop: 6,
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                  fontSize: ".7rem",
                  color: "var(--text)",
                }}
              >
                {p.bullets.slice(0, 2).map((b, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 4 }}>
                    <span style={{ color: "var(--brand-2)" }}>✓</span>
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {b}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Promo Code Input */}
      <div style={{ marginTop: 4 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            data-testid="signup-promo-input"
            type="text"
            placeholder="Promo code (optional)"
            value={promoCode}
            onChange={(e) => {
              onPromoChange(e.target.value.toUpperCase());
              setPromoResult(null);
              setPromoError(null);
            }}
            style={{
              flex: 1,
              height: 36,
              background: "var(--surface-0)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r)",
              padding: "0 10px",
              fontSize: ".82rem",
              color: "var(--text-hi)",
              outline: "none",
            }}
          />
          <button
            type="button"
            data-testid="signup-promo-apply"
            onClick={() => void handleApplyPromo()}
            disabled={checkingPromo || !promoCode.trim()}
            style={{
              padding: "0 14px",
              height: 36,
              borderRadius: "var(--r)",
              background: "var(--surface-2)",
              border: "1px solid var(--border-strong)",
              color: "var(--text-hi)",
              fontSize: ".8rem",
              fontWeight: 600,
              cursor: checkingPromo || !promoCode.trim() ? "not-allowed" : "pointer",
              opacity: checkingPromo || !promoCode.trim() ? 0.6 : 1,
            }}
          >
            {checkingPromo ? "…" : "Apply"}
          </button>
        </div>

        {promoResult && (
          <div
            data-testid="signup-promo-success"
            style={{
              marginTop: 6,
              fontSize: ".78rem",
              color: "var(--brand-2)",
              fontWeight: 600,
            }}
          >
            Code {promoResult.code} applied! Saved {formatMoney(promoResult.discountAmount)} (
            {formatMoney(promoResult.amountDueToday)} due today)
          </div>
        )}

        {promoError && (
          <div
            data-testid="signup-promo-error"
            style={{
              marginTop: 6,
              fontSize: ".78rem",
              color: "var(--down)",
              fontWeight: 600,
            }}
          >
            {promoError}
          </div>
        )}
      </div>
    </div>
  );
}

