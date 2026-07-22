import { getApp, getApps, initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import {
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

/** Fallback auth domain — used during SSG/build and on non-hosted origins. */
const DEFAULT_AUTH_DOMAIN = "market-catalyst-502415.firebaseapp.com";

/**
 * Domains this app is actually served from. Firebase Hosting serves the auth
 * helper at `/__/auth/*` on every domain it hosts, so on any of these the
 * sign-in flow can run SAME-ORIGIN.
 *
 * WHY THIS EXISTS — mobile Google sign-in was failing outright.
 * `shouldUseGoogleRedirect()` picks `signInWithRedirect` on mobile, and since
 * Firebase JS SDK v9.15 that flow no longer works when `authDomain` differs
 * from the page's own origin: Safari ITP and Chrome's partitioned storage block
 * the third-party state the redirect hand-off depends on, so the user is bounced
 * back with no credential. The app runs on `marketcatalyst.web.app` while
 * `authDomain` pointed at `…firebaseapp.com` — precisely the broken pairing.
 *
 * Pointing `authDomain` at the current host makes the hand-off first-party.
 * Verified 2026-07-22: `https://marketcatalyst.web.app/__/auth/handler` → 200,
 * and the host is listed in the project's authorized domains.
 */
const SELF_HOSTED_AUTH_DOMAINS = new Set([
  "marketcatalyst.web.app",
  "marketcatalyst.firebaseapp.com",
  "market-catalyst-502415.web.app",
  "market-catalyst-502415.firebaseapp.com",
  "marketcatalyst.ai",
]);

function resolveAuthDomain(): string {
  if (typeof window === "undefined") return DEFAULT_AUTH_DOMAIN; // build/SSG
  const host = window.location.hostname;
  // localhost and preview origins do NOT serve /__/auth/*, so they must keep
  // the firebaseapp.com handler. Desktop dev uses the popup flow, which works
  // cross-domain, so this costs nothing locally.
  return SELF_HOSTED_AUTH_DOMAINS.has(host) ? host : DEFAULT_AUTH_DOMAIN;
}

const firebaseConfig = {
  apiKey: "AIzaSyDVjZmJ11qzbPIvruwOHiTiMWvjTcUmhuk",
  authDomain: resolveAuthDomain(),
  projectId: "market-catalyst-502415",
  storageBucket: "market-catalyst-502415.firebasestorage.app",
  messagingSenderId: "741318166823",
  appId: "1:741318166823:web:e7bdefb314ecd446494102",
  measurementId: "G-NFPTC0K6Z0",
};

export const firebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

// Use initializeAuth with IndexedDB persistence so Safari ITP (which blocks
// cross-origin cookies) cannot clear the auth state between navigations.
// Falls back to getAuth if the instance was already created (e.g. hot reload).
function createAuth() {
  try {
    return initializeAuth(firebaseApp, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    return getAuth(firebaseApp);
  }
}

export const firebaseAuth = createAuth();
export const firebaseDb = getFirestore(firebaseApp);
export const googleAuthProvider = new GoogleAuthProvider();

export async function getFirebaseAnalytics() {
  if (typeof window === "undefined") {
    return null;
  }

  const supported = await isSupported();

  if (!supported) {
    return null;
  }

  return getAnalytics(firebaseApp);
}
