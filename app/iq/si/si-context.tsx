"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
} from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { SITab } from "./types";

interface SIContextType {
  isSI: boolean;
  siTicker: string | null;
  activeTab: SITab;
  setActiveTab: (tab: SITab) => void;
  enterSI: (ticker?: string, tab?: SITab) => void;
  exitToMC: (ticker?: string) => void;
  toggleSI: () => void;
  sweep: { active: boolean; to: "SI" | "MC"; key: number } | null;
  setSiTicker: (ticker: string | null) => void;
}

const SIContext = createContext<SIContextType | null>(null);

export function SIProvider({
  children,
  onOpenStockInMC,
}: {
  children: ReactNode;
  onOpenStockInMC?: (ticker: string) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isSiRoute = pathname?.startsWith("/si");
  const symParam = searchParams?.get("sym")?.toUpperCase() || null;

  const [isSI, setIsSI] = useState<boolean>(isSiRoute);
  const [siTicker, setSiTicker] = useState<string | null>(symParam);
  const [activeTab, setActiveTab] = useState<SITab>("overview");
  const [sweep, setSweep] = useState<{ active: boolean; to: "SI" | "MC"; key: number } | null>(null);

  // Sync if URL query param or path changes
  useEffect(() => {
    if (isSiRoute) {
      setIsSI(true);
      if (symParam && symParam !== siTicker) {
        setSiTicker(symParam);
      }
    } else {
      setIsSI(false);
    }
  }, [isSiRoute, symParam]);

  const triggerSweep = useCallback((to: "SI" | "MC") => {
    const key = Date.now();
    setSweep({ active: true, to, key });
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("mc_sweep_info", JSON.stringify({ to, time: key }));
        window.dispatchEvent(new CustomEvent("mc-sweep-start", { detail: { to, key } }));
      } catch {}
    }
    setTimeout(() => {
      setSweep(null);
    }, 600);
  }, []);

  // Check on mount if a sweep was recently triggered across page load
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = sessionStorage.getItem("mc_sweep_info");
        if (raw) {
          const parsed = JSON.parse(raw);
          const age = Date.now() - (parsed.time || 0);
          if (age < 600) {
            setSweep({ active: true, to: parsed.to, key: parsed.time });
            setTimeout(() => {
              setSweep(null);
              sessionStorage.removeItem("mc_sweep_info");
            }, 600 - age);
          } else {
            sessionStorage.removeItem("mc_sweep_info");
          }
        }
      } catch {}
    }
  }, []);

  const enterSI = useCallback(
    (ticker?: string, tab?: SITab) => {
      triggerSweep("SI");
      const stored = typeof window !== "undefined" ? localStorage.getItem("iq-stock") : null;
      const targetSym = ticker || siTicker || stored || "NVDA";
      if (targetSym) {
        const clean = targetSym.toUpperCase().trim();
        setSiTicker(clean);
        if (typeof window !== "undefined") {
          localStorage.setItem("iq-stock", clean);
        }
        setTimeout(() => {
          setIsSI(true);
          router.push(`/si?sym=${clean}`);
        }, 70);
      } else {
        setTimeout(() => {
          setIsSI(true);
          router.push("/si");
        }, 70);
      }
      if (tab) setActiveTab(tab);
    },
    [router, triggerSweep, siTicker]
  );

  const exitToMC = useCallback(
    (ticker?: string) => {
      triggerSweep("MC");
      const stored = typeof window !== "undefined" ? localStorage.getItem("iq-stock") : null;
      const targetSym = ticker || siTicker || stored || "NVDA";
      if (targetSym) {
        const clean = targetSym.toUpperCase().trim();
        if (typeof window !== "undefined") {
          localStorage.setItem("iq-stock", clean);
          localStorage.setItem("iq-nav-collapsed", "0");
          window.dispatchEvent(
            new CustomEvent("iq-stock-change", { detail: clean })
          );
        }
        if (onOpenStockInMC) {
          onOpenStockInMC(clean);
        }
        setTimeout(() => {
          setIsSI(false);
          router.push("/menu/stock");
        }, 70);
      } else {
        setTimeout(() => {
          setIsSI(false);
          router.push("/dashboard");
        }, 70);
      }
    },
    [siTicker, router, onOpenStockInMC, triggerSweep]
  );

  const toggleSI = useCallback(() => {
    if (isSI) {
      exitToMC();
    } else {
      enterSI(siTicker || undefined);
    }
  }, [isSI, exitToMC, enterSI, siTicker]);

  return (
    <SIContext.Provider
      value={{
        isSI,
        siTicker,
        activeTab,
        setActiveTab,
        enterSI,
        exitToMC,
        toggleSI,
        sweep,
        setSiTicker,
      }}
    >
      {children}
    </SIContext.Provider>
  );
}

export function useSI() {
  const ctx = useContext(SIContext);
  if (!ctx) {
    return {
      isSI: false,
      siTicker: null,
      activeTab: "overview" as SITab,
      setActiveTab: () => {},
      enterSI: () => {},
      exitToMC: () => {},
      toggleSI: () => {},
      sweep: null,
      setSiTicker: () => {},
    };
  }
  return ctx;
}
