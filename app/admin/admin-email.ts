/**
 * The single fixed admin account email — ONE definition, imported by both the
 * /admin gate and the post-login redirect so "who is the admin" can never drift
 * between them. Kept in its own tiny module (no heavy imports) so the login
 * bundle doesn't pull in admin-data.ts.
 *
 * Mirrors ADMIN_EMAIL in the backend (deploy/env.production.yaml / AdminGuard).
 */
export const ADMIN_EMAIL = (
  process.env.NEXT_PUBLIC_ADMIN_EMAIL || "admin@marketcatalyst.ai"
).toLowerCase();

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase() === ADMIN_EMAIL;
}

/**
 * Content editors: accounts that get only the console's Blogs and Content
 * pipeline sections. Mirrors ADMIN_EDITOR_EMAILS in the backend, which is the
 * real control (AdminGuard refuses an editor on every other admin route); this
 * list only decides where an editor lands after signing in.
 */
export const ADMIN_EDITOR_EMAILS: readonly string[] = (
  process.env.NEXT_PUBLIC_ADMIN_EDITOR_EMAILS ?? ""
)
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter((e) => e && e !== ADMIN_EMAIL);

export function isEditorEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EDITOR_EMAILS.includes(email.trim().toLowerCase());
}

/** An account whose home is the admin console (the admin, or a content editor). */
export function isConsoleEmail(email: string | null | undefined): boolean {
  return isAdminEmail(email) || isEditorEmail(email);
}

/** Where a just-signed-in user should land: the admin console, else the app. */
export function postLoginPath(email: string | null | undefined): string {
  return isConsoleEmail(email) ? "/admin" : "/dashboard";
}
