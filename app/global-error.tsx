"use client";

// Last-resort error boundary (Next.js App Router). Catches errors thrown in the
// ROOT layout — where the normal app/error.tsx boundary can't reach — so even a
// crash in the shell renders a recoverable page instead of a blank screen. It
// replaces the whole document, so it must supply its own <html>/<body>.

import { useEffect } from "react";
import * as Sentry from "@sentry/browser";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error); // no-op until NEXT_PUBLIC_SENTRY_DSN is set
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#080B11",
          color: "#EAEFF6",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: 24,
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 440 }}>
          <div
            style={{
              fontSize: "0.8125rem",
              fontWeight: 700,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: "#FF5470",
              marginBottom: 10,
            }}
          >
            Application error
          </div>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 8 }}>
            The app hit an unexpected error
          </h2>
          <p style={{ fontSize: ".9rem", color: "#697486", marginBottom: 20, lineHeight: 1.5 }}>
            Reloading usually fixes it.{error?.digest ? ` (ref: ${error.digest})` : ""}
          </p>
          <button
            onClick={reset}
            style={{
              height: 40,
              padding: "0 22px",
              borderRadius: 10,
              border: "none",
              background: "linear-gradient(135deg, #7C6CF5, #6354d6)",
              color: "#fff",
              fontSize: ".9rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
