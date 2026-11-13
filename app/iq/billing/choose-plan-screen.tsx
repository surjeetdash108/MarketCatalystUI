"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PLANS, TRIAL_DAYS } from "../feature-map.generated";
import { firebaseAuth } from "../../firebase";
import { fetchPlans } from "./api";
import {
  displayPrice,
  formatMoney,
  type BillingInterval,
  type CatalogPlan,
} from "./catalog";
import { OnboardingStepper } from "./onboarding-stepper";
import { useEntitlements } from "../hooks/useEntitlements";

const TIER_ORDER: Record<string, number> = {
  none: 0,
  free: 0,
  starter: 1,
  pro: 2,
  elite: 3,
};

function highlightModules(text: string) {
  const parts = text.split(/(Market Catalyst|Market Desk|Stock Intelligence|Money Flow|Strategy Lab)/g);
  return parts.map((part, idx) => {
    if (part === "Market Catalyst" || part === "Market Desk") {
      return <span key={idx} style={{ color: "#4ADE80", fontWeight: 700 }}>{part}</span>;
    }
    if (part === "Stock Intelligence") {
      return <span key={idx} style={{ color: "#7FA8D0", fontWeight: 700 }}>{part}</span>;
    }
    if (part === "Money Flow") {
      return <span key={idx} style={{ color: "#E0BB5E", fontWeight: 700 }}>{part}</span>;
    }
    if (part === "Strategy Lab") {
      return <span key={idx} style={{ color: "#C9A24A", fontWeight: 700 }}>{part}</span>;
    }
    return part;
  });
}

export interface ChoosePlanScreenProps {
  initialPlan?: string;
  initialInterval?: BillingInterval;
  showStepper?: boolean;
  /** Reached through the new-account flow: carry it to checkout (step 3). */
  onboarding?: boolean;
}

export function ChoosePlanScreen({
  initialPlan,
  initialInterval = "annual",
  showStepper = false,
  onboarding = false,
}: ChoosePlanScreenProps = {}) {
  const [interval, setInterval] = useState<BillingInterval>(initialInterval);
  const [catalogPlans, setCatalogPlans] = useState<CatalogPlan[]>([]);
  const { data: ent } = useEntitlements();
  const signedIn = !!firebaseAuth.currentUser;
  // A paying (or trialing) subscriber; the intro / no plan are not subscriptions.
  const currentPlanId = (ent?.subscriptionPlanId ?? "none").toLowerCase();
  const userHasActivePlan = currentPlanId !== "none";
  // Signed out: a new person, so the trial applies; signed in: what the server says.
  const trialDays = signedIn ? (ent?.trialDays ?? 0) : TRIAL_DAYS;

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

  const maxSaving = Math.max(
    0,
    ...catalogPlans.map((cp) => displayPrice(cp, "annual")?.savingPct ?? 0),
  );

  return (
    <div
      data-testid="choose-plan-screen"
      style={{
        maxWidth: 1080,
        margin: "0 auto",
        padding: "0 16px 48px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {showStepper && (
        <div style={{ width: "100%", maxWidth: 620, margin: "0 auto 16px" }}>
          <OnboardingStepper currentStep={2} />
        </div>
      )}

      {/* Interval switcher */}
      <div
        role="group"
        aria-label="Billing interval"
        style={{
          display: "inline-flex",
          gap: 6,
          background: "rgba(255, 255, 255, 0.05)",
          padding: "4px 6px",
          borderRadius: 99,
          border: "1px solid rgba(255, 255, 255, 0.1)",
          marginBottom: 32,
        }}
      >
        <button
          type="button"
          aria-pressed={interval === "monthly"}
          style={{
            padding: "8px 20px",
            borderRadius: 99,
            border: "none",
            fontSize: ".86rem",
            fontWeight: 700,
            cursor: "pointer",
            background: interval === "monthly" ? "rgba(255, 255, 255, 0.15)" : "transparent",
            color: interval === "monthly" ? "#ffffff" : "var(--text-dim-solid)",
            transition: "all 0.2s ease",
          }}
          onClick={() => setInterval("monthly")}
          data-testid="choose-interval-monthly"
        >
          Monthly
        </button>
        <button
          type="button"
          aria-pressed={interval === "annual"}
          style={{
            padding: "8px 20px",
            borderRadius: 99,
            border: "none",
            fontSize: ".86rem",
            fontWeight: 700,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: interval === "annual" ? "var(--brand, #4ADE80)" : "transparent",
            color: interval === "annual" ? "var(--on-brand, #07080A)" : "var(--text-dim-solid)",
            transition: "all 0.2s ease",
          }}
          onClick={() => setInterval("annual")}
          data-testid="choose-interval-annual"
        >
          <span>Annual</span>
          <span
            style={{
              fontSize: ".66rem",
              fontWeight: 800,
              padding: "2px 8px",
              borderRadius: 99,
              background: interval === "annual" ? "var(--on-brand, #07080A)" : "var(--brand, #4ADE80)",
              color: interval === "annual" ? "var(--brand, #4ADE80)" : "var(--on-brand, #07080A)",
              letterSpacing: ".06em",
              textTransform: "uppercase",
            }}
          >
            SAVE UP TO {maxSaving}%
          </span>
        </button>
      </div>

      {/* 3 Plan Cards matching Image 3 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
          gap: 20,
          width: "100%",
          marginBottom: 36,
        }}
      >
        {PLANS.map((p) => {
          const livePlan = catalogPlans.find((cp) => cp.id === p.id);
          const isHot = p.id === "pro";
          const isElite = p.id === "elite";

          const isCurrent = userHasActivePlan && currentPlanId === p.id;
          const currentRank = TIER_ORDER[currentPlanId] ?? 0;
          const targetRank = TIER_ORDER[p.id] ?? 0;
          const isUpgrade = currentRank > 0 && targetRank > currentRank;
          const isDowngrade = currentRank > 0 && targetRank < currentRank;

          const highlighted = initialPlan === p.id;
          let ctaText = "Subscribe";
          if (isCurrent) ctaText = "Current plan";
          else if (isUpgrade) ctaText = `Upgrade to ${p.name}`;
          else if (isDowngrade) ctaText = `Change to ${p.name}`;
          // Signed out → step 1 (create an account) with this plan; signed in → payment.
          const ctaHref = signedIn
            ? `/checkout?plan=${encodeURIComponent(p.id)}&interval=${interval}${onboarding ? "&onboarding=1" : ""}`
            : `/auth/signup?plan=${encodeURIComponent(p.id)}&interval=${interval}`;

          // Prices come from the catalog (GET /plans), never from code.
          const price = livePlan ? displayPrice(livePlan, interval) : null;
          const monthlyAmount = livePlan?.prices?.monthly?.amount ?? null;
          const wasPrice = monthlyAmount != null && livePlan ? formatMoney(monthlyAmount, livePlan.currency) : "";
          const shownPrice = price?.perMonth ?? "—";
          const billedText = price?.billed ?? "";
          const saveText = interval === "annual" && price?.savingPct ? `YOU SAVE ${price.savingPct}%` : "";

          return (
            <div
              key={p.id}
              data-testid={`choose-plan-card-${p.id}`}
              className="card"
              style={{
                display: "flex",
                flexDirection: "column",
                padding: "26px 24px 22px",
                borderRadius: 16,
                background: "rgba(18, 22, 28, 0.85)",
                border: highlighted || isHot
                  ? "2px solid var(--brand, #4ADE80)"
                  : isCurrent
                  ? "2px solid var(--brand-line, rgba(74, 222, 128, 0.35))"
                  : "1px solid rgba(255, 255, 255, 0.08)",
                boxShadow: isHot ? "0 0 32px rgba(74, 222, 128, 0.22)" : "none",
                position: "relative",
              }}
            >
              {/* Header tags */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 16,
                }}
              >
                <span
                  style={{
                    fontSize: ".74rem",
                    fontWeight: 700,
                    letterSpacing: ".12em",
                    textTransform: "uppercase",
                    color: "rgba(255, 255, 255, 0.6)",
                  }}
                >
                  {p.name.toUpperCase()}
                </span>
                {isCurrent ? (
                  <span
                    style={{
                      background: "rgba(74, 222, 128, 0.16)",
                      color: "var(--brand, #4ADE80)",
                      border: "1px solid var(--brand-line, rgba(74, 222, 128, 0.3))",
                      fontSize: ".66rem",
                      fontWeight: 800,
                      padding: "3px 10px",
                      borderRadius: 99,
                      letterSpacing: ".06em",
                      textTransform: "uppercase",
                    }}
                  >
                    CURRENT PLAN
                  </span>
                ) : isHot ? (
                  <span
                    style={{
                      background: "var(--brand, #4ADE80)",
                      color: "var(--on-brand, #07080A)",
                      fontSize: ".66rem",
                      fontWeight: 800,
                      padding: "3px 10px",
                      borderRadius: 99,
                      letterSpacing: ".06em",
                      textTransform: "uppercase",
                    }}
                  >
                    MOST POPULAR
                  </span>
                ) : isElite && interval === "annual" && price?.savingPct ? (
                  <span
                    style={{
                      background: "rgba(56, 189, 248, 0.2)",
                      color: "#38bdf8",
                      fontSize: ".68rem",
                      fontWeight: 800,
                      padding: "3px 10px",
                      borderRadius: 6,
                      letterSpacing: ".04em",
                    }}
                  >
                    SAVE {price?.savingPct}%
                  </span>
                ) : null}
              </div>

              {/* Price row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 10,
                  marginBottom: 4,
                }}
              >
                {interval === "annual" && wasPrice && (
                  <s
                    style={{
                      fontSize: "1.35rem",
                      fontWeight: 600,
                      color: "rgba(255, 255, 255, 0.35)",
                    }}
                  >
                    {wasPrice}
                  </s>
                )}
                <div
                  style={{
                    fontSize: "2.4rem",
                    fontWeight: 800,
                    color: "#ffffff",
                    letterSpacing: "-0.02em",
                    lineHeight: 1,
                  }}
                >
                  {shownPrice}
                  <span
                    style={{
                      fontSize: ".84rem",
                      fontWeight: 500,
                      color: "rgba(255, 255, 255, 0.5)",
                      marginLeft: 4,
                    }}
                  >
                    /mo
                  </span>
                </div>
              </div>

              {/* Billing subline */}
              <div
                style={{
                  fontSize: ".78rem",
                  color: "rgba(255, 255, 255, 0.6)",
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span>{billedText}</span>
                {saveText && (
                  <span style={{ color: "var(--brand, #4ADE80)", fontWeight: 700 }}>
                    {saveText}
                  </span>
                )}
              </div>

              {/* Blurb */}
              <p
                style={{
                  margin: "0 0 20px",
                  fontSize: ".86rem",
                  color: "rgba(255, 255, 255, 0.75)",
                  lineHeight: 1.5,
                  minHeight: 42,
                }}
              >
                {p.description}
              </p>

              {/* Features list */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 11,
                  marginBottom: 24,
                  flex: 1,
                }}
              >
                {p.bullets.map((b, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                      fontSize: ".84rem",
                      color: "rgba(255, 255, 255, 0.9)",
                      lineHeight: 1.45,
                    }}
                  >
                    <span
                      style={{
                        color: "var(--brand, #4ADE80)",
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                    <span>{highlightModules(b)}</span>
                  </div>
                ))}
              </div>

              {/* Action Button */}
              {isCurrent ? (
                <button
                  type="button"
                  disabled
                  data-testid={`choose-plan-subscribe-${p.id}`}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "center",
                    padding: "13px 20px",
                    borderRadius: 10,
                    background: "rgba(255, 255, 255, 0.05)",
                    color: "var(--text-dim-solid, rgba(255, 255, 255, 0.4))",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    fontSize: ".9rem",
                    fontWeight: 800,
                    cursor: "not-allowed",
                  }}
                >
                  Current plan
                </button>
              ) : (
                <Link
                  href={ctaHref}
                  data-testid={`choose-plan-subscribe-${p.id}`}
                  style={{
                    display: "block",
                    textAlign: "center",
                    padding: "13px 20px",
                    borderRadius: 10,
                    background: (isHot || isUpgrade) ? "var(--brand, #4ADE80)" : "rgba(255, 255, 255, 0.08)",
                    color: (isHot || isUpgrade) ? "var(--on-brand, #07080A)" : "#ffffff",
                    border: (isHot || isUpgrade) ? "none" : "1px solid rgba(255, 255, 255, 0.12)",
                    fontSize: ".9rem",
                    fontWeight: 800,
                    textDecoration: "none",
                    transition: "all .16s ease",
                  }}
                >
                  {ctaText}
                </Link>
              )}
            </div>
          );
        })}
      </div>
      {trialDays > 0 && !userHasActivePlan && (
        <p data-testid="choose-plan-trial-note" style={{ margin: 0, fontSize: ".86rem", color: "var(--text-dim-solid)", textAlign: "center" }}>
          Every plan starts with a {trialDays}-day free trial: $0 today, cancel before it ends and you pay nothing.
        </p>
      )}
    </div>
  );
}
