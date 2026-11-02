"use client";

// Last-resort error boundary (Next.js App Router). Catches errors thrown in the
// ROOT layout — where the normal app/error.tsx boundary can't reach — so even a
// crash in the shell renders a recoverable page instead of a blank screen. It
// replaces the whole document, so it must supply its own <html>/<body>.

import { useEffect } from "react";
import * as Sentry from "@sentry/browser";
import { isChunkLoadError, reloadForChunkError } from "./chunk-error-recovery";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isChunk = isChunkLoadError(error);

  useEffect(() => {
    Sentry.captureException(error); // no-op until NEXT_PUBLIC_SENTRY_DSN is set
    console.error("[global-error]", error);

    if (isChunk) {
      reloadForChunkError();
    }
  }, [error, isChunk]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#07080A",
          color: "#F4F6F5",
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
              color: "#F87171",
              marginBottom: 10,
            }}
          >
            {isChunk ? "Update Available" : "Application error"}
          </div>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 8 }}>
            {isChunk ? "Refreshing application" : "The app hit an unexpected error"}
          </h2>
          <p style={{ fontSize: ".9rem", color: "#6C747C", marginBottom: 20, lineHeight: 1.5 }}>
            {isChunk
              ? "A newer version of the application was deployed. Refreshing to load latest updates."
              : `Reloading usually fixes it.${error?.digest ? ` (ref: ${error.digest})` : ""}`}
          </p>
          <button
            onClick={() => {
              window.location.reload();
            }}
            style={{
              height: 40,
              padding: "0 22px",
              borderRadius: 10,
              border: "none",
              background: "linear-gradient(135deg, #4ADE80, #2A5B3D)",
              color: "#fff",
              fontSize: ".9rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Refresh screen
          </button>
        </div>
      </body>
    </html>
  );
}
