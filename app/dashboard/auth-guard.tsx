"use client";

import { onAuthStateChanged } from "firebase/auth";
import { ReactNode, useEffect, useState } from "react";
import { firebaseAuth } from "../firebase";

export function AuthGuard({ children }: Readonly<{ children: ReactNode }>) {
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    // authStateReady() resolves once Firebase has read the persisted session
    // from IndexedDB. Without this, onAuthStateChanged can fire with null
    // before the stored token is loaded, causing a spurious redirect to login.
    void firebaseAuth.authStateReady().then(() => {
      if (cancelled) return;

      unsubscribe = onAuthStateChanged(
        firebaseAuth,
        (user) => {
          if (user) {
            setIsAuthenticated(true);
          } else {
            window.location.href = "/auth/login";
          }
          setIsChecking(false);
        },
        (error) => {
          console.error("Auth state error:", error);
          window.alert(error.message);
          window.location.href = "/auth/login";
          setIsChecking(false);
        },
      );
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  if (isChecking) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f4f6f8] text-[#17231d]">
        <div className="rounded-lg border border-[#dde5df] bg-white px-6 py-5 text-center shadow-[0_24px_80px_rgba(35,38,75,0.08)]">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-[#166052]">
            finapp26
          </p>
          <p className="mt-2 text-lg font-black">Checking your session...</p>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return children;
}
