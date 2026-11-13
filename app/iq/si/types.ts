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
  /** Event day as YYYY-MM-DD — what the timeline sorts and windows on (`date` is display text). Absent for "TBD". */
  iso?: string;
  days: string;
  n: string;
  txt: string;
  imp: string;
  col: string;
  /** Short kind tag shown above the name, e.g. "Political" or "Earnings". */
  cat?: string;
  /** True for an event that already happened (inside the timeline's look-back window). */
  past?: boolean;
}

/** One labelled figure on a major-move card, e.g. EPS surprise +4.2%; `tone` tints it green/red. */
export interface EventMetric {
  k: string;
  v: string;
  tone?: "up" | "dn";
}

/** A notable headline near a major move: leadership change, M&A, legal, guidance, etc. */
export interface EventContext {
  kind: string;
  text: string;
  tone?: "up" | "dn";
}

export interface MajorSixMonthEvent {
  num: number;
  date: string;
  label: string;
  category: "Earnings" | "Product" | "Analyst" | "Macro" | "Corporate";
  mv: number;
  details: string;
  fr: number;
  /** Earnings only: EPS/sales growth, surprise and margins for the reported quarter. */
  metrics?: EventMetric[];
  /** Earnings only: what the press said about the print (guidance, drivers, tone). */
  commentary?: string;
  /** Notable non-earnings headlines in the window (CEO exits, deals, probes, ...). */
  context?: EventContext[];
}

/** A run of the assessment sentence; `tone` tints it green ("up") or red ("dn"). */
export interface AssessSeg {
  t: string;
  tone?: "up" | "dn";
}

export interface DetailStock {
  sv: number[];
  ev?: Record<string, string[]>;
  assess: string;
  assessSegs?: AssessSeg[];
  assessEv?: string[];
  att: number[];
  movedTxt: string;
  attCalc?: any;
  movedEv: string[];
  events?: Array<{ time: string; kind: string; label: string; fr: number; mv: number }>;
  sixMonthEvents?: MajorSixMonthEvent[];
  upcoming: UpcomingEvent[];
  fwd?: any;
  /** Levels still ahead of the price: what would break the setup. */
  invalid: [string, string][];
  /** Levels the price is already through (below the 50/200 DMA, below S1). */
  broken: [string, string][];
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

