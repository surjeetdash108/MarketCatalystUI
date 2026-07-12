"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { firebaseAuth } from "../../firebase";
import { getAuthErrorMessage } from "../auth-utils";

const label: React.CSSProperties = {
  display: "block", fontSize: ".72rem", fontWeight: 600,
  letterSpacing: ".06em", textTransform: "uppercase",
  color: "var(--text-dim-solid)", marginBottom: 7,
};

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [focused, setFocused] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(""); setSuccess(""); setIsSubmitting(true);
    try {
      await sendPasswordResetEmail(firebaseAuth, email);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      // Surface only genuine input/rate errors. Crucially, do NOT reveal
      // `auth/user-not-found` — that would leak which emails have accounts
      // (account enumeration). It falls through to the same neutral success
      // message below, so a wrong email looks identical to a real one.
      if (code === "auth/invalid-email") {
        setError("Enter a valid email address."); setIsSubmitting(false); return;
      }
      if (code === "auth/too-many-requests") {
        setError("Too many attempts. Please wait a moment and try again."); setIsSubmitting(false); return;
      }
      if (code && code !== "auth/user-not-found") {
        setError(getAuthErrorMessage(err)); setIsSubmitting(false); return;
      }
    }
    setSuccess("If an account exists for that email, a password reset link has been sent. Check your inbox.");
    setIsSubmitting(false);
  }

  return (
    <div>
      {/* Header */}
      <div style={{
        fontSize: ".64rem", fontWeight: 600, letterSpacing: ".14em",
        textTransform: "uppercase", color: "var(--brand-2)",
        fontFamily: "var(--f-display)", marginBottom: 8,
      }}>Recover access</div>
      <h1 style={{
        fontFamily: "var(--f-display)", fontSize: "1.55rem",
        fontWeight: 700, color: "var(--text-hi)", letterSpacing: "-.02em", marginBottom: 6,
      }}>Reset your password</h1>
      <p style={{ fontSize: ".84rem", color: "var(--text-dim-solid)", marginBottom: 22 }}>
        We'll send a password reset link to your email.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={label} htmlFor="email">Email</label>
          <input
            id="email" type="email" required
            placeholder="analyst@company.com"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
              width: "100%", height: 42,
              background: "var(--surface-0)",
              border: `1px solid ${focused ? "var(--brand)" : "var(--border)"}`,
              boxShadow: focused ? "0 0 0 3px var(--brand-dim)" : "none",
              borderRadius: "var(--r)", padding: "0 14px",
              fontSize: ".88rem", color: "var(--text-hi)",
              fontFamily: "var(--f-body)", outline: "none",
              transition: "border-color .14s, box-shadow .14s",
            }}
          />
        </div>

        {error && (
          <div style={{
            background: "var(--down-dim)", border: "1px solid var(--down)",
            borderRadius: "var(--r-sm)", padding: "9px 12px",
            fontSize: ".8rem", color: "var(--down)", fontWeight: 600,
          }}>{error}</div>
        )}

        {success && (
          <div style={{
            background: "var(--up-dim)", border: "1px solid var(--up)",
            borderRadius: "var(--r-sm)", padding: "9px 12px",
            fontSize: ".8rem", color: "var(--up)", fontWeight: 600,
          }}>{success}</div>
        )}

        <button
          type="submit" disabled={isSubmitting}
          style={{
            height: 42, width: "100%", borderRadius: "var(--r)",
            background: isSubmitting ? "var(--surface-3)" : "linear-gradient(135deg, var(--brand), #6354d6)",
            border: "none", color: "#fff", fontSize: ".88rem", fontWeight: 600,
            cursor: isSubmitting ? "not-allowed" : "pointer",
            opacity: isSubmitting ? .7 : 1, fontFamily: "var(--f-body)",
          }}
          onMouseEnter={e => { if (!isSubmitting) e.currentTarget.style.filter = "brightness(1.1)"; }}
          onMouseLeave={e => { e.currentTarget.style.filter = "none"; }}
        >
          {isSubmitting ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <p style={{ marginTop: 20, textAlign: "center", fontSize: ".8rem", color: "var(--text-dim-solid)" }}>
        Remembered it?{" "}
        <Link href="/" style={{ color: "var(--brand-2)", fontWeight: 600 }}>
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
