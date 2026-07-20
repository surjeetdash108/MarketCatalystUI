"use client";

// Route-segment error boundary (Next.js App Router). Any render/runtime error
// thrown by a client component inside a route is caught here and shown as a
// recoverable fallback instead of crashing the whole app. Logged for
// diagnostics; wire a monitoring service (Sentry, etc.) where noted.

import { useEffect } from "react";
import * as Sentry from "@sentry/browser";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error); // no-op until NEXT_PUBLIC_SENTRY_DSN is set
    console.error("[route-error]", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "var(--bg, #080B11)",
        color: "var(--text-hi, #EAEFF6)",
        fontFamily: "var(--f-body, system-ui, sans-serif)",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 440 }}>
        <div
          style={{
            fontSize: "0.8125rem",
            fontWeight: 700,
            letterSpacing: ".1em",
            textTransform: "uppercase",
            color: "var(--down, #FF5470)",
            marginBottom: 10,
          }}
        >
          Something went wrong
        </div>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 8 }}>
          This section hit an unexpected error
        </h2>
        <p
          style={{
            fontSize: ".9rem",
            color: "var(--text-dim-solid, #697486)",
            marginBottom: 20,
            lineHeight: 1.5,
          }}
        >
          The rest of the app is unaffected. Try again, or head back to the dashboard.
          {error?.digest ? ` (ref: ${error.digest})` : ""}
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button
            onClick={reset}
            style={{
              height: 40,
              padding: "0 20px",
              borderRadius: "var(--r, 10px)",
              border: "none",
              background: "linear-gradient(135deg, var(--brand, #7C6CF5), #6354d6)",
              color: "#fff",
              fontSize: ".88rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <a
            href="/dashboard"
            style={{
              height: 40,
              display: "inline-flex",
              alignItems: "center",
              padding: "0 20px",
              borderRadius: "var(--r, 10px)",
              border: "1px solid var(--border, #2A3444)",
              color: "var(--text, #C4CCD6)",
              fontSize: ".88rem",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Go to dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
