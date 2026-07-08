# StockWise Backend

A NestJS service that syncs third-party market-data vendors (Polygon, FMP,
Finnhub, SEC EDGAR) into Firestore on cron schedules. The Next.js frontend
(`app/`) never calls vendor APIs directly and never sees a vendor key — it
reads the resulting Firestore collections via the client SDK. This service
exposes no data-read REST API of its own; it's an ingestion/ops layer only.

See **`Doc/openapi.yaml`** for the full documented data contract (every
Firestore collection this service produces, its schema, source vendor,
alternate source, and fallback behavior) and **`Doc/schema.sql`** for the
equivalent relational schema if this ever migrates off Firestore.

## Architecture in one paragraph

Each `backend/src/sync/*.job.ts` is a `@nestjs/schedule` cron job that calls
a vendor client in `backend/src/vendors/`, normalizes the response, and
writes it to a Firestore collection via the Admin SDK
(`backend/src/common/firebase-admin.provider.ts`). Two data needs
(`companies`, `market-movers`, and their enrichment step) go through a small
adapter layer in `backend/src/adapters/` instead of calling a vendor
directly — each has two working vendor implementations behind a
`Composite*Adapter` with automatic fallback, so a vendor outage degrades
gracefully (tagged with a `FALLBACK_USED` warning) instead of failing the
sync. Every job records its last-run status to the `sync_meta` Firestore
collection, readable via `GET /sync/jobs`.

## Running it

```bash
npm install
cp .env.example .env   # fill in vendor keys — see the file for what's required vs. optional
npm run start:dev      # watch mode, restarts on file changes
```

Requires either `service-account.json` (Firebase service account key) or
`gcloud auth application-default login` for Firestore access — see
`FirebaseAdminService` for the fallback order.

`macro-events` additionally needs a free `FRED_API_KEY` from
https://fredaccount.stlouisfed.org/apikeys — without it the job logs a
warning and fails on run, same as any other missing vendor key.

Listens on `PORT` from `.env` (default 4100).

## Endpoints (ops only — not a data API)

| Endpoint | Purpose |
|---|---|
| `GET /health` | Liveness check |
| `GET /sync/jobs` | Every registered job + running state + last-run status (used by `backendUI/index.html`, a static ops dashboard — `npx serve -l 4200 backendUI`) |
| `GET /sync/status` | Raw `sync_meta` for every job |
| `GET /sync/:job/status` | `sync_meta` for one job |
| `POST /sync/:job/run` | Manually trigger a job (for testing) |

## Sync jobs

| Job | Vendor(s) | Cron | Writes to |
|---|---|---|---|
| `companies` | FMP (primary) → Polygon (fallback) | Daily 02:00 ET, rotating 60-ticker batch | `companies/{ticker}` |
| `market-movers` | Polygon (primary) → FMP (fallback); FMP (primary) → Polygon (fallback) for name/sector/cap enrichment | Daily 18:00 ET | `market_movers/{direction_TICKER}` + `market_movers_history/{date}_{direction}_{ticker}` |
| `sectors` | FMP | Daily 18:00 ET | `sectors/{sectorSlug}` + `sectors_history/{date}_{sectorSlug}` |
| `market-indices` | Finnhub (ETF proxies — see the job's docblock for caveats) | Daily 18:05 ET | `market_indices/{symbol}` + `market_indices_history/{date}_{symbol}` |
| `earnings` | FMP | Daily 06:00 ET | `earnings_events/{ticker}_{date}` |
| `analyst-actions` | FMP (consensus snapshot, not a per-firm event feed) | Daily 06:00 ET, rotating batch | `analyst_actions/{ticker}` |
| `news` | Polygon `/v2/reference/news` (primary, verified 2026-07-08 — adds sentiment/reasoning/keywords Finnhub lacks) → Finnhub `/company-news` (fallback); adapter-selected via `NEWS_SOURCE`/`NEWS_FALLBACK_SOURCE` | Every 30 min, market hours | `news/{ticker}_{articleId}` |
| `sec-13f` | SEC EDGAR | Nightly 01:00 ET | `fund_holdings/{cik}(/filings/{accessionNumber}/positions/{cusip})` |
| `sec-form4` | SEC EDGAR | Nightly 01:30 ET, rotating batch | `insider_transactions/{accessionNumber}_{i}` |
| `ticker-universe` | Polygon (full US ticker discovery — no fundamentals) | Weekly, Sunday 03:00 ET | `tickers/{ticker}` |
| `macro-events` | FRED (Finnhub's `/calendar/economic` is confirmed blocked — see `FinnhubService`) | Daily 18:10 ET | `macro_events/{seriesId}` |
| `ipos` | Finnhub `/calendar/ipo` (a separate endpoint from its blocked economic calendar — verified 2026-07-07; FMP's `ipos-calendar` is still confirmed restricted) | Daily 06:15 ET | `ipos/{date}_{symbol\|slug}` |
| `options-chains` | Polygon (contracts reference + delayed EOD aggs; options snapshot/quotes confirmed 403 on this plan — see `PolygonService`) | Daily 19:00 ET | `options_chains/{underlyingTicker}` |
| `dividends` | FMP `/stable/dividends-calendar` (verified working 2026-07-07 — unlike the confirmed-restricted economic-calendar/ipos-calendar on this same plan) | Daily 06:20 ET | `dividends/{ticker}` |
| `stock-history` | Polygon EOD aggregates, incremental via per-ticker `sync_watermarks` (~300-day backfill, then only new days each run) | Daily 03:00 ET, rotating 60-ticker batch | `ohlcv_bars/{ticker}_{date}` |
| `market-quotes` | Polygon grouped-daily, diffed across 2 days (same diff `market-movers` uses — see `polygon-diff.util.ts`) — near-free, no new API calls beyond what movers already makes | Daily 18:07 ET | `tickers/{ticker}` (price/pctChange/volume merged onto the reference doc, for the WHOLE market, not just the curated 241) |
| `rs-rating` | None — pure internal computation from `ohlcv_bars`, no vendor call, no key. An independent from-scratch approximation of an IBD-style relative-strength score, not the literal proprietary IBD formula. Writes nothing useful until `stock-history` has accumulated enough real history. | Daily 04:00 ET | `companies/{ticker}` (`rsRating` field only, merged) |

Not yet built (see `Doc/openapi.yaml`'s `x-status: planned` paths for what
each needs):
`options-flow`, `block-trades`, `recaps`,
`analyst-actions/events`. A Screener RS-Rating computation also isn't built
yet — it depends on `stock-history` accumulating enough of TICKER_UNIVERSE's
history first, and needs its own dedicated ranking job.

## Vendor source swapping and fallback

`companies` and `market-movers` (+ its enrichment step) are each backed by
two working vendor implementations wired behind a composite adapter with
automatic fallback — see `backend/src/adapters/adapters.module.ts` and the
`COMPANY_PROFILE_SOURCE` / `MOVERS_SOURCE` / `MOVER_ENRICHMENT_SOURCE`
(+ `*_FALLBACK_SOURCE`) env vars in `.env.example`. Swapping which vendor is
primary, or disabling fallback, is a config change — no code, Firestore
schema, or frontend changes required. A served document's `source` field
records which adapter actually produced it, and a `warnings` array
surfaces any degradation (fallback used, a sub-request failed, a field this
vendor structurally doesn't support) instead of a silent null.

## Testing a job manually

```bash
curl -X POST http://localhost:4100/sync/companies/run
curl http://localhost:4100/sync/jobs | jq
```
