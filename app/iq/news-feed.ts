import type { NewsArticleDoc, CompanyDoc } from "./types";

/**
 * Shared shaping for the news feed, used by BOTH the Live Feed screen and the
 * dashboard's Live Market Feed card so the two show the same stories, under
 * the same ticker, stamped with the same time. They read the same endpoint;
 * they only drifted because each re-implemented this step its own way.
 */

/** Newest first. Placeholder tickers ("NONE" on market-wide filings) are
 *  cleared so they never render as a symbol. */
export function sortNewsDesc(items: NewsArticleDoc[]): NewsArticleDoc[] {
  return items
    .map(n => (n.ticker && !storyTicker(n) ? { ...n, ticker: "" } : n))
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

/* Collapse multi-ticker duplicates. Polygon tags one article to EVERY ticker
   it mentions, so the same story arrives once per ticker (an Alphabet piece
   gets tagged both GOOG and MSFT). Show it ONCE, keeping the ticker whose
   company name actually appears in the headline (so the Alphabet story keeps
   GOOG, not the incidental MSFT mention). Input order is preserved. */
export function dedupeNews(
  items: NewsArticleDoc[],
  companyByTicker: Map<string, CompanyDoc>,
): NewsArticleDoc[] {
  const byKey = new Map<string, NewsArticleDoc>();
  const order: string[] = [];
  const relevance = (n: NewsArticleDoc) => {
    const nm = companyByTicker.get(n.ticker)?.name?.split(/[\s,.]/)[0]?.toLowerCase();
    return nm && nm.length > 2 && (n.headline ?? "").toLowerCase().includes(nm) ? 1 : 0;
  };
  for (const n of items) {
    const key = n.url || n.id;
    const cur = byKey.get(key);
    if (!cur) { byKey.set(key, n); order.push(key); }
    else if (relevance(n) > relevance(cur)) byKey.set(key, n);
  }
  return order.map(k => byKey.get(k) as NewsArticleDoc);
}

/** "9:41a" in US Eastern — the feed's time column. Always ET, never the
 *  viewer's local zone, so every screen stamps a story identically. */
export function etTimeLabel(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", hour: "numeric", minute: "2-digit", hour12: true,
  }).formatToParts(new Date(iso));
  const hour = parts.find(p => p.type === "hour")?.value ?? "12";
  const minute = parts.find(p => p.type === "minute")?.value ?? "00";
  const dayPeriod = (parts.find(p => p.type === "dayPeriod")?.value ?? "AM").toLowerCase()[0];
  return `${hour}:${minute}${dayPeriod}`;
}

/** A real ticker on a story ("NONE" / "N/A" placeholders from the wire are not). */
export function storyTicker(n: Pick<NewsArticleDoc, "ticker">): string | null {
  const t = (n.ticker ?? "").trim().toUpperCase();
  return t && t !== "NONE" && t !== "N/A" && t !== "NULL" ? t : null;
}

/**
 * The KIND of story: earnings / merger / company / macro. Synced company news
 * carries category null, so reading only `category` typed every story Macro;
 * the subject tag and the ticker decide it when the category is absent.
 */
export function storyKind(n: Pick<NewsArticleDoc, "category" | "tag" | "ticker">): "earnings" | "merger" | "company" | "macro" {
  const c = n.category;
  if (c === "earnings" || c === "merger" || c === "company") return c;
  if (c === "macro") return "macro";
  if (n.tag === "earnings") return "earnings";
  if (n.tag === "ma") return "merger";
  return storyTicker(n) ? "company" : "macro";
}

/** Display label for a story kind (see storyKind). */
export function catLabel(c: string | null): string {
  if (c === "earnings") return "Earnings";
  if (c === "merger") return "M&A";
  if (c === "company") return "Company";
  return "Macro";
}
