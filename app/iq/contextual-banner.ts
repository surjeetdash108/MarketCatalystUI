import type { Entitlements } from "./hooks/useEntitlements";

export type BannerKind = "trial-canceling" | "trial" | "intro" | "expired-intro" | null;

/**
 * Which top banner the app shows. Banners are for trials only: a paying member
 * who cancelled sees their end date on Manage Plan, not on every screen.
 */
export function bannerKind(ent: Entitlements | null | undefined): BannerKind {
  if (!ent || ent.staff) return null;
  const isTrial = ent.status === "TRIALING" || ent.status === "trialing";
  if (isTrial) return ent.cancelAtPeriodEnd && ent.currentPeriodEnd ? "trial-canceling" : "trial";
  if (ent.status === "INTRO" && ent.introEndsAt && ent.subscriptionsEnabled) return "intro";
  if (ent.status === "EXPIRED" && !ent.cancelAtPeriodEnd && ent.subscriptionsEnabled) return "expired-intro";
  return null;
}
