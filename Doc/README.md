# MarketCatalyst — Market Intelligence Terminal

A subscription-based active-investor research platform that consolidates earnings, analyst actions, market movers, screening, insider/institutional flows, macro, and portfolio tools into a single dark-themed terminal. Built with Next.js 16 App Router (static export), Firebase Auth + Firestore, and Redux Toolkit.

15 of 18 screens now read at least some live data, additively merged onto the original mock UI (nothing was deleted to make room for it) — see `Doc/screen-data-sources.md` for the accurate, per-screen breakdown of what's real vs. still illustrative, and why. Options Chain's main bid/ask/IV/greeks/OI table stays simulated (Polygon's options snapshot is confirmed 403 on the current plan; would need an upgrade or a Tradier key), and Recaps remains fully static (blocked on `ANTHROPIC_API_KEY` + a new job).

Recent additions (2026-07-08/09): full US ticker universe (~10,000+ tickers, price-only) wired to the Cmd+K search bar; Screener's RS Rating now computed from real OHLCV history instead of not existing at all; news upgraded to Polygon-primary (adds sentiment/reasoning/keywords) with Finnhub as automatic fallback; Portfolio's computed totals (`totalValue`/`dayPL`/`dayPLPct`) are now materialized into Firestore alongside the existing holdings CRUD, so something outside the browser can read portfolio value without recomputing it; a missing Firestore composite index on `ohlcv_bars` (`ticker`+`barDate`, needed by RS Rating and the Stock Detail chart) was found and deployed via a new `firestore.indexes.json`.

Ops tooling (2026-07-09, backend-only — not part of the MarketCatalyst app itself): every sync job now declares which Firestore collection(s) it writes and its cron schedule once, at registration (`backend/src/common/sync-registry.service.ts`); `sync_meta/{jobName}` persists this alongside every run result, and `GET /sync/jobs` additionally computes each job's next scheduled fire time on the fly (via the same `cron` library `@nestjs/schedule` uses internally, so it can't drift from what actually fires). A new `POST /sync/run-all` triggers every job sequentially for manual testing. `backendUI/index.html` (a static ops dashboard, `npx serve -l 4200 backendUI`) surfaces all of this — collections affected, interval, next run — plus a confirm-gated "Run all now" button.

---

## Backend (`backend/`)

A separate NestJS service, not part of this Next.js app, syncs vendor data (Polygon, FMP, Finnhub, FRED, SEC EDGAR) into Firestore on cron schedules — this app reads the results via the Firestore client SDK, same as any other collection, and never calls a vendor directly or holds a vendor key. See `backend/README.md` for how to run it, `Doc/openapi.yaml` for the full documented data contract, and `Doc/schema.sql` for the equivalent relational schema if this ever migrates off Firestore.

### Data flow (verified 2026-07-09)

```
Vendor APIs (Polygon, FMP, Finnhub, FRED, SEC EDGAR)
        │  17 NestJS cron jobs, each on its own periodic interval
        │  (daily/weekly/every-30-min — see backend/README.md's job table)
        ▼
   Cloud Firestore  (backend/src/common/firebase-admin.provider.ts — Admin SDK, server-only)
        │  onSnapshot() real-time listeners (app/iq/hooks/useCollection.ts, useOhlcvBars.ts)
        ▼
   Next.js app (this repo) — every live screen element
```

Confirmed end-to-end, not assumed:
- Every one of the 17 sync jobs in `backend/src/sync/*.job.ts` has a real `@Cron(...)` schedule — none are one-off or manually-triggered-only.
- Zero vendor API domains or vendor API keys are referenced anywhere in `app/` (grepped for Polygon/FMP/Finnhub/FRED/SEC EDGAR URLs and every `NEXT_PUBLIC_*_API_KEY` var name — no matches).
- `.env.local` (frontend env) had 3 live, populated `NEXT_PUBLIC_*` vendor keys left over from before the backend migration, unused by any code — blanked out 2026-07-08 as a security cleanup (was gitignored, never committed, so not a git-history leak, but no reason for a live credential to sit there once the frontend stopped calling vendors directly).

Where the requirement isn't yet fully met: not every screen element has a live source wired up yet (some genuinely have none — AI content needs Claude, some are intentionally curated/editorial, not vendor data at all). See `Doc/screen-data-sources.md` for the exhaustive, per-element breakdown of what's live vs. still illustrative, and exactly why for each one.

---

## Project Structure

```
app/
├── page.tsx              # Landing page (/) — marketing page with inline login modal
├── layout.tsx            # Root layout — imports global CSS, sets <html> attributes
├── iq.css                # Design system — CSS custom properties, layout primitives, component classes
├── landing.css           # Landing-page styles — hw-* classes, animations, modal overlay
├── auth/
│   ├── auth-layout.tsx   # Two-panel auth layout (left: marketing, right: glassmorphism card)
│   ├── login/            # /auth/login — standalone login page (AuthLayout + LoginForm)
│   ├── signup/           # /auth/signup — signup page (AuthLayout + SignupForm)
│   └── forgot-password/  # /auth/forgot-password — password reset page
├── dashboard/            # /dashboard — main app shell (IQShell)
├── iq/
│   ├── shell.tsx         # IQShell — sidebar nav, topbar, drawer system, Cmd+K, Copilot panel
│   ├── stock-panel.tsx   # Shared components: StockScreenEmbed, StockRow, StockListCard, ChartCard, StockPanelLayout
│   ├── utils.tsx         # Shared chart + utility components: CandleChart, RsiPane, TrGauge, SemiGauge, Spark, hashStr, earnHistory
│   ├── data.ts           # Static mock data: pulse, earnings, movers, analyst, folio, watch, screener, funds, etc.
│   └── screens/          # One file per workspace screen (watchlist, portfolio, themes, screener, analyst, commentary, etc.)
├── menu/[slug]/          # /menu/:slug — 15 workspace screens
├── profile/edit/         # /profile/edit — investor profile setup
└── settings/             # /settings — preferences (dark mode, etc.)
```

---

## Auth Flow

```
Landing (/)
  ├── "Log in" button  →  inline modal on landing page (LoginForm)
  │     └── success    →  /dashboard
  │     └── "Forgot?"  →  /auth/forgot-password  →  "Back to sign in"  →  /
  │     └── "Sign up"  →  /auth/signup
  └── "Sign up" button →  /auth/signup  →  success  →  /dashboard
        └── "Sign in"  →  / (landing page, open modal manually)

Auth pages all carry MarketCatalyst logo → / (landing page)
```

---

## Mobile Responsive

The web app is fully responsive at `≤767px` (mobile) and `≤900px` (auth pages):

- **Shell**: Grid collapses to single-column. Rail becomes a fixed slide-in drawer triggered by a hamburger button (`.mob-ham`). The scrim (`.mob-nav-scrim`) is placed inside `.app` to share the same CSS stacking context as the rail (z-200), preventing it from blocking nav taps.
- **Drawers & Copilot**: Drawers become bottom-sheets (`border-radius` on top corners). Copilot FAB becomes an icon-only 48px circle.
- **Options page**: Expiry tabs scroll horizontally (`flex-wrap: nowrap; overflow-x: auto`). Stock header meta wraps below price at narrow widths.
- **Auth pages**: Two-panel `AuthLayout` collapses at `≤900px` (stacks vertically) and at `≤600px` the marketing panel is hidden — only the form card is shown, full-width.

---

## Navigation

The shell (`IQShell`) wraps every authenticated page with a left sidebar of 14 workspaces grouped into three categories:

| Group | Workspace |
|---|---|
| Intelligence | Dashboard, Earnings, Market Movers, Market Heatmap, Analyst Actions, Screener, IPOs, Stock Detail, Options, Insider & Institutional |
| My Money | Portfolio Pulse, Watchlist, Themes |
| Context | Commentary, Recaps, Macro & VIX |

---

## Design System

Defined in `app/iq.css` via CSS custom properties on `:root`:

| Token | Value | Usage |
|---|---|---|
| `--brand` | `#7C6CF5` | Primary purple |
| `--brand-2` | `#9B8BFF` | Lighter purple accent |
| `--ai` | `#34E2F0` | AI teal / gradient endpoint |
| `--up` | `#2FE6A6` | Positive / gain |
| `--down` | `#FF5470` | Negative / loss |
| `--bg` | `#080B11` | App background |
| `--surface-0/1/2/3` | Dark surfaces | Card backgrounds |

Key component classes: `.pill`, `.pill.up/.down/.ai/.hold/.dn/.amc`, `.card`, `.col-N`, `.tr-badge`, `.ai-block`, `.wmn`, `.filt`, `.dd`

**Mobile classes** (desktop-hidden by default, activated in `@media (max-width: 767px)`): `.mob-ham`, `.mob-brand`, `.mob-rail-head`, `.mob-nav-close`, `.mob-nav-scrim`, `.mob-open` (on `.rail`)

---

## Development

```bash
npm run dev          # dev server (Turbopack)
npm run build        # static export to /out
firebase deploy      # deploy to Firebase Hosting
```

Runs on Next.js 16.2.9 with `output: 'export'`. All 24 routes are pre-rendered as static HTML.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 App Router (`output: 'export'`) |
| Auth | Firebase Authentication (email/password + Google OAuth, iOS Safari-safe via `indexedDBLocalPersistence` + popup-first) |
| Database | Cloud Firestore |
| State | Redux Toolkit |
| Styling | CSS custom properties (no Tailwind) |
| Hosting | Firebase Hosting |
| Backend | Separate NestJS service (`backend/`) — see its own README |
| Data — live | Polygon.io, FMP, Finnhub, FRED, SEC EDGAR (via `backend/`, synced to Firestore) |
| Data — blocked (no key / plan restriction) | Benzinga, Tradier, Unusual Whales |
| AI (planned) | Claude API — needs `ANTHROPIC_API_KEY`, not yet obtained |
| Payments (planned) | Stripe — not yet implemented; Firestore tier-gating is currently relaxed to any authenticated user |
