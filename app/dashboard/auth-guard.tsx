"use client";

import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { firebaseAuth } from "../firebase";

export function AuthGuard({ children }: Readonly<{ children: ReactNode }>) {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      firebaseAuth,
      (user) => {
        if (!user) {
          router.replace("/auth/login");
          return;
        }

        setIsChecking(false);
      },
      (error) => {
        window.alert(error.message);
        router.replace("/auth/login");
      },
    );

    return unsubscribe;
  }, [router]);

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

  return children;
}
