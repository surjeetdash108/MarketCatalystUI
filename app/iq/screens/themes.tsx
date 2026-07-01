"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { cls, arr, sign, Spark } from "../utils";

const StockScreenEmbed = dynamic<{ initialSym?: string; hideHeader?: boolean }>(
  () => import("./stock").then(m => ({ default: m.StockScreen })),
  { ssr: false, loading: () => <div style={{ padding: 40, textAlign: "center", color: "var(--text-dim-solid)" }}>Loading…</div> }
);

interface ThemeStock { s: string; n: string; px: number; c: number; }
interface Theme { id: string; name: string; desc: string; stocks: ThemeStock[]; }

const THEMES: Theme[] = [
  {
    id: "mag7", name: "Magnificent Seven", desc: "The 7 mega-caps driving market returns",
    stocks: [
      { s: "AAPL",  n: "Apple",       px: 189.30,   c:  0.82 },
      { s: "MSFT",  n: "Microsoft",   px: 415.50,   c:  1.14 },
      { s: "GOOGL", n: "Alphabet",    px: 178.20,   c:  0.93 },
      { s: "AMZN",  n: "Amazon",      px: 185.60,   c:  1.52 },
      { s: "NVDA",  n: "Nvidia",      px: 1181.75,  c:  8.23 },
      { s: "META",  n: "Meta",        px: 512.40,   c:  2.10 },
      { s: "TSLA",  n: "Tesla",       px: 168.00,   c: -3.10 },
    ],
  },
  {
    id: "ai", name: "AI & Semiconductors", desc: "Chips, models and infrastructure powering AI",
    stocks: [
      { s: "NVDA",  n: "Nvidia",        px: 1181.75,  c:  8.23 },
      { s: "AMD",   n: "Adv Micro Dev", px: 165.20,   c: -2.10 },
      { s: "AVGO",  n: "Broadcom",      px: 1402.50,  c:  2.97 },
      { s: "INTC",  n: "Intel",         px:   30.12,  c: -1.80 },
      { s: "MU",    n: "Micron",        px:  127.40,  c:  3.21 },
      { s: "ARM",   n: "Arm Holdings",  px:  118.60,  c:  1.85 },
      { s: "QCOM",  n: "Qualcomm",      px:  158.90,  c:  0.72 },
      { s: "MRVL",  n: "Marvell Tech",  px:   67.50,  c:  2.40 },
    ],
  },
  {
    id: "software", name: "Software & Cloud", desc: "Enterprise SaaS and cloud platforms",
    stocks: [
      { s: "PLTR",  n: "Palantir",    px:   24.88,  c:  6.18 },
      { s: "CRM",   n: "Salesforce",  px:  316.50,  c:  4.21 },
      { s: "NOW",   n: "ServiceNow",  px:  780.20,  c:  1.62 },
      { s: "MSFT",  n: "Microsoft",   px:  415.50,  c:  1.14 },
      { s: "ADSK",  n: "Autodesk",    px:  218.40,  c: -0.55 },
      { s: "SNOW",  n: "Snowflake",   px:  162.30,  c:  2.80 },
      { s: "DDOG",  n: "Datadog",     px:  133.80,  c:  3.10 },
    ],
  },
  {
    id: "internet", name: "Internet & Media", desc: "Digital advertising, streaming and social",
    stocks: [
      { s: "META",  n: "Meta",       px: 512.40,  c:  2.10 },
      { s: "GOOGL", n: "Alphabet",   px: 178.20,  c:  0.93 },
      { s: "AMZN",  n: "Amazon",     px: 185.60,  c:  1.52 },
      { s: "NFLX",  n: "Netflix",    px: 682.30,  c:  0.44 },
      { s: "PINS",  n: "Pinterest",  px:  38.50,  c: -1.20 },
      { s: "SNAP",  n: "Snap",       px:  15.80,  c: -2.40 },
    ],
  },
  {
    id: "consumer", name: "Consumer & Retail", desc: "Brands, retail and consumer discretionary",
    stocks: [
      { s: "AMZN",  n: "Amazon",       px: 185.60,  c:  1.52 },
      { s: "TSLA",  n: "Tesla",        px: 168.00,  c: -3.10 },
      { s: "SBUX",  n: "Starbucks",    px:  78.20,  c: -0.60 },
      { s: "NKE",   n: "Nike",         px:  93.40,  c:  0.30 },
      { s: "MCD",   n: "McDonald's",   px: 268.50,  c:  0.18 },
      { s: "HD",    n: "Home Depot",   px: 342.80,  c:  0.94 },
      { s: "TGT",   n: "Target",       px: 148.60,  c: -1.80 },
      { s: "WBA",   n: "Walgreens",    px:  15.30,  c: -5.80 },
    ],
  },
  {
    id: "fintech", name: "Fintech", desc: "Payments, crypto and financial innovation",
    stocks: [
      { s: "PYPL",  n: "PayPal",      px:  65.80,  c:  1.40 },
      { s: "SQ",    n: "Block",       px:  72.40,  c:  2.80 },
      { s: "V",     n: "Visa",        px: 278.60,  c:  0.62 },
      { s: "MA",    n: "Mastercard",  px: 458.90,  c:  0.75 },
      { s: "SOFI",  n: "SoFi Tech",   px:   7.90,  c:  3.25 },
      { s: "COIN",  n: "Coinbase",    px: 226.40,  c:  5.10 },
      { s: "AFRM",  n: "Affirm",      px:  38.20,  c:  4.60 },
    ],
  },
  {
    id: "hardware", name: "Devices & Hardware", desc: "Physical compute, servers and peripherals",
    stocks: [
      { s: "AAPL",  n: "Apple",         px: 189.30,  c:  0.82 },
      { s: "DELL",  n: "Dell Tech",     px: 161.80,  c: -3.45 },
      { s: "SMCI",  n: "Super Micro",   px: 812.40,  c:  5.60 },
      { s: "HPQ",   n: "HP Inc",        px:  31.40,  c: -0.90 },
      { s: "NTAP",  n: "NetApp",        px: 114.60,  c:  1.10 },
      { s: "WDC",   n: "Western Digital", px: 60.20, c:  2.30 },
    ],
  },
  {
    id: "value", name: "Deep Value", desc: "Low-multiple, out-of-favor names with recovery potential",
    stocks: [
      { s: "INTC",  n: "Intel",          px:  30.12,  c: -1.80 },
      { s: "WBA",   n: "Walgreens",      px:  15.30,  c: -5.80 },
      { s: "DELL",  n: "Dell Tech",      px: 161.80,  c: -3.45 },
      { s: "F",     n: "Ford",           px:  12.40,  c: -0.80 },
      { s: "BAC",   n: "Bank of America", px: 38.20,  c:  0.52 },
      { s: "C",     n: "Citigroup",      px:  64.10,  c:  0.88 },
      { s: "T",     n: "AT&T",           px:  17.80,  c:  0.11 },
    ],
  },
];

export function ThemesScreen() {
  const [themeId, setThemeId] = useState<string>(THEMES[0].id);
  const [sel, setSel]         = useState<string | null>(THEMES[0].stocks[0]?.s ?? null);

  const theme  = THEMES.find(t => t.id === themeId) ?? THEMES[0];
  const stocks = theme.stocks;

  const up      = stocks.filter(s => s.c > 0).length;
  const dn      = stocks.filter(s => s.c < 0).length;
  const avg     = stocks.reduce((acc, s) => acc + s.c, 0) / stocks.length;
  const leader  = [...stocks].sort((a, b) => b.c - a.c)[0];
  const laggard = [...stocks].sort((a, b) => a.c - b.c)[0];

  function handleThemeChange(id: string) {
    const t = THEMES.find(th => th.id === id);
    setThemeId(id);
    setSel(t?.stocks[0]?.s ?? null);
  }

  const avgLabel = (avg >= 0 ? "+" : "") + avg.toFixed(2) + "%";

  return (
    <>
      {/* Page header */}
      <div className="page-head">
        <div>
          <div style={{ fontWeight: 700, fontSize: ".92rem", color: "var(--text-hi)", marginBottom: 2 }}>
            {theme.name}
          </div>
          <div className="page-sub">
            {stocks.length} stocks · avg <span className={avg >= 0 ? "up" : "down"}>{avgLabel}</span>
            {leader  && <> · Leader: <b>{leader.s}</b> <span className="up">{sign(leader.c)}</span></>}
            {laggard && laggard.s !== leader?.s && <> · Laggard: <b>{laggard.s}</b> <span className="down">{sign(laggard.c)}</span></>}
          </div>
        </div>
      </div>

      <div style={{ padding: "0 18px 18px" }}>

        {/* Theme filter pills */}
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 14 }}>
          {THEMES.map(t => (
            <button
              key={t.id}
              onClick={() => handleThemeChange(t.id)}
              style={{
                padding: "5px 13px",
                borderRadius: 20,
                border: "1px solid",
                fontSize: ".72rem",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all .15s",
                borderColor: themeId === t.id ? "var(--brand)" : "var(--border)",
                background: themeId === t.id ? "var(--brand)" : "var(--surface-2)",
                color: themeId === t.id ? "#fff" : "var(--text-dim-solid)",
              }}
            >
              {t.name}
            </button>
          ))}
        </div>

        {/* AI theme summary */}
        <div className="ai-block" style={{ marginBottom: 14 }}>
          <div className="card-h">
            <h3 className="ai-c">◆ AI theme summary</h3>
            <span className="pill ai">leaders · laggards · momentum</span>
          </div>
          <div className="card-b">
            <p style={{ marginBottom: 10, fontSize: ".88rem", lineHeight: 1.55 }}>
              <b style={{ color: "var(--text-hi)" }}>{theme.name}</b> — {theme.desc}.{" "}
              {stocks.length} constituents finished{" "}
              <b className="up">{up} up</b> / <b className="down">{dn} down</b> today (avg {avgLabel}).
              {leader && <> <b>{leader.s}</b> led the group (<span className="up">{sign(leader.c)}</span>).</>}
              {laggard && laggard.s !== leader?.s && <> <b>{laggard.s}</b> was the laggard (<span className="down">{sign(laggard.c)}</span>).</>}
            </p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span className="src-chip">Up {up}/{stocks.length}</span>
              <span className="src-chip">Avg {avgLabel}</span>
              {leader && <span className="src-chip">Leader {leader.s}</span>}
            </div>
          </div>
        </div>

        {/* Two-panel master-detail */}
        <div className="pf-master">

          {/* LEFT: stock list */}
          <div className="pf-side">
            <div className="card">
              <div className="card-h">
                <h3>{theme.name}</h3>
                <span style={{ fontSize: ".72rem", color: "var(--text-dim-solid)" }}>{stocks.length} stocks</span>
              </div>
              <div className="pf-list">
                {stocks.map((stock, i) => (
                  <div
                    key={stock.s}
                    className={`pf-li${sel === stock.s ? " active" : ""}`}
                    style={{ gridTemplateColumns: "1fr 60px auto" }}
                    onClick={() => setSel(stock.s)}
                  >
                    <div>
                      <span className="s">{stock.s}</span>
                      <span className="n">{stock.n}</span>
                    </div>
                    <div className="pf-spark">
                      <Spark seed={i + 7} up={stock.c >= 0} />
                    </div>
                    <div>
                      <span className="px">
                        {stock.px >= 1000 ? `$${(stock.px / 1000).toFixed(2)}K` : `$${stock.px.toFixed(2)}`}
                      </span>
                      <span className={`ch ${cls(stock.c)}`}>{arr(stock.c)} {sign(stock.c)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: stock detail */}
          <div className="pf-detail">
            {sel ? (
              <StockScreenEmbed initialSym={sel} hideHeader />
            ) : (
              <div className="card">
                <div className="card-b" style={{ padding: 40, textAlign: "center", color: "var(--text-dim-solid)" }}>
                  Select a stock to see its detail here.
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
