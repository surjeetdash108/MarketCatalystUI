"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { firebaseAuth } from "../../firebase";
import { emailVerificationStatus, errorBody, sendEmailCode, verifyEmailCode } from "./api";
import { sanitizeCode } from "./email-code";
import { Button, Notice } from "./ui";

/**
 * "Check your email" step: a 6-digit code (10-minute expiry) sent by the
 * backend. Used right after email signup (/verify-email) and inline on
 * /checkout for an account that is still unverified. Google accounts arrive
 * verified and pass straight through.
 */
export function EmailCodeStep({ onVerified, title = "Verify your email" }: { onVerified: () => void; title?: string }) {
  const [email, setEmail] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "info" | "error" | "ok"; text: string } | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const send = useCallback(async () => {
    setMessage(null);
    try {
      const r = await sendEmailCode();
      if (r.alreadyVerified) return onVerified();
      setCooldown(r.resendInSeconds ?? 60);
      setMessage({ tone: "info", text: "We sent a 6-digit code. It expires in 10 minutes." });
    } catch (err) {
      const e = errorBody(err) as { code?: string; message?: string; retryAfterSeconds?: number };
      if (e.code === "resend_cooldown") setCooldown(e.retryAfterSeconds ?? 60);
      setMessage({ tone: "error", text: e.message ?? "Couldn't send the code. Try again." });
    }
  }, [onVerified]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void emailVerificationStatus()
      .then((s) => {
        setEmail(s.email);
        if (s.verified) onVerified();
        else void send();
      })
      .catch(() => void send());
  }, [onVerified, send]);

  async function verify() {
    if (code.length !== 6) return;
    setBusy(true);
    setMessage(null);
    try {
      await verifyEmailCode(code);
      // Fresh ID token so email_verified (and any staff claim) is current everywhere.
      await firebaseAuth.currentUser?.reload();
      await firebaseAuth.currentUser?.getIdToken(true);
      setMessage({ tone: "ok", text: "Email verified." });
      onVerified();
    } catch (err) {
      setMessage({ tone: "error", text: errorBody(err).message ?? "That code isn't right." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-testid="email-code-step" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <h2 style={{ margin: 0, color: "var(--text-hi)", fontSize: "1.25rem" }}>{title}</h2>
      <p style={{ margin: 0, color: "var(--text-dim-solid)", fontSize: ".86rem", lineHeight: 1.5 }}>
        Enter the 6-digit code we emailed{email ? <> to <b style={{ color: "var(--text)" }}>{email}</b></> : null}. You need a verified email before you can buy a plan.
      </p>
      <input
        data-testid="email-code-input"
        aria-label="6-digit code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(sanitizeCode(e.target.value))}
        onKeyDown={(e) => e.key === "Enter" && void verify()}
        placeholder="••••••"
        style={{ fontSize: "1.6rem", letterSpacing: ".5em", textAlign: "center", padding: "12px 10px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-hi)", fontFamily: "var(--f-mono, monospace)" }}
      />
      {message && <Notice tone={message.tone} testId="email-code-message">{message.text}</Notice>}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <Button testId="email-code-verify" disabled={busy || code.length !== 6} onClick={() => void verify()}>Verify</Button>
        <Button testId="email-code-resend" kind="secondary" disabled={cooldown > 0} onClick={() => void send()}>
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
        </Button>
      </div>
    </div>
  );
}
