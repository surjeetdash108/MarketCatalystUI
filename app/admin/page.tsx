"use client";

import { useEffect, useRef, useState } from "react";
import { signOut, updatePassword } from "firebase/auth";
import { firebaseAuth } from "../firebase";

/**
 * Admin console gate. The console itself is the exact static HTML at
 * /admin/console.html (design + static data preserved verbatim), embedded in an
 * iframe. This page owns the Firebase session: it lets ONLY the admin account
 * through, feeds the admin identity into the iframe, and services the iframe's
 * logout / change-password requests (postMessage bridge).
 *
 * The admin is a single fixed account (email never changes; password can).
 */
const ADMIN_EMAIL = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || "admin@marketcatalyst.ai").toLowerCase();

export default function AdminPage() {
  const [state, setState] = useState<"checking" | "denied" | "ok">("checking");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const emailRef = useRef<string>("");

  // Gate: resolve the session, allow only the admin email.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // MUST await authStateReady(): onAuthStateChanged fires an initial `null`
      // while Firebase restores the session from IndexedDB. Judging that first
      // emission bounced the admin straight back out before the session loaded.
      await firebaseAuth.authStateReady();
      if (cancelled) return;
      const user = firebaseAuth.currentUser;
      const email = user?.email?.toLowerCase() ?? "";
      emailRef.current = email;
      if (email === ADMIN_EMAIL) {
        setState("ok");
      } else {
        setState("denied");
        // Non-admins (or signed-out) never see the console.
        window.location.replace(user ? "/dashboard" : "/auth/login");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Bridge: handle logout / password-change coming from the iframe.
  useEffect(() => {
    const onMsg = async (e: MessageEvent) => {
      const d = e.data || {};
      if (d.type === "admin:logout") {
        await signOut(firebaseAuth);
        window.location.replace("/auth/login");
      }
      if (d.type === "admin:changePassword") {
        const post = (m: Record<string, unknown>) =>
          iframeRef.current?.contentWindow?.postMessage({ type: "admin:passwordResult", ...m }, "*");
        try {
          if (!firebaseAuth.currentUser) throw new Error("Session expired — sign in again.");
          await updatePassword(firebaseAuth.currentUser, String(d.password));
          post({ ok: true });
        } catch (err) {
          // Firebase requires a RECENT login for password changes.
          const msg = (err as { code?: string; message?: string }).code === "auth/requires-recent-login"
            ? "Please log out and back in, then change the password."
            : (err as Error).message || "Update failed.";
          post({ ok: false, error: msg });
        }
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  if (state !== "ok") {
    return (
      <div style={{ height: "100vh", display: "grid", placeItems: "center", background: "#090d16", color: "#8b97af", fontFamily: "system-ui" }}>
        {state === "checking" ? "Checking admin access…" : "Redirecting…"}
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      src="/admin/console.html"
      title="MarketCatalyst Admin"
      onLoad={() =>
        iframeRef.current?.contentWindow?.postMessage(
          { type: "admin:identity", email: emailRef.current },
          "*",
        )
      }
      style={{ border: "none", width: "100vw", height: "100vh", display: "block" }}
    />
  );
}
