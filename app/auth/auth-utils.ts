import { FirebaseError } from "firebase/app";
import { UserCredential } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { firebaseAuth, firebaseDb } from "../firebase";
import { emptyInvestorProfile } from "../profile/profile-fields";

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
    window.location.href = "/profile/edit";
    return;
  }

  window.location.href = "/dashboard";
}

export async function checkAndRedirectIfLoggedIn() {
  await firebaseAuth.authStateReady();
  if (firebaseAuth.currentUser) {
    window.location.href = "/dashboard";
  }
}
