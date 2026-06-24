# StockWise Screen Data Sources

> **Legend**
> - ✅ **Dynamic** — data comes from a live source (Firebase Auth, Firestore, real API)
> - 🟡 **Hybrid** — some fields are dynamic (user identity, profile) the rest is static mock data
> - 🔴 **Static** — all data is hardcoded mock data in `app/iq/data.ts`

---

## Shell / Layout (all screens)

| Element | Source | Status |
|---|---|---|
| User display name | Firestore profile → Redux `state.profile.data.name` | ✅ Dynamic |
| User profile image | Firestore `profile_image` or Firebase Auth `photoURL` → Redux | ✅ Dynamic |
| User tier (Free / Premium) | Firestore `profile.tier` → Redux | ✅ Dynamic |
| Auth session / redirect | Firebase Auth `onAuthStateChanged` → Redux | ✅ Dynamic |
| Theme preference | `IQShell` useState + Firestore `settings/{uid}` (darkMode) + localStorage cache | ✅ Dynamic |
| Ticker strip prices | `app/iq/data.ts` — hardcoded `pulse[]` array | 🔴 Static |
| Cmd+K starred stocks | `IQShell` useState `starred: Set<string>` — in-memory per session | 🔴 Static (session-only) |

---

## Dashboard (`/dashboard`)

| Widget | Data | Status |
|---|---|---|
| Market Pulse strip (6 indices) | `data.pulse` — hardcoded | 🔴 Static |
| What Matters Now cards | `data.wmn` — hardcoded | 🔴 Static |
| AI Sentiment gauge | Hardcoded value `62` | 🔴 Static |
| VIX card | Hardcoded `14.18` | 🔴 Static |
| Market Movers Widget — Winners tab | `data.movers` filtered/sorted — hardcoded | 🔴 Static |
| Market Movers Widget — Losers tab | `data.movers` filtered/sorted — hardcoded | 🔴 Static |
| Market Movers Widget — sector filter | `mvSectors` computed from `data.movers` | 🔴 Static |
| Market Movers Widget — hover popup (Technical/News) | Derived from `data.movers` + `data.analyst` — hardcoded | 🔴 Static |
| Trending Stocks Widget | `computeTrending()` cross-reference: `data.movers` + `data.analyst` + `data.earnings` | 🔴 Static |
| Upcoming Earnings list | `data.earnings` — hardcoded | 🔴 Static |
| Portfolio Snapshot (total value, positions) | `data.folio` — hardcoded | 🔴 Static |
| Analyst Actions mini-list | `data.analyst` — hardcoded | 🔴 Static |

---

## Earnings Hub (`/menu/earnings`)

| Element | Data | Status |
|---|---|---|
| Earnings table rows | `data.earnings` — hardcoded | 🔴 Static |
| Filter chips (All / Beat / Miss / Raised / Lowered / Owned) | Computed from `data.earnings.tags` | 🔴 Static |
| EPS estimate, EPS actual, guidance, reaction | `data.earnings` — hardcoded | 🔴 Static |
| Inline detail panel (logo, EPS metrics, AI read) | Derived from `selEarning` selection + `aiRead` string | 🔴 Static |
| 10-quarter EPS history chart | `data.earnings` EPS history arrays | 🔴 Static |

---

## Market Movers (`/menu/movers`)

| Element | Data | Status |
|---|---|---|
| Mover rows (symbol, change %, volume, reason) | `data.movers` — hardcoded | 🔴 Static |
| Sector / direction filters | Derived from `data.movers` | 🔴 Static |
| Sliding drawer — StockScreen content | Same sources as Stock Detail page (`data.stockInfo`, deterministic charts) | 🔴 Static |

---

## Market Heatmap (`/menu/heatmap`)

| Element | Data | Status |
|---|---|---|
| Sector cells (name, % change, color) | `data.sectorList` computed from hardcoded `SEC[]` | 🔴 Static |
| Stock cells (symbol, % change, size by market cap) | `data.sectorList.items` — hardcoded | 🔴 Static |
| Sector summary table | Same `data.sectorList` | 🔴 Static |

---

## Analyst Actions (`/menu/analyst`)

| Element | Data | Status |
|---|---|---|
| Analyst action rows | `data.analyst` — hardcoded | 🔴 Static |
| Type filter (upgrade / downgrade / target raise) | Derived from `data.analyst` | 🔴 Static |
| Analyst flags (stocks with 5+ actions) | `computeFlags()` — computed from `data.analyst` | 🔴 Static |
| Top Upgrades sidebar | Sorted `data.analyst` by n30/react | 🔴 Static |

---

## Screener (`/menu/screener`)

| Element | Data | Status |
|---|---|---|
| Stock universe | `data.screenerStocks` — hardcoded | 🔴 Static |
| Filter presets | `data.screenerPresets` — hardcoded | 🔴 Static |
| Filter state (moat, EPS growth, P/E, yield) | Component `useState` | 🔴 Static |
| Sort order | Component `useState` | 🔴 Static |

---

## IPOs (`/menu/ipos`)

| Element | Data | Status |
|---|---|---|
| Recent IPO performance table (8 rows) | Hardcoded inline in `screens/ipos.tsx` | 🔴 Static |
| Upcoming pipeline table (4 rows) | Hardcoded inline in `screens/ipos.tsx` | 🔴 Static |
| Stats strip (above-offer count, best performer, median) | Hardcoded inline in `screens/ipos.tsx` | 🔴 Static |

---

## Portfolio Pulse (`/menu/portfolio`)

| Element | Data | Status |
|---|---|---|
| Holdings list (symbol, price, day, G/L, size, conviction) | `useState<FolioItem[]>` seeded from `data.folio` — in-memory session state | 🟡 Hybrid |
| Add Holding | Component `useState` (`newSym`, `newSize`, `newConv`) | 🔴 Static (session-only) |
| Sell / Remove holding | `partialSell()` / `removeHolding()` on `useState` holdings | 🔴 Static (session-only) |
| AI Summary — Drivers / Laggards / Leaders | Computed dynamically from `holdings` useState (sort by G/L and day change) | 🟡 Hybrid |
| Active alerts sidebar | Hardcoded `ALERTS` constant | 🔴 Static |
| Right panel — StockScreen for selected holding | Same sources as Stock Detail page (`data.stockInfo`, deterministic charts, Firebase notes) | 🟡 Hybrid |

---

## Watchlist (`/menu/watchlist`)

| Element | Data | Status |
|---|---|---|
| Watchlist rows (symbol, price, change, target, note) | `data.watch` — hardcoded | 🔴 Static |
| Watchlist list (persisted) | `localStorage("iq-watchlist")` — JSON string array | 🟡 Hybrid (persists across sessions) |
| Upside % | Computed from `data.watch` (tgt vs px) | 🔴 Static |
| Alerts column (price move pill, analyst upgrade pill) | `alerts(sym)` computed from `data.movers` + `data.analyst` | 🔴 Static |
| AI toggle (per-stock on/off) | `aiOn: Record<string, boolean>` useState — in-memory session | 🔴 Static (session-only) |
| Sliding drawer — StockScreen content | Same sources as Stock Detail page (`data.stockInfo`, deterministic charts) | 🔴 Static |

---

## Stock Detail (`/menu/stock`)

| Element | Data | Status |
|---|---|---|
| NVDA / TSLA / MSFT detail (full) | `data.stockInfo` — hardcoded | 🔴 Static |
| Other symbols (AMD, PLTR, etc.) | Procedurally generated fallback values | 🔴 Static |
| AI thesis, risk, confidence score | `data.stockInfo` — hardcoded | 🔴 Static |
| Recent news | `data.stockInfo[sym].news` — hardcoded | 🔴 Static |
| Insider activity | `data.stockInfo[sym].ins` — hardcoded | 🔴 Static |
| "Owned" badge | Checks against `data.folio` — hardcoded | 🔴 Static |
| CandleChart SVG | Deterministic OHLC from symbol + timeframe seed (seeded RNG) | 🔴 Static |
| Chart right-click notes — save | Firebase Firestore `stock_comments` collection (`addDoc`) | ✅ Dynamic |
| Chart right-click notes — load | Firebase Firestore `stock_comments` collection (`getDocs`, `query`, `where`, `orderBy`) | ✅ Dynamic |
| Chart right-click notes — delete | Firebase Firestore `stock_comments` collection (`deleteDoc`) | ✅ Dynamic |

---

## Insider & Institutional (`/menu/insider`)

| Element | Data | Status |
|---|---|---|
| Fund cards (name, ticker, AUM, top holdings) | `data.funds` — hardcoded | 🔴 Static |
| Notable Q1 moves table | Hardcoded inline in component | 🔴 Static |
| AI insight blurb | Hardcoded string | 🔴 Static |
| Insider Form 4 feed table | Hardcoded inline in `screens/insider.tsx` | 🔴 Static |

---

## Commentary (`/menu/commentary`)

| Element | Data | Status |
|---|---|---|
| Commentary cards (author, date, title, blurb, tag) | `data.commentary` — hardcoded | 🔴 Static |
| Tag filter | Derived from `data.commentary` | 🔴 Static |
| Ticker search bar suggestions | `SEARCH_SYMS` constant (20 tickers) — hardcoded in screen | 🔴 Static |
| NewsDrawer history items | `buildNewsHistory(sym)` — derived from `data.movers`, `data.analyst`, `sectorByName`, `data.watch`, `earnHistory()` from utils | 🔴 Static |
| Quick news lookup chips | 8 hardcoded ticker chips in sidebar | 🔴 Static |

---

## Recaps (`/menu/recap`)

| Element | Data | Status |
|---|---|---|
| Hero recap (date, market summary) | `data.recap` — hardcoded | 🔴 Static |
| Daily recap items | `data.recap.items` — hardcoded | 🔴 Static |
| Previous weeks list | Hardcoded inline in component | 🔴 Static |
| PDF download | Generated client-side from `data.recap` text | 🔴 Static |

---

## Macro & VIX (`/menu/macro`)

| Element | Data | Status |
|---|---|---|
| VIX, 10Y yield, 2Y yield, Fed Funds Rate | Hardcoded inline in component | 🔴 Static |
| Last Week calendar (CAL_LAST) | Hardcoded `MacroEvent[]` array in `screens/macro.tsx` | 🔴 Static |
| This Week calendar (CAL_THIS) | Hardcoded `MacroEvent[]` array in `screens/macro.tsx` | 🔴 Static |
| Next Week calendar (CAL_NEXT) | Hardcoded `MacroEvent[]` array in `screens/macro.tsx` | 🔴 Static |
| Event type filter + week tab selector | Component `useState` | 🔴 Static |

---

## Summary

| Category | Count |
|---|---|
| Fully dynamic (Firebase Auth / Redux) | 4 shell elements (auth, user name, profile image, tier) |
| Fully dynamic (Firestore reads/writes) | 3 stock note operations (save, load, delete) |
| Hybrid (localStorage — session-persistent) | Watchlist list (`localStorage("iq-watchlist")`) |
| Hybrid (state seeded from mock, computed dynamically) | Portfolio holdings state + AI summary; right-panel StockScreen |
| Fully static mock data | All market data, prices, news, research; sliding drawer StockScreen content; NewsDrawer history |

---

## What needs to be wired to live data

To make screens fully dynamic, these integrations are needed:

| Screen | What to replace | Suggested source |
|---|---|---|
| All screens — Ticker strip | `data.pulse` | Polygon.io WebSocket / Finnhub |
| Dashboard — Market Pulse | `data.pulse` | Same as above |
| Dashboard — WMN | `data.wmn` | Claude API + news API |
| Dashboard — Market Movers Widget | `data.movers` | Polygon.io Gainers/Losers endpoint |
| Dashboard — Trending Stocks | `computeTrending()` inline | Server-side calculation + Firestore `market_movers` |
| Earnings Hub | `data.earnings` | FMP Earnings Calendar API |
| Market Movers | `data.movers` | Polygon.io Gainers/Losers endpoint |
| Heatmap | `data.sectorList` / `SEC[]` | Polygon.io sector aggregates |
| Analyst Actions | `data.analyst` | Benzinga analyst ratings API |
| Screener | `data.screenerStocks` | Polygon.io Screener or FMP Screener |
| Portfolio Pulse | `data.folio` + holdings state | Firestore `users/{uid}/portfolios` + live prices |
| Watchlist | `data.watch` | Firestore `users/{uid}/watchlists` + live prices |
| Stock Detail | `data.stockInfo` | Polygon.io REST + Claude API for AI thesis |
| Stock Notes | Already live (Firestore `stock_comments`) | ✅ Already dynamic |
| Insider & Institutional | `data.funds` + inline insider data | SEC EDGAR 13F + EDGAR Form 4 |
| Commentary | `data.commentary` | Firestore `news` collection with categories |
| Recaps | `data.recap` | Firestore `recaps` collection (written by BullMQ cron) |
| Macro Calendar | `CAL_*` arrays in macro.tsx | Finnhub Economic Calendar API → Firestore `macro_events` |
