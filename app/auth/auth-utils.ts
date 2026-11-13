import { FirebaseError } from "firebase/app";
import { UserCredential } from "firebase/auth";
import { firebaseAuth } from "../firebase";
import { apiGet, apiPatch } from "../iq/backend";
import { emptyInvestorProfile, toProfilePatch } from "../profile/profile-fields";
import { routeAfterLogin, routeAfterSignup } from "../iq/billing/auth-routing";
import { isAdminEmail, postLoginPath } from "../admin/admin-email";
import { clearOnboardingSession } from "../iq/billing/plan-intent";
import { EMAIL_IN_USE_MESSAGE } from "./email-error";
export { errorAfterEmailEdit } from "./email-error";

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
        return EMAIL_IN_USE_MESSAGE;
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
  if (typeof window === "undefined") return false;
  // Only standalone installed PWAs (e.g. iOS WebClip added to Home Screen)
  // strictly cannot open browser popups and must use redirect.
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return isStandalone;
}

export async function completeGoogleLogin(userCredential: UserCredential) {
  if (isAdminEmail(userCredential.user.email)) {
    clearOnboardingSession();
    window.location.href = "/admin";
    return;
  }

  const existing = await apiGet<Record<string, unknown> | null>("/api/profile");

  if (!existing) {
    await apiPatch("/api/profile", toProfilePatch({
      ...emptyInvestorProfile,
      name: userCredential.user.displayName ?? "",
    }));
    if (typeof window !== "undefined") {
      window.localStorage.setItem("mc_show_welcome", "1");
    }
    // New Google account (already verified): plan from the website tile →
    // /checkout (the intent survived the redirect in sessionStorage); no plan →
    // Free → dashboard.
    window.location.href = await routeAfterSignup("google");
    return;
  }

  if (typeof window !== "undefined") {
    window.sessionStorage.setItem("mc_show_feedback", "1");
  }
  window.location.href = await routeAfterLogin(postLoginPath(userCredential.user.email));
}
