// How much a news story matters, from signals that don't depend on its topic:
// how many articles are telling the same story, whether the headline names the
// company, whether the price reacted, and whether it is evergreen filler.
// Used to pick which headline explains a move (chart) and to label a story's
// impact (Catalysts tab), instead of "closest to the date" / a flat "MED".

export type SignificanceTier = "HIGH" | "MED" | "LOW";

export interface Significance {
  /** 0-100. */
  score: number;
  tier: SignificanceTier;
  /** Articles in the window telling the same story, this one included. */
  coverage: number;
  /** Signed % move of the stock in the session(s) right after publication; null with no price data. */
  reactionPct: number | null;
  /** Evergreen / listicle / "should you buy" filler that explains nothing. */
  filler: boolean;
  /** Id shared by the articles telling one story (an index into the scored list); equals the article's own when it stands alone. */
  story: number;
  /** How many scored articles carry that story id. */
  storySize: number;
  reasons: string[];
}

export interface DayBar { t: number; c: number }

/** The article fields scoring reads; vendors and callers supply more. */
export interface NewsLike {
  headline?: unknown;
  title?: unknown;
  summary?: unknown;
  text?: unknown;
  publishedAt?: unknown;
  date?: unknown;
  tag?: unknown;
  sentiment?: unknown;
}

const DAY_MS = 86_400_000;
/** Two articles are one story when they share this many distinctive words. */
const SHARED_TERMS = 2;
/** Stories this close in time can be the same story. */
const STORY_WINDOW_MS = 2 * DAY_MS;
/** With at least this many articles, a word in more than this share of them is boilerplate. */
const GENERIC_MIN_ARTICLES = 20;
const GENERIC_SHARE = 0.4;

export const HIGH_AT = 55;
export const MED_AT = 25;

const STOP = new Set(
  ("about after again also amid among analyst analysts another because before being below between both could does down during each even ever " +
    "first from have here into just last like made make many more most much need news next only other over said says same shares should since some " +
    "still such than that their them then there these they this those through today under until upon very want were what when where which while " +
    "will with within without would year years your stock stocks market markets price prices investors investor buy sell hold rating target " +
    "company companies report reports reported says say week weeks month months new now after one two three its has had was are the and for not " +
    "but you all can may out off how why who top best better worse big biggest more less").split(/\s+/),
);

/** Listicles, "should you buy", "$X invested" and other evergreen filler. */
const FILLER_RE =
  /\b(what \$?[\d,.]+\w* invested|if you invested|how much would|should you (buy|sell)|better buy|buy or sell|\d+ (stocks?|reasons|ways|things|stocks to)|top \d+|could be worth|here'?s why you|forget\b.*\bbuy|is it (a )?(buy|sell)|vs\.? )/i;

/** Event types that tend to matter; one signal among several, never the only one. */
const EVENT_RE =
  /\b(steps? down|stepping down|resign\w*|ousted|fired|succession|acqui\w+|merger|buyout|takeover|spin-?off|divest\w*|lawsuit|sued|probe|investigation|antitrust|subpoena|settle\w*|recall|bankrupt\w*|guidance|outlook|profit warning|buyback|repurchase|dividend|stock split|offering|layoffs?|halt\w*|delist\w*|short report|downgrad\w*|upgrad\w*)\b/i;

const headlineOf = (x: NewsLike | null | undefined): string => String(x?.headline ?? x?.title ?? "").trim();
const textOf = (x: NewsLike | null | undefined): string => `${headlineOf(x)} ${x?.summary ?? x?.text ?? ""}`;

export const articleTime = (x: NewsLike | null | undefined): number => {
  const pub = x?.publishedAt ?? x?.date;
  return !pub ? NaN : typeof pub === "number" ? pub : new Date(String(pub)).getTime();
};

/** Distinctive words of an article: lower-case, ≥4 letters, no filler words, no company/ticker words. */
function termsOf(x: NewsLike, exclude: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const w of textOf(x).toLowerCase().replace(/'s\b/g, "").match(/[a-z][a-z-]{3,}/g) ?? []) {
    if (!STOP.has(w) && !exclude.has(w)) out.add(w);
  }
  return out;
}

function companyWords(ticker: string, name?: string | null): Set<string> {
  const out = new Set<string>([ticker.toLowerCase()]);
  for (const w of String(name ?? "").toLowerCase().match(/[a-z][a-z-]{2,}/g) ?? []) out.add(w);
  return out;
}

/** Signed % move of the first two sessions on/after the article's day (an after-close story reacts next day). */
function reactionOf(ms: number, moves: Array<{ day: number; ret: number }>): number | null {
  if (!moves.length || !Number.isFinite(ms)) return null;
  const day = Date.parse(`${new Date(ms).toISOString().slice(0, 10)}T00:00:00Z`);
  const next = moves.filter((m) => m.day >= day).slice(0, 2);
  if (!next.length) return null;
  return next.reduce((best, m) => (Math.abs(m.ret) > Math.abs(best) ? m.ret : best), 0);
}

function dailyMoves(bars?: DayBar[] | null): Array<{ day: number; ret: number }> {
  const out: Array<{ day: number; ret: number }> = [];
  if (!bars) return out;
  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1].c;
    if (prev > 0) out.push({ day: Date.parse(`${new Date(bars[i].t).toISOString().slice(0, 10)}T00:00:00Z`), ret: ((bars[i].c - prev) / prev) * 100 });
  }
  return out;
}

/** Signed % move of the first two sessions on/after `ms` (largest in size); null with no price data. */
export function reactionAfter(bars: DayBar[] | null | undefined, ms: number): number | null {
  return reactionOf(ms, dailyMoves(bars));
}

export const tierOf = (score: number): SignificanceTier => (score >= HIGH_AT ? "HIGH" : score >= MED_AT ? "MED" : "LOW");

/**
 * Score every article. Keyed by the article object, so callers can look a
 * score up for the rows they already hold.
 */
export function scoreNews(
  articles: NewsLike[] | null | undefined,
  opts: { ticker: string; name?: string | null; bars?: DayBar[] | null },
): Map<NewsLike, Significance> {
  const list = (articles ?? []).filter((x) => x && headlineOf(x));
  const exclude = companyWords(opts.ticker, opts.name);
  const moves = dailyMoves(opts.bars);
  const rawTerms = list.map((x) => termsOf(x, exclude));
  // In a big feed, a word most articles share ("gains", "covers") is boilerplate, not a story.
  const df = new Map<string, number>();
  for (const t of rawTerms) for (const w of t) df.set(w, (df.get(w) ?? 0) + 1);
  const generic = (w: string) => list.length >= GENERIC_MIN_ARTICLES && (df.get(w) ?? 0) > list.length * GENERIC_SHARE;
  const terms = rawTerms.map((t) => new Set([...t].filter((w) => !generic(w))));
  const times = list.map(articleTime);
  const namesCompany = (x: NewsLike): boolean => {
    const h = headlineOf(x);
    const sym = opts.ticker.toUpperCase().replace(/[.-]/g, "[.-]?");
    if (new RegExp(`(^|[^A-Za-z0-9])\\$?${sym}([^A-Za-z0-9]|$)`).test(h)) return true;
    return [...exclude].some((w) => w.length >= 4 && h.toLowerCase().includes(w));
  };

  const out = new Map<NewsLike, Significance>();
  const related: number[][] = list.map(() => []);
  const own: number[] = [];
  list.forEach((x, i) => {
    const reasons: string[] = [];
    let score = 0;

    // Same story told by several articles close in time.
    let coverage = 1;
    for (let j = 0; j < list.length; j++) {
      if (j === i) continue;
      if (Number.isFinite(times[i]) && Number.isFinite(times[j]) && Math.abs(times[i] - times[j]) > STORY_WINDOW_MS) continue;
      let shared = 0;
      for (const t of terms[i]) if (terms[j].has(t) && ++shared >= SHARED_TERMS) break;
      if (shared >= SHARED_TERMS) { coverage++; related[i].push(j); }
    }
    if (coverage > 1) {
      score += Math.min(36, (coverage - 1) * 12);
      reasons.push(`${coverage} articles on the same story`);
    }

    const eventHit = EVENT_RE.test(textOf(x));
    if (eventHit) { score += 15; reasons.push("material event wording"); }

    if (namesCompany(x)) { score += 10; reasons.push("names the company"); }

    if (/^(earnings|analyst|legal)$/.test(String(x.tag ?? ""))) { score += 8; reasons.push(`${x.tag} item`); }
    if (x.sentiment === "positive" || x.sentiment === "negative") score += 4;

    // Price reaction counts in full only when something else corroborates the story.
    const reactionPct = reactionOf(times[i], moves);
    if (reactionPct != null) {
      const a = Math.abs(reactionPct);
      const pts = a >= 5 ? 25 : a >= 3 ? 18 : a >= 2 ? 10 : a >= 1 ? 5 : 0;
      const corroborated = coverage > 1 || eventHit;
      if (pts) { score += Math.round(corroborated ? pts : pts * 0.4); reasons.push(`stock moved ${reactionPct >= 0 ? "+" : "−"}${a.toFixed(1)}%`); }
    }

    // A clickbait-styled headline is filler only when no one else is telling the
    // story; three or more articles on it make it real news ("Should You Sell?" after a downgrade).
    const filler = FILLER_RE.test(headlineOf(x)) && coverage < 3;
    if (filler) { score -= 30; reasons.push("evergreen / listicle headline"); }

    score = Math.max(0, Math.min(100, score));
    own[i] = score;
    out.set(x, { score, tier: tierOf(score), coverage, reactionPct, filler, story: i, storySize: 1, reasons });
  });

  // Group articles that tell one story (connected through shared distinctive words).
  const root = list.map((_, i) => i);
  const find = (i: number): number => (root[i] === i ? i : (root[i] = find(root[i])));
  related.forEach((js, i) => js.forEach((j) => { root[find(i)] = find(j); }));
  const size = new Map<number, number>();
  list.forEach((_, i) => size.set(find(i), (size.get(find(i)) ?? 0) + 1));
  list.forEach((x, i) => {
    const sg = out.get(x)!;
    sg.story = find(i);
    sg.storySize = size.get(find(i)) ?? 1;
  });

  // A well-covered story is as important as its strongest article: every piece on
  // it carries (almost) that article's impact, so the circle of related headlines
  // doesn't split across tiers by wording.
  list.forEach((x, i) => {
    const sg = out.get(x)!;
    if (sg.coverage < 3) return;
    const lifted = Math.round(0.9 * Math.max(...related[i].map((j) => own[j])));
    if (lifted > sg.score) {
      sg.score = lifted;
      sg.tier = tierOf(lifted);
      sg.reasons.push("carries the story's impact");
    }
  });
  return out;
}

export interface NewsSentiment {
  /** Articles considered: about the stock, not filler, one per headline. */
  total: number;
  /** Of those, how many lean positive / negative (vendor tag, or the stock's reaction on a high-impact story). */
  pos: number;
  neg: number;
  /** High-impact articles among `pos` / `neg`. */
  highPos: number;
  highNeg: number;
  /** Impact-weighted counts (HIGH 3, MED 1, LOW 0.5) that the score is built from. */
  wPos: number;
  wNeg: number;
}

const TIER_WEIGHT: Record<SignificanceTier, number> = { HIGH: 3, MED: 1, LOW: 0.5 };

/** Which way an article leans: the vendor's tag, else — on a high-impact story tagged neutral — the way the stock moved. */
export function leanOf(x: NewsLike, sg: Significance | undefined): "pos" | "neg" | null {
  if (x.sentiment === "positive") return "pos";
  if (x.sentiment === "negative") return "neg";
  if (sg?.tier === "HIGH" && sg.reactionPct != null && Math.abs(sg.reactionPct) >= 2) return sg.reactionPct < 0 ? "neg" : "pos";
  return null;
}

/**
 * The news mood: only articles about the stock (`isAbout`), no filler, each
 * headline once, weighted by how much the story matters rather than counted
 * as one apiece.
 */
export function summarizeNewsSentiment(
  articles: NewsLike[] | null | undefined,
  opts: { ticker: string; name?: string | null; bars?: DayBar[] | null; isAbout?: (x: NewsLike) => boolean },
): NewsSentiment {
  const seen = new Set<string>();
  const list = (articles ?? []).filter((x) => {
    const h = headlineOf(x).toLowerCase();
    if (!h || seen.has(h)) return false;
    seen.add(h);
    return opts.isAbout ? opts.isAbout(x) : true;
  });
  const sig = scoreNews(list, opts);
  const out: NewsSentiment = { total: 0, pos: 0, neg: 0, highPos: 0, highNeg: 0, wPos: 0, wNeg: 0 };
  for (const x of list) {
    const sg = sig.get(x);
    if (!sg || sg.filler) continue;
    out.total++;
    const lean = leanOf(x, sg);
    if (!lean) continue;
    const w = TIER_WEIGHT[sg.tier];
    if (lean === "pos") { out.pos++; out.wPos += w; if (sg.tier === "HIGH") out.highPos++; }
    else { out.neg++; out.wNeg += w; if (sg.tier === "HIGH") out.highNeg++; }
  }
  return out;
}

export type Direction = "Positive" | "Risk" | "Neutral" | "Mixed";

/** Wording that reads as bad news for the stock. */
const NEG_RE =
  /\b(resign\w*|steps? down|stepping down|ousted|fired|probe|investigat\w*|lawsuit|sued|sues|subpoena|fraud|scandal|affair|recall\w*|bankrupt\w*|downgrad\w*|slash\w*|cuts? (guidance|outlook|forecast|target|dividend|jobs|forecasts)|miss(es|ed)?|plung\w*|plummet\w*|tumbl\w*|slump\w*|sinks?|sank|crash\w*|rout|sell-?off|warns?|warning|layoffs?|halts?|delist\w*|antitrust|fined?|banned?|short report|loses|lowers? (guidance|outlook|forecast|target))\b/i;
/** Wording that reads as good news for the stock. */
const POS_RE =
  /\b(beats?|tops (estimates|expectations|forecasts)|raises? (guidance|outlook|forecast|target|dividend)|upgrad\w*|record (revenue|sales|profit|high|quarter)|surg\w*|soars?|soared|jumps?|jumped|rall(y|ies|ied)|approv\w*|wins?|won|buyback|partnership|breakthrough|boosts?|outperform\w*)\b/i;

/**
 * Which way a story leans, from up to three independent signals: the vendor's
 * tag, the wording of the headline and first sentence, and — on a story that
 * matters — how the stock moved. They vote; if they pull in opposite directions
 * with no clear majority the answer is "Mixed" rather than a guess.
 */
export function classifyDirection(x: NewsLike, sg: Significance | undefined): Direction {
  const votes: number[] = [];
  if (x.sentiment === "positive") votes.push(1);
  else if (x.sentiment === "negative") votes.push(-1);

  const first = String(x.summary ?? x.text ?? "").split(/(?<=[.!?])\s/)[0] ?? "";
  const text = `${headlineOf(x)} ${first}`;
  const neg = NEG_RE.test(text), pos = POS_RE.test(text);
  if (neg && !pos) votes.push(-1);
  else if (pos && !neg) votes.push(1);

  if (sg && (sg.tier === "HIGH" || sg.coverage > 1) && sg.reactionPct != null && Math.abs(sg.reactionPct) >= 2) {
    votes.push(sg.reactionPct < 0 ? -1 : 1);
  }

  const up = votes.filter((v) => v > 0).length;
  const down = votes.filter((v) => v < 0).length;
  if (up === 0 && down === 0) return "Neutral";
  if (up > 0 && down > 0) return up > down ? "Positive" : down > up ? "Risk" : "Mixed";
  return up > 0 ? "Positive" : "Risk";
}
