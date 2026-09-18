import Link from "next/link";
import { AuthBackdrop } from "./auth-backdrop";
import { ReactNode } from "react";

const PILLS = [
  { label: "14 live workspaces",     d: ".30s" },
  { label: "AI-generated briefs",    d: ".45s" },
  { label: "Earnings hub",           d: ".60s" },
  { label: "Analyst actions",        d: ".75s" },
  { label: "Portfolio Pulse",        d: ".90s" },
  { label: "Insider & 13F flows",    d: "1.05s" },
  { label: "Market screener",        d: "1.20s" },
  { label: "VIX & macro",            d: "1.35s" },
];

interface AuthLayoutProps {
  children: ReactNode;
}

/**
 * The shell both auth screens sit in: marketing on the left, form card on the
 * right.
 *
 * The signup form is long — a full investor profile, eleven fields plus asset
 * classes — so the card is the thing that scrolls, not the page. Letting the
 * document scroll instead dragged the marketing column off the top and left a
 * screen and a half of empty space beside the form. Keeping the scroll inside
 * the card holds the composition together however tall the form gets, and the
 * login card, which is short, never scrolls at all: `max-height` only bites
 * when there is something to bite on.
 *
 * Below 900px the columns stack and the inner scroll is switched off — a
 * scrolling region inside a scrolling page is a trap on touch, where the
 * browser has to guess which one your finger meant.
 *
 * Every colour here is a token from iq.css. These screens sit outside
 * `.iq-root`, so they always render the dark palette from `:root` — but they
 * read it from the same variables as everything else, which is what keeps them
 * from drifting out of step with the product.
 */
export function AuthLayout({ children }: Readonly<AuthLayoutProps>) {
  return (
    <div className="lp-root lp-auth-root">
      {/* Inside .lp-root, not beside it: that element paints an opaque
          gradient, so a sibling backdrop (the old .sp-grid) sat underneath it
          and never showed. */}
      <AuthBackdrop />

      <div className="lp-auth-cols">

        {/* ── LEFT: marketing panel ── */}
        <div className="lp-auth-left">

          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "24px" }}>
            <span className="hw-logo" style={{ width: 46, height: 46, borderRadius: 13, boxShadow: "0 0 28px -6px var(--brand)" }}>
              <svg viewBox="0 0 24 24" width={22} height={22} fill="none">
                <path d="M3 17l5-6 4 4 6-9" stroke="var(--on-brand)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="20" cy="5.5" r="2.4" fill="var(--on-brand)" />
              </svg>
            </span>
          </div>

          {/* Word mark */}
          <div style={{
            fontFamily: "var(--f-display)", fontSize: "2.7rem", fontWeight: 700,
            color: "var(--text-hi)", letterSpacing: "-.02em",
            animation: "spUp .7s ease .5s both", opacity: 0,
          }}>
            MarketCatalyst
          </div>

          {/* Shimmer tag */}
          <div style={{
            fontFamily: "var(--f-display)", fontSize: "1.05rem", fontWeight: 600,
            marginTop: 6,
            background: "linear-gradient(90deg,var(--brand-2),var(--ai),var(--brand-2),var(--ai),var(--brand-2))",
            backgroundSize: "220% auto",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            animation: "spUp .7s ease .8s both, tagShimmer 8s linear 1.2s infinite",
            opacity: 0,
          }}>
            Market Intelligence Terminal
          </div>

          {/* Description */}
          <div style={{
            color: "var(--text)", fontSize: ".9rem", lineHeight: 1.65,
            margin: "18px auto 0", maxWidth: 420,
            animation: "spUp .7s ease 1.05s both", opacity: 0,
          }}>
            Everything you need to research a name — earnings, signals, movers and your portfolio — all in one terminal.
          </div>

          {/* Feature pills */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center", marginTop: "22px" }}>
            {PILLS.map(p => (
              <div
                key={p.label}
                style={{
                  fontSize: ".72rem", fontWeight: 600, color: "var(--text)",
                  background: "var(--brand-dim)", border: "1px solid var(--brand-line)",
                  padding: "6px 11px", borderRadius: "999px",
                  display: "inline-flex", alignItems: "center", gap: "7px",
                  opacity: 0, transform: "translateY(12px)",
                  animation: `spUp .55s cubic-bezier(.2,.8,.3,1) ${p.d} both`,
                }}
              >
                <i style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ai)", boxShadow: "0 0 7px var(--ai)", display: "inline-block" }} />
                {p.label}
              </div>
            ))}
          </div>

        </div>

        {/* ── RIGHT: form card ── */}
        <div className="lp-auth-form">
          <div className="lp-auth-card">
            {/* Stays put while the form scrolls under it. */}
            <Link href="/" className="lp-auth-brand">
              <span className="hw-logo" style={{ width: 26, height: 26, borderRadius: 7 }}>
                <svg viewBox="0 0 24 24" width={14} height={14} fill="none">
                  <path d="M3 17l5-6 4 4 6-9" stroke="var(--on-brand)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="20" cy="5.5" r="2.4" fill="var(--on-brand)" />
                </svg>
              </span>
              <span style={{ fontFamily: "var(--f-display)", fontWeight: 700, fontSize: ".95rem", color: "var(--text-hi)" }}>
                MarketCatalyst
              </span>
            </Link>

            <div className="lp-auth-scroll">{children}</div>
          </div>
        </div>

      </div>

      {/* Keyframes injected inline (SSR-safe) */}
      <style>{`
        @keyframes spUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:none} }
        @keyframes spRightIn { from{opacity:0;transform:translateX(34px)} to{opacity:1;transform:none} }
        @keyframes tagShimmer { to{background-position:220% center} }

        /* ---- Market backdrop ---- */
        .au-bg {
          position: absolute;
          inset: 0;
          z-index: 0;
          overflow: hidden;
          pointer-events: none;
          /* Low enough that the form card and the marketing copy stay the
             subject; the card's own blur softens whatever falls behind it. */
          opacity: .42;
        }
        .au-bg svg { width: 100%; height: 100%; display: block; }
        .au-bg-grid { stroke: var(--border); stroke-width: 1; opacity: .7; }
        .au-bg-area { fill: url(#auArea); }
        .au-bg-stop-a { stop-color: var(--brand); stop-opacity: .3; }
        .au-bg-stop-b { stop-color: var(--brand); stop-opacity: 0; }
        .au-bg-line { fill: none; stroke: var(--brand); stroke-width: 2; opacity: .5; }
        .au-bg-wick { stroke-width: 1.4; }
        .au-bg-body { opacity: .55; }
        .au-bg-up .au-bg-wick { stroke: var(--brand); }
        .au-bg-up .au-bg-body, .au-bg-up .au-bg-vol { fill: var(--brand); }
        .au-bg-dn .au-bg-wick { stroke: var(--down); }
        .au-bg-dn .au-bg-body, .au-bg-dn .au-bg-vol { fill: var(--down); }
        .au-bg-vol { opacity: .26; }
        .au-scrim {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background:
            radial-gradient(ellipse 44% 40% at 32% 50%, rgba(7,8,10,.94), rgba(7,8,10,.6) 55%, transparent 78%),
            linear-gradient(to bottom, rgba(7,8,10,.75), transparent 28%);
        }
        @media(max-width:600px){
          /* The card fills the screen here, so the scrim only needs to cover
             the top strip the brand mark sits on. */
          .au-scrim { background: linear-gradient(to bottom, rgba(7,8,10,.8), transparent 30%); }
        }

        /* The card is the subject on a phone, where it fills the screen —
           pull the chart back so it does not compete through the blur. */
        @media(max-width:600px){
          .au-bg { opacity: .3; }
        }

        .lp-auth-root {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 24px;
        }
        .lp-auth-cols {
          display: flex;
          gap: 46px;
          align-items: center;
          justify-content: center;
          max-width: 1060px;
          width: 100%;
          position: relative;
          z-index: 1;
        }
        .lp-auth-left { flex: 1 1 0; max-width: 560px; text-align: center; }
        .lp-auth-form { flex: 0 0 380px; max-width: 94vw; }

        .lp-auth-card {
          display: flex;
          flex-direction: column;
          /* The viewport, less this screen's own padding. Anything taller
             scrolls inside the card rather than moving the page. */
          max-height: calc(100vh - 80px);
          background: var(--surface-glass);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid var(--brand-line);
          border-radius: 18px;
          /* Clips the scroll region to the rounded corners, so the scrollbar
             stops short of them instead of cutting across. */
          overflow: hidden;
          box-shadow: 0 26px 64px rgba(0,0,0,.6), 0 0 0 1px var(--brand-dim) inset;
          animation: spRightIn .7s cubic-bezier(.2,.8,.3,1) .3s both;
          opacity: 0;
        }
        .lp-auth-brand {
          flex: none;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 22px 26px 16px;
          border-bottom: 1px solid var(--border-soft);
          text-decoration: none;
        }
        .lp-auth-scroll {
          /* min-height:0 or the flex item refuses to shrink below its content
             and the max-height above never takes effect. */
          min-height: 0;
          overflow-y: auto;
          overscroll-behavior: contain;
          padding: 22px 26px 22px;
          scrollbar-width: thin;
          scrollbar-color: var(--border-strong) transparent;
        }
        .lp-auth-scroll::-webkit-scrollbar { width: 9px; }
        .lp-auth-scroll::-webkit-scrollbar-track { background: transparent; }
        .lp-auth-scroll::-webkit-scrollbar-thumb {
          background: var(--border-strong);
          border-radius: 999px;
          border: 3px solid transparent;
          background-clip: content-box;
        }
        .lp-auth-scroll::-webkit-scrollbar-thumb:hover { background: var(--brand-line); background-clip: content-box; }

        /* Tablet: stack columns vertically, and let the page scroll instead of
           the card — a scroll region inside a scrolling page is a trap on
           touch. */
        @media(max-width:900px){
          .lp-auth-root { align-items: flex-start; }
          .lp-auth-cols { flex-direction:column; gap:28px; align-items:center; }
          .lp-auth-left { max-width:520px; }
          .lp-auth-card { max-height:none; }
          .lp-auth-scroll { overflow:visible; }
        }

        /* Mobile: hide marketing panel, center form, reduce padding */
        @media(max-width:600px){
          .lp-auth-left { display:none; }
          .lp-auth-cols { padding:0; }
          .lp-auth-form { flex:none; width:100%; max-width:100%; }
          .lp-auth-root { padding:40px 16px 20px; }
          .lp-auth-brand { padding:18px 20px 14px; }
          .lp-auth-scroll { padding:18px 20px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .lp-auth-card, .lp-auth-left * { animation: none !important; opacity: 1 !important; transform: none !important; }
        }
      `}</style>
    </div>
  );
}
