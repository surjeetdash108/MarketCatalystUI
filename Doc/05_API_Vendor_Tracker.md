# Market Intelligence Platform — API Vendor Tracker

v1.0 | June 2026

---

## 1. Vendor Overview

| Vendor | Free Tier | Paid Pricing (est.) | Category | Startup-Friendly |
|---|---|---|---|---|
| **Polygon.io** (now Massive) | 5 req/min, 15-min delayed REST only | ~$29/mo Starter (real-time + WebSocket) | Quotes, OHLCV, Block Trades | ✅ Yes |
| **Finnhub** | 60 req/min, WebSocket (50 symbols), quotes + news + calendar | $11.99–$99.99/mo | Quotes, News, Macro, Fundamentals | ✅ Yes — free tier covers MVP basics |
| **Twelve Data** | 8 req/min, 800/day, US equities | $29/mo Grow, $99/mo Pro | OHLCV historical, indices | ✅ Yes |
| **Benzinga** | Basic news headlines only (AWS Marketplace free tier) | Custom pricing ~$149–299/mo (contact sales) | News, Analyst Actions, Earnings, Transcripts | ⚠️ Paid required for full API |
| **Financial Modeling Prep (FMP)** | 250 req/day, 5yr financials | $99–399/mo (contact for current tiers) | Earnings Calendar, Fundamentals, Sector, Analyst, Transcripts | ✅ Yes |
| **Unusual Whales** | Website only (no free API) | $48/mo standard; API Advanced plan for WebSocket streaming | Options Flow, Dark Pool, Congressional Trades | ✅ Yes |
| **SEC EDGAR** | 100% free (10 req/sec rate limit) | Free | 13F Filings, All SEC Filings | ✅ Free |
| **Tradier** | Free API access with free brokerage account | $10/mo Pro, $35/mo Pro Plus | Options Chains, Real-time Quotes, Paper Trading | ✅ Yes — free option |
| **Trading Economics** | Very limited (no API on free) | ~$150+/mo | Macro/Economic Calendar | ⚠️ Expensive for data volume |
| **Intrinio** | 14-day trial only | $150–$1,600/mo per dataset | Transcripts, Options, Fundamentals, Real-time | ⚠️ Expensive — use as fallback |
| **Motley Fool Transcripts API** | None | $2,000+/year (enterprise) | Earnings Transcripts | ❌ Not startup-friendly |
| **Refinitiv (LSEG)** | None | Enterprise contract only ($5k+/mo) | Full market data | ❌ Enterprise only |
| **Market Chameleon** | Website research tool only | No public API | Options research | ❌ No usable API |

---

## 2. Data Requirement → Recommended Vendor

| Data Requirement | Primary Vendor | Fallback | Free Option Available | Notes |
|---|---|---|---|---|
| Real-time quotes (WebSocket) | Polygon.io (Paid) | Finnhub (Free, 50 symbols) | ✅ Finnhub free tier | Polygon WebSocket needs paid plan |
| OHLCV historical data | Polygon.io (Paid) | Twelve Data (Free/Paid) | ✅ Twelve Data 800/day free | Backfill 2yr on first run |
| Indices (S&P, Nasdaq, Dow, etc.) | Polygon.io | Finnhub | ✅ Finnhub free | Index quotes via same WS connection |
| News and headlines | Benzinga (Paid) | Finnhub (Free) | ✅ Finnhub basic news | Benzinga needed for "Why It Matters" category tagging |
| Earnings calendar + actuals | FMP (Paid) | Benzinga | ❌ Free tiers too limited | FMP has best earnings calendar coverage |
| Earnings transcripts | FMP (Paid — included in plan) | Intrinio ($250+/mo) | ❌ No free option | FMP includes transcripts on paid plans; avoid Motley Fool/Refinitiv |
| Analyst ratings + targets | Benzinga (Paid) | FMP (Paid) | ❌ No meaningful free tier | Benzinga has real-time ratings stream |
| 13F filings | SEC EDGAR (Free) | — | ✅ Completely free | Rate limit: 10 req/sec; parse XML directly |
| Macro/economic calendar | Finnhub (Free tier sufficient) | FMP | ✅ Finnhub free tier | Finnhub economic calendar free on all plans |
| Options flow + unusual activity | Unusual Whales (Paid) | Tradier (options chains, free) | ⚠️ Tradier free for chains only | Unusual Whales needed for "unusual" flow detection |
| Block trade data | Polygon.io (Paid — same subscription) | Intrinio | ❌ Needs paid | Polygon Trades API covers block detection |
| Company reference + fundamentals | FMP (Paid) | Finnhub | ✅ Finnhub basic | FMP has sector/group/MarketSurge-style data |
| Sector and industry group data | FMP (Paid) | Polygon | ❌ Free tiers insufficient | FMP sector/industry grouping matches MarketSurge model |

---

## 3. Recommended Vendor Stack (MVP)

| Slot | Vendor | Monthly Cost (est.) | What It Covers |
|---|---|---|---|
| Real-time quotes + OHLCV + block trades | Polygon.io Starter | ~$29 | WS quotes, REST OHLCV, block trades, indices |
| News + analyst actions + transcripts | Benzinga API | ~$149–299 (contact sales) | News feed WS, analyst ratings stream, earnings transcripts |
| Earnings calendar + sector + fundamentals | FMP Premium | ~$99 | Earnings calendar, actuals, transcripts (fallback), sector/group, PE/fundamentals |
| Macro/economic calendar | Finnhub | Free | Economic calendar, basic news, earnings surprises |
| Options flow | Unusual Whales | ~$48 | Unusual options, dark pool, congressional trades |
| 13F filings | SEC EDGAR | Free | All 13F-HR filings, EDGAR full-text search |
| Options chains (for implied move calc) | Tradier | Free (brokerage account) | Options chain data, Greeks, implied move |
| **Total MVP estimate** | | **~$325–475/mo** | |

> **Phase 2 additions**: Intrinio for deeper transcript/options coverage if Benzinga proves insufficient (~$250/mo add).  
> **Not recommended**: Motley Fool Transcripts API (too expensive), Refinitiv (enterprise only), Market Chameleon (no API).

---

## 4. Data Flow: Scheduler → Firestore Architecture

```
[Vendor APIs]
      │
      ▼
[ECS Scheduler Workers]  (Python, one worker per data type)
      │  ── normalize to internal schema ──
      ▼
[Firestore Collections]  (domain data — all clients read from here)
      │
      ▼
[React SPA / Mobile]    (Firestore SDK real-time listeners OR REST)
```

**Important**: Real-time quotes are NOT written to Firestore (too expensive per read/write at tick frequency). Quote flow is:

```
Polygon.io WS → Redis quote cache (TTL 5s) → WebSocket Gateway → Client
                ClickHouse (OHLCV history)
```

Everything else (news, earnings, analyst actions, macro, options flow, 13F, movers snapshots) goes to Firestore.

---

## 5. Firestore Collection Schemas

### 5.1 companies

Reference data for all tracked tickers. Updated daily.

```
Collection: companies
Document ID: {ticker}  (e.g., "AAPL")

{
  ticker:            string,          // "AAPL"
  name:              string,          // "Apple Inc."
  exchange:          string,          // "NASDAQ"
  sector:            string,          // "Technology"
  industry:          string,          // "Consumer Electronics"
  industryGroup:     string,          // MarketSurge-style group, e.g. "Software-Enterprise"
  marketCap:         number,          // in USD
  sharesOutstanding: number,
  float:             number,
  description:       string,
  cik:               string,          // SEC CIK for EDGAR lookups
  website:           string | null,
  ceo:               string | null,
  employees:         number | null,
  ipoDate:           string | null,   // "YYYY-MM-DD"
  source:            string,          // "fmp"
  updatedAt:         timestamp
}

Indexes needed:
  - sector ASC + marketCap DESC
  - industryGroup ASC + updatedAt DESC
```

---

### 5.2 earnings_events

Earnings calendar + actuals. Upserted every 15 min from FMP.

```
Collection: earnings_events
Document ID: {ticker}_{fiscalQuarterKey}  (e.g., "AAPL_2025Q2")

{
  ticker:              string,
  companyName:         string,
  reportDate:          timestamp,
  session:             "BMO" | "AMC" | "unknown",
  fiscalQuarter:       string,         // "Q2 2025"
  fiscalYear:          number,
  epsEstimate:         number | null,
  revenueEstimate:     number | null,  // in USD
  epsActual:           number | null,
  revenueActual:       number | null,
  epsSurprise:         number | null,  // % vs estimate
  revenueSurprise:     number | null,
  guidanceStatus:      "raised" | "lowered" | "maintained" | "none" | null,
  guidanceSummary:     string | null,
  resultPosted:        boolean,
  transcriptAvailable: boolean,
  transcriptUrl:       string | null,
  audioUrl:            string | null,  // Intrinio audio recording
  priceReaction:       number | null,  // % change post-earnings
  source:              string,         // "fmp"
  createdAt:           timestamp,
  updatedAt:           timestamp
}

Indexes needed:
  - reportDate ASC + session ASC
  - reportDate ASC + resultPosted ASC
  - ticker ASC + reportDate DESC
```

---

### 5.3 earnings_summaries

AI-generated summaries. Written once per earnings event by the earnings_summary BullMQ worker.

```
Collection: earnings_summaries
Document ID: {ticker}_{fiscalQuarterKey}  (matches earnings_events)

{
  ticker:          string,
  quarter:         string,               // "Q2 2025"
  beatMiss:        "beat" | "miss" | "in-line",
  tone:            "bullish" | "cautious" | "neutral" | "mixed",
  guidance:        string,               // 1-2 sentence summary
  keyRisks:        string[],             // array of risk bullets
  takeaway:        string,               // 1 sentence bottom line
  confidenceScore: number,               // 0.0–1.0
  model:           string,               // "claude-3-5-sonnet"
  promptVersion:   string,
  generatedAt:     timestamp,
  updatedAt:       timestamp
}
```

---

### 5.4 news

News articles. Written in real-time from Benzinga WS, supplemented by Finnhub.

```
Collection: news
Document ID: auto-generated

{
  id:             string,
  headline:       string,
  summary:        string,
  body:           string | null,        // full body (Benzinga paid)
  url:            string,
  source:         string,               // "benzinga" | "finnhub"
  author:         string | null,
  publishedAt:    timestamp,
  tickers:        string[],             // ["AAPL", "MSFT"] — array for compound queries
  categories:     string[],             // ["Earnings", "Analyst", "Macro", "Story", "Sector"]
  sentiment:      "positive" | "negative" | "neutral" | null,
  whyItMatters:   string | null,        // AI-generated 1 sentence
  importance:     "high" | "medium" | "low",
  createdAt:      timestamp
}

Indexes needed:
  - publishedAt DESC (default feed order)
  - tickers (array-contains) + publishedAt DESC
  - categories (array-contains) + publishedAt DESC
```

---

### 5.5 analyst_actions

Upgrades, downgrades, initiations, reiterations. Written every 5 min from Benzinga.

```
Collection: analyst_actions
Document ID: auto-generated

{
  id:                  string,
  ticker:              string,
  firm:                string,
  analystName:         string | null,
  actionType:          "upgrade" | "downgrade" | "initiation" | "reiteration" | "coverage_dropped",
  previousRating:      string | null,  // "Hold"
  newRating:           string,         // "Buy"
  previousPriceTarget: number | null,
  newPriceTarget:      number | null,
  currency:            string,         // "USD"
  publishedAt:         timestamp,
  priceAtAction:       number | null,
  priceChangeSince:    number | null,  // % change since action was published
  impliedUpside:       number | null,  // % from current price to price target
  impliedDownside:     number | null,
  aiNote:              string | null,  // AI-generated meaningfulness note
  source:              string,         // "benzinga"
  createdAt:           timestamp
}

Indexes needed:
  - publishedAt DESC
  - ticker ASC + publishedAt DESC
  - actionType ASC + publishedAt DESC
```

---

### 5.6 macro_events

Economic calendar events. Synced daily at 6am ET from Finnhub.

```
Collection: macro_events
Document ID: auto-generated  (or {date}_{event_slug} for deduplication)

{
  id:          string,
  name:        string,         // "US CPI MoM"
  country:     string,         // "US"
  currency:    string,         // "USD"
  eventDate:   timestamp,
  actual:      number | null,
  estimate:    number | null,
  previous:    number | null,
  unit:        string | null,  // "%", "K", "B"
  importance:  "high" | "medium" | "low",
  description: string | null,
  source:      string,         // "finnhub"
  createdAt:   timestamp,
  updatedAt:   timestamp
}

Indexes needed:
  - eventDate ASC + importance ASC
  - country ASC + eventDate ASC
```

---

### 5.7 options_flow

Unusual options activity. Written in real-time from Unusual Whales WS.

```
Collection: options_flow
Document ID: auto-generated

{
  id:                string,
  ticker:            string,
  strikePrice:       number,
  expirationDate:    timestamp,
  daysToExpiry:      number,
  optionType:        "call" | "put",
  contractSize:      number,          // number of contracts
  premium:           number,          // per-contract premium
  totalValue:        number,          // total notional value in USD
  impliedVolatility: number,          // as decimal e.g. 0.45
  volOiRatio:        number,          // volume / open interest
  side:              "bid" | "ask" | "mid",
  directionFlag:     "bullish" | "bearish" | "neutral",
  isSweep:           boolean,
  isUnusual:         boolean,
  isBlock:           boolean,
  tradeTime:         timestamp,
  source:            string,          // "unusual_whales"
  createdAt:         timestamp
}

Indexes needed:
  - tradeTime DESC
  - ticker ASC + tradeTime DESC
  - isUnusual ASC + tradeTime DESC
  - directionFlag ASC + tradeTime DESC
```

---

### 5.8 block_trades

Large single trades. Written in real-time from Polygon.io Trades API.

```
Collection: block_trades
Document ID: auto-generated

{
  id:              string,
  ticker:          string,
  tradeValue:      number,       // total USD value (price × shares)
  shares:          number,
  price:           number,
  vwap:            number | null,
  vwapDiffPct:     number | null, // % above/below VWAP
  exchange:        string,
  conditions:      string[],     // trade condition codes
  directionContext: "above_ask" | "below_bid" | "at_mid" | null,
  tradeTime:       timestamp,
  source:          string,       // "polygon"
  createdAt:       timestamp
}

Indexes needed:
  - tradeTime DESC
  - ticker ASC + tradeTime DESC
  - tradeValue DESC + tradeTime DESC
```

---

### 5.9 fund_holdings

13F institutional holdings. Written nightly from SEC EDGAR parser.

```
Collection: fund_holdings
Document ID: {cik}

{
  cik:             string,
  fundName:        string,
  managerName:     string | null,
  latestFilingDate: timestamp,
  latestReportDate: timestamp,   // end of quarter
  totalValue:      number,       // in thousands (as reported)
  totalPositions:  number,
  aiSummary:       string | null,
  updatedAt:       timestamp
}

Sub-collection: fund_holdings/{cik}/filings/{filing_id}
{
  filingDate:      timestamp,
  reportDate:      timestamp,
  totalValue:      number,
  totalPositions:  number,
  source:          string,       // "edgar"
  createdAt:       timestamp
}

Sub-collection: fund_holdings/{cik}/filings/{filing_id}/positions/{ticker}
{
  ticker:          string,
  cusip:           string,
  companyName:     string,
  shares:          number,
  value:           number,       // in thousands
  putCall:         "put" | "call" | null,
  changeType:      "new" | "added" | "trimmed" | "exited" | "unchanged",
  shareChange:     number,       // delta vs prior quarter (0 if new/unchanged)
  pctPortfolio:    number        // % of fund's total reported value
}

Indexes needed:
  - fund_holdings: latestFilingDate DESC
  - positions: pctPortfolio DESC
  - positions: changeType ASC + value DESC
```

---

### 5.10 market_movers

Pre-calculated movers snapshots. Written every minute during market hours by movers worker (sourced from ClickHouse + Redis).

```
Collection: market_movers
Document ID: {date}_{session}_{type}  (e.g., "2025-06-10_regular_gainers")

{
  date:          string,         // "YYYY-MM-DD"
  session:       "premarket" | "regular" | "afterhours",
  type:          "gainers" | "losers" | "volume" | "gap_up" | "gap_down" | "high_rvol" | "weekly",
  movers: [
    {
      ticker:        string,
      pctChange:     number,
      priceChange:   number,
      price:         number,
      volume:        number,
      rvolRatio:     number,       // vs 30-day avg volume
      catalystLabel: string | null,
      maPosture:     string | null, // "Above 21/50/200" etc.
      sector:        string | null,
      float:         number | null
    }
  ],
  generatedAt:   timestamp
}

Indexes needed:
  - date DESC + session ASC + type ASC
```

---

### 5.11 story_stocks

AI-tagged story cards. Written by story_stocks BullMQ worker; auto-published.

```
Collection: story_stocks
Document ID: auto-generated

{
  id:               string,
  ticker:           string,
  headline:         string,
  what:             string,        // what is happening
  why:              string,        // why it matters
  whatChangedToday: string,        // today's trigger/update
  nextCatalystDate: timestamp | null,
  nextCatalyst:     string | null, // "FDA decision", "Earnings Q2"
  peerImpact:       string,        // impact on sector/peers
  tags:             string[],      // ["activist", "fda", "earnings_catalyst", "technical_breakout"]
  triggerType:      "news_cluster" | "price_volume_anomaly" | "activist_filing" | "regulatory_event",
  sourceNewsIds:    string[],      // references to news collection
  isActive:         boolean,
  publishedAt:      timestamp,
  updatedAt:        timestamp
}

Indexes needed:
  - publishedAt DESC + isActive ASC
  - ticker ASC + publishedAt DESC
  - tags (array-contains) + publishedAt DESC
```

---

### 5.12 recaps

EOD and weekly recaps. Written by recap BullMQ workers.

```
Collection: recaps
Document ID: "daily_{YYYY-MM-DD}" | "weekly_{YYYY}-W{ww}"

{
  type:          "daily" | "weekly",
  date:          string,           // "2025-06-10" or "2025-W23"
  title:         string,
  articleContent: string,          // full article markdown
  bulletPoints:  string[],         // bullet summary version
  audioUrl:      string | null,    // S3 presigned URL
  audioDuration: number | null,    // seconds
  audioScript:   string | null,    // 60-sec TTS script
  emailSentAt:   timestamp | null,
  generatedAt:   timestamp
}

Indexes needed:
  - type ASC + date DESC
```

---

### 5.13 User Collections

```
Collection: users
Document ID: {firebase_uid}

{
  uid:             string,
  email:           string,
  displayName:     string | null,
  photoUrl:        string | null,
  tier:            "free" | "pro" | "premium",
  stripeCustomerId: string | null,
  stripeSubId:     string | null,
  onboardedAt:     timestamp | null,
  createdAt:       timestamp,
  updatedAt:       timestamp
}

---

Sub-collection: users/{uid}/portfolios/{portfolioId}
{
  name:      string,
  isDefault: boolean,
  createdAt: timestamp
}

---

Sub-collection: users/{uid}/portfolios/{portfolioId}/holdings/{ticker}
Document ID: {ticker}
{
  ticker:         string,
  shares:         number,
  avgCostBasis:   number | null,
  conviction:     "high" | "medium" | "low" | null,
  notes:          string | null,
  addedAt:        timestamp,
  updatedAt:      timestamp
}

---

Sub-collection: users/{uid}/watchlists/{watchlistId}
{
  name:      string,
  tickers:   string[],   // ordered list, max 5 for Free
  createdAt: timestamp,
  updatedAt: timestamp
}

---

Sub-collection: users/{uid}/alerts/{alertId}
{
  type:             "earnings" | "analyst" | "volume" | "price" | "52wk_breakout" |
                    "peer_move" | "macro_event" | "block_trade" | "13f_filing" |
                    "group_rs_rank" | "options_unusual" | "price_target_hit",
  ticker:           string | null,   // null for macro/market-wide alerts
  threshold:        number | null,
  deliveryChannels: string[],        // ["email", "in_app", "sms", "push"]
  enabled:          boolean,
  createdAt:        timestamp
}

---

Sub-collection: users/{uid}/notifications/{notificationId}
{
  alertId:   string | null,
  type:      string,
  title:     string,
  body:      string,
  link:      string | null,    // deep link in app
  read:      boolean,
  createdAt: timestamp
}
```

---

## 6. Scheduler Summary

| Worker | Source | Frequency | Writes To | Notes |
|---|---|---|---|---|
| Quote Ingestion | Polygon.io WS | Real-time | Redis quote cache (TTL 5s) | NOT Firestore — too expensive |
| OHLCV Ingestion | Polygon.io REST | On-demand + backfill | ClickHouse | Historical tick + candle data |
| News Ingestion | Benzinga WS | Real-time | Firestore `news` | Publish to Redis pub/sub for WS fan-out |
| Earnings Calendar Sync | FMP REST | Every 15 min | Firestore `earnings_events` | Upsert by ticker+quarter key |
| Analyst Actions Ingest | Benzinga REST | Every 5 min | Firestore `analyst_actions` | Real-time feed |
| Macro Calendar Sync | Finnhub REST | Daily 6am ET | Firestore `macro_events` | Upsert by date+event slug |
| Options Flow Ingest | Unusual Whales WS | Real-time | Firestore `options_flow` | Filter for isUnusual=true |
| EDGAR 13F Parser | SEC EDGAR | Nightly + on filing | Firestore `fund_holdings` | Phase 2 |
| Block Trade Ingest | Polygon.io Trades | Real-time | Firestore `block_trades` | Filter: value > $500k or shares > 10k |
| Company Reference Sync | FMP REST | Daily | Firestore `companies` | Full upsert |
| Movers Calculation | ClickHouse + Redis | Every 1 min (market hours) | Firestore `market_movers` | Calculated server-side, snapshot written |
| Story Stocks Worker | BullMQ (triggered) | Event-driven | Firestore `story_stocks` | AI tagging via Claude API |
| EOD Recap Worker | BullMQ cron | 4:30pm ET | Firestore `recaps` | Claude summarizes from structured data |
| Weekly Recap Worker | BullMQ cron | Friday 6pm ET | Firestore `recaps` | Separate Claude call for portfolio tab |

---

## 7. Architecture Notes & Recommendations

### ✅ No Architecture Changes Required

The existing architecture (ECS workers → Firestore + Redis + ClickHouse) is correct as designed. Firebase Auth replaces Auth0 for user identity, Firestore replaces PostgreSQL for all domain data, and Redis + ClickHouse remain for their specific workloads.

### ⚠️ Important: Do NOT write real-time quotes to Firestore

Writing per-tick quote data to Firestore would be prohibitively expensive (Firestore bills per document write). The quote flow must stay:
`Polygon WS → Redis (TTL 5s) → WebSocket Gateway → Client`

### 💡 Consider: Replace WebSocket feed with Firestore real-time listeners

For the news/analyst actions live feed (not quotes), you could use **Firestore real-time listeners** on the client instead of the WebSocket + Redis pub/sub fan-out. Benefits:
- Removes the WebSocket gateway ECS service
- Built-in offline support and reconnect
- Simpler client code

Downside: Firestore charges per read per listener update at scale. For 1,000+ concurrent users on a busy day, Redis pub/sub + WebSocket remains cheaper. Recommend keeping WebSocket for now; revisit at 500+ paid subscribers.

### ⚠️ Transcript Vendor

The image lists Motley Fool Transcripts API and Refinitiv — both are enterprise-priced and not practical for MVP.

**Recommendation**: Use **FMP earnings transcripts** (included in paid FMP plan) as primary. Benzinga also offers Conference Call Transcripts as an add-on. Only add Intrinio if transcript coverage proves insufficient.

### 💡 Firestore Indexes

Define these in `firestore.indexes.json` before go-live (Firestore requires composite indexes for multi-field queries):
- `news`: `(tickers array-contains, publishedAt DESC)`
- `news`: `(categories array-contains, publishedAt DESC)`
- `analyst_actions`: `(ticker ASC, publishedAt DESC)`
- `earnings_events`: `(reportDate ASC, session ASC)`
- `options_flow`: `(ticker ASC, tradeTime DESC)`
- `market_movers`: `(date DESC, session ASC, type ASC)`

### 📋 New File Needed

Add a `06_Firestore_Security_Rules.md` or `firestore.rules` file defining read/write access per collection. Suggested rule: all market data collections (news, earnings, analyst_actions, etc.) are readable by any authenticated user; writes are server-side only (Firebase Admin SDK from ECS workers, blocked on client).
