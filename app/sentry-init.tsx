"use client";

// Client-side Sentry init for the static-export app. No-op until
// NEXT_PUBLIC_SENTRY_DSN is set, so it's safe to ship as-is — drop in the DSN
// to start receiving browser error reports. The error boundaries
// (app/error.tsx, app/global-error.tsx) call Sentry.captureException; that's a
// safe no-op even before init, so nothing breaks without a DSN.

import { useEffect } from "react";
import * as Sentry from "@sentry/browser";

let initialized = false;

export function SentryInit() {
  useEffect(() => {
    if (initialized) return;
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) return;
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0, // errors only for now
    });
    initialized = true;
  }, []);
  return null;
}
