"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveQuote } from "./hooks/useLiveQuote";
import { useSnapshotQuote } from "./hooks/useSnapshotQuote";

/**
 * Side-by-side evaluation of the two ways to show a moving price:
 *
 *   LEFT   our pipeline — Polygon delayed WS -> NestJS -> SSE -> this component,
 *          with every derived figure recomputed on each tick.
 *   RIGHT  TradingView's embedded widget, which brings its own data.
 *
 * Built to answer one question: is our delayed feed good enough, or is the
 * widget's data materially better? The "Feed lag" readout on the left is the
 * honest comparison point — it shows exactly how old our price is.
 *
 * This is an evaluation surface, not a shipped feature. See LIVE-PRICE-EVAL.md.
 */

const nf = (v: number | null | undefined, d = 2) =>
  v == null || !Number.isFinite(v) ? "—" : v.toLocaleString(undefined, {
    minimumFractionDigits: d, maximumFractionDigits: d,
  });

const vol = (v: number | null) =>
  v == null ? "—" : v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v.toLocaleString();

// ── TradingView embed ────────────────────────────────────────────────────────

/**
 * TradingView widgets are injected by a script tag whose *text content* is the
 * JSON config — not attributes, and not a React prop. So the widget has to be
 * built imperatively and torn down by hand when the symbol changes; otherwise
 * each symbol change stacks another chart on top of the last.
 */
function TradingViewChart({ symbol, theme = "dark" }: { symbol: string; theme?: "dark" | "light" }) {
  const holder = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    el.innerHTML = "";
    setFailed(false);

    const container = document.createElement("div");
    container.className = "tradingview-widget-container";
    container.style.height = "100%";
    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    widget.style.height = "100%";
    container.appendChild(widget);

    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.type = "text/javascript";
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval: "1",
      timezone: "America/New_York",
      theme,
      style: "1",
      locale: "en",
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: false,
      save_image: false,
      support_host: "https://www.tradingview.com",
    });
    // A blocked third-party script fails silently and leaves an empty box —
    // surface it instead, since "no chart" would otherwise look like our bug.
    script.onerror = () => setFailed(true);
    container.appendChild(script);
    el.appendChild(container);

    return () => { el.innerHTML = ""; };
  }, [symbol, theme]);

  return (
    <>
      <div ref={holder} className="lc-tv" />
      {failed && (
        <div className="lc-note lc-warn">
          TradingView script failed to load — usually an ad-blocker or CSP rule.
          That is itself a data point: the widget depends on a third-party origin
          being reachable.
        </div>
      )}
    </>
  );
}

// ── Our pipeline panel ───────────────────────────────────────────────────────

function LivePanel({ ticker }: { ticker: string }) {
  const { snapshot, derived: d, status, lastTick } = useLiveQuote(ticker);

  const dirClass = d.direction === "up" ? "up" : d.direction === "down" ? "dn" : "";
  const stale = d.ageSeconds != null && d.ageSeconds > 30;

  return (
    <div className="lc-body">
      <div className="lc-statusrow">
        <span className={`lc-dot ${status.connected ? "on" : "off"}`} />
        <span>{status.connected ? "streaming" : status.message}</span>
        {snapshot && (
          <span className="lc-badge">
            {snapshot.feed} · ch {snapshot.channel} · ~{snapshot.delayMinutes}m delayed
          </span>
        )}
      </div>

      <div className="lc-price">
        <span className={`lc-last ${dirClass}`}>{nf(d.last)}</span>
        <span className={`lc-chg ${d.change == null ? "" : d.change >= 0 ? "up" : "dn"}`}>
          {d.change == null ? "—" : `${d.change >= 0 ? "+" : ""}${nf(d.change)}`}
          {" ("}
          {d.changePct == null ? "—" : `${d.changePct >= 0 ? "+" : ""}${nf(d.changePct)}%`}
          {")"}
        </span>
      </div>

      {/* Every figure below is recomputed from the newest tick. */}
      <div className="lc-grid">
        <Metric k="Prev close" v={nf(snapshot?.previousClose ?? null)} />
        <Metric k="Session high" v={nf(d.sessionHigh)} />
        <Metric k="Session low" v={nf(d.sessionLow)} />
        <Metric k="Range pos" v={d.rangePosition == null ? "—" : `${(d.rangePosition * 100).toFixed(0)}%`} />
        <Metric k="Session VWAP" v={nf(d.vwap)} />
        <Metric
          k="vs VWAP"
          v={d.vwapPremiumPct == null ? "—" : `${d.vwapPremiumPct >= 0 ? "+" : ""}${nf(d.vwapPremiumPct)}%`}
          tone={d.vwapPremiumPct == null ? "" : d.vwapPremiumPct >= 0 ? "up" : "dn"}
        />
        <Metric k="Volume" v={vol(d.accumulatedVolume)} />
        <Metric k="Ticks seen" v={String(d.tickCount)} />
        <Metric k="Tick rate" v={d.tickRate == null ? "—" : `${d.tickRate.toFixed(2)}/s`} />
        <Metric
          k="Feed lag"
          v={d.feedLagSeconds == null ? "—" : `${Math.floor(d.feedLagSeconds / 60)}m ${d.feedLagSeconds % 60}s`}
          tone="warn"
        />
        <Metric k="Last tick" v={d.ageSeconds == null ? "—" : `${d.ageSeconds}s ago`} tone={stale ? "warn" : ""} />
        <Metric k="Window vol" v={vol(lastTick?.windowVolume ?? null)} />
      </div>

      {d.feedLagSeconds != null && (
        <div className="lc-note">
          <b>Feed lag is the number that matters.</b> Our price describes{" "}
          {new Date(lastTick!.at).toLocaleTimeString()} but arrived at{" "}
          {new Date(lastTick!.receivedAt).toLocaleTimeString()}. That gap is the
          Polygon Stocks Starter plan&apos;s 15-minute delay, not network latency —
          the real-time cluster rejects this key.
        </div>
      )}

      {stale && (
        <div className="lc-note lc-warn">
          No tick for {d.ageSeconds}s. Outside 09:30–16:00 ET the aggregate feed
          goes quiet — an idle stream here means the market is closed, not that
          the pipeline is broken.
        </div>
      )}
    </div>
  );
}

function Metric({ k, v, tone = "" }: { k: string; v: string; tone?: string }) {
  return (
    <div className="lc-m">
      <div className="lc-mk">{k}</div>
      <div className={`lc-mv ${tone}`}>{v}</div>
    </div>
  );
}

// ── Cached-poll panel (the scalable option) ──────────────────────────────────

/**
 * Same data, fetched from the backend's cached snapshot instead of a per-user
 * stream. "Served" vs "304" shows how many polls cost no payload at all — the
 * property that lets one origin response serve every user in the window.
 */
function PollPanel({ ticker }: { ticker: string }) {
  const s = useSnapshotQuote(ticker, 10_000);
  const q = s.quote;
  const up = q?.change != null && q.change >= 0;

  return (
    <div className="lc-body">
      <div className="lc-statusrow">
        <span className={`lc-dot ${s.error ? "off" : "on"}`} />
        <span>{s.error ? `error: ${s.error}` : `polling every 10s · ${s.polls} polls`}</span>
        <span className="lc-badge">cached snapshot · ~15m delayed</span>
      </div>

      <div className="lc-price">
        <span className={`lc-last ${q?.change == null ? "" : up ? "up" : "dn"}`}>
          {q?.price == null ? "—" : nf(q.price)}
        </span>
        <span className={`lc-chg ${q?.change == null ? "" : up ? "up" : "dn"}`}>
          {q?.change == null ? "—" : `${up ? "+" : ""}${nf(q.change)}`}
          {" ("}{q?.changePct == null ? "—" : `${up ? "+" : ""}${nf(q.changePct)}%`}{")"}
        </span>
      </div>

      <div className="lc-grid">
        <Metric k="Prev close" v={nf(q?.previousClose)} />
        <Metric k="Open" v={nf(q?.open)} />
        {/* True session values from the vendor, not accumulated from observed
            ticks the way the streaming panel has to do it. */}
        <Metric k="Day high" v={nf(q?.dayHigh)} />
        <Metric k="Day low" v={nf(q?.dayLow)} />
        <Metric k="Day VWAP" v={nf(q?.dayVwap)} />
        <Metric k="Volume" v={vol(q?.dayVolume ?? null)} />
        <Metric k="Server cache age" v={s.cacheAgeMs == null ? "—" : `${(s.cacheAgeMs / 1000).toFixed(1)}s`} />
        <Metric k="Round trip" v={s.latencyMs == null ? "—" : `${s.latencyMs} ms`} />
        <Metric k="304 (no body)" v={`${s.cacheHits}/${s.polls}`} tone="up" />
        <Metric
          k="Feed lag"
          v={s.feedLagSeconds == null ? "—" : `${Math.floor(s.feedLagSeconds / 60)}m ${s.feedLagSeconds % 60}s`}
          tone="warn"
        />
      </div>

      <div className="lc-note">
        <b>Scales flat.</b> Every user in a 10-second window gets the same
        response, so the backend makes one vendor call regardless of user count
        (measured: 500 requests → 1 upstream call). No per-user connection, no
        socket to pin to one instance. Compare the price against the streaming
        panel — they should agree, because both are ~15 minutes delayed.
      </div>
    </div>
  );
}

// ── Wrapper ──────────────────────────────────────────────────────────────────

/**
 * Polygon reports the ISO 10383 MIC ("XNAS"); TradingView wants its own
 * exchange name ("NASDAQ"). Passing the MIC straight through yields
 * "XNAS:AAPL", which TradingView cannot resolve — it renders an empty widget.
 * Anything not in this map falls back to the bare symbol, which TradingView
 * resolves on its own.
 */
const MIC_TO_TV: Record<string, string> = {
  XNAS: "NASDAQ",
  XNYS: "NYSE",
  BATS: "AMEX",
};

export function LiveCompare({ ticker, exchange }: { ticker: string; exchange?: string | null }) {
  const tvExchange = exchange ? MIC_TO_TV[exchange.toUpperCase()] : undefined;
  const tvSymbol = tvExchange ? `${tvExchange}:${ticker}` : ticker;

  return (
    <div className="lc-wrap">
      <div className="lc-head">
        <h3>Live price: our pipeline vs TradingView — {ticker}</h3>
        <span className="lc-sub">Evaluation surface · not a shipped feature</span>
      </div>

      <div className="lc-cols">
        <section className="lc-col">
          <header className="lc-colh">
            <span className="lc-tag ours">1 · Our pipeline</span>
            <span className="lc-path">Polygon WS → NestJS → SSE → React</span>
          </header>
          <LivePanel ticker={ticker} />
        </section>

        <section className="lc-col">
          <header className="lc-colh">
            <span className="lc-tag poll">2 · Cached poll (scalable)</span>
            <span className="lc-path">Polygon REST → cache → HTTP + ETag → React</span>
          </header>
          <PollPanel ticker={ticker} />
        </section>

        <section className="lc-col">
          <header className="lc-colh">
            <span className="lc-tag tv">3 · TradingView widget</span>
            <span className="lc-path">TradingView&apos;s own data &amp; UI</span>
          </header>
          <div className="lc-body lc-tvbody">
            <TradingViewChart symbol={tvSymbol} />
            <div className="lc-note">
              Data, chart and branding are TradingView&apos;s. It cannot feed your
              screener, alerts or RS-rating — the values are not readable by your
              code. Compare its price against the left panel&apos;s.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
