"use client";

import "../iq.css";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { signOut } from "firebase/auth";
import { firebaseAuth } from "../firebase";
import { useAppSelector } from "../store/hooks";
import { AuthGuard } from "../dashboard/auth-guard";
import { menuItems } from "../dashboard/menu-items";
import { pulse, stockInfo, sectorByName, funds, earnings as earningsData, type StockInfo, type SectorRow, type Fund, type Earning } from "./data";
import { fmt, sign, cls, arr, Spark, gaugeSVG } from "./utils";

// ---- Route helpers ----
function slugToHref(slug: string): string {
  return slug === "dashboard" ? "/dashboard" : `/menu/${slug}`;
}

// ---- IQ Actions context ----
interface IQActions {
  openStock: (sym: string) => void;
  openEarnings: (sym: string) => void;
  openSector: (name: string) => void;
  openFund: (idx: number) => void;
  setCopilot: (open: boolean) => void;
  theme: "dark" | "light";
  setTheme: (t: "dark" | "light") => void;
}
export const IQActionsContext = createContext<IQActions>({
  openStock: () => {},
  openEarnings: () => {},
  openSector: () => {},
  openFund: () => {},
  setCopilot: () => {},
  theme: "dark",
  setTheme: () => {},
});
export function useIQActions() { return useContext(IQActionsContext); }

// ---- Nav icon SVG ----
function NavIcon({ slug }: { slug: string }) {
  const paths: Record<string, string> = {
    dashboard:   "M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z",
    earnings:    "M4 5h16v14H4V5Zm4 4h8M8 13h5",
    movers:      "M4 17 9 12l4 4 7-9M15 7h5v5",
    heatmap:     "M3 3h7v3H3V3Zm11 0h7v3h-7V3ZM3 10h7v4H3v-4Zm11 0h7v4h-7v-4ZM3 18h7v3H3v-3Zm11 0h7v3h-7v-3Z",
    analyst:     "M5 19V5m0 14h14M8 15l3-4 3 2 4-6",
    screener:    "M4 6h16M7 12h10M10 18h4",
    portfolio:   "M4 7h16v11H4V7Zm4 11V7m8 11V7",
    watchlist:   "m12 4 2.4 5 5.6.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.6-.8L12 4Z",
    stock:       "M3 17l4-5 3 3 4-7 5 4",
    thirteenf:   "M6 4h9l3 3v13H6V4Zm8 0v4h4M9 12h6M9 16h6",
    commentary:  "M4 4h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H8l-4 4V5a1 1 0 0 1 1-1Z",
    recap:       "M12 4a8 8 0 1 1 0 16A8 8 0 0 1 12 4Zm0 4v4l3 2",
    macro:       "M5 5h14v15H5V5Zm0 5h14M8 3v4m8-4v4",
  };
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[slug] ?? "M5 12h14"} />
    </svg>
  );
}

// ---- Drawers ----
function StockDrawer({ sym, onClose }: { sym: string; onClose: () => void }) {
  const info: StockInfo = stockInfo[sym] ?? {
    name: sym, px: 0, c: 0, mkt: "—", pe: 0, eps: 0,
    wkh52: 0, wkl52: 0, div: 0, beta: 0, sec: "—",
    ai_call: "Neutral", ai_thesis: "Analysis not yet available.", ai_risk: "Standard market risks apply.",
    ai_metrics: [], fin: [], news: [], ins: [],
  };
  const isUp = info.c >= 0;
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-head">
          <div>
            <div className="sd-sym">{sym}</div>
            <div className="drawer-title">{info.name}</div>
            <div className="drawer-sub">{info.sec}</div>
          </div>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>
        <div className="sd-hero" style={{ marginBottom: 12 }}>
          <span className="sd-px">${fmt(info.px)}</span>
          <span className={`sd-chg ${cls(info.c)}`}>{arr(info.c)} {sign(info.c)}</span>
          <div className="sd-meta">
            <div className="sd-meta-item">Mkt Cap <b>{info.mkt}</b></div>
            <div className="sd-meta-item">P/E <b>{info.pe}×</b></div>
            <div className="sd-meta-item">52W <b>${info.wkl52}–${info.wkh52}</b></div>
            <div className="sd-meta-item">Beta <b>{info.beta}</b></div>
          </div>
        </div>
        <div className="ai-block">
          <div className="ai-icon">✦</div>
          <div className="ai-rating">{info.ai_call}</div>
          <div className="ai-thesis">{info.ai_thesis}</div>
          {info.ai_metrics.map(m => (
            <div key={m.l} className="ai-line">
              <span className="ai-line-lbl">{m.l}</span>
              <span className="ai-line-val">{m.v}</span>
            </div>
          ))}
        </div>
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-h"><h3>Financials</h3></div>
          <div className="card-b">
            {info.fin.map(f => (
              <div key={f.l} className="fin-row">
                <span className="fin-lbl">{f.l}</span>
                <span className="fin-val">{f.v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-h"><h3>Recent News</h3></div>
          <div className="card-b">
            {info.news.map((n, i) => (
              <div key={i} style={{ padding: "8px 0", borderBottom: i < info.news.length - 1 ? "1px solid var(--border-soft)" : "none" }}>
                <div style={{ fontSize: 12.5, color: "var(--text-hi)" }}>{n.h}</div>
                <div style={{ fontSize: 11, color: "var(--text-dim-solid)", marginTop: 2 }}>{n.dt}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-h"><h3>Insider Activity</h3></div>
          <div className="card-b">
            {info.ins.map((ins, i) => (
              <div key={i} className="fin-row">
                <div>
                  <div className="fin-lbl">{ins.n}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text)" }}>{ins.a}</div>
                </div>
                <span className="fin-val">{ins.dt}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function EarningsDrawer({ sym, onClose }: { sym: string; onClose: () => void }) {
  const e = earningsData.find(x => x.s === sym);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-head">
          <div>
            <div className="sd-sym">{sym}</div>
            <div className="drawer-title">{e?.n ?? sym} Earnings</div>
            <div className="drawer-sub">{e?.t ?? "Upcoming"}</div>
          </div>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>
        {e ? (
          <>
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="card-h"><h3>Results</h3></div>
              <div className="card-b">
                {[
                  ["EPS Estimate", `$${e.epsE}`],
                  ["EPS Actual", e.epsA != null ? `$${e.epsA}` : "Pending"],
                  ["EPS Surprise", e.epsA != null ? `${((e.epsA - e.epsE) / e.epsE * 100).toFixed(1)}%` : "—"],
                  ["Rev Estimate", `$${e.revE}B`],
                  ["Rev Actual", e.revA != null ? `$${e.revA}B` : "Pending"],
                  ["Guidance", e.guide ?? "—"],
                  ["Post-Earnings Reaction", e.react != null ? `${e.react > 0 ? "+" : ""}${e.react}%` : "—"],
                ].map(([l, v]) => (
                  <div key={l} className="fin-row">
                    <span className="fin-lbl">{l}</span>
                    <span className="fin-val">{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="card-h"><h3>Tags</h3></div>
              <div className="card-b" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {e.tags.map(t => (
                  <span key={t} className={`tag-chip ${t.toLowerCase()}`}>{t}</span>
                ))}
                {e.owned && <span className="tag-chip owned">Owned</span>}
                <span className="tag-chip" style={{ background: "var(--warn-dim)", color: "var(--warn)" }}>
                  Implied Move ±{e.implied}%
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="card-b">
            <p style={{ color: "var(--text-dim-solid)", fontSize: 13 }}>No earnings data available for {sym}.</p>
          </div>
        )}
      </div>
    </>
  );
}

function SectorDrawer({ name, onClose }: { name: string; onClose: () => void }) {
  const sector: SectorRow | undefined = sectorByName[name];
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-head">
          <div>
            <div className="drawer-title">{name}</div>
            <div className={`drawer-sub ${cls(sector?.chg ?? 0)}`}>
              {sector ? `${arr(sector.chg)} ${Math.abs(sector.chg).toFixed(2)}%  ·  ${sector.trend}` : "Sector data"}
            </div>
          </div>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>
        {sector && (
          <div className="card">
            <div className="card-h"><h3>Top Holdings</h3></div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Ticker</th><th>Mkt Cap</th><th>Change</th></tr></thead>
                <tbody>
                  {sector.items.map(([t, mc, c]) => (
                    <tr key={t}>
                      <td><span className="sym">{t}</span></td>
                      <td className="mono" style={{ color: "var(--text)" }}>${mc}B</td>
                      <td className={cls(c)}>{arr(c)} {Math.abs(c).toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function FundDrawer({ idx, onClose }: { idx: number; onClose: () => void }) {
  const fund: Fund | undefined = funds[idx];
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-head">
          <div>
            <div className="drawer-title">{fund?.name ?? "Fund"}</div>
            <div className="drawer-sub">{fund?.mgr} · AUM {fund?.aum}</div>
          </div>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>
        {fund && (
          <div className="card">
            <div className="card-h"><h3>Fund Summary</h3></div>
            <div className="card-b">
              {[
                ["Manager", fund.mgr],
                ["13F AUM", fund.aum],
                ["Positions", String(fund.pos)],
                ["Top holding", fund.top1],
                ["New positions", String(fund.newPos)],
                ["Exits", String(fund.exits)],
                ["Quarter", fund.quarter],
              ].map(([l, v]) => (
                <div key={l} className="fin-row">
                  <span className="fin-lbl">{l}</span>
                  <span style={{ fontFamily: "var(--f-mono)", fontSize: ".82rem", color: "var(--text-hi)" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ---- Copilot panel ----
type CopilotMsg = { role: "user" | "ai"; text: string };
const aiReplies = [
  "Based on current market data, NVDA has strong momentum driven by AI infrastructure spending.",
  "The recent CPI print suggests inflation is cooling — watch for September rate cut probability to increase.",
  "Portfolio concentration in tech is currently elevated. Consider reviewing sector allocation.",
  "Analyst consensus for the S&P 500 is constructive, with a year-end target of ~5,400.",
];

function CopilotPanel({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<CopilotMsg[]>([
    { role: "ai", text: "Hello! I'm your InvestIQ AI Copilot. Ask me about markets, your portfolio, earnings, or any stock." },
  ]);
  const [input, setInput] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);

  function send() {
    const txt = input.trim();
    if (!txt) return;
    const reply = aiReplies[messages.length % aiReplies.length];
    setMessages(prev => [...prev, { role: "user", text: txt }, { role: "ai", text: reply }]);
    setInput("");
    setTimeout(() => { bodyRef.current?.scrollTo({ top: 9999, behavior: "smooth" }); }, 50);
  }

  return (
    <div className="copilot">
      <div className="copilot-head">
        <div className="copilot-icon">✦</div>
        <div className="copilot-title">AI Copilot</div>
        <button className="copilot-close" onClick={onClose}>✕</button>
      </div>
      <div className="copilot-body" ref={bodyRef}>
        {messages.map((m, i) => (
          <div key={i} className={`copilot-msg ${m.role}`}>
            <div className="cm-text">{m.text}</div>
          </div>
        ))}
      </div>
      <div className="copilot-inp">
        <input
          placeholder="Ask about markets, portfolio, earnings…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") send(); }}
          autoFocus
        />
        <button className="copilot-send" onClick={send}>↑</button>
      </div>
    </div>
  );
}

// ---- Command palette ----
function CommandPalette({ onClose, onNavigate }: { onClose: () => void; onNavigate: (href: string) => void }) {
  const [q, setQ] = useState("");
  const filtered = menuItems.filter(m =>
    m.label.toLowerCase().includes(q.toLowerCase())
  );
  return (
    <>
      <div className="palette-scrim" onClick={onClose} />
      <div className="palette">
        <div className="palette-input">
          <span className="palette-icon">⌕</span>
          <input
            placeholder="Search pages, stocks, commands…"
            value={q}
            onChange={e => setQ(e.target.value)}
            autoFocus
          />
        </div>
        <div className="palette-list">
          {filtered.map(item => (
            <div key={item.slug} className="palette-item"
              onClick={() => { onNavigate(slugToHref(item.slug)); onClose(); }}>
              <div className="palette-item-icon"><NavIcon slug={item.slug} /></div>
              <div>
                <div className="palette-item-label">{item.label}</div>
                <div className="palette-item-sub">{item.group}</div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: "14px 16px", color: "var(--text-dim-solid)", fontSize: 13 }}>No results for "{q}"</div>
          )}
        </div>
      </div>
    </>
  );
}

// ---- Main IQ Shell ----
export function IQShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAppSelector(state => state.auth);
  const { data: profile } = useAppSelector(state => state.profile);

  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [drawer, setDrawer] = useState<
    | { type: "stock"; sym: string }
    | { type: "earnings"; sym: string }
    | { type: "sector"; name: string }
    | { type: "fund"; idx: number }
    | null
  >(null);

  const profileDropdownRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
    }
    if (profileDropdownOpen) document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [profileDropdownOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setPaletteOpen(true); }
      if (e.key === "Escape") { setPaletteOpen(false); setDrawer(null); setCopilotOpen(false); setProfileDropdownOpen(false); }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Action context
  const actions: IQActions = {
    openStock: useCallback((sym) => setDrawer({ type: "stock", sym }), []),
    openEarnings: useCallback((sym) => setDrawer({ type: "earnings", sym }), []),
    openSector: useCallback((name) => setDrawer({ type: "sector", name }), []),
    openFund: useCallback((idx) => setDrawer({ type: "fund", idx }), []),
    setCopilot: setCopilotOpen,
    theme,
    setTheme,
  };

  const displayName = profile?.name || user?.displayName || user?.email || "User";
  const initials = displayName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
  const profileImage = profile?.profile_image || user?.photoURL || null;
  const tier = profile?.tier === "free" ? "Free" : "Premium";

  async function handleSignOut() {
    await signOut(firebaseAuth);
    window.location.href = "/auth/login";
  }

  // Ticker content (doubled for infinite scroll)
  const tickerItems = [...pulse, ...pulse];

  return (
    <AuthGuard>
      <IQActionsContext.Provider value={actions}>
        <div className="iq-root" data-theme={theme}>
          <div className="app">
            {/* Brand cell */}
            <div className="brandcell">
              <div className="logo">IQ</div>
              <div className="wordmark">Invest<span>IQ</span></div>
            </div>

            {/* Topbar */}
            <div className="topbar">
              <button className="cmd" onClick={() => setPaletteOpen(true)}>
                ⌕ Search or navigate…
                <kbd>⌘K</kbd>
              </button>
              <div className="statuspill">
                <div className="dot" />
                Markets Open
              </div>
              <button className={`iconbtn${theme === "light" ? " active" : ""}`} title="Toggle theme"
                onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}>
                {theme === "dark" ? "☽" : "☀"}
              </button>
              <button className={`iconbtn${copilotOpen ? " ai-active" : ""}`} title="AI Copilot"
                onClick={() => setCopilotOpen(o => !o)}>
                ✦
              </button>
              <div className="profile-dropdown-wrap" ref={profileDropdownRef}>
                <div
                  className="topbar-avatar"
                  title={displayName}
                  onClick={() => setProfileDropdownOpen(o => !o)}
                  style={{ cursor: "pointer" }}
                >
                  {initials}
                  {profileImage && <img src={profileImage} alt={displayName} />}
                </div>

                {profileDropdownOpen && (
                  <div className="profile-dropdown">
                    {/* User info */}
                    <div className="pd-user">
                      <div className="pd-name">{displayName}</div>
                      <div className="pd-email">{user?.email ?? ""}</div>
                    </div>

                    {/* Menu items */}
                    <button className="pd-item" onClick={() => { router.push("/profile/edit"); setProfileDropdownOpen(false); }}>
                      <span className="pd-icon">👤</span> My Profile
                    </button>
                    <button className="pd-item" onClick={() => { router.push("/settings"); setProfileDropdownOpen(false); }}>
                      <span className="pd-icon">⚙</span> Settings
                    </button>
                    <div className="pd-divider" />
                    <button className="pd-item danger" onClick={() => { handleSignOut(); setProfileDropdownOpen(false); }}>
                      <span className="pd-icon">↩</span> Logout
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Ticker */}
            <div className="ticker">
              <div className="ticker-track">
                {tickerItems.map((x, i) => (
                  <div key={i} className="tk">
                    <span className="lbl">{x.l}</span>
                    <span className="val">{fmt(x.v, x.v > 1000 ? 0 : 2)}</span>
                    <span className={`chg ${cls(x.c)}`}>{arr(x.c)} {Math.abs(x.c).toFixed(2)}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Rail / Sidebar */}
            <nav className="rail">
              {(["Intelligence", "My Money", "Context"] as const).map(group => (
                <div key={group}>
                  <div className="sec-lbl">{group}</div>
                  {menuItems.filter(m => m.group === group).map(item => {
                    const href = slugToHref(item.slug);
                    const isActive = pathname === href;
                    return (
                      <Link key={item.slug} href={href} className={`navitem${isActive ? " active" : ""}`}>
                        <div className="nicon"><NavIcon slug={item.slug} /></div>
                        {item.label}
                        {item.badge && (
                          <span className={`navbadge${item.badge === "AI" ? " ai" : ""}`}>
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              ))}

              {/* Profile box */}
              <div className="planbox">
                <div className="row">
                  <div className="avatar">
                    {initials}
                    {profileImage && <img src={profileImage} alt={displayName} />}
                  </div>
                  <div>
                    <div className="who">{displayName}</div>
                    <div className="tier">✦ {tier}</div>
                  </div>
                </div>
                <button className="planbtn" onClick={() => router.push("/manage-plan")}>
                  <span style={{ fontSize: 13 }}>◈</span>
                  Manage plan
                </button>
              </div>
            </nav>

            {/* Main content */}
            <main className="main">
              {children}
            </main>
          </div>

          {/* Drawers */}
          {drawer?.type === "stock" && (
            <StockDrawer sym={drawer.sym} onClose={() => setDrawer(null)} />
          )}
          {drawer?.type === "earnings" && (
            <EarningsDrawer sym={drawer.sym} onClose={() => setDrawer(null)} />
          )}
          {drawer?.type === "sector" && (
            <SectorDrawer name={drawer.name} onClose={() => setDrawer(null)} />
          )}
          {drawer?.type === "fund" && (
            <FundDrawer idx={drawer.idx} onClose={() => setDrawer(null)} />
          )}

          {/* Copilot FAB — visible when panel is closed */}
          {!copilotOpen && (
            <button className="copilot-fab" onClick={() => setCopilotOpen(true)}>
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9z" fill="currentColor" />
                <circle cx="18.5" cy="17.5" r="2" fill="currentColor" />
              </svg>
              Market Copilot
            </button>
          )}

          {/* Copilot panel */}
          {copilotOpen && <CopilotPanel onClose={() => setCopilotOpen(false)} />}

          {/* Command palette */}
          {paletteOpen && (
            <CommandPalette
              onClose={() => setPaletteOpen(false)}
              onNavigate={href => { router.push(href); }}
            />
          )}
        </div>
      </IQActionsContext.Provider>
    </AuthGuard>
  );
}
