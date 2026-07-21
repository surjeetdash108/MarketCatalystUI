// `flag` is the FF_* gate for that screen (delivery-plan "Release gate" column).
// null = always visible (no independent release gate). Screens whose flag is
// OFF are hidden from the nav and show a "coming soon" placeholder if reached
// by URL — see feature-flags.tsx and menu/[slug]/page.tsx.
export const menuItems = [
  // ---- Intelligence group ----
  { label: 'Dashboard', slug: 'dashboard', group: 'Intelligence', icon: '⬛', badge: null, flag: 'FF_DASHBOARD' },
  { label: 'Earnings Hub', slug: 'earnings', group: 'Intelligence', icon: '📋', badge: null, flag: null },
  { label: 'Movers', slug: 'movers', group: 'Intelligence', icon: '📈', badge: null, flag: 'FF_MOVERS' },
  { label: 'Market Heatmap', slug: 'heatmap', group: 'Intelligence', icon: '🟩', badge: null, flag: 'FF_HEATMAP' },
  { label: 'Analyst Actions', slug: 'analyst', group: 'Intelligence', icon: '🔔', badge: null, flag: null },
  { label: 'Screener', slug: 'screener', group: 'Intelligence', icon: '🔍', badge: null, flag: 'FF_SCREENER' },
  { label: 'Themes', slug: 'themes', group: 'Intelligence', icon: '◈', badge: null, flag: 'FF_THEMES' },
  { label: 'IPO Corner', slug: 'ipos', group: 'Intelligence', icon: '🚀', badge: null, flag: 'FF_IPOS' },
  { label: 'Search', slug: 'stock', group: 'Intelligence', icon: '📊', badge: null, flag: 'FF_STOCKDETAIL' },
  { label: 'Options', slug: 'options', group: 'Intelligence', icon: '◈', badge: null, flag: null },
  { label: 'Insider & Institutional', slug: 'insider', group: 'Intelligence', icon: '📄', badge: null, flag: null },
  // ---- Context group ----
  { label: 'Commentary', slug: 'commentary', group: 'Context', icon: '💬', badge: null, flag: 'FF_NEWS' },
  { label: 'Recaps', slug: 'recap', group: 'Context', icon: '🔖', badge: null, flag: null },
  { label: 'Macro & VIX', slug: 'macro', group: 'Context', icon: '📅', badge: null, flag: 'FF_MACRO' },
  // ---- My Money group ----
  { label: 'Portfolio Pulse', slug: 'portfolio', group: 'My Money', icon: '💼', badge: null, flag: 'FF_PORTFOLIO' },
  { label: 'Watchlist', slug: 'watchlist', group: 'My Money', icon: '⭐', badge: null, flag: 'FF_WATCHLIST' },
] as const;

export type MenuItem = (typeof menuItems)[number];

export function getMenuItemBySlug(slug: string) {
  return menuItems.find((item) => item.slug === slug);
}
