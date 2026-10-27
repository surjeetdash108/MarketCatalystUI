"use client";

import { useEffect, useState } from "react";

export interface WmnSlide {
  /** Short category label shown in the coloured header chip, e.g. "VOLATILITY". */
  tag: string;
  tone: "brand" | "warn" | "up" | "down" | "info";
  /** Subject of the slide (ticker, index, theme). */
  name: string;
  /** One-line timestamp on the right of the header row. */
  when?: string;
  /** The headline read. */
  lead: string;
  /** Supporting sentence(s). */
  body?: string;
  /** Single takeaway shown with a ◆ marker. */
  point?: string;
}

const ROTATE_MS = 9000;
const DOT_WINDOW = 5;

/**
 * "What Matters Now" body: one curated read per slide, auto-advancing, with
 * First / prev / dots / next controls. Rotation pauses while the pointer is
 * over the card so a reader is never pulled off a slide mid-sentence.
 */
export function WmnCarousel({ slides }: { slides: WmnSlide[] }) {
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);
  const n = slides.length;

  // The slide list is rebuilt as live data arrives — keep the index in range.
  useEffect(() => { if (i >= n) setI(0); }, [i, n]);

  useEffect(() => {
    if (hold || n < 2) return;
    const id = setInterval(() => setI(c => (c + 1) % n), ROTATE_MS);
    return () => clearInterval(id);
  }, [hold, n]);

  if (n === 0) return null;
  const cur = Math.min(i, n - 1);
  const go = (j: number) => setI((j + n) % n);
  const ws = Math.max(0, Math.min(cur - 2, n - DOT_WINDOW));

  return (
    <div onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)}>
      <div className="wmnc-viewport">
        <div className="wmnc-track" style={{ transform: `translateX(${-cur * 100}%)` }}>
          {slides.map((s, j) => (
            <div key={j} className="wmnc-slide" style={{ opacity: j === cur ? 1 : 0 }} aria-hidden={j !== cur}>
              <div className="wmnc-meta">
                <span className={`wmnc-tag ${s.tone}`}>{s.tag}</span>
                <span>· {s.name}</span>
                {s.when && <span className="wmnc-when">{s.when}</span>}
              </div>
              <div className="wmnc-lead">{s.lead}</div>
              {s.body && <div className="wmnc-body">{s.body}</div>}
              {s.point && <div className="wmnc-point"><span className="d">◆</span>{s.point}</div>}
            </div>
          ))}
        </div>
      </div>
      <div className="wmnc-nav">
        <span className="wmnc-pos"><b>{cur + 1}</b> / {n}</span>
        <button type="button" className="wmnc-btn wmnc-first" title="Back to first" disabled={cur === 0} onClick={() => go(0)}>
          <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6l-6 6 6 6" /><path d="M6 6v12" /></svg>
          First
        </button>
        <button type="button" className="wmnc-btn wmnc-sq" title="Previous" onClick={() => go(cur - 1)}>
          <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        {slides.map((s, j) => (j >= ws && j < ws + DOT_WINDOW) && (
          <button key={j} type="button" title={s.name} aria-label={`Slide ${j + 1}: ${s.name}`}
            className={`wmnc-dot${j === cur ? " on" : ""}`} onClick={() => go(j)} />
        ))}
        <button type="button" className="wmnc-btn wmnc-sq" title="Next" onClick={() => go(cur + 1)}>
          <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
        </button>
      </div>
    </div>
  );
}
