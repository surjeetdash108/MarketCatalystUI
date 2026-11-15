// AI-written text for the Why It Moved cards.
//
// The backend (GET /live/move-explanation) writes a heading and a short
// explanation for one big move from that day's articles only. The card shows the
// rule-based text first and swaps this in when it arrives; when there is no AI
// answer (none for that day, model busy, route missing) the rule-based text stays.

import type { MajorSixMonthEvent } from "./types";

export interface AiMoveCard {
  available?: boolean;
  heading?: string;
  summary?: string;
}

/** Cards worth asking about: the ones shown under the chart. Earnings cards keep their exact report figures. */
export function wantsAiCard(ev: MajorSixMonthEvent): boolean {
  return ev.card !== false && ev.category !== "Earnings" && !!ev.iso;
}

/** The request path for one card, or null when the card does not take AI text. */
export function moveCardPath(ticker: string, name: string | undefined, ev: MajorSixMonthEvent): string | null {
  if (!wantsAiCard(ev) || !ev.iso) return null;
  const q = new URLSearchParams({ ticker: ticker.toUpperCase(), date: ev.iso, move: ev.mv.toFixed(2) });
  if (ev.prevIso) q.set("prevDate", ev.prevIso);
  if (name) q.set("name", name);
  return `/live/move-explanation?${q.toString()}`;
}

/** A reply the card can use: available, with a heading and a summary of sensible size. */
export function usableAiCard(doc: AiMoveCard | null | undefined): doc is Required<Pick<AiMoveCard, "heading" | "summary">> & AiMoveCard {
  return !!doc && doc.available === true && typeof doc.heading === "string" && doc.heading.length >= 15 && typeof doc.summary === "string" && doc.summary.length >= 40;
}

/** The events with the AI heading and summary swapped in (by trading day) wherever there is one. Everything else is unchanged. */
export function applyAiCards(events: readonly MajorSixMonthEvent[], byIso: Readonly<Record<string, AiMoveCard | null | undefined>>): MajorSixMonthEvent[] {
  return events.map((ev) => {
    const ai = ev.iso ? byIso[ev.iso] : undefined;
    return wantsAiCard(ev) && usableAiCard(ai) ? { ...ev, label: ai.heading, details: ai.summary } : ev;
  });
}
