/**
 * The "7 days complimentary access" welcome after a new signup:
 *   - normal signup, or signup from a website plan without subscribing → show;
 *   - signup from a website plan that went on to subscribe (paid or trial) →
 *     don't (they get the plan-activated message instead).
 * "wait" until entitlements have loaded.
 */
export type WelcomeDecision = "show" | "drop" | "wait";

export const SUBSCRIBED_STATUSES = ["ACTIVE", "TRIALING", "PAST_DUE"] as const;

export function welcomeDecision(flagSet: boolean, status: string | null | undefined): WelcomeDecision {
  if (!flagSet) return "drop";
  if (status == null) return "wait";
  return (SUBSCRIBED_STATUSES as readonly string[]).includes(status) ? "drop" : "show";
}

