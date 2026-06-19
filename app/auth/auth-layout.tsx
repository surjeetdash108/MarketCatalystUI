import Link from "next/link";
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

export function AuthLayout({ children }: Readonly<AuthLayoutProps>) {
  return (
    <div className="lp-root" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
      <div className="sp-grid" />

      <div style={{
        display: "flex", gap: "46px", alignItems: "center",
        justifyContent: "center", maxWidth: "1060px", width: "100%",
        position: "relative", zIndex: 1,
      }}>

        {/* ── LEFT: marketing panel ── */}
        <div style={{ flex: "1 1 0", maxWidth: "560px", textAlign: "center" }}>

          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "24px" }}>
            <span className="hw-logo" style={{ width: 46, height: 46, borderRadius: 13, boxShadow: "0 0 28px -6px var(--brand)" }}>
              <svg viewBox="0 0 24 24" width={22} height={22} fill="none">
                <path d="M3 17l5-6 4 4 6-9" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="20" cy="5.5" r="2.4" fill="#fff" />
              </svg>
            </span>
          </div>

          {/* Word mark */}
          <div style={{
            fontFamily: "var(--f-display)", fontSize: "2.7rem", fontWeight: 700,
            color: "#fff", letterSpacing: "-.02em",
            animation: "spUp .7s ease .5s both", opacity: 0,
          }}>
            Stock<b style={{ background: "linear-gradient(90deg,var(--brand-2),var(--ai))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Wise</b>
          </div>

          {/* Shimmer tag */}
          <div style={{
            fontFamily: "var(--f-display)", fontSize: "1.05rem", fontWeight: 600,
            marginTop: 6,
            background: "linear-gradient(90deg,#b3a8ff,var(--ai),var(--brand-2),var(--ai),#b3a8ff)",
            backgroundSize: "220% auto",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            animation: "spUp .7s ease .8s both, tagShimmer 8s linear 1.2s infinite",
            opacity: 0,
          }}>
            Market Intelligence Terminal
          </div>

          {/* Description */}
          <div style={{
            color: "#9aa6b8", fontSize: ".9rem", lineHeight: 1.65,
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
                  fontSize: ".72rem", fontWeight: 600, color: "#cdd6e6",
                  background: "rgba(124,108,245,.12)", border: "1px solid rgba(124,108,245,.3)",
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
        <div style={{ flex: "0 0 380px", maxWidth: "94vw" }}>
          <div style={{
            background: "rgba(12,18,32,.82)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid rgba(124,108,245,.28)",
            borderRadius: "18px",
            padding: "26px 26px 22px",
            boxShadow: "0 26px 64px rgba(0,0,0,.6), 0 0 0 1px rgba(124,108,245,.08) inset",
            animation: "spRightIn .7s cubic-bezier(.2,.8,.3,1) .3s both",
            opacity: 0,
          }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, textDecoration: "none" }}>
              <span className="hw-logo" style={{ width: 26, height: 26, borderRadius: 7 }}>
                <svg viewBox="0 0 24 24" width={14} height={14} fill="none">
                  <path d="M3 17l5-6 4 4 6-9" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="20" cy="5.5" r="2.4" fill="#fff" />
                </svg>
              </span>
              <span style={{ fontFamily: "var(--f-display)", fontWeight: 700, fontSize: ".95rem", color: "#fff" }}>
                Stock<b style={{ color: "var(--ai)" }}>Wise</b>
              </span>
            </Link>
            {children}
          </div>
        </div>

      </div>

      {/* Keyframes injected inline (SSR-safe) */}
      <style>{`
        @keyframes spUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:none} }
        @keyframes spRightIn { from{opacity:0;transform:translateX(34px)} to{opacity:1;transform:none} }
        @keyframes tagShimmer { to{background-position:220% center} }
        @media(max-width:900px){
          .lp-auth-cols{flex-direction:column!important;gap:28px!important}
        }
      `}</style>
    </div>
  );
}
