# InvestIQ Screen Data Sources

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
| Ticker strip prices | `app/iq/data.ts` — hardcoded `pulse[]` array | 🔴 Static |
| Theme preference | Component `useState` (not persisted) | 🔴 Static |

---

## Dashboard (`/dashboard`)

| Widget | Data | Status |
|---|---|---|
| Market Pulse strip (6 indices) | `data.pulse` — hardcoded | 🔴 Static |
| What Matters Now cards | `data.wmn` — hardcoded | 🔴 Static |
| AI Sentiment gauge | Hardcoded value `62` | 🔴 Static |
| VIX card | Hardcoded `14.18` | 🔴 Static |
| Today's Movers | `data.movers` — hardcoded | 🔴 Static |
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

---

## Market Movers (`/menu/movers`)

| Element | Data | Status |
|---|---|---|
| Mover rows (symbol, change %, volume, reason) | `data.movers` — hardcoded | 🔴 Static |
| Sector / direction filters | Derived from `data.movers` | 🔴 Static |

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

---

## Screener (`/menu/screener`)

| Element | Data | Status |
|---|---|---|
| Stock universe | `data.screenerStocks` — hardcoded | 🔴 Static |
| Filter presets | `data.screenerPresets` — hardcoded | 🔴 Static |
| Filter state (moat, EPS growth, P/E, yield) | Component `useState` | 🔴 Static |
| Sort order | Component `useState` | 🔴 Static |

---

## Portfolio Pulse (`/menu/portfolio`)

| Element | Data | Status |
|---|---|---|
| Holdings (symbol, qty, avg cost, current price) | `data.folio` — hardcoded | 🔴 Static |
| Total value, gain/loss calculations | Computed from `data.folio` | 🔴 Static |
| Sector allocation bar | Computed from `data.folio` | 🔴 Static |
| Day change estimate | Hardcoded multiplier (0.73%) | 🔴 Static |

---

## Watchlist (`/menu/watchlist`)

| Element | Data | Status |
|---|---|---|
| Watchlist rows (symbol, price, change, target, note) | `data.watch` — hardcoded | 🔴 Static |
| Upside % | Computed from `data.watch` (tgt vs px) | 🔴 Static |

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
| Sparkline trend | Deterministic SVG from symbol charCode seed | 🔴 Static |

---

## 13F Intelligence (`/menu/thirteenf`)

| Element | Data | Status |
|---|---|---|
| Fund cards (name, ticker, AUM, top holdings) | `data.funds` — hardcoded | 🔴 Static |
| Notable Q1 moves table | Hardcoded inline in component | 🔴 Static |
| AI insight blurb | Hardcoded string | 🔴 Static |

---

## Commentary (`/menu/commentary`)

| Element | Data | Status |
|---|---|---|
| Commentary cards (author, date, title, blurb, tag) | `data.commentary` — hardcoded | 🔴 Static |
| Tag filter | Derived from `data.commentary` | 🔴 Static |

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
| Calendar events (date, name, sub-text, type) | `data.macro` — hardcoded | 🔴 Static |
| Event type filter | Derived from `data.macro` | 🔴 Static |

---

## Summary

| Category | Count |
|---|---|
| Fully dynamic (Firebase / Redux) | 4 elements (auth, user name, profile image, tier) |
| Fully static mock data | All market data, prices, news, research |

---

## What needs to be wired to live data

To make screens fully dynamic, these integrations are needed:

| Screen | What to replace | Suggested source |
|---|---|---|
| All screens — Ticker | `data.pulse` | Yahoo Finance API / Polygon.io / Alpha Vantage |
| Dashboard — Market Pulse | `data.pulse` | Same as above |
| Dashboard — WMN | `data.wmn` | OpenAI / news API + GPT summarisation |
| Earnings Hub | `data.earnings` | Polygon.io Earnings Calendar |
| Market Movers | `data.movers` | Polygon.io Gainers/Losers endpoint |
| Heatmap | `data.sectorList` / `SEC[]` | Polygon.io sector aggregates |
| Analyst Actions | `data.analyst` | Benzinga / Refinitiv analyst ratings API |
| Screener | `data.screenerStocks` | Polygon.io Screener or Financials endpoint |
| Portfolio Pulse | `data.folio` | Firestore (user's own portfolio collection) |
| Watchlist | `data.watch` | Firestore (user's watchlist) + live prices |
| Stock Detail | `data.stockInfo` | Polygon.io + OpenAI for AI thesis |
| 13F Intelligence | `data.funds` | SEC EDGAR XBRL 13F endpoint |
| Commentary | `data.commentary` | CMS (Contentful / Sanity) or Firestore |
| Recaps | `data.recap` | Firestore (stored weekly by a Cloud Function) |
| Macro Calendar | `data.macro` | Trading Economics / FRED API |
