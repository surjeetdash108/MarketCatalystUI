"use client";

import { useState } from "react";
import { StockLogo } from "../utils";

// ── Economic calendar ────────────────────────────────────────────────────────
const ECO_TABS = ["Last month", "Last week", "This week", "Next week", "This month"];

interface MacroEvent {
  ev: string; date: string; day: string; tier: "High" | "Med" | "Low";
  prev: string; est: string; actual: string; surprise: "up" | "down" | "";
  note: string;
}

const CAL_LAST_MONTH: MacroEvent[] = [
  { ev: "ISM Manufacturing",    date: "May 1",  day: "Fri", tier: "Med",  prev: "49.0",  est: "48.5",  actual: "48.7",  surprise: "up",   note: "Still in contraction but beat estimates" },
  { ev: "Nonfarm Payrolls",     date: "May 2",  day: "Fri", tier: "High", prev: "228K",  est: "195K",  actual: "177K",  surprise: "down", note: "Softest print since Jan; unemployment ticked up" },
  { ev: "Unemployment Rate",    date: "May 2",  day: "Fri", tier: "High", prev: "4.2%",  est: "4.2%",  actual: "4.3%",  surprise: "down", note: "Highest since late 2021" },
  { ev: "JOLTS Job Openings",   date: "May 7",  day: "Wed", tier: "Med",  prev: "7.57M", est: "7.40M", actual: "7.19M", surprise: "down", note: "Labour demand continues to cool" },
  { ev: "CPI (Apr)",            date: "May 13", day: "Tue", tier: "High", prev: "2.4%",  est: "2.4%",  actual: "2.3%",  surprise: "up",   note: "First sub-2.4% print in 3 months" },
  { ev: "PPI (Apr)",            date: "May 14", day: "Wed", tier: "Med",  prev: "0.4%",  est: "0.3%",  actual: "0.2%",  surprise: "up",   note: "Wholesale disinflation accelerating" },
  { ev: "Retail Sales (Apr)",   date: "May 15", day: "Thu", tier: "High", prev: "0.4%",  est: "0.3%",  actual: "0.1%",  surprise: "down", note: "Control group flat; consumption slowing" },
  { ev: "Industrial Production",date: "May 15", day: "Thu", tier: "Low",  prev: "0.3%",  est: "0.2%",  actual: "0.3%",  surprise: "up",   note: "Manufacturing output held steady" },
  { ev: "FOMC Minutes",         date: "May 21", day: "Wed", tier: "High", prev: "—",     est: "—",     actual: "Released", surprise: "", note: "Patient tone; members want 2+ good CPI prints" },
  { ev: "Durable Goods (Apr)",  date: "May 28", day: "Wed", tier: "Med",  prev: "0.9%",  est: "0.4%",  actual: "-1.3%", surprise: "down", note: "Ex-transport weak; capex signals soft" },
  { ev: "GDP Q1 (2nd est.)",    date: "May 29", day: "Thu", tier: "High", prev: "1.6%",  est: "1.7%",  actual: "1.6%",  surprise: "down", note: "Consumer revised lower; no real change to outlook" },
  { ev: "PCE Deflator (Apr)",   date: "May 30", day: "Fri", tier: "High", prev: "2.7%",  est: "2.6%",  actual: "2.6%",  surprise: "up",   note: "Fed's preferred gauge hit estimate — on track" },
  { ev: "UMich Sentiment (May)",date: "May 30", day: "Fri", tier: "Med",  prev: "65.6",  est: "68.0",  actual: "69.1",  surprise: "up",   note: "Inflation expectations eased slightly" },
];

const CAL_THIS_MONTH: MacroEvent[] = [
  { ev: "ISM Manufacturing",    date: "Jun 3",  day: "Tue", tier: "Med",  prev: "48.7",  est: "49.0",  actual: "48.5",  surprise: "down", note: "Still contracting; new orders weak" },
  { ev: "Nonfarm Payrolls",     date: "Jun 6",  day: "Fri", tier: "High", prev: "177K",  est: "190K",  actual: "206K",  surprise: "up",   note: "Labour market re-accelerated; wage growth 3.9%" },
  { ev: "Unemployment Rate",    date: "Jun 6",  day: "Fri", tier: "High", prev: "4.3%",  est: "4.2%",  actual: "4.2%",  surprise: "up",   note: "Rate ticked back down with payrolls beat" },
  { ev: "PPI (May)",            date: "Jun 11", day: "Wed", tier: "Med",  prev: "0.5%",  est: "0.3%",  actual: "0.2%",  surprise: "up",   note: "Wholesale prices cooling" },
  { ev: "Jobless Claims",       date: "Jun 12", day: "Thu", tier: "Med",  prev: "222K",  est: "218K",  actual: "215K",  surprise: "up",   note: "Labour market still resilient" },
  { ev: "CPI (May)",            date: "Jun 12", day: "Thu", tier: "High", prev: "3.4%",  est: "3.3%",  actual: "3.3%",  surprise: "up",   note: "In-line; September cut odds up" },
  { ev: "Retail Sales (May)",   date: "Jun 14", day: "Fri", tier: "High", prev: "0.4%",  est: "0.2%",  actual: "0.1%",  surprise: "down", note: "Consumer spending softening" },
  { ev: "UMich Sentiment",      date: "Jun 14", day: "Fri", tier: "Med",  prev: "69.1",  est: "72",    actual: "65.6",  surprise: "down", note: "Inflation expectations ticked up" },
  { ev: "FOMC Decision",        date: "Jun 18", day: "Wed", tier: "High", prev: "5.50%", est: "5.50%", actual: "5.50%", surprise: "",     note: "Hold expected; dot-plot key" },
  { ev: "FOMC Press Conf.",     date: "Jun 18", day: "Wed", tier: "High", prev: "—",     est: "—",     actual: "—",     surprise: "",     note: "Powell tone drives reaction" },
  { ev: "Jobless Claims",       date: "Jun 20", day: "Thu", tier: "Med",  prev: "215K",  est: "220K",  actual: "—",     surprise: "",     note: "" },
  { ev: "Philadelphia Fed",     date: "Jun 20", day: "Thu", tier: "Med",  prev: "4.5",   est: "5.0",   actual: "—",     surprise: "",     note: "" },
  { ev: "Existing Home Sales",  date: "Jun 21", day: "Fri", tier: "Low",  prev: "4.14M", est: "4.10M", actual: "—",     surprise: "",     note: "" },
  { ev: "Consumer Confidence",  date: "Jun 25", day: "Tue", tier: "Med",  prev: "102.0", est: "100.5", actual: "—",     surprise: "",     note: "" },
  { ev: "Durable Goods",        date: "Jun 26", day: "Wed", tier: "Med",  prev: "-0.8%", est: "0.5%",  actual: "—",     surprise: "",     note: "" },
  { ev: "GDP Q1 (3rd est.)",    date: "Jun 27", day: "Thu", tier: "High", prev: "1.6%",  est: "1.5%",  actual: "—",     surprise: "",     note: "Final revision rarely moves markets" },
  { ev: "Jobless Claims",       date: "Jun 27", day: "Thu", tier: "Med",  prev: "220K",  est: "218K",  actual: "—",     surprise: "",     note: "" },
  { ev: "PCE Deflator (May)",   date: "Jun 28", day: "Fri", tier: "High", prev: "2.7%",  est: "2.6%",  actual: "—",     surprise: "",     note: "Fed's preferred inflation gauge" },
  { ev: "Chicago PMI",          date: "Jun 28", day: "Fri", tier: "Low",  prev: "35.4",  est: "40.0",  actual: "—",     surprise: "",     note: "" },
];

const CAL_LAST: MacroEvent[] = [
  { ev: "Jobless Claims",     date: "Jun 12", day: "Thu", tier: "Med",  prev: "222K",  est: "218K",  actual: "215K",  surprise: "up",   note: "Labour market still resilient" },
  { ev: "PPI (May)",          date: "Jun 11", day: "Wed", tier: "Med",  prev: "0.5%",  est: "0.3%",  actual: "0.2%",  surprise: "up",   note: "Wholesale prices cooling" },
  { ev: "CPI (May)",          date: "Jun 12", day: "Thu", tier: "High", prev: "3.4%",  est: "3.3%",  actual: "3.3%",  surprise: "up",   note: "In-line; September cut odds up" },
  { ev: "Retail Sales (May)", date: "Jun 14", day: "Fri", tier: "High", prev: "0.4%",  est: "0.2%",  actual: "0.1%",  surprise: "down", note: "Consumer spending softening" },
  { ev: "UMich Sentiment",    date: "Jun 14", day: "Fri", tier: "Med",  prev: "69.1",  est: "72",    actual: "65.6",  surprise: "down", note: "Inflation expectations ticked up" },
];
const CAL_THIS: MacroEvent[] = [
  { ev: "FOMC Decision",      date: "Jun 18", day: "Wed", tier: "High", prev: "5.50%", est: "5.50%", actual: "5.50%", surprise: "",     note: "Hold expected; dot-plot key" },
  { ev: "FOMC Press Conf.",   date: "Jun 18", day: "Wed", tier: "High", prev: "—",     est: "—",     actual: "—",     surprise: "",     note: "Powell tone drives reaction" },
  { ev: "Jobless Claims",     date: "Jun 20", day: "Thu", tier: "Med",  prev: "215K",  est: "220K",  actual: "—",     surprise: "",     note: "" },
  { ev: "Philadelphia Fed",   date: "Jun 20", day: "Thu", tier: "Med",  prev: "4.5",   est: "5.0",   actual: "—",     surprise: "",     note: "" },
  { ev: "Existing Home Sales",date: "Jun 21", day: "Fri", tier: "Low",  prev: "4.14M", est: "4.10M", actual: "—",     surprise: "",     note: "" },
];
const CAL_NEXT: MacroEvent[] = [
  { ev: "GDP Q1 (3rd est.)",  date: "Jun 27", day: "Thu", tier: "High", prev: "1.6%",  est: "1.5%",  actual: "—", surprise: "", note: "Final revision rarely moves markets" },
  { ev: "PCE Deflator (May)", date: "Jun 28", day: "Fri", tier: "High", prev: "2.7%",  est: "2.6%",  actual: "—", surprise: "", note: "Fed's preferred inflation gauge" },
  { ev: "Consumer Confidence",date: "Jun 25", day: "Tue", tier: "Med",  prev: "102.0", est: "100.5", actual: "—", surprise: "", note: "" },
  { ev: "Durable Goods",      date: "Jun 26", day: "Wed", tier: "Med",  prev: "-0.8%", est: "0.5%",  actual: "—", surprise: "", note: "" },
  { ev: "Jobless Claims",     date: "Jun 27", day: "Thu", tier: "Med",  prev: "220K",  est: "218K",  actual: "—", surprise: "", note: "" },
  { ev: "Chicago PMI",        date: "Jun 28", day: "Fri", tier: "Low",  prev: "35.4",  est: "40.0",  actual: "—", surprise: "", note: "" },
];
const ECO_CALS = [CAL_LAST_MONTH, CAL_LAST, CAL_THIS, CAL_NEXT, CAL_THIS_MONTH];

// ── Dividend calendar data ───────────────────────────────────────────────────
type DivTabKey = "lmonth" | "prev" | "yest" | "today" | "tom" | "week" | "next" | "month";
const DIV_RANGES: [DivTabKey, string][] = [
  ["lmonth", "Last Month"],
  ["prev",   "Last Week"],
  ["yest",   "Yesterday"],
  ["today",  "Today"],
  ["tom",    "Tomorrow"],
  ["week",   "This Week"],
  ["next",   "Next Week"],
  ["month",  "Month"],
];

// Today = Thu Jun 25, 2026
// This week: Mon Jun 22 – Fri Jun 26  (weekDay 0=Mon … 4=Fri)
// Last week: Mon Jun 15 – Fri Jun 19
// Next week: Mon Jun 29 – Fri Jul 3
// Last month: May 2026
interface DivStock {
  sym: string; name: string; sector: string;
  exDate: string; payDate: string;   // display strings, e.g. "Jun 25"
  exMonth: number; exDay: number;    // for calendar + filter
  payMonth: number; payDay: number;  // for pay-date section in day view
  amount: number; yld: number; freq: string; streak: number;
  weekDay: number;                   // 0=Mon..4=Fri for week-grid view
}

const DIV_STOCKS: DivStock[] = [
  // ── Today (Thu Jun 25) ex-div ──
  { sym: "AAPL", name: "Apple",           sector: "Technology",  exDate: "Jun 25", payDate: "Jul 10", exMonth: 6, exDay: 25, payMonth: 7, payDay: 10, amount: 0.25, yld: 0.53, freq: "Quarterly",    streak: 12, weekDay: 3 },
  { sym: "MSFT", name: "Microsoft",       sector: "Technology",  exDate: "Jun 25", payDate: "Jul 10", exMonth: 6, exDay: 25, payMonth: 7, payDay: 10, amount: 0.75, yld: 0.72, freq: "Quarterly",    streak: 22, weekDay: 3 },
  // ── Yesterday (Wed Jun 24) ex-div ──
  { sym: "HD",   name: "Home Depot",      sector: "Retail",      exDate: "Jun 24", payDate: "Jul 8",  exMonth: 6, exDay: 24, payMonth: 7, payDay: 8,  amount: 2.25, yld: 2.63, freq: "Quarterly",    streak: 14, weekDay: 2 },
  { sym: "KO",   name: "Coca-Cola",       sector: "Staples",     exDate: "Jun 24", payDate: "Jul 1",  exMonth: 6, exDay: 24, payMonth: 7, payDay: 1,  amount: 0.49, yld: 2.90, freq: "Quarterly",    streak: 62, weekDay: 2 },
  // ── Tomorrow (Fri Jun 26) ex-div ──
  { sym: "AVGO", name: "Broadcom",        sector: "Semis",       exDate: "Jun 26", payDate: "Jul 11", exMonth: 6, exDay: 26, payMonth: 7, payDay: 11, amount: 5.25, yld: 1.50, freq: "Quarterly",    streak: 13, weekDay: 4 },
  { sym: "JNJ",  name: "J&J",             sector: "Healthcare",  exDate: "Jun 26", payDate: "Jul 15", exMonth: 6, exDay: 26, payMonth: 7, payDay: 15, amount: 1.24, yld: 3.37, freq: "Quarterly",    streak: 62, weekDay: 4 },
  // ── This week Mon Jun 22 ──
  { sym: "V",    name: "Visa",            sector: "Financials",  exDate: "Jun 22", payDate: "Jul 7",  exMonth: 6, exDay: 22, payMonth: 7, payDay: 7,  amount: 0.52, yld: 0.77, freq: "Quarterly",    streak: 16, weekDay: 0 },
  { sym: "PG",   name: "Procter & Gamble",sector: "Staples",     exDate: "Jun 22", payDate: "Jul 7",  exMonth: 6, exDay: 22, payMonth: 7, payDay: 7,  amount: 1.01, yld: 2.40, freq: "Quarterly",    streak: 68, weekDay: 0 },
  // ── This week Tue Jun 23 ──
  { sym: "UNH",  name: "UnitedHealth",    sector: "Healthcare",  exDate: "Jun 23", payDate: "Jun 26", exMonth: 6, exDay: 23, payMonth: 6, payDay: 26, amount: 2.10, yld: 1.52, freq: "Quarterly",    streak: 14, weekDay: 1 },
  { sym: "AMGN", name: "Amgen",           sector: "Biotech",     exDate: "Jun 23", payDate: "Jun 26", exMonth: 6, exDay: 23, payMonth: 6, payDay: 26, amount: 2.25, yld: 3.28, freq: "Quarterly",    streak: 14, weekDay: 1 },
  // ── Last week Mon Jun 15 ──
  { sym: "MCD",  name: "McDonald's",      sector: "Consumer",    exDate: "Jun 15", payDate: "Jun 17", exMonth: 6, exDay: 15, payMonth: 6, payDay: 17, amount: 1.77, yld: 2.45, freq: "Quarterly",    streak: 47, weekDay: 0 },
  { sym: "TGT",  name: "Target",          sector: "Retail",      exDate: "Jun 15", payDate: "Jun 20", exMonth: 6, exDay: 15, payMonth: 6, payDay: 20, amount: 1.12, yld: 3.20, freq: "Quarterly",    streak: 52, weekDay: 0 },
  // ── Last week Tue Jun 16 ──
  { sym: "XOM",  name: "ExxonMobil",      sector: "Energy",      exDate: "Jun 16", payDate: "Jun 18", exMonth: 6, exDay: 16, payMonth: 6, payDay: 18, amount: 0.99, yld: 3.55, freq: "Quarterly",    streak: 41, weekDay: 1 },
  { sym: "CVX",  name: "Chevron",         sector: "Energy",      exDate: "Jun 16", payDate: "Jun 23", exMonth: 6, exDay: 16, payMonth: 6, payDay: 23, amount: 1.63, yld: 4.27, freq: "Quarterly",    streak: 37, weekDay: 1 },
  // ── Last week Wed Jun 17 ──
  { sym: "JPM",  name: "JPMorgan",        sector: "Financials",  exDate: "Jun 17", payDate: "Jun 30", exMonth: 6, exDay: 17, payMonth: 6, payDay: 30, amount: 1.25, yld: 2.20, freq: "Quarterly",    streak: 14, weekDay: 2 },
  { sym: "ABT",  name: "Abbott",          sector: "Healthcare",  exDate: "Jun 17", payDate: "Jun 24", exMonth: 6, exDay: 17, payMonth: 6, payDay: 24, amount: 0.55, yld: 1.90, freq: "Quarterly",    streak: 52, weekDay: 2 },
  // ── Last week Thu Jun 18 ──
  { sym: "PFE",  name: "Pfizer",          sector: "Healthcare",  exDate: "Jun 18", payDate: "Jun 25", exMonth: 6, exDay: 18, payMonth: 6, payDay: 25, amount: 0.42, yld: 5.90, freq: "Quarterly",    streak: 14, weekDay: 3 },
  // ── Last week Fri Jun 19 ──
  { sym: "VZ",   name: "Verizon",         sector: "Telecom",     exDate: "Jun 19", payDate: "Jun 30", exMonth: 6, exDay: 19, payMonth: 6, payDay: 30, amount: 0.67, yld: 6.12, freq: "Quarterly",    streak: 17, weekDay: 4 },
  { sym: "T",    name: "AT&T",            sector: "Telecom",     exDate: "Jun 19", payDate: "Jul 1",  exMonth: 6, exDay: 19, payMonth: 7, payDay: 1,  amount: 0.28, yld: 5.40, freq: "Quarterly",    streak: 1,  weekDay: 4 },
  // ── Next week Mon Jun 29 ──
  { sym: "IBM",  name: "IBM",             sector: "Technology",  exDate: "Jun 29", payDate: "Jul 10", exMonth: 6, exDay: 29, payMonth: 7, payDay: 10, amount: 1.67, yld: 3.02, freq: "Quarterly",    streak: 28, weekDay: 0 },
  { sym: "WMT",  name: "Walmart",         sector: "Retail",      exDate: "Jun 29", payDate: "Jul 7",  exMonth: 6, exDay: 29, payMonth: 7, payDay: 7,  amount: 0.21, yld: 1.05, freq: "Quarterly",    streak: 51, weekDay: 0 },
  // ── Next week Tue Jun 30 ──
  { sym: "NEE",  name: "NextEra Energy",  sector: "Utilities",   exDate: "Jun 30", payDate: "Jul 15", exMonth: 6, exDay: 30, payMonth: 7, payDay: 15, amount: 1.07, yld: 2.70, freq: "Quarterly",    streak: 29, weekDay: 1 },
  { sym: "SO",   name: "Southern Co",     sector: "Utilities",   exDate: "Jun 30", payDate: "Jul 6",  exMonth: 6, exDay: 30, payMonth: 7, payDay: 6,  amount: 0.69, yld: 3.60, freq: "Quarterly",    streak: 23, weekDay: 1 },
  // ── Next week Wed Jul 1 ──
  { sym: "BAC",  name: "Bank of America", sector: "Financials",  exDate: "Jul 1",  payDate: "Jul 24", exMonth: 7, exDay: 1,  payMonth: 7, payDay: 24, amount: 0.26, yld: 2.48, freq: "Quarterly",    streak: 14, weekDay: 2 },
  { sym: "LMT",  name: "Lockheed Martin", sector: "Defense",     exDate: "Jul 1",  payDate: "Jul 22", exMonth: 7, exDay: 1,  payMonth: 7, payDay: 22, amount: 3.30, yld: 2.55, freq: "Quarterly",    streak: 21, weekDay: 2 },
  // ── Next week Thu Jul 2 ──
  { sym: "CAT",  name: "Caterpillar",     sector: "Industrials", exDate: "Jul 2",  payDate: "Jul 22", exMonth: 7, exDay: 2,  payMonth: 7, payDay: 22, amount: 1.41, yld: 1.62, freq: "Quarterly",    streak: 30, weekDay: 3 },
  { sym: "HON",  name: "Honeywell",       sector: "Industrials", exDate: "Jul 2",  payDate: "Jul 10", exMonth: 7, exDay: 2,  payMonth: 7, payDay: 10, amount: 1.13, yld: 2.08, freq: "Quarterly",    streak: 14, weekDay: 3 },
  // ── Last month May 2026 ──
  { sym: "NVDA", name: "Nvidia",          sector: "Semis",       exDate: "May 23", payDate: "Jun 9",  exMonth: 5, exDay: 23, payMonth: 6, payDay: 9,  amount: 0.04, yld: 0.04, freq: "Quarterly",    streak: 12, weekDay: 4 },
  { sym: "INTC", name: "Intel",           sector: "Semis",       exDate: "May 19", payDate: "Jun 1",  exMonth: 5, exDay: 19, payMonth: 6, payDay: 1,  amount: 0.13, yld: 2.15, freq: "Quarterly",    streak: 4,  weekDay: 0 },
  { sym: "MMM",  name: "3M",              sector: "Industrials", exDate: "May 18", payDate: "Jun 12", exMonth: 5, exDay: 18, payMonth: 6, payDay: 12, amount: 0.70, yld: 2.10, freq: "Quarterly",    streak: 4,  weekDay: 0 },
  { sym: "LOW",  name: "Lowe's",          sector: "Retail",      exDate: "May 21", payDate: "Jun 4",  exMonth: 5, exDay: 21, payMonth: 6, payDay: 4,  amount: 1.10, yld: 1.90, freq: "Quarterly",    streak: 51, weekDay: 2 },
  { sym: "ABBV", name: "AbbVie",          sector: "Healthcare",  exDate: "May 14", payDate: "May 15", exMonth: 5, exDay: 14, payMonth: 5, payDay: 15, amount: 1.64, yld: 3.50, freq: "Quarterly",    streak: 11, weekDay: 2 },
  { sym: "MDT",  name: "Medtronic",       sector: "Healthcare",  exDate: "May 20", payDate: "Jun 3",  exMonth: 5, exDay: 20, payMonth: 6, payDay: 3,  amount: 0.70, yld: 3.40, freq: "Quarterly",    streak: 47, weekDay: 1 },
  { sym: "ADP",  name: "ADP",             sector: "Technology",  exDate: "May 22", payDate: "Jun 4",  exMonth: 5, exDay: 22, payMonth: 6, payDay: 4,  amount: 1.40, yld: 2.22, freq: "Quarterly",    streak: 50, weekDay: 3 },
  { sym: "GIS",  name: "General Mills",   sector: "Staples",     exDate: "May 28", payDate: "Jun 6",  exMonth: 5, exDay: 28, payMonth: 6, payDay: 6,  amount: 0.59, yld: 3.56, freq: "Quarterly",    streak: 25, weekDay: 1 },
];

// ── Filter helpers ───────────────────────────────────────────────────────────
function exDivFor(tab: DivTabKey): DivStock[] {
  if (tab === "today")  return DIV_STOCKS.filter(s => s.exMonth === 6 && s.exDay === 25);
  if (tab === "yest")   return DIV_STOCKS.filter(s => s.exMonth === 6 && s.exDay === 24);
  if (tab === "tom")    return DIV_STOCKS.filter(s => s.exMonth === 6 && s.exDay === 26);
  if (tab === "week")   return DIV_STOCKS.filter(s => s.exMonth === 6 && s.exDay >= 22 && s.exDay <= 26);
  if (tab === "prev")   return DIV_STOCKS.filter(s => s.exMonth === 6 && s.exDay >= 15 && s.exDay <= 19);
  if (tab === "next")   return DIV_STOCKS.filter(s => (s.exMonth === 6 && s.exDay >= 29) || (s.exMonth === 7 && s.exDay <= 3));
  if (tab === "lmonth") return DIV_STOCKS.filter(s => s.exMonth === 5);
  if (tab === "month")  return DIV_STOCKS.filter(s => s.exMonth === 6);
  return [];
}

function payDivFor(tab: DivTabKey): DivStock[] {
  if (tab === "today") return DIV_STOCKS.filter(s => s.payMonth === 6 && s.payDay === 25);
  if (tab === "yest")  return DIV_STOCKS.filter(s => s.payMonth === 6 && s.payDay === 24);
  if (tab === "tom")   return DIV_STOCKS.filter(s => s.payMonth === 6 && s.payDay === 26);
  return [];
}

// ── VIX-sensitive stocks ─────────────────────────────────────────────────────
interface VixStock {
  sym: string; name: string; beta: number; iv30: number;
  divAmt: number; yld: number; sector: string;
}
const VIX_STOCKS: VixStock[] = [
  { sym: "TSLA", name: "Tesla",       beta: 2.34, iv30: 62, divAmt: 0,    yld: 0,    sector: "Auto / EV"  },
  { sym: "NVDA", name: "Nvidia",      beta: 1.72, iv30: 48, divAmt: 0.04, yld: 0.04, sector: "Semis"      },
  { sym: "META", name: "Meta",        beta: 1.45, iv30: 35, divAmt: 0.50, yld: 0.35, sector: "Social"     },
  { sym: "PLTR", name: "Palantir",    beta: 2.10, iv30: 72, divAmt: 0,    yld: 0,    sector: "Software"   },
  { sym: "AMD",  name: "AMD",         beta: 1.80, iv30: 45, divAmt: 0,    yld: 0,    sector: "Semis"      },
  { sym: "SMCI", name: "Supermicro",  beta: 2.80, iv30: 85, divAmt: 0,    yld: 0,    sector: "Hardware"   },
  { sym: "ZIM",  name: "ZIM Int'l",   beta: 1.95, iv30: 58, divAmt: 0.68, yld: 3.69, sector: "Shipping"   },
];

// ── 10-year dividend history ─────────────────────────────────────────────────
function divHistory(sym: string, currentAnnual: number): { year: number; div: number }[] {
  const seed = sym.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const years: { year: number; div: number }[] = [];
  let div = currentAnnual;
  for (let i = 0; i < 10; i++) {
    years.push({ year: 2025 - i, div: parseFloat(div.toFixed(2)) });
    const pct = 0.07 + ((seed * (i + 1)) % 8) / 100;
    div = parseFloat((div / (1 + pct)).toFixed(2));
  }
  return years.reverse();
}

// ── Dividend bar chart ───────────────────────────────────────────────────────
function DivHistoryChart({ data }: { data: { year: number; div: number }[] }) {
  const W = 480, H = 160, PADL = 40, PADR = 10, PADT = 20, PADB = 24;
  const iw = W - PADL - PADR, ih = H - PADT - PADB;
  const maxV = Math.max(...data.map(d => d.div)) * 1.15 || 1;
  const n = data.length, gw = iw / n, bw = gw * 0.52;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
      {[0, maxV / 2, maxV].map(v => {
        const y = PADT + ih - (v / maxV) * ih;
        return (
          <g key={v}>
            <line x1={PADL} y1={y} x2={W - PADR} y2={y} stroke="var(--border-soft)" strokeDasharray="2 4" />
            <text x={PADL - 4} y={y + 3.5} textAnchor="end" style={{ fill: "var(--text-dim-solid)", fontSize: "8px" }}>
              ${v.toFixed(2)}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const cx = PADL + gw * i + gw / 2;
        const bh = Math.max(2, (d.div / maxV) * ih);
        const by = PADT + ih - bh;
        return (
          <g key={d.year}>
            <rect x={(cx - bw / 2).toFixed(1)} y={by.toFixed(1)} width={bw.toFixed(1)} height={bh.toFixed(1)} rx="3"
              style={{ fill: "var(--brand-2)", opacity: 0.85 }} />
            <text x={cx.toFixed(1)} y={(by - 4).toFixed(1)} textAnchor="middle"
              style={{ fill: "var(--text-hi)", fontSize: "7.5px", fontWeight: 600 }}>
              ${d.div.toFixed(2)}
            </text>
            <text x={cx.toFixed(1)} y={H - 6} textAnchor="middle"
              style={{ fill: "var(--text-dim-solid)", fontSize: "8px" }}>
              {d.year}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Dividend sliding drawer ──────────────────────────────────────────────────
function DividendDrawer({ stock, onClose }: { stock: DivStock; onClose: () => void }) {
  const annual = stock.amount * 4;
  const hist   = divHistory(stock.sym, annual);
  const cagr   = hist.length >= 2
    ? (Math.pow(hist[hist.length - 1].div / (hist[0].div || 0.01), 1 / (hist.length - 1)) - 1) * 100
    : 0;
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="side-drawer">
        <div className="drawer-h">
          <StockLogo sym={stock.sym} size={30} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-hi)", fontFamily: "var(--f-display)" }}>
              {stock.sym} · Dividend History
            </div>
            <div style={{ fontSize: ".72rem", color: "var(--text-dim-solid)" }}>{stock.name} · {stock.sector} · Last 10 years</div>
          </div>
          <button className="closebtn" onClick={onClose}>✕</button>
        </div>
        <div className="drawer-b">
          <div className="metric-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: 14 }}>
            <div className="m"><div className="k">Quarterly div</div><div className="v">${stock.amount.toFixed(2)}</div></div>
            <div className="m"><div className="k">Annual div</div><div className="v">${annual.toFixed(2)}</div></div>
            <div className="m"><div className="k">Yield</div><div className="v up">{stock.yld > 0 ? stock.yld.toFixed(2) + "%" : "—"}</div></div>
            <div className="m"><div className="k">Div streak</div><div className="v">{stock.streak > 0 ? stock.streak + " yrs" : "—"}</div></div>
            <div className="m"><div className="k">Frequency</div><div className="v" style={{ fontSize: ".85rem" }}>{stock.freq}</div></div>
            <div className="m"><div className="k">10yr CAGR</div><div className="v up">{cagr.toFixed(1)}%</div></div>
          </div>
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-h"><h3>Annual dividend per share</h3></div>
            <div className="card-b" style={{ paddingTop: 8 }}>
              <DivHistoryChart data={hist} />
            </div>
          </div>
          <div className="card">
            <div className="card-h"><h3>Year-by-year breakdown</h3></div>
            <div className="card-b" style={{ padding: 0 }}>
              <table className="tbl">
                <thead><tr><th>Year</th><th className="num">Annual div</th><th className="num">YoY growth</th></tr></thead>
                <tbody>
                  {[...hist].reverse().map((h, i, arr) => {
                    const prev = arr[i + 1]?.div ?? null;
                    const g    = prev != null ? ((h.div - prev) / (prev || 1)) * 100 : null;
                    return (
                      <tr key={h.year}>
                        <td><b style={{ color: "var(--text-hi)" }}>{h.year}</b></td>
                        <td className="num">${h.div.toFixed(2)}</td>
                        <td className={`num ${g != null ? (g >= 0 ? "up" : "down") : ""}`}>
                          {g != null ? `${g >= 0 ? "+" : ""}${g.toFixed(1)}%` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Dividend logo chip ────────────────────────────────────────────────────────
function DivChip({ d, selected, onSelect }: { d: DivStock; selected: boolean; onSelect: (s: DivStock) => void }) {
  return (
    <button className={`ec-chip${selected ? " on" : ""}`} onClick={() => onSelect(d)}
      title={`${d.name} · ex-div ${d.exDate} · $${d.amount.toFixed(2)}/qtr · ${d.yld > 0 ? d.yld.toFixed(2) + "% yield" : "growth payer"}`}>
      <span className="ec-logo" style={{ background: "#27314a", color: "#cdd6e6" }}>
        {d.sym[0]}
        <img
          src={`https://assets.parqet.com/logos/symbol/${d.sym}?format=png`}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          alt=""
        />
      </span>
      {d.sym}
    </button>
  );
}

// ── Month calendar helper ─────────────────────────────────────────────────────
const MONTHS_LBL = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOWS       = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function divMonthCal(year: number, month1: number) {
  const first = new Date(year, month1 - 1, 1).getDay();
  const days  = new Date(year, month1, 0).getDate();
  const map: Record<number, DivStock[]> = {};
  for (let d = 1; d <= days; d++) {
    map[d] = DIV_STOCKS.filter(s => s.exMonth === month1 && s.exDay === d);
  }
  return { first, days, map };
}

// ── Main screen ──────────────────────────────────────────────────────────────
export function MacroScreen() {
  const [ecoTab,    setEcoTab]    = useState(2);
  const [divTab,    setDivTab]    = useState<DivTabKey>("week");
  const [monthOff,  setMonthOff]  = useState(0);
  const [selStock,  setSelStock]  = useState<DivStock | null>(null);
  const [calDay,    setCalDay]    = useState<number | null>(null);
  const [vixSel,    setVixSel]    = useState<DivStock | null>(null);

  // ── Dividend calendar rendering ──────────────────────────────────────────
  const isDivDay   = divTab === "today" || divTab === "yest" || divTab === "tom";
  const isDivWeek  = divTab === "week"  || divTab === "prev" || divTab === "next";
  const isDivLMon  = divTab === "lmonth";
  const isDivMonth = divTab === "month";

  const dayLabel: Record<string, string> = { today: "today · Jun 25", yest: "yesterday · Jun 24", tom: "tomorrow · Jun 26" };

  let divCalNode: React.ReactNode = null;

  if (isDivDay) {
    const exStocks  = exDivFor(divTab);
    const payStocks = payDivFor(divTab);
    divCalNode = (
      <div className="card">
        <div className="card-h">
          <h3>Dividend dates · {dayLabel[divTab]} · {exStocks.length + payStocks.length} events</h3>
          <span className="pill" style={{ background: "var(--surface-3)", color: "var(--text-dim-solid)" }}>tap a logo for 10-yr history</span>
        </div>
        <div className="card-b" style={{ paddingTop: 10 }}>
          <div className="ec-lbl">Ex-dividend date</div>
          <div style={{ marginBottom: 14 }}>
            {exStocks.length
              ? exStocks.map(d => <DivChip key={d.sym} d={d} selected={selStock?.sym === d.sym} onSelect={setSelStock} />)
              : <span className="ec-none">None</span>}
          </div>
          <div className="ec-lbl">Pay date</div>
          <div>
            {payStocks.length
              ? payStocks.map(d => <DivChip key={d.sym} d={d} selected={selStock?.sym === d.sym} onSelect={setSelStock} />)
              : <span className="ec-none">None</span>}
          </div>
        </div>
      </div>
    );
  } else if (isDivWeek) {
    const weekLabel: Record<string, string> = { week: "This Week · Jun 22–26", prev: "Last Week · Jun 15–19", next: "Next Week · Jun 29–Jul 3" };
    const isCurrentWeek = divTab === "week";
    const todayWeekDay  = 3; // Thursday Jun 25

    divCalNode = (
      <div className="card">
        <div className="card-h">
          <h3>Dividend ex-dates · {weekLabel[divTab]}</h3>
          <span className="pill" style={{ background: "var(--surface-3)", color: "var(--text-dim-solid)" }}>tap a logo for 10-yr history</span>
        </div>
        <div className="card-b" style={{ paddingTop: 12 }}>
          <div className="ec-grid">
            {["Mon", "Tue", "Wed", "Thu", "Fri"].map((dn, di) => {
              const dayStocks = exDivFor(divTab).filter(s => s.weekDay === di);
              const isToday   = isCurrentWeek && di === todayWeekDay;
              return (
                <div key={dn} className={`ec-day${isToday ? " is-today" : ""}`}>
                  <div className="ec-dh">{dn}{isToday ? " · Today" : ""}</div>
                  <div className="ec-sess">
                    <div className="ec-lbl">Ex-div</div>
                    {dayStocks.length
                      ? dayStocks.map(d => <DivChip key={d.sym} d={d} selected={selStock?.sym === d.sym} onSelect={setSelStock} />)
                      : <span className="ec-none">—</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  } else if (isDivLMon) {
    const stocks = exDivFor("lmonth");
    const high   = stocks.filter(s => s.yld >= 2.5);
    const growth = stocks.filter(s => s.yld < 2.5);
    divCalNode = (
      <div className="card">
        <div className="card-h">
          <h3>Last Month · May 2026 · dividend recap</h3>
          <span className="pill" style={{ background: "var(--surface-3)", color: "var(--text-dim-solid)" }}>tap a logo for 10-yr history</span>
        </div>
        <div className="card-b" style={{ paddingTop: 10 }}>
          <div className="ec-lbl">High yield (&ge;2.5%)</div>
          <div style={{ marginBottom: 12 }}>
            {high.length
              ? high.map(d => <DivChip key={d.sym} d={d} selected={selStock?.sym === d.sym} onSelect={setSelStock} />)
              : <span className="ec-none">None</span>}
          </div>
          <div className="ec-lbl">Growth payers (&lt;2.5%)</div>
          <div>
            {growth.length
              ? growth.map(d => <DivChip key={d.sym} d={d} selected={selStock?.sym === d.sym} onSelect={setSelStock} />)
              : <span className="ec-none">None</span>}
          </div>
        </div>
      </div>
    );
  } else if (isDivMonth) {
    const base  = new Date(2026, 5 + monthOff, 1);
    const year  = base.getFullYear();
    const mon1  = base.getMonth() + 1;
    const cal   = divMonthCal(year, mon1);
    const todayMark = monthOff === 0 ? 25 : -1;
    const dayList = calDay ? (cal.map[calDay] ?? []) : [];

    divCalNode = (
      <>
        <div className="ecm-wrap">
          <div className="ecm-monthbar">
            <button className="ecm-nav" onClick={() => { setMonthOff(o => o - 1); setCalDay(null); }}>←</button>
            <div className="ecm-month">{MONTHS_LBL[mon1 - 1]} {year} · dividend ex-dates</div>
            <button className="ecm-nav" onClick={() => { setMonthOff(o => o + 1); setCalDay(null); }}>→</button>
          </div>
          <div className="ecm-head">
            {DOWS.map(d => <div key={d}>{d}</div>)}
          </div>
          <div className="ecm-grid">
            {Array.from({ length: cal.first }, (_, i) => (
              <div key={`e${i}`} className="ecm-cell ecm-empty" />
            ))}
            {Array.from({ length: cal.days }, (_, i) => {
              const d    = i + 1;
              const lst  = cal.map[d] ?? [];
              const isT  = d === todayMark;
              const isSel = d === calDay;
              return (
                <div key={d}
                  className={`ecm-cell${lst.length > 0 ? " has" : ""}${isT ? " is-today" : ""}${isSel ? " sel" : ""}`}
                  onClick={lst.length > 0 ? () => { setCalDay(d); if (lst[0]) setSelStock(lst[0]); } : undefined}>
                  <div className="ecm-d">
                    {d}
                    {isT && <span className="ecm-t">Today</span>}
                  </div>
                  {lst.length > 0 && (
                    <>
                      <div className="ecm-logos">
                        {lst.slice(0, 3).map(s => (
                          <span key={s.sym} className="ecm-logo" style={{ background: "#27314a", color: "#cdd6e6" }}>
                            {s.sym[0]}
                            <img
                              src={`https://assets.parqet.com/logos/symbol/${s.sym}?format=png`}
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                              alt=""
                            />
                          </span>
                        ))}
                        {lst.length > 3 && <span className="ecm-more">+{lst.length - 3}</span>}
                      </div>
                      <div className="ecm-n">{lst.length} ex-div</div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {calDay && dayList.length > 0 && (
          <div className="card" style={{ marginTop: 14 }}>
            <div className="card-h">
              <h3>{MONTHS_LBL[mon1 - 1]} {calDay}, {year} · {dayList.length} ex-dividend</h3>
              <span className="pill" style={{ background: "var(--surface-3)", color: "var(--text-dim-solid)" }}>tap a logo for 10-yr history</span>
            </div>
            <div className="card-b" style={{ paddingTop: 10, display: "flex", flexWrap: "wrap" }}>
              {dayList.map(d => <DivChip key={d.sym} d={d} selected={selStock?.sym === d.sym} onSelect={setSelStock} />)}
            </div>
          </div>
        )}

        {calDay && dayList.length === 0 && (
          <div className="card" style={{ marginTop: 14 }}>
            <div className="card-b" style={{ color: "var(--text-dim-solid)" }}>No dividend ex-dates on this day.</div>
          </div>
        )}

        {!calDay && (
          <div className="card" style={{ marginTop: 14 }}>
            <div className="card-b" style={{ color: "var(--text-dim-solid)" }}>Click a date with ex-dividends to see the companies.</div>
          </div>
        )}
      </>
    );
  }


  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Macro &amp; Rates</div>
          <h1 className="page-title">Macro Dashboard</h1>
        </div>
        <div className="tabs">
          {ECO_TABS.map((t, i) => (
            <button key={t} className={`tab${i === ecoTab ? " on" : ""}`} onClick={() => setEcoTab(i)}>{t}</button>
          ))}
        </div>
      </div>

      {/* ── Market regime + VIX + Economic calendar ── */}
      <div className="dash" style={{ alignItems: "stretch" }}>
        <div className="col-4" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="card">
            <div className="card-h"><h3>Market regime</h3></div>
            <div className="card-b" style={{ textAlign: "center", padding: "22px 15px" }}>
              <div className="gauge-lbl up" style={{ fontSize: "1.3rem" }}>Risk-On Rally</div>
              <p style={{ fontSize: ".78rem", color: "var(--text-dim-solid)", marginTop: 10, lineHeight: 1.5 }}>
                Breadth strong, yields easing, cyclicals leading defensives. Updated daily from internals, yield behaviour and sector rotation.
              </p>
            </div>
          </div>
          <div className="card vix" style={{ flex: 1 }}>
            <div className="card-h"><h3>VIX</h3></div>
            <div className="card-b">
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span className="big">14.18</span>
                <span className="mono down" style={{ fontWeight: 600 }}>▼ -2.51%</span>
              </div>
              <div className="pctl" style={{ marginTop: 10 }}><i style={{ width: "22%" }} /></div>
              <div className="note" style={{ marginTop: 8 }}>VIX at 14 is low — calm, risk-on conditions and cheap hedging.</div>
            </div>
          </div>
        </div>

        <div className="col-8" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div className="card-h">
              <h3>Economic calendar</h3>
              <span className="pill" style={{ background: "var(--surface-3)", color: "var(--text-dim-solid)" }}>
                {ECO_CALS[ecoTab].length} events
              </span>
            </div>
            <div className="tbl-wrap" style={{ flex: 1 }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Event</th><th>Date</th><th>Impact</th>
                    <th className="num">Prior</th><th className="num">Est.</th>
                    <th className="num">Actual</th><th className="num">Surprise</th><th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {ECO_CALS[ecoTab].map(e => (
                    <tr key={e.ev + e.date}>
                      <td>
                        <b style={{ color: "var(--text-hi)" }}>{e.ev}</b>
                        {e.tier === "High" && <span style={{ color: "var(--warn)", fontSize: ".6rem", marginLeft: 5 }}>●</span>}
                      </td>
                      <td>
                        <div>{e.date}</div>
                        <div style={{ fontSize: ".68rem", color: "var(--text-dim-solid)" }}>{e.day}</div>
                      </td>
                      <td>
                        <span className={`pill ${e.tier === "High" ? "dn" : e.tier === "Med" ? "amc" : ""}`}
                          style={e.tier === "Low" ? { background: "var(--surface-3)", color: "var(--text-dim-solid)" } : undefined}>
                          {e.tier}
                        </span>
                      </td>
                      <td className="num">{e.prev}</td>
                      <td className="num">{e.est}</td>
                      <td className={`num ${e.actual !== "—" ? (e.surprise === "up" ? "up" : e.surprise === "down" ? "down" : "") : ""}`}>
                        <b>{e.actual}</b>
                      </td>
                      <td className="num">
                        {e.surprise === "up"   && <span className="up">▲ Beat</span>}
                        {e.surprise === "down" && <span className="down">▼ Miss</span>}
                        {e.surprise === "" && e.actual === "—" && <span style={{ color: "var(--text-dim-solid)" }}>Pending</span>}
                      </td>
                      <td style={{ fontSize: ".76rem", color: "var(--text-dim-solid)", maxWidth: 140 }}>{e.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ── Dividend Calendar (full width, earnings-style) ── */}
      <div style={{ marginTop: 14 }}>
        <div className="page-head" style={{ paddingTop: 0, paddingBottom: 10 }}>
          <div>
            <div className="eyebrow">Dividend Calendar</div>
            <h2 style={{ fontFamily: "var(--f-display)", fontWeight: 700, fontSize: "1.1rem", color: "var(--text-hi)", margin: 0 }}>
              Ex-dividend &amp; pay dates
            </h2>
            <div className="page-sub" style={{ marginTop: 2 }}>
              Company logos by day · click a logo for 10-year dividend history
            </div>
          </div>
          <div className="tabs">
            {DIV_RANGES.map(([k, l]) => (
              <button key={k}
                className={`tab${divTab === k ? " active" : ""}`}
                onClick={() => { setDivTab(k); setCalDay(null); setSelStock(null); }}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {divCalNode}
      </div>

      {/* ── VIX Sensitive Stocks ── */}
      <div style={{ marginTop: 14 }}>
        <div className="card">
          <div className="card-h">
            <h3>VIX Sensitive Stocks</h3>
            <span style={{ fontSize: ".7rem", color: "var(--text-dim-solid)" }}>High beta · hover for details · click for dividend history</span>
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Stock</th>
                  <th className="num">Beta</th>
                  <th className="num">IV 30d</th>
                  <th className="num">Div yield</th>
                  <th className="num">Div / qtr</th>
                </tr>
              </thead>
              <tbody>
                {VIX_STOCKS.map(s => {
                  const divStk = DIV_STOCKS.find(d => d.sym === s.sym) ?? {
                    sym: s.sym, name: s.name, sector: s.sector,
                    exDate: "—", payDate: "—",
                    exMonth: 0, exDay: 0, payMonth: 0, payDay: 0,
                    amount: s.divAmt, yld: s.yld, freq: "Quarterly", streak: 0, weekDay: 0,
                  };
                  return (
                    <tr key={s.sym} className="mv-dash-row" style={{ cursor: "pointer" }}
                      onClick={() => setVixSel(divStk)}>
                      <td style={{ position: "relative" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <StockLogo sym={s.sym} size={20} />
                          <div>
                            <div style={{ fontWeight: 700, color: "var(--text-hi)", fontFamily: "var(--f-mono)", fontSize: ".85rem" }}>{s.sym}</div>
                            <div style={{ fontSize: ".66rem", color: "var(--text-dim-solid)" }}>{s.name}</div>
                          </div>
                        </div>
                        <div className="mv-dp" onClick={e => e.stopPropagation()}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9, paddingBottom: 9, borderBottom: "1px solid var(--border)" }}>
                            <StockLogo sym={s.sym} size={26} />
                            <div>
                              <div style={{ fontWeight: 800, color: "var(--text-hi)", fontSize: ".9rem" }}>{s.sym}</div>
                              <div style={{ fontSize: ".7rem", color: "var(--text-dim-solid)" }}>{s.name} · {s.sector}</div>
                            </div>
                          </div>
                          <div className="dp-row"><span>Beta (5yr monthly)</span><b style={{ color: s.beta >= 2 ? "var(--down)" : "var(--warn)" }}>{s.beta.toFixed(2)}</b></div>
                          <div className="dp-row"><span>Implied vol (30d)</span><b>{s.iv30}%</b></div>
                          <div className="dp-row"><span>VIX sensitivity</span><b>{s.beta >= 2.5 ? "Extreme" : s.beta >= 1.8 ? "High" : "Moderate"}</b></div>
                          {s.yld > 0 && <div className="dp-row"><span>Dividend yield</span><b style={{ color: "var(--up)" }}>{s.yld.toFixed(2)}%</b></div>}
                          {s.divAmt > 0 && <div className="dp-row"><span>Quarterly div</span><b>${s.divAmt.toFixed(2)}</b></div>}
                          <div className="dp-note" style={{ marginTop: 8 }}>
                            {s.divAmt > 0 ? "Click to see 10-year dividend history →" : "No dividend — pure growth / volatility play."}
                          </div>
                        </div>
                      </td>
                      <td className="num"><b style={{ color: s.beta >= 2 ? "var(--down)" : "var(--warn)" }}>{s.beta.toFixed(2)}</b></td>
                      <td className="num">{s.iv30}%</td>
                      <td className="num">{s.yld > 0 ? <span className="up">{s.yld.toFixed(2)}%</span> : <span style={{ color: "var(--text-dim-solid)" }}>—</span>}</td>
                      <td className="num">{s.divAmt > 0 ? `$${s.divAmt.toFixed(2)}` : <span style={{ color: "var(--text-dim-solid)" }}>—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Dividend drawer from chip click ── */}
      {selStock && (
        <DividendDrawer stock={selStock} onClose={() => setSelStock(null)} />
      )}

      {/* ── Dividend drawer from VIX row click ── */}
      {vixSel && (
        <DividendDrawer stock={vixSel} onClose={() => setVixSel(null)} />
      )}
    </>
  );
}
