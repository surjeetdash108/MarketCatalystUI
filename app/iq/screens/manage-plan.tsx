"use client";

import { useAppSelector } from "../../store/hooks";
import { hasConfirmedPaidPlan } from "../plan-status";

/**
 * Manage Plan — honest pre-launch state.
 *
 * Self-service billing (checkout, upgrade, cancel, invoices) is not live yet,
 * so this screen makes no billing promises: no prices (the catalog is being
 * unified and the public pricing page is the reference), no buttons without an
 * action, no invoice/payment/cancel controls, no feature limits the app does
 * not enforce. It is replaced by the real billing screen when checkout ships.
 */

/** Public pricing page on the marketing site. */
const PRICING_URL = process.env.NEXT_PUBLIC_PRICING_URL ?? "https://marketcatalyst.ai/#pricing";

export function ManagePlanScreen() {
  const { data: profile, status } = useAppSelector(state => state.profile);
  const { user } = useAppSelector(state => state.auth);

  const loading = status !== "ready";
  const isPremium = hasConfirmedPaidPlan(profile);
  const planName = isPremium && profile?.currentPlan
    ? profile.currentPlan.charAt(0).toUpperCase() + profile.currentPlan.slice(1)
    : "Free";
  const displayName = profile?.name || user?.displayName || "User";
  const email = user?.email ?? "";

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Manage Plan</div>
          <div className="page-sub">Your current plan and what is coming next</div>
        </div>
      </div>

      <div className="dash" style={{ maxWidth: 820, gap: 14, gridTemplateColumns: "1fr" }}>

        <div className="card col-12">
          <div className="card-h"><h3>Current Plan</h3></div>
          <div className="card-b">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{
                padding: "3px 12px", borderRadius: 99, fontSize: "0.7188rem", fontWeight: 700,
                background: isPremium ? "var(--brand-dim)" : "var(--surface-3)",
                color: isPremium ? "var(--brand-2)" : "var(--text-dim-solid)",
                border: `1px solid ${isPremium ? "var(--brand)" : "var(--border)"}`,
              }}>
                {loading ? "…" : planName}
              </span>
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--text)", marginTop: 4 }}>{displayName}</div>
            <div style={{ fontSize: "0.7188rem", color: "var(--text-dim-solid)" }}>{email}</div>
          </div>
        </div>

        <div className="card col-12">
          <div className="card-h"><h3>Paid plans launching soon</h3></div>
          <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: "0.8125rem", color: "var(--text)", lineHeight: 1.5 }}>
              Starter, Pro and Elite plans are on their way. Until they launch you keep using
              MarketCatalyst as you do today, and you won&apos;t be charged anything.
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--text-dim-solid)", lineHeight: 1.5 }}>
              We will email you before paid plans go live, with the prices and what each plan includes.
            </div>
            <div>
              <a
                href={PRICING_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-block", padding: "7px 16px", borderRadius: 99,
                  background: "var(--surface-2)", border: "1px solid var(--border)",
                  color: "var(--text)", fontSize: "0.7812rem", fontWeight: 500, textDecoration: "none",
                }}
              >
                See planned pricing
              </a>
            </div>
          </div>
        </div>

        <div className="card col-12">
          <div className="card-h"><h3>Questions</h3></div>
          <div className="card-b" style={{ fontSize: "0.8125rem", color: "var(--text)" }}>
            Email <a href="mailto:contact@marketcatalyst.ai" style={{ color: "var(--brand-2)" }}>contact@marketcatalyst.ai</a> and we will get back to you.
          </div>
        </div>

      </div>
    </>
  );
}
