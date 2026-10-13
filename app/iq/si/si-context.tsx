"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { SITab } from "./types";

interface SIContextType {
  isSI: boolean;
  siTicker: string | null;
  activeTab: SITab;
  setActiveTab: (tab: SITab) => void;
  enterSI: (ticker?: string, tab?: SITab) => void;
  exitToMC: (ticker?: string) => void;
  goToSearch: () => void;
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

  const isSiRoute = pathname ? pathname.startsWith("/si") : false;

  const [isSI, setIsSI] = useState<boolean>(isSiRoute);
  const [siTicker, setSiTicker] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const sym = new URLSearchParams(window.location.search).get("sym");
      if (sym) return sym.toUpperCase().trim();
    }
    return null;
  });
  const [activeTab, setActiveTab] = useState<SITab>("overview");
  const [sweep, setSweep] = useState<{ active: boolean; to: "SI" | "MC"; key: number } | null>(null);

  // Sync if URL query param or path changes
  useEffect(() => {
    const isSi = pathname ? pathname.startsWith("/si") : false;
    setIsSI(isSi);
    if (isSi) {
      if (typeof window !== "undefined") {
        const sym = new URLSearchParams(window.location.search).get("sym");
        setSiTicker(sym ? sym.toUpperCase().trim() : null);
      }
    } else {
      if (pathname && !pathname.startsWith("/menu/stock")) {
        setSiTicker(null);
      }
    }
  }, [pathname]);

  // Also listen for popstate (browser back/forward button)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handlePopState = () => {
      const isSi = window.location.pathname.startsWith("/si");
      setIsSI(isSi);
      if (isSi) {
        const sym = new URLSearchParams(window.location.search).get("sym");
        setSiTicker(sym ? sym.toUpperCase().trim() : null);
      } else {
        if (!window.location.pathname.startsWith("/menu/stock")) {
          setSiTicker(null);
        }
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const triggerSweep = useCallback((to: "SI" | "MC") => {
    const key = Date.now();
    setSweep({ active: true, to, key });
    if (typeof window !== "undefined") {
      try {
        window.dispatchEvent(new CustomEvent("mc-sweep-start", { detail: { to, key } }));
      } catch {}
    }
    setTimeout(() => {
      setSweep(null);
    }, 700);
  }, []);

  const goToSearch = useCallback(() => {
    setSiTicker(null);
    if (typeof window !== "undefined") {
      router.push("/si");
    }
  }, [router]);

  const enterSI = useCallback(
    (ticker?: string, tab?: SITab) => {
      triggerSweep("SI");
      const currentPath = pathname || (typeof window !== "undefined" ? window.location.pathname : "");
      const isOnStockPage = currentPath.startsWith("/menu/stock");

      const stored = typeof window !== "undefined" ? localStorage.getItem("iq-stock") : null;
      let targetSym: string | null = null;

      if (ticker) {
        targetSym = ticker.toUpperCase().trim();
      } else if (isOnStockPage) {
        // The stock page shows localStorage "iq-stock", or NVDA when nothing is
        // stored (see StockScreen), so carry over exactly what is on screen.
        targetSym = (stored || "NVDA").toUpperCase().trim();
      }

      if (targetSym) {
        setSiTicker(targetSym);
        if (typeof window !== "undefined") {
          localStorage.setItem("iq-stock", targetSym);
        }
        setTimeout(() => {
          setIsSI(true);
          router.push(`/si?sym=${targetSym}`);
        }, 160);
      } else {
        setSiTicker(null);
        setTimeout(() => {
          setIsSI(true);
          router.push("/si");
        }, 160);
      }
      if (tab) setActiveTab(tab);
    },
    [router, triggerSweep, pathname]
  );

  const exitToMC = useCallback(
    (ticker?: string) => {
      triggerSweep("MC");
      // On /si the URL decides: /si?sym=X carries X back to Market Catalyst, and
      // plain /si (the SI home view) goes to the dashboard. Read at click time so
      // a stale siTicker can never send the SI home view to a stock page.
      const onSiPage =
        typeof window !== "undefined" && window.location.pathname.startsWith("/si");
      const urlSym = onSiPage
        ? new URLSearchParams(window.location.search).get("sym")
        : null;
      const targetSym = ticker || (onSiPage ? urlSym : siTicker);
      if (targetSym) {
        const clean = targetSym.toUpperCase().trim();
        if (typeof window !== "undefined") {
          // Same steps the global search takes in goToStock (shell.tsx).
          localStorage.setItem("iq-stock", clean);
          localStorage.setItem("iq-nav-collapsed", "0");
          window.dispatchEvent(
            new CustomEvent("iq-stock-change", { detail: clean })
          );
        }
        setTimeout(() => {
          setIsSI(false);
          // One navigation only: onOpenStockInMC (openStockFull) already pushes
          // /menu/stock, so pushing again here added a duplicate history entry.
          if (onOpenStockInMC) onOpenStockInMC(clean);
          else router.push("/menu/stock");
        }, 160);
      } else {
        setTimeout(() => {
          setIsSI(false);
          router.push("/dashboard");
        }, 160);
      }
    },
    [siTicker, router, onOpenStockInMC, triggerSweep]
  );

  const toggleSI = useCallback(() => {
    if (isSI) {
      exitToMC();
    } else {
      enterSI();
    }
  }, [isSI, exitToMC, enterSI]);

  return (
    <SIContext.Provider
      value={{
        isSI,
        siTicker,
        activeTab,
        setActiveTab,
        enterSI,
        exitToMC,
        goToSearch,
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
      goToSearch: () => {},
      toggleSI: () => {},
      sweep: null,
      setSiTicker: () => {},
    };
  }
  return ctx;
}
