"use client";

import { useState } from "react";
import { signOut } from "firebase/auth";
import { firebaseAuth } from "../../firebase";
import { apiDelete } from "../backend";
import { errorBody } from "../billing/api";

/** What deleting the account does, shown before the user confirms. */
export const DELETE_ACCOUNT_CONSEQUENCES = [
  "Your plan or free trial is cancelled right away. Access ends immediately and nothing is refunded.",
  "Your profile, watchlists, portfolio, notes and alerts are permanently deleted.",
  "Any referral credit is lost and your referral link stops working.",
  "You can't start another free trial with this email.",
  "This can't be undone.",
];

/**
 * Delete account: explains what happens, asks the user to type DELETE, then
 * deletes everything on the server (DELETE /api/account) and signs out.
 */
export function DeleteAccountDialog({ onClose }: { onClose: () => void }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ready = typed.trim() === "DELETE" && !busy;

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      await apiDelete("/api/account", { confirm: "DELETE" });
      try {
        await signOut(firebaseAuth);
      } catch {
        /* the sign-in no longer exists */
      }
      window.location.href = "/";
    } catch (e) {
      setError(errorBody(e).message ?? "Unable to delete your account. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div
      data-testid="delete-account-dialog"
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Delete your account?"
        style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "var(--r-xl)", width: 440, maxWidth: "100%", boxShadow: "0 24px 64px -12px rgba(0,0,0,.8)", padding: "26px 26px 22px" }}
      >
        <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--down)", marginBottom: 10 }}>Delete your account?</div>
        <div style={{ fontSize: ".84rem", color: "var(--text)", marginBottom: 8 }}>If you delete your account:</div>
        <ul style={{ margin: "0 0 16px", paddingLeft: 18, fontSize: ".82rem", color: "var(--text-dim-solid)", lineHeight: 1.6 }}>
          {DELETE_ACCOUNT_CONSEQUENCES.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <label style={{ display: "block", fontSize: ".78rem", color: "var(--text)", marginBottom: 6 }}>
          Type <b>DELETE</b> to confirm
        </label>
        <input
          data-testid="delete-account-input"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          style={{ width: "100%", height: 38, borderRadius: "var(--r)", border: "1px solid var(--border-strong)", background: "var(--surface-0)", color: "var(--text-hi)", padding: "0 12px", marginBottom: 14 }}
        />
        {error && (
          <div style={{ marginBottom: 14, padding: "8px 12px", background: "var(--down-dim)", border: "1px solid var(--down)", borderRadius: "var(--r-sm)", fontSize: ".75rem", color: "var(--down)", fontWeight: 600 }}>{error}</div>
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} disabled={busy} style={{ height: 38, padding: "0 18px", borderRadius: "var(--r)", background: "var(--surface-3)", border: "1px solid var(--border-strong)", color: "var(--text)", fontSize: ".84rem", fontWeight: 600, cursor: busy ? "not-allowed" : "pointer" }}>
            Cancel
          </button>
          <button
            data-testid="delete-account-confirm"
            className="iq-btn-danger"
            onClick={() => void confirm()}
            disabled={!ready}
            style={{ height: 38, padding: "0 18px", opacity: ready ? 1 : 0.5, cursor: ready ? "pointer" : "not-allowed" }}
          >
            {busy ? "Deleting…" : "Delete my account"}
          </button>
        </div>
      </div>
    </div>
  );
}
