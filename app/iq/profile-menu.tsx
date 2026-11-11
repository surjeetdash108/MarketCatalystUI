"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { firebaseAuth } from "../firebase";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";

export function ProfileMenu() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleOutside);
      return () => document.removeEventListener("mousedown", handleOutside);
    }
  }, [open]);

  if (!user) return null;

  const displayName = user.displayName || user.email?.split("@")[0] || "User";
  const initials = (displayName || "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const profileImage = user.photoURL || null;

  const navigate = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  const handleLogout = async () => {
    setOpen(false);
    try {
      await signOut(firebaseAuth);
      window.location.href = "/auth/login";
    } catch {
      window.location.href = "/auth/login";
    }
  };

  return (
    <div className="profile-dropdown-wrap" ref={menuRef} style={{ position: "relative" }}>
      <button
        type="button"
        className="topbar-avatar"
        title={displayName}
        onClick={() => setOpen((o) => !o)}
        aria-label="User profile menu"
        style={{
          cursor: "pointer",
          width: 32,
          height: 32,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--brand, #22c55e)",
          color: "#000",
          fontWeight: 700,
          fontSize: ".78rem",
          border: "2px solid rgba(255,255,255,0.15)",
          overflow: "hidden",
          padding: 0,
        }}
      >
        {profileImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profileImage} alt={displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          initials
        )}
      </button>

      {open && (
        <div
          className="profile-dropdown"
          style={{
            position: "absolute",
            top: 40,
            right: 0,
            width: 230,
            background: "var(--surface-1, #12171c)",
            border: "1px solid var(--border, rgba(255,255,255,0.1))",
            borderRadius: 14,
            boxShadow: "0 14px 40px rgba(0,0,0,0.65)",
            zIndex: 1000,
            overflow: "hidden",
            animation: "iq-dropdownIn 0.15s ease both",
          }}
        >
          <div className="pd-user" style={{ padding: "16px 14px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "var(--brand, #22c55e)",
                  color: "#000",
                  fontWeight: 700,
                  fontSize: ".85rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  overflow: "hidden",
                }}
              >
                {profileImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profileImage} alt={displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  initials
                )}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: ".88rem", color: "var(--text-hi, #fff)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {displayName}
                </div>
                <div style={{ fontSize: ".74rem", color: "var(--text-dim-solid, #8a96a3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.email ?? ""}
                </div>
              </div>
            </div>
          </div>

          <div style={{ padding: 6 }}>
            <button
              type="button"
              className="pd-item"
              onClick={() => navigate("/profile/edit")}
              style={itemStyle}
            >
              <span style={iconStyle}>👤</span> My Profile
            </button>
            <button
              type="button"
              className="pd-item"
              onClick={() => navigate("/settings")}
              style={itemStyle}
            >
              <span style={iconStyle}>⚙</span> Settings
            </button>
            <button
              type="button"
              className="pd-item"
              onClick={() => navigate("/menu/notes")}
              style={itemStyle}
            >
              <span style={iconStyle}>📝</span> Chart Notes
            </button>
            <button
              type="button"
              className="pd-item"
              onClick={() => navigate("/manage-plan")}
              style={itemStyle}
            >
              <span style={iconStyle}>◈</span> Manage Account
            </button>
            <button
              type="button"
              className="pd-item"
              onClick={() => navigate("/refer-a-friend")}
              style={itemStyle}
            >
              <span style={iconStyle}>🎁</span> Refer a Friend
            </button>
            <button
              type="button"
              className="pd-item"
              onClick={() => navigate("/requests")}
              style={itemStyle}
            >
              <span style={iconStyle}>💡</span> Feature Requests
            </button>
            <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "4px 8px" }} />
            <button
              type="button"
              className="pd-item danger"
              onClick={() => void handleLogout()}
              style={{ ...itemStyle, color: "#f87171" }}
            >
              <span style={iconStyle}>↩</span> Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const itemStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 10px",
  borderRadius: 8,
  fontSize: ".82rem",
  fontWeight: 500,
  color: "var(--text, #e2e8f0)",
  background: "none",
  border: 0,
  cursor: "pointer",
  textAlign: "left",
};

const iconStyle: React.CSSProperties = {
  fontSize: ".9rem",
  width: 18,
  textAlign: "center",
  display: "inline-block",
};
