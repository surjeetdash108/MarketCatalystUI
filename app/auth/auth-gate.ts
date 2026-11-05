import { postLoginPath } from "../admin/admin-email";

/**
 * Who sees the login screen at / and /auth/login.
 *
 * The app is a static export, so those pages always ship the login form's
 * HTML, and Firebase restores a saved session from IndexedDB only after the
 * page has loaded. Painting the form first and redirecting once the session
 * turned up is the "login flash" a signed-in user saw. The gate paints nothing
 * but the background until it knows, and a signed-in user is sent on without
 * the form ever showing.
 *
 * The hint below (the last auth state this browser saw) does two things: at /
 * only, a browser that was signed in leaves for its home before anything loads
 * (EARLY_REDIRECT_SCRIPT); and a browser that last saw a sign-out gets the form
 * without waiting. /auth/login never redirects on it, which is what keeps a
 * stale value from bouncing a user between the login page and the dashboard.
 */

export const AUTH_HINT_KEY = "mc_auth_hint";
/** The home a signed-in user is sent to (/dashboard, or /admin for the admin account). */
export const AUTH_HOME_KEY = "mc_auth_home";
export type AuthHint = "in" | "out" | null;
type HintStore = Pick<Storage, "getItem" | "setItem">;

const browserStore = (): HintStore | null => (typeof window === "undefined" ? null : window.localStorage);

/** The last auth state this browser saw ("in" / "out"), or null when unknown or storage is blocked. */
export function readAuthHint(store: HintStore | null = browserStore()): AuthHint {
  try {
    const v = store?.getItem(AUTH_HINT_KEY);
    return v === "in" || v === "out" ? v : null;
  } catch {
    return null;
  }
}

/** Records the auth state Firebase reported (and a signed-in user's home); a blocked storage is ignored (the gate then just waits). */
export function writeAuthHint(signedIn: boolean, store: HintStore | null = browserStore(), home?: string): void {
  try {
    store?.setItem(AUTH_HINT_KEY, signedIn ? "in" : "out");
    if (signedIn && home) store?.setItem(AUTH_HOME_KEY, home);
  } catch {
    /* private mode / blocked storage: no hint, no harm */
  }
}

/** The form may paint before Firebase restores the session only when this browser last saw a sign-out. */
export const showLoginBeforeAuthReady = (hint: AuthHint): boolean => hint === "out";

export type GateDecision = { kind: "redirect"; to: string } | { kind: "login" };

/** Once Firebase knows: a signed-in user goes to their home; nobody signed in sees the form. */
export function gateDecision(user: { email: string | null } | null): GateDecision {
  return user ? { kind: "redirect", to: postLoginPath(user.email) } : { kind: "login" };
}

/**
 * Inline at the top of / (app/page.tsx), so it runs as the HTML is parsed —
 * before any JavaScript bundle or Firebase loads, which is where the 2-3 s
 * went. A browser that was signed in is sent to its home at once; only the two
 * known homes are allowed. If the session has in fact expired, /dashboard's
 * guard sends the user to /auth/login, and the Firebase listener marks the
 * browser signed out first. /auth/login never redirects on the hint, so a
 * stale hint cannot loop.
 */
export const EARLY_REDIRECT_SCRIPT =
  'try{if(localStorage.getItem("' + AUTH_HINT_KEY + '")==="in"){' +
  'location.replace(localStorage.getItem("' + AUTH_HOME_KEY + '")==="/admin"?"/admin":"/dashboard")}}catch(e){}';
