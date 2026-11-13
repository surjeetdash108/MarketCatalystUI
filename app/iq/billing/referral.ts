/**
 * Referral links: /referral?code=MC-XXXX keeps the code on this device and
 * sends the friend to sign up (not checkout). Once the account exists, the
 * code is claimed on the server (POST /api/billing/referral/claim), which
 * links the friend to the referrer; both get $25 credit after the friend's
 * first payment. Pure helpers + storage; the claim call is passed in.
 */
export const REF_KEY = "mc_ref_code";
const CODE_RE = /^MC-[A-Z0-9]{4,16}$/;

export function normaliseReferralCode(raw: string | null | undefined): string | null {
  const c = String(raw ?? "").trim().toUpperCase();
  return CODE_RE.test(c) ? c : null;
}

export function referralLinkFor(origin: string, code: string): string {
  return `${origin.replace(/\/$/, "")}/referral?code=${encodeURIComponent(code)}`;
}

/** The code from a /referral or /auth/signup URL (?code=, ?ref= or the old ?promo=). */
export function referralCodeFromSearch(search: string): string | null {
  const p = new URLSearchParams(search);
  return normaliseReferralCode(p.get("code") ?? p.get("ref") ?? p.get("promo"));
}

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const local = (): Store | null => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

export function rememberReferral(code: string, store: Store | null = local()): void {
  try {
    store?.setItem(REF_KEY, code);
  } catch {
    /* storage unavailable */
  }
}

export function storedReferral(store: Store | null = local()): string | null {
  try {
    return normaliseReferralCode(store?.getItem(REF_KEY));
  } catch {
    return null;
  }
}

/**
 * After signup: claim the stored code once. Cleared after any answer from the
 * server (claimed or refused); kept only if the request itself failed.
 */
export async function claimStoredReferral(
  post: (path: string, body: unknown) => Promise<unknown>,
  store: Store | null = local(),
): Promise<"claimed" | "refused" | "none" | "error"> {
  const code = storedReferral(store);
  if (!code) return "none";
  try {
    const r = (await post("/api/billing/referral/claim", { code })) as { ok?: boolean } | null;
    store?.removeItem(REF_KEY);
    return r?.ok ? "claimed" : "refused";
  } catch {
    return "error";
  }
}
