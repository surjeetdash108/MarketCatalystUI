"use client";

import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { firebaseAuth } from "../firebase";

export function SignOutButton() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);

    try {
      await signOut(firebaseAuth);
      router.replace("/auth/login");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to sign out. Please try again.";
      window.alert(message);
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <button
      className="h-10 rounded-md border border-[#d6dfd9] px-4 text-sm font-semibold text-[#1f5f50] transition hover:bg-[#eef6f3] disabled:cursor-not-allowed disabled:opacity-60"
      disabled={isSigningOut}
      onClick={handleSignOut}
      type="button"
    >
      {isSigningOut ? "Signing out..." : "Sign out"}
    </button>
  );
}
