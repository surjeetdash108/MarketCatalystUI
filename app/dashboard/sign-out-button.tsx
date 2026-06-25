"use client";

import { signOut } from "firebase/auth";
import { useState } from "react";
import { firebaseAuth } from "../firebase";

export function SignOutButton() {
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      await signOut(firebaseAuth);
      window.location.href = "/";
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to sign out. Please try again.";
      window.alert(message);
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
