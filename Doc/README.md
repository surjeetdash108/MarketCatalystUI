# StockWise — Market Intelligence Terminal

A subscription-based active-investor research platform that consolidates earnings, analyst actions, market movers, screening, insider/institutional flows, macro, and portfolio tools into a single dark-themed terminal. Built with Next.js 16 App Router (static export), Firebase Auth + Firestore, and Redux Toolkit.

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

Auth pages all carry StockWise logo → / (landing page)
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
| Data (planned) | Polygon.io, FMP, Benzinga, Unusual Whales, SEC EDGAR |
| AI (planned) | Claude API (claude-sonnet-4-6) |
| Payments (planned) | Stripe |
