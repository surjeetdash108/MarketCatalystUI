// Strategy Lab panels maintained by hand (the rest of lab-view.jsx is the
// prototype's generated markup): strategy facts + risk editor, results panel,
// row chart pop-up, single-stock report, edit-rules modal.
import { Fragment } from "react";

const C = {
  bg: "#0d0f10", bg2: "#0b0e10", line: "#1e2427", line2: "#233038", gold: "#c9a24a", goldHi: "#f0d68c", chipBg: "#2e2614", chipFg: "#fbefc9",
  text: "#e6ebe8", hi: "#eef2f4", dim: "#8b9592", mute: "#7a8481", up: "#3ddc84", down: "#f0565a", warn: "#f08a4b",
};
const mono = "'JetBrains Mono',monospace";
const label = { fontSize: 10, fontWeight: 800, letterSpacing: ".12em", color: C.mute, textTransform: "uppercase" };
const btn = (primary, disabled) => ({
  borderRadius: 8, border: `1px solid ${primary ? C.gold : "#5a4a22"}`, background: disabled ? "#1a1d1f" : primary ? C.gold : "transparent",
  color: disabled ? "#5f6966" : primary ? "#08090a" : C.chipFg, padding: "8px 14px", fontWeight: 800, fontSize: 12.5, cursor: disabled ? "not-allowed" : "pointer",
});
const hideImg = (e) => { e.currentTarget.style.display = "none"; };

/** Segmented options: [{l, on, off, onClick, title}]. */
export function Seg({ opts, more, small }) {
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 3, background: "#08090a", border: "1px solid #1a1f21", borderRadius: 9, padding: 3 }}>
      {(opts || []).map((o, i) => (
        <button key={i} type="button" title={o.title || (o.off ? o.offT : undefined)} disabled={!!o.off} onClick={o.off ? undefined : o.onClick} className={o.off || o.on ? undefined : "slx3"}
          style={{ borderRadius: 7, border: 0, background: o.on ? C.chipBg : "transparent", color: o.off ? "#3c4446" : o.on ? C.chipFg : C.dim, padding: small ? "4px 10px" : "5px 11px", fontSize: small ? 11.5 : 12, fontWeight: 700, cursor: o.off ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
          {o.l}
        </button>
      ))}
      {more ? <button type="button" onClick={more.onClick} className="slx3" style={{ borderRadius: 7, border: 0, background: "transparent", color: C.goldHi, padding: "4px 10px", fontSize: 11.5, fontWeight: 800, cursor: "pointer" }}>{more.l}</button> : null}
    </span>
  );
}

/** Exit-plan rows ({t, segs:[{opts}], note}) with the summary and the "more options" toggle. */
export function RiskEditor({ rows, sum, more }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, borderTop: "1px solid #1a2328", paddingTop: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".12em", color: C.goldHi }}>AFTER ENTRY</span>
        <span style={{ fontSize: 11.5, color: C.mute }}>{sum}</span>
        {more ? <button type="button" onClick={more.onClick} className="slx3" style={{ marginLeft: "auto", background: "none", border: 0, padding: 0, color: C.goldHi, fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>{more.l}</button> : null}
      </div>
      <div style={{ display: "flex", gap: "12px 18px", flexWrap: "wrap", alignItems: "center" }}>
        {(rows || []).map((r, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", flexBasis: r.t === "STOP" || r.t === "TARGET" ? "100%" : "auto" }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".1em", color: C.mute, minWidth: 64 }}>{r.t}</span>
            {(r.segs || []).map((sg, j) => <Seg key={j} opts={sg.opts} />)}
            {r.note ? <span style={{ fontSize: 11, color: "#5f6966" }}>{r.note}</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/** "Not translated" / "Needs …" notes under the rules. */
function RuleNotes({ f }) {
  return (
    <Fragment>
      {f.needs ? <div style={{ fontSize: 12.5, color: C.warn }}>{f.needs}</div> : null}
      {f.unparsed ? (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", border: "1px solid #6b3a1c", borderRadius: 8, padding: "8px 10px", background: "#1d130b" }}>
          <span style={{ fontSize: 12.5, color: "#f7c9a8" }}>{f.unparsed}</span>
          {f.onDismiss ? <button type="button" onClick={f.onDismiss} style={btn(false)}>Dismiss</button> : null}
          {f.onEdit ? <button type="button" onClick={f.onEdit} style={btn(false)}>Edit rules</button> : null}
        </div>
      ) : null}
    </Fragment>
  );
}

const rowLabel = { fontSize: 10.5, fontWeight: 700, letterSpacing: ".1em", color: C.mute, minWidth: 118 };
const boxLabel = { color: "#5f6966", fontWeight: 700, fontSize: 10.5, letterSpacing: ".08em", paddingTop: 2 };

/** Library detail: candle and period on the left, the rules in plain English on the right. */
export function DetailFacts({ f }) {
  if (!f) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: "0 1 auto", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={rowLabel}>CANDLE</span><Seg opts={f.candleOpts} />
            {f.candleNote ? <span style={{ fontSize: 11, color: "#5f6966" }}>{f.candleNote}</span> : null}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={rowLabel}>BACKTEST PERIOD</span><Seg opts={f.periodOpts} more={f.periodMore} />
          </div>
        </div>
        <div style={{ flex: "1 1 260px", minWidth: 0, display: "grid", gridTemplateColumns: "62px minmax(0,1fr)", gap: "8px 12px", fontSize: 13, border: "1px solid #1a1f21", background: "#0b0d0e", borderRadius: 10, padding: "12px 14px", alignContent: "start" }}>
          <span style={boxLabel}>ENTRY</span><span style={{ color: C.text }} title={f.entry}>{f.entryText}</span>
          <span style={boxLabel}>EXIT</span><span style={{ color: C.text }} title={f.exit}>{f.exitText}</span>
          <span style={boxLabel} title="Exit plan and trading costs used by the backtest — change them with Edit">RISK</span><span style={{ color: C.dim }}>{f.riskLine}</span>
          {f.src ? <Fragment><span style={boxLabel}>SOURCE</span><span style={{ color: C.dim }}>{f.src}</span></Fragment> : null}
        </div>
      </div>
      <RuleNotes f={f} />
    </div>
  );
}

/** AI result: Entry · Exit · Risk · Candle · Period, as in the prototype. */
export function AiFacts({ f }) {
  if (!f) return null;
  const k = (t, pt = 2) => <span style={{ ...boxLabel, paddingTop: pt }}>{t}</span>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "96px minmax(0,1fr)", gap: "8px 12px", fontSize: 13, border: "1px solid #1a1f21", borderRadius: 10, padding: "12px 14px" }}>
        {k("ENTRY")}<span style={{ fontFamily: mono, color: C.text }}>{f.entry}</span>
        {k("EXIT")}<span style={{ fontFamily: mono, color: C.text }}>{f.exit}</span>
        {k("RISK")}<span style={{ fontFamily: mono, color: C.text }}>{f.riskLine}</span>
        {k("CANDLE", 7)}<span style={{ justifySelf: "start", display: "flex", flexDirection: "column", gap: 4 }}><Seg opts={f.candleOpts} small />{f.candleNote ? <span style={{ fontSize: 11, color: "#5f6966" }}>{f.candleNote}</span> : null}</span>
        {k("PERIOD", 7)}<span style={{ justifySelf: "start" }}><Seg opts={f.periodOpts} more={f.periodMore} small /></span>
      </div>
      <RuleNotes f={f} />
    </div>
  );
}

/** Multi-stock results: "meet the rules now" summary, return window, table. */
export function ResultsPanel({ r, title = "BACKTEST RESULTS", boxed = false }) {
  if (!r || !r.show) return null;
  const grid = "minmax(0,1.5fr) minmax(0,1.1fr) repeat(4,minmax(0,1fr))";
  const hdr = { fontSize: 9.5, fontWeight: 700, letterSpacing: ".08em", color: "#5f6966", cursor: "help", whiteSpace: "nowrap" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0, ...(boxed ? { border: "1px solid #2a2618", background: "#0b0c0d", borderRadius: 12, padding: "16px 18px" } : {}) }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".12em", color: C.mute }}>{title}</span>
        <span style={{ fontFamily: "'Barlow Condensed',Manrope,sans-serif", fontWeight: 600, fontSize: 20, color: C.hi }}>{r.head}</span>
        {r.meta ? <span style={{ fontSize: 11.5, color: "#5f6966", marginLeft: "auto" }}>{r.meta}</span> : null}
      </div>
      {r.busy ? <div style={{ height: 3, background: "#15191b", borderRadius: 2, overflow: "hidden" }}><div style={{ height: 3, width: r.progressPct, background: C.gold, transition: "width .2s" }} /></div> : null}
      {r.err ? <div style={{ fontSize: 13, color: C.warn }}>{r.err}</div> : null}
      {r.stale ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: C.warn }}>
          Rules changed since this run.
          <button type="button" onClick={r.onRerun} style={{ borderRadius: 8, border: "1px solid #6b3a1c", background: "transparent", color: "#f7c9a8", padding: "4px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Re-run</button>
        </div>
      ) : null}
      {r.idle ? <div title={r.idleTitle} style={{ fontSize: 13, color: C.dim, lineHeight: 1.55, border: "1px dashed #263033", borderRadius: 10, padding: 16 }}>{r.idleT}</div> : null}
      {r.sum && r.sum.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(96px,1fr))", gap: 1, background: "#1a1f21", border: "1px solid #1a1f21", borderRadius: 10, overflow: "hidden" }}>
            {r.sum.map((s) => (
              <div key={s.k} title={s.title} style={{ background: C.bg, padding: "9px 11px", cursor: "help" }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".08em", color: "#5f6966" }}>{s.k}</div>
                <div style={{ fontFamily: mono, fontSize: 15, color: s.c || C.text, marginTop: 2 }}>{s.v}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "#5f6966", display: "flex", alignItems: "center", gap: 6 }}>
            {r.soFar ? <span title="The scan is still running; the tiles update as stocks finish" style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: ".08em", color: C.goldHi, border: "1px solid #5a4a22", borderRadius: 999, padding: "1px 7px" }}>SO FAR</span> : null}
            {r.sumNote}
          </div>
        </div>
      ) : null}
      {r.none ? <div style={{ fontSize: 13, color: C.dim, border: "1px dashed #263033", borderRadius: 10, padding: 16 }}>{r.none}</div> : null}
      {r.hasWin && r.rows && r.rows.length ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".1em", color: C.mute }}>RETURN OVER</span>
          <Seg opts={r.winOpts} more={r.winMore} small />
          <span style={{ fontSize: 11, color: "#5f6966" }}>{r.winNote}</span>
        </div>
      ) : null}
      {r.rows && r.rows.length ? (
        <div style={{ display: "flex", flexDirection: "column", maxHeight: 300, overflowY: "auto", overflowX: "hidden", scrollbarWidth: "thin" }}>
          <div style={{ display: "grid", gridTemplateColumns: grid, gap: 6, padding: "0 8px 6px", position: "sticky", top: 0, background: boxed ? "#0b0c0d" : C.bg, zIndex: 1 }}>
            {r.cols.map((c, i) => <span key={c.l} title={c.title} style={{ ...hdr, textAlign: i === 0 ? "left" : i === 2 || i === 5 ? "center" : "right" }}>{c.l}</span>)}
          </div>
          {r.rows.map((x) => (
            <button key={x.t} type="button" onClick={x.onClick} title={`Open the ${x.t} chart`} className="slx7"
              style={{ display: "grid", gridTemplateColumns: grid, gap: 6, alignItems: "center", background: "transparent", border: 0, borderTop: "1px solid #15191b", borderRadius: 8, padding: 8, color: C.text, cursor: "pointer", textAlign: "left" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ position: "relative", width: 24, height: 24, flex: "none", borderRadius: 6, background: "#1a1f21", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 800, color: C.goldHi, overflow: "hidden" }}>
                  {x.t.slice(0, 4)}
                  <img src={x.logo} onError={hideImg} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", background: "#fff", padding: 2 }} />
                </span>
                <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                  <span style={{ fontWeight: 800, fontSize: 12.5 }}>{x.t}</span>
                  <span style={{ fontSize: 10.5, color: C.mute, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.n}</span>
                </span>
              </span>
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
                <span style={{ fontFamily: mono, fontSize: 12, color: C.hi }}>{x.px}</span>
                <span style={{ fontFamily: mono, fontSize: 10.5, color: x.chgC }}>{x.chg}</span>
              </span>
              <span style={{ fontFamily: mono, fontSize: 12, textAlign: "center", color: x.retC }}>{x.ret}</span>
              <span style={{ fontFamily: mono, fontSize: 12, textAlign: "right", color: x.exC }}>{x.ex}</span>
              <span style={{ fontFamily: mono, fontSize: 12, textAlign: "right" }}>{x.win}</span>
              <span style={{ fontFamily: mono, fontSize: 12, textAlign: "center", color: "#aab3b0" }}>{x.tr}</span>
            </button>
          ))}
          {r.more ? (
            <button type="button" onClick={r.more.onClick} className="slx7" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "transparent", border: 0, borderTop: "1px solid #15191b", borderRadius: 8, padding: 10, color: C.goldHi, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
              {r.more.l}
            </button>
          ) : null}
          {r.less ? (
            <button type="button" onClick={r.less.onClick} style={{ alignSelf: "center", background: "none", border: 0, borderTop: "1px solid #15191b", padding: "8px 0 2px", color: C.goldHi, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              {r.less.l}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Row pop-up: price over the return window, trades, and levels if entered at the last price. */
export function ChartModal({ c }) {
  if (!c || !c.open) return null;
  const cols = "36px minmax(0,1fr) minmax(0,1.3fr) repeat(3,minmax(0,.8fr))";
  return (
    <div onClick={c.close} style={{ position: "fixed", inset: 0, background: "rgba(4,5,6,.74)", backdropFilter: "blur(3px)", zIndex: 85, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "6vh 16px", overflowY: "auto" }}>
      <div onClick={c.stop} style={{ width: "100%", maxWidth: 1000, background: C.bg, border: "1px solid #2a2618", borderRadius: 14, boxShadow: "0 30px 80px rgba(0,0,0,.6),0 0 0 1px rgba(201,162,74,.12)", padding: "22px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "'Barlow Condensed',Manrope,sans-serif", fontWeight: 600, fontSize: 28, color: C.hi }}>{c.t}</span>
          <span style={{ fontSize: 13, color: C.dim }}>{c.n}</span>
          <span style={{ fontSize: 11.5, color: "#5f6966" }}>{c.sub}</span>
          <span style={{ marginLeft: "auto" }} />
          <button type="button" onClick={c.onReport} style={btn(false)}>Full report →</button>
          <button type="button" onClick={c.close} title="Close" style={{ borderRadius: 8, background: "none", border: `1px solid ${C.line2}`, color: "#aab3b0", width: 30, height: 30, cursor: "pointer", fontSize: 16 }}>×</button>
        </div>
        {c.busy ? <div style={{ fontSize: 13, color: C.dim }}>{c.busy}</div> : null}
        {c.err ? <div style={{ fontSize: 13, color: C.down }}>{c.err}</div> : null}
        {c.has ? (
          <Fragment>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 1, background: "#1a1f21", border: "1px solid #1a1f21", borderRadius: 10, overflow: "hidden" }}>
              {c.stats.map((f) => (
                <div key={f.k} title={f.title} style={{ background: C.bg, padding: "9px 12px", cursor: "help" }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".08em", color: "#5f6966" }}>{f.k}</div>
                  <div style={{ fontFamily: mono, fontSize: 16, color: f.c, marginTop: 2 }}>{f.v}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", color: C.goldHi }}>PRICE LEVELS · IF ENTERED AT LAST PRICE</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {c.levels.map((f) => (
                  <div key={f.k} title={f.title} style={{ border: "1px solid #1a1f21", borderRadius: 8, padding: "6px 10px", display: "flex", flexDirection: "column", gap: 1 }}>
                    <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".06em", color: "#5f6966", whiteSpace: "nowrap" }}>{f.k}</span>
                    <span style={{ fontFamily: mono, fontSize: 13, color: f.c }}>{f.v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 11.5, color: C.dim, flexWrap: "wrap" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: "rgba(61,220,132,.25)", border: "1px solid rgba(61,220,132,.6)" }} />Winning trade</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: "rgba(240,86,90,.25)", border: "1px solid rgba(240,86,90,.6)" }} />Losing trade</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderBottom: `8px solid ${C.goldHi}` }} />Entry</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: "50%", border: `2px solid ${C.hi}` }} />Exit</span>
              {c.winX ? <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, borderTop: "1px dashed #8b9592" }} />Window start — returns above are measured from here</span> : null}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 56px", gap: 8 }}>
              <div style={{ position: "relative", height: 320, border: "1px solid #1a1f21", borderRadius: 10, background: "#0b0d0e", overflow: "hidden" }}>
                <svg viewBox="0 0 1000 300" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
                  {c.trades.map((t) => <rect key={t.n} x={t.x} y="0" width={t.w} height="300" fill={t.fill} stroke={t.stroke} strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
                  <path d={c.area} fill="rgba(201,162,74,.06)" />
                  <path d={c.line} fill="none" stroke={C.goldHi} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
                  {c.winX ? <line x1={c.winX} x2={c.winX} y1="0" y2="300" stroke="#8b9592" strokeDasharray="4 4" strokeWidth="1" vectorEffect="non-scaling-stroke" /> : null}
                </svg>
                {c.winL ? <span title={c.winT} style={{ position: "absolute", left: c.winL, bottom: 6, transform: "translateX(4px)", fontFamily: mono, fontSize: 10, color: C.dim, background: "rgba(11,13,14,.85)", padding: "1px 5px", borderRadius: 4, whiteSpace: "nowrap", cursor: "help" }}>window start</span> : null}
                {c.trades.map((t) => (
                  <Fragment key={t.n}>
                    <span title={`Entry ${t.inD} @ ${t.inPx}`} style={{ position: "absolute", left: t.inL, top: t.inT, transform: "translate(-50%,2px)", width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderBottom: `10px solid ${C.goldHi}`, filter: "drop-shadow(0 0 4px rgba(240,214,140,.6))" }} />
                    {t.open ? null : <span title={`Exit ${t.outD} @ ${t.outPx}`} style={{ position: "absolute", left: t.outL, top: t.outT, transform: "translate(-50%,-50%)", width: 9, height: 9, borderRadius: "50%", background: "#0b0d0e", border: `2px solid ${C.hi}` }} />}
                    <span style={{ position: "absolute", left: t.lblL, top: 8, transform: "translateX(-50%)", fontFamily: mono, fontSize: 10.5, fontWeight: 700, color: t.c, background: "rgba(11,13,14,.85)", padding: "1px 5px", borderRadius: 4, whiteSpace: "nowrap" }}>{t.ret}</span>
                  </Fragment>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", fontFamily: mono, fontSize: 10.5, color: C.mute, padding: "4px 0" }}><span>{c.hi}</span><span>{c.lo}</span></div>
              <div style={{ gridColumn: 1, display: "flex", justifyContent: "space-between", fontFamily: mono, fontSize: 10.5, color: C.mute, marginTop: -2 }}><span>{c.d0}</span><span>{c.d1}</span></div>
            </div>
            {c.tradeNote ? <div style={{ fontSize: 12.5, color: C.mute }}>{c.tradeNote}</div> : (
              <div style={{ display: "flex", flexDirection: "column", maxHeight: 220, overflowY: "auto", overflowX: "hidden", scrollbarWidth: "thin" }}>
                <div style={{ display: "grid", gridTemplateColumns: cols, gap: 8, padding: "0 8px 6px", fontSize: 9.5, fontWeight: 700, letterSpacing: ".08em", color: "#5f6966", position: "sticky", top: 0, background: C.bg }}>
                  <span>#</span><span>ENTRY</span><span>EXIT</span><span style={{ textAlign: "right" }}>IN</span><span style={{ textAlign: "right" }}>OUT</span><span style={{ textAlign: "right" }}>RETURN</span>
                </div>
                {c.trades.map((t) => (
                  <div key={t.n} style={{ display: "grid", gridTemplateColumns: cols, gap: 8, padding: 8, borderTop: "1px solid #15191b", fontSize: 12.5, color: C.text, alignItems: "center" }}>
                    <span style={{ fontFamily: mono, color: C.mute }}>{t.n}</span>
                    <span>{t.inD}</span>
                    <span title={t.why}>{t.outD} <span style={{ color: "#5f6966" }}>· {t.days} bars</span></span>
                    <span style={{ fontFamily: mono, textAlign: "right" }}>{t.inPx}</span>
                    <span style={{ fontFamily: mono, textAlign: "right" }}>{t.outPx}</span>
                    <span style={{ fontFamily: mono, textAlign: "right", color: t.c, fontWeight: 700 }}>{t.ret}</span>
                  </div>
                ))}
              </div>
            )}
          </Fragment>
        ) : null}
      </div>
    </div>
  );
}

function ChartPanel({ ch }) {
  if (!ch) return null;
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: "12px 14px", background: C.bg2 }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <span style={label}>Price chart · trades</span>
        <span style={{ fontSize: 11.5, color: C.mute }}>{ch.sub}</span>
      </div>
      <div style={{ position: "relative", marginTop: 8 }}>
        <svg viewBox="0 0 1000 300" preserveAspectRatio="none" style={{ width: "100%", height: 260, display: "block" }}>
          {ch.trades.map((t, i) => <rect key={i} x={t.x} y="0" width={t.w} height="300" fill={t.fill} stroke={t.stroke} strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
          {ch.levels.map((l, i) => <line key={"l" + i} x1={l.x1} x2={l.x2} y1={l.y} y2={l.y} stroke={l.c} strokeDasharray="4 3" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
          <path d={ch.area} fill="rgba(201,162,74,.06)" />
          <path d={ch.line} fill="none" stroke={C.goldHi} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
        </svg>
        <span style={{ position: "absolute", right: 4, top: 2, fontFamily: mono, fontSize: 10.5, color: C.mute }}>{ch.hi}</span>
        <span style={{ position: "absolute", right: 4, bottom: 2, fontFamily: mono, fontSize: 10.5, color: C.mute }}>{ch.lo}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: mono, fontSize: 10.5, color: C.mute }}><span>{ch.d0}</span><span>{ch.legend}</span><span>{ch.d1}</span></div>
    </div>
  );
}

const card = { border: `1px solid ${C.line}`, borderRadius: 10, padding: "12px 14px", background: C.bg2, display: "flex", flexDirection: "column", gap: 8 };
const th = (al = "right") => ({ ...label, textAlign: al, padding: "5px 8px", borderBottom: `1px solid ${C.line}`, whiteSpace: "nowrap" });
const td = (al = "right", c = C.text) => ({ padding: "6px 8px", textAlign: al, fontFamily: mono, fontSize: 12, color: c, whiteSpace: "nowrap" });

/** Single-stock report (step 3). */
export function Report({ p }) {
  if (!p || !p.show) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: "'Barlow Condensed',Manrope,sans-serif", fontWeight: 600, fontSize: 28, color: C.hi }}>{p.title}</div>
          <div style={{ fontSize: 12.5, color: C.dim }}>{p.sub}</div>
          <div style={{ fontFamily: mono, fontSize: 11.5, color: C.mute }}>{p.meta}</div>
        </div>
        <button type="button" onClick={p.onEdit} style={btn(false)}>Edit rules &amp; settings</button>
        <button type="button" onClick={p.onMatches} style={btn(true)}>See today&apos;s matches →</button>
      </div>
      {p.busy ? <div style={{ fontSize: 13, color: C.mute }}>{p.busy}</div> : null}
      {p.err ? <div style={{ fontSize: 13, color: C.down, border: "1px solid #5a2224", borderRadius: 8, padding: "8px 10px", background: "#1a0e0f" }}>{p.err}</div> : null}
      {p.settings ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {p.settings.map(([k, v]) => <span key={k} style={{ fontSize: 11.5, color: C.dim, border: `1px solid ${C.line2}`, borderRadius: 999, padding: "3px 10px" }}><b style={{ color: C.text }}>{k}</b> {v}</span>)}
        </div>
      ) : null}
      {p.has ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 8 }}>
            {p.metrics.map((m, i) => (
              <div key={i} style={{ border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 11px", background: C.bg2 }}>
                <div style={label}>{m.l}</div>
                <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, color: m.c || C.text, marginTop: 3 }}>{m.v}</div>
                <div style={{ fontSize: 11, color: C.mute, marginTop: 2 }}>{m.s}</div>
              </div>
            ))}
          </div>
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <span style={label}>Growth of $10,000</span>
              <span style={{ fontFamily: mono, fontSize: 12 }}><span style={{ color: C.goldHi }}>Strategy {p.growth.endS}</span> · <span style={{ color: C.dim }}>{p.growth.bench} {p.growth.endB}</span></span>
            </div>
            <svg viewBox="0 0 600 200" preserveAspectRatio="none" style={{ width: "100%", height: 200, display: "block" }}>
              <path d="M0,50H600M0,100H600M0,150H600" stroke="#151c20" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <path d={p.growth.areaS} fill="rgba(201,162,74,.12)" />
              <path d={p.growth.lineB} fill="none" stroke="#5d6764" strokeWidth="1.6" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
              <path d={p.growth.lineS} fill="none" stroke={C.goldHi} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </svg>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: mono, fontSize: 10.5, color: C.mute }}>{p.growth.axis.map((a) => <span key={a}>{a}</span>)}</div>
          </div>
          <ChartPanel ch={p.chart} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))", gap: 12 }}>
            <div style={card}>
              <span style={label}>{p.years.title}</span>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={th("left")}>Period</th><th style={th()}>Strategy</th><th style={th()}>Buy &amp; hold</th><th style={th()}>Excess</th></tr></thead>
                <tbody>{p.years.rows.map((y, i) => <tr key={i}><td style={td("left")}>{y.y}</td><td style={td("right", y.sc)}>{y.s}</td><td style={td("right", y.bc)}>{y.b}</td><td style={td("right", y.ec)}>{y.e}</td></tr>)}</tbody>
              </table>
              <span style={{ fontSize: 11, color: C.mute }}>{p.years.note}</span>
            </div>
            <div style={card}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={label}>Trade log</span><span style={{ fontSize: 11, color: C.mute }}>{p.trades.cnt}</span></div>
              <div style={{ overflowX: "auto", maxHeight: 360, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>{["Entry", "Price", "Exit", "Price", "Return", "Bars", "Reason"].map((h, i) => <th key={i} style={th(i === 0 || i === 2 || i === 6 ? "left" : "right")}>{h}</th>)}</tr></thead>
                  <tbody>{p.trades.rows.map((t, i) => <tr key={i}><td style={td("left")}>{t.inD}</td><td style={td()}>{t.inP}</td><td style={td("left")}>{t.outD}</td><td style={td()}>{t.outP}</td><td style={td("right", t.rc)}>{t.r}</td><td style={td()}>{t.d}</td><td style={td("left", C.dim)}>{t.why}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
          </div>
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <span style={label}>Variance test · Sharpe by stop × target</span>
              {!p.vari.rows ? <button type="button" onClick={p.vari.run} style={btn(false)}>Run variance test</button> : <span style={{ fontSize: 11, color: C.mute }}>Click a cell to apply its stop and target</span>}
            </div>
            {p.vari.rows ? (
              <table style={{ borderCollapse: "separate", borderSpacing: 4 }}>
                <thead><tr><th style={th("left")} />{p.vari.head.map((h) => <th key={h} style={th("center")}>{h}</th>)}</tr></thead>
                <tbody>{p.vari.rows.map((r) => <tr key={r.sl}><td style={td("left", C.dim)}>Stop {r.sl}</td>{r.cells.map((x, i) => <td key={i}><button type="button" onClick={x.onClick} style={{ width: "100%", borderRadius: 7, border: `1px solid ${x.bd}`, background: x.bg, color: C.text, padding: "6px 4px", fontFamily: mono, fontSize: 12, cursor: "pointer" }}>{x.sh}<div style={{ fontSize: 10, color: C.dim }}>{x.cg}</div></button></td>)}</tr>)}</tbody>
              </table>
            ) : null}
          </div>
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <span style={label}>Compare strategies on {p.t} · same candle, period and settings</span>
              {!p.cmp.rows ? <button type="button" onClick={p.cmp.run} style={btn(false)}>Compare all strategies</button> : null}
            </div>
            {p.cmp.busy ? <span style={{ fontSize: 12, color: C.mute }}>{p.cmp.busy}</span> : null}
            {p.cmp.rows ? (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>{p.cmp.head.map((h) => <th key={h.k} onClick={h.onClick} style={{ ...th(h.al), cursor: "pointer", color: h.on ? C.goldHi : C.mute }}>{h.l}</th>)}</tr></thead>
                  <tbody>{p.cmp.rows.map((r, i) => <tr key={i} onClick={r.onClick} style={{ cursor: "pointer", background: r.bg }}><td style={td("left", r.nc)}>{r.name}</td><td style={td()}>{r.ret}</td><td style={td()}>{r.sh}</td><td style={td()}>{r.so}</td><td style={td()}>{r.dd}</td><td style={td()}>{r.win}</td><td style={td()}>{r.tr}</td></tr>)}</tbody>
                </table>
                {p.cmp.note ? <div style={{ fontSize: 11, color: C.mute, marginTop: 6 }}>{p.cmp.note}</div> : null}
              </div>
            ) : null}
          </div>
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <span style={label}>Evidence · {p.ev.summary}</span>
              <span style={{ display: "flex", gap: 8, alignItems: "center" }}><span style={{ fontFamily: mono, fontSize: 10.5, color: C.mute }}>{p.ev.id}</span><button type="button" onClick={p.ev.onExport} style={btn(false)}>Export JSON</button></span>
            </div>
            <div style={{ fontSize: 12, color: p.ev.covC }}>Coverage {p.ev.cov} · <span style={{ color: C.dim }}>{p.ev.covD}</span></div>
            {p.ev.claims.map((c, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "110px minmax(0,1fr)", gap: 10, alignItems: "start" }}>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".08em", padding: "3px 7px", justifySelf: "start", border: `1px solid ${c.bd}`, color: c.col, borderRadius: 5 }}>{c.status}</span>
                <span style={{ fontSize: 12.5, color: C.text }}>{c.text}<div style={{ fontSize: 11.5, color: C.mute }}>{c.ev}</div></span>
              </div>
            ))}
            <span style={{ ...label, marginTop: 4 }}>Limitations</span>
            {p.ev.lims.map((u, i) => <span key={i} style={{ fontSize: 12, color: C.dim }}>+ {u}</span>)}
            <span style={{ ...label, marginTop: 4 }}>Open unknowns</span>
            {p.ev.unk.map((u, i) => <span key={i} style={{ fontSize: 12, color: C.dim }}>? {u.q} — {u.status}</span>)}
          </div>
        </>
      ) : null}
    </div>
  );
}

/** One condition row (also used for OR-group members). */
function CondRow({ c }) {
  const sel = { background: "#08090a", border: `1px solid ${C.line2}`, color: C.text, borderRadius: 6, padding: "5px 6px", fontSize: 12 };
  const inp = { ...sel, width: 64 };
  const tip = (t) => (
    <span style={{ position: "relative" }}>
      <span role="button" tabIndex={0} onMouseEnter={t.on} onMouseLeave={t.off} onFocus={t.on} onBlur={t.off} style={{ display: "inline-grid", placeItems: "center", width: 15, height: 15, borderRadius: 999, border: `1px solid ${C.line2}`, color: C.mute, fontSize: 9, cursor: "help" }}>i</span>
      {t.open ? <span style={{ position: "absolute", zIndex: 20, top: 20, left: -10, width: 260, background: "#12171a", border: `1px solid ${C.line2}`, borderRadius: 8, padding: "8px 10px", fontSize: 11.5, color: C.text }}>{t.txt}</span> : null}
    </span>
  );
  const side = (s) => (
    <>
      <select value={s.ind} onChange={s.onInd} style={sel}>{c.indOpts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select>
      {tip(s.tip)}
      {s.look ? <select value={s.n} onChange={s.onN} title="Lookback" style={sel}>{s.lookOpts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select> : null}
      {s.hasN ? <input type="number" min="1" max={c.maxN} value={s.n} onChange={s.onN} title="Period" style={inp} /> : null}
      {s.isNum ? <input type="number" step="any" value={s.v} onChange={s.onV} title="Value" style={inp} /> : null}
    </>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <span style={{ ...label, width: 52 }}>{c.join}</span>
      {side(c.a)}
      <select value={c.op} onChange={c.onOp} style={sel}>{c.opOpts.map((o) => <option key={o} value={o}>{o}</option>)}</select>
      {tip(c.oTip)}
      {c.b.hasMult ? <><input type="number" step="0.1" value={c.b.mult} onChange={c.b.onMult} title="Multiplier" style={{ ...inp, width: 54 }} /><span style={{ color: C.mute }}>×</span></> : null}
      {side(c.b)}
      {c.warn ? <span style={{ fontSize: 10, fontWeight: 800, color: C.warn }}>NEEDS DATA</span> : null}
      {c.capMsg ? <span style={{ fontSize: 11, color: C.warn }}>{c.capMsg}</span> : null}
      {c.onOr ? <button type="button" onClick={c.onOr} title="Add an OR alternative" style={{ ...btn(false), padding: "4px 8px", fontSize: 11 }}>+ OR</button> : null}
      <button type="button" onClick={c.onDel} title="Remove condition" style={{ background: "none", border: 0, color: C.mute, cursor: "pointer", fontSize: 15 }}>×</button>
    </div>
  );
}

function RuleList({ rows, onAdd }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.map((r, i) => r.group ? (
        <div key={i} style={{ border: `1px dashed ${C.line2}`, borderRadius: 8, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span style={label}>{r.join} · any one of</span><button type="button" onClick={r.onDelGroup} style={{ background: "none", border: 0, color: C.mute, cursor: "pointer" }}>Remove group ×</button></div>
          {r.subs.map((s, j) => <CondRow key={j} c={s} />)}
          <button type="button" onClick={r.onAddOr} style={{ ...btn(false), alignSelf: "flex-start", padding: "4px 8px", fontSize: 11 }}>+ OR condition</button>
        </div>
      ) : <CondRow key={i} c={r} />)}
      <button type="button" onClick={onAdd} style={{ ...btn(false), alignSelf: "flex-start" }}>+ Add condition</button>
    </div>
  );
}

/** Edit rules & settings (replaces the old step-2 setup screen). */
export function EditModal({ e }) {
  if (!e || !e.open) return null;
  return (
    <div onClick={e.close} style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(4,5,6,.72)", display: "flex", justifyContent: "center", alignItems: "flex-start", overflowY: "auto", padding: "40px 16px" }}>
      <div onClick={(x) => x.stopPropagation()} style={{ width: "min(980px,100%)", background: C.bg, border: `1px solid #2a2618`, borderRadius: 14, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".12em", color: C.goldHi }}>EDIT RULES</span>
          <span style={{ fontFamily: "'Barlow Condensed',Manrope,sans-serif", fontWeight: 600, fontSize: 24, color: C.hi }}>{e.title}</span>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={e.cancel} title="Close without saving" style={{ background: "none", border: 0, color: C.mute, fontSize: 18, cursor: "pointer" }}>×</button>
        </div>
        {e.nameEditable ? (
          <label style={{ display: "flex", gap: 10, alignItems: "center" }}><span style={label}>Name</span><input value={e.name} onChange={e.onName} style={{ flex: 1, background: "#08090a", border: `1px solid ${C.line2}`, color: C.text, borderRadius: 6, padding: "6px 8px" }} /></label>
        ) : null}
        <span style={label}>Entry — all must be true</span>
        <RuleList rows={e.entry} onAdd={e.addEntry} />
        <span style={label}>Exit — any one triggers</span>
        <RuleList rows={e.exit} onAdd={e.addExit} />
        <RiskEditor rows={e.riskRows} sum={e.riskSum} more={e.more} />
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <span style={{ display: "flex", gap: 8, alignItems: "center" }}><span style={label}>Costs</span><Seg opts={e.costOpts} /></span>
          <span style={{ display: "flex", gap: 8, alignItems: "center" }}><span style={label}>Candle</span><Seg opts={e.candleOpts} /></span>
          <span style={{ display: "flex", gap: 8, alignItems: "center" }}><span style={label}>Period</span><Seg opts={e.periodOpts} more={e.periodMore} /></span>
        </div>
        {e.needs ? <div style={{ fontSize: 12.5, color: C.warn }}>{e.needs}</div> : null}
        <div style={{ fontSize: 11.5, color: C.mute }}>Signals use the close of bar t; fills at the open of bar t+1. Long-only, fully invested per signal. The engine runs exactly the conditions shown.</div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
          {e.reset ? <button type="button" onClick={e.reset} style={btn(false)}>Reset to original rules</button> : null}
          <span style={{ flex: 1 }} />
          <button type="button" onClick={e.cancel} style={btn(false)}>Cancel</button>
          <button type="button" onClick={e.done} style={btn(false)}>{e.doneL}</button>
          <button type="button" onClick={e.run} disabled={e.runDisabled} style={btn(true, e.runDisabled)}>{e.runL}</button>
        </div>
      </div>
    </div>
  );
}
