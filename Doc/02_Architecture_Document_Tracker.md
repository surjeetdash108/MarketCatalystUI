**Market Intelligence Platform**

System Architecture Document \| v1.0

1\. Architecture Overview

The platform is a multi-tier, event-driven web application built around a real-time data ingestion pipeline, a REST + WebSocket API layer, a React single-page application, and a set of AI generation workers. The architecture prioritizes low-latency data delivery, horizontal scalability of stateless API nodes, and clean separation between the ingestion, storage, serving, and presentation layers.

2\. High-Level System Diagram (Textual)

**Data flows left to right through five layers:**

+--------------------------------------------------------+---+------------------------------------------------------+---+------------------------------------------------------------------------+---+--------------------------------------------------------------------------+---+--------------------------------------------------------------------------+
| **External Data Vendors**                              | → | **Ingestion Workers**                                | → | **Data Store**                                                         | → | **API Layer**                                                            | → | **Client**                                                               |
|                                                        |   |                                                      |   |                                                                        |   |                                                                          |   |                                                                          |
| Polygon, FMP, Benzinga, Unusual Whales, EDGAR, Finnhub |   | Python workers + WebSocket connectors + EDGAR parser |   | Firestore (domain data), ClickHouse (time-series), Redis (cache + pub/sub) |   | Fastify REST API, WebSocket gateway, BullMQ workers, AI generation queue |   | React SPA (Vercel), WebSocket subscription manager, mobile app (Phase 2) |
+--------------------------------------------------------+---+------------------------------------------------------+---+------------------------------------------------------------------------+---+--------------------------------------------------------------------------+---+--------------------------------------------------------------------------+

3\. Layer Specifications

3.1 Data Ingestion Layer

All external data is normalized into internal schemas before storage. Workers run as separate ECS tasks to isolate blast radius.

  ------------------------ --------------------- ----------------------- ----------------------------------------------
  **Worker**               **Source**            **Frequency**           **Writes To**
  Quote Ingestion          Polygon.io WS         Real-time (streaming)   ClickHouse quotes table, Redis quote cache
  News Ingestion           Benzinga REST + WS    Real-time               Firestore news collection, Redis pub/sub channel
  Earnings Calendar Sync   FMP REST              Every 15 min            Firestore earnings\_events collection
  Analyst Actions Ingest   Benzinga REST         Every 5 min             Firestore analyst\_actions collection
  Macro Calendar Sync      Finnhub REST          Daily at 6am ET         Firestore macro\_events collection
  Options Flow Ingest      Unusual Whales WS     Real-time               Firestore options\_flow collection
  EDGAR 13F Parser         SEC EDGAR full-text   Nightly + on filing     Firestore fund\_holdings collection
  Block Trade Ingest       Polygon.io Trades     Real-time               Firestore block\_trades collection
  ------------------------ --------------------- ----------------------- ----------------------------------------------

3.2 Data Storage Layer

Firestore (Primary Document Store)

-   Stores all structured domain data as document collections: users, portfolios, watchlists, earnings\_events, analyst\_actions, news, fund\_holdings, alerts, notifications, 13F data

-   Document IDs use Firebase-generated IDs (or ticker/userId as natural keys where appropriate); soft deletes via deletedAt field

-   Compound queries use Firestore composite indexes (defined in firestore.indexes.json); no read replicas needed — Firestore scales horizontally by default

-   Firebase Admin SDK used server-side (Node.js) for all reads/writes; Firestore security rules enforce collection-level access control

ClickHouse (Time-Series Store)

-   Stores OHLCV quotes, intraday tick data, volume history, and market movers snapshots

-   Partitioned by date; ReplacingMergeTree for deduplication of real-time ticks

-   Query interface exposed via an internal microservice (never queried directly from API)

Redis

-   Live quote cache: key = ticker, TTL = 5 seconds

-   Pub/Sub: channels per feed type (news, analyst\_actions, earnings, movers) --- API gateway subscribes and fans out to WebSocket clients

-   Session store for authenticated WebSocket connections

-   BullMQ job queues for async workers (AI generation, alert dispatch, recap generation)

S3

-   Audio recap files (mp3), earnings call recordings (if sourced)

-   Recap card images for social sharing (Phase 2)

-   CSV export downloads

3.3 API Layer

REST API (Fastify / Node.js)

-   Versioned at /api/v1/. Authenticated via Firebase ID tokens (verified with Firebase Admin SDK)

-   Rate limits: Free = 60 req/min, Pro = 300 req/min, Premium = 600 req/min

-   All endpoints return JSON; paginated lists use cursor pagination

-   Deployed as ECS Fargate tasks behind an Application Load Balancer; auto-scales on CPU \> 60%

WebSocket Gateway

-   Separate Fastify server running ws:// upgrade handler

-   Client authenticates via Firebase ID token on connection; server verifies with Admin SDK and maps socket to user session

-   Client subscribes to named channels: feed:all, feed:portfolio:{userId}, movers:live, quotes:{ticker}

-   Messages are JSON with schema: { type, channel, data, timestamp }

-   Horizontal scaling via Redis pub/sub fan-out; each gateway node subscribes to all channels and filters per connected client

AI Generation Workers (BullMQ)

-   earnings\_summary queue: triggered on earnings\_event.result\_posted; calls Anthropic Claude API with transcript + metrics; stores result in Firestore earnings\_summaries collection

-   ta\_analysis queue: triggered on user request; calls Claude with OHLCV + indicators; returns to client via REST response

-   recap\_generation queue: cron at 4:30pm ET (EOD) and Friday 6pm ET (weekly); Claude summarizes day/week from structured data

-   13f\_summary queue: triggered on new 13F ingestion; Claude summarizes changes per fund

-   copilot queue: real-time; user message + context injected, Claude responds with source citations story\_stocks queue: event-driven; triggered by news cluster density detector + price/volume anomaly worker; Claude evaluates and generates story card (what/why/catalyst date/peer impact); auto-published to story\_stocks table

3.4 Alert Engine

-   Alert rules stored in Firestore (users/{userId}/alerts sub-collection) with type, threshold, delivery\_channels, and enabled flag

-   Event processor subscribes to Redis pub/sub channels and evaluates all active rules matching the event type

-   On match: publishes to alert\_dispatch BullMQ queue; worker sends email (SendGrid) and in-app notification

-   In-app notifications stored in Firestore (users/{userId}/notifications sub-collection) with read/unread state

-   Phase 2: SMS via Twilio, push via FCM/APNs

3.5 Frontend Architecture (Next.js — Current Implementation)

Framework & Build

-   **Next.js 14 (App Router)** with TypeScript. Output mode: `static export` (`next build` → `out/` directory). Deployed to Firebase Hosting.

-   All IQ screens are client components (`"use client"`). Server components are only used for the root layout.

-   Fonts loaded via `next/font/google`: Space Grotesk (display), Geist Sans (body), JetBrains Mono (monospace), Geist Mono.

State Management — Redux Toolkit

-   **Redux Toolkit** (`configureStore`) is the single source of truth for global app state. No Zustand, no React Query.

-   **`store.ts`**: combines two slices — `auth` and `profile`.

-   **`auth-slice.ts`**: holds `SerializedUser | null` (uid, email, displayName, photoURL) and `status: "loading" | "ready"`. Firebase `User` object is serialized before dispatch (Firebase objects are not Redux-serializable).

-   **`profile-slice.ts`**: holds `StoredProfile | null` (InvestorProfile fields + uid + tier) and `status: "idle" | "loading" | "ready"`. Firestore Timestamps are stripped before dispatch.

-   **`firebase-listener.tsx`** (`FirebaseListener` component): mounts inside `ReduxProvider`, calls `firebaseAuth.authStateReady()` then subscribes to `onAuthStateChanged`. On user sign-in, dispatches `setUser` and fetches `users/{uid}` from Firestore to dispatch `setProfile`. Runs once for the lifetime of the app.

-   **`redux-provider.tsx`**: wraps the app in `<Provider store={store}><FirebaseListener />{children}</Provider>` inside `app/layout.tsx`.

-   **Typed hooks**: `useAppSelector` and `useAppDispatch` (from `store/hooks.ts`) wrap the RTK hooks with `RootState` and `AppDispatch` types.

Routing — Next.js App Router

-   `/` → landing / redirect
-   `/auth/login` → Login (email/password + Google OAuth)
-   `/auth/signup` → Create Account
-   `/auth/forgot-password` → Password Reset
-   `/dashboard` → IQ Dashboard screen
-   `/menu/[slug]` → all IQ screens (portfolio, watchlist, earnings, screener, analyst, thirteenf, movers, heatmap, macro, commentary, recap, stock, manage-plan)
-   `/settings` → Settings screen
-   `/profile/edit` → Profile edit
-   Protected routes: all IQ routes guarded by `AuthGuard` component (checks Redux `state.auth.status === "ready"` and `state.auth.user`; redirects to `/auth/login` if not authenticated).

IQ Shell & Component Architecture

-   **`IQShell`** (`app/iq/shell.tsx`): the main authenticated shell. Wraps each page individually (not a Next.js layout). Contains the sidebar nav, topbar, drawer system (stock/earnings/sector/fund drawers), AI Copilot panel, Cmd+K palette, and profile dropdown. Holds `theme` state and exposes it via `IQActionsContext`.

-   **`IQActionsContext`**: React context providing `openStock(sym)`, `openStockFull(sym)`, `openEarnings(sym)`, `openSector(name)`, `openFund(idx)`, `openIndex(i)`, `openFearGreed()`, `setCopilot(open)`, `theme`, `setTheme` to all child screens. Consumed via `useIQActions()` hook.

-   **Drawer union type**: `drawer` state in IQShell is `{ type: "stock" | "earnings" | "sector" | "fund" | "index" | "feargreed" } | null`. `IndexDrawer` renders OHLC/day-range/52wk-range/AI-note for market indices, plus leading/lagging sectors for equity indices. `FearGreedDrawer` renders SemiGauge, 5-value history metric-grid, 7-component progress bars, AI read note.

-   **Theme system**: `theme: "dark" | "light"` state in `IQShell`. Applied as `data-theme={theme}` on `.iq-root` div. Initialized from `localStorage` synchronously (no flicker on navigation). Persisted to Firestore `settings/{uid}` collection (`darkMode: boolean` field) when user changes preference via Settings. `localStorage` acts as a fast cache so the correct theme is available on the first render of every page mount.

Shared Utility Components (`app/iq/utils.tsx`)

-   **`heatCol(p)`**: RGB color ramp matching HTML reference. Returns `{ bg, fg }`. Pale mint→deep green (positive), pale pink→deep red (negative). `fg` is `#ffffff` for dark tiles, `#0c1a13` for light tiles (threshold: saturation > 42%). Used by dashboard heatmap mini, heatmap treemap, and stock page key-stat cells.

-   **`CandleChart({ sym, tf, px, showMA?, showVol? })`**: SVG candlestick chart. Deterministic OHLC generation via seeded RNG matching HTML's `genOHLC()` algorithm. Features: candles + wicks, MA20/MA50 overlays, volume bars, ER marker, hover crosshair tooltip. Rendered on stock detail page.

-   **`RsiPane({ sym, tf })`**: SVG RSI oscillator sub-pane. 70/30 dashed reference lines. Shares seed with CandleChart so RSI is consistent with price data.

-   **`TrGauge({ val, size })`**: Segmented semicircle SVG (5 colored arcs: Strong Sell → Strong Buy) with animated needle. Used on stock Technical Rating card.

-   **`SemiGauge({ val, label, id })`**: Gradient arc SVG for Fear & Greed index (0–100). Used on dashboard F&G widget and FearGreedDrawer.

-   **`Spark({ seed, up })`**: Deterministic sparkline SVG. Used on pulse strip cards.

-   **`RATING_VAL`**: Map from rating string to gauge position — `{ "Strong Buy": 0.9, "Buy": 0.55, "Neutral": 0, "Sell": -0.55, "Strong Sell": -0.9 }`.

Design System — InvestIQ (`iq.css`)

-   All styling is via a custom CSS design system in `app/iq.css`, imported globally in `app/layout.tsx`.

-   CSS custom properties on `:root` define the dark-mode palette (default): `--bg`, `--surface-0/1/2/3`, `--border`, `--border-soft`, `--border-strong`, `--text-hi`, `--text`, `--text-dim-solid`, `--brand`, `--brand-2`, `--brand-dim`, `--ai`, `--ai-2`, `--ai-dim`, `--up`, `--up-dim`, `--down`, `--down-dim`, `--warn`, `--warn-dim`, `--f-display`, `--f-body`, `--f-mono`, `--r-sm`, `--r`, `--r-lg`, `--r-xl`, `--shadow`.

-   `.iq-root[data-theme="dark"]` explicitly sets dark palette on the root element.

-   `.iq-root[data-theme="light"]` overrides with a light palette (`--bg: #EDF1F7` etc.).

-   Layout primitives: `.app` (CSS grid: sidebar + content), `.dash` (12-column content grid), `.col-3/4/5/6/7/8/12`, `.card`, `.card-h`, `.card-b`, `.page-head`, `.page-title`.

-   Component classes: `.wmn` (What Matters Now block), `.ai-block`, `.ai-sec`, `.heat` (sector heatmap grid), `.fundcard`, `.fin-row`, `.iq-toggle`, `.iq-toggle-row`, `.pill`, `.pill.up/dn/amc/opt/bmo/beat/miss/raise/lower/hold`, `.tr-badge`, `.iconbtn`, `.topbar-avatar`, `.trseg`, `.trseg2`, `.tf-pills`, `.ind-tbl`, `.sd-grid`, `.sd-head`.

-   Stock screener classes: `.filt`, `.filt .fh`, `.filt .fb`, `.fgroup .fl`, `.preset`, `.dd`, `.dd-menu`.

-   Auth pages use the same CSS variables (imported globally) but are not wrapped in `.iq-root`; they use inline styles referencing `var(--*)`.

Screens (Current)

| Slug | Screen File | Status |
|---|---|---|
| dashboard | screens/dashboard.tsx | UI complete — HTML-parity layout, heatCol mini, openIndex/openFearGreed, pmeta |
| portfolio | screens/portfolio.tsx | UI complete — static data |
| watchlist | screens/watchlist.tsx | UI complete — static data |
| earnings | screens/earnings.tsx | UI complete — static data |
| screener | screens/screener.tsx | UI complete — 20 presets, checkbox filters, native `<details>` dropdown |
| analyst | screens/analyst.tsx | UI complete — static data |
| thirteenf | screens/thirteenf.tsx | UI complete — static data |
| movers | screens/movers.tsx | UI complete — static data |
| heatmap | screens/heatmap.tsx | UI complete — heatCol() dynamic text color on treemap tiles |
| macro | screens/macro.tsx | UI complete — static data |
| commentary | screens/commentary.tsx | UI complete — static data |
| recap | screens/recap.tsx | UI complete — static data |
| stock | screens/stock.tsx | UI complete — CandleChart, RsiPane, TrGauge, full HTML-parity layout |
| settings | screens/settings.tsx | Settings + dark mode wired to Firestore |
| manage-plan | screens/manage-plan.tsx | UI scaffold |

Cmd+K Command Bar

-   Global `Cmd+K` (or `Ctrl+K`) opens the palette overlay in `IQShell`. Searches menu items and tickers by label/slug. Keyboard navigation (↑↓ arrows, Enter, Escape). Navigates via Next.js `router.push()`. Phase 2: fuzzy ticker search via API.

4\. Security Architecture

  ------------------- ---------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Concern**         **Implementation**
  Authentication      Firebase Authentication with email/password + Google OAuth. Firebase ID tokens (1 hr TTL) verified server-side via Firebase Admin SDK; refresh tokens managed automatically by Firebase client SDK
  Authorization       Row-level access: all portfolio, watchlist, and alert queries are scoped to authenticated user\_id. Subscription tier gating enforced at API middleware layer
  API Keys (vendor)   All external API keys stored in AWS Secrets Manager, injected as env vars at ECS task startup. Never in code or client
  Data in transit     TLS 1.3 enforced everywhere. HSTS headers on frontend. WebSocket connections use WSS
  Data at rest        Firestore data encrypted at rest by default (Google-managed keys). S3 server-side encryption. Redis AUTH token required
  Rate limiting       Per-tier rate limits enforced at ALB + API middleware. DDoS protection via AWS Shield Standard
  Input validation    Zod schema validation on all API request bodies. Firestore security rules enforce collection-level access; no raw query injection vectors. Content Security Policy headers
  ------------------- ---------------------------------------------------------------------------------------------------------------------------------------------------------------

5\. Performance & Scalability Targets

  ---------------------------- ---------------------------- ---------------------------------------------------
  **Metric**                   **Target**                   **Strategy**
  API response time (p95)      \< 200ms                     Redis cache, Firestore document reads, CDN for static data
  WebSocket feed latency       \< 1 second                  Redis pub/sub, async fan-out, keep-alive pings
  Page LCP (desktop)           \< 2 seconds                 Code splitting, lazy loading, Vercel Edge CDN
  AI summary generation        \< 5 minutes post-earnings   BullMQ priority queue, pre-staged prompts
  Concurrent WebSocket users   10,000+                      Horizontal ECS scaling, Redis fan-out
  Alert delivery               \< 60 seconds                BullMQ high-priority queue, SendGrid dedicated IP
  Uptime SLA                   99.9%                        Firestore 99.999% SLA (Google-managed), ECS across 2 AZs, ALB health checks
  ---------------------------- ---------------------------- ---------------------------------------------------

6\. Infrastructure

**Current (Frontend MVP)**

-   **Firebase Hosting**: serves the Next.js static export (`out/` directory). Project ID: `fin-app26`. Deployed via `firebase deploy --only hosting`. Clean URLs enabled; all routes rewrite to `index.html` for SPA navigation.

-   **Firebase Authentication**: email/password + Google OAuth. Firebase ID tokens issued client-side; `FirebaseListener` monitors `onAuthStateChanged` and syncs to Redux store.

-   **Cloud Firestore**: primary data store. Collections live: `users/{uid}` (profile), `settings/{uid}` (user preferences including dark mode). Security rules enforced via `firestore.rules` (deployed via `firebase deploy --only firestore:rules`). Firebase project: `fin-app26`.

**Planned (Backend / Phase 2 — not yet deployed)**

*All backend workloads planned for AWS us-east-1.*

-   VPC with public subnets (ALB, NAT Gateway) and private subnets (ECS tasks, Redis)

-   ECS Cluster: api-service (2--10 tasks), websocket-service (2--8 tasks), ingestion workers (per-worker task definitions), ai-workers (1--4 tasks)

-   ElastiCache Redis: cache.r6g.large, cluster mode disabled (single shard), Multi-AZ with auto-failover

-   ClickHouse: self-managed on EC2 (r6i.2xlarge), single node MVP, cluster in Phase 2

-   S3: market-platform-prod bucket, versioning enabled, lifecycle policy to Glacier after 90 days

-   CloudFront: CDN for S3 audio files and static asset acceleration

-   Route 53: DNS with health checks; automatic failover
