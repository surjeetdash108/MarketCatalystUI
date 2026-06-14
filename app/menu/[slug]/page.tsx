import { notFound } from "next/navigation";
import { menuItems } from "../../dashboard/menu-items";
import { IQShell } from "../../iq/shell";
import { EarningsScreen } from "../../iq/screens/earnings";
import { MoversScreen } from "../../iq/screens/movers";
import { HeatmapScreen } from "../../iq/screens/heatmap";
import { AnalystScreen } from "../../iq/screens/analyst";
import { ScreenerScreen } from "../../iq/screens/screener";
import { PortfolioScreen } from "../../iq/screens/portfolio";
import { WatchlistScreen } from "../../iq/screens/watchlist";
import { StockScreen } from "../../iq/screens/stock";
import { ThirteenFScreen } from "../../iq/screens/thirteenf";
import { CommentaryScreen } from "../../iq/screens/commentary";
import { RecapScreen } from "../../iq/screens/recap";
import { MacroScreen } from "../../iq/screens/macro";

export function generateStaticParams() {
  return menuItems
    .filter(item => item.slug !== "dashboard")
    .map(item => ({ slug: item.slug }));
}

const SCREENS: Record<string, React.ReactNode> = {
  earnings:    <EarningsScreen />,
  movers:      <MoversScreen />,
  heatmap:     <HeatmapScreen />,
  analyst:     <AnalystScreen />,
  screener:    <ScreenerScreen />,
  portfolio:   <PortfolioScreen />,
  watchlist:   <WatchlistScreen />,
  stock:       <StockScreen />,
  thirteenf:   <ThirteenFScreen />,
  commentary:  <CommentaryScreen />,
  recap:       <RecapScreen />,
  macro:       <MacroScreen />,
};

export default async function MenuPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const screen = SCREENS[slug];
  if (!screen) notFound();

  return <IQShell>{screen}</IQShell>;
}
