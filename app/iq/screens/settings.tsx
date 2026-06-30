"use client";

import { useState } from "react";
import { signOut } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { firebaseAuth, firebaseDb } from "../../firebase";
import { useAppSelector } from "../../store/hooks";
import { useIQActions, type FontKey } from "../shell";

const FONTS: { key: FontKey; label: string; desc: string; stack: string }[] = [
  { key: "geist",         label: "Geist",         desc: "Clean & neutral · Minimal sans",      stack: "var(--font-geist-sans,'Geist Sans',sans-serif)" },
  { key: "inter",         label: "Inter",          desc: "Balanced & highly readable",          stack: "var(--font-inter,'Inter',sans-serif)" },
  { key: "dm-sans",       label: "DM Sans",        desc: "Geometric · Modern & friendly · Default", stack: "var(--font-dm-sans,'DM Sans',sans-serif)" },
  { key: "space-grotesk",    label: "Space Grotesk",    desc: "Bold geometric · Dashboard feel",        stack: "var(--font-space-grotesk,'Space Grotesk',sans-serif)" },
  { key: "plus-jakarta-sans", label: "Plus Jakarta Sans", desc: "Refined & versatile · UI favourite",      stack: "var(--font-plus-jakarta-sans,'Plus Jakarta Sans',sans-serif)" },
  { key: "ibm-plex-sans",    label: "IBM Plex Sans",    desc: "Technical & trustworthy · Finance fit",   stack: "var(--font-ibm-plex-sans,'IBM Plex Sans',sans-serif)" },
  { key: "outfit",           label: "Outfit",           desc: "Sharp geometric · Minimal & confident",   stack: "var(--font-outfit,'Outfit',sans-serif)" },
  { key: "manrope",          label: "Manrope",          desc: "Elegant & airy · Premium editorial feel", stack: "var(--font-manrope,'Manrope',sans-serif)" },
];

function ConfirmModal({
  icon,
  title,
  body,
  saving,
  error,
  onConfirm,
  onCancel,
}: {
  icon: string;
  title: string;
  body: string;
  saving: boolean;
  error: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
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
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: "var(--surface-3)", border: "1px solid var(--border-strong)",
          display: "grid", placeItems: "center",
          fontSize: "1.3rem", marginBottom: 16,
        }}>{icon}</div>

        <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-hi)", marginBottom: 8 }}>
          {title}
        </div>
        <div style={{ fontSize: ".84rem", color: "var(--text-dim-solid)", lineHeight: 1.6, marginBottom: 20 }}>
          {body}
        </div>

        {error && (
          <div style={{
            marginBottom: 14, padding: "8px 12px",
            background: "var(--down-dim)", border: "1px solid var(--down)",
            borderRadius: "var(--r-sm)", fontSize: 12, color: "var(--down)", fontWeight: 600,
          }}>{error}</div>
        )}

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
  const { theme, setTheme, font, setFont } = useIQActions();

  const [pending, setPending] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [alertEnabled, setAlertEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const v = localStorage.getItem("iq-alert");
    return v === null ? true : v === "1";
  });

  async function toggleAlert(enabled: boolean) {
    setAlertEnabled(enabled);
    localStorage.setItem("iq-alert", enabled ? "1" : "0");
    try {
      if (user?.uid) {
        await setDoc(doc(firebaseDb, "settings", user.uid), { alert: enabled }, { merge: true });
      }
    } catch (err) {
      console.error("Failed to save alert setting", err);
    }
  }
  const [schMsg, setSchMsg] = useState("");

  function scheduleRecap(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSchMsg("✓ Recap scheduled — you'll receive it at the selected time.");
    setTimeout(() => setSchMsg(""), 4000);
  }

  const isPremium = profile?.tier !== "free";

  async function applyFont(key: FontKey) {
    if (key === font) return;
    try {
      if (user?.uid) {
        await setDoc(doc(firebaseDb, "settings", user.uid), { font: key }, { merge: true });
      }
      localStorage.setItem("iq-font", key);
      setFont(key);
    } catch (err) {
      console.error("Failed to save font", err);
    }
  }

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
    window.location.href = "/";
  }

  return (
    <>
      {pending !== null && (
        <ConfirmModal
          icon={pending ? "☽" : "☀"}
          title={`Switch to ${pending ? "Dark" : "Light"} mode?`}
          body={`This will apply ${pending ? "dark" : "light"} mode across all screens and save your preference.`}
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
            <div className="iq-toggle-row" style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border-soft)" }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-hi)" }}>Alerts</div>
                <div style={{ fontSize: 12, color: "var(--text-dim-solid)", marginTop: 2 }}>
                  Receive price alerts and market notifications
                </div>
              </div>
              <label className="iq-toggle">
                <input
                  type="checkbox"
                  checked={alertEnabled}
                  onChange={e => void toggleAlert(e.target.checked)}
                />
                <span className="iq-toggle-slider" />
              </label>
            </div>
          </div>
        </div>

        {/* Font */}
        <div className="card col-12">
          <div className="card-h">
            <h3>Font</h3>
          </div>
          <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {FONTS.map(f => (
              <label
                key={f.key}
                onClick={() => void applyFont(f.key)}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "14px 16px", borderRadius: "var(--r)",
                  border: `1px solid ${font === f.key ? "var(--brand)" : "var(--border)"}`,
                  background: font === f.key ? "color-mix(in srgb, var(--brand) 8%, var(--surface-1))" : "var(--surface-2)",
                  cursor: "pointer", transition: "border-color .15s, background .15s",
                }}
              >
                {/* Radio indicator */}
                <div style={{
                  width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                  border: `2px solid ${font === f.key ? "var(--brand)" : "var(--border-strong)"}`,
                  background: font === f.key ? "var(--brand)" : "transparent",
                  display: "grid", placeItems: "center",
                }}>
                  {font === f.key && (
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff" }} />
                  )}
                </div>

                {/* Label + description */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14.5, fontWeight: 700,
                    color: font === f.key ? "var(--brand-2)" : "var(--text-hi)",
                    fontFamily: f.stack,
                    marginBottom: 2,
                  }}>
                    {f.label}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--text-dim-solid)" }}>{f.desc}</div>
                </div>

                {/* Live preview */}
                <div style={{
                  fontSize: 13, color: "var(--text)",
                  fontFamily: f.stack, whiteSpace: "nowrap",
                  opacity: 0.72,
                }}>
                  Aa 0123 · Markets
                </div>
              </label>
            ))}
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
                ? "You have access to all StockWise features."
                : "Upgrade to Premium to unlock AI Copilot, full screener, portfolio tools, and more."}
            </div>
            <button className="planbtn" style={{ maxWidth: 180 }} onClick={() => window.location.href = "/manage-plan"}>
              <span style={{ fontSize: 13 }}>◈</span>
              Manage Plan
            </button>
          </div>
        </div>

        {/* Schedule & share recap */}
        <div className="card col-12">
          <div className="card-h">
            <h3>Schedule &amp; share recap</h3>
            <span className="pill ai">AI</span>
          </div>
          <div className="card-b">
            <p style={{ fontSize: ".82rem", color: "var(--text)", lineHeight: 1.5, marginBottom: 14 }}>
              Get the end-of-day executive summary delivered automatically to your inbox, or download it on demand.
            </p>
            <form onSubmit={scheduleRecap} style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
              <label style={{ fontSize: ".7rem", color: "var(--text-dim-solid)" }}>
                Frequency<br />
                <select className="mv-sel" style={{ marginTop: 4 }}>
                  <option>Daily (EOD)</option>
                  <option>Weekdays</option>
                  <option>Weekly (Fri)</option>
                </select>
              </label>
              <label style={{ fontSize: ".7rem", color: "var(--text-dim-solid)" }}>
                Send time<br />
                <select className="mv-sel" style={{ marginTop: 4 }}>
                  <option>4:45 PM ET</option>
                  <option>6:00 PM ET</option>
                  <option>7:00 AM ET</option>
                </select>
              </label>
              <label style={{ fontSize: ".7rem", color: "var(--text-dim-solid)" }}>
                Email<br />
                <input className="mv-sel" type="email" style={{ marginTop: 4, minWidth: 220 }}
                  placeholder="you@example.com" defaultValue={user?.email ?? ""} />
              </label>
              <button className="btn primary" type="submit">Schedule email</button>
            </form>
            {schMsg && <div style={{ fontSize: ".78rem", marginTop: 10, color: "var(--up)" }}>{schMsg}</div>}
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
