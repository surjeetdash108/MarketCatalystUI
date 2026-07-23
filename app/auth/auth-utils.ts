import { FirebaseError } from "firebase/app";
import { onAuthStateChanged, UserCredential } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { firebaseAuth, firebaseDb } from "../firebase";
import { emptyInvestorProfile } from "../profile/profile-fields";

/**
 * Where a user lands after authentication. The single fixed admin account goes
 * to the admin console; everyone else to the normal app.
 *
 * Centralised deliberately: this is used by EVERY post-auth redirect path
 * (email/password login, Google sign-in, and the already-signed-in bounce).
 * When it lived only in the login form, signing in with Google — or simply
 * arriving already-authenticated — sent the admin to /dashboard instead.
 */
export const ADMIN_EMAIL = (
  process.env.NEXT_PUBLIC_ADMIN_EMAIL || "admin@marketcatalyst.ai"
).toLowerCase();

export function destinationFor(email?: string | null): string {
  return (email ?? "").trim().toLowerCase() === ADMIN_EMAIL ? "/admin" : "/dashboard";
}

/**
 * Resolves once the freshly-authenticated session is safe to survive a hard
 * page reload, then hard-navigates to `dest`.
 *
 * WHY THIS EXISTS — email login was stranding mobile users on the login page.
 * `signInWithEmailAndPassword` resolves as soon as the credential is validated,
 * but the session is persisted to IndexedDB by a separate transaction that is
 * still settling. A `window.location.href` in the SAME tick (as the login form
 * did) tears the page down on mobile WebKit before that transaction commits, so
 * the reloaded /dashboard restores NO user and its auth guard bounces straight
 * back to /login — a dead end. Desktop happened to win the race; phones lost it.
 *
 * The signup and Google paths never showed this because each already awaits a
 * Firestore round-trip (`setDoc` / `getDoc`) between auth and navigation, which
 * incidentally gives the persistence write time to land. This gives the email
 * login path the same settle point explicitly: it waits for the auth listener
 * to report a persisted user, which is the SDK's own signal that the session is
 * committed, before reloading.
 *
 * Bounded by a timeout so a wedged listener can never trap the user on the form:
 * after `timeoutMs` we navigate regardless — no worse than the old behaviour.
 */
export async function navigateAfterAuth(dest: string, timeoutMs = 5000): Promise<void> {
  await new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe();
      // One macrotask so the IndexedDB commit that backs `currentUser` flushes
      // before the navigation below tears the page down.
      setTimeout(resolve, 0);
    };
    const timer = setTimeout(done, timeoutMs);
    // Fires immediately with the current user when one already exists (it does,
    // right after a successful sign-in), and on every subsequent state change.
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      if (user) done();
    });
  });
  window.location.href = dest;
}

export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/invalid-email":
        return "Enter a valid email address.";
      case "auth/user-not-found":
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return "Email or password is incorrect.";
      case "auth/email-already-in-use":
        return "An account already exists with this email.";
      case "auth/configuration-not-found":
        return "Firebase Authentication is not configured for this project.";
      case "auth/weak-password":
        return "Password should be at least 6 characters.";
      case "auth/popup-closed-by-user":
        return "Google sign-in was closed before it finished.";
      case "auth/too-many-requests":
        return "Too many attempts. Please wait a moment and try again.";
      case "permission-denied":
        return "Google sign-in succeeded, but profile setup was blocked by Firestore rules.";
      default:
        return error.message;
    }
  }
  return "Something went wrong. Please try again.";
}

export function showError(message: string) {
  window.alert(message);
}

export function shouldUseGoogleRedirect(): boolean {
  const userAgent = window.navigator.userAgent.toLowerCase();
  const isMobile = /android|iphone|ipad|ipod|mobile/.test(userAgent);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
  return isMobile || isStandalone;
}

export async function completeGoogleLogin(userCredential: UserCredential) {
  const profileRef = doc(firebaseDb, "users", userCredential.user.uid);
  const profileSnap = await getDoc(profileRef);

  if (!profileSnap.exists()) {
    await setDoc(profileRef, {
      ...emptyInvestorProfile,
      uid: userCredential.user.uid,
      name: userCredential.user.displayName ?? "",
      email: userCredential.user.email ?? "",
      tier: "free",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    // First Google sign-in: collect the investor profile before the app.
    // The flag matters — profile/edit is ALSO reachable from the profile menu
    // for an existing user, and that case must stay put after saving rather
    // than bouncing to the dashboard.
    window.location.href = "/profile/edit?onboarding=1";
    return;
  }

  window.location.href = destinationFor(userCredential.user.email);
}

export async function checkAndRedirectIfLoggedIn() {
  await firebaseAuth.authStateReady();
  if (firebaseAuth.currentUser) {
    window.location.href = destinationFor(firebaseAuth.currentUser.email);
  }
}
