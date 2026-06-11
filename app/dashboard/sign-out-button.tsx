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
    await signOut(firebaseAuth);
    router.replace("/auth/login");
  }

  return (
    <button
      className="h-10 rounded-md border border-[#e4e6ef] px-4 text-sm font-black text-[#4b46e8] transition hover:bg-[#f2f1ff] disabled:cursor-not-allowed disabled:opacity-60"
      disabled={isSigningOut}
      onClick={handleSignOut}
      type="button"
    >
      {isSigningOut ? "Signing out..." : "Sign out"}
    </button>
  );
}
