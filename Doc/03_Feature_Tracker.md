# StockWise — Feature Tracker
v1.2 | June 2026

**Status values:** Not Started | In Progress | In Review | Complete  
**Tier:** Free+ | Pro+ | Premium | All

---

## Pre-App

### Landing Page — `/`

| ID | Feature | Phase | Tier | Status | % | Owner | Notes |
|---|---|---|---|---|---|---|---|
| F-47 | StockWise Landing Page + Modal Login | MVP | All | **Complete** | 100% | Full Stack | Standalone marketing page at `app/page.tsx`. Dark radial gradient + animated perspective grid (spPan). Sections: hw-nav (sticky glassmorphism navbar), hw-hero (headline + "What Matters Now" live mock frame), hw-commit (commitment block, hwSheen animation, 2 cards), hw-steps (5 alternating step+mock-frame sections), hw-tabs-sec (14 workspace cards, gradShift+hwShine hover), hw-final (CTA). Scroll-reveal via IntersectionObserver (`.reveal` → `.reveal.in`). "Log in" opens inline modal overlay — no navigation. "Sign up" → /auth/signup. Modal: LoginForm in glassmorphism card, ✕ + Escape to close, logo button closes modal. CSS: `app/landing.css`. |

### Auth Pages — `/auth/*`

| ID | Feature | Phase | Tier | Status | % | Owner | Notes |
|---|---|---|---|---|---|---|---|
| F-43 | Auth Pages — StockWise Theme | MVP | All | **Complete** | 100% | Full Stack | Login, Signup, Forgot Password with StockWise dark theme. Two-panel AuthLayout: LEFT = marketing panel (StockWise wordmark, gradient shimmer tagline, 8 animated feature pills with staggered spUp animation), RIGHT = glassmorphism form card (backdrop-filter blur, spRightIn animation). Google OAuth + email/password. Shared `app/auth/auth-layout.tsx`. Routes: /auth/login, /auth/signup, /auth/forgot-password. All logos → /. Signup "Sign in" → /. Forgot "Back to sign in" → /. |

---

## Intelligence

### Dashboard — `/dashboard`

| ID | Feature | Phase | Tier | Status | % | Owner | Notes |
|---|---|---|---|---|---|---|---|
| F-01 | Home Dashboard — What Matters Now | MVP | Pro+ | **In Progress** | 70% | Full Stack | UI complete: Pulse strip (6 cards, clickable openIndex), col-4×3 (Portfolio Pulse, Watchlist, Heatmap mini), col-8 (WMN + Live Feed stacked), col-4 (VIX, F&G, Earnings Today, Analyst Actions, Top Movers). Remaining: real-time WebSocket data, drag/drop widget grid, session tab filtering, audio recap button. |
| F-08 | Before the Bell Briefing | MVP | Pro+ | **Not Started** | 0% | Backend | Pushed summary at 8:30am ET. Covers: futures, overnight news, macro events today, BMO earnings. Delivered in-app + email. |
| F-09 | After the Close Briefing | MVP | Pro+ | **Not Started** | 0% | Backend | Pushed summary within 30 min of market close. Covers: final indices, top stories, next-day preview (earnings, macro, Fed speakers). Delivered in-app + email. |

### Earnings — `/menu/earnings`

| ID | Feature | Phase | Tier | Status | % | Owner | Notes |
|---|---|---|---|---|---|---|---|
| F-02 | Earnings Calendar | MVP | Free+ | **In Progress** | 35% | Full Stack | Views: Today/Tomorrow/This Week/Next Week/Custom. Kanban BMO/AMC grid. Row columns: ticker, report time, cap bucket, sector, EPS actual/est/surprise%, Rev actual/est/surprise%, guidance status, post-print reaction. Tag pills: Beats EPS, Misses Rev, Raises Guide, Lowers Guide, Inline, Mixed, High Short Interest, Large Move, Options Active. Sort + filter by: session, sector, cap, options activity, transcript, portfolio/watchlist. |
| F-03 | Earnings Detail Panel | MVP | Free+ | **Not Started** | 0% | Full Stack | Right-side drawer (70% width desktop, full mobile). Tabs: Summary / Transcript / Audio / News / Peers. EPS/Rev headline metrics, guidance summary, price reaction (current/AH/5-day), 8-quarter history chart, earnings transcript, call audio player, latest news 24h, peer reactions. Embeds F-06 AI summary. |
| F-04 | Earnings Setup Card (Pre-Announce) | MVP | Pro+ | **Not Started** | 0% | Full Stack | Pre-announcement card per scheduled ticker: implied move (options), last 4 earnings reactions, analyst sentiment trend 30d, peer performance pre-announcement, key questions for quarter. |
| F-05 | Earnings Movers Board | MVP | Free+ | **Not Started** | 0% | Full Stack | Auto-list: stocks with largest post-earnings moves today and this week. Columns: ticker, reaction %, direction, beat/miss, guidance status, sector, portfolio flag. Sorted by absolute move size. |
| F-06 | AI Earnings Summary | MVP | Pro+ | **Not Started** | 0% | AI + Backend | Generated within minutes of transcript availability. Output: What happened, Beat/miss with context, Guidance (verbatim quote), Management tone, Segment highlights, Risks, Investor reaction, What to watch. One-line takeaway: Bullish/Cautiously Bullish/Neutral/Cautious/Mixed. Confidence label + disclaimer. |
| F-35 | Earnings Call Audio Player | Phase 2 | Premium | **Not Started** | 0% | Full Stack | Compact audio player in earnings detail drawer. Source: Intrinio. Features: play/pause, timestamp seek, speed control. Shown when recording URL available. |

### Market Movers — `/menu/movers`

| ID | Feature | Phase | Tier | Status | % | Owner | Notes |
|---|---|---|---|---|---|---|---|
| F-10 | Market Movers Board | MVP | Free+ | **In Progress** | 25% | Full Stack | View tabs: Top Gainers, Top Losers, Unusual Volume, Gap Ups, Gap Downs, High Relative Volume, Large-Cap Movers, Weekly Movers. Mover card: ticker, price, % change, $ change, volume vs 30d avg (ratio), catalyst label (earnings/analyst/news/macro/no known), peer reactions, MA context (above/below 20/50/200-day). Filter by: index, sector, industry group, cap, price range, float, session. |
| F-11 | Weekly Movers Page | MVP | Free+ | **Not Started** | 0% | Full Stack | Published Friday, available through weekend. Top 10 up + top 10 down for the week. Each: ticker, weekly % change, short catalyst (earnings/analyst/macro/news). Link to Stock Detail. |

### Market Heatmap — `/menu/heatmap`

| ID | Feature | Phase | Tier | Status | % | Owner | Notes |
|---|---|---|---|---|---|---|---|
| *(F-01)* | Heatmap Mini Widget | MVP | Free+ | **In Progress** | 70% | Full Stack | Treemap grid with heatCol() for tile bg + text color. Embedded in Dashboard col-4×3 widget. Full-screen heatmap at /menu/heatmap. |

### Analyst Actions — `/menu/analyst`

| ID | Feature | Phase | Tier | Status | % | Owner | Notes |
|---|---|---|---|---|---|---|---|
| F-12 | Analyst Actions Board | MVP | Pro+ | **In Progress** | 25% | Full Stack | Real-time board: upgrades, downgrades, initiations, reiterations, PT changes. Columns: ticker, firm, prev/new rating (direction arrow), prev/new PT, implied upside/downside, time, stock reaction since action, action count 30d. Filters: upgrade/downgrade/initiation/PT-change only, major banks, portfolio/watchlist. AI note per action: meaningfulness (target change, firm weight, trend direction, crowding). |

### Screener — `/menu/screener`

| ID | Feature | Phase | Tier | Status | % | Owner | Notes |
|---|---|---|---|---|---|---|---|
| F-45 | Stock Screener | MVP | Pro+ | **In Progress** | 60% | Full Stack | Left panel: 9 checkbox filters (RS ≥ 90, RS 70–90, RS < 40, Sales Gr > 20%, EPS Gr > 25%, Positive Margin, Rating: Buy, Mkt Cap > $10B, RVOL > 1.5×). 20 named presets (dropdown + browse overlay). Results table: Company, Sector, Mkt Cap, P/E, RS (color-coded), Sales Gr, EPS Gr, Margin%, RVOL, Tech Rating (.tr-badge). Preset applies filter + highlights. Reset All clears. Backend/real data: Not Started. |

### IPOs — `/menu/ipos`

| ID | Feature | Phase | Tier | Status | % | Owner | Notes |
|---|---|---|---|---|---|---|---|
| F-46 | IPOs & Recent Performance | MVP | Free+ | **Complete** | 100% | Full Stack | Stats strip (above-offer count, best performer, median return). Tabs: (1) Recent performance — 8 recent IPOs with ticker/company/sector/IPO date/offer/current/Day-1/since-IPO return, click-to-open Stock Detail; (2) Upcoming pipeline — 4 expected new issues. File: `screens/ipos.tsx`. Slug: `ipos`. Static data; prod source: SEC EDGAR + Polygon.io. |

### Commentary — `/menu/commentary`

| ID | Feature | Phase | Tier | Status | % | Owner | Notes |
|---|---|---|---|---|---|---|---|
| F-07 | Live Market Feed | MVP | Free+ | **In Progress** | 25% | Full Stack | Real-time WebSocket feed, latency < 1s. Items tagged: Macro, Index Move, Sector Move, Earnings, Analyst Action, Story Stock, Options, Block Trade, Fed/Rates. Every item: "Why it matters" line. Filter tabs: All Market / My Portfolio / My Watchlist / Earnings / Analyst Actions / Macro. Pin items, mark as read. |
| F-33 | Story Stocks Section | Phase 2 | Pro+ | **Not Started** | 0% | Full Stack | Curated section for stocks with active narrative. Triggers: major product news, earnings blowout, activist activity, short squeeze, takeover chatter, regulatory event, guidance reset, thematic momentum. AI-tagged via news cluster density + price/volume anomaly (no manual curation). Card: what the story is, why market cares, what changed today, next catalyst date, affected peers/ETFs/sectors. |

---

## My Money

### Portfolio Pulse — `/menu/portfolio`

| ID | Feature | Phase | Tier | Status | % | Owner | Notes |
|---|---|---|---|---|---|---|---|
| F-13 | Portfolio Creation & Management | MVP | Free+ | **In Progress** | 35% | Full Stack | Manual portfolio creation. Per-holding: current price, day change, position size bucket (small/medium/large), cost basis, gain/loss, next earnings date, last analyst action, recent price move, unusual options flag, latest news headline. Per-holding settings: conviction level (high/medium/low), personal note, alert preferences. Broker import Phase 2. |
| F-14 | Portfolio Pulse Card | MVP | Pro+ | **Not Started** | 0% | AI + Backend | AI summary generated at 7am ET + updated at market close. In plain English: what changed in holdings today and why. Flags names with material events (earnings, analyst action, unusual move) overnight or today. |
| F-37 | Broker Import (Plaid/SnapTrade) | Phase 2 | Pro+ | **Not Started** | 0% | Backend | Plaid or SnapTrade OAuth. Multi-brokerage support. Pull current positions, reconcile against manually entered portfolio. User can toggle platform feed to isolate owned assets and competitors. |

### Watchlist — `/menu/watchlist`

| ID | Feature | Phase | Tier | Status | % | Owner | Notes |
|---|---|---|---|---|---|---|---|
| F-15 | Watchlist Management | MVP | Free (5 max) | **In Progress** | 30% | Full Stack | Free: up to 5 names. Pro+: unlimited. Watchlist names highlighted with colored indicator across all boards (earnings, movers, analyst actions, feed). Per-watchlist settings. Multiple watchlists. |
| F-16 | Alert Engine — Core Rules | MVP | Pro+ | **Not Started** | 0% | Backend | In-app + email (Phase 1); SMS + push Phase 2. 12 alert types: (1) earnings results posted, (2) post-earnings move > 5%, (3) analyst upgrade/downgrade, (4) unusual options flagged, (5) block trade above threshold, (6) price move above/below level, (7) volume spike > 3×, (8) 52-week breakout/breakdown, (9) macro event released, (10) peer sympathy move, (11) 13F filing published for tracked fund, (12) industry group enters/exits top 20 RS. Alerts: short, personalized, actionable. User can enable/disable/edit/group per holding or event type. |
| F-38 | Industry Rotation Alerts | Phase 2 | Premium | **Not Started** | 0% | Backend | Detection: industry subgroup dynamically enters or exits top 20 RS rankings. Push + email delivery. Alert names the group and direction. |

### Insider & Institutional — `/menu/insider`

| ID | Feature | Phase | Tier | Status | % | Owner | Notes |
|---|---|---|---|---|---|---|---|
| F-26 | Insider & Institutional — Fund Tracker + Insider Feed | Phase 2 | Premium | **In Progress** | 50% | Backend | Two tabs: (1) Insider activity — Form 4 feed table (ticker/side/role/transaction/value/date), filter by Buys/Sells/10% owners, sort by value or date, most-active chips; (2) 13F institutional — fund cards + AI summary + cross-fund signals. Top 5 most-followed funds. Sources: SEC EDGAR 13F-HR + Form 4. Slug: `insider`. File: `screens/insider.tsx`. UI complete, static data. |
| F-27 | 13F Quarterly Digest & AI Summary | Phase 2 | Premium | **Not Started** | 0% | AI + Backend | Per fund per quarter: new positions, added, trimmed, exited, unchanged. AI summary: what changed overall, biggest new buys/exits with context, theme shift, concentration change, portfolio overlap. |
| F-28 | Cross-Fund Views | Phase 2 | Premium | **Not Started** | 0% | Full Stack | "Most owned across tracked funds" (held by 3+ funds), "Most sold" (exited/trimmed by 3+), "Only one fund owns this" (high-conviction single-fund). Co-Attribution Screener: filter by custom fund group to view shared positions. |
| F-29 | Unusual Options Activity Board | Phase 2 | Premium | **Not Started** | 0% | Full Stack | Rows: ticker, call/put, strike, expiry, premium paid, contract size, total value, volume vs OI ratio, direction flag. Links to Stock Detail. Filters: calls/puts/sweeps only, expiry range, min premium. Powered by Unusual Whales API. |
| F-30 | Block Trades Board | Phase 2 | Premium | **Not Started** | 0% | Full Stack | Rows: ticker, trade value, shares, price, price vs VWAP, time, direction context. Filters: min trade size, sector, session. Links to news, earnings proximity flag, peer activity. Powered by Polygon.io Trades. |

---

## Context

### Recaps — `/menu/recap`

| ID | Feature | Phase | Tier | Status | % | Owner | Notes |
|---|---|---|---|---|---|---|---|
| F-22 | End-of-Day Recap | MVP | Free (read) | **In Progress** | 30% | AI + Backend | Generated within 30 min of market close. Content: index performance, sector heatmap (leaders/laggards), market internals (adv/decl, new highs/lows), key stories (top 3–5), biggest earnings movers, biggest analyst actions, macro events, what's scheduled tomorrow. Delivery: article view in-app, bullets view in-app, 60s audio (Phase 2), email digest. |
| F-23 | Weekly Recap | MVP | Free (read) | **Not Started** | 0% | AI + Backend | Generated Friday evening. Content: index weekly perf, sector winners/laggards, top macro events + impact, biggest earnings stories, most significant analyst actions, weekly top movers (up/down + catalyst), themes, what to watch next week. "This week for my portfolio" tab. Same delivery formats as EOD. |
| F-34 | Audio Recaps (TTS) | Phase 2 | Premium | **Not Started** | 0% | Backend | TTS pipeline: Claude generates 60s audio script from EOD/weekly recap → TTS → MP3 stored in S3 → in-app player. User sets auto-delivery time. |
| F-39 | Social Sharing — Recap Cards | Phase 2 | Pro+ | **Not Started** | 0% | Full Stack | Recap card image generation (Canvas/Puppeteer). Share to Twitter/LinkedIn. Card: branded, key stats (index performance, top mover, date). PDF version available. |

### Macro & VIX — `/menu/macro`

| ID | Feature | Phase | Tier | Status | % | Owner | Notes |
|---|---|---|---|---|---|---|---|
| F-20 | VIX Widget | MVP | Free+ | **Not Started** | 0% | Full Stack | VIX level + day change, 12-month percentile rank, trend direction (rising/falling/flat), plain-English explanation, 30-day sparkline trend. |
| F-21 | Macro Dashboard & Calendar | MVP | Pro+ | **In Progress** | 20% | Full Stack | Macro calendar: upcoming events (CPI, PPI, jobs, FOMC, GDP, retail sales, consumer confidence, housing starts). Columns: event, date, time, importance tier (H/M/L), previous, estimate, actual, market reaction. Market regime label widget: 7 states (Risk-On Rally, Narrow Rally, Defensive Tape, Inflation Scare, Growth Scare, Rate-Sensitive Rally, Risk-Off). Recent macro releases: last 5 events. |

### Stock Detail — `/menu/stock`

| ID | Feature | Phase | Tier | Status | % | Owner | Notes |
|---|---|---|---|---|---|---|---|
| F-17 | Stock Detail Page | MVP | Free+ | **In Progress** | 65% | Full Stack | UI complete: sym selector bar (fbar), sd-head (logo/name/price/actions), sd-grid (chart col + ratings col). Chart card: CandleChart SVG (OHLC, MA20/50, volume, ER marker, hover tooltip) + RsiPane (RSI oscillator). Key stats grid. AI Technical Analysis (tonesegs + 6 ai-line rows). Financials bar chart. TrGauge (5-segment Technical Rating) + indicator table, Peers minirows, Industry Group rank, Earnings history, Insider/Institutional section. Remaining: real API data, interactive zoom, options/block trades sections. |
| F-18 | Peer View | MVP | Pro+ | **Not Started** | 0% | Full Stack | 5–10 closest peers by sector, industry group, business model. Table: ticker, 1D/1W/1M perf, market cap, next earnings date, analyst rating consensus, valuation snapshot. "Who is leading the group" indicator based on recent RS. |
| F-19 | Group View (MarketSurge-style) | MVP | Pro+ | **Not Started** | 0% | Full Stack | Industry group rank vs all groups, trend (improving/deteriorating/flat), strongest/weakest names in group, group-level news + analyst activity. Click group name to open full group page. |
| F-31 | AI Technical Analysis | Phase 2 | Pro+ | **Not Started** | 0% | AI + Full Stack | User selects tone: Short Summary / Swing Trader View / Position Trader View / Long-Term Investor View. Output: trend direction/strength, support/resistance, MA posture (20/50/200-day), RS vs S&P 500 (1mo/3mo), volume behavior (accum vs distrib), breakout/breakdown context, upcoming event risks. Labeled AI-generated, not investment advice. |
| F-41 | Peer RS vs EPS Growth Scatter Matrix | Phase 2 | Pro+ | **Not Started** | 0% | Full Stack | 2D bubble chart: RS (X-axis) vs EPS Growth Rate (Y-axis) for all peers/group members. Spot industry leaders and laggards. Available on Stock Detail + group page. |

---

## Platform & Shell

### Shell & Design System

| ID | Feature | Phase | Tier | Status | % | Owner | Notes |
|---|---|---|---|---|---|---|---|
| F-42 | StockWise Shell & Design System | MVP | All | **Complete** | 100% | Full Stack | IQShell wrapping each page; sidebar nav (3 groups: Intelligence / My Money / Context; 14 screens inc. IPOs + Insider), topbar (StockWise logo gradient + wordmark b=ai color), 6 drawers (stock/earnings/sector/fund/index/feargreed), AI Copilot panel, Cmd+K palette, profile dropdown. IQActionsContext: openStock/openStockFull/openEarnings/openSector/openFund/openIndex/openFearGreed/setCopilot/theme/setTheme. CSS design system (iq.css): CSS custom properties dark/light, layout primitives (.app, .dash, .col-3/4/5/6/7/8/12, .card), component classes (.wmn, .heat, .fundcard, .ai-block, .pill, .tr-badge, .tr-pill, .trseg, .sd-grid, .filt, .dd, etc.). |
| F-44 | User Preferences & Dark Mode | MVP | All | **Complete** | 100% | Full Stack | Dark mode toggle in Settings wired to Firestore `settings/{uid}` (darkMode: boolean). Custom in-app confirmation modal. Theme applied via `data-theme` on `.iq-root`. localStorage fast cache (no flicker on nav). Firestore read on shell mount syncs across devices. |
| F-40 | Cmd+K Command Bar | Phase 2 | Pro+ | **In Progress** | 50% | Full Stack | Cmd+K / Ctrl+K global overlay. Actions: instant ticker lookup + Stock Detail navigation, feed filter, layout switch, jump to any page. Keyboard-first. Contextual suggestions based on current page. |
| F-32 | AI Market Copilot (Chat) | Phase 2 | Premium | **Not Started** | 0% | AI + Full Stack | Chat panel in shell. Access to: live market data, earnings, analyst actions, 13F, macro, portfolio, watchlist. Example prompts: "What matters for my portfolio today?", "Summarize semis earnings this week", "What did Berkshire buy?". Every answer cites source modules (clickable). Streaming SSE. Labeled informational, not investment advice. |
| F-24 | Learn in 60 Seconds | MVP | Free+ | **Not Started** | 0% | Full Stack | Contextual educational micro-cards triggered by page landing. Examples: 13F page → "What is a 13F?"; earnings detail → "Why guidance matters more than EPS"; VIX widget → "What VIX levels mean". Each card: < 60 sec to read, one real example. Dismiss permanently or save to learning library. |

### Subscription & Billing

| ID | Feature | Phase | Tier | Status | % | Owner | Notes |
|---|---|---|---|---|---|---|---|
| F-25 | Subscription & Billing (Stripe) | MVP | N/A | **In Progress** | 15% | Full Stack | Stripe integration. Free: delayed data, limited movers, recap read-only, watchlist 5 max, no AI. Pro: real-time data, full movers, AI earnings summaries, AI TA, analyst actions, portfolio/watchlist with alerts, macro, VIX, EOD/weekly recap. Premium: everything Pro + 13F, unusual options, block trades, AI Copilot, audio recaps, expanded alerts, industry rotation alerts, weekly deep recap. Upgrade flow: tier comparison page, Stripe checkout, feature gating at API middleware. |

### Mobile & Platform Expansion

| ID | Feature | Phase | Tier | Status | % | Owner | Notes |
|---|---|---|---|---|---|---|---|
| F-36 | Mobile App (React Native) | Phase 2 | Pro+ | **Not Started** | 0% | Mobile | React Native. Bottom tab nav: Dashboard / Earnings / Movers / Portfolio / Alerts. Push notifications for all alert types. Condensed mobile-optimized views. Shared API layer with web. Offline state handling. |

---

## Phase Summary

| Phase | Total Features | Complete | In Progress | Target |
|---|---|---|---|---|
| MVP (Phase 1) | 29 | 5 (F-42, F-43, F-44, F-46, F-47) | 9 (F-01, F-02, F-07, F-10, F-12, F-13, F-15, F-21, F-22, F-25, F-45) | Week 18 |
| Phase 2 | 17 (+F-26 UI) | 0 | 1 (F-40) | Week 38 |
| **Total** | **46** | **5** | **10** | — |

## Status Legend

| Status | Meaning |
|---|---|
| Not Started | Work has not begun |
| In Progress | Actively in development (UI built with static data counts) |
| In Review | Dev complete; in QA or stakeholder review |
| Complete | Deployed and accepted |
