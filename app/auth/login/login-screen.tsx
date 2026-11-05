"use client";

import { getRedirectResult } from "firebase/auth";
import { useEffect, useLayoutEffect, useState } from "react";
import { firebaseAuth } from "../../firebase";
import { gateDecision, readAuthHint, showLoginBeforeAuthReady, writeAuthHint } from "../auth-gate";
import { AuthLayout } from "../auth-layout";
import { completeGoogleLogin, getAuthErrorMessage } from "../auth-utils";
import { LoginForm } from "./login-form";

/**
 * The login page at / and /auth/login, gated (auth-gate.ts): until Firebase
 * has restored any saved session only the page background paints, so a
 * signed-in user goes straight to /dashboard without the form flashing up.
 */
export function LoginScreen() {
  const [show, setShow] = useState(false);
  const [initialError, setInitialError] = useState("");

  // Before the first paint after hydration: a browser that last saw a sign-out gets the form at once.
  // localStorage cannot be read during the server render (the static HTML must match), so this one
  // state change has to happen here, and before paint is the point of it.
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (showLoginBeforeAuthReady(readAuthHint())) setShow(true);
  }, []);

  useEffect(() => {
    let live = true;
    void (async () => {
      // Back from Google's redirect sign-in (installed PWA): finish it here, so a new
      // account still gets its profile and lands on /profile/edit.
      try {
        const cred = await getRedirectResult(firebaseAuth);
        if (cred) {
          if (live) setShow(false);
          await completeGoogleLogin(cred);
          return;
        }
      } catch (err) {
        if (live) { setInitialError(getAuthErrorMessage(err)); setShow(true); }
        return;
      }
      await firebaseAuth.authStateReady();
      const d = gateDecision(firebaseAuth.currentUser);
      if (d.kind === "redirect") {
        writeAuthHint(true, undefined, d.to);
        // replace, not assign: Back from the dashboard must not return to the login page.
        window.location.replace(d.to);
        return;
      }
      writeAuthHint(false);
      if (live) setShow(true);
    })();
    return () => { live = false; };
  }, []);

  // While the session is checked: a spinner, never the sign-in form (it confused signed-in users for seconds).
  if (!show)
    return (
      <div className="lp-root" aria-busy="true" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
        <style>{`@keyframes lpGateSpin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: 34, height: 34, borderRadius: "50%", border: "2px solid #1c2226", borderTopColor: "#00D18F", animation: "lpGateSpin .75s linear infinite" }} />
        <div style={{ fontSize: ".72rem", letterSpacing: ".14em", textTransform: "uppercase", fontWeight: 600, color: "#6C747C" }}>Checking your session…</div>
      </div>
    );
  return (
    <AuthLayout>
      <LoginForm initialError={initialError} />
    </AuthLayout>
  );
}
