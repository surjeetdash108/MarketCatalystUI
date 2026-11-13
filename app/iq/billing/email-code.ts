/** Only same-site paths are followed after verification ("/x", never "//host" or a URL). */
export function safeNext(next: string | null | undefined, fallback = "/dashboard"): string {
  const n = String(next ?? "");
  return n.startsWith("/") && !n.startsWith("//") && !n.includes("\\") ? n : fallback;
}

/** sessionStorage key: when this tab last sent a verification link. */
export const LINK_SENT_KEY = "mc.verifyLinkSentAt";

/** Seconds until another link may be sent (60s between sends). */
export function resendWaitSeconds(lastSentAt: number | null, now: number, cooldownMs = 60_000): number {
  if (!lastSentAt || !Number.isFinite(lastSentAt)) return 0;
  return Math.max(0, Math.ceil((lastSentAt + cooldownMs - now) / 1000));
}

/** Where the email's link returns to: /verify-email, which then continues to `next`. */
export function verifyContinueUrl(origin: string, next: string): string {
  const n = safeNext(next);
  return `${origin}/verify-email${n === "/dashboard" ? "" : `?next=${encodeURIComponent(n)}`}`;
}
