"use client";

import { ReactNode, useEffect } from "react";
import { useAppSelector } from "../store/hooks";

export function AuthGuard({ children }: Readonly<{ children: ReactNode }>) {
  const { user, status } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (status === "ready" && !user) {
      window.location.href = "/auth/login";
    }
  }, [status, user]);

  if (status === "loading") {
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

  if (!user) return null;

  return children;
}
