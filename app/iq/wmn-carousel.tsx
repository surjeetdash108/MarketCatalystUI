"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

export interface WmnStat {
  label: string;
  value: string;
  /** Colours the value like a move; omit for a plain figure. */
  tone?: "up" | "down" | "flat";
}

export interface WmnSlide {
  /** Stable identity, so a slide list rebuilt as live data arrives keeps its place. */
  key: string;
  /** Short category label shown in the coloured header chip, e.g. "MARKET DIRECTION". */
  tag: string;
  tone: "brand" | "warn" | "up" | "down" | "info";
  /** Subject of the slide (ticker, index, theme). */
  name: string;
  /** One-line timestamp on the right of the header row. */
  when?: string;
  /** The headline read. */
  lead: string;
  /** Evidence chips under the headline. */
  stats?: WmnStat[];
  /** A chart, table or cards. Sits beside the headline when `split`, else below it. */
  visual?: ReactNode;
  /** Put the visual in a column beside the headline and chips (wide layouts only). */
  split?: boolean;
  /** Supporting sentence(s). */
  body?: string;
  /** A short list of facts under the headline. */
  points?: string[];
  /** Single takeaway shown with a ◆ marker. */
  point?: string;
  /** A small dim line at the foot of the slide (a disclaimer). */
  foot?: string;
  /** Where "read more" goes: a link, or a button when it opens something on this page. */
  cta?: { label: string; href?: string; onClick?: () => void };
}

// Was 9s for one-sentence slides; the data slides (releases, earnings cards,
// analyst calls) take longer to read.
const ROTATE_MS = 12_000;
const DOT_WINDOW = 5;

/**
 * "What Matters Now" body: one curated read per slide, auto-advancing, with
 * First / prev / dots / next controls. Rotation pauses while the pointer is
 * over the card or focus is inside it, so a reader is never pulled off a slide
 * mid-sentence or mid-click.
 */
export function WmnCarousel({ slides }: { slides: WmnSlide[] }) {
  // The index is kept as a slide KEY, not a position: the list is rebuilt as live
  // data arrives (a slide can appear or drop out), and a position would silently
  // move the reader to a different slide when that happens.
  const [curKey, setCurKey] = useState<string | null>(null);
  const [hold, setHold] = useState(false);
  const n = slides.length;
  const found = slides.findIndex((s) => s.key === curKey);
  const cur = found >= 0 ? found : 0;

  useEffect(() => {
    if (hold || n < 2) return;
    const id = setInterval(() => {
      setCurKey(slides[(cur + 1) % n].key);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [hold, n, cur, slides]);

  if (n === 0) return null;
  const go = (j: number) => setCurKey(slides[(j + n) % n].key);
  const ws = Math.max(0, Math.min(cur - 2, n - DOT_WINDOW));

  return (
    <div
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocusCapture={() => setHold(true)}
      onBlurCapture={() => setHold(false)}
    >
      <div className="wmnc-viewport">
        <div className="wmnc-track" style={{ transform: `translateX(${-cur * 100}%)` }}>
          {slides.map((s, j) => (
            <div
              key={s.key}
              className="wmnc-slide"
              style={{ opacity: j === cur ? 1 : 0 }}
              aria-hidden={j !== cur}
              // Off-screen slides are not reachable by keyboard or screen reader,
              // so a Tab never lands on a link the reader cannot see.
              inert={j !== cur}
            >
              <div className="wmnc-meta">
                <span className={`wmnc-tag ${s.tone}`}>{s.tag}</span>
                <span>· {s.name}</span>
                {s.when && <span className="wmnc-when">{s.when}</span>}
              </div>
              <div className={s.split && s.visual ? "wmnc-cols" : undefined}>
                <div className="wmnc-main">
                  <div className="wmnc-lead">{s.lead}</div>
                  {s.stats && s.stats.length > 0 && (
                    <div className="wmnc-stats">
                      {s.stats.map((st) => (
                        <span key={st.label} className="wmnc-stat">
                          <span className="k">{st.label}</span>
                          <span className={`v${st.tone ? ` ${st.tone}` : ""}`}>{st.value}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {s.visual && <div className="wmnc-vis">{s.visual}</div>}
              </div>
              {s.body && <div className="wmnc-body">{s.body}</div>}
              {s.points && s.points.length > 0 && (
                <ul className="wmnc-points">
                  {s.points.map((p, k) => (
                    <li key={k}>
                      <span className="d">◆</span>
                      {p}
                    </li>
                  ))}
                </ul>
              )}
              {s.point && (
                <div className="wmnc-point">
                  <span className="d">◆</span>
                  {s.point}
                </div>
              )}
              {s.foot && <div className="wmnc-foot">{s.foot}</div>}
              {s.cta && (
                <div className="wmnc-cta">
                  {s.cta.onClick ? (
                    <button type="button" className="link" onClick={s.cta.onClick}>
                      {s.cta.label} →
                    </button>
                  ) : s.cta.href ? (
                    <Link className="link" href={s.cta.href}>
                      {s.cta.label} →
                    </Link>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="wmnc-nav">
        <span className="wmnc-pos">
          <b>{cur + 1}</b> / {n}
        </span>
        <button type="button" className="wmnc-btn wmnc-first" title="Back to first" disabled={cur === 0} onClick={() => go(0)}>
          <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6l-6 6 6 6" /><path d="M6 6v12" /></svg>
          First
        </button>
        <button type="button" className="wmnc-btn wmnc-sq" title="Previous" onClick={() => go(cur - 1)}>
          <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        {slides.map((s, j) => (j >= ws && j < ws + DOT_WINDOW) && (
          <button key={s.key} type="button" title={s.name} aria-label={`Slide ${j + 1}: ${s.name}`}
            className={`wmnc-dot${j === cur ? " on" : ""}`} onClick={() => go(j)} />
        ))}
        <button type="button" className="wmnc-btn wmnc-sq" title="Next" onClick={() => go(cur + 1)}>
          <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
        </button>
      </div>
    </div>
  );
}
