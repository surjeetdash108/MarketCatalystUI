# StockWise — Task Tracker
v1.3 | June 2026

**Status:** Not Started | In Progress | In Review | Done  
**Priority:** P0 = MVP blocker | P1 = high quality | P2 = nice to have  
**Est.** = engineering days estimate

---

## Infrastructure & Data

### Core Infrastructure

| ID | Task | Type | Est. | Pri | Assignee | Sprint | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| T-001 | Set up AWS VPC, subnets, security groups, IAM roles for ECS, Redis, S3 | Infra | 2d | P0 | Infra Eng | S-01 | Not Started | Multi-AZ setup, public + private subnets; no RDS needed (Firestore is Google-managed) |
| T-002 | Set up Firebase project: enable Firestore (Native mode), configure Firebase service account key, add to AWS Secrets Manager, set environment variables for all ECS services | Infra | 0.5d | P0 | Infra Eng | S-01 | Not Started | Enable Firestore in us-east1 region; store service account JSON in Secrets Manager; verify Admin SDK connectivity from api-service |
| T-003 | Provision ElastiCache Redis with Multi-AZ failover, configure AUTH token | Infra | 0.5d | P0 | Infra Eng | S-01 | Not Started | BullMQ + pub/sub + cache workloads |
| T-004 | Set up ClickHouse EC2 instance (r6i.2xlarge), configure ReplacingMergeTree for quotes | Infra | 1d | P0 | Backend | S-01 | Not Started | Partition by date; expose internal query microservice |
| T-005 | Configure ECS cluster, task definitions for api-service + websocket-service + workers | Infra | 1d | P0 | Infra Eng | S-01 | Not Started | Auto-scaling policies CPU > 60% |
| T-006 | Set up CI/CD pipeline (GitHub Actions): lint → test → build → push ECR → deploy ECS | Infra | 1d | P0 | Infra Eng | S-01 | Not Started | Separate pipelines for api, ws, workers, frontend |
| T-009 | Design Firestore collection schema and security rules (users, portfolios, watchlists, alerts, notifications); define composite indexes | Backend | 2d | P0 | Backend | S-01 | Not Started | Collections: users/{uid}, users/{uid}/portfolios, users/{uid}/watchlists, users/{uid}/alerts, users/{uid}/notifications; define firestore.rules + firestore.indexes.json; soft deletes via deletedAt field |
| T-010 | Set up Stripe account, create Free/Pro/Premium products + prices, webhook endpoint | Backend | 1d | P1 | Backend | S-02 | Not Started | Webhook: checkout.completed, subscription.updated, cancelled |
| T-079 | Migrate state management from Zustand+React Query to Redux Toolkit. Implement auth-slice, profile-slice, FirebaseListener, ReduxProvider, typed hooks. | Frontend | 2d | P0 | FE Eng 1 | S-02 | **Done** | store.ts + auth-slice.ts + profile-slice.ts + firebase-listener.tsx + hooks.ts. FirebaseListener uses authStateReady() before subscribing to avoid stale initial state. |
| T-080 | Replace Vite + React SPA with Next.js 14 App Router (static export). Configure next.config.ts with output: 'export'. Set up Firebase Hosting (firebase.json, .firebaserc). Migrate routing to App Router conventions. | Infra | 2d | P0 | Infra Eng | S-01 | **Done** | Project: fin-app26. Deploy: firebase deploy --only hosting. All routes rewrite to index.html for SPA navigation. |
| T-093 | Add Firestore settings/{uid} security rule (read/write: isOwner). Deploy firestore.rules via firebase deploy --only firestore:rules. | Infra | 0.5d | P0 | Infra Eng | S-03 | **Done** | firestore.rules updated. Rule: match /settings/{uid} { allow read, write: if isOwner(uid); } |

### Data Ingestion

| ID | Task | Type | Est. | Pri | Assignee | Sprint | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| T-011 | Integrate Polygon.io WebSocket for real-time quotes; write to Redis quote cache (TTL 5s) | Backend | 2d | P0 | Backend | S-02 | Not Started | Reconnect logic; dead-letter on 3 failures |
| T-012 | Integrate Polygon.io REST for OHLCV historical data; write to ClickHouse | Backend | 2d | P0 | Backend | S-02 | Not Started | Backfill last 2 years on first run |
| T-013 | Integrate Benzinga News WebSocket + REST; normalize to internal schema; pub/sub publish | Backend | 2d | P0 | Backend | S-02 | Not Started | Category tagging: Macro, Earnings, Analyst, Story |
| T-014 | Integrate FMP Earnings Calendar API; 15-min sync worker; upsert earnings_events table | Backend | 1d | P0 | Backend | S-02 | Not Started | Include EPS/Revenue actuals on result post |
| T-015 | Integrate Benzinga Analyst Actions API (5-min poll); normalize ratings + price targets | Backend | 1d | P0 | Backend | S-02 | Not Started | Store old rating, new rating, old PT, new PT, firm |
| T-016 | Integrate Finnhub Economic Calendar; daily sync at 6am ET; macro_events table | Backend | 1d | P1 | Backend | S-03 | Not Started | Importance tier classification (H/M/L) |
| T-017 | Build EDGAR 13F-HR parser: nightly job to detect new filings, parse XML, load fund_holdings | Backend | 3d | P0 | Backend | S-10 | Not Started | Phase 2; handle amended filings (13F-HR/A) |
| T-018 | Integrate Unusual Whales API for options flow; real-time WebSocket + normalize | Backend | 2d | P0 | Backend | S-11 | Not Started | Phase 2; flag bullish/bearish/unclear by call/put + OTM |
| T-019 | Integrate Polygon.io Trades for block trade detection; threshold filter + store | Backend | 1d | P1 | Backend | S-11 | Not Started | Phase 2; block = single trade > $500k or 10k shares |

---

## Pre-App

### Landing Page — `/`

| ID | Task | Type | Est. | Pri | Assignee | Sprint | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| T-102 | F-47 | Build StockWise marketing landing page: animated dark background, hw-nav/hero/commit/steps/tabs-sec/final sections, scroll-reveal via IntersectionObserver, inline login modal (lp-modal-backdrop/lp-modal-card), CSS in app/landing.css | Frontend | 3d | P0 | FE Eng 1 | S-02 | **Done** | `app/page.tsx` + `app/landing.css`. hw-* CSS structure matching whyticker.html reference. Login modal: LoginForm inside glassmorphism card overlay, ✕ + Escape to close, logo button closes modal (no navigation). gradShift/hwFloat/hwSheen/hwShine/spPan animations all present. |

### Auth Pages — `/auth/*`

| ID | Task | Type | Est. | Pri | Assignee | Sprint | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| T-007 | Configure Firebase Authentication: enable email/password + Google OAuth providers, set up Firebase Admin SDK, configure authorized domains | Auth | 0.5d | P0 | Backend | S-01 | Not Started | Enable auth providers in Firebase console; add service account to Secrets Manager; verify token issuance end-to-end |
| T-008 | Implement Firebase Admin SDK middleware in Fastify API: verify Firebase ID tokens on all /api/v1/* routes, extract userId and subscription tier from Firestore user document | Backend | 1d | P0 | Backend | S-01 | Not Started | Middleware calls admin.auth().verifyIdToken(); subscription tier read from Firestore users/{uid}.tier field; attach to request context |
| T-081 | Redesign auth pages (Login, Create Account, Forgot Password) to match InvestIQ dark theme. Two-panel layout (AuthLayout): left = form, right = brand panel with stat cards + feature bullets. All styling via CSS variable inline styles. | Frontend | 2d | P0 | FE Eng 1 | S-02 | **Done** | auth-layout.tsx + login-form.tsx + signup-form.tsx + forgot-form.tsx. Removed all Tailwind from auth forms. |
| T-103 | F-43 | Fix auth routing: (1) modal logo → button calling setShowLogin(false) instead of Link href="/", (2) signup-form "Sign in" → href="/" instead of /auth/login, (3) forgot-form "Back to sign in" → href="/" instead of /auth/login, (4) remove old card wrapper from forgot-form (was double-nested inside AuthLayout's glassmorphism card) | Frontend | 0.5d | P0 | FE Eng 1 | S-02 | **Done** | All auth pages now return to / (landing) instead of navigating to /auth/login. Modal logo closes the modal without re-navigating the page. |

---

## Intelligence

### Dashboard — `/dashboard`

| ID | Task | Type | Est. | Pri | Assignee | Sprint | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| T-020 | Build Market Pulse strip component: S&P, Nasdaq, Dow, Russell, VIX, yields, crude, gold, DXY, BTC | Frontend | 2d | P0 | FE Eng 1 | S-03 | Not Started | Color-coded, real-time via WebSocket, clickable to detail |
| T-021 | Build session filter tabs (Today/Premarket/Live/AH/This Week/My Portfolio) — removed from dashboard header per design decision | Frontend | 0d | P0 | FE Eng 1 | S-03 | **Done** | Session tabs removed from Dashboard header. Only "✦ AI Summary" button remains. |
| T-022 | Build drag-and-drop widget grid (react-grid-layout); save/restore layout per user | Frontend | 2d | P0 | FE Eng 2 | S-03 | Not Started | Available widgets: 8 types; default layout for new users |
| T-023 | Build 'What Matters Now' AI summary card component with auto-refresh | Frontend | 1d | P0 | FE Eng 1 | S-04 | Not Started | Polling every 5 min; skeleton loader while generating |
| T-024 | Backend: generate 'What Matters Now' summary via Claude API (macro + portfolio context) | Backend | 2d | P0 | Backend | S-04 | Not Started | BullMQ queue; update every 10 min during market hours |
| T-047 | Build Live Market Feed: categorized cards, WebSocket subscription, feed filter tabs | Frontend | 3d | P0 | FE Eng 2 | S-03 | Not Started | Pin item; mark as read; Why It Matters line on each card |
| T-048 | Backend: WebSocket gateway — Redis pub/sub → fan-out to subscribed clients by channel | Backend | 2d | P0 | Backend | S-02 | Not Started | Reconnect with state sync; session filter by portfolio |
| T-060 | Backend: Before the Bell briefing pipeline — 8:30am ET cron; Claude summarizes futures, overnight news, macro events, BMO earnings | Backend | 1.5d | P0 | Backend | S-04 | Not Started | Delivered in-app feed + email; reuses BullMQ worker pattern |
| T-061 | Backend: After the Close briefing pipeline — 30 min post-close cron; Claude summarizes final performance, top stories, next-day preview | Backend | 1.5d | P0 | Backend | S-04 | Not Started | Delivered in-app feed + email; store as daily briefing record |
| T-084 | Build Dashboard screen: WMN block, Market Pulse strip, sector heatmap widget, top movers, portfolio summary, watchlist, earnings today widgets. | Frontend | 2d | P0 | FE Eng 1 | S-04 | **Done** | screens/dashboard.tsx. Static data from data.ts. openStock/openEarnings via IQActionsContext. |
| T-097 | Extend IQShell drawers: add IndexDrawer (openIndex) and FearGreedDrawer (openFearGreed). IndexDrawer shows OHLC values, ranges, AI note, leading/lagging sectors for equity indices. FearGreedDrawer shows SemiGauge, historical metric grid, 7-component progress bars, AI read note. Extend drawer union type and IQActionsContext interface. | Frontend | 1d | P0 | FE Eng 1 | S-08 | **Done** | shell.tsx. IQActionsContext: openIndex(i: number) + openFearGreed(). Drawer union: + { type: "index"; idx: number } + { type: "feargreed" }. Wired to pulse cards and F&G widget. |
| T-098 | Rewrite Dashboard to HTML-parity layout: col-12 pulse strip (pmeta O/PC, clickable openIndex), col-4×3 (Portfolio Pulse/Watchlist/Heatmap mini), col-8 (WMN + Live Feed stacked), col-4 flex-col (VIX/F&G/Earnings/Analyst/Movers). Portfolio mid shows size·conv. Watchlist mid shows opt pill + ER date. Heatmap mini uses heatCol() for bg and text. F&G card opens openFearGreed(). | Frontend | 1d | P0 | FE Eng 1 | S-04 | **Done** | screens/dashboard.tsx. Complete layout rewrite matching HTML reference. Uses .col-4/.col-8 CSS grid classes, not inline grids. |
| T-104 | Replace right-side sliding drawer with centered modal/popover across all screens. Update `.drawer` CSS: position:fixed; inset:0; margin:auto; width:min(700px,96vw); max-height:min(88vh,860px); border-radius:16px; z-index:51; animation: iq-popIn .22s cubic-bezier(.34,1.18,.64,1). Add @keyframes iq-popIn. | Frontend | 0.5d | P0 | FE Eng 1 | S-08 | **Done** | app/iq.css. All drawer/modal UIs now use centered popover pattern. Sessions tabs also removed from dashboard header. |
| T-105 | Dashboard Market Movers widget: add Winners/Losers tabs (mvTab state), 15-row scrollable list, `.mv-dash-row` hover popup with Technical/News tabs (`:has(.mvt-n:hover)` CSS switching), sector filter select, market cap filter select. Compute mvSectors from movers data. | Frontend | 1d | P0 | FE Eng 1 | S-08 | **Done** | screens/dashboard.tsx + app/iq.css. Widget is col-4. Winners tab shows gainers sorted by pct, Losers tab shows losers. Popup shows 2 tabs via CSS :has selector. |
| T-106 | Dashboard Market Movers filter: add `mvSector` + `mvCap` state, two compact `<select>` dropdowns in card header. Filter `movers` array before rendering winner/loser lists. Compute `mvSectors` from unique movers sectors. | Frontend | 0.5d | P1 | FE Eng 1 | S-08 | **Done** | screens/dashboard.tsx. Sector and market cap filters work on the compact dashboard widget. |
| T-107 | Dashboard Trending Stocks widget: add col-12 row at bottom of grid. Inline `computeTrending()` cross-references movers (pct > 2%), analyst (upgrades), earnings (upcoming < 7d). Score: 2pts per move, 3pts per analyst upgrade, 2pts per upcoming ER. Render as horizontal scrollable pill row or compact table. | Frontend | 0.5d | P1 | FE Eng 1 | S-08 | **Done** | screens/dashboard.tsx. Trending score displayed with trend indicator + catalyst pills. |

### Earnings — `/menu/earnings`

| ID | Task | Type | Est. | Pri | Assignee | Sprint | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| T-025 | Build Earnings Calendar page: Today/Tomorrow/This Week/Next Week/Custom tabs | Frontend | 2d | P0 | FE Eng 2 | S-04 | Not Started | Default to Today view; persist last-used tab |
| T-026 | Build earnings data table component: sortable columns, tag pills, portfolio highlight, expand-on-click | Frontend | 3d | P0 | FE Eng 1 | S-04 | Not Started | Tag pills: Beats EPS, Misses Rev, Raises Guide, etc. |
| T-027 | Backend API: GET /api/v1/earnings?date=&session=&sector=&... — paginated, filter support | Backend | 2d | P0 | Backend | S-04 | Not Started | Join earnings_events + latest AI summary + portfolio flag |
| T-028 | Build Earnings Detail right-side drawer component (70% width desktop, full mobile) | Frontend | 3d | P0 | FE Eng 2 | S-05 | Not Started | Tabs: Summary, Transcript, Audio, News, Peers |
| T-029 | Build EPS/Revenue 8-quarter history chart (Recharts bar + line combo) | Frontend | 1.5d | P0 | FE Eng 1 | S-05 | Not Started | Overlay actual vs estimate; color beat/miss bars |
| T-030 | Backend API: GET /api/v1/earnings/:ticker/detail — full earnings detail endpoint | Backend | 1d | P0 | Backend | S-05 | Not Started | Includes peer reactions, guidance summary, transcript URL |
| T-031 | AI worker: on earnings_events.result_posted event, fetch transcript, call Claude, store summary | Backend | 3d | P0 | Backend | S-05 | Not Started | Structured output: beat/miss, guidance, tone, risks, takeaway |
| T-032 | Build AI Earnings Summary UI card: tone badge, confidence label, source link, disclaimer | Frontend | 1.5d | P0 | FE Eng 1 | S-06 | Not Started | Bullish/Cautious/Neutral/Mixed badge with color |
| T-058 | Build Earnings Setup Card: implied move (from options), last 4 earnings reactions, analyst sentiment trend (30 days), peer performance pre-announcement, key questions for quarter | Frontend | 2d | P0 | FE Eng 1 | S-05 | Not Started | Show on each scheduled earnings row before results are posted |
| T-059 | Build Earnings Movers Board: post-earnings moves table with ticker, % reaction, direction, beat/miss verdict, guidance status, sector, portfolio flag | Frontend | 1.5d | P0 | FE Eng 2 | S-06 | Not Started | Sorted by absolute move size; auto-updates as results come in |
| T-072 | Build Earnings Call Audio Player: compact player in earnings detail drawer (play/pause, timestamp seek, speed control), sourced from Intrinio or equivalent | Frontend | 1.5d | P1 | FE Eng 1 | S-14 | Not Started | Phase 2; show player only when recording URL is available; reuse for recap audio (T-071) |
| T-108 | Fix earnings layout: change both card wrappers from col-7 to col-6 (6+6=12 fits grid). Add inline detail panel below calendar: when selEarning is set, show card with logo, name, sector, timing pill, 4-metric grid (EPS est, EPS actual, guidance, reaction/implied), aiRead paragraph. Uses existing selEarning state and aiRead string. | Frontend | 0.5d | P0 | FE Eng 1 | S-08 | **Done** | screens/earnings.tsx. Both col-7→col-6. Inline panel renders between {calNode} and EPS history. No new state needed — reuses existing selEarning + aiRead. |

### Market Movers — `/menu/movers`

| ID | Task | Type | Est. | Pri | Assignee | Sprint | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| T-033 | Build Market Movers page: Gainers/Losers/Volume/Gap Up/Gap Down/High RVol/LargeCap/Weekly tabs | Frontend | 2d | P0 | FE Eng 2 | S-06 | Not Started | Filter bar: index, sector, cap, price, session |
| T-034 | Build mover card component: ticker, %, $, RVol ratio, catalyst pill, peer reactions, MA context | Frontend | 2d | P0 | FE Eng 1 | S-06 | Not Started | Watchlist/portfolio badge on cards |
| T-035 | Backend: movers calculation job — runs every minute during market hours, caches in Redis | Backend | 2d | P0 | Backend | S-06 | Not Started | Calculate vol ratio vs 30-day avg from ClickHouse |
| T-062 | Build Weekly Movers page: top 10 up and top 10 down for the week, each with short catalyst explanation; published Friday, available through weekend | Frontend | 1.5d | P1 | FE Eng 1 | S-06 | Not Started | Reuses mover card component from F-10; weekly period aggregation from ClickHouse |
| T-091 | Build Movers screen: Gainers/Losers/Volume/Gap Up/Gap Down/High RVol view tabs, mover rows with RVOL ratio, catalyst pill. | Frontend | 1d | P0 | FE Eng 2 | S-06 | **Done** | screens/movers.tsx. |

### Market Heatmap — `/menu/heatmap`

| ID | Task | Type | Est. | Pri | Assignee | Sprint | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| T-099 | Fix heatmap treemap tile text color: replace hardcoded white with heatCol(chg).fg for dynamic dark/light text matching HTML. Remove local hmColor() function; import heatCol from utils.tsx. | Frontend | 0.5d | P1 | FE Eng 1 | S-06 | **Done** | screens/heatmap.tsx. heatCol().fg applied to both sym ticker span and chg span in each tm-cell. Matches HTML heatmap tile text behavior exactly. |

### Analyst Actions — `/menu/analyst`

| ID | Task | Type | Est. | Pri | Assignee | Sprint | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| T-036 | Build Analyst Actions board: real-time table with direction arrows, AI note, portfolio filter | Frontend | 2d | P0 | FE Eng 2 | S-07 | Not Started | Color: green for upgrade, red for downgrade |
| T-037 | Backend: AI note generation for each analyst action via Claude (async, BullMQ) | Backend | 1.5d | P1 | Backend | S-07 | Not Started | Consider: target change size, firm importance, trend direction |
| T-090 | Build Analyst Actions screen: table with direction arrows, firm, rating change, PT change, action pills. | Frontend | 1d | P0 | FE Eng 2 | S-07 | **Done** | screens/analyst.tsx. |
| T-109 | Add analyst flags to Analyst screen: computeFlags() counts actions per ticker from data.analyst; stocks ≥5 actions get a flag card. Add topUpgrades: sort data.analyst by n30/react, take top 3 upgrades. Add CRM (6 entries) + NVDA (5 entries) to data.analyst to demonstrate flag detection. Replace static signal cards with dynamic maps. | Frontend | 0.5d | P1 | FE Eng 1 | S-08 | **Done** | screens/analyst.tsx + app/iq/data.ts. computeFlags() counts per ticker; flag card shows firm list split by upgrades/downgrades. topUpgrades picks top 3 by n30 desc + react desc. |

### Screener — `/menu/screener`

| ID | Task | Type | Est. | Pri | Assignee | Sprint | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| T-083 | Build Stock Screener screen: left checkbox filter panel (9 filters), 20 named presets (dropdown + browse overlay with click-outside), results table (RS color-coded, Tech Rating badge), preset apply/reset logic. | Frontend | 3d | P0 | FE Eng 2 | S-05 | **Done** | screener.tsx. applyPreset() resets all checkboxes then sets from preset's filter object. Filter logic stacks preset + checkbox rules. CheckOpt component for styled checkbox inputs. |

### IPOs — `/menu/ipos`

| ID | Task | Type | Est. | Pri | Assignee | Sprint | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| T-100 | Build IPOs screen: stats strip (above-offer count, best performer, median return), tabs (Recent performance / Upcoming pipeline), IPO performance table (8 recent names with Day 1 + Since IPO return columns), pipeline table (4 expected names). | Frontend | 1d | P0 | FE Eng 1 | S-05 | **Done** | screens/ipos.tsx. Static data. Slug: ipos. Added to menu-items.ts + menu/[slug]/page.tsx. |

### Commentary — `/menu/commentary`

| ID | Task | Type | Est. | Pri | Assignee | Sprint | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| T-088 | Build Commentary screen: Live/Premarket/After Hours/My names/Macro tabs, live feed with cat pill + dangerouslySetInnerHTML text + Why it matters annotation, Before Bell / After Close sidebar cards. | Frontend | 1.5d | P0 | FE Eng 2 | S-03 | **Done** | screens/commentary.tsx. CommentaryItem interface: cat/accent/time/text/why fields. |
| T-116 | Implement Commentary tab filtering: (1) PREMARKET array (6 items: Futures, Macro, Earnings, Analyst, Overnight, Pre-open); (2) AFTERHOURS array (6 items: Earnings, AH moves, Macro close, AMC reporters); (3) Live tab shows all commentary; (4) My names tab filters commentary.text for portfolio+watchlist symbol HTML tags + renders tracked-names chip row; (5) Macro tab filters to Macro/Fed-Rates categories; (6) FeedItem extracted as shared component; (7) feedLabel dynamically sets title + badge per tab. | Frontend | 0.5d | P1 | FE Eng 1 | S-09 | **Done** | screens/commentary.tsx. mySymbols = union of watch + folio tickers. Tab badge changes per active tab. "My names" card shows all tracked chips below the feed. |

---

## My Money

### Portfolio Pulse — `/menu/portfolio`

| ID | Task | Type | Est. | Pri | Assignee | Sprint | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| T-038 | Build Portfolio creation and management UI: add/edit/delete holdings, cost basis, conviction | Frontend | 2d | P0 | FE Eng 1 | S-07 | Not Started | Per-holding: next earnings, last analyst action, news headline |
| T-039 | Backend: Portfolio Pulse Card generation via Claude each morning at 7am ET | Backend | 2d | P0 | Backend | S-07 | Not Started | Summarize overnight events for each held ticker |
| T-073 | Backend: Broker import via Plaid/SnapTrade OAuth — multi-brokerage support, position sync, reconcile against manually entered portfolio, auto-refresh on schedule | Backend | 3d | P1 | Backend | S-16 | Not Started | Phase 2; handle position mismatches; merge duplicate holdings; user confirms reconciliation |
| T-085 | Build Portfolio screen: AI pulse block, holdings table (conviction pill, size pill, event column), alerts sidebar. | Frontend | 1.5d | P0 | FE Eng 1 | S-07 | **Done** | screens/portfolio.tsx. FolioItem interface: s/n/p/c/gl/size/conv/evt fields. |
| T-110 | Extend Portfolio screen with AI summary + CRUD: (1) Add useState<FolioItem[]> seeded from folioData; (2) Add Holding modal (ticker/size/conviction inputs, addHolding() function); (3) Sell dialog (partialSell: reduce size+gl*0.5, removeHolding: filter out); (4) Dynamic AI summary grid computing drivers/laggards/leaders from holdings state. Fix TS error: change {folio.length} → {holdings.length}. | Frontend | 1d | P0 | FE Eng 1 | S-08 | **Done** | screens/portfolio.tsx. drivers = top 2 by gl desc. laggards = bottom 2 by gl asc. leaders = top 2 by c desc. Each section clickable openStock(). Holdings table rows have Sell + Remove buttons. |

### Watchlist — `/menu/watchlist`

| ID | Task | Type | Est. | Pri | Assignee | Sprint | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| T-040 | Build alert rule builder modal: event type selector, threshold inputs, delivery channel toggle | Frontend | 2d | P0 | FE Eng 2 | S-08 | Not Started | 12 alert types; save to user_alerts table |
| T-041 | Backend: alert engine — Redis pub/sub event listener; evaluate rules; BullMQ dispatch | Backend | 3d | P0 | Backend | S-08 | Not Started | SendGrid for email; in-app via user_notifications table |
| T-063 | Build Watchlist management UI: add/remove tickers, 5-name limit for Free (enforced), unlimited for Pro+, multiple watchlists, colored indicators across all boards | Frontend | 1d | P0 | FE Eng 2 | S-07 | Not Started | Watchlist chip component shown on every ticker row across the platform |
| T-086 | Build Watchlist screen: filter tabs (All/Reporting this week/Options active/Movers today), table with ER/analyst/options/headline/spark columns. | Frontend | 1.5d | P0 | FE Eng 2 | S-07 | **Done** | screens/watchlist.tsx. WatchItem interface: s/n/px/c/er/analyst/opt/headline fields. |
| T-111 | Extend Watchlist with AI alerts column + per-stock AI toggle: (1) import analyst from data; (2) add aiOn: Record<string, boolean> state (all true by default); (3) toggleAi(sym) flips aiOn[sym]; (4) alerts(sym) checks data.movers pct > 3% and data.analyst upgrades for that ticker; (5) add Alerts column (price move pill + analyst upgrade pill); (6) add AI column with chip toggle button per row. | Frontend | 0.5d | P1 | FE Eng 1 | S-08 | **Done** | screens/watchlist.tsx. Alerts computed from existing mock data. AI toggle is purely front-end state for now. |
| T-115 | Rewrite Watchlist as Google Finance two-panel layout: left panel (280px, `.wl-left`, filter chips, `.wl-items` scrollable list with sparklines), right panel (`.wl-right`, breadcrumb, company header, price+day change block, chart area with `bigChartSVG()`+period selector+toolbar, tab bar Overview/Earnings/Analyst/Financials, metrics table `.wl-metrics-tbl`). Append `.wl-*` CSS to `app/iq.css`. | Frontend | 1.5d | P1 | FE Eng 1 | S-09 | **Done** | screens/watchlist.tsx + app/iq.css. bigChartSVG() generates 800×160 area chart SVG seeded from charCodeAt. Replaces old alert-column table layout. |

### Insider & Institutional — `/menu/insider`

| ID | Task | Type | Est. | Pri | Assignee | Sprint | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| T-052 | Backend: EDGAR 13F ingestion worker; parse XML; compare to prior quarter; flag changes | Backend | 3d | P0 | Backend | S-12 | Not Started | Phase 2; detect new/added/trimmed/exited/unchanged |
| T-053 | AI worker: generate 13F summary per fund per quarter via Claude on new filing ingest | Backend | 2d | P0 | Backend | S-12 | Not Started | Phase 2; theme shift, concentration change, portfolio overlap |
| T-066 | Build Cross-Fund Views: most owned across tracked funds, most sold across tracked funds, single-fund high-conviction positions; Co-Attribution Screener filter | Frontend | 2d | P0 | FE Eng 1 | S-12 | Not Started | Phase 2; Co-Attribution Screener lets user select custom fund group and view shared positions |
| T-067 | Build Unusual Options Activity board UI: row display (ticker, call/put, strike, expiry, premium, contract size, total value, vol/OI ratio, direction flag), filters, stock detail links | Frontend | 2d | P0 | FE Eng 2 | S-11 | Not Started | Phase 2; data powered by T-018 (Unusual Whales ingest); filters: calls/puts/sweeps only, expiry range, min premium |
| T-068 | Build Block Trades Board UI: rows (ticker, trade value, shares, price, VWAP comparison, time, direction context), sector/size filters, news and peer activity links | Frontend | 1.5d | P1 | FE Eng 1 | S-11 | Not Started | Phase 2; data powered by T-019 (Polygon block trade ingest) |
| T-087 | Build 13F Intelligence screen (now folded into Insider & Institutional): fund cards (.fundcard/.av/.nm/.mgr), active fund AI summary (6 ai-sec blocks), cross-ownership tables (cross-owned/cross-sold/lone positions). | Frontend | 2d | P0 | FE Eng 1 | S-12 | **Done** | Migrated to screens/insider.tsx (13F tab). screens/thirteenf.tsx retained but slug changed to `insider` in routing. Fund interface: name/av/mgr/aum/pos/top1/newPos/exits/quarter fields. |
| T-101 | Build Insider & Institutional screen: tabbed (Insider activity / 13F institutional), Insider tab has Form 4 feed table + most-active chips + filter/sort bar, 13F tab is existing fund cards + AI summary + cross-fund signals. | Frontend | 2d | P0 | FE Eng 1 | S-07 | **Done** | screens/insider.tsx (replaces thirteenf.tsx). Slug renamed from thirteenf → insider. Updated menu-items.ts + menu/[slug]/page.tsx. |

---

## Context

### Recaps — `/menu/recap`

| ID | Task | Type | Est. | Pri | Assignee | Sprint | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| T-049 | Backend: EOD recap generation cron (4:30pm ET); Claude summarizes structured daily data | Backend | 2d | P0 | Backend | S-10 | Not Started | Store as recap record; trigger email dispatch job |
| T-050 | Build EOD Recap page: article view + bullets view toggle; email digest opt-in settings | Frontend | 1.5d | P0 | FE Eng 1 | S-10 | Not Started | Delivery time preference in user settings |
| T-051 | Backend: Weekly recap generation cron (Friday 6pm ET); portfolio tab as separate Claude call | Backend | 2d | P0 | Backend | S-10 | Not Started | Reuse EOD recap components; portfolio tab scoped to user |
| T-071 | Backend: Audio recap TTS pipeline — Claude generates 60-second script from EOD/weekly recap content, TTS converts to MP3, uploads to S3, notifies in-app player | Backend | 2d | P1 | Backend | S-14 | Not Started | Phase 2; reuse recap_generation BullMQ queue; add audio delivery channel to recap record |
| T-075 | Build Social Sharing: recap card image generation (Canvas/Puppeteer), share-to-Twitter and share-to-LinkedIn buttons, branded card format with key stats | Frontend | 1.5d | P2 | FE Eng 2 | S-17 | Not Started | Phase 2; card includes: index performance, top mover, date, platform branding |
| T-089 | Build Recap screen: recap-hero (WMN orb + headline + indices + stories/up-next), sector heatmap (.heat grid with inline background), movers + internals columns. | Frontend | 1.5d | P0 | FE Eng 1 | S-10 | **Done** | screens/recap.tsx. RecapData interface + heatColor() helper. PDF download buttons. |
| T-117 | Implement Recap "This Week" tab: (1) static WEEKLY object (range, headline, 4 index returns, topStories[], sectorLeaders[], sectorLaggards[], biggestMoves[], nextWeek[]); (2) conditional render — activeTab===0 shows EOD block, activeTab===1 shows WEEKLY block; (3) weekly hero with indices + audio + PDF downloads; (4) top stories + next week (2-col), sector leaders/laggards/biggest moves (3-col), weekly sector heatmap. Dynamic page-title/sub in page-head. | Frontend | 0.5d | P1 | FE Eng 1 | S-09 | **Done** | screens/recap.tsx. WEEKLY constant added above RecapScreen function. Both tabs share page-head + padding wrapper. |
| T-118 | Add AI Pulse card to Portfolio screen: renders static PULSE string array as bullet-note list inside `.card` block (placed between AI Summary WMN block and Holdings table). Each note is a plain-English insight per holding. Disclaimer footer: AI-generated · informational only. | Frontend | 0.5d | P1 | FE Eng 1 | S-09 | **Done** | screens/portfolio.tsx. PULSE array was already defined but unused. Now rendered in col-8 left column. |

### Macro & VIX — `/menu/macro`

| ID | Task | Type | Est. | Pri | Assignee | Sprint | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| T-045 | Build VIX widget: level, 12-month percentile rank, trend indicator, plain-English label | Frontend | 1d | P1 | FE Eng 2 | S-09 | Not Started | Update every 5 min; sparkline for 30-day trend |
| T-046 | Build Macro Calendar page: upcoming + recent events table, importance tiers, actuals vs estimates | Frontend | 1.5d | P1 | FE Eng 1 | S-09 | Not Started | Market regime label widget (Risk-On/Off/etc.) |
| T-092 | Build Macro screen: macro calendar table, market regime widget, VIX section. | Frontend | 1d | P1 | FE Eng 1 | S-09 | **Done** | screens/macro.tsx. |
| T-113 | Expand Macro screen to full 3-week economic calendar: (1) define MacroEvent interface {event,date,time,impact,prior,est,actual,surprise,note}; (2) create CAL_LAST/CAL_THIS/CAL_NEXT arrays with 5+ events each; (3) events include CPI, PPI, Retail Sales, FOMC Decision, FOMC Press Conference, Jobless Claims, Philadelphia Fed, Existing Home Sales, GDP, PCE Deflator, Consumer Confidence, Durable Goods, Chicago PMI; (4) add week tab selector (Last Week / This Week / Next Week); (5) 8-column table with surprise color coding. | Frontend | 0.5d | P1 | FE Eng 1 | S-08 | **Done** | screens/macro.tsx. MacroEvent interface. 3 calendar arrays. 8-column table renders all arrays. Impact pill: H=down, M=warn, L=hold color. Surprise column green/red coded. |

### Stock Detail — `/menu/stock`

| ID | Task | Type | Est. | Pri | Assignee | Sprint | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| T-042 | Build Stock Detail page: interactive chart with Recharts, earnings events + analyst actions overlaid | Frontend | 3d | P0 | FE Eng 1 | S-08 | Not Started | Time ranges: 1D/1W/1M/3M/6M/1Y/3Y; volume subplot |
| T-043 | Build Peer View component: peer table with 1D/1W/1M perf, market cap, next earnings, rating | Frontend | 1.5d | P1 | FE Eng 2 | S-09 | Not Started | Leader indicator based on 1-month RS |
| T-044 | Build Group View component: group rank, trend, strongest/weakest names, group-level news | Frontend | 2d | P1 | FE Eng 1 | S-09 | Not Started | Click group name to open full group page |
| T-057 | Backend: AI Technical Analysis endpoint — OHLCV + indicators → Claude → structured TA output | Backend | 2d | P0 | Backend | S-13 | Not Started | Phase 2; 4 tones: Summary/Swing/Position/LT Investor |
| T-094 | Build CandleChart SVG component: deterministic OHLC generation (seeded RNG matching HTML genOHLC algorithm), candlestick wicks, MA20/MA50 overlays, volume bars, ER marker, hover tooltip (crosshair + card). Build RsiPane sub-pane with 70/30 dashed lines. Both added to utils.tsx. | Frontend | 2d | P0 | FE Eng 1 | S-08 | **Done** | utils.tsx: CandleChart({ sym, tf, px, showMA, showVol }) + RsiPane({ sym, tf }). Uses same genOHLC() bias formula and rescaling as HTML reference. Deterministic from sym+tf seed so renders consistently. |
| T-095 | Build TrGauge SVG (5-color segmented semicircle: Strong Sell→Strong Buy with needle) and SemiGauge SVG (gradient arc for Fear & Greed index). Both in utils.tsx. | Frontend | 1d | P0 | FE Eng 1 | S-08 | **Done** | utils.tsx: TrGauge({ val, size }) + SemiGauge({ val, label, id }). RATING_VAL map: { "Strong Buy": 0.9, "Buy": 0.55, "Neutral": 0, "Sell": -0.55, "Strong Sell": -0.9 }. Used on stock page and F&G widget. |
| T-096 | Build Stock Detail screen HTML-parity: sym selector bar (fbar), sd-head (logo/name/price/actions), sd-grid (chart col + ratings/peers/earnings col). Chart card with CandleChart + RsiPane + toolbar (MA/Vol/RSI toggles). Key stats grid. AI Technical Analysis (toneseg + ai-line rows). Financials bars. Technical Rating (TrGauge). Peers minirows. Industry Group rank. Earnings history. Insider/institutional. | Frontend | 3d | P0 | FE Eng 1 | S-08 | **Done** | screens/stock.tsx. Full rewrite. heatCol() for key-stat color coding. LOGO_BG/EXCHANGE/BEAT_STREAK/INST_OWN/SHORT_INT helper maps. Matches HTML stock detail exactly. |
| T-112 | Add Firebase stock notes to Stock Detail: (1) StockNote interface {id,sym,name,comment,createdAt:Date}; (2) loadNotes(sym): query Firestore stock_comments where uid+sym; (3) saveNote(sym,name,comment): addDoc to stock_comments; (4) deleteNote(id): deleteDoc; (5) add notes,noteInput,noteOpen,ctxMenu,chartRef state; (6) refreshNotes useCallback + useEffect on sym change; (7) chart div gets onContextMenu={handleChartRightClick}+ref={chartRef}; (8) Notes card below chart; (9) right-click context menu (fixed positioned); (10) Add Note modal with textarea. | Frontend | 1.5d | P0 | FE Eng 1 | S-08 | **Done** | screens/stock.tsx. Firebase imports: collection,addDoc,getDocs,query,where,orderBy,Timestamp,deleteDoc,doc from firebase/firestore. Firestore collection: stock_comments. Schema: {uid,sym,name,comment,createdAt:Timestamp}. Notes load on mount + sym change. |

---

## Platform & Shell

### Shell & Design System

| ID | Task | Type | Est. | Pri | Assignee | Sprint | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| T-077 | Build IQShell component: sidebar nav (3 groups: Intelligence/My Money/Context), topbar with StockWise branding (logo gradient + wordmark b=ai color), drawers (stock/earnings/sector/fund/index/feargreed), AI Copilot panel, Cmd+K palette, profile dropdown. IQActionsContext provider. | Frontend | 5d | P0 | FE Eng 1 | S-03 | **Done** | shell.tsx. Each page wraps its own IQShell instance (not a Next.js layout). Theme state lives in IQShell. Nav now has 14 screens including IPOs + Insider & Institutional. |
| T-078 | Build StockWise design system (iq.css): CSS custom properties, dark/light themes, layout primitives (.dash, .col-*), card/pill/badge components, heatmap grid, fund card, tr-pill, toggle, topbar. Updated logo to gradient with SVG bolt icon; wordmark b tag uses var(--ai) for "Wise". | Frontend | 3d | P0 | FE Eng 1 | S-03 | **Done** | Imported globally in app/layout.tsx. .iq-root[data-theme="dark/light"] drives theme switching. |
| T-082 | Wire dark mode toggle in Settings to Firestore settings/{uid} (darkMode: boolean). Custom in-app confirmation modal. Theme init from localStorage (eliminates page-nav flicker). Firestore read on shell mount syncs across sessions. | Frontend | 1d | P0 | FE Eng 1 | S-03 | **Done** | settings.tsx: ThemeConfirmModal component + pending state. shell.tsx: useState lazy init from localStorage + useEffect Firestore read + localStorage write. firestore.rules: added settings/{uid} read/write rule. |
| T-114 | Extend Cmd+K with stock search + starred stocks: (1) add SEARCHABLE_STOCKS constant (20 tickers with name+sector); (2) in palette, filter SEARCHABLE_STOCKS by query; (3) render stock matches above page results with ticker + name; (4) add starred: Set<string> state + toggleStar(sym); (5) per-stock ☆/★ star button; (6) starred list in palette footer. | Frontend | 0.5d | P1 | FE Eng 1 | S-08 | **Done** | shell.tsx. SEARCHABLE_STOCKS constant with 20 tickers. Starred section appears in footer when starred.size > 0. toggleStar() adds/deletes from Set and triggers re-render via spread. |

### Subscription & Billing

| ID | Task | Type | Est. | Pri | Assignee | Sprint | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| T-065 | Build subscription upgrade flow UI: tier comparison page (Free/Pro/Premium), Stripe checkout integration, feature gating enforcement with upgrade prompts | Frontend | 2d | P0 | FE Eng 2 | S-08 | Not Started | Gate checks at component level; show upgrade CTA when Free user hits Pro+ feature |

### AI Copilot

| ID | Task | Type | Est. | Pri | Assignee | Sprint | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| T-054 | Build AI Market Copilot panel: floating chat UI, streaming SSE, source citation links | Frontend | 3d | P0 | FE Eng 1 | S-14 | Not Started | Phase 2; portfolio + live data context injection |
| T-055 | Backend: Copilot API endpoint — injects portfolio context + live data snapshot → Claude streaming | Backend | 2d | P0 | Backend | S-14 | Not Started | Phase 2; SSE response; source module citations in reply |

### Cmd+K

| ID | Task | Type | Est. | Pri | Assignee | Sprint | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| T-076 | Build Cmd+K Command Bar: global keyboard shortcut overlay, ticker lookup and navigation, feed filter, layout switch, contextual suggestions by current page | Frontend | 2d | P1 | FE Eng 1 | S-14 | Not Started | Phase 2; keyboard-first navigation (Cmd+K / Ctrl+K); fuzzy search across tickers and actions |

### Story Stocks

| ID | Task | Type | Est. | Pri | Assignee | Sprint | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| T-069 | Build Story Stocks section: story card component (what/why/what changed today/next catalyst/peer impact), curated feed, AI-tagged stories integrated | Frontend | 2d | P0 | FE Eng 2 | S-13 | Not Started | Phase 2; stories sourced from T-070 AI tagging pipeline + manual editorial curation |
| T-070 | Backend: Story Stocks AI tagging pipeline — detect news cluster density + unusual price/volume behavior; auto-tag and publish story cards directly to feed (no editorial queue) | Backend | 2d | P1 | Backend | S-13 | Not Started | Phase 2; AI-only at launch (no manual curation); triggers: news cluster, AH/premarket move >5%, activist filing, FDA/regulatory event; auto-publishes to story_stocks table |

### Learn in 60 Seconds

| ID | Task | Type | Est. | Pri | Assignee | Sprint | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| T-064 | Build Learn in 60 Seconds micro-card component: context-triggered display by page, under-60-second read, one real example, dismiss permanently or save to library | Frontend | 1.5d | P1 | FE Eng 1 | S-09 | Not Started | Trigger map: 13F page, earnings detail, VIX widget, options board, macro calendar |

### Industry Rotation Alerts

| ID | Task | Type | Est. | Pri | Assignee | Sprint | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| T-074 | Backend: Industry Rotation Alerts — detect when industry subgroup enters or exits top 20 RS rank; dispatch push + email notifications via BullMQ | Backend | 1.5d | P1 | Backend | S-15 | Not Started | Phase 2; RS rank calculated from group performance data; configurable threshold (top 10 or top 20) |

### Mobile App

| ID | Task | Type | Est. | Pri | Assignee | Sprint | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| T-056 | React Native app scaffold: navigation, auth, bottom tab bar (Dashboard/Earnings/Movers/Portfolio/Alerts) | Mobile | 5d | P0 | Mobile Eng | S-15 | Not Started | Phase 2; shared API layer with web; offline state handling |

---

## Task Count Summary

| Screen | Done | In Progress | Not Started | Total |
|---|---|---|---|---|
| Core Infrastructure | 3 | 0 | 8 | 11 |
| Data Ingestion | 0 | 0 | 9 | 9 |
| Landing Page | 1 | 0 | 0 | 1 |
| Auth Pages | 2 | 0 | 2 | 4 |
| Dashboard | 7 | 0 | 7 | 14 |
| Earnings | 1 | 0 | 11 | 12 |
| Market Movers | 1 | 0 | 4 | 5 |
| Market Heatmap | 1 | 0 | 0 | 1 |
| Analyst Actions | 2 | 0 | 2 | 4 |
| Screener | 1 | 0 | 0 | 1 |
| IPOs | 1 | 0 | 0 | 1 |
| Commentary | 2 | 0 | 0 | 2 |
| Portfolio Pulse | 3 | 0 | 2 | 5 |
| Watchlist | 3 | 0 | 2 | 5 |
| Insider & Inst. | 2 | 0 | 5 | 7 |
| Recaps | 3 | 0 | 3 | 6 |
| Macro & VIX | 2 | 0 | 2 | 4 |
| Stock Detail | 4 | 0 | 4 | 8 |
| Shell & Design | 4 | 0 | 0 | 4 |
| Subscription | 0 | 0 | 1 | 1 |
| AI Copilot | 0 | 0 | 2 | 2 |
| Cmd+K | 0 | 0 | 1 | 1 |
| Story Stocks | 0 | 0 | 2 | 2 |
| Learn 60s | 0 | 0 | 1 | 1 |
| Industry Alerts | 0 | 0 | 1 | 1 |
| Mobile | 0 | 0 | 1 | 1 |
| **TOTAL** | **44** | **0** | **70** | **114** |
