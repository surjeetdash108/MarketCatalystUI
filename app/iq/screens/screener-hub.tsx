"use client";

import { useState } from "react";
import { AlphaSignals } from "./alpha-signals";
import { ThemesScreen } from "./themes";
import { ScreenerScreen } from "./screener";

export type ScreenerTab = "alpha" | "themes" | "custom";

const TABS: Array<[ScreenerTab, string]> = [
  ["alpha", "Alpha Signals"],
  ["themes", "Themes"],
  ["custom", "Custom Screener"],
];

/** Screener page: three sub-tabs sharing one header. Only the active tab is mounted. */
export function ScreenerHub({ initial = "alpha" }: { initial?: ScreenerTab }) {
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
      {tab === "alpha" && <AlphaSignals />}
      {tab === "themes" && <ThemesScreen />}
      {tab === "custom" && <ScreenerScreen />}
    </div>
  );
}
