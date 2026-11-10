"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PLANS, EVERY_PLAN_INCLUDES } from "../feature-map.generated";
import { fetchPlans, type PlansResponse } from "./api";
import {
  displayPrice,
  formatMoney,
  INTERVALS,
  type BillingInterval,
  type CatalogPlan,
} from "./catalog";
import { pill } from "./ui";

export function ChoosePlanScreen() {
  const [interval, setInterval] = useState<BillingInterval>("annual");
  const [catalogPlans, setCatalogPlans] = useState<CatalogPlan[]>([]);

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

  return (
    <div
      data-testid="choose-plan-screen"
      style={{
        maxWidth: 1040,
        margin: "32px auto",
        padding: "0 20px 48px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <span
          style={{
            fontSize: ".72rem",
            fontWeight: 700,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: "var(--brand-2)",
            display: "inline-block",
            marginBottom: 8,
          }}
        >
          Subscription required
        </span>
        <h1
          style={{
            margin: "0 0 10px",
            fontSize: "1.9rem",
            fontWeight: 800,
            color: "var(--text-hi)",
            letterSpacing: "-.02em",
          }}
        >
          Choose a plan to continue
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: ".95rem",
            color: "var(--text-dim-solid)",
            maxWidth: 580,
            lineHeight: 1.5,
          }}
        >
          Select a plan to access your market intelligence workspace. Cancel anytime.
        </p>
      </div>

      {/* Interval switcher */}
      <div
        role="group"
        aria-label="Billing interval"
        style={{
          display: "inline-flex",
          gap: 6,
          background: "var(--surface-1)",
          padding: 4,
          borderRadius: 99,
          border: "1px solid var(--border)",
          marginBottom: 32,
        }}
      >
        {INTERVALS.map((i) => (
          <button
            key={i}
            type="button"
            aria-pressed={interval === i}
            style={pill(interval === i)}
            onClick={() => setInterval(i)}
            data-testid={`choose-interval-${i}`}
          >
            {i === "monthly" ? "Monthly" : "Annual (save up to 25%)"}
          </button>
        ))}
      </div>

      {/* 3 Plan Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 20,
          width: "100%",
          marginBottom: 36,
        }}
      >
        {PLANS.map((p) => {
          const livePlan = catalogPlans.find((cp) => cp.id === p.id);
          const price = livePlan ? displayPrice(livePlan, interval) : null;
          const isHot = p.id === "pro";
          return (
            <div
              key={p.id}
              data-testid={`choose-plan-card-${p.id}`}
              className="card"
              style={{
                display: "flex",
                flexDirection: "column",
                padding: 24,
                borderRadius: "var(--r-lg, 14px)",
                background: "var(--surface-1)",
                border: isHot
                  ? "2px solid var(--brand)"
                  : "1px solid var(--border)",
                position: "relative",
              }}
            >
              {isHot && (
                <div
                  style={{
                    position: "absolute",
                    top: -11,
                    left: 20,
                    background: "var(--brand)",
                    color: "var(--on-brand, #000)",
                    fontSize: ".68rem",
                    fontWeight: 700,
                    padding: "2px 10px",
                    borderRadius: 99,
                    letterSpacing: ".06em",
                    textTransform: "uppercase",
                  }}
                >
                  Most popular
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: 8,
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: "1.3rem",
                    fontWeight: 700,
                    color: "var(--text-hi)",
                  }}
                >
                  {p.name}
                </h2>
              </div>

              <div
                style={{
                  fontSize: "1.75rem",
                  fontWeight: 800,
                  color: "var(--text-hi)",
                  marginBottom: 4,
                }}
              >
                {price ? price.perMonth : "—"}
                <span
                  style={{
                    fontSize: ".85rem",
                    fontWeight: 500,
                    color: "var(--text-dim-solid)",
                    marginLeft: 4,
                  }}
                >
                  /month
                </span>
              </div>

              <div
                style={{
                  fontSize: ".78rem",
                  color: "var(--text-dim-solid)",
                  marginBottom: 16,
                  minHeight: 18,
                }}
              >
                {price ? price.billed : "—"}
                {price?.savingPct ? ` · save ${price.savingPct}%` : ""}
              </div>

              <p
                style={{
                  margin: "0 0 20px",
                  fontSize: ".84rem",
                  color: "var(--text)",
                  lineHeight: 1.45,
                  minHeight: 38,
                }}
              >
                {p.description}
              </p>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  marginBottom: 24,
                  flex: 1,
                }}
              >
                {p.bullets.map((b, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: 9,
                      alignItems: "flex-start",
                      fontSize: ".82rem",
                      color: "var(--text-hi)",
                      lineHeight: 1.4,
                    }}
                  >
                    <span
                      style={{
                        color: "var(--brand-2)",
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                    <span>{b}</span>
                  </div>
                ))}
              </div>

              <Link
                href={`/checkout?plan=${encodeURIComponent(p.id)}&interval=${interval}`}
                data-testid={`choose-plan-subscribe-${p.id}`}
                style={{
                  display: "block",
                  textAlign: "center",
                  padding: "11px 18px",
                  borderRadius: "var(--r, 8px)",
                  background: isHot ? "var(--brand)" : "var(--surface-3)",
                  color: isHot ? "var(--on-brand, #000)" : "var(--text-hi)",
                  border: isHot ? "none" : "1px solid var(--border-strong)",
                  fontSize: ".88rem",
                  fontWeight: 700,
                  textDecoration: "none",
                  transition: "filter .14s",
                }}
              >
                Subscribe to {p.name}
              </Link>
            </div>
          );
        })}
      </div>

      {/* Every plan includes */}
      <div
        className="card"
        style={{
          width: "100%",
          padding: 24,
          background: "var(--surface-0)",
          border: "1px solid var(--border-soft)",
          borderRadius: "var(--r-lg, 14px)",
        }}
      >
        <div
          style={{
            fontSize: ".75rem",
            fontWeight: 700,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: "var(--text-dim-solid)",
            marginBottom: 14,
            textAlign: "center",
          }}
        >
          Every plan includes
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 12,
          }}
        >
          {EVERY_PLAN_INCLUDES.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
                fontSize: ".8rem",
                color: "var(--text)",
                lineHeight: 1.45,
              }}
            >
              <span
                style={{ color: "var(--brand-2)", fontWeight: 700 }}
                aria-hidden="true"
              >
                ✓
              </span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

