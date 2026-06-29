# StockWise — Feature Tracker
v1.3 | June 2026

**Status values:** Not Started | In Progress | In Review | Complete  
**Tier:** Free+ | Pro+ | Premium | All

---

## Pre-App

### Landing Page — `/`

| ID | Feature | Phase | Tier | Status | % | Owner | Notes |
|---|---|---|---|---|---|---|---|
| F-47 | StockWise Landing Page + Modal Login | MVP | All | **Complete** | 100% | Full Stack | Standalone marketing page at `app/page.tsx`. Dark radial gradient + animated perspective grid (spPan). Sections: hw-nav (sticky glassmorphism navbar), hw-hero (headline + "What Matters Now" live mock frame), hw-commit (commitment block, hwSheen animation, 2 cards), hw-steps (5 alternating step+mock-frame sections), hw-tabs-sec (14 workspace cards, gradShift+hwShine hover), hw-final (CTA). Scroll-reveal via IntersectionObserver (`.reveal` → `.reveal.in`). "Log in" opens inline modal overlay — no navigation. "Sign up" → /auth/signup. Modal: LoginForm in glassmorphism card, ✕ + Escape to close, logo button closes modal. CSS: `app/landing.css`. WebGL wave animation now visible: `.lp-root.mq-root { background: transparent }` (was `#000`). `ScaledScreen` uses `ResizeObserver` for dynamic scale (`containerWidth/1200`) instead of hardcoded 0.2834 — fixes glance-modal card at any width. |

### Auth Pages — `/auth/*`

| ID | Feature | Phase | Tier | Status | % | Owner | Notes |
|---|---|---|---|---|---|---|---|
| F-43 | Auth Pages — StockWise Theme | MVP | All | **Complete** | 100% | Full Stack | Login, Signup, Forgot Password with StockWise dark theme. Two-panel AuthLayout: LEFT = marketing panel (StockWise wordmark, gradient shimmer tagline, 8 animated feature pills with staggered spUp animation), RIGHT = glassmorphism form card (backdrop-filter blur, spRightIn animation). Google OAuth + email/password. Shared `app/auth/auth-layout.tsx`. Routes: /auth/login, /auth/signup, /auth/forgot-password. All logos → /. Signup "Sign in" → /. Forgot "Back to sign in" → /. Mobile responsive fix: added classes `lp-auth-cols` / `lp-auth-left` / `lp-auth-form` to wire inline media queries. `≤900px` stacks columns; `≤600px` hides marketing panel, form goes full-width. Firebase Auth iOS Safari fix: `signInWithPopup` first, `signInWithRedirect` fallback on popup-blocked. `getRedirectResult` on mount in both LoginForm and SignupForm. `initializeAuth` with `indexedDBLocalPersistence` + `browserLocalPersistence` (ITP-safe). |

---

## Intelligence

### Dashboard — `/dashboard`

| ID | Feature | Phase | Tier | Status | % | Owner | Notes |
|---|---|---|---|---|---|---|---|
| F-01 | Home Dashboard — What Matters Now | MVP | Pro+ | **In Progress** | 80% | Full Stack | UI complete: Pulse strip (6 cards, clickable openIndex), col-4×3 (Portfolio Pulse, Watchlist, Heatmap mini), col-8 (WMN + Live Feed stacked), col-4 (VIX, F&G, Earnings Today, Analyst Actions, Market Movers). Session filter tabs removed. Modal/popover pattern (centered, animated) replaces right-side sliding drawer. Remaining: real-time WebSocket data, drag/drop widget grid, audio recap button. |
| F-08 | Before the Bell Briefing | MVP | Pro+ | **Not Started** | 0% | Backend | Pushed summary at 8:30am ET. Covers: futures, overnight news, macro events today, BMO earnings. Delivered in-app + email. |
| F-09 | After the Close Briefing | MVP | Pro+ | **Not Started** | 0% | Backend | Pushed summary within 30 min of market close. Covers: final indices, top stories, next-day preview (earnings, macro, Fed speakers). Delivered in-app + email. |
| F-55 | Dashboard Market Movers Widget — Winners & Losers | MVP | Pro+ | **Complete** | 100% | Full Stack | `col-4` widget with Winners/Losers tabs, scrollable list of 15 stocks per tab, sector + market cap filter dropdowns, per-row `.mv-dash-row` hover popup showing Technical/News tabs with relevant data. Fits alongside Heatmap widget on same row (both col-4). File: `screens/dashboard.tsx`. |
| F-53 | Trending Stocks Dashboard Widget | MVP | Pro+ | **Complete** | 100% | Full Stack | `col-12` row at bottom of dashboard grid. Inline `computeTrending()` cross-references movers + analyst + earnings data to surface multi-day momentum stocks. Shows trending score, catalyst pills, volume surge indicators. File: `screens/dashboard.tsx`. |

### Earnings — `/menu/earnings`

| ID | Feature | Phase | Tier | Status | % | Owner | Notes |
|---|---|---|---|---|---|---|---|
| F-02 | Earnings Calendar | MVP | Free+ | **In Progress** | 60% | Full Stack | Views: Today/Tomorrow/This Week/Next Week/Custom. Kanban BMO/AMC grid. Row columns: ticker, report time, cap bucket, sector, EPS actual/est/surprise%, Rev actual/est/surprise%, guidance status, post-print reaction. Tag pills: Beats EPS, Misses Rev, Raises Guide, Lowers Guide, Inline, Mixed, High Short Interest, Large Move, Options Active. Side-by-side layout: calendar `col-6` + EPS history `col-6` (fixed from previous col-7 overflow). |
| F-49 | Earnings Inline Detail Panel | MVP | Free+ | **Complete** | 100% | Full Stack | When an earnings row is selected (`selEarning` state), an accordion-style detail panel appears inline below the calendar — no drawer or modal. Shows: company logo, name, sector, timing pill, EPS estimate, EPS actual, guidance status, price reaction/implied move, AI-generated read. File: `screens/earnings.tsx`. |
| F-03 | Earnings Detail Drawer | MVP | Free+ | **Not Started** | 0% | Full Stack | Full right-side drawer (70% width desktop, full mobile). Tabs: Summary / Transcript / Audio / News / Peers. EPS/Rev headline metrics, guidance summary, 8-quarter history chart, earnings transcript, call audio player, latest news 24h, peer reactions. Embeds F-06 AI summary. |
| F-04 | Earnings Setup Card (Pre-Announce) | MVP | Pro+ | **Not Started** | 0% | Full Stack | Pre-announcement card per scheduled ticker: implied move (options), last 4 earnings reactions, analyst sentiment trend 30d, peer performance pre-announcement, key questions for quarter. |
| F-05 | Earnings Movers Board | MVP | Free+ | **Not Started** | 0% | Full Stack | Auto-list: stocks with largest post-earnings moves today and this week. Columns: ticker, reaction %, direction, beat/miss, guidance status, sector, portfolio flag. Sorted by absolute move size. |
| F-06 | AI Earnings Summary | MVP | Pro+ | **Not Started** | 0% | AI + Backend | Generated within minutes of transcript availability. Output: What happened, Beat/miss with context, Guidance (verbatim quote), Management tone, Segment highlights, Risks, Investor reaction, What to watch. One-line takeaway. Confidence label + disclaimer. |
| F-35 | Earnings Call Audio Player | Phase 2 | Premium | **Not Started** | 0% | Full Stack | Compact audio player in earnings detail drawer. Source: Intrinio. Features: play/pause, timestamp seek, speed control. |

### Market Movers — `/menu/movers`

| ID | Feature | Phase | Tier | Status | % | Owner | Notes |
|---|---|---|---|---|---|---|---|
| F-10 | Market Movers Board | MVP | Free+ | **In Progress** | 40% | Full Stack | View tabs: Top Gainers, Top Losers, Unusual Volume, Gap Ups, Gap Downs, High Relative Volume, Large-Cap Movers, Weekly Movers. Row/trending-pill click opens `stock-side-drawer` with full embedded StockScreen (dynamic import, no modal). Removed mvpop hover tooltip. Remaining: real API data, weekly tab, filters. File: `screens/movers.tsx`. |
| F-11 | Weekly Movers Page | MVP | Free+ | **Not Started** | 0% | Full Stack | Published Friday, available through weekend. Top 10 up + top 10 down for the week. Each: ticker, weekly % change, short catalyst (earnings/analyst/macro/news). |

### Market Heatmap — `/menu/heatmap`

| ID | Feature | Phase | Tier | Status | % | Owner | Notes |
|---|---|---|---|---|---|---|---|
| *(F-01)* | Heatmap Mini Widget | MVP | Free+ | **In Progress** | 70% | Full Stack | Treemap grid with heatCol() for tile bg + text color. Embedded in Dashboard col-4×3 widget. Full-screen heatmap at /menu/heatmap. |

### Analyst Actions — `/menu/analyst`

| ID | Feature | Phase | Tier | Status | % | Owner | Notes |
|---|---|---|---|---|---|---|---|
| F-12 | Analyst Actions Board | MVP | Pro+ | **In Progress** | 40% | Full Stack | Real-time board: upgrades, downgrades, initiations, reiterations, PT changes. Columns: ticker, firm, prev/new rating (direction arrow), prev/new PT, implied upside/downside, time, stock reaction since action, action count 30d. Filters: upgrade/downgrade/initiation/PT-change only, major banks, portfolio/watchlist. AI note per action. |
| F-48 | Analyst Flags — 5+ Action Alert | MVP | Pro+ | **Complete** | 100% | Full Stack | Front-end `computeFlags()` counts analyst actions per ticker from `data.analyst`. Stocks with ≥5 actions get a flag card in the sidebar showing firm list (upgrades + downgrades). Top 3 upgrades by n30/react surfaced in a separate "Top Upgrades" block. File: `screens/analyst.tsx`. Data: `app/iq/data.ts` has CRM (6 entries) and NVDA (5 entries) to trigger the flag. |

### Screener — `/menu/screener`

| ID | Feature | Phase | Tier | Status | % | Owner | Notes |
|---|---|---|---|---|---|---|---|
| F-45 | Stock Screener | MVP | Pro+ | **In Progress** | 60% | Full Stack | Left panel: 9 checkbox filters. 20 named presets (dropdown + browse overlay). Results table: Company, Sector, Mkt Cap, P/E, RS (color-coded), Sales Gr, EPS Gr, Margin%, RVOL, Tech Rating (.tr-badge). Preset applies filter + highlights. Backend/real data: Not Started. |

### IPOs — `/menu/ipos`

| ID | Feature | Phase | Tier | Status | % | Owner | Notes |
|---|---|---|---|---|---|---|---|
| F-46 | IPOs & Recent Performance | MVP | Free+ | **Complete** | 100% | Full Stack | Stats strip (above-offer count, best performer, median return). Tabs: (1) Recent performance — 8 recent IPOs with ticker/company/sector/IPO date/offer/current/Day-1/since-IPO return, click-to-open Stock Detail; (2) Upcoming pipeline — 4 expected new issues. File: `screens/ipos.tsx`. Slug: `ipos`. Static data; prod source: SEC EDGAR + Polygon.io. |

### Stock Detail — `/menu/stock`

| ID | Feature | Phase | Tier | Status | % | Owner | Notes |
|---|---|---|---|---|---|---|---|
| F-17 | Stock Detail Page | MVP | Free+ | **In Progress** | 75% | Full Stack | UI complete: sym selector bar (fbar), sd-head (logo/name/price/actions), sd-grid (chart col + ratings col). CandleChart SVG + RsiPane. Key stats grid. AI Technical Analysis. Financials bar chart. TrGauge (5-segment Technical Rating) + indicator table, Peers minirows, Industry Group rank, Earnings history, Insider/Institutional section. Remaining: real API data, interactive zoom, options/block trades sections. |
| F-50 | Stock Chart Right-Click Notes (Firebase) | MVP | Pro+ | **Complete** | 100% | Full Stack | Right-click context menu on chart div. Opens centered modal with textarea. Saves to Firestore `stock_comments` collection: `{uid, sym, name, comment, createdAt: Timestamp}`. Notes card below chart shows history with datetime + ✕ delete per note. `loadNotes()` / `saveNote()` / `deleteNote()` async helpers using `collection, addDoc, getDocs, query, where, orderBy, Timestamp, deleteDoc, doc`. `useCallback` + `useEffect` refreshes notes on symbol change. File: `screens/stock.tsx`. |
| F-18 | Peer View | MVP | Pro+ | **Not Started** | 0% | Full Stack | 5–10 closest peers by sector/industry group/business model. Table: ticker, 1D/1W/1M perf, market cap, next earnings date, analyst rating consensus, valuation snapshot. |
| F-19 | Group View (MarketSurge-style) | MVP | Pro+ | **Not Started** | 0% | Full Stack | Industry group rank vs all groups, trend, strongest/weakest names in group, group-level news + analyst activity. |
| F-31 | AI Technical Analysis | Phase 2 | Pro+ | **Not Started** | 0% | AI + Full Stack | 4 tone modes: Short Summary / Swing Trader View / Position Trader View / Long-Term Investor View. Labeled AI-generated, not investment advice. |
| F-41 | Peer RS vs EPS Growth Scatter Matrix | Phase 2 | Pro+ | **Not Started** | 0% | Full Stack | 2D bubble chart: RS (X-axis) vs EPS Growth Rate (Y-axis) for all peers/group members. |

### Options Chain — `/menu/options`

| ID | Feature | Phase | Tier | Status | % | Owner | Notes |
|---|---|---|---|---|---|---|---|
| F-57 | Options Chain Screen | MVP | Pro+ | **In Progress** | 40% | Full Stack | Left stock search sidebar + main chain table (calls left / puts right) with strike, bid, ask, IV%, OI, volume columns. Expiry date tab selector (horizontal scroll on mobile). Filter: calls/puts/both. Click row → opens stock detail. File: `screens/options.tsx`. Static data; prod source: Polygon.io Options API. |

### Insider & Institutional — `/menu/insider`

| ID | Feature | Phase | Tier | Status | % | Owner | Notes |
|---|---|---|---|---|---|---|---|
| F-26 | Insider & Institutional — Fund Tracker + Insider Feed | Phase 2 | Premium | **In Progress** | 50% | Backend | Two tabs: (1) Insider activity — Form 4 feed table, filter by Buys/Sells/10% owners, sort by value or date, most-active chips; (2) 13F institutional — fund cards + AI summary + cross-fund signals. Top 5 most-followed funds. Sources: SEC EDGAR 13F-HR + Form 4. Slug: `insider`. File: `screens/insider.tsx`. UI complete, static data. |
| F-27 | 13F Quarterly Digest & AI Summary | Phase 2 | Premium | **Not Started** | 0% | AI + Backend | Per fund per quarter: new positions, added, trimmed, exited, unchanged. AI summary. |
| F-28 | Cross-Fund Views | Phase 2 | Premium | **Not Started** | 0% | Full Stack | "Most owned across tracked funds", "Most sold", "Only one fund owns this". Co-Attribution Screener. |
| F-29 | Unusual Options Activity Board | Phase 2 | Premium | **Not Started** | 0% | Full Stack | Rows: ticker, call/put, strike, expiry, premium paid, contract size, total value, vol/OI ratio, direction flag. Powered by Unusual Whales API. |
| F-30 | Block Trades Board | Phase 2 | Premium | **Not Started** | 0% | Full Stack | Rows: ticker, trade value, shares, price, price vs VWAP, time, direction context. Powered by Polygon.io Trades. |

### Commentary — `/menu/commentary`

| ID | Feature | Phase | Tier | Status | % | Owner | Notes |
|---|---|---|---|---|---|---|---|
| F-07 | Live Market Feed | MVP | Free+ | **In Progress** | 75% | Full Stack | Commentary screen has 5 functional filter tabs: Live (all items), Premarket, After Hours, My names, Macro. FeedItem component shared across tabs. Ticker search bar (SEARCH_SYMS autocomplete dropdown): typing a symbol opens `NewsDrawer` sliding panel with `buildNewsHistory()` categorized items (Catalyst, Technical, Sector, Analyst, Earnings, Calendar, Coverage, Product, Guidance). Quick news lookup card in sidebar with 8 ticker chips. "Open full stock page →" button in NewsDrawer calls `openStockFull(sym)`. File: `screens/commentary.tsx`. Remaining: WebSocket real-time data, pin/mark-read, push delivery. |
| F-33 | Story Stocks Section | Phase 2 | Pro+ | **Not Started** | 0% | Full Stack | Curated section for stocks with active narrative. AI-tagged via news cluster density + price/volume anomaly. Card: what/why/what changed today/next catalyst date/affected peers+ETFs+sectors. |

---

## My Money

### Portfolio Pulse — `/menu/portfolio`

| ID | Feature | Phase | Tier | Status | % | Owner | Notes |
|---|---|---|---|---|---|---|---|
| F-13 | Portfolio Creation & Management | MVP | Free+ | **In Progress** | 65% | Full Stack | Left pf-list panel: holdings `useState` (add/partial sell/remove), seeded from mock data. Right panel: full StockScreen embedded via dynamic import for `pfSel` ticker — same layout as Stock Detail page. Clicking a holding row sets `pfSel`. Per-holding: current price, day change, position size bucket, G/L, next earnings date, last analyst action. Broker import Phase 2. File: `screens/portfolio.tsx`. |
| F-52 | AI Portfolio Summary — Drivers / Laggards / Leaders | MVP | Pro+ | **Complete** | 100% | Full Stack | Dynamic 3-column grid computed from `holdings` useState: Drivers (top G/L), Laggards (bottom G/L), Leaders today (top day change). Each row clickable → openStock(). AI disclaimer footer. Updates live as holdings are added/removed. **AI Pulse card added**: renders `PULSE` string array as bullet notes below the WMN block (before the holdings table) — each note is a plain-English AI insight for a specific holding, with disclaimer. File: `screens/portfolio.tsx`. |
| F-14 | Portfolio Pulse Card | MVP | Pro+ | **Not Started** | 0% | AI + Backend | AI summary generated at 7am ET + updated at market close. In plain English: what changed in holdings today and why. Flags names with material events (earnings, analyst action, unusual move). |
| F-37 | Broker Import (Plaid/SnapTrade) | Phase 2 | Pro+ | **Not Started** | 0% | Backend | Plaid or SnapTrade OAuth. Multi-brokerage support. Pull current positions, reconcile against manually entered portfolio. |

### Watchlist — `/menu/watchlist`

| ID | Feature | Phase | Tier | Status | % | Owner | Notes |
|---|---|---|---|---|---|---|---|
| F-15 | Watchlist Management | MVP | Free (5 max) | **In Progress** | 50% | Full Stack | Company name click opens `stock-side-drawer` with full embedded StockScreen (dynamic import). Delete confirmation modal: "Are you sure want to delete {sym}?" with OK/Cancel (state: `confirmDelete`). `localStorage("iq-watchlist")` persists list as JSON array of strings across sessions. Free: up to 5 names. Pro+: unlimited. File: `screens/watchlist.tsx`. |
| F-51 | AI Watchlist Alerts — Per-Stock Toggle | MVP | Pro+ | **Complete** | 100% | Full Stack | Two-panel Google Finance layout: left panel (280px, filter chips All/Options active/Movers today, scrollable wl-item list with sparklines), right panel (breadcrumb, company header with icon+price, area chart with period selector + toolbar, tabs Overview/Earnings/Analyst/Financials, metrics table). `bigChartSVG()` generates 800×160 SVG area chart seeded from ticker. CSS: `.wl-*` classes in iq.css. File: `screens/watchlist.tsx`. |
| F-16 | Alert Engine — Core Rules | MVP | Pro+ | **Not Started** | 0% | Backend | In-app + email (Phase 1); SMS + push Phase 2. 12 alert types: earnings posted, post-ER move >5%, analyst up/down, unusual options, block trade, price move, volume spike >3×, 52-wk breakout, macro event, peer sympathy move, 13F filing, group RS rank. |
| F-38 | Industry Rotation Alerts | Phase 2 | Premium | **Not Started** | 0% | Backend | Detection: industry subgroup enters or exits top 20 RS rankings. Push + email delivery. |

---

## Context

### Recaps — `/menu/recap`

| ID | Feature | Phase | Tier | Status | % | Owner | Notes |
|---|---|---|---|---|---|---|---|
| F-22 | End-of-Day Recap | MVP | Free (read) | **In Progress** | 80% | AI + Backend | EOD tab complete: `RcpIndexCards` (9-index pulse grid, `data.pulse`, `Spark` sparklines); `NewsBriefing` newspaper two-page spread (`NEWS_DAILY` array, `DAILY_LEAD`, `stockifyText()` inline ticker parsing, social share buttons X/LinkedIn/WhatsApp/Facebook/Telegram); `ScheduleShare` form (freq/time/email — demo state); recap-hero (headline + index returns + audio CTA), PDF download, 2-col key stories + up-next, sector heatmap, earnings movers, market internals. File: `screens/recap.tsx`. Remaining: real backend generation, actual PDF writer, audio TTS, email delivery. |
| F-23 | Weekly Recap | MVP | Free (read) | **In Progress** | 60% | AI + Backend | "This Week" tab shares the same `RcpIndexCards`, `NewsBriefing` (using `NEWS_WEEKLY` / `WEEKLY_LEAD`), and `ScheduleShare` components as EOD. Static `WEEKLY` data: headline, 5-day index returns, top-stories + next-week calendar (2-col), sector leaders/laggards/biggest-moves (3-col), weekly sector heatmap. File: `screens/recap.tsx`. Remaining: real backend weekly generation, portfolio-specific weekly tab. |
| F-34 | Audio Recaps (TTS) | Phase 2 | Premium | **Not Started** | 0% | Backend | TTS pipeline: Claude generates 60s audio script from EOD/weekly recap → TTS → MP3 stored in S3 → in-app player. |
| F-39 | Social Sharing — Recap Cards | Phase 2 | Pro+ | **In Progress** | 40% | Full Stack | Share buttons (X, LinkedIn, WhatsApp, Facebook, Telegram) implemented in `NewsBriefing` component via `window.open()` with platform-specific URL encoding. Remaining: recap card image generation (Canvas/Puppeteer), actual image attachment to share payloads. |

### Macro & VIX — `/menu/macro`

| ID | Feature | Phase | Tier | Status | % | Owner | Notes |
|---|---|---|---|---|---|---|---|
| F-20 | VIX Widget | MVP | Free+ | **Not Started** | 0% | Full Stack | VIX level + day change, 12-month percentile rank, trend direction (rising/falling/flat), plain-English explanation, 30-day sparkline trend. |
| F-21 | Macro Dashboard & Calendar | MVP | Pro+ | **In Progress** | 60% | Full Stack | Typed `MacroEvent` interface. 3-week calendar via `CAL_LAST`, `CAL_THIS`, `CAL_NEXT` arrays. 15+ events: CPI, PPI, Retail Sales, FOMC Decision, FOMC Press Conference, Jobless Claims, Philadelphia Fed, Existing Home Sales, GDP, PCE Deflator, Consumer Confidence, Durable Goods, Chicago PMI. 8-column table: Event, Date, Impact (H/M/L pill), Prior, Est., Actual, Surprise, Note. Market regime label widget: 7 states. Recent macro releases section. File: `screens/macro.tsx`. |

---

## Platform & Shell

### Shell & Design System

| ID | Feature | Phase | Tier | Status | % | Owner | Notes |
|---|---|---|---|---|---|---|---|
| F-42 | StockWise Shell & Design System | MVP | All | **Complete** | 100% | Full Stack | IQShell wrapping each page; sidebar nav (3 groups: Intelligence / Context / My Money; 15 screens — Intelligence: Dashboard, Earnings, Market Movers, Heatmap, Analyst, Screener, IPOs, Stock Detail, Options, Insider & Institutional; Context: Commentary, Recap, Macro; My Money: Portfolio Pulse, Watchlist). Topbar (StockWise logo gradient + wordmark b=ai color), drawer system (stock/earnings/sector/fund/index/feargreed), AI Copilot panel, Cmd+K palette, profile dropdown. IQActionsContext: openStock/openStockFull/openEarnings/openSector/openFund/openIndex/openFearGreed/setCopilot/theme/setTheme. **Modal pattern (iq.css)**: all overlay UIs use `position:fixed; inset:0; margin:auto` centered modal with `iq-popIn` scale+translateY animation, replacing the prior right-side sliding drawer. Mobile responsive: `@media (max-width: 767px)` breakpoint. Hamburger (`.mob-ham`), slide-in rail (`.rail.mob-open`), scrim inside `.app` (critical stacking context fix — scrim z-100, rail z-200). Bottom-sheet drawers on mobile. Options page: horizontal tab scroll, header meta wraps. Nav items `var(--text-hi)` in rail. Tablet `@media (max-width: 860px)` stacks options sidebar. Profile dropdown: `iq-dropdownIn` animation (no translateX), `pd-avatar` 52px image in popup header. |
| F-44 | User Preferences & Dark Mode | MVP | All | **Complete** | 100% | Full Stack | Dark mode toggle in Settings wired to Firestore `settings/{uid}` (darkMode: boolean). Custom in-app confirmation modal. Theme applied via `data-theme` on `.iq-root`. localStorage fast cache (no flicker on nav). Firestore read on shell mount syncs across devices. |
| F-40 | Cmd+K Command Bar | Phase 2 | Pro+ | **In Progress** | 65% | Full Stack | Cmd+K / Ctrl+K global overlay. `SEARCHABLE_STOCKS` constant (20 tickers with name/sector). Stock ticker results surface above page-nav results. Per-stock ☆/★ star toggle with `starred: Set<string>` state and `toggleStar(sym)`. Starred stocks listed in palette footer section. Keyboard navigation (↑↓ arrows, Enter, Escape). Phase 2: fuzzy search via API, contextual suggestions by current page. File: `shell.tsx`. |
| F-32 | AI Market Copilot (Chat) | Phase 2 | Premium | **Not Started** | 0% | AI + Full Stack | Chat panel in shell. Access to: live market data, earnings, analyst actions, 13F, macro, portfolio, watchlist. Streaming SSE. Labeled informational, not investment advice. |
| F-24 | Learn in 60 Seconds | MVP | Free+ | **Not Started** | 0% | Full Stack | Contextual educational micro-cards triggered by page landing. Examples: 13F page → "What is a 13F?"; earnings detail → "Why guidance matters more than EPS"; VIX widget → "What VIX levels mean". |

### Subscription & Billing

| ID | Feature | Phase | Tier | Status | % | Owner | Notes |
|---|---|---|---|---|---|---|---|
| F-25 | Subscription & Billing (Stripe) | MVP | N/A | **In Progress** | 15% | Full Stack | Stripe integration. Free/Pro/Premium tier gates. Upgrade flow: tier comparison page, Stripe checkout, feature gating at API middleware. |

### Mobile & Platform Expansion

| ID | Feature | Phase | Tier | Status | % | Owner | Notes |
|---|---|---|---|---|---|---|---|
| F-36 | Mobile App (React Native) | Phase 2 | Pro+ | **Not Started** | 0% | Mobile | React Native. Bottom tab nav: Dashboard / Earnings / Movers / Portfolio / Alerts. Push notifications for all alert types. Condensed mobile-optimized views. Shared API layer with web. |
| F-56 | Web App Mobile Responsive | MVP | All | **Complete** | 100% | Full Stack | Responsive shell at ≤767px: hamburger menu (`.mob-ham`), slide-in nav rail (`.rail.mob-open`), scrim inside `.app` for correct stacking context, bottom-sheet drawers, icon-only Copilot FAB. Tablet breakpoint at ≤860px for options sidebar. Auth pages responsive: `lp-auth-cols` / `lp-auth-left` / `lp-auth-form` classes, ≤600px hides marketing panel. Options page: tabs scroll horizontally, stock header wraps on mobile. Profile dropdown: fixed shift bug (`iq-dropdownIn`), 52px avatar image. Firebase Auth iOS Safari: popup-first + redirect fallback + `indexedDBLocalPersistence`. |

---

## Phase Summary

| Phase | Total Features | Complete | In Progress | Target |
|---|---|---|---|---|
| MVP (Phase 1) | 34 | 12 (F-42, F-43, F-44, F-46, F-47, F-48, F-49, F-50, F-51, F-52, F-53, F-55, F-56) | 10 (F-01, F-02, F-07, F-10, F-12, F-13, F-15, F-21, F-22, F-25, F-40, F-45) | Week 18 |
| Phase 2 | 17 (+F-26 UI) | 0 | 1 (F-40) | Week 38 |
| **Total** | **51** | **12** | **11** | — |

## Status Legend

| Status | Meaning |
|---|---|
| Not Started | Work has not begun |
| In Progress | Actively in development (UI built with static data counts) |
| In Review | Dev complete; in QA or stakeholder review |
| Complete | Deployed and accepted |
