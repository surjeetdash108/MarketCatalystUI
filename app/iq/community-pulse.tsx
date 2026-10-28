"use client";

import { useState } from "react";
import { useIQActions } from "./shell";

/*
 * Community Pulse — a "Latest Tweets" feed and a "Trader Chat" in one panel.
 *
 * NOTE: there is no backend feed for either yet. The tweets and the seed chat
 * messages below are SAMPLE content from the design prototype, and chat
 * messages you type live only in this component's state (not persisted or
 * shared). Wire both to real endpoints before presenting them as live data.
 */

type Sentiment = "Bullish" | "Bearish" | "Neutral";
interface Tweet { name: string; handle: string; text: string; time: string; ago: string; tag: string; sent: Sentiment }

const TWEETS: Tweet[] = [
  { name: "Walter Bloomberg", handle: "DeItaone", text: "NVDA, AMD lead chip bid in premarket as TSMC flags stronger AI demand into 2027.", time: "9:41 AM", ago: "1m", tag: "$NVDA", sent: "Bullish" },
  { name: "unusual_whales", handle: "unusual_whales", text: "Large call sweep: $CLRO Nov 5C, 12,400 contracts — stock already +69% on the day.", time: "9:36 AM", ago: "6m", tag: "$CLRO", sent: "Bullish" },
  { name: "Zerohedge", handle: "zerohedge", text: "Fear & Greed at 13. Extreme fear with VIX only 19 — a strange combination.", time: "9:28 AM", ago: "14m", tag: "$VIX", sent: "Bearish" },
  { name: "Nick Timiraos", handle: "NickTimiraos", text: "Fed officials signal patience on cuts as core services inflation stays sticky.", time: "9:15 AM", ago: "27m", tag: "Macro", sent: "Neutral" },
  { name: "Charlie Bilello", handle: "charliebilello", text: "Energy +2.28% vs Communications −4.38%: widest sector spread in 3 months.", time: "9:02 AM", ago: "40m", tag: "$XLE", sent: "Bullish" },
  { name: "Stocktwits", handle: "Stocktwits", text: "$ACN trending after guidance cut — RS still 90 on a 6-month view.", time: "8:51 AM", ago: "51m", tag: "$ACN", sent: "Bearish" },
];

const SEED_CHAT: Array<{ who: string; text: string; time: string }> = [
  { who: "Priya S.", text: "Anyone else watching $MU into the 200 retest? Volume looks real.", time: "9:38 AM" },
  { who: "Marco T.", text: "Energy is carrying the tape again. $XOM breaking the morning high.", time: "9:40 AM" },
  { who: "Dev K.", text: "Breadth is ugly — staying small until the VIX cools off.", time: "9:41 AM" },
];

const AVATARS = ["#4ade80", "#8b7cf6", "#f2b33d", "#6f9fd8", "#f0565a", "#5bc0f8"];

export function CommunityPulse() {
  const { openStock } = useIQActions();
  const [tab, setTab] = useState<"tw" | "chat">("tw");
  const [mine, setMine] = useState<Array<{ text: string; time: string }>>([]);
  const [draft, setDraft] = useState("");

  const send = () => {
    const t = draft.trim();
    if (!t) return;
    setMine(m => [...m, { text: t, time: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) }]);
    setDraft("");
  };

  return (
    <div className="cpulse">
      <div className="cpulse-h">
        <div className="cpulse-orb">
          <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h4l2.5-6 4 13 3-9 1.5 2H22" /></svg>
        </div>
        <h3>Community Pulse</h3>
        <span className="wmn-live"><span className="dot" />Live</span>
      </div>

      <div className="cpulse-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "tw"} className={tab === "tw" ? "on" : ""} onClick={() => setTab("tw")}>
          Latest Tweets <span className="n">{TWEETS.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={tab === "chat"} className={tab === "chat" ? "on" : ""} onClick={() => setTab("chat")}>
          Trader Chat <span className="n">{SEED_CHAT.length + mine.length}</span>
        </button>
      </div>

      {tab === "tw" ? (
        <div className="cpulse-body">
          {TWEETS.map((t, i) => {
            const isTicker = t.tag.startsWith("$");
            return (
              <div key={i} className="cpulse-tw">
                <div className="cpulse-av" style={{ background: AVATARS[i % AVATARS.length] }}>{t.name[0].toUpperCase()}</div>
                <div className="cpulse-tw-main">
                  <div className="cpulse-tw-top">
                    <span className="nm">{t.name}</span>
                    <span className="hd">@{t.handle}</span>
                    <span className="ago">{t.ago}</span>
                  </div>
                  <div className="cpulse-tw-text">{t.text}</div>
                  <div className="cpulse-tw-foot">
                    {isTicker
                      ? <button type="button" className="tk-link" title={`Open ${t.tag.slice(1)}`} onClick={() => openStock(t.tag.slice(1))}>{t.tag}</button>
                      : <span className="tk-plain">{t.tag}</span>}
                    <span className="tm">{t.time}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <div className="cpulse-body cpulse-chat">
            {SEED_CHAT.map((m, i) => (
              <div key={i} className="cpulse-msg">
                <span className="cpulse-av sm" style={{ background: AVATARS[(i + 1) % AVATARS.length] }}>{m.who[0]}</span>
                <div className="bub-wrap">
                  <span className="who">{m.who} · {m.time}</span>
                  <span className="bub">{m.text}</span>
                </div>
              </div>
            ))}
            {mine.map((m, i) => (
              <div key={`m${i}`} className="cpulse-msg me">
                <span className="cpulse-av sm" style={{ background: "#3b5bdb" }}>Y</span>
                <div className="bub-wrap">
                  <span className="who">You · {m.time}</span>
                  <span className="bub">{m.text}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="cpulse-compose">
            <input value={draft} placeholder="Share a trade idea — use $ for tickers"
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") send(); }} />
            <button type="button" title="Send" aria-label="Send" onClick={send}>
              <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4z" /></svg>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
