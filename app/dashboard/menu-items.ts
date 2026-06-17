export const menuItems = [
  // ---- Intelligence group ----
  { label: 'Dashboard', slug: 'dashboard', group: 'Intelligence', icon: '⬛', badge: null },
  { label: 'Earnings Hub', slug: 'earnings', group: 'Intelligence', icon: '📋', badge: 'AI' },
  { label: 'Market Movers', slug: 'movers', group: 'Intelligence', icon: '📈', badge: null },
  { label: 'Market Heatmap', slug: 'heatmap', group: 'Intelligence', icon: '🟩', badge: null },
  { label: 'Analyst Actions', slug: 'analyst', group: 'Intelligence', icon: '🔔', badge: null },
  { label: 'Stock Screener', slug: 'screener', group: 'Intelligence', icon: '🔍', badge: 'NEW' },
  // ---- My Money group ----
  { label: 'Portfolio Pulse', slug: 'portfolio', group: 'My Money', icon: '💼', badge: null },
  { label: 'Watchlist', slug: 'watchlist', group: 'My Money', icon: '⭐', badge: null },
  { label: 'Stock Detail', slug: 'stock', group: 'My Money', icon: '📊', badge: null },
  { label: '13F Intelligence', slug: 'thirteenf', group: 'My Money', icon: '📄', badge: null },
  // ---- Context group ----
  { label: 'Commentary', slug: 'commentary', group: 'Context', icon: '💬', badge: null },
  { label: 'Recaps', slug: 'recap', group: 'Context', icon: '🔖', badge: null },
  { label: 'Macro & VIX', slug: 'macro', group: 'Context', icon: '📅', badge: null },
] as const;

export type MenuItem = (typeof menuItems)[number];

export function getMenuItemBySlug(slug: string) {
  return menuItems.find((item) => item.slug === slug);
}
