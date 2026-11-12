
/**
 * Whether a user is CONFIRMED to be on a paid plan, from the profile fields the
 * backend writes (`users/{uid}`: currentPlan, subscriptionStatus,
 * subscriptionExpiryDate). Plan state is written only by the backend — the
 * Stripe webhook once billing is live — so these fields are trustworthy here.
 *
 * Deliberately conservative: anything unknown reads as NOT paid. The old check
 * (`profile?.tier !== "free"`) showed "Premium · Active" whenever the profile
 * was still loading, failed to load, or had no tier — the opposite default.
 * The legacy `tier` field is ignored entirely.
 *
 * Mirrors the backend's resolver (MarketCatalystBackEnd/src/plans/subscriptions.service.ts):
 * the stored status is intent, the expiry date is truth, and a date-only expiry
 * lasts to the end of that day UTC. PAST_DUE grace is handled by the
 * entitlements endpoint, not here.
 */
export interface PlanFields {
  tier?: string | null;
  currentPlan?: string | null;
  subscriptionStatus?: string | null;
  subscriptionExpiryDate?: string | null;
  email?: string | null;
}

/** The plan every user without a live subscription resolves to. */
export const FREE_PLAN_ID = "free";

const LIVE_STATUSES = new Set(["ACTIVE", "TRIALING"]);

function expiryMs(iso: string): number {
  return Date.parse(iso.length === 10 ? `${iso}T23:59:59Z` : iso);
}

export function hasConfirmedPaidPlan(profile: PlanFields | null | undefined, now: number = Date.now(), email?: string | null): boolean {
  void email;
  if (!profile) return false;
  const plan = profile.currentPlan;
  if (!plan || plan === FREE_PLAN_ID) return false;
  if (!profile.subscriptionStatus || !LIVE_STATUSES.has(profile.subscriptionStatus)) return false;
  const expiry = profile.subscriptionExpiryDate;
  if (expiry) {
    const t = expiryMs(expiry);
    if (!Number.isFinite(t) || t < now) return false;
  }
  return true;
}
