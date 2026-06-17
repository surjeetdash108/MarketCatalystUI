"use client";

// iq.css is imported globally via app/layout.tsx
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { firebaseAuth, firebaseDb } from "../firebase";
import { useAppSelector } from "../store/hooks";
import { AuthGuard } from "../dashboard/auth-guard";
import { menuItems } from "../dashboard/menu-items";
import { pulse, sectorByName, funds, fundDetail, folio, earnings as earningsData, type SectorRow, type Fund, type FundDetail } from "./data";
import { fmt, sign, cls, arr } from "./utils";

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
function EarningsDrawer({ sym, onClose }: { sym: string; onClose: () => void }) {
  const { openStock } = useIQActions();
  const e = earningsData.find(x => x.s === sym);
  const posted = e && e.epsA != null;
  const epsBeat = e && e.epsA != null ? ((e.epsA - e.epsE) / Math.abs(e.epsE) * 100) : null;
  const revBeat = e && e.revA != null ? ((e.revA - e.revE) / Math.abs(e.revE) * 100) : null;

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="drawer open">
        <div className="drawer-h">
          <div className="sd-logo" style={{ background: "linear-gradient(135deg,#1f6b4d,#0e3a2a)", color: "#5ff0b3" }}>
            {sym[0]}
          </div>
          <div style={{ flex: 1 }}>
            <div className="mono" style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-hi)" }}>{sym}</div>
            <div style={{ fontSize: ".78rem", color: "var(--text-dim-solid)" }}>
              {e?.n ?? sym} · {e?.sec ?? "—"} ·{" "}
              <span className={`pill ${e?.t === "Before open" ? "bmo" : "amc"}`}>{e?.t ?? "—"}</span>
            </div>
          </div>
          <button className="closebtn" onClick={onClose}>✕</button>
        </div>

        <div className="drawer-b">
          {posted && e ? (
            <>
              <div className="metric-grid">
                <div className="m">
                  <div className="k">EPS · actual vs est</div>
                  <div className="v">${e.epsA}</div>
                  <div className={`s ${(epsBeat ?? 0) >= 0 ? "up" : "dn"}`}>
                    est ${e.epsE} · {epsBeat != null ? `${epsBeat > 0 ? "+" : ""}${epsBeat.toFixed(1)}%` : ""}
                  </div>
                </div>
                <div className="m">
                  <div className="k">Revenue</div>
                  <div className="v">${e.revA}B</div>
                  <div className={`s ${(revBeat ?? 0) >= 0 ? "up" : "dn"}`}>
                    est ${e.revE}B{revBeat != null ? ` · ${revBeat > 0 ? "+" : ""}${revBeat.toFixed(1)}%` : ""}
                  </div>
                </div>
                <div className="m">
                  <div className="k">Guidance</div>
                  <div className="v" style={{ color: e.guide === "Raised" ? "var(--up)" : e.guide === "Cut" ? "var(--down)" : "var(--text-hi)", fontSize: "1rem" }}>
                    {e.guide ?? "—"}
                  </div>
                </div>
                <div className="m">
                  <div className="k">Reaction</div>
                  <div className={`v ${cls(e.react ?? 0)}`}>{sign(e.react ?? 0)}</div>
                  <div className="s">after hours</div>
                </div>
              </div>

              <div className="takeaway">
                <span className="lbl">AI takeaway</span>
                <span style={{ fontSize: ".8rem", color: "var(--text-dim-solid)" }}>
                  {e.tags.includes("Beat") ? "Beat on top and bottom line — guidance the catalyst" : "Results mixed; reaction tells the story"}
                </span>
                <span className={`verdict ${(e.react ?? 0) >= 0 ? "up" : "dn"}`}>
                  {(e.react ?? 0) >= 2 ? "Bullish" : (e.react ?? 0) >= 0 ? "Mild beat" : "Bearish"}
                </span>
              </div>

              <div className="ai-block" style={{ marginBottom: 14 }}>
                <div className="card-h">
                  <h3 className="ai-c">◆ AI Earnings Summary</h3>
                  <span className="pill ai">conf. 91%</span>
                </div>
                <div className="card-b">
                  <div className="ai-sec">
                    <div className="h">What happened</div>
                    <p>{e.n} reported {(epsBeat ?? 0) >= 0 ? "above" : "below"}-consensus EPS of ${e.epsA} vs. est ${e.epsE}, with revenue of ${e.revA}B. Stock reacted {sign(e.react ?? 0)} after hours.</p>
                  </div>
                  <div className="ai-sec">
                    <div className="h">Bull case</div>
                    <p>Beat on both lines with guidance {e.guide === "Raised" ? "raised — management confidence is a strong signal" : "maintained — execution visible"}. {e.owned ? "Your position benefits directly." : ""}</p>
                  </div>
                  <div className="ai-sec">
                    <div className="h">Bear case</div>
                    <p>Much of the upside may be priced in. Implied move was ±{e.implied}% — actual {Math.abs(e.react ?? 0).toFixed(1)}% {Math.abs(e.react ?? 0) > e.implied ? "exceeded" : "was within"} expectations.</p>
                  </div>
                  <div className="ai-sec">
                    <div className="h">Guidance detail</div>
                    <p>Company {e.guide === "Raised" ? "raised" : e.guide === "In-line" ? "maintained" : "cut"} forward guidance. Watch next quarter&apos;s setup relative to current Street estimates.</p>
                  </div>
                  <div className="ai-sec">
                    <div className="h">What to watch next</div>
                    <p>Analyst PT revisions in the next 48 hours, conference call tone, and peer read-throughs from sector names reporting later this week.</p>
                  </div>
                </div>
              </div>

              <div className="card" style={{ marginBottom: 14 }}>
                <div className="card-h"><h3>Peer reactions</h3></div>
                <div className="card-b">
                  {[{ s: "Sector ETF", c: parseFloat(((e.react ?? 0) * 0.3).toFixed(2)) }, { s: "Direct peers", c: parseFloat(((e.react ?? 0) * 0.5).toFixed(2)) }].map(p => (
                    <div key={p.s} className="minirow">
                      <span className="mono" style={{ fontWeight: 700, color: "var(--text-hi)" }}>{p.s}</span>
                      <span className={`mono ${cls(p.c)}`} style={{ marginLeft: "auto" }}>{sign(p.c)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div style={{ padding: "20px 0", color: "var(--text-dim-solid)", fontSize: ".85rem" }}>
              {e
                ? `${e.n} reports ${e.t.toLowerCase()}. Implied move: ±${e.implied}%. Check back after results are posted.`
                : `No earnings data available for ${sym}.`}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button className="btn primary" style={{ flex: 1 }} onClick={() => { onClose(); openStock(sym); }}>Open full stock page</button>
            <button className="btn">Transcript</button>
            <button className="btn ai">▶ Call audio</button>
          </div>
        </div>
      </div>
    </>
  );
}

function SectorDrawer({ name, onClose }: { name: string; onClose: () => void }) {
  const { openStock } = useIQActions();
  const sector: SectorRow | undefined = sectorByName[name];
  const sorted = sector ? [...sector.items].sort((a, b) => b[1] - a[1]) : [];

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="drawer open">
        <div className="drawer-h">
          <div className="sd-logo" style={{ background: "linear-gradient(135deg,#1f4d6b,#0e2233)", color: "#7fd0ff" }}>
            {name[0]}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-hi)", fontFamily: "var(--f-display)" }}>{name}</div>
            <div style={{ fontSize: ".78rem", color: "var(--text-dim-solid)" }}>
              {sector ? `Group rank #${sector.rank} · ` : ""}
              <span className={cls(sector?.chg ?? 0)}>{sign(sector?.chg ?? 0)} today</span>
              {sector && <> · <span className="pill" style={{ marginLeft: 2 }}>{sector.trend}</span></>}
            </div>
          </div>
          <button className="closebtn" onClick={onClose}>✕</button>
        </div>

        <div className="drawer-b">
          <div className="ai-sec"><div className="h">Constituents · by market cap</div></div>
          {sorted.map(([sym, mc, chg]) => (
            <div key={sym} className="minirow" style={{ cursor: "pointer" }} onClick={() => { onClose(); openStock(sym); }}>
              <span className="mono" style={{ fontWeight: 700, color: "var(--text-hi)", minWidth: 52 }}>{sym}</span>
              <span style={{ fontSize: ".75rem", color: "var(--text-dim-solid)", flex: 1, marginLeft: 8 }}>${mc}B</span>
              <span className={`mono ${cls(chg)}`} style={{ fontSize: ".82rem" }}>{sign(chg)}</span>
            </div>
          ))}

          <div className="ai-sec" style={{ marginTop: 14 }}><div className="h">Big news across the sector</div></div>
          {[
            { t: `Rotation into ${name} continues as valuations stay supported`, dt: "Today" },
            { t: `Sector ETF sees notable inflows amid broad risk-on positioning`, dt: "Yesterday" },
            { t: `Analyst consensus turns constructive — multiple PT upgrades`, dt: "2 days ago" },
          ].map((item, i) => (
            <div key={i} style={{ padding: "8px 0", borderBottom: i < 2 ? "1px solid var(--border-soft)" : "none" }}>
              <div style={{ fontSize: ".82rem", color: "var(--text-hi)", lineHeight: 1.4 }}>{item.t}</div>
              <div style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", marginTop: 2 }}>{item.dt}</div>
            </div>
          ))}

          <button className="btn primary" style={{ width: "100%", marginTop: 16 }} onClick={onClose}>Back to heatmap</button>
        </div>
      </div>
    </>
  );
}

function FundDrawer({ idx, onClose }: { idx: number; onClose: () => void }) {
  const { openStock } = useIQActions();
  const fund: Fund | undefined = funds[idx];
  const dt: FundDetail | undefined = fund ? fundDetail[fund.name] : undefined;

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="drawer open">
        <div className="drawer-h">
          <div className="sd-logo" style={{ background: "linear-gradient(135deg,#3a2f6b,#241c44)", color: "var(--brand-2)", fontSize: ".78rem" }}>
            {fund?.av ?? "—"}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-hi)", fontFamily: "var(--f-display)" }}>{fund?.name ?? "Fund"}</div>
            <div style={{ fontSize: ".78rem", color: "var(--text-dim-solid)" }}>
              {fund?.mgr} · 13F AUM {fund?.aum} · {fund?.pos} positions · {fund?.quarter}
            </div>
          </div>
          <button className="closebtn" onClick={onClose}>✕</button>
        </div>

        <div className="drawer-b">
          {fund && (
            <>
              <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                <span className="pill up">{fund.newPos} new buys</span>
                <span className="pill dn">{fund.exits} exits</span>
                <span className="src-chip">{fund.quarter} 13F-HR</span>
              </div>

              {dt && (
                <>
                  <div className="ai-sec"><div className="h">Top 10 holdings · % of portfolio</div></div>
                  <div className="tbl-wrap" style={{ marginBottom: 14 }}>
                    <table className="tbl">
                      <thead>
                        <tr><th>Ticker</th><th className="num">% wt</th><th>Change</th></tr>
                      </thead>
                      <tbody>
                        {dt.holdings.map(([sym, pct, chg]) => (
                          <tr key={sym} style={{ cursor: "pointer" }} onClick={() => { onClose(); openStock(sym); }}>
                            <td className="mono" style={{ fontWeight: 700, color: "var(--text-hi)" }}>{sym}</td>
                            <td className="num">{pct}%</td>
                            <td>
                              <span className={`pill ${chg === "new" ? "up" : chg === "reduced" ? "dn" : ""}`} style={{ fontSize: ".68rem" }}>
                                {chg}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="dash">
                    <div className="col-6">
                      <div className="ai-sec"><div className="h" style={{ color: "var(--up)" }}>Biggest buys / adds</div></div>
                      {dt.buys.map(([sym, desc]) => (
                        <div key={sym} className="minirow" style={{ cursor: "pointer", flexDirection: "column", alignItems: "flex-start", gap: 2, marginBottom: 6 }} onClick={() => { onClose(); openStock(sym); }}>
                          <span className="mono" style={{ fontWeight: 700, color: "var(--text-hi)" }}>{sym}</span>
                          <span style={{ fontSize: ".72rem", color: "var(--text-dim-solid)" }}>{desc}</span>
                        </div>
                      ))}
                    </div>
                    <div className="col-6">
                      <div className="ai-sec"><div className="h" style={{ color: "var(--down)" }}>Biggest exits / trims</div></div>
                      {dt.exits.map(([sym, desc]) => (
                        <div key={sym} className="minirow" style={{ cursor: "pointer", flexDirection: "column", alignItems: "flex-start", gap: 2, marginBottom: 6 }} onClick={() => { onClose(); openStock(sym); }}>
                          <span className="mono" style={{ fontWeight: 700, color: "var(--text-hi)" }}>{sym}</span>
                          <span style={{ fontSize: ".72rem", color: "var(--text-dim-solid)" }}>{desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="ai-block" style={{ marginTop: 14, marginBottom: 14 }}>
                    <div className="card-h"><h3 className="ai-c">◆ AI read on the quarter</h3></div>
                    <div className="card-b">
                      <div className="ai-sec">
                        <div className="h">Theme shift</div>
                        <p style={{ fontSize: ".82rem", lineHeight: 1.6 }}>{dt.theme}</p>
                      </div>
                      <div className="ai-sec">
                        <div className="h">Concentration</div>
                        <p style={{ fontSize: ".82rem", lineHeight: 1.6 }}>{dt.conc}</p>
                      </div>
                      <div className="ai-sec">
                        <div className="h">Overlap with your portfolio</div>
                        <p style={{ fontSize: ".82rem", lineHeight: 1.6 }}>
                          {dt.holdings.filter(([sym]) => folio.some(f => f.s === sym)).length} of {dt.holdings.length} top holdings overlap with your portfolio. Review position sizing for shared names.
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <button className="btn primary" style={{ width: "100%" }} onClick={onClose}>Back to 13F overview</button>
            </>
          )}
        </div>
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

  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    return (localStorage.getItem("iq-theme") as "dark" | "light") || "dark";
  });
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [drawer, setDrawer] = useState<
    | { type: "earnings"; sym: string }
    | { type: "sector"; name: string }
    | { type: "fund"; idx: number }
    | null
  >(null);

  const profileDropdownRef = useRef<HTMLDivElement>(null);

  // Load saved theme from Firestore on mount
  useEffect(() => {
    if (!user?.uid) return;
    const uid = user.uid;
    void (async () => {
      try {
        const snap = await getDoc(doc(firebaseDb, "settings", uid));
        if (snap.exists()) {
          const data = snap.data();
          if (typeof data.darkMode === "boolean") {
            const resolved = data.darkMode ? "dark" : "light";
            localStorage.setItem("iq-theme", resolved);
            setTheme(resolved);
          }
        }
      } catch { /* keep default dark theme on error */ }
    })();
  }, [user?.uid]);

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
    openStock: useCallback((sym) => {
      if (typeof window !== "undefined") localStorage.setItem("iq-stock", sym);
      router.push("/menu/stock");
    }, [router]),
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
