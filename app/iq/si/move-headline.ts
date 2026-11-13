// Which headline explains a day's price move (Why It Moved chart).
//
// The picker used to take the article published closest to midnight UTC at the
// start of the move day, with no check on what it said. NVDA's −9.26% on 5 Nov
// 2026 was labelled "Here's What $10,000 Invested in SpaceX and Nvidia Could Be
// Worth by 2030" while "Nvidia Plunges 9% as AI Selloff Wipes Out $2.3 Trillion"
// sat in the same feed. Now a headline has to say the stock moved the way it
// did (or name a material event alongside that), and opinion / listicle pieces
// are pushed out. When nothing qualifies, no headline is better than a wrong one.

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/**
 * Headline says the stock went down: a move word ("plunges") or an event that is bad
 * news by nature (a CEO stepping down, a downgrade, a probe, cut guidance).
 * "Jensen Huang steps down" was rejected as the reason for NVDA's −5.2% on 12 Nov
 * because it has no "falls" in it.
 */
const DOWN_RE =
  /\b(fall|falls|fell|falling|drops?|dropped|dropping|plung\w*|sinks?|sank|sinking|tumbl\w*|slides?|slid|sliding|slump\w*|sell-?offs?|crash\w*|plummet\w*|tank(s|ed|ing)?|declin\w*|retreat\w*|skid\w*|dives?|dived|diving|punish\w*|hammer\w*|wipes? out|wiped out|sheds?|shedding|losses|loses|lost|52-week low|(stock|shares?) (is |are |was |were )?(sharply )?down|down \d|resign\w*|steps? down|stepping down|oust\w*|downgrad\w*|probes?|investigat\w*|lawsuit|sued|subpoena\w*|recall\w*|bankrupt\w*|halts?|halted|layoffs?|scandal|(cuts?|lowers?|slash\w*) (its |third-quarter |full-year |q\d )?(guidance|outlook|forecast))/i;
/** Headline says the stock went up: a move word or an event that is good news by nature (upgrade, buyback, raised guidance). */
const UP_RE =
  /\b(rise|rises|rose|rising|jump\w*|soar\w*|surg(e|es|ed|ing)|rall(y|ies|ied|ying)|gain(s|ed|ing)?|climb\w*|spik(e|es|ed|ing)|pops?|popped|rebound\w*|higher|leap\w*|rocket\w*|record high|all-time high|52-week high|(stock|shares?) (is |are |was |were )?(sharply )?up|up \d|upgrad\w*|buybacks?|record (revenue|profit|earnings|quarter)|(beats?|tops?) (estimates|expectations|forecasts)|(raises?|lifts?|boosts?) (its |third-quarter |full-year |q\d )?(guidance|outlook|forecast))/i;
/** A material event: on its own it is not enough, beside a matching move it is the "why". */
const EVENT_RE =
  /\b(resign\w*|steps? down|stepping down|oust\w*|fired|ceo|succession|downgrad\w*|upgrad\w*|guidance|outlook|forecast|earnings|results|probe|investigat\w*|lawsuit|sued|subpoena|antitrust|recall|fda|acqui\w+|merger|buyout|takeover|offering|buyback|tariffs?|export (bans?|controls?|curbs?)|sanction\w*|scandal|layoffs?|bankrupt\w*|halt\w*)\b/i;
/** Evergreen, listicle and "should you buy" pieces explain nothing about a given day. */
export const FILLER_RE =
  /(\$[\d,.]+\s*[kmb]?\s+(invested|investment)|if you('d| had)? invested|could be worth|should you (buy|sell)|(is it|still) a buy|buy (it )?(now|right now|before|and hold|the dip)|better (buy|stock)|millionaire|\b\d+ (stocks?|reasons|ways|things)\b|\btop \d+|\bforget\b|here'?s why you|prediction|by 20[3-9]\d|bad-news buy|stocks? to (avoid|buy)|\bfavou?rite\b|since (its )?last earnings report|can it continue)/i;
/** "I'm Buying The Fear", "My 3 Favorite…": an author's view, not a report. */
const FIRST_PERSON_RE = /(^|[\s:])(I|I'm|I'd|I've|My)\s/;

/**
 * Stake / holdings notes ("NVIDIA Corporation $NVDA Shares Acquired by First
 * County Bank CT", "Sells 500 Shares of …", "Raises Position in …"): filings
 * about someone else's position, not news about the company. They tripped the
 * "M&A" label because they say "acquired".
 */
const HOLDINGS_RE =
  /\bshares? (acquired|sold|bought|purchased|trimmed|boosted|lifted|raised|lowered|cut|reduced|increased) by\b|\b(buys?|sells?|purchases?|acquires?|trims?|boosts?|lifts?|raises?|lowers?|cuts?|reduces?|increases?|adds?)\b[^.:]{0,40}\b(shares|stake|position|holdings)\b[^.:]{0,40}\b(of|in)\b|\b(stake|position|holdings?) in\b|\bgrew its\b/i;

/** A headline that is a stake / holdings note rather than news about the company. */
export const isHoldingsNote = (headline: string): boolean => HOLDINGS_RE.test(headline);

/**
 * Law-firm solicitations ("NVDA Investors Have Opportunity to Lead … Securities
 * Class Action", "SHAREHOLDER ALERT: …", "… Reminds Investors of Deadline"):
 * paid releases that repeat for every stock that falls, a dozen a day around a
 * scandal, and were filling the "Legal / Regulatory" slots of the notable events.
 */
const SOLICITATION_RE =
  /\b(investor|shareholder)s? (alert|deadline|reminder)\b|\blead plaintiff\b|\bencouraged to contact\b|\bopportunity to lead\b|\bsuffered losses\b|\b(reminds?|urges?|encourages?)\b[^.:]{0,30}\binvestors\b|\blaw (firm|offices?)\b|\b(llp|pllc)\b/i;

/** A headline that is a law-firm solicitation, not news. */
export const isSolicitation = (headline: string): boolean => SOLICITATION_RE.test(headline);

/** Below this an article does not explain the move (needs at least a direction match). */
export const MIN_EXPLAIN_SCORE = 30;

/** How many of the latest sessions count as "recent" when the chart picks its moves. */
export const RECENT_SESSIONS = 5;
/** A move is unusual when it is at least this many times the stock's median daily move… */
export const UNUSUAL_MOVE_TIMES = 2.5;
/** …and never smaller than this many percent. */
export const UNUSUAL_MOVE_MIN_PCT = 2;

/**
 * The chart picks the biggest move of each sixth of the window, so a stretch
 * with one large old move hides everything after it: NVDA's 5 Nov (−9.26%)
 * kept 10 Nov (−5.47%) and 12 Nov (−4.34%), the CEO-scandal days, off a chart
 * that ends on 12 Nov. If none of the picked moves is in the latest
 * RECENT_SESSIONS sessions, this returns the biggest unusual move among them
 * (the later one on a tie), or null when the latest sessions were ordinary.
 * `moves` are one per session after the first; `idx` is the bar index.
 */
export function pickRecentMove<M extends { idx: number; absRet: number }>(
  moves: readonly M[],
  picked: readonly M[],
  barCount: number,
): M | null {
  if (!moves.length) return null;
  const firstRecent = barCount - RECENT_SESSIONS;
  if (picked.some((p) => p.idx >= firstRecent)) return null;
  const sorted = moves.map((m) => m.absRet).sort((a, b) => a - b);
  const median = sorted[sorted.length >> 1];
  const bar = Math.max(UNUSUAL_MOVE_MIN_PCT, UNUSUAL_MOVE_TIMES * median);
  let best: M | null = null;
  for (const m of moves) {
    if (m.idx < firstRecent || m.absRet < bar) continue;
    if (!best || m.absRet > best.absRet || (m.absRet === best.absRet && m.idx > best.idx)) best = m;
  }
  return best;
}

export interface ArticleLike {
  headline?: unknown;
  title?: unknown;
  publishedAt?: unknown;
  date?: unknown;
}

const headlineOf = (x: ArticleLike): string => String(x.headline ?? x.title ?? "").trim();

const timeOf = (x: ArticleLike): number => {
  const pub = x.publishedAt ?? x.date;
  return !pub ? NaN : typeof pub === "number" ? pub : new Date(String(pub)).getTime();
};

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const DATE_IN_HEADLINE_RE =
  /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})\b(?!\s*,?\s*\d{4})/i;

/**
 * Days from `moveDay` (00:00 UTC of the session's date) to a calendar date the
 * headline names ("Stock Market Today, Nov. 6: AMD Surges 11%…"): negative when
 * it names an earlier day, 0 when it names the session itself, null when it
 * names none (or one with a year, like a deadline "January 8, 2027").
 */
export function mentionedDayOffset(headline: string, moveDay: number): number | null {
  const m = DATE_IN_HEADLINE_RE.exec(headline);
  if (!m) return null;
  const month = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
  const dom = Number(m[2]);
  if (month < 0 || dom < 1 || dom > 31) return null;
  const year = new Date(moveDay).getUTCFullYear();
  let at = Date.UTC(year, month, dom);
  // "Dec. 30" on a January move is last year's.
  if (at - moveDay > 200 * DAY_MS) at = Date.UTC(year - 1, month, dom);
  else if (moveDay - at > 200 * DAY_MS) at = Date.UTC(year + 1, month, dom);
  return Math.round((at - moveDay) / DAY_MS);
}

/** How well a headline explains a move of `ret` percent (sign matters). */
export function explainScore(headline: string, ret: number): number {
  const sameWay = ret < 0 ? DOWN_RE : UP_RE;
  const otherWay = ret < 0 ? UP_RE : DOWN_RE;
  const dirHit = sameWay.test(headline);
  let score = 0;
  if (dirHit) score += 50;
  else if (otherWay.test(headline)) score -= 30;
  if (EVENT_RE.test(headline)) score += 20;
  if (dirHit && /\d+(\.\d+)?\s?%/.test(headline)) score += 10;
  if (dirHit && /\b(today|this week|on (monday|tuesday|wednesday|thursday|friday))\b/i.test(headline)) score += 10;
  if (dirHit && /^why\b/i.test(headline)) score += 10;
  if (FILLER_RE.test(headline)) score -= 60;
  if (/\?\s*$/.test(headline)) score -= 15;
  // Advice ("Cramer Says Nvidia Should Buy Shares on Thursday's 8% Drop") reacts to the move; it doesn't explain it.
  if (/\bshould\b/i.test(headline)) score -= 25;
  if (FIRST_PERSON_RE.test(headline)) score -= 20;
  return score;
}

/**
 * The article that best explains the session on `moveDay` (00:00 UTC of the
 * move's date), or null when none does.
 *
 * Window: from the previous session's close (after-hours news drives the next
 * day's gap, e.g. NVDA's CEO news on the evening of 11 Nov behind 12 Nov's
 * −4.3%) through the evening after the move ("Why Nvidia Stock Fell Today" is
 * often published that night). Starting at the whole previous day let that
 * day's own move stories compete. Ties go to the article nearest the close.
 */
export function pickMoveHeadline<T extends ArticleLike>(
  news: readonly T[] | null | undefined,
  move: { moveDay: number; ret: number; prevDay?: number | null },
  /**
   * Optional extra points for ranking headlines that already explain the move
   * (e.g. how many articles tell the same story). It never lets a headline in:
   * the explaining threshold is checked on the explain score alone.
   */
  bonus?: (article: T) => number,
): T | null {
  const from = (move.prevDay != null && Number.isFinite(move.prevDay) ? move.prevDay : move.moveDay - DAY_MS) + 20 * HOUR_MS;
  const to = move.moveDay + DAY_MS + 4 * HOUR_MS; // ~midnight ET after the session
  const close = move.moveDay + 21 * HOUR_MS;
  let best: { x: T; score: number; ms: number } | null = null;
  for (const x of news ?? []) {
    const ms = timeOf(x);
    if (!Number.isFinite(ms) || ms < from || ms >= to) continue;
    const h = headlineOf(x);
    if (!h) continue;
    // Published after the previous close but recapping that session: "Stock Market
    // Today, Nov. 6: AMD Surges 11%…" came out on Friday evening and was shown
    // as the reason for Monday's +13%. A headline naming an earlier day is about that day.
    const named = mentionedDayOffset(h, move.moveDay);
    if (named != null && named < 0 && named >= -7) continue;
    const explains = explainScore(h, move.ret) + (named === 0 ? 10 : 0);
    if (explains < MIN_EXPLAIN_SCORE) continue;
    const score = explains + (bonus ? bonus(x) : 0);
    if (!best || score > best.score || (score === best.score && Math.abs(ms - close) < Math.abs(best.ms - close))) {
      best = { x, score, ms };
    }
  }
  return best?.x ?? null;
}
