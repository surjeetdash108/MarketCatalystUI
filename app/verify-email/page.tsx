"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { firebaseAuth } from "../firebase";
import { EmailCodeStep } from "../iq/billing/email-code-step";
import { safeNext } from "../iq/billing/email-code";

/** Right after email signup: verify with the 6-digit code, then continue (e.g. to /checkout). */
export default function VerifyEmailPage() {
  const [ready, setReady] = useState(false);
  const [next] = useState(() =>
    typeof window === "undefined" ? "/dashboard" : safeNext(new URLSearchParams(window.location.search).get("next")),
  );

  useEffect(() => {
    void firebaseAuth.authStateReady().then(() => {
      if (!firebaseAuth.currentUser) window.location.replace("/auth/login");
      else setReady(true);
    });
  }, []);

  return (
    <div className="iq-root" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16, background: "var(--bg)" }}>
      <div className="card" style={{ width: "min(440px, 100%)", padding: 24 }}>
        {ready && <EmailCodeStep onVerified={() => window.location.replace(next)} />}
        <p style={{ margin: "18px 0 0", fontSize: ".78rem", color: "var(--text-dim-solid)" }}>
          <Link href="/dashboard" style={{ color: "var(--brand-2)" }}>Do this later</Link> — you can use the Free plan now and verify before you buy.
        </p>
      </div>
    </div>
  );
}
