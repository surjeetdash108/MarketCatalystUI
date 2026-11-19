"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "./backend";

/**
 * Settings → Notifications: tips and offers by email (onboarding guide,
 * trial reminders). Account, billing and security emails always go. Same
 * switch as the Unsubscribe link in those emails.
 */
export function MarketingEmailToggle() {
  const [on, setOn] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let live = true;
    void apiGet<{ marketing: boolean }>("/api/account/email-prefs")
      .then((r) => live && setOn(r.marketing !== false))
      .catch(() => live && setOn(true));
    return () => {
      live = false;
    };
  }, []);
  async function change(next: boolean) {
    setSaving(true);
    const prev = on;
    setOn(next);
    try {
      await apiPost("/api/account/email-prefs", { marketing: next });
    } catch {
      setOn(prev);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="st-row" data-testid="marketing-email-row">
      <div>
        <div className="st-t">Tips and offers by email</div>
        <div className="st-d">Getting-started tips and free-trial reminders. Account, billing and security emails always reach you.</div>
      </div>
      <label className="iq-toggle">
        <input type="checkbox" aria-label="Tips and offers by email" checked={on !== false} disabled={on === null || saving} onChange={(e) => void change(e.target.checked)} />
        <span className="iq-toggle-slider" />
      </label>
    </div>
  );
}
