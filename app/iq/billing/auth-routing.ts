"use client";

import { useEffect } from "react";
import { fetchPlans } from "./api";
import { currentIntent, nextAfterLogin, nextAfterSignup, saveIntent, type AuthMethod } from "./plan-intent";

/** Plans + availability; a failed lookup means "not available" (never send someone to a dead checkout). */
async function catalog(): Promise<{ ids: string[]; paidPlansAvailable: boolean }> {
  try {
    const { plans, paidPlansAvailable } = await fetchPlans();
    return { ids: plans.map((p) => p.id), paidPlansAvailable };
  } catch {
    return { ids: [], paidPlansAvailable: false };
  }
}

/** Where a just-created account goes (see nextAfterSignup). */
export async function routeAfterSignup(method: AuthMethod): Promise<string> {
  const { ids, paidPlansAvailable } = await catalog();
  return nextAfterSignup(currentIntent(window.location.search, ids), method, paidPlansAvailable);
}

/** Where an existing account goes after signing in (see nextAfterLogin). */
export async function routeAfterLogin(fallback: string): Promise<string> {
  const { ids, paidPlansAvailable } = await catalog();
  return nextAfterLogin(currentIntent(window.location.search, ids), fallback, paidPlansAvailable);
}

/**
 * On /auth/signup and /auth/login: keep ?plan=&interval= from the website tile
 * in sessionStorage so it survives the Google redirect and the email step.
 * There is no plan choice on these pages.
 */
export function useCaptureIntent(): void {
  useEffect(() => {
    void catalog().then(({ ids }) => {
      const fromUrl = currentIntent(window.location.search, ids, null);
      if (fromUrl) saveIntent(fromUrl);
    });
  }, []);
}

/** Same query string on the sign-in ↔ sign-up links, so the plan rides along. */
export function withSearch(path: string): string {
  return typeof window === "undefined" ? path : `${path}${window.location.search}`;
}
