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

3.5 Frontend Architecture (React SPA)

State Management

-   React Query: all server data fetching, caching, background refetch, optimistic updates

-   Zustand: UI state (dashboard layout, active session tab, widget visibility, drawer state)

-   WebSocket manager: singleton context provider --- subscribes on mount, fan-out to subscribed components via Zustand slices

Routing

-   React Router v6. Routes: /, /earnings, /movers, /analyst-actions, /portfolio, /stocks/:ticker, /13f, /markets, /recap, /story-stocks, /settings

-   Protected routes: all except / (landing), /login, /register require valid session

Component Architecture

-   Design system: shared component library (Button, Table, Drawer, Pill, Sparkline, Chart, AlertBadge, WidgetGrid)

-   Page components consume domain hooks (useEarningsCalendar, useMovers, usePortfolio, useAlerts)

-   Domain hooks wrap React Query calls and WebSocket subscriptions

-   AI components (AISummaryCard, CopilotPanel) use streaming fetch (SSE from API) CommandBar: global Cmd+K overlay component; fuzzy search across tickers and actions; Zustand state for open/close PeerScatterMatrix: D3-powered bubble chart (RS vs EPS growth rate); available on stock detail page and group page (Phase 2) LearnCard: AI-generated contextual micro-card component; page-context trigger map; dismiss/save-to-library state in Zustand

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

6\. Infrastructure Diagram (AWS)

*All production workloads run in AWS us-east-1 (primary). Firestore is a Google-managed globally distributed service (no VPC placement required).*

-   VPC with public subnets (ALB, NAT Gateway) and private subnets (ECS tasks, Redis)

-   ECS Cluster: api-service (2--10 tasks), websocket-service (2--8 tasks), ingestion workers (per-worker task definitions), ai-workers (1--4 tasks)

-   Firebase: Firestore (domain data, auto-scaling, no provisioning), Firebase Authentication (email/password + Google OAuth, managed token issuance)

-   ElastiCache Redis: cache.r6g.large, cluster mode disabled (single shard), Multi-AZ with auto-failover

-   ClickHouse: self-managed on EC2 (r6i.2xlarge), single node MVP, cluster in Phase 2

-   S3: market-platform-prod bucket, versioning enabled, lifecycle policy to Glacier after 90 days

-   CloudFront: CDN for frontend assets and S3 audio files

-   Route 53: DNS with health checks; automatic failover
