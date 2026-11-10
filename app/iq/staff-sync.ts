"use client";

import type { User } from "firebase/auth";
import { syncClaims } from "./billing/api";
import { refreshEntitlements } from "./hooks/useEntitlements";

/**
 * Staff claim sync, on sign-in and on every token refresh. The backend sets or
 * clears the `staff` custom claim from the verified email and the allowlist;
 * when it changed, fetch a fresh token so Firestore rules see it, and re-read
 * entitlements. Throttled so a forced refresh doesn't loop.
 */
const MIN_INTERVAL_MS = 5 * 60_000;
let last: { uid: string; at: number } | null = null;

export function shouldSync(uid: string, now: number, prev: { uid: string; at: number } | null): boolean {
  return !prev || prev.uid !== uid || now - prev.at >= MIN_INTERVAL_MS;
}

export async function syncStaffClaim(user: User | null): Promise<void> {
  if (!user) {
    last = null;
    return;
  }
  const now = Date.now();
  if (!shouldSync(user.uid, now, last)) return;
  last = { uid: user.uid, at: now };
  try {
    const r = await syncClaims();
    if (r.refreshToken) {
      await user.getIdToken(true);
      await refreshEntitlements();
    }
  } catch {
    /* backend unreachable: try again on the next token refresh */
    last = null;
  }
}
