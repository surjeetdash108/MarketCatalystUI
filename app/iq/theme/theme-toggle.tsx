"use client";

import { useIQActions } from "../shell";
import { MODULE_THEME_CSS } from "./module-theme";

/**
 * Dark / light switch for the full-screen modules (Strategy Lab, Money Flow).
 * It flips the same app-wide theme as Market Catalyst and Stock Intelligence
 * (the shell persists it), and carries the modules' colour variables.
 */
export function ModuleThemeToggle() {
  const { theme, setTheme } = useIQActions();
  const isLight = theme === "light";
  return (
    <>
      <style>{MODULE_THEME_CSS}</style>
      <button
        type="button"
        className="mod-theme-toggle"
        onClick={() => setTheme(isLight ? "dark" : "light")}
        title={isLight ? "Switch to dark mode" : "Switch to light mode"}
        aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
        style={{
          flex: "none", width: 34, height: 34, padding: 0, borderRadius: 8, cursor: "pointer",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          border: "1px solid var(--th-263033)", background: "transparent", color: "var(--th-cfd6d3)",
        }}
      >
        {isLight ? (
          <svg style={{ fill: "none", stroke: "currentColor" }} viewBox="0 0 24 24" width={16} height={16} strokeWidth="2" strokeLinecap="round">
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
          </svg>
        ) : (
          <svg style={{ fill: "none", stroke: "currentColor" }} viewBox="0 0 24 24" width={16} height={16} strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </svg>
        )}
      </button>
    </>
  );
}
