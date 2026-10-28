"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
  useSyncExternalStore,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { SITab } from "./types";

// ── MC ⇄ SI switch ────────────────────────────────────────────────────────────
// MC (/menu/*, /dashboard) and SI (/si) each mount their own IQShell, so the
// whole tree — this provider and the sweep overlay included — remounts on every
// switch. The in-flight switch therefore lives at MODULE level: it survives the
// remount, the new overlay resumes the animation where the old one left off,
// and a stale per-instance flag can never leave the switcher "stuck".

/** Total length of the switch transition. */
export const SWITCH_MS = 1500;
/** Navigate once the veil is fully opaque, so the remount happens behind it. */
const NAV_AT_MS = 400;

/** The modules the global toggle switches between. */
export type AppModule = "MC" | "SI" | "SL" | "MF";

export interface ActiveSwitch {
  to: AppModule;
  key: number;
  startedAt: number;
}

let activeSwitch: ActiveSwitch | null = null;
const switchListeners = new Set<() => void>();

function setActiveSwitch(v: ActiveSwitch | null) {
  activeSwitch = v;
  switchListeners.forEach((l) => l());
}

function subscribeSwitch(l: () => void) {
  switchListeners.add(l);
  return () => {
    switchListeners.delete(l);
  };
}

/** The switch transition currently running, or null. Shared across remounts. */
export function useActiveSwitch(): ActiveSwitch | null {
  return useSyncExternalStore(subscribeSwitch, () => activeSwitch, () => null);
}

const isSiPath = (p: string | null | undefined) => !!p && (p === "/si" || p.startsWith("/si/"));
/** Strategy Lab lives at /sl (a full-screen module like SI). */
export const isSlPath = (p: string | null | undefined) => !!p && (p === "/sl" || p.startsWith("/sl/"));
/** Money Flow lives at /money-flow (a full-screen module like SI). */
export const isMfPath = (p: string | null | undefined) => !!p && (p === "/money-flow" || p.startsWith("/money-flow/"));

/**
 * Runs one switch: overlay → navigate behind it → overlay fades out. Ignores
 * clicks while a switch is already running. If the client-side navigation has
 * not landed by the end of the transition, falls back to a full page load so a
 * click always ends up on the other side.
 */
function runSwitch(to: AppModule, target: string, push: (url: string) => void) {
  if (activeSwitch) return;
  const key = Date.now();
  setActiveSwitch({ to, key, startedAt: key });
  const targetPath = target.split("?")[0];

  setTimeout(() => push(target), NAV_AT_MS);
  setTimeout(() => {
    if (activeSwitch?.key === key) setActiveSwitch(null);
    if (typeof window !== "undefined" && window.location.pathname !== targetPath) {
      window.location.assign(target);
    }
  }, SWITCH_MS);
}

interface SIContextType {
  isSI: boolean;
  /** Which module is on screen (or being switched to). */
  activeModule: AppModule;
  enterSL: () => void;
  enterMF: () => void;
  siTicker: string | null;
  activeTab: SITab;
  setActiveTab: (tab: SITab) => void;
  enterSI: (ticker?: string, tab?: SITab) => void;
  exitToMC: (ticker?: string) => void;
  goToSearch: () => void;
  toggleSI: () => void;
  setSiTicker: (ticker: string | null) => void;
}

const SIContext = createContext<SIContextType | null>(null);

export function SIProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const sw = useActiveSwitch();

  // The URL is the source of truth; while a switch runs, show where it's going
  // so the pill slides immediately on click.
  const isSI = sw ? sw.to === "SI" : isSiPath(pathname);
  const activeModule: AppModule = sw ? sw.to : isSiPath(pathname) ? "SI" : isSlPath(pathname) ? "SL" : isMfPath(pathname) ? "MF" : "MC";

  const [siTicker, setSiTicker] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const sym = new URLSearchParams(window.location.search).get("sym");
      if (sym) return sym.toUpperCase().trim();
    }
    return null;
  });
  const [activeTab, setActiveTab] = useState<SITab>("overview");

  // Sync the ticker if the URL query param or path changes
  useEffect(() => {
    if (isSiPath(pathname)) {
      if (typeof window !== "undefined") {
        const sym = new URLSearchParams(window.location.search).get("sym");
        setSiTicker(sym ? sym.toUpperCase().trim() : null);
      }
    } else if (pathname && !pathname.startsWith("/menu/stock")) {
      setSiTicker(null);
    }
  }, [pathname]);

  // Also listen for popstate (browser back/forward button)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handlePopState = () => {
      if (isSiPath(window.location.pathname)) {
        const sym = new URLSearchParams(window.location.search).get("sym");
        setSiTicker(sym ? sym.toUpperCase().trim() : null);
      } else if (!window.location.pathname.startsWith("/menu/stock")) {
        setSiTicker(null);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const goToSearch = useCallback(() => {
    setSiTicker(null);
    router.push("/si");
  }, [router]);

  const enterSI = useCallback(
    (ticker?: string, tab?: SITab) => {
      if (typeof window === "undefined") return;
      // Read the URL at click time — never a cached flag.
      if (isSiPath(window.location.pathname)) return;
      const onStockPage = window.location.pathname.startsWith("/menu/stock");
      const stored = localStorage.getItem("iq-stock");

      let targetSym: string | null = null;
      if (ticker) {
        targetSym = ticker.toUpperCase().trim();
      } else if (onStockPage) {
        // The stock page shows localStorage "iq-stock", or NVDA when nothing is
        // stored (see StockScreen), so carry over exactly what is on screen.
        targetSym = (stored || "NVDA").toUpperCase().trim();
      }

      if (targetSym) localStorage.setItem("iq-stock", targetSym);
      setSiTicker(targetSym);
      if (tab) setActiveTab(tab);
      runSwitch("SI", targetSym ? `/si?sym=${encodeURIComponent(targetSym)}` : "/si", router.push);
    },
    [router]
  );

  const exitToMC = useCallback(
    (ticker?: string) => {
      if (typeof window === "undefined") return;
      const onSiPage = isSiPath(window.location.pathname);
      // Strategy Lab and Money Flow have no ticker in view — they return to the dashboard.
      if ((isSlPath(window.location.pathname) || isMfPath(window.location.pathname)) && !ticker) {
        runSwitch("MC", "/dashboard", router.push);
        return;
      }
      if (!onSiPage && !ticker) return;
      // On /si the URL decides: /si?sym=X carries X back to Market Catalyst, and
      // plain /si (the SI home view) goes to the dashboard.
      const urlSym = onSiPage ? new URLSearchParams(window.location.search).get("sym") : null;
      const targetSym = ticker || urlSym;
      if (targetSym) {
        const clean = targetSym.toUpperCase().trim();
        // Same steps the global search takes in goToStock (shell.tsx).
        localStorage.setItem("iq-stock", clean);
        localStorage.setItem("iq-nav-collapsed", "0");
        window.dispatchEvent(new CustomEvent("iq-stock-change", { detail: clean }));
        runSwitch("MC", "/menu/stock", router.push);
      } else {
        runSwitch("MC", "/dashboard", router.push);
      }
    },
    [router]
  );

  const enterSL = useCallback(() => {
    if (typeof window === "undefined" || isSlPath(window.location.pathname)) return;
    runSwitch("SL", "/sl", router.push);
  }, [router]);

  const enterMF = useCallback(() => {
    if (typeof window === "undefined" || isMfPath(window.location.pathname)) return;
    runSwitch("MF", "/money-flow", router.push);
  }, [router]);

  const toggleSI = useCallback(() => {
    if (typeof window !== "undefined" && isSiPath(window.location.pathname)) exitToMC();
    else enterSI();
  }, [exitToMC, enterSI]);

  return (
    <SIContext.Provider
      value={{
        isSI,
        activeModule,
        enterSL,
        enterMF,
        siTicker,
        activeTab,
        setActiveTab,
        enterSI,
        exitToMC,
        goToSearch,
        toggleSI,
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
      activeModule: "MC" as AppModule,
      enterSL: () => { },
      enterMF: () => { },
      siTicker: null,
      activeTab: "overview" as SITab,
      setActiveTab: () => { },
      enterSI: () => { },
      exitToMC: () => { },
      goToSearch: () => { },
      toggleSI: () => { },
      setSiTicker: () => { },
    };
  }
  return ctx;
}
