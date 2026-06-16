"use client";

import { useState } from "react";
import { signOut } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { firebaseAuth, firebaseDb } from "../../firebase";
import { useAppSelector } from "../../store/hooks";
import { useIQActions } from "../shell";

function ThemeConfirmModal({
  dark,
  saving,
  error,
  onConfirm,
  onCancel,
}: {
  dark: boolean;
  saving: boolean;
  error: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const label = dark ? "Dark" : "Light";
  const icon = dark ? "☽" : "☀";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,.6)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "var(--surface-1)", border: "1px solid var(--border)",
        borderRadius: "var(--r-xl)", width: 360,
        boxShadow: "0 24px 64px -12px rgba(0,0,0,.8)",
        padding: "28px 28px 24px",
      }}>
        {/* Icon */}
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: "var(--surface-3)", border: "1px solid var(--border-strong)",
          display: "grid", placeItems: "center",
          fontSize: "1.3rem", marginBottom: 16,
        }}>{icon}</div>

        {/* Title */}
        <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-hi)", marginBottom: 8 }}>
          Switch to {label} mode?
        </div>

        {/* Body */}
        <div style={{ fontSize: ".84rem", color: "var(--text-dim-solid)", lineHeight: 1.6, marginBottom: 20 }}>
          This will apply {label.toLowerCase()} mode across all screens and save your preference.
        </div>

        {/* Error */}
        {error && (
          <div style={{
            marginBottom: 14, padding: "8px 12px",
            background: "var(--down-dim)", border: "1px solid var(--down)",
            borderRadius: "var(--r-sm)", fontSize: 12, color: "var(--down)", fontWeight: 600,
          }}>{error}</div>
        )}

        {/* Buttons */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            disabled={saving}
            style={{
              height: 38, padding: "0 18px", borderRadius: "var(--r)",
              background: "var(--surface-3)", border: "1px solid var(--border-strong)",
              color: "var(--text)", fontSize: ".84rem", fontWeight: 600,
              cursor: saving ? "not-allowed" : "pointer", opacity: saving ? .5 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            style={{
              height: 38, padding: "0 22px", borderRadius: "var(--r)",
              background: "linear-gradient(135deg, var(--brand), #6354d6)",
              border: "none", color: "#fff", fontSize: ".84rem", fontWeight: 600,
              cursor: saving ? "not-allowed" : "pointer", opacity: saving ? .7 : 1,
            }}
          >
            {saving ? "Saving…" : "OK"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SettingsScreen() {
  const router = useRouter();
  const { user } = useAppSelector(state => state.auth);
  const { data: profile } = useAppSelector(state => state.profile);
  const { theme, setTheme } = useIQActions();

  const [pending, setPending] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const isPremium = profile?.tier !== "free";

  async function applyTheme() {
    if (pending === null) return;
    setSaveError("");
    setSaving(true);
    try {
      if (user?.uid) {
        await setDoc(doc(firebaseDb, "settings", user.uid), { darkMode: pending }, { merge: true });
      }
      const resolved = pending ? "dark" : "light";
      localStorage.setItem("iq-theme", resolved);
      setTheme(resolved);
      setPending(null);
    } catch (err) {
      setSaveError("Failed to save: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  }

  function cancelTheme() {
    setPending(null);
    setSaveError("");
  }

  async function handleSignOut() {
    await signOut(firebaseAuth);
    window.location.href = "/auth/login";
  }

  return (
    <>
      {pending !== null && (
        <ThemeConfirmModal
          dark={pending}
          saving={saving}
          error={saveError}
          onConfirm={() => void applyTheme()}
          onCancel={cancelTheme}
        />
      )}

      <div className="page-head">
        <div>
          <div className="page-title">Settings</div>
          <div className="page-sub">Account, preferences, and plan</div>
        </div>
      </div>

      <div className="dash" style={{ gridTemplateColumns: "1fr", maxWidth: 700 }}>

        {/* Account */}
        <div className="card col-12">
          <div className="card-h"><h3>Account</h3></div>
          <div className="card-b">
            <div className="fin-row">
              <span className="fin-lbl">Name</span>
              <span className="fin-val">{profile?.name || "—"}</span>
            </div>
            <div className="fin-row">
              <span className="fin-lbl">Email</span>
              <span className="fin-val mono" style={{ fontSize: 12.5 }}>{user?.email || "—"}</span>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border-soft)" }}>
              <button className="iq-btn-ghost" onClick={() => router.push("/profile/edit")}>
                Edit Profile
              </button>
              <button className="iq-btn-danger" onClick={handleSignOut}>
                Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="card col-12">
          <div className="card-h"><h3>Preferences</h3></div>
          <div className="card-b">
            <div className="iq-toggle-row">
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-hi)" }}>Dark mode</div>
                <div style={{ fontSize: 12, color: "var(--text-dim-solid)", marginTop: 2 }}>
                  Toggle between dark and light interface
                </div>
              </div>
              <label className="iq-toggle">
                <input
                  type="checkbox"
                  checked={theme === "dark"}
                  onChange={e => setPending(e.target.checked)}
                />
                <span className="iq-toggle-slider" />
              </label>
            </div>
          </div>
        </div>

        {/* Plan */}
        <div className="card col-12">
          <div className="card-h">
            <h3>Plan</h3>
            <span style={{
              marginLeft: 10, padding: "2px 10px", borderRadius: 99,
              fontSize: 11, fontWeight: 700,
              background: isPremium ? "var(--brand-dim)" : "var(--surface-3)",
              color: isPremium ? "var(--brand-2)" : "var(--text-dim-solid)",
              border: `1px solid ${isPremium ? "var(--brand)" : "var(--border)"}`,
            }}>
              {isPremium ? "◈ Premium" : "Free"}
            </span>
          </div>
          <div className="card-b">
            <div style={{ fontSize: 13, color: "var(--text)", marginBottom: 12 }}>
              {isPremium
                ? "You have access to all InvestIQ features."
                : "Upgrade to Premium to unlock AI Copilot, full screener, portfolio tools, and more."}
            </div>
            <button className="planbtn" style={{ maxWidth: 180 }} onClick={() => window.location.href = "/manage-plan"}>
              <span style={{ fontSize: 13 }}>◈</span>
              Manage Plan
            </button>
          </div>
        </div>

        {/* Danger zone */}
        <div className="card col-12" style={{ borderColor: "color-mix(in srgb, var(--down) 40%, transparent)" }}>
          <div className="card-h">
            <h3 style={{ color: "var(--down)" }}>Danger Zone</h3>
          </div>
          <div className="card-b">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-hi)" }}>Delete account</div>
                <div style={{ fontSize: 12, color: "var(--text-dim-solid)", marginTop: 2 }}>
                  Permanently remove your account and all data. This cannot be undone.
                </div>
              </div>
              <button className="iq-btn-danger" style={{ flexShrink: 0 }}>
                Delete
              </button>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
