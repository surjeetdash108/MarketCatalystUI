import type { Entitlements } from "./hooks/useEntitlements";

export type BannerKind = "trial-canceling" | "trial" | "intro" | "expired-intro" | null;

/**
 * Which top banner the app shows. A paying member who cancelled sees their end
 * date on Manage Plan, not on every screen. Once a plan (trial included) is
 * activated there's no "free trial active" banner either: only a cancelled
 * trial shows when it ends.
 */
export function bannerKind(ent: Entitlements | null | undefined): BannerKind {
  if (!ent || ent.staff) return null;
  const isTrial = ent.status === "TRIALING" || ent.status === "trialing";
  if (isTrial) return ent.cancelAtPeriodEnd && ent.currentPeriodEnd ? "trial-canceling" : null;
  if (ent.status === "INTRO" && ent.introEndsAt && ent.subscriptionsEnabled) return "intro";
  if (ent.status === "EXPIRED" && !ent.cancelAtPeriodEnd && ent.subscriptionsEnabled) return "expired-intro";
  return null;
}
