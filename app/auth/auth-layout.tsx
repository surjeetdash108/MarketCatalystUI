import Link from "next/link";
import { ReactNode } from "react";

const FEATURES = [
  { label: "Live Signals",   value: "128",  detail: "+14 today",  color: "var(--up)" },
  { label: "AI Copilot",     value: "On",   detail: "GPT-4o",     color: "var(--ai)" },
  { label: "13F Funds",      value: "5",    detail: "tracked",    color: "var(--brand-2)" },
];

const BULLETS = [
  { icon: "◆", c: "var(--ai)",      text: "AI-generated earnings briefs pushed before market open" },
  { icon: "▲", c: "var(--up)",      text: "Institutional 13F flow parsed the day filings hit EDGAR" },
  { icon: "★", c: "var(--brand-2)", text: "Screener with RS, sales growth, EPS expansion in one view" },
  { icon: "●", c: "var(--warn)",    text: "Portfolio Pulse: AI summary of what moved your names today" },
];

interface AuthLayoutProps {
  children: ReactNode;
  wide?: boolean;
}

export function AuthLayout({ children, wide = false }: Readonly<AuthLayoutProps>) {
  const S: Record<string, React.CSSProperties> = {
    root: {
      minHeight: "100vh",
      background: "var(--bg)",
      fontFamily: "var(--f-body)",
      color: "var(--text)",
      WebkitFontSmoothing: "antialiased",
      position: "relative",
    },
    glow: {
      position: "fixed",
      inset: 0,
      background: [
        "radial-gradient(ellipse 60% 40% at 70% -10%, rgba(124,108,245,.22) 0%, transparent 60%)",
        "radial-gradient(ellipse 40% 30% at 100% 60%, rgba(52,226,240,.12) 0%, transparent 55%)",
        "radial-gradient(ellipse 50% 50% at -5% 80%, rgba(124,108,245,.1) 0%, transparent 60%)",
      ].join(","),
      pointerEvents: "none",
      zIndex: 0,
    },
    grid: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      minHeight: "100vh",
      position: "relative",
      zIndex: 1,
    },
    left: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 32px",
      minHeight: "100vh",
    },
    inner: {
      width: "100%",
      maxWidth: wide ? 720 : 420,
    },
    logo: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      marginBottom: 36,
      textDecoration: "none",
    },
    logoOrb: {
      width: 38,
      height: 38,
      borderRadius: 10,
      background: "radial-gradient(circle at 35% 30%, var(--ai-2), var(--ai) 60%, #1d8d99)",
      boxShadow: "0 0 20px -4px var(--ai)",
      display: "grid",
      placeItems: "center",
    },
    logoText: {
      fontFamily: "var(--f-display)",
      fontWeight: 700,
      fontSize: "1.15rem",
      color: "var(--text-hi)",
      letterSpacing: "-.01em",
    },
    logoSub: {
      fontSize: ".65rem",
      color: "var(--text-dim-solid)",
      marginTop: 1,
      letterSpacing: ".08em",
      textTransform: "uppercase" as const,
    },
    right: {
      background: "linear-gradient(160deg, var(--surface-2) 0%, var(--surface-0) 100%)",
      borderLeft: "1px solid var(--border)",
      padding: "60px 48px",
      display: "flex",
      alignItems: "center",
    },
  };

  return (
    <div style={S.root}>
      <div style={S.glow} />
      <div style={S.grid}>

        {/* ---- Left: Form panel ---- */}
        <div style={S.left}>
          <div style={S.inner}>
            <Link href="/" style={S.logo}>
              <div style={S.logoOrb}>
                <svg viewBox="0 0 24 24" fill="none" style={{ width: 18, height: 18, color: "#05222a" }}>
                  <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9z" fill="currentColor" />
                  <circle cx="18.5" cy="17.5" r="2" fill="currentColor" />
                </svg>
              </div>
              <div>
                <div style={S.logoText}>InvestIQ</div>
                <div style={S.logoSub}>Market Intelligence</div>
              </div>
            </Link>
            {children}
          </div>
        </div>

        {/* ---- Right: Brand panel ---- */}
        <div style={S.right}>
          <div style={{ width: "100%" }}>
            <div style={{
              fontSize: ".64rem", fontWeight: 600, letterSpacing: ".18em",
              textTransform: "uppercase", color: "var(--brand-2)", marginBottom: 14,
              fontFamily: "var(--f-display)",
            }}>
              Market Intelligence Platform
            </div>
            <h2 style={{
              fontFamily: "var(--f-display)", fontWeight: 700,
              fontSize: "2.2rem", lineHeight: 1.2, color: "var(--text-hi)",
              letterSpacing: "-.02em", maxWidth: 380, marginBottom: 32,
            }}>
              Authenticated intelligence for faster portfolio decisions.
            </h2>

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 32 }}>
              {FEATURES.map(f => (
                <div key={f.label} style={{
                  background: "var(--surface-1)", border: "1px solid var(--border)",
                  borderRadius: "var(--r-lg)", padding: "14px 16px",
                }}>
                  <div style={{ fontSize: ".62rem", fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-dim-solid)" }}>
                    {f.label}
                  </div>
                  <div style={{ fontFamily: "var(--f-mono)", fontSize: "1.6rem", fontWeight: 700, color: "var(--text-hi)", margin: "6px 0 3px" }}>
                    {f.value}
                  </div>
                  <div style={{ fontSize: ".72rem", fontWeight: 600, color: f.color }}>
                    {f.detail}
                  </div>
                </div>
              ))}
            </div>

            {/* Bullet features */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {BULLETS.map(b => (
                <div key={b.text} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ color: b.c, fontSize: ".8rem", marginTop: 1, flexShrink: 0 }}>{b.icon}</span>
                  <span style={{ fontSize: ".84rem", color: "var(--text)", lineHeight: 1.5 }}>{b.text}</span>
                </div>
              ))}
            </div>

            <div style={{
              marginTop: 36, paddingTop: 20, borderTop: "1px solid var(--border-soft)",
              fontSize: ".7rem", color: "var(--text-dim-solid)",
            }}>
              AI-generated · not investment advice · data for informational purposes only
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
