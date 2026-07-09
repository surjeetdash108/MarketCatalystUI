# StockWise Screen Data Sources

_Last verified: 2026-07-09, against the actual code in `app/iq/screens/*.tsx` and `backend/src/sync/*.job.ts`. See `Doc/openapi.yaml` for the full data contract and `Doc/schema.sql` if this ever migrates off Firestore._

> **Legend**
> - ✅ **Live** — data comes from a real Firestore collection written by a backend sync job (or Firebase Auth/user-owned Firestore data)
> - 🟡 **Hybrid** — live data is merged additively on top of the original mock content (matching tickers get real values; the rest of the mock stays, so nothing was deleted to make room for live data)
> - 🔴 **Static** — all data is hardcoded mock data in `app/iq/data.ts` or inline in the screen file; either no backend job exists yet, or the field genuinely has no live source

**The merge-not-replace rule:** every "Hybrid" row below was deliberately built to overlay live data onto the *existing* mock UI, never to delete a feature, tab, or mock dataset to make room for it. Where a live collection can't cover every field a mock object has (e.g. RVOL, a "why it's moving" narrative), the mock value is kept for that specific field. See individual screen sections for exactly which fields are real vs. still illustrative.

---

## Full-market ticker data (`tickers/{ticker}`)

Real, complete data for essentially the **entire US market** (~10,000+ tickers), not just the curated 241-ticker `TICKER_UNIVERSE` `companies` covers. Two independently-synced parts:
- **Reference metadata** (name, exchange, type, active, cik) — weekly, `ticker-universe.job.ts`
- **Price/%change/volume** — daily, `market-quotes.job.ts`. Essentially free: reuses the same 2-call Polygon grouped-daily diff `market-movers.job.ts` already computes for the whole market and then discards outside its top/bottom 20 — see `backend/src/vendors/polygon/polygon-diff.util.ts`.

Still missing at this full-market scale: fundamentals (P/E, sector, dividend yield, peers, beta) — that needs one FMP call per ticker, which doesn't scale here without a verified quota increase, so it stays limited to the curated 241.

**Now wired to one consumer**: the shell's Cmd+K/top search bar (`app/iq/hooks/useTickerSearch.ts`) searches this full collection by ticker prefix — see the Shell/Layout section below. Screener's own ticker picker/filters still only cover the curated 241 — expanding Screener itself to the full universe is a separate, not-yet-done step.

---

## Shell / Layout (all screens)

| Element | Source | Status |
|---|---|---|
| User display name | Firestore profile → Redux `state.profile.data.name` | ✅ Live |
| User profile image | Firestore `profile_image` or Firebase Auth `photoURL` → Redux | ✅ Live |
| Auth session / redirect | Firebase Auth `onAuthStateChanged` → Redux | ✅ Live |
| Theme preference | `IQShell` useState + Firestore `settings/{uid}` (font/alert) + localStorage cache | ✅ Live |
| **Ticker strip prices** (top of every screen) | `app/iq/shell.tsx` now uses the same `mergePulse()` helper (extracted to `app/iq/live-market-indices.ts`) as Dashboard's own Market Pulse widget — both read `market_indices` and stay in sync; the index drawer it opens now receives the same merged array as a prop instead of re-reading the stale static one | 🟡 Hybrid |
| **Cmd+K / top search bar** (new) | Real ticker-prefix search over the full `tickers` collection (~10,000+ tickers, real price/%change), via `app/iq/hooks/useTickerSearch.ts` — a scoped on-demand Firestore query, not a full-collection subscription (see that file's docblock for why). The original curated 15-name `SEARCHABLE_STOCKS` list stays as the "quick access" suggestions shown before typing anything, and fills in any gaps if a typed prefix matches a curated name not yet returned by the live query | 🟡 Hybrid |
| Cmd+K starred stocks | `IQShell` useState `starred: Set<string>` — in-memory per session | 🔴 Static (session-only) |

---

## Dashboard (`/dashboard`) — `screens/dashboard.tsx`

All 14 original widgets are intact; live data is merged in via `useCollection()` calls at the top of `DashboardScreen()`.

| Widget | Data | Status |
|---|---|---|
| Market Pulse strip (6 of 9 indices shown) | `market_indices` merged onto `data.pulse` by label→symbol map (SPX/NDX/DJI/RUT/VIX/US10Y/WTI/GOLD/DXY, ETF-proxied — see `x-primary-source` on `/market-indices` in the OpenAPI spec) | 🟡 Hybrid |
| VIX card | Same `market_indices` merge (VIX proxy = VIXY) | 🟡 Hybrid |
| Market Movers widget (Gainers/Losers/Most Active tabs) | `market_movers` merged onto `data.movers` (price/%/name/sector/cap real; RVOL/catalyst/weekly-% still mock) | 🟡 Hybrid |
| Market Heatmap mini | `sectors` + `companies` merged onto `data.sectorList` (sector %, per-stock market cap/%change real) | 🟡 Hybrid |
| Earnings Today widget | `earnings_events` merged onto `data.earnings` by ticker (EPS estimate/actual real; session/guidance/reaction still mock) | 🟡 Hybrid |
| Insider & Institutional mini | `insider_transactions` (latest 5 real Form 4 filings) prepended to the mock insider mini-list | 🟡 Hybrid |
| Live Market Feed | Real `news` docs shown when any exist for the tracked universe; falls back to the original mock feed items when none have synced yet. Polygon-primary as of 2026-07-08 — docs now carry `sentiment`/`sentimentReasoning`/`keywords` when served from Polygon (null/empty on Finnhub fallback) | 🟡 Hybrid |
| What Matters Now (AI card) | `data.wmn` — hardcoded (needs Claude; see Recaps note below) | 🔴 Static |
| Fear & Greed gauge | Hardcoded `62` | 🔴 Static |
| Analyst Actions mini-list | `analyst_actions` consensus pill shown next to matching tickers; per-firm action rows stay `data.analyst` (no live per-firm event feed exists) | 🟡 Hybrid |
| Screener Leaders & Laggards mini | `data.screenerStocks` — hardcoded | 🔴 Static |
| Portfolio Pulse mini | Signed-in user's real `users/{uid}/portfolios/default/holdings` merged with `companies` for live price/%; falls back to `data.folio` if the user has no saved holdings | 🟡 Hybrid |
| Watchlist mini | Signed-in user's real `users/{uid}/watchlists/default` merged with `companies` for live price/%; falls back to `data.watch` if the user has no saved watchlist | 🟡 Hybrid |
| Recaps card (download buttons) | Client-side `Blob` generation, no real report content | 🔴 Static |

---

## Earnings Hub (`/menu/earnings`) — `screens/earnings.tsx`

| Element | Data | Status |
|---|---|---|
| EPS estimate / actual | `earnings_events` overlaid onto the matching `EARN_CAL` row by ticker, tagged with a "live EPS · FMP" pill when live | 🟡 Hybrid |
| Calendar structure (Today/Week/Month tabs, session BMO/AMC, date grid) | `EARN_CAL` — hardcoded; the calendar is built around a fixed illustrative "today", not a live date range | 🔴 Static |
| Guidance status, price reaction, implied move | Hardcoded — no live source has these fields (FMP's calendar has no guidance/reaction; needs Benzinga) | 🔴 Static |
| Earnings call summaries / transcripts | `CALLS_DATA` — hardcoded AI-style summaries | 🔴 Static |

---

## Market Movers (`/menu/movers`) — `screens/movers.tsx`

| Element | Data | Status |
|---|---|---|
| Mover rows (price, %change, name, sector, cap) | `market_movers` merged onto `data.movers`; live-only tickers not in the mock set are appended with neutral placeholders | 🟡 Hybrid |
| RVOL, catalyst label, weekly-% column, "Trending across reports" widget | `data.movers`/`data.analyst`/`data.earnings`/`data.watch`/`data.folio` — hardcoded (no vendor field for RVOL or a "why it moved" narrative) | 🔴 Static |
| Sliding drawer (embedded Stock Detail) | Same sources as Stock Detail below | 🟡 Hybrid |

---

## Market Heatmap (`/menu/heatmap`) — `screens/heatmap.tsx`

| Element | Data | Status |
|---|---|---|
| Sector cells (% change) | `sectors` merged onto `data.sectorList` by sector name | 🟡 Hybrid |
| Stock cells (market cap, % change) | `companies` merged onto each sector's `items[]` by ticker (marketCap converted from raw USD to $B) | 🟡 Hybrid |
| Hover tooltip (RVOL, RS, MA posture) | Still sourced from mock `movers`/`screenerStocks` — no live technical-analysis source exists | 🔴 Static |

---

## Analyst Actions (`/menu/analyst`) — `screens/analyst.tsx`

| Element | Data | Status |
|---|---|---|
| "Live analyst consensus" card (new) | `analyst_actions` — real FMP Buy/Hold/Sell vote-count snapshot, shown as its own card since it can't populate the event table below | ✅ Live |
| Per-firm action table (firm, rating change, PT, cluster alerts) | `data.analyst` — hardcoded. FMP's consensus snapshot has no firm name/action type/date, so this table can't be live yet without Benzinga (blocked, no key) or FMP `grades-historical` (unwired interim option) | 🔴 Static |
| Live-consensus badge on matching table rows | Cross-references `analyst_actions` by ticker | ✅ Live (badge only) |

---

## Screener (`/menu/screener`) — `screens/screener.tsx`

| Element | Data | Status |
|---|---|---|
| Market cap, P/E, Relative Strength | `companies` merged onto `data.screenerStocks` by ticker — `rsRating` (from the new `rs-rating.job.ts`) overrides `relativeStrength` when available, feeding the existing RS 90+/70-90/<40 filter buttons and the "RS {n}" sparkline label unchanged | 🟡 Hybrid |
| Sales/EPS growth %, gross margin, RVOL, Tech Rating | `data.screenerStocks` — hardcoded. Still proprietary computed scores no vendor sells directly and no computation exists for yet | 🔴 Static |
| Filter/preset logic | Unchanged, operates on the merged list above | ✅ Live inputs, static logic |

`rs-rating.job.ts` is an independent, from-scratch approximation of an IBD-style relative-strength score (most-recent-quarter-weighted trailing returns from real `ohlcv_bars`, ranked 1-99 within `TICKER_UNIVERSE`) — not the literal proprietary IBD formula, and it writes nothing meaningful until `stock-history.job.ts` has accumulated enough real bar history first.

---

## IPOs (`/menu/ipos`) — `screens/ipos.tsx`

| Element | Data | Status |
|---|---|---|
| "Live IPO Calendar" card (new) | New, additive `ipos` (Finnhub) card — real recent/upcoming IPOs (date, name, symbol, exchange, price, status), shown once the collection has synced data | 🟡 Hybrid |
| Stats strip, Recent IPO Performance table, Upcoming Pipeline table | Hardcoded (`RECENT_IPOS`, `PIPELINE`) — untouched. Finnhub's calendar has no current trading price or day-1 return, so it can't be merged into these return-calculation rows; a brand-new IPO ticker also generally isn't in `companies` yet either | 🔴 Static |

FMP's `ipos-calendar` is still confirmed restricted on the current plan, but Finnhub's IPO calendar turned out to be a genuinely separate endpoint from its blocked economic calendar (verified 2026-07-07 with a real call) — so this screen is no longer vendor-blocked at all.

---

## Themes (`/menu/themes`) — `screens/themes.tsx`

| Element | Data | Status |
|---|---|---|
| Theme membership (which 7-8 tickers per theme) | `THEMES` — hardcoded; this is curated editorial grouping, the same category as Screener's named presets, not vendor data | 🔴 Static |
| Per-stock price / % change | `companies` merged onto each theme's stock list by ticker, with a "live" count shown per theme | 🟡 Hybrid |

---

## Portfolio Pulse (`/menu/portfolio`) — `screens/portfolio.tsx`

| Element | Data | Status |
|---|---|---|
| Demo holdings + shares (when signed out, or before any real holdings exist) | `data.folio` + `DEFAULT_SHARES` — hardcoded, exactly as originally designed | 🔴 Static |
| Real holdings (once a signed-in user adds any) | Firestore `users/{uid}/portfolios/default/holdings/{ticker}` — takes over from the demo data automatically | ✅ Live |
| Price / % change on any holding, demo or real | `companies` merged in by ticker | 🟡 Hybrid |
| "Import from photo" | Simulated OCR flow (`PARSED` fixed fake result) — restored as originally designed, not a real image-recognition integration | 🔴 Static |
| AI portfolio summary (drivers/leaders/laggards) | Computed client-side from the merged holdings above — real once the underlying prices are real | 🟡 Hybrid |
| Materialized portfolio summary (new, 2026-07-08) | `totalValue`/`dayPL`/`dayPLPct`/`holdingsCount` written (debounced ~3s) onto the `users/{uid}/portfolios/default` doc whenever holdings or live prices change meaningfully. Not read back by any screen — the UI stays purely live-computed for zero latency; this is a cache for future consumers outside the browser (notifications, a backend job, historical tracking) | ✅ Live |

---

## Watchlist (`/menu/watchlist`) — `screens/watchlist.tsx`

| Element | Data | Status |
|---|---|---|
| Demo watchlist (when signed out, or before a real list exists) | `data.watch` — hardcoded, exactly as originally designed | 🔴 Static |
| Real watchlist (once a signed-in user saves one) | Firestore `users/{uid}/watchlists/default` — takes over from the demo list automatically | ✅ Live |
| Price / % change on any watched ticker, demo or real | `companies` merged in by ticker | 🟡 Hybrid |
| AI watchlist summary | Computed client-side from the merged list above | 🟡 Hybrid |

---

## Stock Detail (`/menu/stock`) — `screens/stock.tsx`

| Element | Data | Status |
|---|---|---|
| Price, % change, market cap, P/E, dividend yield, beta, sector | `companies` merged in at a single point (`data` object), flowing through the whole page — tagged with a "live quote · FMP" pill when live | 🟡 Hybrid |
| Candle chart (3M/6M/1Y) | Real `ohlcv_bars` (Polygon), tagged "live · Polygon" pill when in use | 🟡 Hybrid |
| Candle chart (1D/1W/5Y), RSI/MACD/technical indicators | Deterministic seeded generator — 1D/1W need intraday granularity (only daily bars are stored), 5Y needs more history than the ~300-day backfill covers; RSI/MACD aren't computed from the real bars yet either | 🔴 Static |
| AI thesis, AI risk, confidence score | `data.stockInfo` — hardcoded (needs Claude) | 🔴 Static |
| Recent news / insider activity (in the AI panel) | `data.stockInfo[sym].news` / `.ins` — hardcoded (separate from the real `insider_transactions` feed used on the Insider screen) | 🔴 Static |
| Chart notes (save / load / delete) | Firestore `stock_comments` — written/read directly via the client SDK | ✅ Live (unchanged — this was already live before any of this session's work) |

---

## Options Chain (`/menu/options`) — `screens/options.tsx`

| Element | Data | Status |
|---|---|---|
| "Live Options Reference" card (new) | New, additive `options_chains` (Polygon) card — real strikes/expirations + delayed last close/volume for the currently-selected ticker, shown only when it's in the curated `OPTIONS_UNIVERSE` (8 tickers: AAPL, MSFT, NVDA, TSLA, AMZN, META, SPY, QQQ) and has synced data | 🟡 Hybrid |
| Full chain (strike, bid/ask, last, IV, volume, OI, ITM flag) | `buildChain()` — deterministic seeded pseudo-random generator, untouched | 🔴 Static — **not just unwired**: Polygon's options snapshot and NBBO quotes are confirmed 403 NOT_AUTHORIZED on the current plan (verified 2026-07-07), so real bid/ask/IV/OI genuinely aren't available without a plan upgrade or a Tradier key |
| Greeks (delta/gamma/theta/vega) | Not computed or displayed at all currently | 🔴 Static (not built) |

Two further vendor paths are still scaffolded but inert if real bid/ask/greeks are wanted later: `backend/src/vendors/tradier/tradier.service.ts` (needs `TRADIER_ACCESS_TOKEN`, currently empty) and `backend/src/vendors/unusual-whales/unusual-whales.service.ts` (needs `UNUSUAL_WHALES_API_KEY`, currently empty, covers `options_flow`/`block_trades` instead).

---

## Insider & Institutional (`/menu/insider`) — `screens/insider.tsx`

| Element | Data | Status |
|---|---|---|
| Insider transaction feed | Real `insider_transactions` (SEC Form 4) rows tagged "live", concatenated with the original mock feed | 🟡 Hybrid |
| "Live overlap (CUSIP-matched, real)" section (new) | `fund_holdings/{cik}/filings/{accessionNumber}/positions` — exact CUSIP cross-referencing across real 13F filings, shown alongside (not replacing) the original mock cross-fund cards | ✅ Live |
| Fund cards, AI insight blurbs, cross-fund mock cards, institutional holders/mutual funds tables | `data.funds` / `AI_SECTIONS` / `CROSS_OWN` etc. — hardcoded, fully intact | 🔴 Static |

---

## Commentary (`/menu/commentary`) — `screens/commentary.tsx`

| Element | Data | Status |
|---|---|---|
| Live tab | Real `news` docs merged in ahead of the original mock `commentary` items. Polygon-primary as of 2026-07-08 — carries per-ticker `sentiment`/`sentimentReasoning`/`keywords` (null/empty on Finnhub fallback) | 🟡 Hybrid |
| Premarket / After Hours / My names / Macro tabs | Real `news` filtered by ET hour or ticker, appended to the corresponding original mock arrays (`PREMARKET`, `AFTERHOURS`, etc.) | 🟡 Hybrid |
| NewsDrawer (per-ticker history) | Live `news` section shown above the original mock `buildNewsHistory()` narrative section — both present | 🟡 Hybrid |
| "Before the Bell" / "General perspective" sidebar cards | Hardcoded | 🔴 Static |

---

## Recaps (`/menu/recap`) — `screens/recap.tsx`

| Element | Data | Status |
|---|---|---|
| Everything (index cards, news briefing, key stories, sector heatmap, movers, internals) | Hardcoded | 🔴 Static — **blocked**: needs a new Polygon-EOD-recap sync job plus `ANTHROPIC_API_KEY` for the narrative; neither exists yet |

---

## Macro & VIX (`/menu/macro`) — `screens/macro.tsx`

| Element | Data | Status |
|---|---|---|
| "Live Economic Indicators" card (CPI, unemployment, payrolls, Fed funds, 10Y yield, etc.) | New, additive `macro_events` (FRED) card — shows only once the collection has synced data; doesn't touch the calendar below | 🟡 Hybrid |
| "Live Dividend Calendar" card (new) | New, additive `dividends` (FMP) card — real upcoming ex-dividend dates, pay dates, amount, yield, frequency across the whole market, not just curated tickers | 🟡 Hybrid |
| Market regime card, VIX card, Last/This/Next Week economic calendars, Dividend calendar (chip grid/month view), VIX Sensitive Stocks table | Hardcoded | 🔴 Static — the economic calendar tabs are a fixed illustrative "today" (fictional dates), not a real date range, so live FRED readings aren't force-fit into them; see the note above `MacroEventsJob` for why |

---

## Summary (accurate as of 2026-07-08)

| Category | Screens |
|---|---|
| ✅ Fully live (no mock fallback in normal operation) | Stock notes (`stock_comments`); real user watchlist/portfolio once saved |
| 🟡 Hybrid (live data merged onto intact original mock UI) | Dashboard (all 3 mini-widgets now included), Earnings Hub, Market Movers, Market Heatmap, Analyst Actions (partially), Screener (market cap/P-E/RS now all live), Themes, Portfolio Pulse, Watchlist, Stock Detail (price/fundamentals + 3M/6M/1Y chart), Insider & Institutional, Commentary, Macro & VIX (Live Economic Indicators + Live Dividend Calendar cards), IPOs (Live IPO Calendar card), Options Chain (Live Options Reference card, curated 8-ticker universe only), shell ticker strip, shell Cmd+K search (full-market ticker search) |
| 🔴 Fully static, blocked on vendor plan/key | Recaps (needs Claude + a new job); Options Chain's main bid/ask/IV/greeks/OI table (needs a Polygon plan upgrade or a Tradier key); Analyst Actions event table/Earnings guidance-reaction/richer News (need Benzinga) |
| 🔴 Fully static, pending job run/restart | Macro & VIX's, IPOs', Options Chain's, and Dividends' live cards, plus Stock Detail's real chart and Screener's RS Rating — all six jobs are code-complete, keys are set (RS Rating needs none), just need the backend restarted and each job run once — RS Rating specifically also needs `stock-history` to have accumulated real history first |

---

## What would close the remaining gaps

| Gap | What's needed |
|---|---|
| Macro & VIX's live card | `FRED_API_KEY` is already set — just restart the backend (`npm run start:dev`) and `POST /sync/macro-events/run` once |
| IPOs' live card | Code is done (no key needed, Finnhub's already active) — just restart the backend and `POST /sync/ipos/run` once |
| Options Chain's live card | Code is done (no key needed, Polygon's already active) — just restart the backend and `POST /sync/options-chains/run` once |
| Macro & VIX's dividend card | Code is done (no key needed, FMP's already active) — just restart the backend and `POST /sync/dividends/run` once |
| Stock Detail's real chart (3M/6M/1Y) | Code is done (no key needed, Polygon's already active) — just restart the backend and `POST /sync/stock-history/run` a few times (rotating batch, ~4 runs to cover all of TICKER_UNIVERSE once) |
| Screener's real RS Rating | Code is done, no key needed — restart the backend, run `stock-history` a few times first (to accumulate real bars), then `POST /sync/rs-rating/run` |
| **Options Chain's real bid/ask/IV/greeks/OI — highest-value remaining gap** | Either upgrade the Polygon plan, or get a free `TRADIER_ACCESS_TOKEN` and finish the existing `tradier.service.ts` stub |
| Recaps | Build a Polygon-EOD-recap job + obtain `ANTHROPIC_API_KEY` |
| Analyst Actions event table, Earnings session/guidance/reaction | Need a Benzinga key (`BENZINGA_API_KEY`, currently empty) |
| News category tagging + real-time push | News itself upgraded to Polygon-primary 2026-07-08 (sentiment/reasoning/keywords, no key needed) — only per-firm category tags and sub-minute push still need Benzinga |

See `Doc/openapi.yaml` for the full, per-endpoint version of this table (`x-status`, `x-primary-source`, `x-alternate-source`, `x-fallback-behavior`).
