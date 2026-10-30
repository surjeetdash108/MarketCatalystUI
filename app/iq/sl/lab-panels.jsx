// Strategy Lab panels maintained by hand (the rest of lab-view.jsx is the
// prototype's generated markup): strategy facts + risk editor, results panel,
// single-stock report, edit-rules modal.
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
export function Seg({ opts }) {
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 4 }}>
      {(opts || []).map((o, i) => (
        <button key={i} type="button" title={o.title || (o.off ? o.offT : undefined)} disabled={!!o.off} onClick={o.off ? undefined : o.onClick}
          style={{ borderRadius: 6, border: `1px solid ${o.on ? "#5a4a22" : C.line2}`, background: o.on ? C.chipBg : "transparent", color: o.off ? "#3c4446" : o.on ? C.chipFg : C.dim, padding: "4px 9px", fontSize: 11.5, fontWeight: 700, cursor: o.off ? "not-allowed" : "pointer" }}>
          {o.l}
        </button>
      ))}
    </span>
  );
}

/** Exit-plan rows ({t, segs:[{opts}], note}) with the summary and the "more options" toggle. */
export function RiskEditor({ rows, sum, more }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 12.5, color: C.text }}>{sum}</div>
      {(rows || []).map((r, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ ...label, width: 86 }}>{r.t}</span>
          {(r.segs || []).map((s, j) => <Seg key={j} opts={s.opts} />)}
          {r.note ? <span style={{ fontSize: 11, color: C.mute }}>{r.note}</span> : null}
        </div>
      ))}
      {more ? (
        <button type="button" onClick={more.onClick} style={{ alignSelf: "flex-start", background: "none", border: 0, color: C.goldHi, fontSize: 11.5, fontWeight: 700, cursor: "pointer", padding: 0 }}>
          {more.l}
        </button>
      ) : null}
    </div>
  );
}

/** Entry · Exit · Risk (editable) · Candle · Period, plus "Not translated". */
export function FactsBlock({ f }) {
  if (!f) return null;
  const row = (k, v) => (
    <div style={{ display: "grid", gridTemplateColumns: "92px minmax(0,1fr)", gap: 10, alignItems: "start" }}>
      <span style={{ ...label, paddingTop: 3 }}>{k}</span>
      <div style={{ minWidth: 0 }}>{v}</div>
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, border: `1px solid ${C.line}`, borderRadius: 10, padding: "12px 14px", background: C.bg2 }}>
      {row("Entry", <span style={{ fontFamily: mono, fontSize: 12.5, color: C.hi }}>{f.entry}</span>)}
      {row("Exit", <span style={{ fontFamily: mono, fontSize: 12.5, color: C.hi }}>{f.exit}</span>)}
      {row("Risk", <RiskEditor rows={f.riskRows} sum={f.riskSum} more={f.more} />)}
      {row("Costs", <Seg opts={f.costOpts} />)}
      {row("Candle", <span style={{ display: "flex", flexDirection: "column", gap: 4 }}><Seg opts={f.candleOpts} />{f.candleNote ? <span style={{ fontSize: 11, color: C.mute }}>{f.candleNote}</span> : null}</span>)}
      {row("Period", <Seg opts={f.periodOpts} />)}
      {f.src ? row("Source", <span style={{ fontSize: 12, color: C.dim }}>{f.src}</span>) : null}
      {f.needs ? <div style={{ fontSize: 12.5, color: C.warn }}>{f.needs}</div> : null}
      {f.unparsed ? (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", border: "1px solid #6b3a1c", borderRadius: 8, padding: "8px 10px", background: "#1d130b" }}>
          <span style={{ fontSize: 12.5, color: "#f7c9a8" }}>{f.unparsed}</span>
          {f.onDismiss ? <button type="button" onClick={f.onDismiss} style={btn(false)}>Dismiss</button> : null}
          {f.onEdit ? <button type="button" onClick={f.onEdit} style={btn(false)}>Edit rules</button> : null}
        </div>
      ) : null}
    </div>
  );
}

/** Multi-stock results: summary over every tested stock + sortable table. */
export function ResultsPanel({ r }) {
  if (!r || !r.show) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, border: `1px solid ${C.line}`, borderRadius: 12, padding: "14px 16px", background: C.bg }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ ...label, color: C.goldHi }}>Backtest results</span>
        <span style={{ fontSize: 13, color: C.text, fontWeight: 700 }}>{r.head}</span>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={r.run.disabled ? undefined : r.run.onClick} disabled={r.run.disabled} title={r.run.title} style={btn(r.run.primary, r.run.disabled)}>{r.run.l}</button>
      </div>
      {r.meta ? <div style={{ fontFamily: mono, fontSize: 11.5, color: C.mute }}>{r.meta}</div> : null}
      {r.busy ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 12.5, color: C.text }}>{r.progressT}</div>
          <div style={{ height: 4, background: "#1a2328", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: r.progressPct, background: C.gold, transition: "width .2s" }} />
          </div>
        </div>
      ) : null}
      {r.err ? <div style={{ fontSize: 13, color: C.down, border: "1px solid #5a2224", borderRadius: 8, padding: "8px 10px", background: "#1a0e0f" }}>{r.err}</div> : null}
      {r.stale ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid #6b5a2a", borderRadius: 8, padding: "8px 10px", background: "#1a160c", color: C.chipFg, fontSize: 12.5 }}>
          Rules changed since this run · <button type="button" onClick={r.onRerun} style={btn(true)}>Re-run</button>
        </div>
      ) : null}
      {r.idle ? <div style={{ fontSize: 12.5, color: C.mute }}>{r.idleT}</div> : null}
      {r.sum && r.sum.length ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 8 }}>
          {r.sum.map((s, i) => (
            <div key={i} style={{ border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 10px", background: C.bg2 }}>
              <div style={label}>{s.k}</div>
              <div style={{ fontFamily: mono, fontSize: 16, fontWeight: 700, color: s.c || C.text, marginTop: 3 }}>{s.v}</div>
            </div>
          ))}
        </div>
      ) : null}
      {r.rows && r.rows.length ? (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 820 }}>
            <thead>
              <tr>
                {r.cols.map((c) => (
                  <th key={c.key} onClick={c.onClick} title={c.title} style={{ ...label, textAlign: c.al || "right", padding: "6px 8px", cursor: "pointer", color: c.on ? C.goldHi : C.mute, borderBottom: `1px solid ${C.line}`, whiteSpace: "nowrap" }}>
                    {c.l}{c.on ? (c.desc ? " ↓" : " ↑") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.rows.map((x) => (
                <tr key={x.t} onClick={x.onClick} title={`Open the ${x.t} report`} style={{ cursor: "pointer", borderBottom: "1px solid #151b1e" }} className="slx7">
                  <td style={{ padding: "7px 8px", textAlign: "left", whiteSpace: "nowrap" }}>
                    <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: x.sigC, border: `1px solid ${x.sigBd}`, borderRadius: 999, padding: "2px 8px" }}>{x.sig}</span>
                  </td>
                  <td style={{ padding: "7px 8px", textAlign: "left", whiteSpace: "nowrap" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <span style={{ position: "relative", width: 22, height: 22, borderRadius: 5, background: "#12171a", display: "inline-grid", placeItems: "center", fontSize: 8, color: C.mute, overflow: "hidden" }}>
                        {x.t.slice(0, 4)}
                        <img src={x.logo} onError={hideImg} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", background: "#fff" }} />
                      </span>
                      <span style={{ fontWeight: 800, color: C.hi }}>{x.t}</span>
                      <span style={{ color: C.mute, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>{x.n}</span>
                    </span>
                  </td>
                  {[x.px, x.ret, x.bret, x.ex, x.sh, x.dd, x.win, x.tr].map((v, i) => (
                    <td key={i} style={{ padding: "7px 8px", textAlign: "right", fontFamily: mono, color: i === 3 ? x.exC : i === 1 ? x.retC : C.text }}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
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
          <span style={{ ...label, color: C.goldHi }}>Edit rules &amp; settings</span>
          <span style={{ fontWeight: 800, color: C.hi }}>{e.title}</span>
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
        <span style={label}>After entry</span>
        <RiskEditor rows={e.riskRows} sum={e.riskSum} more={e.more} />
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <span style={{ display: "flex", gap: 8, alignItems: "center" }}><span style={label}>Costs</span><Seg opts={e.costOpts} /></span>
          <span style={{ display: "flex", gap: 8, alignItems: "center" }}><span style={label}>Candle</span><Seg opts={e.candleOpts} /></span>
          <span style={{ display: "flex", gap: 8, alignItems: "center" }}><span style={label}>Period</span><Seg opts={e.periodOpts} /></span>
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
