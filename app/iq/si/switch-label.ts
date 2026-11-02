import type { AppModule } from "./si-context";

/**
 * The module name shown in the switch transition. Every module uses Market
 * Catalyst's style: title case, Manrope 800, the second word in the module's
 * accent colour.
 */
export interface SwitchLabel {
  words: [string, string];
  /** Colour of the first word / the second word. */
  colors: [string, string];
  font: string;
  size: number;
  weight: number;
  letterSpacing: string;
}

/** Vertical position of the label: the exact middle of the screen. */
export const LABEL_TOP = "50%";

const WORDS: Record<AppModule, [string, string]> = {
  MC: ["Market", "Catalyst"],
  SI: ["Stock", "Intelligence"],
  SL: ["Strategy", "Lab"],
  MF: ["Money", "Flow"],
};
const ACCENT: Record<AppModule, string> = { MC: "#4ade80", SI: "#7fa8d0", SL: "#e0bb5e", MF: "#e0bb5e" };

export function switchLabel(to: AppModule): SwitchLabel {
  return {
    words: WORDS[to],
    colors: ["rgba(255,255,255,0.96)", ACCENT[to]],
    font: "'Manrope', sans-serif",
    size: 38,
    weight: 800,
    letterSpacing: "-0.02em",
  };
}
