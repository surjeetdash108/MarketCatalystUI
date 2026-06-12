export const menuItems = [
  {
    label: "Dashboard",
    slug: "dashboard",
    description: "Your market intelligence command center with live stories, portfolio pulse, macro data, and AI summaries.",
  },
  {
    label: "What Matters Now",
    slug: "what-matters-now",
    description: "Top market stories, why they matter, affected peers, and fast summaries for the trading day.",
  },
  {
    label: "Earnings Hub",
    slug: "earnings-hub",
    description: "Upcoming earnings, reported results, estimate surprises, and guidance changes in one place.",
  },
  {
    label: "Market Movers",
    slug: "market-movers",
    description: "Track gainers, losers, unusual volume, and notable price action across your watch universe.",
  },
  {
    label: "Analyst Actions",
    slug: "analyst-actions",
    description: "Monitor upgrades, downgrades, price target changes, and analyst commentary that moves stocks.",
  },
  {
    label: "13F Intelligence",
    slug: "13f-intelligence",
    description: "Review institutional filings, fund moves, portfolio changes, and ownership trends.",
  },
  {
    label: "Portfolio Pulse",
    slug: "portfolio-pulse",
    description: "Understand your portfolio value, alerts, risk events, holdings, and upcoming earnings exposure.",
  },
  {
    label: "AI Copilot",
    slug: "ai-copilot",
    description: "Ask questions about markets, earnings, portfolio risk, filings, and daily recap signals.",
  },
  {
    label: "Alerts",
    slug: "alerts",
    description: "Configure and review price, earnings, analyst, macro, and unusual activity alerts.",
  },
  {
    label: "Watchlists",
    slug: "watchlists",
    description: "Organize tracked stocks, ETFs, funds, and asset groups for faster market scanning.",
  },
  {
    label: "Macro Calendar",
    slug: "macro-calendar",
    description: "Follow economic releases, central bank events, yield moves, oil, gold, and dollar signals.",
  },
  {
    label: "Reports",
    slug: "reports",
    description: "Access generated market reports, portfolio notes, research exports, and saved intelligence briefs.",
  },
] as const;

export type MenuItem = (typeof menuItems)[number];

export function getMenuItemBySlug(slug: string) {
  return menuItems.find((item) => item.slug === slug);
}
