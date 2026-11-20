"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { firebaseAuth } from "../firebase";
import { useAppSelector } from "../store/hooks";
import { useEntitlements } from "./hooks/useEntitlements";
import { clearOnboardingSession } from "./billing/plan-intent";
import { isProfileIncomplete } from "../profile/profile-fields";

export async function signOutToLogin() {
  clearOnboardingSession();
  await signOut(firebaseAuth);
  window.location.href = "/auth/login";
}

/**
 * The profile avatar and its menu (My Profile, Settings, … Logout). One
 * component for every product — Market Catalyst's topbar and the Stock
 * Intelligence, Money Flow and Strategy Lab headers — so the menu and sign-out
 * behave the same everywhere. The menu is portaled to the app's themed .iq-root
 * wrapper (document.body when there is none) and opens under the avatar,
 * whatever the height of the header it sits in.
 */
export function ProfileMenu() {
  const router = useRouter();
  const { user } = useAppSelector(state => state.auth);
  const { data: profile } = useAppSelector(state => state.profile);
  const { data: ent } = useEntitlements();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const displayName = profile?.name || user?.displayName || user?.email || "User";
  const initials = displayName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
  const profileImage = profile?.profile_image || user?.photoURL || null;
  // Drives the "Pending" pill on My Profile — same rule as Settings (REQUIRED_PROFILE_FIELDS).
  const profileIncomplete = isProfileIncomplete(profile);
  const hasActivePlan = !!ent && ent.planId !== "none" && ent.planId !== "free" && (["ACTIVE", "TRIALING", "PAST_DUE"].includes(String(ent.status).toUpperCase()) || !!ent.staff);

  // Anchor the menu under the avatar; re-measure on resize/scroll while open.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = wrapRef.current?.getBoundingClientRect();
      if (r) setPos({ top: Math.round(r.bottom + 8), right: Math.max(8, Math.round(window.innerWidth - r.right)) });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  // Close on a click outside (the menu is portaled, so check both nodes) or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!wrapRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const go = (href: string) => { setOpen(false); router.push(href); };

  // The theme's colours (light or dark) are defined on the app's .iq-root wrapper, so the menu has
  // to open inside it. Portaled to document.body it sat outside the theme and was always dark.
  const menuHost = (): HTMLElement =>
    (wrapRef.current?.closest(".iq-root") as HTMLElement | null) ?? document.body;

  return (
    <div className="profile-dropdown-wrap" ref={wrapRef}>
      <div
        className="topbar-avatar"
        role="button"
        tabIndex={0}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${displayName}`}
        title={displayName}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(o => !o); } }}
      >
        {initials}
        {/* eslint-disable-next-line @next/next/no-img-element -- remote avatar URL */}
        {profileImage && <img src={profileImage} alt={displayName} />}
      </div>

      {open && typeof document !== "undefined" && createPortal(
        <div
          className="profile-dropdown"
          role="menu"
          ref={menuRef}
          style={{ zIndex: 1000000, ...(pos ? { top: pos.top, right: pos.right } : {}) }}
        >
          <div className="pd-user">
            <div className="pd-avatar">
              {initials}
              {/* eslint-disable-next-line @next/next/no-img-element -- remote avatar URL */}
              {profileImage && <img src={profileImage} alt={displayName} />}
            </div>
            <div className="pd-name">{displayName}</div>
            <div className="pd-email">{user?.email ?? ""}</div>
          </div>

          <button className="pd-item" onClick={() => go("/profile/edit")}>
            <span className="pd-icon">👤</span> My Profile
            {profileIncomplete && <span className="pd-pending">Pending</span>}
          </button>
          <button className="pd-item" onClick={() => go("/settings")}>
            <span className="pd-icon">⚙</span> Settings
          </button>
          <button className="pd-item" onClick={() => go("/menu/notes")}>
            <span className="pd-icon">📝</span> Chart Notes
          </button>
          <button className="pd-item" onClick={() => go("/manage-plan")}>
            <span className="pd-icon">◈</span> Manage Plan
          </button>
          {hasActivePlan && (
            <button className="pd-item" onClick={() => go("/refer-a-friend")}>
              <span className="pd-icon">🎁</span> Refer a Friend
            </button>
          )}
          <button className="pd-item" onClick={() => go("/requests")}>
            <span className="pd-icon">💡</span> Request a new feature
          </button>
          <div className="pd-divider" />
          <button className="pd-item danger" onClick={() => { setOpen(false); void signOutToLogin(); }}>
            <span className="pd-icon">↩</span> Logout
          </button>
        </div>,
        menuHost(),
      )}
    </div>
  );
}
