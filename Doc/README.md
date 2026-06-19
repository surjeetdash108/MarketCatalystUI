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
├── menu/[slug]/          # /menu/:slug — 14 workspace screens
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

## Navigation

The shell (`IQShell`) wraps every authenticated page with a left sidebar of 14 workspaces grouped into three categories:

| Group | Workspace |
|---|---|
| Intelligence | Dashboard, Earnings, Market Movers, Market Heatmap, Analyst Actions, Screener, IPOs, Commentary |
| My Money | Portfolio Pulse, Watchlist, Insider & Institutional |
| Context | Recaps, Macro & VIX, Stock Detail |

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
| Auth | Firebase Authentication (email/password + Google OAuth) |
| Database | Cloud Firestore |
| State | Redux Toolkit |
| Styling | CSS custom properties (no Tailwind) |
| Hosting | Firebase Hosting |
| Data (planned) | Polygon.io, FMP, Benzinga, Unusual Whales, SEC EDGAR |
| AI (planned) | Claude API (claude-sonnet-4-6) |
| Payments (planned) | Stripe |
