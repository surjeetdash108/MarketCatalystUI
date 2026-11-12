"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandLogo } from "../iq/shell";
import { ChoosePlanScreen } from "../iq/billing/choose-plan-screen";
import { firebaseAuth } from "../firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import { isOnboarding, parsePlanParams, type BillingInterval } from "../iq/billing/plan-intent";

export default function ChoosePlanPage() {
  const [user, setUser] = useState<User | null>(null);
  const [initialPlan, setInitialPlan] = useState<string | undefined>();
  const [initialInterval, setInitialInterval] = useState<BillingInterval>("annual");
  const [hasPlanIntent, setHasPlanIntent] = useState(false);
  const [onboarding, setOnboarding] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOnboarding(isOnboarding(window.location.search));
      const intent = parsePlanParams(window.location.search, ["starter", "pro", "elite"]);
      if (intent) {
        setInitialPlan(intent.planId);
        setInitialInterval(intent.interval);
        setHasPlanIntent(true);
      }
    }
    const unsub = onAuthStateChanged(firebaseAuth, (u) => setUser(u));
    return () => unsub();
  }, []);

  return (
    <div
      className="iq-root choose-plan-page"
      data-theme="dark"
      style={{
        minHeight: "100vh",
        background: "var(--bg, #08090a)",
        color: "var(--text, #f0f4f8)",
        overflowY: "auto",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 24px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          background: "rgba(10, 14, 18, 0.85)",
          backdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <Link
          href="/dashboard"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            color: "var(--text-dim-solid, #8a96a3)",
            fontSize: ".86rem",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          <span>←</span> Back to Dashboard
        </Link>
        <BrandLogo height={26} />
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link
            href="/dashboard"
            aria-label="Close"
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-dim-solid, #8a96a3)",
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              textDecoration: "none",
              fontSize: ".88rem",
            }}
          >
            ✕
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: 1120, margin: "0 auto", padding: "32px 16px 80px" }}>
        <ChoosePlanScreen
          initialPlan={initialPlan}
          initialInterval={initialInterval}
          showStepper={onboarding}
          onboarding={onboarding}
        />
      </main>

      <style jsx global>{`
        html:has(.choose-plan-page),
        body:has(.choose-plan-page) {
          height: auto !important;
          min-height: 100% !important;
          overflow-y: auto !important;
        }
        .iq-root.choose-plan-page {
          min-height: 100vh !important;
          min-height: 100dvh !important;
          height: auto !important;
          max-height: none !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
        }
      `}</style>
    </div>
  );
}

