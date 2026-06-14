"use client";

import { signOut } from "firebase/auth";
import { firebaseAuth } from "../../firebase";
import { useAppSelector } from "../../store/hooks";
import { useIQActions } from "../shell";

export function SettingsScreen() {
  const { user } = useAppSelector(state => state.auth);
  const { data: profile } = useAppSelector(state => state.profile);
  const { theme, setTheme } = useIQActions();

  const isPremium = profile?.tier !== "free";

  async function handleSignOut() {
    await signOut(firebaseAuth);
    window.location.href = "/auth/login";
  }

  return (
    <>
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
              <button className="iq-btn-ghost" onClick={() => window.location.href = "/profile/edit"}>
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
                  onChange={e => setTheme(e.target.checked ? "dark" : "light")}
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
