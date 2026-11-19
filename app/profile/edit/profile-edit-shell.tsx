"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { SECTIONS, SECTION_ICONS, SETTINGS_CSS } from "../../iq/screens/settings";

/** Where Edit Profile came from and returns to: the Account section of Settings. */
export const SETTINGS_ACCOUNT_HREF = "/settings?section=account";

/**
 * Edit Profile drawn inside the Settings layout (same frame, same section list,
 * Account marked as the current section) so it reads as part of Settings, with a
 * way back. The section buttons return to Settings on the chosen section.
 */
export function ProfileEditShell({ children }: Readonly<{ children: ReactNode }>) {
  const router = useRouter();
  return (
    <>
      <style>{SETTINGS_CSS}</style>
      <div className="dash" style={{ gridTemplateColumns: "1fr", width: "max(75%, min(100%, 640px))", maxWidth: "100%", margin: "0 auto" }}>
        <div className="st-shell">
          <div className="st-top">
            <h1>Settings</h1>
          </div>
          <div className="st-body">
            <nav className="st-nav" aria-label="Settings sections">
              {SECTIONS.map(sec => (
                <button
                  key={sec.key}
                  type="button"
                  className={sec.key === "danger" ? "st-danger" : undefined}
                  aria-current={sec.key === "account" ? "page" : undefined}
                  onClick={() => router.push(`/settings?section=${sec.key}`)}
                >
                  {SECTION_ICONS[sec.key]}
                  {sec.label}
                </button>
              ))}
            </nav>
            <div className="st-main">
              <button
                type="button"
                className="iq-btn-ghost"
                onClick={() => router.push(SETTINGS_ACCOUNT_HREF)}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 14 }}
              >
                <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
                Back to Settings
              </button>
              <div className="st-h">Edit profile</div>
              <div className="st-sub">Update your name, age and other details.</div>
              {children}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
