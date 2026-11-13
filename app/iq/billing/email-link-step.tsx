"use client";

import { sendEmailVerification } from "firebase/auth";
import { useCallback, useEffect, useRef, useState } from "react";
import { firebaseAuth } from "../../firebase";
import { LINK_SENT_KEY, resendWaitSeconds, verifyContinueUrl } from "./email-code";
import { Button, Notice } from "./ui";

/**
 * "Check your email" step: Firebase emails a verification link. Clicking it
 * marks the account verified and returns to /verify-email; this step also
 * notices on its own (on focus and every few seconds), refreshes the login so
 * email_verified is current everywhere, then continues. Used right after email
 * signup (/verify-email) and inline on /checkout. Google accounts arrive
 * verified and pass straight through.
 */
export function EmailLinkStep({ onVerified, title = "Verify your email", next = "/dashboard" }: { onVerified: () => void; title?: string; next?: string }) {
  const [email, setEmail] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "info" | "error" | "ok"; text: string } | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [checking, setChecking] = useState(false);
  const done = useRef(false);
  const started = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  /** Reload the account; when verified, refresh the ID token and continue. */
  const check = useCallback(async (): Promise<boolean> => {
    const u = firebaseAuth.currentUser;
    if (!u || done.current) return done.current;
    try {
      await u.reload();
    } catch {
      return false;
    }
    if (!firebaseAuth.currentUser?.emailVerified) return false;
    done.current = true;
    await firebaseAuth.currentUser.getIdToken(true);
    setMessage({ tone: "ok", text: "Email verified." });
    onVerified();
    return true;
  }, [onVerified]);

  const send = useCallback(async () => {
    const u = firebaseAuth.currentUser;
    if (!u) return;
    setMessage(null);
    try {
      await sendEmailVerification(u, { url: verifyContinueUrl(window.location.origin, next) });
      try {
        sessionStorage.setItem(LINK_SENT_KEY, String(Date.now()));
      } catch {
        /* ignore */
      }
      setCooldown(60);
      setMessage({ tone: "info", text: "Verification link sent. Check your inbox (and spam folder)." });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "auth/too-many-requests") {
        setCooldown(60);
        setMessage({ tone: "error", text: "Too many emails sent. Wait a minute, then try again." });
      } else setMessage({ tone: "error", text: "Couldn't send the link. Try again." });
    }
  }, [next]);

  // First visit: already verified → continue; else send one link (not again on every reload).
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    setEmail(firebaseAuth.currentUser?.email ?? null);
    void check().then((ok) => {
      if (ok) return;
      let last: string | null = null;
      try {
        last = sessionStorage.getItem(LINK_SENT_KEY);
      } catch {
        /* ignore */
      }
      const wait = resendWaitSeconds(last ? Number(last) : null, Date.now());
      if (wait > 0) {
        setCooldown(wait);
        setMessage({ tone: "info", text: "We sent you a verification link. Check your inbox (and spam folder)." });
      } else void send();
    });
  }, [check, send]);

  // Verified in another tab or on another device: notice it here.
  useEffect(() => {
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") void check();
    }, 5000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(t);
    };
  }, [check]);

  async function manualCheck() {
    setChecking(true);
    const ok = await check();
    setChecking(false);
    if (!ok) setMessage({ tone: "error", text: "Not verified yet. Click the link in the email, then try again." });
  }

  return (
    <div data-testid="email-link-step" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <h2 style={{ margin: 0, color: "var(--text-hi)", fontSize: "1.25rem" }}>{title}</h2>
      <p style={{ margin: 0, color: "var(--text-dim-solid)", fontSize: ".86rem", lineHeight: 1.5 }}>
        We sent a verification link to {email ? <b style={{ color: "var(--text)" }}>{email}</b> : "your email"}. Click it to verify your email — this page continues on its own once you have.
      </p>
      {message && <Notice tone={message.tone} testId="email-link-message">{message.text}</Notice>}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <Button testId="email-link-check" disabled={checking} onClick={() => void manualCheck()}>I&apos;ve verified</Button>
        <Button testId="email-link-resend" kind="secondary" disabled={cooldown > 0} onClick={() => void send()}>
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend link"}
        </Button>
      </div>
    </div>
  );
}
