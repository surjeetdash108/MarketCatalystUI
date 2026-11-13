import { safeNext } from "../../iq/billing/email-code";

/**
 * Our own handler for Firebase's emailed links (verify email, reset password,
 * recover email), so the links and the page are on app.marketcatalyst.ai.
 * Firebase is configured to send links to /auth/action?mode=…&oobCode=….
 */
export type ActionMode = "verifyEmail" | "verifyAndChangeEmail" | "resetPassword" | "recoverEmail";
const MODES: ActionMode[] = ["verifyEmail", "verifyAndChangeEmail", "resetPassword", "recoverEmail"];

export interface ActionParams {
  mode: ActionMode | null;
  oobCode: string | null;
  /** Where to go afterwards: a path on this site only (never another domain). */
  next: string;
}

/** The continueUrl as a same-site path; anything off-site falls back. */
export function continuePath(continueUrl: string | null, origin: string, fallback = "/dashboard"): string {
  if (!continueUrl) return fallback;
  try {
    const u = new URL(continueUrl, origin);
    const allowed = new Set([new URL(origin).host, "app.marketcatalyst.ai"]);
    if (!allowed.has(u.host)) return fallback;
    return safeNext(`${u.pathname}${u.search}`, fallback);
  } catch {
    return fallback;
  }
}

export function parseActionParams(search: string, origin: string): ActionParams {
  const p = new URLSearchParams(search);
  const m = p.get("mode");
  const mode = MODES.includes(m as ActionMode) ? (m as ActionMode) : null;
  const oob = p.get("oobCode");
  const oobCode = oob && /^[A-Za-z0-9_-]{10,}$/.test(oob) ? oob : null;
  const fallback = mode === "resetPassword" ? "/auth/login" : "/dashboard";
  return { mode, oobCode, next: continuePath(p.get("continueUrl"), origin, fallback) };
}

/** A plain message for Firebase action-code errors. */
export function actionErrorMessage(code: string | undefined): string {
  switch (code) {
    case "auth/expired-action-code":
      return "This link has expired. Request a new one and try again.";
    case "auth/invalid-action-code":
      return "This link is invalid or has already been used. Request a new one and try again.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/user-not-found":
      return "This account no longer exists.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    default:
      return "Something went wrong with this link. Request a new one and try again.";
  }
}
