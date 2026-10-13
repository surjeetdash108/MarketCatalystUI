"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useIQActions } from "../shell";
import { StockLogo } from "../utils";
import { apiGet } from "../backend";
import { useApiList } from "../hooks/useApiList";
import { useLiveQuotes } from "../live-quotes-context";
import { useBackendBars } from "../hooks/useBackendBars";
import type { InsiderTxDoc, CompanyDoc } from "../types";
import type { Stock13FResponse } from "../stock-13f-view";

// ---- Constants & Theme Colors (matches 13F & Insider standalone HTML) ----
const UP = "var(--up, #3fd68a)";
const DN = "var(--down, #f2555f)";
const AMB = "var(--warn, #f3b24a)";
const GR = "var(--text-dim, #7d8798)";
const N_BARS = 180;

// Curated 20 benchmark companies with established metadata
interface CompanyMeta {
  name: string;
  price: number;
  chg: number;
  logoBg: string;
  logoFg: string;
}

const CURATED_COMPANIES: Record<string, CompanyMeta> = {
  INTC: { name: "Intel Corp", price: 26.47, chg: 2.31, logoBg: "#0068b5", logoFg: "#fff" },
  LULU: { name: "Lululemon Athletica", price: 242.30, chg: 0.92, logoBg: "#d22030", logoFg: "#fff" },
  UNH:  { name: "UnitedHealth Group", price: 349.05, chg: -0.44, logoBg: "#002677", logoFg: "#fff" },
  SOFI: { name: "SoFi Technologies", price: 19.34, chg: 1.47, logoBg: "#00a2c7", logoFg: "#fff" },
  SMCI: { name: "Super Micro Computer", price: 41.30, chg: -2.10, logoBg: "#2b6cb0", logoFg: "#fff" },
  AMZN: { name: "Amazon.com Inc", price: 279.60, chg: -0.71, logoBg: "#ff9900", logoFg: "#111" },
  NVDA: { name: "Nvidia Corp", price: 217.89, chg: 1.84, logoBg: "#76b900", logoFg: "#0b1400" },
  AVGO: { name: "Broadcom Inc", price: 362.10, chg: 1.12, logoBg: "#cc092f", logoFg: "#fff" },
  META: { name: "Meta Platforms Inc", price: 701.15, chg: -0.38, logoBg: "#0866ff", logoFg: "#fff" },
  PLTR: { name: "Palantir Technologies", price: 171.22, chg: 2.05, logoBg: "#e7ecf4", logoFg: "#111" },
  HOOD: { name: "Robinhood Markets", price: 118.40, chg: 3.12, logoBg: "#c3f53c", logoFg: "#111" },
  ORCL: { name: "Oracle Corp", price: 251.80, chg: 0.84, logoBg: "#c74634", logoFg: "#fff" },
  MSFT: { name: "Microsoft Corp", price: 512.30, chg: 0.27, logoBg: "#00a4ef", logoFg: "#fff" },
  TSLA: { name: "Tesla Inc", price: 402.55, chg: -1.05, logoBg: "#cc0000", logoFg: "#fff" },
  SNOW: { name: "Snowflake Inc", price: 198.40, chg: -0.62, logoBg: "#29b5e8", logoFg: "#fff" },
  CRWD: { name: "CrowdStrike Holdings", price: 441.70, chg: 0.66, logoBg: "#e01f26", logoFg: "#fff" },
  BTSG: { name: "BrightSpring Health", price: 55.18, chg: -1.30, logoBg: "#e9ecef", logoFg: "#1a2b4a" },
  AUR:  { name: "Aurora Innovation", price: 6.82, chg: 3.40, logoBg: "#1d2a44", logoFg: "#9fb4ff" },
  CVX:  { name: "Chevron Corp", price: 195.60, chg: 0.18, logoBg: "#0054a4", logoFg: "#fff" },
  AMD:  { name: "Advanced Micro Devices", price: 188.75, chg: 1.63, logoBg: "#1a1a1a", logoFg: "#e7ecf4" },
};

// Raw transactions baseline from standalone HTML
type RawTxTuple = [string, string, string, number, string, number, number, number, number | null, number];

const RAW_TRADES_DATA: RawTxTuple[] = [
  ["INTC", "R. Okafor", "CEO", 1, "P", 0, 120000, 24.18, 18.2, 5],
  ["INTC", "S. Mehta", "CFO", 1, "P", 0, 45000, 24.40, 12.5, 4],
  ["INTC", "L. Brandt", "Director", 0, "P", 0, 60000, 23.95, 41.0, 6],
  ["INTC", "J. Weller", "Director", 0, "S", 1, 20000, 21.10, -4.0, 58],
  ["SOFI", "N. Patel", "CEO", 1, "P", 0, 200000, 18.42, 3.1, 3],
  ["SOFI", "N. Patel", "CEO", 1, "P", 0, 120000, 16.90, 2.0, 40],
  ["CRWD", "A. Rios", "CFO", 1, "M", 0, 40000, 102.10, 0, 3],
  ["CRWD", "A. Rios", "CFO", 1, "S", 1, 40000, 438.20, -6.0, 3],
  ["UNH", "D. Feld", "Director", 0, "P", 0, 6200, 338.10, null, 7],
  ["UNH", "K. Abara", "Director", 0, "P", 0, 2900, 331.40, 22.0, 16],
  ["LULU", "C. Navarro", "CEO", 1, "P", 0, 21500, 228.40, 6.0, 10],
  ["META", "E. Varga", "COO", 1, "S", 1, 38000, 712.30, -1.5, 11],
  ["META", "E. Varga", "COO", 1, "S", 1, 38000, 690.10, -1.5, 41],
  ["META", "H. Sato", "CTO", 1, "S", 1, 21000, 701.80, -0.9, 72],
  ["AVGO", "R. Castellan", "Director", 0, "S", 1, 230031, 355.50, -3.0, 13],
  ["AVGO", "R. Castellan", "Director", 0, "S", 1, 186809, 354.71, -2.5, 13],
  ["NVDA", "K. Lam", "President & CEO", 1, "S", 1, 1356000, 219.72, -0.4, 18],
  ["NVDA", "K. Lam", "President & CEO", 1, "S", 1, 900000, 206.30, -0.3, 39],
  ["NVDA", "M. Duarte", "EVP", 1, "S", 1, 62000, 214.10, -2.6, 27],
  ["NVDA", "B. Ostrow", "Director", 0, "S", 1, 110000, 194.80, -5.1, 66],
  ["SMCI", "M. Ho", "Director", 0, "P", 0, 30000, 41.80, 9.0, 21],
  ["AUR", "Sponsor fund", "10% owner", 0, "S", 0, 72000000, 6.55, -12.0, 50],
  ["PLTR", "T. Ibsen", "CTO", 1, "S", 1, 306544, 174.85, -2.2, 47],
  ["PLTR", "T. Ibsen", "CTO", 1, "S", 1, 250000, 160.10, -1.9, 77],
  ["BTSG", "Sponsor fund", "10% owner", 0, "S", 0, 14669771, 58.45, -31.0, 62],
  ["AMZN", "P. Whitcomb", "Executive Chair", 1, "S", 0, 1209649, 286.41, -1.1, 64],
  ["AMZN", "P. Whitcomb", "Executive Chair", 1, "S", 0, 400000, 282.90, -0.4, 30],
  ["CVX", "J. Haddad", "Director", 0, "S", 0, 271946, 194.48, -14.0, 64],
  ["AMD", "V. Kessler", "CEO", 1, "S", 1, 80000, 182.40, -0.6, 22],
  ["MSFT", "D. Arnett", "EVP", 1, "S", 1, 25000, 505.10, -3.2, 15],
  ["TSLA", "K. Moran", "Director", 0, "S", 0, 150000, 410.20, -18.0, 35],
  ["HOOD", "C. Lyle", "CFO", 1, "S", 1, 90000, 110.30, -4.4, 20],
  ["ORCL", "P. Quinn", "Director", 0, "P", 0, 8000, 238.10, 15.0, 25],
  ["ORCL", "A. Lindqvist", "EVP", 1, "P", 0, 4000, 241.60, 6.0, 19],
  ["SNOW", "M. Rhee", "CFO", 1, "S", 0, 60000, 205.30, -22.0, 12],
  ["SNOW", "G. Ortega", "Director", 0, "S", 0, 30000, 210.10, -35.0, 18],
];

interface TradeItem {
  t: string;
  name: string;
  role: string;
  cs: number;
  code: string;
  plan: number;
  sh: number;
  px: number;
  stake: number | null;
  ago: number;
  value: number;
  since: number;
}

// 13F fund metrics benchmark
interface F13Tuple {
  add: number;
  trim: number;
  newPos: number;
  exits: number;
  net: number;
  holders: number;
  own: string;
  buyer: string;
}

const RAW_F13_DATA: Record<string, [number, number, number, number, number, number, string, string]> = {
  HOOD: [188, 96, 63, 9, 7.4, 1388, "64.2%", "Halcyon Ridge Capital"],
  AVGO: [214, 118, 41, 12, 3.8, 4612, "77.9%", "Northgate Partners"],
  ORCL: [139, 88, 27, 8, 2.9, 3205, "44.6%", "Larkspur Capital"],
  PLTR: [161, 131, 38, 21, 2.6, 2940, "52.1%", "Copperline Advisors"],
  META: [176, 149, 22, 15, 1.2, 5104, "79.8%", "Westbrook Global"],
  MSFT: [150, 142, 11, 6, 0.4, 6881, "73.5%", "Vanguard Group"],
  TSLA: [102, 164, 9, 24, -1.8, 4377, "48.3%", "Geode Capital"],
  NVDA: [128, 171, 14, 19, -2.1, 5912, "67.4%", "BlackRock"],
  SNOW: [74, 158, 6, 37, -5.9, 1602, "61.0%", "Fernhill Partners"],
  INTC: [152, 134, 19, 14, 1.9, 3870, "64.8%", "Copperline Advisors"],
  LULU: [98, 121, 12, 16, -1.2, 1210, "86.1%", "Larkspur Capital"],
  UNH:  [140, 166, 15, 18, -0.9, 4021, "88.4%", "Copperline Advisors"],
  SOFI: [96, 58, 24, 5, 4.6, 912, "41.3%", "Halcyon Ridge Capital"],
  SMCI: [61, 112, 7, 26, -6.4, 744, "58.0%", "Geode Capital"],
  AMZN: [201, 155, 18, 9, 1.6, 6420, "62.7%", "Westbrook Global"],
  CRWD: [133, 90, 29, 7, 3.1, 1905, "73.0%", "Northgate Partners"],
  BTSG: [44, 51, 8, 6, -0.6, 288, "91.2%", "Fernhill Partners"],
  AUR:  [38, 22, 11, 3, 5.2, 402, "38.5%", "Larkspur Capital"],
  CVX:  [112, 140, 6, 12, -1.4, 3550, "70.9%", "Vanguard Group"],
  AMD:  [168, 120, 26, 10, 2.7, 3990, "69.8%", "Northgate Partners"],
};

// Formatter helpers
function seed(s: string) {
  let h = 7;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return () => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return h / 4294967296;
  };
}

const fm = (v: number) => {
  const a = Math.abs(v);
  return a >= 1e9
    ? "$" + (a / 1e9).toFixed(2) + "B"
    : a >= 1e6
    ? "$" + (a / 1e6).toFixed(a >= 1e8 ? 1 : 2) + "M"
    : "$" + (a / 1e3).toFixed(0) + "K";
};

const fp = (v: number, d = 1) =>
  (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(d) + "%";

// Filter definitions matching standalone HTML
interface ListDef {
  k: string;
  label: string;
  dot: string;
  src: string;
  hint: string;
  pick: (s: CompanyStats[]) => CompanyStats[];
  m: string;
}

const LISTS: ListDef[] = [
  {
    k: "notable",
    label: "Most notable",
    dot: UP,
    src: "FORM 4",
    hint: "Ranked by conviction: clusters, C-suite open-market buys and large off-plan sales. Routine 10b5-1 sales never rank.",
    pick: (S) => {
      const withSignals = S.filter(
        (s) => Math.abs(s.iS) >= 3 || s.buyV > 0 || s.offV > 0 || Math.abs(s.net) >= 1
      );
      const remainder = S.filter((s) => !withSignals.includes(s));
      return [
        ...withSignals.sort(
          (a, b) =>
            Math.abs(b.iS) - Math.abs(a.iS) ||
            b.buyV + b.offV - (a.buyV + a.offV) ||
            Math.abs(b.net) - Math.abs(a.net)
        ),
        ...remainder.sort((a, b) => b.holders - a.holders || a.t.localeCompare(b.t)),
      ];
    },
    m: "ins",
  },
  {
    k: "ibuy",
    label: "Insider buying",
    dot: UP,
    src: "FORM 4",
    hint: "Open-market purchases (code P) with personal cash, by total $.",
    pick: (S) => S.filter((s) => s.buyV > 0).sort((a, b) => b.buyV - a.buyV),
    m: "buy",
  },
  {
    k: "isell",
    label: "Insider selling",
    dot: DN,
    src: "FORM 4",
    hint: "Discretionary sales outside 10b5-1 plans — the sales that carry information.",
    pick: (S) => S.filter((s) => s.offV > 0).sort((a, b) => b.offV - a.offV),
    m: "sell",
  },
  {
    k: "cluster",
    label: "Cluster buys",
    dot: UP,
    src: "FORM 4",
    hint: "2+ different insiders buying within 30 days — historically the strongest insider pattern.",
    pick: (S) =>
      S.filter((s) => s.buyers >= 2).sort(
        (a, b) => b.buyers - a.buyers || b.buyV - a.buyV
      ),
    m: "buy",
  },
  {
    k: "acc",
    label: "Funds accumulating",
    dot: "#4a67d8",
    src: "13F",
    hint: "Largest net increase in shares held by 13F filers, Q2 vs Q1.",
    pick: (S) => S.filter((s) => s.net > 0).sort((a, b) => b.net - a.net),
    m: "f13",
  },
  {
    k: "dist",
    label: "Funds distributing",
    dot: "#c27b84",
    src: "13F",
    hint: "Largest net decrease in institutional shares, Q2 vs Q1.",
    pick: (S) => S.filter((s) => s.net < 0).sort((a, b) => a.net - b.net),
    m: "f13",
  },
  {
    k: "new",
    label: "New fund positions",
    dot: "#4a67d8",
    src: "13F",
    hint: "Most funds opening a brand-new stake this quarter.",
    pick: (S) => [...S].sort((a, b) => b.newPos - a.newPos),
    m: "new",
  },
  {
    k: "agree",
    label: "Insiders + funds agree",
    dot: AMB,
    src: "FORM 4 + 13F",
    hint: "Insiders and institutions moving the same direction — the highest-confluence setups.",
    pick: (S) =>
      S.filter(
        (s) => (s.iS >= 3 && s.net > 0) || (s.iS <= -3 && s.net < 0)
      ).sort((a, b) => Math.abs(b.iS) - Math.abs(a.iS)),
    m: "agree",
  },
];

interface CompanyStats {
  t: string;
  rs: TradeItem[];
  buys: TradeItem[];
  off: TradeItem[];
  plan: TradeItem[];
  buyV: number;
  offV: number;
  planV: number;
  buyers: number;
  csBuy: boolean;
  last: number | null;
  add: number;
  trim: number;
  newPos: number;
  exits: number;
  net: number;
  holders: number;
  own: string;
  buyer: string;
  netFunds: number;
  iS: number;
}

const tagOf = (s: CompanyStats): [string, string, string] =>
  s.buyers >= 3
    ? ["Cluster buy", UP, "var(--up-dim, rgba(74,222,128,.12))"]
    : s.buys.length && s.csBuy
    ? ["C-suite buy", UP, "var(--up-dim, rgba(74,222,128,.12))"]
    : s.buys.length
    ? ["Insider buy", UP, "var(--up-dim, rgba(74,222,128,.12))"]
    : s.off.length
    ? ["Off-plan sale", DN, "var(--down-dim, rgba(248,113,113,.12))"]
    : s.plan.length
    ? ["10b5-1 only", "var(--text-pure-dim)", "var(--surface-3)"]
    : ["Quiet", "var(--text-pure-dim)", "var(--surface-3)"];

// ---- Main Component ----
export function InsiderScreen() {
  const { openStockFull } = useIQActions();

  // Screen State
  const [activeListKey, setActiveListKey] = useState("notable");
  const [searchQuery, setSearchQuery] = useState("");
  const [focusTicker, setFocusTicker] = useState<string>("INTC");
  const [rangeDays, setRangeDays] = useState<number>(90);
  const [hidePlans, setHidePlans] = useState(false);
  const [hoverMarkerKey, setHoverMarkerKey] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: '/' focuses search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Live Backend Data
  const { data: liveInsiderTxRaw } = useApiList<InsiderTxDoc>("/market-data/insider-transactions");
  const { data: instOwnRaw } = useApiList<{
    ticker: string;
    investorsHolding: number | null;
    investorsHoldingChange: number | null;
    ownershipPercent: number | null;
  }>("/market-data/institutional-ownership");
  const { data: liveCompanies } = useApiList<CompanyDoc>("/market-data/companies");

  // Tracked universe of tickers
  const allTickers = useMemo(() => {
    const set = new Set(Object.keys(CURATED_COMPANIES));
    liveInsiderTxRaw.forEach((tx) => {
      if (tx.ticker) set.add(tx.ticker.toUpperCase().trim());
    });
    instOwnRaw.forEach((io) => {
      if (io.ticker) set.add(io.ticker.toUpperCase().trim());
    });
    (liveCompanies || []).forEach((c) => {
      if (c.ticker) set.add(c.ticker.toUpperCase().trim());
    });
    return Array.from(set);
  }, [liveInsiderTxRaw, instOwnRaw, liveCompanies]);

  // Live quotes for accurate live prices
  const liveQuotes = useLiveQuotes(allTickers);

  // Live 6M bars for the focused ticker
  const { bars: sixMonthBars } = useBackendBars(focusTicker || "INTC", "6M");

  // Live 13F holders for focused ticker
  const [liveHoldersDoc, setLiveHoldersDoc] = useState<Stock13FResponse | null>(null);
  useEffect(() => {
    if (!focusTicker) return;
    let cancelled = false;
    apiGet<Stock13FResponse>(`/live/13f-filings?ticker=${encodeURIComponent(focusTicker)}`)
      .then((res) => {
        if (!cancelled && res?.holders) setLiveHoldersDoc(res);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [focusTicker]);

  // Combined Company Profiles (curated + live updates)
  const companiesMap = useMemo(() => {
    const map = new Map<string, CompanyMeta>();
    // Seed with curated
    for (const [sym, c] of Object.entries(CURATED_COMPANIES)) {
      const q = liveQuotes.get(sym);
      map.set(sym, {
        name: c.name,
        price: q?.price != null && q.price > 0 ? q.price : c.price,
        chg: q?.pctChange != null ? q.pctChange : c.chg,
        logoBg: c.logoBg,
        logoFg: c.logoFg,
      });
    }
    // Overlay all live companies from backend database
    for (const c of (liveCompanies || [])) {
      if (!c.ticker) continue;
      const sym = c.ticker.toUpperCase().trim();
      const q = liveQuotes.get(sym);
      const existing = map.get(sym);
      map.set(sym, {
        name: c.name || existing?.name || sym,
        price: q?.price != null && q.price > 0 ? q.price : (c.price ?? existing?.price ?? 100.0),
        chg: q?.pctChange != null ? q.pctChange : (c.pctChange ?? existing?.chg ?? 0.0),
        logoBg: existing?.logoBg || "#1c2733",
        logoFg: existing?.logoFg || "#e8eef4",
      });
    }
    // Overlay any extra live tickers
    for (const sym of allTickers) {
      if (!map.has(sym)) {
        const q = liveQuotes.get(sym);
        map.set(sym, {
          name: sym,
          price: q?.price ?? 100.0,
          chg: q?.pctChange ?? 0.0,
          logoBg: "#1c2733",
          logoFg: "#e8eef4",
        });
      }
    }
    return map;
  }, [liveQuotes, allTickers, liveCompanies]);

  // Combined Form 4 Trades (curated + live transactions)
  const tradesList: TradeItem[] = useMemo(() => {
    // Start with curated trades
    const list: TradeItem[] = RAW_TRADES_DATA.map(
      ([t, name, role, cs, code, plan, sh, px, stake, ago]) => {
        const comp = companiesMap.get(t);
        const curPx = comp ? comp.price : px;
        return {
          t,
          name,
          role,
          cs,
          code,
          plan,
          sh,
          px,
          stake,
          ago,
          value: sh * px,
          since: px > 0 ? ((curPx / px) - 1) * 100 : 0,
        };
      }
    );

    // Overlay real live transactions from backend
    const now = Date.now();
    for (const tx of liveInsiderTxRaw) {
      if (!tx.ticker || !tx.shares || !tx.pricePerShare) continue;
      const t = tx.ticker.toUpperCase().trim();
      const txTime = Date.parse(tx.transactionDate);
      if (!Number.isFinite(txTime)) continue;
      const ago = Math.max(0, Math.round((now - txTime) / 86400000));
      if (ago > 180) continue; // within 6M

      const role = tx.officerTitle || (tx.isOfficer ? "Officer" : tx.ownerName || "Insider");
      const isCs = /CEO|CFO|COO|CTO|PRESIDENT|EXECUTIVE/i.test(role) ? 1 : 0;
      const code = tx.transactionCode || (tx.acquiredOrDisposed === "A" ? "P" : "S");
      const isPlan = 0; // standard Form 4 default
      const comp = companiesMap.get(t);
      const curPx = comp ? comp.price : tx.pricePerShare;

      list.push({
        t,
        name: tx.ownerName || "Insider",
        role,
        cs: isCs,
        code,
        plan: isPlan,
        sh: tx.shares,
        px: tx.pricePerShare,
        stake: null,
        ago,
        value: tx.shares * tx.pricePerShare,
        since: tx.pricePerShare > 0 ? ((curPx / tx.pricePerShare) - 1) * 100 : 0,
      });
    }

    return list;
  }, [companiesMap, liveInsiderTxRaw]);

  // Combined 13F Ownership Stats (curated + live ownership docs)
  const f13Map = useMemo(() => {
    const map = new Map<string, F13Tuple>();
    for (const [sym, data] of Object.entries(RAW_F13_DATA)) {
      map.set(sym, {
        add: data[0],
        trim: data[1],
        newPos: data[2],
        exits: data[3],
        net: data[4],
        holders: data[5],
        own: data[6],
        buyer: data[7],
      });
    }
    // Overlay real FMP institutional-ownership data
    for (const io of instOwnRaw) {
      if (!io.ticker) continue;
      const sym = io.ticker.toUpperCase().trim();
      const existing = map.get(sym);
      if (existing) {
        if (io.investorsHolding != null) existing.holders = io.investorsHolding;
        if (io.ownershipPercent != null) existing.own = (io.ownershipPercent * 100).toFixed(1) + "%";
        if (io.investorsHoldingChange != null && existing.holders > 0) {
          existing.net = +((io.investorsHoldingChange / existing.holders) * 100).toFixed(1);
        }
      } else {
        map.set(sym, {
          add: 120,
          trim: 95,
          newPos: 15,
          exits: 8,
          net: 1.8,
          holders: io.investorsHolding || 1450,
          own: io.ownershipPercent != null ? (io.ownershipPercent * 100).toFixed(1) + "%" : "65.0%",
          buyer: "Vanguard Group",
        });
      }
    }
    return map;
  }, [instOwnRaw]);

  // Compute stats for all companies in the window
  const allStats: CompanyStats[] = useMemo(() => {
    return Array.from(companiesMap.keys()).map((t) => {
      const rs = tradesList.filter((r) => r.t === t && r.ago <= rangeDays);
      const buys = rs.filter((r) => r.code === "P");
      const off = rs.filter((r) => r.code === "S" && !r.plan);
      const plan = rs.filter((r) => r.code === "S" && r.plan);

      const buyV = buys.reduce((a, r) => a + r.value, 0);
      const offV = off.reduce((a, r) => a + r.value, 0);
      const planV = plan.reduce((a, r) => a + r.value, 0);

      const buyers = new Set(buys.map((r) => r.name)).size;
      const csBuy = buys.some((r) => r.cs === 1);
      const last = rs.length ? Math.min(...rs.map((r) => r.ago)) : null;

      const f = f13Map.get(t) || {
        add: 100,
        trim: 100,
        newPos: 10,
        exits: 10,
        net: 0,
        holders: 1000,
        own: "50%",
        buyer: "Institutional",
      };

      const iS =
        buyers >= 3
          ? 5
          : buys.length && csBuy
          ? 4
          : buys.length
          ? 3
          : off.length
          ? offV > 1e8
            ? -4
            : -3
          : plan.length
          ? -1
          : 0;

      return {
        t,
        rs,
        buys,
        off,
        plan,
        buyV,
        offV,
        planV,
        buyers,
        csBuy,
        last,
        add: f.add,
        trim: f.trim,
        newPos: f.newPos,
        exits: f.exits,
        net: f.net,
        holders: f.holders,
        own: f.own,
        buyer: f.buyer,
        netFunds: f.add - f.trim,
        iS,
      };
    });
  }, [companiesMap, tradesList, f13Map, rangeDays]);

  // Stats dictionary for fast lookup
  const statsMap = useMemo(() => {
    const map = new Map<string, CompanyStats>();
    allStats.forEach((s) => map.set(s.t, s));
    return map;
  }, [allStats]);

  // Metric string generator for the left list
  const formatMetric = (s: CompanyStats, mode: string) => {
    const ago = s.last != null ? s.last + "d ago" : "";
    if (mode === "buy") return ["+" + fm(s.buyV), s.buyers + " insider" + (s.buyers > 1 ? "s" : "") + " · " + ago, UP];
    if (mode === "sell") return ["−" + fm(s.offV), s.off.length + " off-plan · " + ago, DN];
    if (mode === "f13") return [fp(s.net) + " shs", (s.netFunds > 0 ? "+" : "") + s.netFunds + " net funds", s.net >= 0 ? UP : DN];
    if (mode === "new") return [s.newPos + " new", s.exits + " exits", "#8fa6ff"];
    if (mode === "agree") return [s.iS > 0 ? "Both buying" : "Both selling", "funds " + fp(s.net), s.iS > 0 ? UP : DN];
    return s.iS > 0
      ? ["+" + fm(s.buyV), s.buyers + " buyer" + (s.buyers > 1 ? "s" : "") + " · " + ago, UP]
      : ["−" + fm(s.offV), "off-plan · " + ago, DN];
  };

  // Filtered List for Left Column
  const currentListDef = useMemo(() => {
    return LISTS.find((l) => l.k === activeListKey) || LISTS[0];
  }, [activeListKey]);

  const searchQ = searchQuery.trim().toUpperCase();

  const filteredStatsList = useMemo(() => {
    if (searchQ) {
      return allStats.filter(
        (s) => s.t.startsWith(searchQ) || (companiesMap.get(s.t)?.name || "").toUpperCase().includes(searchQ)
      );
    }
    return currentListDef.pick(allStats);
  }, [searchQ, allStats, companiesMap, currentListDef]);

  // Ensure focus ticker is valid
  useEffect(() => {
    if (filteredStatsList.length > 0 && !filteredStatsList.some((s) => s.t === focusTicker) && searchQ) {
      setFocusTicker(filteredStatsList[0].t);
    }
  }, [filteredStatsList, focusTicker, searchQ]);

  // Active focus data
  const focusStats = statsMap.get(focusTicker) || allStats[0] || null;
  const focusCompany = companiesMap.get(focusTicker) || {
    name: focusTicker,
    price: 100.0,
    chg: 0.0,
    logoBg: "#0068b5",
    logoFg: "#fff",
  };

  // Generate 6M price series for chart
  const priceSeries = useMemo(() => {
    if (sixMonthBars && sixMonthBars.length >= 10) {
      // Sample or interpolate into N_BARS
      const closes = sixMonthBars.map((b) => b.c);
      if (closes.length === N_BARS) return closes;
      const step = (closes.length - 1) / (N_BARS - 1);
      const res: number[] = [];
      for (let i = 0; i < N_BARS; i++) {
        const idx = Math.min(closes.length - 1, Math.round(i * step));
        res.push(closes[idx]);
      }
      return res;
    }

    // Realistic seeded baseline price series
    const R = seed(focusTicker);
    const end = focusCompany.price;
    const an: Record<number, number> = { 0: end * (0.82 + R() * 0.3) };
    an[N_BARS - 1] = end;

    const stockTrades = tradesList.filter((r) => r.t === focusTicker && r.code !== "M");
    stockTrades.forEach((r) => {
      const idx = Math.max(0, Math.min(N_BARS - 1, N_BARS - 1 - r.ago));
      an[idx] = r.px;
    });

    const idxArr = Object.keys(an).map(Number).sort((a, b) => a - b);
    const out = new Array<number>(N_BARS);
    for (let k = 0; k < idxArr.length - 1; k++) {
      const a = idxArr[k];
      const b = idxArr[k + 1];
      const L = b - a;
      const w = [0];
      for (let j = 1; j <= L; j++) w.push(w[j - 1] + (R() - 0.5) * 0.035);
      for (let j = 0; j <= L; j++) {
        const f = j / L;
        out[a + j] = (an[a] + (an[b] - an[a]) * f) * (1 + w[j] - w[L] * f);
      }
    }
    return out;
  }, [sixMonthBars, focusTicker, focusCompany.price, tradesList]);

  // Scaled SVG Path Points
  const { svgPoints, svgArea, minPrice, maxPrice, ret6M } = useMemo(() => {
    if (!priceSeries || priceSeries.length === 0) {
      return { svgPoints: "", svgArea: "", minPrice: 0, maxPrice: 100, ret6M: 0 };
    }
    const mn = Math.min(...priceSeries);
    const mx = Math.max(...priceSeries);
    const range = mx - mn || 1;
    const getY = (v: number) => 10 + ((mx - v) / range) * 80;

    const pts = priceSeries
      .map((v, i) => `${((i / (N_BARS - 1)) * 100).toFixed(2)},${getY(v).toFixed(2)}`)
      .join(" ");

    const area = `${pts} 100,100 0,100`;
    const ret = ((priceSeries[N_BARS - 1] / priceSeries[0]) - 1) * 100;

    return { svgPoints: pts, svgArea: area, minPrice: mn, maxPrice: mx, ret6M: ret };
  }, [priceSeries]);

  // Focus Deep-Dive Details
  const deepDive = useMemo(() => {
    if (!focusStats) return null;

    const s = focusStats;
    const t = s.t;
    const name = focusCompany.name;
    const px = focusCompany.price;
    const chg = focusCompany.chg;

    const iC = s.iS >= 3 ? UP : s.iS <= -3 ? DN : GR;
    const iVerdict =
      s.buyers >= 3
        ? "Cluster buying"
        : s.iS === 4
        ? "C-suite buying"
        : s.iS === 3
        ? "Insider buying"
        : s.iS <= -3
        ? "Discretionary selling"
        : s.plan.length
        ? "Routine selling only"
        : "No activity";

    const iWhy =
      s.buyers >= 3
        ? `${s.buyers} insiders bought ${fm(s.buyV)} on the open market within days — the highest-conviction Form 4 pattern.`
        : s.buys.length
        ? `${s.buyers} insider${s.buyers > 1 ? "s" : ""} bought ${fm(s.buyV)} with personal cash${
            s.csBuy ? ", including C-suite" : ""
          }. Buys are the cleaner signal — sales have many reasons.`
        : s.off.length
        ? `${fm(s.offV)} sold outside 10b5-1 plans. Off-plan sales are discretionary — watch size vs. holdings and whether more insiders follow.`
        : s.plan.length
        ? `All ${fm(s.planV)} of sales were pre-scheduled 10b5-1 plans. Treat as routine liquidity, not a view on the stock.`
        : `No Form 4 filings in the last ${rangeDays} days.`;

    const fC = s.net >= 2 ? UP : s.net <= -2 ? DN : s.net > 0 ? "var(--brand)" : s.net < 0 ? "var(--down)" : GR;
    const fVerdict =
      s.net >= 2 ? "Accumulating" : s.net <= -2 ? "Distributing" : s.net > 0 ? "Slight net buying" : "Slight net selling";

    const fWhy = `${s.add.toLocaleString()} funds added vs ${s.trim.toLocaleString()} trimmed; ${s.newPos} opened new stakes, ${s.exits} sold out. Largest buyer: ${s.buyer}.`;

    const agree =
      s.iS >= 3 && s.net > 0
        ? ["Confluence: insiders and funds are both buying", UP]
        : s.iS <= -3 && s.net < 0
        ? ["Confluence: insiders and funds are both selling", DN]
        : s.iS >= 3 && s.net <= -2
        ? ["Divergence: insiders buying while funds distribute", AMB]
        : s.iS <= -3 && s.net >= 2
        ? ["Divergence: insiders selling into fund accumulation", AMB]
        : null;

    // Build trade markers along the chart curve
    const rangePx = maxPrice - minPrice || 1;
    const getY = (v: number) => 10 + ((maxPrice - v) / rangePx) * 80;

    const visibleTrades = s.rs.filter((r) => r.code !== "M");
    const markers = visibleTrades.map((r, j) => {
      const isBuy = r.code === "P";
      const isOff = r.code === "S" && !r.plan;
      const isPln = r.code === "S" && r.plan;

      const i = Math.max(0, Math.min(N_BARS - 1, N_BARS - 1 - r.ago));
      const xp = (i / (N_BARS - 1)) * 100;
      const currentBarPrice = priceSeries[i] || r.px;
      const yp = getY(currentBarPrice);

      const mKey = `${t}_${j}`;
      const isHovered = hoverMarkerKey === mKey;
      const ring = isBuy ? UP : isOff ? DN : "var(--warn, #c27b84)";
      const fill = isBuy ? UP : isOff ? DN : "var(--surface-1)";
      const label = isBuy ? "B" : isOff ? "S" : "";

      const tradeDate = new Date(Date.now() - r.ago * 86400000).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      return {
        key: mKey,
        x: xp,
        y: yp,
        ring,
        fill,
        label,
        isHovered,
        tip: {
          name: r.name,
          role: r.role,
          type: isBuy ? "Open-market buy" : isPln ? "10b5-1 plan sale" : "Discretionary sale",
          color: ring,
          value: (isBuy ? "+" : "−") + fm(r.value),
          date: tradeDate,
          shares: r.sh.toLocaleString("en-US") + " sh @ $" + r.px.toFixed(2),
          stake: r.stake == null ? "New position" : r.stake === 0 ? "—" : fp(r.stake) + " of holdings",
          since: fp(r.since),
          sinceColor: r.since >= 0 ? UP : DN,
          filed: "Form 4 · filed " + (r.ago <= 7 ? "1d" : "2d") + " after trade",
        },
      };
    });

    // Form 4 filings list for bottom left panel
    const filteredFilings = s.rs
      .filter((r) => !(hidePlans && r.plan))
      .sort((a, b) => a.ago - b.ago)
      .map((r) => {
        const isBuy = r.code === "P";
        const isPln = r.code === "S" && r.plan;
        const isEx = r.code === "M";
        const c = isBuy ? UP : isPln ? "var(--warn, #c27b84)" : isEx ? GR : DN;
        const codeBg = isBuy
          ? "var(--up-dim, rgba(74,222,128,.12))"
          : isEx
          ? "var(--surface-3)"
          : "var(--down-dim, rgba(248,113,113,.12))";
        const typeLabel = isBuy
          ? "Open-market buy"
          : isEx
          ? "Option exercise"
          : isPln
          ? "10b5-1 sale"
          : "Discretionary sale";
        const filingDate = new Date(Date.now() - r.ago * 86400000).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });

        return {
          ...r,
          color: c,
          codeBg,
          typeLabel,
          sharesStr: r.sh.toLocaleString("en-US"),
          priceStr: "$" + r.px.toFixed(2),
          valueStr: (isBuy ? "+" : isEx ? "" : "−") + fm(r.value),
          sinceStr: fp(r.since),
          sinceColor: r.since >= 0 ? UP : DN,
          dateStr: filingDate,
        };
      });

    // Top 13F holders for bottom right panel
    let topHolders: Array<{ name: string; pct: string; chg: string; color: string }> = [];
    if (liveHoldersDoc?.holders && liveHoldersDoc.holders.length > 0) {
      topHolders = liveHoldersDoc.holders.slice(0, 6).map((h) => {
        const chgNum = h.changeInSharesPct ?? 0;
        const isNew = h.activityStatus === "New";
        return {
          name: h.investorName || "Institutional Investor",
          pct: h.ownershipPct != null ? (h.ownershipPct * 100).toFixed(1) + "%" : "—",
          chg: isNew ? "New" : chgNum === 0 ? "—" : fp(chgNum),
          color: isNew || chgNum > 0 ? UP : chgNum < 0 ? DN : GR,
        };
      });
    } else {
      const R = seed(t + "h");
      const pc = () => +(R() * 2.4 - 1.2).toFixed(1);
      const mockTop = [
        ["Vanguard Group", (7 + R() * 2.5).toFixed(1) + "%", pc()],
        ["BlackRock", (6 + R() * 2).toFixed(1) + "%", pc()],
        ["State Street", (3 + R() * 1.5).toFixed(1) + "%", pc()],
        [s.buyer === "Vanguard Group" ? "FMR LLC" : s.buyer, (0.8 + R() * 2).toFixed(1) + "%", s.net > 0 ? +(8 + R() * 30).toFixed(1) : null],
        ["Geode Capital", (1.6 + R() * 0.8).toFixed(1) + "%", pc()],
        ["Morgan Stanley", (1 + R() * 1).toFixed(1) + "%", pc()],
      ];
      topHolders = mockTop.map(([hName, pct, cVal]) => ({
        name: hName as string,
        pct: pct as string,
        chg: cVal == null ? "New" : cVal === 0 ? "—" : fp(cVal as number),
        color: cVal == null || (cVal as number) > 0 ? UP : (cVal as number) < 0 ? DN : GR,
      }));
    }

    const tint = (color: string) =>
      color === UP
        ? ["var(--up-dim, rgba(74,222,128,.12))", "var(--brand-line, rgba(74,222,128,.30))"]
        : color === DN
        ? ["var(--down-dim, rgba(248,113,113,.12))", "var(--down-line, rgba(248,113,113,.30))"]
        : ["var(--surface-2)", "var(--border)"];

    return {
      t,
      name,
      price: "$" + px.toFixed(2),
      chg: fp(chg, 2),
      chgColor: chg >= 0 ? UP : DN,
      iVerdict,
      iWhy,
      iColor: iC,
      iBg: tint(iC)[0],
      iBorder: tint(iC)[1],
      iDots: [1, 2, 3, 4, 5].map((idx) => ({
        color: idx <= Math.abs(s.iS) ? iC : "var(--border)",
      })),
      fVerdict,
      fWhy,
      fColor: fC,
      fNet: fp(s.net) + " shs",
      fBg: tint(s.net >= 2 ? UP : s.net <= -2 ? DN : GR)[0],
      fBorder: tint(s.net >= 2 ? UP : s.net <= -2 ? DN : GR)[1],
      hasAlign: !!agree,
      alignText: agree ? agree[0] : "",
      alignColor: agree ? agree[1] : GR,
      markers,
      trades: filteredFilings,
      nBuy: s.buys.length,
      nSell: s.off.length + s.plan.length,
      emptyMsg: s.rs.length
        ? "Only 10b5-1 plan sales — hidden."
        : `No Form 4 filings in the last ${rangeDays} days.`,
      holders: s.holders.toLocaleString("en-US"),
      own: s.own,
      added: (s.add * 11).toLocaleString("en-US"),
      cut: (s.trim * 11).toLocaleString("en-US"),
      addedN: s.add,
      cutN: s.trim,
      newPos: s.newPos * 5,
      exits: s.exits * 5,
      topHolders,
    };
  }, [
    focusStats,
    focusCompany,
    maxPrice,
    minPrice,
    rangeDays,
    hoverMarkerKey,
    hidePlans,
    liveHoldersDoc,
    priceSeries,
  ]);

  // Overall Header Metrics
  const headerLead = useMemo(() => {
    return LISTS[0].pick(allStats)[0] || allStats[0];
  }, [allStats]);

  const totalBuysCount = useMemo(() => {
    return tradesList.filter((r) => r.code === "P" && r.ago <= rangeDays).length;
  }, [tradesList, rangeDays]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100%",
        background: "var(--bg)",
        color: "var(--text-pure)",
        fontFamily: "'Manrope', ui-sans-serif, -apple-system, sans-serif",
      }}
    >
      {/* 1. Header Title & Stats Bar */}
      <div
        style={{
          padding: "16px 20px 14px",
          borderBottom: "1px solid var(--border-soft)",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            fontSize: 12.5,
            color: "var(--text-pure)",
          }}
        >
          <span style={{ color: "var(--text-pure)", fontWeight: 600 }}>
            {allStats.length} stocks tracked
          </span>
          <span style={{ color: "var(--text-pure)" }}>·</span>
          <span style={{ color: "var(--text-pure)" }}>
            <span style={{ color: "var(--text-pure)", fontWeight: 700 }}>{totalBuysCount}</span> open-market buys ({rangeDays}D)
          </span>
          <span style={{ color: "var(--text-pure)" }}>·</span>
          <span style={{ color: "var(--text-pure)" }}>
            Top signal:{" "}
            <span style={{ color: "var(--text-pure)", fontWeight: 700 }}>{headerLead?.t || "INTC"}</span>{" "}
            <span style={{ color: "var(--text-pure)", fontWeight: 700 }}>{headerLead ? tagOf(headerLead)[0] : "Cluster buy"}</span>
          </span>
          <span style={{ color: "var(--text-pure)" }}>·</span>
          <span style={{ color: "var(--text-pure)" }}>13F Q2-26 filed Aug 14</span>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9.5,
              fontWeight: 700,
              padding: "2px 6px",
              borderRadius: 4,
              background: "var(--warn-dim, rgba(245,181,68,.12))",
              color: "var(--warn)",
            }}
          >
            SEC EDGAR
          </span>
        </div>
      </div>

      {/* 2. Category Filter Chips & Time Window */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          padding: "12px 20px",
        }}
      >
        {LISTS.map((l) => {
          const isActive = !searchQ && l.k === activeListKey;
          return (
            <button
              key={l.k}
              onClick={() => {
                setActiveListKey(l.k);
                setSearchQuery("");
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "6px 14px",
                borderRadius: 999,
                fontSize: 13,
                fontWeight: isActive ? 800 : 600,
                cursor: "pointer",
                border: `1px solid ${isActive ? UP : "var(--border)"}`,
                background: isActive ? UP : "var(--surface-1)",
                color: isActive ? "var(--on-brand)" : "var(--text-pure)",
                transition: "all 150ms ease",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: isActive ? "var(--on-brand)" : l.dot,
                }}
              />
              {l.label}
            </button>
          );
        })}

        {/* Insider Window Selector */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.06em",
              color: "var(--text-pure)",
            }}
          >
            INSIDER WINDOW
          </span>
          <div
            style={{
              display: "flex",
              gap: 2,
              padding: 2,
              border: "1px solid var(--border)",
              borderRadius: 8,
              background: "var(--surface-1)",
            }}
          >
            {[30, 60, 90].map((d) => {
              const on = rangeDays === d;
              return (
                <button
                  key={d}
                  onClick={() => setRangeDays(d)}
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 12,
                    fontWeight: on ? 800 : 600,
                    padding: "4px 10px",
                    borderRadius: 6,
                    cursor: "pointer",
                    border: "none",
                    color: on ? "var(--text-pure)" : "var(--text-pure-dim)",
                    background: on ? "var(--surface-3)" : "transparent",
                    transition: "all 120ms ease",
                  }}
                >
                  {d}D
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Main Master-Detail Layout */}
      <div
        style={{
          display: "flex",
          gap: 16,
          alignItems: "flex-start",
          flexWrap: "wrap",
          padding: "0 20px 24px",
        }}
      >
        {/* LEFT COLUMN: Stock List */}
        <section
          style={{
            flex: "0 1 410px",
            minWidth: 330,
            background: "var(--surface-1)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            boxShadow: "var(--shadow)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "14px 16px 10px",
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-pure)" }}>
              {searchQ ? "Search results" : currentListDef.label}
            </div>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9.5,
                fontWeight: 800,
                padding: "2px 6px",
                borderRadius: 4,
                background: "var(--warn-dim, rgba(245,181,68,.12))",
                color: "var(--warn)",
              }}
            >
              {searchQ ? "ALL" : currentListDef.src}
            </span>
            <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, color: "var(--text-pure-dim)" }}>
              {filteredStatsList.length} stocks
            </span>
          </div>

          {/* Search Input & Hint */}
          <div
            style={{
              padding: "0 16px 12px",
              borderBottom: "1px solid var(--border-soft)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                border: `1px solid ${searchQ ? "var(--brand)" : "var(--border)"}`,
                borderRadius: 8,
                background: "var(--surface-2)",
              }}
            >
              <span style={{ color: "var(--text-pure)", fontSize: 13, fontWeight: 700 }}>⌕</span>
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setSearchQuery("");
                }}
                placeholder="Search any company — ticker or name"
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: "transparent",
                  border: 0,
                  outline: "none",
                  color: "var(--text-pure)",
                  fontFamily: "'Manrope', sans-serif",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              />
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: "var(--text-pure-dim)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  padding: "1px 6px",
                }}
              >
                /
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-pure-dim)", fontWeight: 500, lineHeight: 1.4 }}>
              {searchQ ? "Showing insider + 13F read for every match." : currentListDef.hint}
            </div>
          </div>

          {/* Scrollable Rows */}
          <div style={{ maxHeight: 720, overflowY: "auto" }}>
            {filteredStatsList.map((s, idx) => {
              const comp = companiesMap.get(s.t) || {
                name: s.t,
                price: 100.0,
                chg: 0.0,
                logoBg: "#0068b5",
                logoFg: "#fff",
              };
              const [tag, tagColor, tagBg] = tagOf(s);
              const [metricText, metricSub, metricColor] = formatMetric(
                s,
                searchQ ? "ins" : currentListDef.m
              );
              const isSelected = focusTicker === s.t;

              return (
                <div
                  key={s.t}
                  onClick={() => setFocusTicker(s.t)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "18px 32px minmax(0,1fr) auto 82px",
                    gap: 12,
                    alignItems: "center",
                    padding: "11px 16px",
                    borderBottom: "1px solid var(--border-soft)",
                    cursor: "pointer",
                    background: isSelected ? "var(--surface-2)" : "transparent",
                    boxShadow: isSelected ? `inset 2px 0 0 ${UP}` : "none",
                    transition: "background 140ms ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "var(--surface-3)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--text-pure-dim)",
                    }}
                  >
                    {idx + 1}
                  </span>
                  <div
                    style={{
                      position: "relative",
                      width: 32,
                      height: 32,
                      minWidth: 32,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <StockLogo
                      sym={s.t}
                      size={21}
                      style={{
                        width: 32,
                        height: 32,
                        minWidth: 32,
                        maxWidth: 32,
                        minHeight: 32,
                        maxHeight: 32,
                        borderRadius: 8,
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 14.5, fontWeight: 800, letterSpacing: "0.01em", flexShrink: 0, color: "var(--text-pure)" }}>
                        {s.t}
                      </span>
                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: 700,
                          padding: "2px 5px",
                          borderRadius: 4,
                          background: tagBg,
                          color: tagColor,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {tag}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 500,
                        color: "var(--text-pure-dim)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {comp.name}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: metricColor,
                      }}
                    >
                      {metricText}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-pure-dim)", whiteSpace: "nowrap" }}>
                      {metricSub}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-pure)" }}>${comp.price.toFixed(2)}</span>
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: comp.chg >= 0 ? UP : DN,
                      }}
                    >
                      {comp.chg >= 0 ? "▲ " : "▼ "}
                      {Math.abs(comp.chg).toFixed(2)}%
                    </span>
                  </div>
                </div>
              );
            })}
            {filteredStatsList.length === 0 && (
              <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-pure-dim)", fontWeight: 500 }}>
                No company matches “{searchQuery}”.
              </div>
            )}
          </div>
        </section>

        {/* RIGHT COLUMN: Stock Deep-Dive */}
        {deepDive && (
          <section
            style={{
              flex: "1 1 580px",
              minWidth: 320,
              background: "var(--surface-1)",
              border: "1px solid var(--border)",
              borderTop: "1px solid var(--brand)",
              borderRadius: 12,
              boxShadow: "var(--shadow)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Header: Logo, Ticker, Price, Open Stock Page */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "16px 20px",
                borderBottom: "1px solid var(--border-soft)",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: 44,
                  height: 44,
                  minWidth: 44,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <StockLogo
                  sym={deepDive.t}
                  size={29}
                  style={{
                    width: 44,
                    height: 44,
                    minWidth: 44,
                    maxWidth: 44,
                    minHeight: 44,
                    maxHeight: 44,
                    borderRadius: 10,
                  }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flexShrink: 0 }}>
                <span style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.1, color: "var(--text-pure)" }}>{deepDive.t}</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-pure-dim)", whiteSpace: "nowrap" }}>{deepDive.name}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 8,
                  paddingLeft: 16,
                  borderLeft: "1px solid var(--border-soft)",
                }}
              >
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 21,
                    fontWeight: 800,
                    color: "var(--text-pure)",
                  }}
                >
                  {deepDive.price}
                </span>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: deepDive.chgColor,
                  }}
                >
                  {deepDive.chg}
                </span>
              </div>
              <button
                onClick={() => openStockFull(deepDive.t)}
                style={{
                  marginLeft: "auto",
                  fontSize: 13,
                  fontWeight: 700,
                  padding: "7px 14px",
                  borderRadius: 8,
                  background: UP,
                  color: "var(--on-brand, #04140c)",
                  border: "none",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "opacity 140ms ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                Open stock page →
              </button>
            </div>

            {/* Dual Verdict Cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 12,
                padding: "16px 20px 6px",
              }}
            >
              {/* Insider Verdict */}
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: 10,
                  background: deepDive.iBg,
                  border: `1px solid ${deepDive.iBorder}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: "0.08em",
                      color: "var(--text-pure)",
                    }}
                  >
                    INSIDERS · {rangeDays}D
                  </span>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 3 }}>
                    {deepDive.iDots.map((d, idx) => (
                      <div
                        key={idx}
                        style={{
                          width: 4,
                          height: 11,
                          borderRadius: 1,
                          background: d.color,
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div style={{ fontSize: 15.5, fontWeight: 800, color: deepDive.iColor }}>
                  {deepDive.iVerdict}
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-pure-dim)", lineHeight: 1.5 }}>
                  {deepDive.iWhy}
                </div>
              </div>

              {/* Funds 13F Verdict */}
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: 10,
                  background: deepDive.fBg,
                  border: `1px solid ${deepDive.fBorder}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: "0.08em",
                      color: "var(--text-pure)",
                    }}
                  >
                    FUNDS · 13F Q2-26
                  </span>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 12,
                      fontWeight: 700,
                      color: deepDive.fColor,
                    }}
                  >
                    {deepDive.fNet}
                  </span>
                </div>
                <div style={{ fontSize: 15.5, fontWeight: 800, color: deepDive.fColor }}>
                  {deepDive.fVerdict}
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-pure-dim)", lineHeight: 1.5 }}>
                  {deepDive.fWhy}
                </div>
              </div>
            </div>

            {/* Optional Confluence / Divergence Banner */}
            {deepDive.hasAlign && (
              <div
                style={{
                  margin: "8px 20px 0",
                  padding: "8px 14px",
                  borderRadius: 8,
                  background: "var(--surface-2)",
                  border: `1px dashed ${deepDive.alignColor}`,
                  color: deepDive.alignColor,
                  fontSize: 12.5,
                  fontWeight: 700,
                }}
              >
                ◆ {deepDive.alignText}
              </div>
            )}

            {/* 6M Price Chart with Form 4 Trade Markers */}
            <div style={{ padding: "16px 20px 8px", display: "flex", flexDirection: "column", gap: 8 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  flexWrap: "wrap",
                  fontSize: 11.5,
                  color: "var(--text-pure-dim)",
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: "var(--text-pure)" }}>
                  PRICE · 6M
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontWeight: 600 }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: UP }} />
                  Buy
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontWeight: 600 }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: DN }} />
                  Off-plan sale
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontWeight: 600 }}>
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: "50%",
                      border: "1.5px solid var(--warn, #c27b84)",
                    }}
                  />
                  10b5-1 sale
                </span>
                <span
                  style={{
                    marginLeft: "auto",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 700,
                    color: ret6M >= 0 ? UP : DN,
                  }}
                >
                  6M {fp(ret6M)}
                </span>
              </div>

              {/* Chart Canvas */}
              <div style={{ position: "relative", height: 175 }}>
                {/* 13F Window Shaded Zone */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: "46%",
                    background: "rgba(243,178,74,0.06)",
                    borderRight: "1px dashed var(--border)",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: 8,
                    top: 6,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                    fontWeight: 600,
                    color: "var(--warn)",
                  }}
                >
                  Q2 13F WINDOW · funds {deepDive.fNet}
                </div>

                {/* SVG Curve */}
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
                >
                  <polygon points={svgArea} fill="#3b82f6" fillOpacity="0.12" />
                  <polyline
                    points={svgPoints}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="1.8"
                    vectorEffect="non-scaling-stroke"
                    strokeLinejoin="round"
                  />
                </svg>

                {/* Interactive Trade Markers */}
                {deepDive.markers.map((m) => {
                  return (
                    <div
                      key={m.key}
                      onMouseEnter={() => setHoverMarkerKey(m.key)}
                      onMouseLeave={() => setHoverMarkerKey(null)}
                      style={{
                        position: "absolute",
                        left: `${m.x}%`,
                        top: `${m.y}%`,
                        zIndex: m.isHovered ? 4 : 2,
                        transform: "translate(-50%, -50%)",
                        width: m.isHovered ? 18 : 14,
                        height: m.isHovered ? 18 : 14,
                        borderRadius: "50%",
                        background: m.fill,
                        border: `1.5px solid ${m.ring}`,
                        boxShadow: "0 0 0 2px var(--surface-1)",
                        display: "grid",
                        placeItems: "center",
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 8,
                        fontWeight: 700,
                        color: m.fill === UP || m.fill === DN ? "var(--on-brand, #ffffff)" : "var(--text-hi)",
                        cursor: "pointer",
                        transition: "width 120ms, height 120ms",
                      }}
                    >
                      {m.label}

                      {/* Hover Tooltip Popover */}
                      {m.isHovered && (
                        <div
                          style={{
                            position: "absolute",
                            left: "50%",
                            bottom: m.y < 45 ? "auto" : "calc(100% + 12px)",
                            top: m.y < 45 ? "calc(100% + 12px)" : "auto",
                            transform: "translateX(-50%)",
                            zIndex: 10,
                            pointerEvents: "none",
                            width: 250,
                            background: "var(--surface-1)",
                            border: "1px solid var(--border-strong)",
                            borderTop: `2px solid ${m.tip.color}`,
                            borderRadius: 9,
                            boxShadow: "var(--shadow)",
                            padding: "10px 12px",
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-pure)" }}>
                              {m.tip.name}
                            </span>
                            <span style={{ fontSize: 11.5, fontWeight: 500, color: "var(--text-pure-dim)" }}>{m.tip.role}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: m.tip.color }}>
                              {m.tip.type}
                            </span>
                            <span
                              style={{
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: 14,
                                fontWeight: 800,
                                color: m.tip.color,
                              }}
                            >
                              {m.tip.value}
                            </span>
                          </div>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "auto 1fr",
                              gap: "3px 12px",
                              fontSize: 11.5,
                            }}
                          >
                            <span style={{ color: "var(--text-pure-dim)", fontWeight: 500 }}>Trade</span>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "var(--text-pure)", fontWeight: 700, textAlign: "right" }}>
                              {m.tip.date}
                            </span>
                            <span style={{ color: "var(--text-pure-dim)", fontWeight: 500 }}>Size</span>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "var(--text-pure)", fontWeight: 700, textAlign: "right" }}>
                              {m.tip.shares}
                            </span>
                            <span style={{ color: "var(--text-pure-dim)", fontWeight: 500 }}>Stake</span>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "var(--text-pure)", fontWeight: 700, textAlign: "right" }}>
                              {m.tip.stake}
                            </span>
                            <span style={{ color: "var(--text-pure-dim)", fontWeight: 500 }}>Since trade</span>
                            <span
                              style={{
                                fontFamily: "'JetBrains Mono', monospace",
                                textAlign: "right",
                                color: m.tip.sinceColor,
                                fontWeight: 700,
                              }}
                            >
                              {m.tip.since}
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: 10.5,
                              color: "var(--text-pure-dim)",
                              fontWeight: 500,
                              paddingTop: 6,
                              borderTop: "1px solid var(--border-soft)",
                            }}
                          >
                            {m.tip.filed}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Month X-Axis Ticks */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  fontWeight: 600,
                  color: "var(--text-pure-dim)",
                  padding: "0 4px",
                }}
              >
                <span>APR</span>
                <span>MAY</span>
                <span>JUN</span>
                <span>JUL</span>
                <span>AUG</span>
                <span>SEP</span>
                <span>OCT</span>
              </div>
            </div>

            {/* Dual Sub-Panels: Form 4 filings & 13F holders */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                borderTop: "1px solid var(--border-soft)",
                marginTop: 10,
              }}
            >
              {/* Left Sub-Panel: Form 4 Filings */}
              <div style={{ display: "flex", flexDirection: "column", borderRight: "1px solid var(--border-soft)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 20px 10px" }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text-pure)" }}>Form 4 filings</span>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      padding: "2px 7px",
                      borderRadius: 4,
                      background: "var(--up-dim, rgba(74,222,128,.12))",
                      color: UP,
                    }}
                  >
                    {deepDive.nBuy} buys
                  </span>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      padding: "2px 7px",
                      borderRadius: 4,
                      background: "var(--down-dim, rgba(248,113,113,.12))",
                      color: DN,
                    }}
                  >
                    {deepDive.nSell} sells
                  </span>
                  <button
                    onClick={() => setHidePlans(!hidePlans)}
                    style={{
                      marginLeft: "auto",
                      fontSize: 11.5,
                      fontWeight: 600,
                      padding: "3px 9px",
                      borderRadius: 999,
                      cursor: "pointer",
                      border: `1px solid var(--border)`,
                      color: hidePlans ? "var(--text-pure)" : "var(--text-pure-dim)",
                      background: hidePlans ? "var(--surface-3)" : "transparent",
                    }}
                  >
                    {hidePlans ? "✓ 10b5-1 hidden" : "Hide 10b5-1"}
                  </button>
                </div>

                {deepDive.trades.map((tr, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "22px minmax(0,1fr) auto",
                      gap: 10,
                      alignItems: "center",
                      padding: "10px 20px",
                      borderTop: "1px solid var(--border-soft)",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 10,
                        fontWeight: 700,
                        width: 22,
                        height: 20,
                        minWidth: 22,
                        flexShrink: 0,
                        borderRadius: 4,
                        display: "grid",
                        placeItems: "center",
                        background: tr.codeBg,
                        color: tr.color,
                      }}
                    >
                      {tr.code}
                    </span>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "var(--text-pure)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {tr.name} <span style={{ fontWeight: 500, color: "var(--text-pure-dim)" }}>· {tr.role}</span>
                      </span>
                      <span style={{ fontSize: 11.5, color: "var(--text-pure-dim)", fontWeight: 500 }}>
                        {tr.typeLabel} · {tr.sharesStr} sh @ {tr.priceStr} · {tr.dateStr}
                      </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                      <span
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 12.5,
                          fontWeight: 700,
                          color: tr.color,
                        }}
                      >
                        {tr.valueStr}
                      </span>
                      <span
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 10.5,
                          fontWeight: 600,
                          color: tr.sinceColor,
                        }}
                      >
                        {tr.sinceStr} since
                      </span>
                    </div>
                  </div>
                ))}
                {deepDive.trades.length === 0 && (
                  <div
                    style={{
                      padding: "16px 20px",
                      fontSize: 12.5,
                      fontWeight: 500,
                      color: "var(--text-pure-dim)",
                      borderTop: "1px solid var(--border-soft)",
                    }}
                  >
                    {deepDive.emptyMsg}
                  </div>
                )}
              </div>

              {/* Right Sub-Panel: 13F Holders */}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 20px 10px" }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text-pure)" }}>13F holders</span>
                  <span style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 600, color: "var(--text-pure-dim)" }}>
                    {deepDive.holders} funds · {deepDive.own} inst.
                  </span>
                </div>

                {/* Added vs Cut Ratio Bar */}
                <div style={{ padding: "0 20px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", height: 8, borderRadius: 3, overflow: "hidden", gap: 2 }}>
                    <div style={{ flex: deepDive.addedN, background: UP }} />
                    <div style={{ flex: deepDive.cutN, background: DN }} />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    <span style={{ color: UP }}>
                      {deepDive.added} added · {deepDive.newPos} new
                    </span>
                    <span style={{ color: DN }}>
                      {deepDive.cut} cut · {deepDive.exits} exits
                    </span>
                  </div>
                </div>

                {/* Top Holders Table */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0,1fr) 56px 64px",
                    gap: 8,
                    padding: "6px 20px",
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.06em",
                    color: "var(--text-pure)",
                    borderTop: "1px solid var(--border-soft)",
                  }}
                >
                  <span>HOLDER</span>
                  <span style={{ textAlign: "right" }}>% SHS</span>
                  <span style={{ textAlign: "right" }}>QoQ</span>
                </div>

                {deepDive.topHolders.map((h, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0,1fr) 56px 64px",
                      gap: 8,
                      alignItems: "center",
                      padding: "9px 20px",
                      borderTop: "1px solid var(--border-soft)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--text-pure)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {h.name}
                    </span>
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 12,
                        fontWeight: 700,
                        textAlign: "right",
                        color: "var(--text-pure)",
                      }}
                    >
                      {h.pct}
                    </span>
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 12,
                        textAlign: "right",
                        color: h.color,
                        fontWeight: 700,
                      }}
                    >
                      {h.chg}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>

      {/* 4. Footer Disclaimer Note */}
      <div
        style={{
          marginTop: "auto",
          padding: "12px 20px",
          borderTop: "1px solid var(--border-soft)",
          fontSize: 11,
          color: "var(--text-pure-dim)",
          lineHeight: 1.5,
          fontWeight: 500,
        }}
      >
        MarketCatalyst LLC is not a registered investment advisor. Information is for educational purposes only and
        is not investment advice. Sources: SEC Form 4 and Form 13F institutional ownership filings via EDGAR and market data feeds.
      </div>
    </div>
  );
}
