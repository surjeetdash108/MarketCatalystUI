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
 * The hint below only shortens the wait for people who are signed out: it is
 * never trusted to redirect, so a stale value cannot bounce a user between the
 * login page and the dashboard.
 */

export const AUTH_HINT_KEY = "mc_auth_hint";
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

/** Records the auth state Firebase reported; a blocked storage is ignored (the gate then just waits). */
export function writeAuthHint(signedIn: boolean, store: HintStore | null = browserStore()): void {
  try {
    store?.setItem(AUTH_HINT_KEY, signedIn ? "in" : "out");
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
