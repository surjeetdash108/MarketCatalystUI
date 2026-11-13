"use client";

import { useEffect } from "react";
import { firebaseAuth } from "../firebase";
import { apiPost } from "../iq/backend";
import { claimStoredReferral, referralCodeFromSearch, rememberReferral } from "../iq/billing/referral";

/**
 * A referral link: keep the code and send the friend to create an account
 * (never straight to checkout). The code is claimed once the account exists;
 * both get $25 credit after the friend's first payment.
 */
export default function ReferralRedirectPage() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const code = referralCodeFromSearch(window.location.search);
    if (code) rememberReferral(code);
    void firebaseAuth.authStateReady().then(async () => {
      if (firebaseAuth.currentUser) {
        // Already signed in (a brand-new account): claim now; the server refuses existing customers.
        await claimStoredReferral(apiPost);
        window.location.replace("/dashboard");
        return;
      }
      window.location.replace(code ? `/auth/signup?ref=${encodeURIComponent(code)}` : "/auth/signup");
    });
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#08090a",
        color: "#ffffff",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "2rem", marginBottom: 12 }}>⚡</div>
        <p style={{ color: "#8a96a3", fontSize: ".9rem" }}>Taking you to sign up…</p>
      </div>
    </div>
  );
}
