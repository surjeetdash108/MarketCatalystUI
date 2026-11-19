"use client";

import { useEffect, useState, type ReactNode } from "react";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { firebaseAuth } from "../../firebase";
import { useAppSelector } from "../../store/hooks";
import { isProfileIncomplete } from "../../profile/profile-fields";
import { useIQActions, type FontKey } from "../shell";
import { apiPatch } from "../backend";
import { DeleteAccountDialog } from "./delete-account-dialog";
import { useEntitlements } from "../hooks/useEntitlements";
import { MarketingEmailToggle } from "../marketing-email-toggle";

const FONTS: { key: FontKey; rank: number; label: string; desc: string; stack: string }[] = [
  { key: "geist", rank: 6,         label: "Geist",         desc: "Clean & neutral · Minimal sans",      stack: "var(--font-geist-sans,'Geist Sans',sans-serif)" },
  { key: "inter", rank: 1,         label: "Inter",          desc: "Balanced & highly readable",          stack: "var(--font-inter,'Inter',sans-serif)" },
  { key: "dm-sans", rank: 4,       label: "DM Sans",        desc: "Geometric · Modern & friendly · Default", stack: "var(--font-dm-sans,'DM Sans',sans-serif)" },
  { key: "space-grotesk", rank: 5,    label: "Space Grotesk",    desc: "Bold geometric · Dashboard feel",        stack: "var(--font-space-grotesk,'Space Grotesk',sans-serif)" },
  { key: "plus-jakarta-sans", rank: 7, label: "Plus Jakarta Sans", desc: "Refined & versatile · UI favourite",      stack: "var(--font-plus-jakarta-sans,'Plus Jakarta Sans',sans-serif)" },
  { key: "ibm-plex-sans", rank: 2,    label: "IBM Plex Sans",    desc: "Technical & trustworthy · Finance fit",   stack: "var(--font-ibm-plex-sans,'IBM Plex Sans',sans-serif)" },
  { key: "outfit", rank: 8,           label: "Outfit",           desc: "Sharp geometric · Minimal & confident",   stack: "var(--font-outfit,'Outfit',sans-serif)" },
  { key: "manrope", rank: 3,          label: "Manrope",          desc: "Elegant & airy · Premium editorial feel", stack: "var(--font-manrope,'Manrope',sans-serif)" },
  // The only entry that changes HEADINGS as well as body text — hence the
  // "+ Inter headings" in the description, so the difference is visible in the
  // list rather than a surprise after selecting it.
  { key: "inter-source", rank: 9,     label: "Inter + Source Sans", desc: "Paired · Inter headings, Source Sans body", stack: "var(--font-source-sans-3,'Source Sans 3',sans-serif)" },
  // ---- Second batch. Same contract as the entries above: each `key` needs a
  // matching `.iq-root[data-font="…"]` rule in iq.css and a next/font loader in
  // app/layout.tsx that defines the CSS variable named in `stack`. ----
  { key: "figtree", rank: 10,         label: "Figtree",          desc: "Warm geometric · Crisp at small sizes",    stack: "var(--font-figtree,'Figtree',sans-serif)" },
  { key: "public-sans", rank: 11,     label: "Public Sans",      desc: "Neutral & institutional · Data-dense fit", stack: "var(--font-public-sans,'Public Sans',sans-serif)" },
  { key: "sora", rank: 12,            label: "Sora",             desc: "Technical geometric · Terminal energy",    stack: "var(--font-sora,'Sora',sans-serif)" },
  { key: "lexend", rank: 13,          label: "Lexend",           desc: "Tuned for reading speed · Low fatigue",    stack: "var(--font-lexend,'Lexend',sans-serif)" },
  { key: "urbanist", rank: 14,        label: "Urbanist",         desc: "Low-contrast geometric · Clean & modern",  stack: "var(--font-urbanist,'Urbanist',sans-serif)" },
  { key: "work-sans", rank: 15,       label: "Work Sans",        desc: "Screen-optimised grotesque · Versatile",   stack: "var(--font-work-sans,'Work Sans',sans-serif)" },
  { key: "archivo", rank: 16,         label: "Archivo",          desc: "Compact grotesque · Great for tables",     stack: "var(--font-archivo,'Archivo',sans-serif)" },
  { key: "rubik", rank: 17,           label: "Rubik",            desc: "Softened geometric · Approachable",        stack: "var(--font-rubik,'Rubik',sans-serif)" },
  { key: "nunito-sans", rank: 18,     label: "Nunito Sans",      desc: "Rounded humanist · Easy on long reads",    stack: "var(--font-nunito-sans,'Nunito Sans',sans-serif)" },
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
            borderRadius: "var(--r-sm)", fontSize: "0.75rem", color: "var(--down)", fontWeight: 600,
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
              background: "linear-gradient(135deg, var(--brand), #2A5B3D)",
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


// Orange "Pending" chip shown when a profile field has no value yet — first-time
// Google sign-ins arrive with only name/email, so the rest reads as Pending until
// the user completes their profile.
function Pending() {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "1px 9px", borderRadius: 99,
      background: "var(--warn-dim)", color: "var(--warn)",
      border: "1px solid var(--warn)",
      fontSize: "0.6875rem", fontWeight: 700, letterSpacing: ".02em",
    }}>
      Pending
    </span>
  );
}

function ProfileRow({ label, value }: Readonly<{ label: string; value?: string | null }>) {
  const filled = value != null && value.trim() !== "";
  return (
    <div className="st-row">
      <span className="st-t">{label}</span>
      {filled ? <span className="st-val">{value}</span> : <Pending />}
    </div>
  );
}

// ---- Layout: a section list on the left, the chosen section on the right, and a
// search box that finds a setting by name. Every entry in SETTINGS_INDEX is a real
// setting that exists below; add one here when a setting is added.
export type SectionKey = "account" | "appearance" | "notifications" | "plan" | "danger";

export const SECTIONS: { key: SectionKey; label: string; sub: string }[] = [
  { key: "account", label: "Account", sub: "Your profile and sign-in." },
  { key: "appearance", label: "Appearance", sub: "How MarketCatalyst looks." },
  { key: "notifications", label: "Notifications", sub: "Which alerts and emails we send you." },
  { key: "plan", label: "Plan", sub: "Your subscription and billing." },
  { key: "danger", label: "Danger zone", sub: "Actions that cannot be undone." },
];

const SETTINGS_INDEX: { section: SectionKey; title: string; desc: string; words: string }[] = [
  { section: "account", title: "Name, email and age", desc: "The details on your profile", words: "profile name email age pending incomplete" },
  { section: "account", title: "Edit profile", desc: "Update your profile details", words: "profile edit details" },
  { section: "account", title: "Sign out", desc: "Sign out of MarketCatalyst on this device", words: "sign out log out logout" },
  { section: "appearance", title: "Dark mode", desc: "Switch between the dark and light interface", words: "theme dark light mode colour color" },
  { section: "appearance", title: "Font", desc: "Choose the typeface used across the app", words: "font typeface text type" },
  { section: "notifications", title: "Alerts", desc: "Price alerts and market notifications", words: "alerts notifications price market" },
  { section: "notifications", title: "Tips and offers by email", desc: "Getting-started tips and trial reminders", words: "email marketing unsubscribe tips offers newsletter" },
  { section: "notifications", title: "Schedule & share recap", desc: "Get the end-of-day summary by email", words: "recap schedule email summary eod digest" },
  { section: "plan", title: "Plan", desc: "Your current plan, renewal date and billing", words: "plan subscription billing renew trial manage purchase history invoice" },
  { section: "danger", title: "Delete account", desc: "Permanently remove your account and all data", words: "delete remove account data close" },
];

const ICON = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
export const SECTION_ICONS: Record<SectionKey, ReactNode> = {
  account: <svg {...ICON}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>,
  appearance: <svg {...ICON}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>,
  notifications: <svg {...ICON}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></svg>,
  plan: <svg {...ICON}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>,
  danger: <svg {...ICON}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></svg>,
};

export const SETTINGS_CSS = `
.st-shell{border:1px solid var(--border);border-radius:var(--r-xl);background:var(--surface-1);overflow:hidden}
.st-top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;border-bottom:1px solid var(--border-soft)}
.st-top h1{margin:0;font-size:1.05rem;font-weight:700;color:var(--text-hi)}
.st-search{display:flex;align-items:center;gap:8px;width:min(260px,100%);height:34px;padding:0 10px;border:1px solid var(--border);border-radius:var(--r-sm);background:var(--surface-2);color:var(--text-dim-solid)}
.st-search:focus-within{border-color:var(--brand)}
.st-search input{flex:1;min-width:0;background:transparent;border:none;outline:none;color:var(--text-hi);font-size:.8125rem}
.st-body{display:grid;grid-template-columns:200px minmax(0,1fr);min-height:460px}
.st-nav{display:flex;flex-direction:column;gap:2px;padding:12px;border-right:1px solid var(--border-soft)}
.st-nav button{display:flex;align-items:center;gap:10px;height:36px;padding:0 10px;border:none;border-radius:var(--r-sm);background:transparent;color:var(--text-dim-solid);font-size:.84rem;font-weight:600;text-align:left;cursor:pointer;transition:background .12s,color .12s}
.st-nav button:hover{background:var(--surface-2);color:var(--text-hi)}
.st-nav button[aria-current="page"]{background:var(--surface-3);color:var(--text-hi)}
.st-nav button.st-danger{color:var(--down)}
.st-main{min-width:0;padding:20px 24px 28px}
.st-h{font-size:1.05rem;font-weight:700;color:var(--text-hi)}
.st-sub{font-size:.78rem;color:var(--text-dim-solid);margin:2px 0 14px}
.st-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 14px;border-radius:var(--r-sm);transition:background .12s}
.st-row:hover{background:var(--surface-2)}
.st-row + .st-row{margin-top:2px}
.st-t{font-size:.8438rem;font-weight:600;color:var(--text-hi)}
.st-d{font-size:.75rem;color:var(--text-dim-solid);margin-top:2px;line-height:1.45}
.st-val{font-size:.8125rem;color:var(--text-hi);font-weight:600;text-align:right;overflow-wrap:anywhere}
.st-block{padding:12px 14px}
.st-notice{margin:0 14px 12px;padding:9px 12px;background:var(--warn-dim);border:1px solid var(--warn);border-radius:var(--r-sm);font-size:.75rem;color:var(--warn);font-weight:600;line-height:1.5}
.st-badge{padding:2px 10px;border-radius:99px;font-size:.6875rem;font-weight:700;white-space:nowrap}
.st-hit{display:block;width:100%;text-align:left;padding:10px 14px;border:none;border-radius:var(--r-sm);background:transparent;cursor:pointer}
.st-hit:hover{background:var(--surface-2)}
.st-hit .st-where{font-size:.6875rem;color:var(--brand-2);font-weight:700;letter-spacing:.04em;text-transform:uppercase;margin-bottom:2px}
@media (max-width:760px){
  .st-body{grid-template-columns:minmax(0,1fr)}
  .st-nav{flex-direction:row;overflow-x:auto;border-right:none;border-bottom:1px solid var(--border-soft);padding:8px}
  .st-nav button{flex:0 0 auto;white-space:nowrap}
  .st-main{padding:16px 12px 24px}
  .st-top{flex-wrap:wrap}
  .st-search{width:100%}
}
`;

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
        await apiPatch("/api/settings", { alert: enabled });
      }
    } catch (err) {
      console.error("Failed to save alert setting", err);
    }
  }
  const [schMsg, setSchMsg] = useState("");

  const [showDelete, setShowDelete] = useState(false);
  const [section, setSection] = useState<SectionKey>("account");
  const [query, setQuery] = useState("");

  // Coming back from a sub-page (Edit Profile) lands on the section it was opened from: /settings?section=plan.
  useEffect(() => {
    const want = new URLSearchParams(window.location.search).get("section");
    const match = SECTIONS.find(x => x.key === want);
    if (match) setSection(match.key);
  }, []);

  function scheduleRecap(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSchMsg("✓ Recap scheduled — you'll receive it at the selected time.");
    setTimeout(() => setSchMsg(""), 4000);
  }

  const isStaff = useEntitlements().data?.staff === true;

  // Only the fields the Edit Profile form asks for (see REQUIRED_PROFILE_FIELDS).
  const profileIncomplete = isProfileIncomplete(profile);

  async function applyFont(key: FontKey) {
    if (key === font) return;
    try {
      if (user?.uid) {
        await apiPatch("/api/settings", { font: key });
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
        await apiPatch("/api/settings", { darkMode: pending });
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

  const current = SECTIONS.find(x => x.key === section) ?? SECTIONS[0];
  const needle = query.trim().toLowerCase();
  const searching = needle !== "";
  const hits = searching
    ? SETTINGS_INDEX.filter(i => `${i.title} ${i.desc} ${i.words}`.toLowerCase().includes(needle))
    : [];

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



      <style>{SETTINGS_CSS}</style>

      {/* The sections sit in a ¾-width centred column (full width on a phone). */}
      <div className="dash" data-testid="settings-sections" style={{ gridTemplateColumns: "1fr", width: "max(75%, min(100%, 640px))", maxWidth: "100%", margin: "0 auto" }}>
        <div className="st-shell">
          <div className="st-top">
            <h1>Settings</h1>
            <label className="st-search">
              <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input
                type="search"
                placeholder="Search settings"
                aria-label="Search settings"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === "Escape") setQuery(""); }}
              />
            </label>
          </div>

          <div className="st-body">
            <nav className="st-nav" aria-label="Settings sections">
              {SECTIONS.map(sec => (
                <button
                  key={sec.key}
                  type="button"
                  className={sec.key === "danger" ? "st-danger" : undefined}
                  aria-current={section === sec.key && !searching ? "page" : undefined}
                  onClick={() => { setSection(sec.key); setQuery(""); }}
                >
                  {SECTION_ICONS[sec.key]}
                  {sec.label}
                </button>
              ))}
            </nav>

            <div className="st-main">
              {searching ? (
                <>
                  <div className="st-h">Search results</div>
                  <div className="st-sub">{hits.length} {hits.length === 1 ? "setting matches" : "settings match"} “{query.trim()}”.</div>
                  {hits.length === 0 && <div className="st-d" style={{ padding: "0 14px" }}>Nothing matches that. Try “font”, “alerts” or “plan”.</div>}
                  {hits.map(h => (
                    <button key={h.title} type="button" className="st-hit" onClick={() => { setSection(h.section); setQuery(""); }}>
                      <div className="st-where">{SECTIONS.find(x => x.key === h.section)?.label}</div>
                      <div className="st-t">{h.title}</div>
                      <div className="st-d">{h.desc}</div>
                    </button>
                  ))}
                </>
              ) : (
                <>
                  <div className="st-h">{current.label}</div>
                  <div className="st-sub">{current.sub}</div>

                  {section === "account" && (
                    <>
                      {profileIncomplete && (
                        <div className="st-notice">
                          Your profile is incomplete. Fields marked “Pending” still need details — tap Edit Profile to finish setting up.
                        </div>
                      )}
                      <ProfileRow label="Name" value={profile?.name} />
                      <div className="st-row">
                        <span className="st-t">Email</span>
                        <span className="st-val mono" style={{ fontSize: "0.7812rem" }}>{user?.email || "—"}</span>
                      </div>
                      <ProfileRow label="Age" value={profile?.age} />
                      {/* <ProfileRow label="Income range" value={profile?.incomeRange} />
                      <ProfileRow label="Investment experience" value={profile?.investmentExperience} />
                      <ProfileRow label="Investment goals" value={profile?.investmentGoals} />
                      <ProfileRow label="Risk tolerance" value={profile?.riskTolerance} />
                      <ProfileRow label="Investment horizon" value={profile?.investmentHorizon} />
                      <ProfileRow
                        label="Current portfolio value"
                        value={profile?.currentPortfolioValue ? `$${profile.currentPortfolioValue}` : ""}
                      />
                      <ProfileRow
                        label="Preferred asset classes"
                        value={profile?.preferredAssetClasses?.join(", ")}
                      /> */}
                      <div className="st-row" style={{ marginTop: 10, borderTop: "1px solid var(--border-soft)", borderRadius: 0, paddingTop: 16 }}>
                        <div>
                          <div className="st-t">Edit profile</div>
                          <div className="st-d">Update your name, age and other details.</div>
                        </div>
                        <button className="iq-btn-ghost" onClick={() => router.push("/profile/edit")}>
                          Edit Profile
                        </button>
                      </div>
                      <div className="st-row">
                        <div>
                          <div className="st-t">Sign out</div>
                          <div className="st-d">Sign out of MarketCatalyst on this device.</div>
                        </div>
                        <button className="iq-btn-danger" onClick={handleSignOut}>
                          Sign Out
                        </button>
                      </div>
                    </>
                  )}

                  {section === "appearance" && (
                    <>
                      <div className="st-row">
                        <div>
                          <div className="st-t">Dark mode</div>
                          <div className="st-d">Toggle between dark and light interface</div>
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
                      <MarketingEmailToggle />
                      <div className="st-block" style={{ marginTop: 6, borderTop: "1px solid var(--border-soft)", paddingTop: 16 }}>
                        <div className="st-t">Font</div>
                        <div className="st-d" style={{ marginBottom: 12 }}>The typeface used across the app. Scroll sideways for more.</div>
                        <div style={{
                          display: "grid",
                          gridTemplateRows: "1fr 1fr",
                          gridAutoFlow: "column",
                          gridAutoColumns: "240px",
                          overflowX: "auto",
                          gap: 12,
                          paddingBottom: 12,
                          scrollbarWidth: "thin",
                          scrollbarColor: "var(--border-strong) transparent"
                        }}>
                          {[...FONTS].sort((a, b) => a.rank - b.rank).map(f => (
                            <label
                              key={f.key}
                              onClick={() => void applyFont(f.key)}
                              style={{
                                fontFamily: f.stack,
                                display: "flex", flexDirection: "column", gap: 8,
                                padding: "14px 16px", borderRadius: "var(--r)",
                                border: `1px solid ${font === f.key ? "var(--brand)" : "var(--border)"}`,
                                background: font === f.key ? "color-mix(in srgb, var(--brand) 8%, var(--surface-1))" : "var(--surface-2)",
                                cursor: "pointer", transition: "border-color .15s, background .15s",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", width: "100%" }}>
                                <div style={{
                                  fontSize: "1rem", fontWeight: 700,
                                  color: font === f.key ? "var(--brand-2)" : "var(--text-hi)",
                                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                }}>
                                  <span style={{ opacity: 0.55, fontWeight: 600 }}>{f.rank}. </span>{f.label}
                                </div>
                                {/* Radio indicator */}
                                <div style={{
                                  width: 18, height: 18, borderRadius: "50%", flexShrink: 0, marginTop: 2,
                                  border: `2px solid ${font === f.key ? "var(--brand)" : "var(--border-strong)"}`,
                                  background: font === f.key ? "var(--brand)" : "transparent",
                                  display: "grid", placeItems: "center",
                                }}>
                                  {font === f.key && (
                                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff" }} />
                                  )}
                                </div>
                              </div>

                              <div style={{ fontSize: "0.75rem", color: "var(--text-dim-solid)", lineHeight: 1.45, flex: 1 }}>{f.desc}</div>
                              <div style={{
                                marginTop: 4, fontSize: "0.85rem", color: "var(--text)",
                                opacity: 0.72,
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              }}>
                                Aa 0123 · Markets
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {section === "notifications" && (
                    <>
                      <div className="st-row">
                        <div>
                          <div className="st-t">Alerts</div>
                          <div className="st-d">Receive price alerts and market notifications</div>
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
                      <div className="st-block" style={{ marginTop: 6, borderTop: "1px solid var(--border-soft)", paddingTop: 16 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div className="st-t">Schedule &amp; share recap</div>
                          <span className="pill ai">AI</span>
                        </div>
                        <p className="st-d" style={{ marginBottom: 14 }}>
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
                    </>
                  )}

                  {section === "plan" && <PlanSettingsCard isStaff={isStaff} />}

                  {section === "danger" && (
                    <div className="st-row">
                      <div>
                        <div className="st-t">Delete account</div>
                        <div className="st-d">Permanently remove your account and all data. This cannot be undone.</div>
                      </div>
                      <button className="iq-btn-danger" style={{ flexShrink: 0 }} onClick={() => setShowDelete(true)}>
                        Delete
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {showDelete && <DeleteAccountDialog onClose={() => setShowDelete(false)} />}
      </div>
    </>
  );
}

/** "Nov 19, 2026" */
function shortDate(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" }) : "";
}

/**
 * Settings → Plan: the current plan and what happens next, from the server's
 * entitlements, with one place to manage it.
 */
export function PlanSettingsCard({ isStaff }: { isStaff: boolean }) {
  const { data: ent } = useEntitlements();
  const status = ent?.status ?? "";
  const subscribed = !!ent?.subscriptionPlanId;
  const cadence = ent?.interval === "annual" ? "Annual" : ent?.interval === "monthly" ? "Monthly" : "";
  let badge = "No plan";
  let line = "Choose a plan to unlock Market Catalyst, Stock Intelligence, Money Flow and Strategy Lab.";
  if (isStaff) {
    badge = "Staff";
    line = "Staff access: every feature, never billed.";
  } else if (ent && !ent.subscriptionsEnabled) {
    badge = "Full access";
    line = "Paid plans are launching soon. You won't be charged anything until then.";
  } else if (status === "INTRO") {
    badge = "Market Catalyst intro";
    line = `Your free trial ends on ${shortDate(ent?.introEndsAt)}. Choose a plan before then and nothing is charged until it ends; after that, a plan is billed when you buy it.`;
  } else if (subscribed) {
    badge = `${ent?.planName ?? ""}${cadence ? ` · ${cadence}` : ""}`;
    line =
      status === "TRIALING"
        ? `Free trial until ${shortDate(ent?.currentPeriodEnd)}. ${ent?.cancelAtPeriodEnd ? "Cancelled — you won't be charged." : "Cancel for free in your trial period."}`
        : ent?.cancelAtPeriodEnd
          ? `Cancelled. You keep access until ${shortDate(ent?.currentPeriodEnd)}.`
          : status === "PAST_DUE"
            ? "Your last payment failed. Update your card in Manage Plan to keep access."
            : `Renews on ${shortDate(ent?.currentPeriodEnd)}.`;
  }
  const btn = { maxWidth: 200 } as const;
  return (
    <div data-testid="settings-plan">
      <div className="st-row">
        <div>
          <div className="st-t">Current plan</div>
          <div className="st-d" data-testid="settings-plan-line">{line}</div>
        </div>
        <span data-testid="settings-plan-badge" className="st-badge" style={{ background: subscribed || isStaff ? "var(--brand-dim)" : "var(--surface-3)", color: subscribed || isStaff ? "var(--brand-2)" : "var(--text-dim-solid)", border: `1px solid ${subscribed || isStaff ? "var(--brand)" : "var(--border)"}` }}>
          {badge}
        </span>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", padding: "6px 14px 0" }}>
        {subscribed || isStaff ? (
          <>
            <button className="planbtn" style={btn} data-testid="settings-manage-plan" onClick={() => (window.location.href = "/manage-plan")}>Manage Plan</button>
            <button className="planbtn" style={btn} data-testid="settings-plan-history" onClick={() => (window.location.href = "/manage-plan#history")}>Purchase history</button>
          </>
        ) : (
          <button className="planbtn" style={btn} data-testid="settings-see-plans" onClick={() => (window.location.href = "/choose-plan")}>See the plans</button>
        )}
      </div>
    </div>
  );
}
