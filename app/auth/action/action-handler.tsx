"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { applyActionCode, checkActionCode, confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { firebaseAuth } from "../../firebase";
import { actionErrorMessage, parseActionParams, type ActionParams } from "./action-params";

type View =
  | { kind: "working" }
  | { kind: "verified"; next: string }
  | { kind: "recovered"; email: string }
  | { kind: "reset-form"; email: string }
  | { kind: "reset-done" }
  | { kind: "error"; message: string };

const h1: React.CSSProperties = { fontFamily: "var(--f-display)", fontSize: "1.45rem", fontWeight: 700, color: "var(--text-hi)", letterSpacing: "-.02em", margin: "0 0 10px" };
const p: React.CSSProperties = { fontSize: ".88rem", color: "var(--text-dim-solid)", lineHeight: 1.6, margin: "0 0 18px" };
const btn: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: "100%", height: 42, borderRadius: "var(--r)", background: "var(--brand)", color: "#05210f", fontWeight: 700, fontSize: ".88rem", border: "none", cursor: "pointer", textDecoration: "none" };
const input: React.CSSProperties = { width: "100%", height: 42, background: "var(--surface-0)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: "0 14px", fontSize: ".88rem", color: "var(--text-hi)", marginBottom: 12 };

/** /auth/action: verify email, reset password, recover email — all on our own domain. */
export function ActionHandler() {
  const [view, setView] = useState<View>({ kind: "working" });
  const [params, setParams] = useState<ActionParams | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const a = parseActionParams(window.location.search, window.location.origin);
    setParams(a);
    // Keep the one-time code out of the address bar and history.
    window.history.replaceState(null, "", "/auth/action");
    if (!a.mode || !a.oobCode) {
      setView({ kind: "error", message: actionErrorMessage("auth/invalid-action-code") });
      return;
    }
    const code = a.oobCode;
    void (async () => {
      try {
        if (a.mode === "verifyEmail" || a.mode === "verifyAndChangeEmail") {
          await applyActionCode(firebaseAuth, code);
          await firebaseAuth.currentUser?.reload().catch(() => {});
          await firebaseAuth.currentUser?.getIdToken(true).catch(() => "");
          setView({ kind: "verified", next: a.next });
          setTimeout(() => window.location.replace(a.next), 1500);
        } else if (a.mode === "recoverEmail") {
          const info = await checkActionCode(firebaseAuth, code);
          await applyActionCode(firebaseAuth, code);
          setView({ kind: "recovered", email: info.data.email ?? "" });
        } else {
          const email = await verifyPasswordResetCode(firebaseAuth, code);
          setView({ kind: "reset-form", email });
        }
      } catch (err) {
        setView({ kind: "error", message: actionErrorMessage((err as { code?: string }).code) });
      }
    })();
  }, []);

  async function submitReset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!params?.oobCode) return;
    if (pw !== pw2) return setFormError("Passwords do not match.");
    setBusy(true);
    setFormError("");
    try {
      await confirmPasswordReset(firebaseAuth, params.oobCode, pw);
      setView({ kind: "reset-done" });
    } catch (err) {
      const c = (err as { code?: string }).code;
      if (c === "auth/weak-password") setFormError(actionErrorMessage(c));
      else setView({ kind: "error", message: actionErrorMessage(c) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-testid="auth-action">
      {view.kind === "working" && <p style={p}>One moment…</p>}
      {view.kind === "verified" && (
        <>
          <h1 style={h1}>Email verified ✓</h1>
          <p style={p}>Thanks! Your email address is confirmed. Taking you back…</p>
          <a href={view.next} style={btn}>Continue</a>
        </>
      )}
      {view.kind === "recovered" && (
        <>
          <h1 style={h1}>Email restored</h1>
          <p style={p}>Your sign-in email is back to <b>{view.email}</b>. If you didn&apos;t request the change, reset your password now.</p>
          <Link href="/auth/forgot-password" style={btn}>Reset password</Link>
        </>
      )}
      {view.kind === "reset-form" && (
        <form onSubmit={submitReset}>
          <h1 style={h1}>Choose a new password</h1>
          <p style={p}>For <b>{view.email}</b></p>
          <input type="password" placeholder="New password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} style={input} required minLength={6} />
          <input type="password" placeholder="Confirm new password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} style={input} required minLength={6} />
          {formError && <p style={{ ...p, color: "var(--down)" }}>{formError}</p>}
          <button type="submit" style={btn} disabled={busy}>{busy ? "Saving…" : "Save password"}</button>
        </form>
      )}
      {view.kind === "reset-done" && (
        <>
          <h1 style={h1}>Password updated</h1>
          <p style={p}>You can now sign in with your new password.</p>
          <Link href="/auth/login" style={btn}>Sign in</Link>
        </>
      )}
      {view.kind === "error" && (
        <>
          <h1 style={h1}>This link didn&apos;t work</h1>
          <p style={p}>{view.message}</p>
          <Link href="/auth/login" style={btn}>Back to sign in</Link>
        </>
      )}
    </div>
  );
}
