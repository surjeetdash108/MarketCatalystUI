import type { BillingInterval } from "./catalog";
export type { BillingInterval };

/**
 * The plan a visitor chose on the marketing site (?plan=&interval=), kept in
 * sessionStorage so it survives the Google sign-in redirect. Invalid values
 * mean "no preselection" — never a guess.
 */
export interface PlanIntent {
  planId: string;
  interval: BillingInterval;
  /** Optional promo code typed at signup; validated server-side before checkout. */
  promoCode?: string;
}

export const INTENT_KEY = "mc:plan-intent";

interface Store {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

/** Validates ?plan=&interval= against the plan ids the catalog actually offers. */
export function parsePlanParams(search: string, knownPlanIds: string[]): PlanIntent | null {
  const q = new URLSearchParams(search);
  const planId = (q.get("plan") ?? "").trim().toLowerCase();
  const rawInterval = (q.get("interval") ?? "").trim().toLowerCase();
  const promo = (q.get("promo") ?? "").trim().slice(0, 40);
  if (!planId || !knownPlanIds.includes(planId)) return null;
  // No interval → annual (the website shows annual prices by default).
  if (rawInterval !== "" && rawInterval !== "monthly" && rawInterval !== "annual") return null;
  const interval: BillingInterval = rawInterval === "monthly" ? "monthly" : "annual";
  return { planId, interval, ...(promo ? { promoCode: promo } : {}) };
}

/**
 * On the signup page: parse any ?plan=&interval= from the URL (null if not provided).
 */
export function parseSignupParams(search: string, knownPlanIds: string[]): PlanIntent | null {
  return parsePlanParams(search, knownPlanIds);
}

export function saveIntent(intent: PlanIntent | null, store: Store | null = safeSession()): void {
  try {
    if (!store) return;
    if (intent) store.setItem(INTENT_KEY, JSON.stringify(intent));
    else store.removeItem(INTENT_KEY);
  } catch {
    /* storage blocked: the URL params still work on this page */
  }
}

export function loadIntent(knownPlanIds: string[], store: Store | null = safeSession()): PlanIntent | null {
  try {
    const raw = store?.getItem(INTENT_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<PlanIntent>;
    if (!v || typeof v.planId !== "string" || !knownPlanIds.includes(v.planId) || (v.interval !== "monthly" && v.interval !== "annual")) return null;
    const promo = typeof v.promoCode === "string" ? v.promoCode.trim().slice(0, 40) : "";
    return { planId: v.planId, interval: v.interval, ...(promo ? { promoCode: promo } : {}) };
  } catch {
    return null;
  }
}

export function clearIntent(store: Store | null = safeSession()): void {
  saveIntent(null, store);
  clearOnboardingSession();
}

/** Clear all onboarding and checkout storage so a logout or session reset is clean. */
export function clearOnboardingSession(): void {
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      window.sessionStorage.removeItem(INTENT_KEY);
      window.sessionStorage.removeItem("mc:checkout-email");
      window.sessionStorage.removeItem("mc:checkout-from");
    }
  } catch {
    /* ignore */
  }
}

/** The one purchase page: /checkout with the chosen plan, interval and optional promo. */
export function checkoutPath(intent: Pick<PlanIntent, "planId" | "interval"> & { promoCode?: string }): string {
  const p = `/checkout?plan=${encodeURIComponent(intent.planId)}&interval=${intent.interval}`;
  return intent.promoCode ? `${p}&promo=${encodeURIComponent(intent.promoCode)}` : p;
}

/** The choose-plan path with the chosen plan, interval and optional promo. */
export function choosePlanPath(intent: Pick<PlanIntent, "planId" | "interval"> & { promoCode?: string }): string {
  const p = `/choose-plan?plan=${encodeURIComponent(intent.planId)}&interval=${intent.interval}`;
  return intent.promoCode ? `${p}&promo=${encodeURIComponent(intent.promoCode)}` : p;
}

/** The manage-plan path with the chosen plan, interval and optional promo. */
export function managePlanPath(intent: Pick<PlanIntent, "planId" | "interval"> & { promoCode?: string }): string {
  const p = `/manage-plan?plan=${encodeURIComponent(intent.planId)}&interval=${intent.interval}`;
  return intent.promoCode ? `${p}&promo=${encodeURIComponent(intent.promoCode)}` : p;
}

export type AuthMethod = "password" | "google";

/**
 * Where a just-created account goes:
 *  - no plan intent → dashboard
 *  - selected a plan → Step 2: /choose-plan
 */
export function nextAfterSignup(intent: PlanIntent | null, method: AuthMethod, paidPlansAvailable?: boolean): string {
  if (!intent) return "/dashboard";
  // Step 2 of the new-account flow (create account → select plan → payment).
  return `${choosePlanPath(intent)}&onboarding=1`;
}

/** True on pages reached through the new-account flow (shows the 3-step indicator). */
export function isOnboarding(search: string): boolean {
  return new URLSearchParams(search).get("onboarding") === "1";
}

/** Where an existing account that just signed in goes. */
export function nextAfterLogin(intent: PlanIntent | null, fallback: string, paidPlansAvailable?: boolean): string {
  if (fallback === "/admin") return "/admin";
  if (!intent) return fallback;
  return choosePlanPath(intent);
}

/** The intent from the URL (?plan=&interval=) or the session, validated against the catalog. */
export function currentIntent(search: string, knownPlanIds: string[], store: Store | null = safeSession()): PlanIntent | null {
  return parsePlanParams(search, knownPlanIds) ?? loadIntent(knownPlanIds, store);
}

function safeSession(): Store | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}
