export interface StockItem {
  t: string;
  name: string;
  p: number;
  c: number;
  setup: string;
  cf: number;
  conf: number;
  sig: string[];
  mcap: string;
  pe: number | null;
  fpe: number | null;
  rev: number | null;
  eps: number | null;
  hi: number | null;
  lo: number | null;
  sector: string;
  lbg: string;
  lfg: string;
}

export interface UpcomingEvent {
  date: string;
  days: string;
  n: string;
  txt: string;
  imp: string;
  col: string;
}

export interface MajorSixMonthEvent {
  num: number;
  date: string;
  label: string;
  category: "Earnings" | "Product" | "Analyst" | "Macro" | "Corporate";
  mv: number;
  details: string;
  fr: number;
}

export interface DetailStock {
  sv: number[];
  ev?: Record<string, string[]>;
  assess: string;
  assessEv?: string[];
  att: number[];
  movedTxt: string;
  attCalc?: any;
  movedEv: string[];
  events?: Array<{ time: string; kind: string; label: string; fr: number; mv: number }>;
  sixMonthEvents?: MajorSixMonthEvent[];
  upcoming: UpcomingEvent[];
  fwd?: any;
  invalid: [string, string][];
  fundTxt: string;
  fundEv: string[];
  read: Array<{ k: string; v: string; col: string }>;
  levels: Array<{ k: string; v: string; col: string }>;
  drivers?: [string, string, string, string, string, number][];
  whyEv?: string[];
  whyChg?: [string, string, number, string][];
  signals?: [string, string, string][];
  fwdScn?: [string, string, string, string, string, string][];
  svDetails?: any;
}

export type SITab =
  | "overview"
  | "moved"
  | "could"
  | "fund"
  | "tech"
  | "cat"
  | "ai"
  | "lab"
  | "mon";

export interface ThesisDriver {
  cat: string;
  name: string;
  value: string;
  ev: number;
  flags: string;
  dv: number;
  core: boolean;
  crit: boolean;
  group?: string;
}

