"use client";

import { useState } from "react";
import { ThemesScreen } from "./themes";
import { ScreenerScreen } from "./screener";

export type ScreenerTab = "themes" | "custom";

const TABS: Array<[ScreenerTab, string]> = [
  ["themes", "Themes"],
  ["custom", "Custom Screener"],
];

/**
 * Screener page: two sub-tabs sharing one header. Only the active tab is
 * mounted. Alpha Signals moved out of here into its own module (/alpha-signals).
 */
export function ScreenerHub({ initial = "themes" }: { initial?: ScreenerTab }) {
  const [tab, setTab] = useState<ScreenerTab>(initial);
  return (
    <div>
      <div className="scr-tabs" role="tablist" aria-label="Screener sections">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>
      {tab === "themes" && <ThemesScreen />}
      {tab === "custom" && <ScreenerScreen />}
    </div>
  );
}
