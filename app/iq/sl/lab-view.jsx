// GENERATED from the Strategy AI Lab prototype markup by scripts/strategy-lab/build.sh (convert_view.py).
// Edit the markup by re-running the converter rather than by hand where possible.
import { Fragment } from "react";

/** A logo that fails to load is hidden (the prototype's data-logo-src behaviour). */
const hideImg = (e) => { e.currentTarget.style.display = "none"; };

export const LAB_HOVER_CSS = ".slx1:hover{background:#f0d68c !important}\n.slx2:hover{border-color:#c9a24a !important; color:#e6ebe8 !important}\n.slx3:hover{color:#fbefc9 !important}\n.slx4:hover{color:#fbefc9 !important}\n.slx5:hover{background:#1a160c !important}\n.slx6:hover{border-color:#f0d68c !important}\n.slx7:hover{background:#15130c !important; box-shadow:inset 0 0 0 1px rgba(201,162,74,.25) !important}\n.slx8:hover{color:#fbefc9 !important}\n.slx9:hover{border-color:#c9a24a !important; color:#fff !important}\n.slx10:hover{border-color:#6b5a2a !important}\n.slx11:hover{background:#f0d68c !important}\n.slx12:hover{border-color:#f0d68c !important}\n.slx13:hover{border-color:#f0565a !important}\n.slx14:hover{border-color:#f0d68c !important}\n.slx15:hover{background:#f0d68c !important}\n.slx16:hover{border-color:#c9a24a !important; color:#fff !important}\n.slx17:hover{border-color:#c9a24a !important; color:#fff !important}\n.slx18:hover{background:#c9a24a !important; color:#08090a !important; border-color:#c9a24a !important}\n.slx19:hover{background:#c9a24a !important; color:#08090a !important; border-color:#c9a24a !important}\n.slx20:hover{background:#c9a24a !important; color:#08090a !important; border-color:#c9a24a !important}\n.slx21:hover{border-color:#c9a24a !important}\n.slx22:hover{color:#f0565a !important}\n.slx23:hover{color:#f0565a !important}\n.slx24:hover{color:#f0565a !important}\n.slx25:hover{border-color:#c9a24a !important}\n.slx26:hover{border-color:#c9a24a !important; color:#fff !important}\n.slx27:hover{background:#c9a24a !important; color:#08090a !important; border-color:#c9a24a !important}\n.slx28:hover{background:#c9a24a !important; color:#08090a !important; border-color:#c9a24a !important}\n.slx29:hover{background:#c9a24a !important; color:#08090a !important; border-color:#c9a24a !important}\n.slx30:hover{border-color:#c9a24a !important}\n.slx31:hover{color:#f0565a !important}\n.slx32:hover{color:#f0565a !important}\n.slx33:hover{color:#f0565a !important}\n.slx34:hover{border-color:#c9a24a !important}\n.slx35:hover{border-color:#c9a24a !important; color:#fff !important}\n.slx36:hover{color:#fbefc9 !important}\n.slx37:hover{border-color:#5a4a22 !important; color:#fff !important}\n.slx38:hover{border-color:#f0d68c !important}\n.slx39:hover{background:#f0d68c !important}\n.slx40:hover{color:#eef2f4 !important}\n.slx41:focus-within{border-color:#c9a24a !important}\n.slx42:hover{background:#15130c !important; box-shadow:inset 0 0 0 1px rgba(201,162,74,.35),0 0 22px rgba(201,162,74,.10) !important}\n.slx43:hover{border-color:#f0d68c !important; background:#2e2614 !important}\n.slx44:hover{border-color:#f0d68c !important}\n.slx45:hover{border-color:#f0d68c !important}\n.slx46:hover{border-color:#f0d68c !important}\n.slx47:hover{background:#f0d68c !important}\n.slx48:hover{border-color:#f0d68c !important}\n.slx49:hover{color:#fff !important}\n.slx50:hover{background:#ff7a7d !important}\n.slx51:hover{border-color:#f0565a !important}\n.slx52:hover{color:#fbefc9 !important}\n.slx53:hover{background:#15130c !important; box-shadow:inset 0 0 0 1px rgba(201,162,74,.25) !important}\n.slx54:hover{background:#15130c !important; box-shadow:inset 0 0 0 1px rgba(201,162,74,.25) !important}\n.slx55:hover{color:#fbefc9 !important}\n.slx56:hover{background:#5a4a22 !important}\n.slx57:hover{background:#c9a24a !important; color:#08090a !important; border-color:#c9a24a !important}\n.slx58:hover{background:#c9a24a !important; color:#08090a !important; border-color:#c9a24a !important}\n.slx59:hover{background:#c9a24a !important; color:#08090a !important; border-color:#c9a24a !important}\n.slx60:hover{border-color:#c9a24a !important}\n.slx61:hover{color:#f0565a !important}\n.slx62:hover{color:#f0565a !important}\n.slx63:hover{color:#f0565a !important}\n.slx64:hover{border-color:#c9a24a !important}\n.slx65:hover{border-color:#c9a24a !important; color:#fff !important}\n.slx66:hover{background:#c9a24a !important; color:#08090a !important; border-color:#c9a24a !important}\n.slx67:hover{background:#c9a24a !important; color:#08090a !important; border-color:#c9a24a !important}\n.slx68:hover{background:#c9a24a !important; color:#08090a !important; border-color:#c9a24a !important}\n.slx69:hover{border-color:#c9a24a !important}\n.slx70:hover{color:#f0565a !important}\n.slx71:hover{color:#f0565a !important}\n.slx72:hover{color:#f0565a !important}\n.slx73:hover{border-color:#c9a24a !important}\n.slx74:hover{border-color:#c9a24a !important; color:#fff !important}\n.slx75:hover{color:#e6ebe8 !important}\n.slx76:hover{color:#e6ebe8 !important}\n.slx77:hover{color:#e6ebe8 !important}\n.slx78:hover{color:#e6ebe8 !important}\n.slx79:hover{color:#e6ebe8 !important}\n.slx80:hover{background:#416180 !important}\n.slx81:hover{color:#e6ebe8 !important}\n.slx82:hover{background:#1a160c !important}\n.slx83:hover{border-color:#c9a24a !important}\n.slx84:hover{background:#1a160c !important}\n.slx85:hover{border-color:#c9a24a !important; color:#fff !important}\n.slx86:hover{border-color:#c9a24a !important; color:#fff !important}\n.slx87:hover{background:#416180 !important}";

export default function LabView({ vm, refs }) {
  const { aiRef, libRef, detRef } = refs;
  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "1480px", margin: "0 auto", paddingTop: "0" }}>
        {(vm.labS1) ? (
          <>
            <div style={{ position: "relative", border: "1px solid #2a2618", background: "#0d0f10", borderRadius: "14px", padding: "clamp(22px,4vw,44px) clamp(18px,4vw,48px)", display: "flex", flexDirection: "column", gap: "18px", alignItems: "center", boxShadow: "0 0 0 1px rgba(201,162,74,.12),0 0 60px rgba(201,162,74,.08)" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", textAlign: "center" }}>
                <div style={{ fontFamily: "'Barlow Condensed',Manrope,sans-serif", fontWeight: "600", fontSize: "clamp(28px,3.4vw,40px)", lineHeight: "1.05", color: "#eef2f4", textWrap: "balance" }}>
                  {vm.aiHeadline}
                </div>
              </div>
              <div style={{ width: "100%", maxWidth: "820px", display: "flex", border: "1px solid #c9a24a", background: "#08090a", borderRadius: "12px", overflow: "hidden", boxShadow: "0 0 24px rgba(201,162,74,.18)" }}>
                <span style={{ display: "flex", alignItems: "center", padding: "0 0 0 16px", color: "#c9a24a" }}>
                  <svg width={"18"} height={"18"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"1.5"}>
                    <circle cx={"11"} cy={"11"} r={"7"} />
                    <path d={"m20 20-3.5-3.5"} />
                  </svg>
                </span>
                <input value={vm.aiQ ?? ''} onChange={vm.onAiQ} onKeyDown={vm.onAiKey} placeholder={vm.aiPh} style={{ borderRadius: "6px", flex: "1", minWidth: "0", background: "transparent", border: "0", color: "#eef2f4", padding: "16px 14px", fontSize: "15px", outline: "none" }} />
                <button onClick={vm.aiGo} style={{ borderRadius: "8px", border: "0", borderLeft: "1px solid #5a4a22", background: "#c9a24a", color: "#08090a", padding: "0 22px", fontWeight: "800", fontSize: "13px", cursor: "pointer", whiteSpace: "nowrap" }} className="slx1">
                  {vm.aiBtn}
                </button>
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center", maxWidth: "860px" }}>
                {(vm.aiChips || []).map((c, c__i) => (
                  <Fragment key={c__i}>
                    <button onClick={c?.onClick} style={{ borderRadius: "8px", border: "1px solid #233038", background: "transparent", color: "#aab3b0", padding: "6px 11px", fontSize: "12px", cursor: "pointer", textAlign: "left" }} className="slx2">
                      {c?.l}
                    </button>
                  </Fragment>
                ))}
              </div>
              {(vm.aiHas) ? (
                <>
                  <div ref={aiRef} style={{ width: "100%", maxWidth: "1320px", borderTop: "1px solid #1a2328", paddingTop: "20px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,440px),1fr))", gap: "24px", alignItems: "start" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px", minWidth: "0" }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "10px", fontWeight: "800", letterSpacing: ".1em", padding: "3px 9px", borderRadius: "999px", border: "1px solid #5a4a22", color: "#f0d68c" }}>
                          {vm.aiKind}
                        </span>
                        <span style={{ fontFamily: "'Barlow Condensed',Manrope,sans-serif", fontWeight: "600", fontSize: "22px", color: "#eef2f4" }}>
                          {vm.aiTitle}
                        </span>
                      </div>
                      {(vm.aiLoading) ? (
                        <>
                          <div style={{ fontSize: "13px", color: "#8b9592" }}>
                            {vm.aiLoadingT}
                          </div>
                        </>
                      ) : null}
                      {(vm.aiErr) ? (
                        <>
                          <div style={{ fontSize: "13px", color: "#f08a4b" }}>
                            {vm.aiErr}
                          </div>
                        </>
                      ) : null}
                      {(vm.aiHasFacts) ? (
                        <>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(118px,1fr))", gap: "1px", background: "#1a1f21", border: "1px solid #1a1f21", borderRadius: "10px", overflow: "hidden" }}>
                            {(vm.aiFacts || []).map((f, f__i) => (
                              <Fragment key={f__i}>
                                <div style={{ background: "#0b0e10", padding: "10px 12px" }}>
                                  <div style={{ fontSize: "10px", fontWeight: "700", letterSpacing: ".08em", color: "#5f6966" }}>
                                    {f?.k}
                                  </div>
                                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "15px", color: f?.c, marginTop: "2px" }}>
                                    {f?.v}
                                  </div>
                                </div>
                              </Fragment>
                            ))}
                          </div>
                        </>
                      ) : null}
                      {(vm.aiParas || []).map((p, p__i) => (
                        <Fragment key={p__i}>
                          <div style={{ fontSize: "14px", lineHeight: "1.6", color: "#cfd6d3", textWrap: "pretty" }}>
                            {p}
                          </div>
                        </Fragment>
                      ))}
                      {(vm.aiHasRules) ? (
                        <>
                          <div style={{ display: "grid", gridTemplateColumns: "96px minmax(0,1fr)", gap: "8px 12px", fontSize: "13px", border: "1px solid #1a1f21", borderRadius: "10px", padding: "12px 14px" }}>
                            <span style={{ color: "#5f6966", fontWeight: "700", fontSize: "10.5px", letterSpacing: ".08em", paddingTop: "2px" }}>
                              {"ENTRY"}
                            </span>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#e6ebe8" }}>
                              {vm.aiEntry}
                            </span>
                            <span style={{ color: "#5f6966", fontWeight: "700", fontSize: "10.5px", letterSpacing: ".08em", paddingTop: "2px" }}>
                              {"EXIT"}
                            </span>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#e6ebe8" }}>
                              {vm.aiExit}
                            </span>
                            <span style={{ color: "#5f6966", fontWeight: "700", fontSize: "10.5px", letterSpacing: ".08em", paddingTop: "2px" }}>
                              {"RISK"}
                            </span>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#e6ebe8" }}>
                              {vm.aiRisk}
                            </span>
                            <span style={{ color: "#5f6966", fontWeight: "700", fontSize: "10.5px", letterSpacing: ".08em", paddingTop: "7px" }}>
                              {"CANDLE"}
                            </span>
                            <span style={{ display: "flex", flexWrap: "wrap", gap: "3px", background: "#08090a", border: "1px solid #1a1f21", borderRadius: "9px", padding: "3px", justifySelf: "start" }}>
                              {(vm.aiCandleOpts || []).map((o, o__i) => (
                                <Fragment key={o__i}>
                                  <button onClick={o?.onClick} style={{ borderRadius: "7px", border: "0", background: o?.bg, color: o?.c, padding: "4px 10px", fontSize: "11.5px", fontWeight: "700", cursor: "pointer", fontFamily: "Manrope,sans-serif" }} className="slx3">
                                    {o?.l}
                                  </button>
                                </Fragment>
                              ))}
                            </span>
                            <span style={{ color: "#5f6966", fontWeight: "700", fontSize: "10.5px", letterSpacing: ".08em", paddingTop: "7px" }}>
                              {"PERIOD"}
                            </span>
                            <span style={{ display: "flex", flexWrap: "wrap", gap: "3px", background: "#08090a", border: "1px solid #1a1f21", borderRadius: "9px", padding: "3px", justifySelf: "start" }}>
                              {(vm.hv?.periodOpts || []).map((o, o__i) => (
                                <Fragment key={o__i}>
                                  <button onClick={o?.onClick} style={{ borderRadius: "7px", border: "0", background: o?.bg, color: o?.c, padding: "4px 10px", fontSize: "11.5px", fontWeight: "700", cursor: "pointer", fontFamily: "Manrope,sans-serif" }} className="slx4">
                                    {o?.l}
                                  </button>
                                </Fragment>
                              ))}
                            </span>
                          </div>
                        </>
                      ) : null}
                      {(vm.aiHasFit) ? (
                        <>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <div style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".12em", color: "#7a8481", marginBottom: "6px" }}>
                              {"STRATEGIES BACKTESTED ON "}
                              {vm.aiSym}
                              {" \u00b7 LAST 5 YEARS \u00b7 RANKED BY SHARPE"}
                            </div>
                            {(vm.aiFit || []).map((r, r__i) => (
                              <Fragment key={r__i}>
                                <button onClick={r?.onClick} style={{ borderRadius: "8px", display: "grid", gridTemplateColumns: "minmax(0,1fr) repeat(3,minmax(64px,90px)) 90px", gap: "10px", alignItems: "center", background: "transparent", border: "0", borderTop: "1px solid #12181b", padding: "9px 4px", color: "#e6ebe8", cursor: "pointer", textAlign: "left" }} className="slx5">
                                  <span style={{ fontWeight: "700", fontSize: "13px" }}>
                                    {r?.name}
                                  </span>
                                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "12.5px", textAlign: "right" }}>
                                    {r?.cagr}
                                  </span>
                                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "12.5px", textAlign: "right" }}>
                                    {r?.sh}
                                  </span>
                                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "12.5px", textAlign: "right", color: "#f0565a" }}>
                                    {r?.dd}
                                  </span>
                                  <span style={{ fontSize: "12px", fontWeight: "700", color: "#f0d68c", textAlign: "right" }}>
                                    {"Open \u2192"}
                                  </span>
                                </button>
                              </Fragment>
                            ))}
                            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) repeat(3,minmax(64px,90px)) 90px", gap: "10px", padding: "4px", fontSize: "10px", fontWeight: "700", letterSpacing: ".08em", color: "#5f6966" }}>
                              <span>
                              </span>
                              <span style={{ textAlign: "right" }}>
                                {"CAGR"}
                              </span>
                              <span style={{ textAlign: "right" }}>
                                {"SHARPE"}
                              </span>
                              <span style={{ textAlign: "right" }}>
                                {"MAX DD"}
                              </span>
                              <span>
                              </span>
                            </div>
                          </div>
                        </>
                      ) : null}
                      {(vm.aiHasActs) ? (
                        <>
                          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                            {(vm.aiActs || []).map((a, a__i) => (
                              <Fragment key={a__i}>
                                <button onClick={a?.onClick} style={{ borderRadius: "8px", border: `1px solid ${a?.bd ?? ''}`, background: a?.bg, color: a?.c, padding: "9px 16px", fontWeight: "800", fontSize: "12.5px", cursor: "pointer" }} className="slx6">
                                  {a?.l}
                                </button>
                              </Fragment>
                            ))}
                          </div>
                        </>
                      ) : null}
                    </div>
                    {(vm.hv?.show) ? (
                      <>
                        <div style={{ display: "flex", flexDirection: "column", gap: "14px", border: "1px solid #2a2618", background: "#0b0c0d", borderRadius: "12px", padding: "16px 18px", minWidth: "0" }}>
                          <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
                            <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".12em", color: "#7a8481" }}>
                              {"VALIDATION"}
                            </span>
                            <span style={{ fontFamily: "'Barlow Condensed',Manrope,sans-serif", fontWeight: "600", fontSize: "20px", color: "#eef2f4" }}>
                              {vm.hv?.head}
                            </span>
                          </div>
                          {(vm.hv?.busy) ? (
                            <>
                              <div style={{ height: "3px", background: "#15191b", borderRadius: "2px", overflow: "hidden" }}>
                                <div style={{ height: "3px", width: vm.hv?.pct, background: "#c9a24a", transition: "width .2s" }}>
                                </div>
                              </div>
                            </>
                          ) : null}
                          {(vm.hv?.err) ? (
                            <>
                              <div style={{ fontSize: "13px", color: "#f08a4b", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                                <span>
                                  {vm.hv?.err}
                                </span>
                              </div>
                            </>
                          ) : null}
                          {(vm.hv?.stale) ? (
                            <>
                              <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "12.5px", color: "#f08a4b" }}>
                                {"Rules changed since this run."}
                                <button onClick={vm.hv?.run} style={{ borderRadius: "8px", border: "1px solid #6b3a1c", background: "transparent", color: "#f7c9a8", padding: "4px 10px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
                                  {"Re-run"}
                                </button>
                              </div>
                            </>
                          ) : null}
                          {(vm.hv?.idle) ? (
                            <>
                              <div style={{ fontSize: "13px", color: "#8b9592", lineHeight: "1.55", border: "1px dashed #263033", borderRadius: "10px", padding: "16px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                                <span>
                                  {vm.hv?.idleT}
                                </span>
                              </div>
                            </>
                          ) : null}
                          {(vm.hv?.hasSum) ? (
                            <>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(96px,1fr))", gap: "1px", background: "#1a1f21", border: "1px solid #1a1f21", borderRadius: "10px", overflow: "hidden" }}>
                                {(vm.hv?.sum || []).map((f, f__i) => (
                                  <Fragment key={f__i}>
                                    <div style={{ background: "#0d0f10", padding: "9px 11px" }}>
                                      <div style={{ fontSize: "9.5px", fontWeight: "700", letterSpacing: ".08em", color: "#5f6966" }}>
                                        {f?.k}
                                      </div>
                                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "15px", color: f?.c, marginTop: "2px" }}>
                                        {f?.v}
                                      </div>
                                    </div>
                                  </Fragment>
                                ))}
                              </div>
                            </>
                          ) : null}
                          {(vm.hv?.noneReady) ? (
                            <>
                              <div style={{ fontSize: "13px", color: "#8b9592", border: "1px dashed #263033", borderRadius: "10px", padding: "16px" }}>
                                {"No stock meets the rules right now. The summary above shows how the strategy has performed historically."}
                              </div>
                            </>
                          ) : null}
                          {(vm.hv?.hasRows) ? (
                            <>
                              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                                <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".1em", color: "#7a8481" }}>
                                  {"RETURN OVER"}
                                </span>
                                <div style={{ display: "flex", gap: "3px", background: "#08090a", border: "1px solid #1a1f21", borderRadius: "9px", padding: "3px" }}>
                                  {(vm.hv?.winOpts || []).map((o, o__i) => (
                                    <Fragment key={o__i}>
                                      <button onClick={o?.onClick} style={{ borderRadius: "7px", border: "0", background: o?.bg, color: o?.c, padding: "4px 10px", fontSize: "11.5px", fontWeight: "700", cursor: "pointer" }}>
                                        {o?.l}
                                      </button>
                                    </Fragment>
                                  ))}
                                </div>
                                <span style={{ fontSize: "11px", color: "#5f6966" }}>
                                  {"Strategy vs buy "}
                                  {"&"}
                                  {" hold over the last window of the backtest"}
                                </span>
                              </div>
                            </>
                          ) : null}
                          {(vm.hv?.hasRows) ? (
                            <>
                              <div style={{ display: "flex", flexDirection: "column", maxHeight: "300px", overflowY: "auto", overflowX: "hidden", scrollbarWidth: "thin", scrollbarColor: "#c9a24a #15130c" }}>
                                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.5fr) repeat(4,minmax(0,1fr))", gap: "6px", padding: "0 8px 6px", fontSize: "9.5px", fontWeight: "700", letterSpacing: ".08em", color: "#5f6966", position: "sticky", top: "0", background: "#0b0c0d" }}>
                                  <span>
                                    {"STOCK"}
                                  </span>
                                  <span style={{ textAlign: "center" }}>
                                    {vm.hv?.retHdr}
                                  </span>
                                  <span style={{ textAlign: "right" }} title={"Strategy return minus buy-and-hold return over the same window"}>
                                    {"VS B"}
                                    {"&"}
                                    {"H"}
                                  </span>
                                  <span style={{ textAlign: "right" }}>
                                    {"WIN %"}
                                  </span>
                                  <span style={{ textAlign: "center" }}>
                                    {"TRADES"}
                                  </span>
                                </div>
                                {(vm.hv?.rows || []).map((r, r__i) => (
                                  <Fragment key={r__i}>
                                    <button onClick={r?.onClick} title={`Open the full backtest on ${r?.t ?? ''}`} style={{ display: "grid", gridTemplateColumns: "minmax(0,1.5fr) repeat(4,minmax(0,1fr))", gap: "6px", alignItems: "center", background: "transparent", border: "0", borderTop: "1px solid #15191b", borderRadius: "8px", padding: "8px", color: "#e6ebe8", cursor: "pointer", textAlign: "left" }} className="slx7">
                                      <span style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: "0" }}>
                                        <span style={{ position: "relative", width: "24px", height: "24px", flex: "none", borderRadius: "6px", background: "#1a1f21", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "8px", fontWeight: "800", color: "#f0d68c", overflow: "hidden" }}>
                                          {r?.ini}
                                          <img src={r?.logo || undefined} onError={hideImg} alt={""} style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "contain", background: "#fff", padding: "2px" }} />
                                        </span>
                                        <span style={{ display: "flex", flexDirection: "column", minWidth: "0" }}>
                                          <span style={{ fontWeight: "800", fontSize: "12.5px" }}>
                                            {r?.t}
                                          </span>
                                          <span style={{ fontSize: "10.5px", color: "#7a8481", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {r?.n}
                                          </span>
                                        </span>
                                      </span>
                                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "12px", textAlign: "center" }}>
                                        {r?.cagr}
                                      </span>
                                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "12px", textAlign: "right", color: r?.exC }}>
                                        {r?.ex}
                                      </span>
                                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "12px", textAlign: "right" }}>
                                        {r?.win}
                                      </span>
                                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "12px", textAlign: "center", color: "#aab3b0" }}>
                                        {r?.tr}
                                      </span>
                                    </button>
                                  </Fragment>
                                ))}
                              </div>
                            </>
                          ) : null}
                        </div>
                      </>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>
          </>
        ) : null}
        {(vm.labNotS1) ? (
          <>
            <button onClick={vm.labHome} style={{ alignSelf: "flex-start", background: "none", border: "0", padding: "0", color: "#f0d68c", fontSize: "12.5px", fontWeight: "700", cursor: "pointer" }} className="slx8">
              {"\u2190 Back to Strategy Lab"}
            </button>
          </>
        ) : null}
        {(vm.auOpen) ? (
          <>
            <div onClick={vm.auClose} style={{ position: "fixed", inset: "0", background: "rgba(4,5,6,.72)", backdropFilter: "blur(3px)", zIndex: "80", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "5vh 16px", overflowY: "auto" }}>
              <div onClick={vm.stop} style={{ width: "100%", maxWidth: "760px", background: "#0d0f10", border: "1px solid #2a2618", borderRadius: "14px", boxShadow: "0 30px 80px rgba(0,0,0,.6),0 0 0 1px rgba(201,162,74,.12)", padding: "22px 24px", display: "flex", flexDirection: "column", gap: "18px" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
                  <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".12em", color: "#f0d68c" }}>
                    {"AUTOMATE"}
                  </span>
                  <span style={{ fontFamily: "'Barlow Condensed',Manrope,sans-serif", fontWeight: "600", fontSize: "24px", color: "#eef2f4" }}>
                    {vm.auName}
                  </span>
                  <button onClick={vm.auClose} title={"Close"} style={{ marginLeft: "auto", borderRadius: "8px", background: "none", border: "1px solid #263033", color: "#aab3b0", width: "30px", height: "30px", cursor: "pointer", fontSize: "16px" }} className="slx9">
                    {"\u00d7"}
                  </button>
                </div>
                <div style={{ fontSize: "13px", color: "#8b9592", lineHeight: "1.55" }}>
                  {"When this strategy's entry or exit rules trigger on a stock, MarketCatalyst sends the order to your broker's webhook."}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".1em", color: "#7a8481" }}>
                    {"BROKER"}
                  </span>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: "8px" }}>
                    {(vm.auBrokers || []).map((b, b__i) => (
                      <Fragment key={b__i}>
                        <button onClick={b?.onClick} style={{ borderRadius: "10px", border: `1px solid ${b?.bd ?? ''}`, background: b?.bg, color: "#e6ebe8", padding: "10px 12px", textAlign: "left", cursor: "pointer", display: "flex", flexDirection: "column", gap: "2px" }} className="slx10">
                          <span style={{ fontWeight: "700", fontSize: "13px" }}>
                            {b?.l}
                          </span>
                          <span style={{ fontSize: "11px", color: "#7a8481" }}>
                            {b?.sub}
                          </span>
                        </button>
                      </Fragment>
                    ))}
                  </div>
                </div>
                {(vm.auHasBroker) ? (
                  <>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", border: "1px solid #1a1f21", borderRadius: "12px", padding: "14px 16px", background: "#0b0d0e" }}>
                      {(vm.auIsOauth) ? (
                        <>
                          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            <div style={{ fontSize: "13px", color: "#cfd6d3", lineHeight: "1.55" }}>
                              {"Sign in at "}
                              {vm.auBrokerName}
                              {" and approve MarketCatalyst. We create the order webhook for this strategy automatically \u2014 no keys or URLs to copy."}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                              <button onClick={vm.auGoBroker} style={{ borderRadius: "8px", border: "1px solid #c9a24a", background: "#c9a24a", color: "#08090a", padding: "10px 16px", fontWeight: "800", fontSize: "13px", cursor: "pointer" }} className="slx11">
                                {vm.auGoL}
                              </button>
                              <span style={{ fontSize: "12px", color: vm.auLinkC }}>
                                {vm.auLinkT}
                              </span>
                            </div>
                            <button onClick={vm.auToManual} style={{ alignSelf: "flex-start", background: "none", border: "0", padding: "0", color: "#7a8481", fontSize: "12px", cursor: "pointer", textDecoration: "underline" }}>
                              {"Use a webhook URL instead"}
                            </button>
                          </div>
                        </>
                      ) : null}
                      {(vm.auIsHook) ? (
                        <>
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                              <span style={{ fontSize: "13px", color: "#cfd6d3", flex: "1", minWidth: "220px", lineHeight: "1.5" }}>
                                {vm.auHookT}
                              </span>
                              {(vm.auHasDash) ? (
                                <>
                                  <button onClick={vm.auOpenDash} style={{ borderRadius: "8px", border: "1px solid #5a4a22", background: "transparent", color: "#fbefc9", padding: "8px 13px", fontWeight: "700", fontSize: "12.5px", cursor: "pointer" }} className="slx12">
                                    {vm.auDashL}
                                  </button>
                                </>
                              ) : null}
                            </div>
                            <input value={vm.auUrl ?? ''} onChange={vm.onAuUrl} placeholder={"Paste webhook URL \u2014 https://\u2026"} style={{ background: "#08090a", color: "#eef2f4", border: "1px solid #263033", borderRadius: "8px", padding: "9px 11px", fontSize: "13px", outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "'JetBrains Mono',monospace" }} />
                          </div>
                        </>
                      ) : null}
                    </div>
                  </>
                ) : null}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "14px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".1em", color: "#7a8481" }}>
                      {"MODE"}
                    </span>
                    <div style={{ display: "flex", gap: "3px", background: "#08090a", border: "1px solid #1a1f21", borderRadius: "9px", padding: "3px", flexWrap: "wrap" }}>
                      {(vm.auModes || []).map((o, o__i) => (
                        <Fragment key={o__i}>
                          <button onClick={o?.onClick} style={{ borderRadius: "7px", border: "0", background: o?.bg, color: o?.c, padding: "6px 12px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
                            {o?.l}
                          </button>
                        </Fragment>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".1em", color: "#7a8481" }}>
                      {"ORDER TYPE"}
                    </span>
                    <div style={{ display: "flex", gap: "3px", background: "#08090a", border: "1px solid #1a1f21", borderRadius: "9px", padding: "3px", flexWrap: "wrap" }}>
                      {(vm.auTypes || []).map((o, o__i) => (
                        <Fragment key={o__i}>
                          <button onClick={o?.onClick} style={{ borderRadius: "7px", border: "0", background: o?.bg, color: o?.c, padding: "6px 12px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
                            {o?.l}
                          </button>
                        </Fragment>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".1em", color: "#7a8481" }}>
                      {"SIZE PER TRADE (USD)"}
                    </span>
                    <input type={"number"} min={"1"} value={vm.auSize ?? ''} onChange={vm.onAuSize} style={{ background: "#08090a", color: "#eef2f4", border: "1px solid #263033", borderRadius: "8px", padding: "9px 11px", fontSize: "13px", outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "'JetBrains Mono',monospace" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".1em", color: "#7a8481" }}>
                      {"SEND"}
                    </span>
                    <div style={{ display: "flex", gap: "3px", background: "#08090a", border: "1px solid #1a1f21", borderRadius: "9px", padding: "3px", flexWrap: "wrap" }}>
                      {(vm.auSends || []).map((o, o__i) => (
                        <Fragment key={o__i}>
                          <button onClick={o?.onClick} style={{ borderRadius: "7px", border: "0", background: o?.bg, color: o?.c, padding: "6px 12px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
                            {o?.l}
                          </button>
                        </Fragment>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".1em", color: "#7a8481" }}>
                    {"PAYLOAD SENT ON EACH SIGNAL"}
                  </span>
                  <pre style={{ margin: "0", fontFamily: "'JetBrains Mono',monospace", fontSize: "11.5px", lineHeight: "1.55", color: "#cfd6d3", background: "#08090a", border: "1px solid #1a1f21", borderRadius: "10px", padding: "12px 14px", overflowX: "auto", whiteSpace: "pre" }}>
                    {vm.auPayload}
                  </pre>
                </div>
                {(vm.auMsg) ? (
                  <>
                    <div style={{ fontSize: "12.5px", color: vm.auMsgC }}>
                      {vm.auMsg}
                    </div>
                  </>
                ) : null}
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                  {(vm.auIsOn) ? (
                    <>
                      <button onClick={vm.auDisconnect} style={{ borderRadius: "8px", border: "1px solid #3a2224", background: "transparent", color: "#f0a0a2", padding: "9px 14px", fontWeight: "700", fontSize: "12.5px", cursor: "pointer" }} className="slx13">
                        {"Disconnect"}
                      </button>
                    </>
                  ) : null}
                  <button onClick={vm.auTest} style={{ marginLeft: "auto", borderRadius: "8px", border: "1px solid #5a4a22", background: "transparent", color: "#fbefc9", padding: "9px 14px", fontWeight: "700", fontSize: "12.5px", cursor: "pointer" }} className="slx14">
                    {"Send test signal"}
                  </button>
                  <button onClick={vm.auSave} style={{ borderRadius: "8px", border: "1px solid #c9a24a", background: "#c9a24a", color: "#08090a", padding: "9px 16px", fontWeight: "800", fontSize: "12.5px", cursor: "pointer" }} className="slx15">
                    {vm.auSaveL}
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : null}
        {(vm.chOpen) ? (
          <>
            <div onClick={vm.chClose} style={{ position: "fixed", inset: "0", background: "rgba(4,5,6,.74)", backdropFilter: "blur(3px)", zIndex: "85", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "6vh 16px", overflowY: "auto" }}>
              <div onClick={vm.chStop} style={{ width: "100%", maxWidth: "1000px", background: "#0d0f10", border: "1px solid #2a2618", borderRadius: "14px", boxShadow: "0 30px 80px rgba(0,0,0,.6),0 0 0 1px rgba(201,162,74,.12)", padding: "22px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "'Barlow Condensed',Manrope,sans-serif", fontWeight: "600", fontSize: "28px", color: "#eef2f4" }}>
                    {vm.chT}
                  </span>
                  <span style={{ fontSize: "13px", color: "#8b9592" }}>
                    {vm.chN}
                  </span>
                  <span style={{ fontSize: "11.5px", color: "#5f6966" }}>
                    {vm.chSub}
                  </span>
                  <button onClick={vm.chClose} title={"Close"} style={{ marginLeft: "auto", borderRadius: "8px", background: "none", border: "1px solid #263033", color: "#aab3b0", width: "30px", height: "30px", cursor: "pointer", fontSize: "16px" }} className="slx16">
                    {"\u00d7"}
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: "1px", background: "#1a1f21", border: "1px solid #1a1f21", borderRadius: "10px", overflow: "hidden" }}>
                  {(vm.chStats || []).map((f, f__i) => (
                    <Fragment key={f__i}>
                      <div style={{ background: "#0d0f10", padding: "9px 12px" }}>
                        <div style={{ fontSize: "9.5px", fontWeight: "700", letterSpacing: ".08em", color: "#5f6966" }}>
                          {f?.k}
                        </div>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "16px", color: f?.c, marginTop: "2px" }}>
                          {f?.v}
                        </div>
                      </div>
                    </Fragment>
                  ))}
                </div>
                <div style={{ display: "flex", gap: "16px", alignItems: "center", fontSize: "11.5px", color: "#8b9592", flexWrap: "wrap" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ width: "12px", height: "12px", borderRadius: "3px", background: "rgba(61,220,132,.25)", border: "1px solid rgba(61,220,132,.6)" }}>
                    </span>
                    {"Winning trade"}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ width: "12px", height: "12px", borderRadius: "3px", background: "rgba(240,86,90,.25)", border: "1px solid rgba(240,86,90,.6)" }}>
                    </span>
                    {"Losing trade"}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ width: "0", height: "0", borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderBottom: "8px solid #f0d68c" }}>
                    </span>
                    {"Entry signal"}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", border: "2px solid #eef2f4" }}>
                    </span>
                    {"Exit"}
                  </span>
                </div>
                <div style={{ position: "relative", display: "grid", gridTemplateColumns: "minmax(0,1fr) 56px", gap: "8px" }}>
                  <div style={{ position: "relative", height: "320px", border: "1px solid #1a1f21", borderRadius: "10px", background: "#0b0d0e", overflow: "hidden" }}>
                    <svg viewBox={"0 0 1000 300"} preserveAspectRatio={"none"} style={{ position: "absolute", inset: "0", width: "100%", height: "100%" }}>
                      {(vm.chTr || []).map((t, t__i) => (
                        <Fragment key={t__i}>
                          <rect x={t?.x} y={"0"} width={t?.w} height={"300"} fill={t?.fill} stroke={t?.stroke} strokeWidth={"1"} vectorEffect={"non-scaling-stroke"} />
                        </Fragment>
                      ))}
                      <path d={vm.chArea} fill={"rgba(201,162,74,.06)"} stroke={"none"} />
                      <path d={vm.chLine} fill={"none"} stroke={"#f0d68c"} strokeWidth={"1.6"} vectorEffect={"non-scaling-stroke"} />
                    </svg>
                    {(vm.chTr || []).map((t, t__i) => (
                      <Fragment key={t__i}>
                        <span title={`Entry ${t?.inD ?? ''} @ ${t?.inPx ?? ''}`} style={{ position: "absolute", left: t?.inL, top: t?.inT, transform: "translate(-50%,2px)", width: "0", height: "0", borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderBottom: "10px solid #f0d68c", filter: "drop-shadow(0 0 4px rgba(240,214,140,.6))" }}>
                        </span>
                        <span title={`Exit ${t?.outD ?? ''} @ ${t?.outPx ?? ''}`} style={{ position: "absolute", left: t?.outL, top: t?.outT, transform: "translate(-50%,-50%)", width: "9px", height: "9px", borderRadius: "50%", background: "#0b0d0e", border: "2px solid #eef2f4" }}>
                        </span>
                        <span style={{ position: "absolute", left: t?.lblL, top: "8px", transform: "translateX(-50%)", fontFamily: "'JetBrains Mono',monospace", fontSize: "10.5px", fontWeight: "700", color: t?.c, background: "rgba(11,13,14,.85)", padding: "1px 5px", borderRadius: "4px", whiteSpace: "nowrap" }}>
                          {t?.ret}
                        </span>
                      </Fragment>
                    ))}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", fontFamily: "'JetBrains Mono',monospace", fontSize: "10.5px", color: "#7a8481", padding: "4px 0" }}>
                    <span>
                      {vm.chHi}
                    </span>
                    <span>
                      {vm.chLo}
                    </span>
                  </div>
                  <div style={{ gridColumn: "1", display: "flex", justifyContent: "space-between", fontFamily: "'JetBrains Mono',monospace", fontSize: "10.5px", color: "#7a8481", marginTop: "-2px" }}>
                    <span>
                      {vm.chD0}
                    </span>
                    <span>
                      {vm.chD1}
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", maxHeight: "220px", overflowY: "auto", overflowX: "hidden", scrollbarWidth: "thin", scrollbarColor: "#c9a24a #15130c" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "36px minmax(0,1fr) minmax(0,1fr) repeat(3,minmax(0,.8fr))", gap: "8px", padding: "0 8px 6px", fontSize: "9.5px", fontWeight: "700", letterSpacing: ".08em", color: "#5f6966", position: "sticky", top: "0", background: "#0d0f10" }}>
                    <span>
                      {"#"}
                    </span>
                    <span>
                      {"ENTRY"}
                    </span>
                    <span>
                      {"EXIT"}
                    </span>
                    <span style={{ textAlign: "right" }}>
                      {"IN"}
                    </span>
                    <span style={{ textAlign: "right" }}>
                      {"OUT"}
                    </span>
                    <span style={{ textAlign: "right" }}>
                      {"RETURN"}
                    </span>
                  </div>
                  {(vm.chTr || []).map((t, t__i) => (
                    <Fragment key={t__i}>
                      <div style={{ display: "grid", gridTemplateColumns: "36px minmax(0,1fr) minmax(0,1fr) repeat(3,minmax(0,.8fr))", gap: "8px", padding: "8px", borderTop: "1px solid #15191b", fontSize: "12.5px", color: "#e6ebe8", alignItems: "center" }}>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#7a8481" }}>
                          {t?.n}
                        </span>
                        <span>
                          {t?.inD}
                        </span>
                        <span>
                          {t?.outD}
                          {" "}
                          <span style={{ color: "#5f6966" }}>
                            {"\u00b7 "}
                            {t?.days}
                            {" bars"}
                          </span>
                        </span>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", textAlign: "right" }}>
                          {t?.inPx}
                        </span>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", textAlign: "right" }}>
                          {t?.outPx}
                        </span>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", textAlign: "right", color: t?.c, fontWeight: "700" }}>
                          {t?.ret}
                        </span>
                      </div>
                    </Fragment>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : null}
        {(vm.aiEditOpen) ? (
          <>
            <div onClick={vm.aiEditClose} style={{ position: "fixed", inset: "0", background: "rgba(4,5,6,.72)", backdropFilter: "blur(3px)", zIndex: "80", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "6vh 16px", overflowY: "auto" }}>
              <div onClick={vm.stop} style={{ width: "100%", maxWidth: "940px", background: "#0d0f10", border: "1px solid #2a2618", borderRadius: "14px", boxShadow: "0 30px 80px rgba(0,0,0,.6),0 0 0 1px rgba(201,162,74,.12)", padding: "22px 24px", display: "flex", flexDirection: "column", gap: "18px" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
                  <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".12em", color: "#f0d68c" }}>
                    {"EDIT RULES"}
                  </span>
                  <span style={{ fontFamily: "'Barlow Condensed',Manrope,sans-serif", fontWeight: "600", fontSize: "24px", color: "#eef2f4" }}>
                    {vm.aiEditTitle}
                  </span>
                  <button onClick={vm.aiEditCancel} title={"Close"} style={{ marginLeft: "auto", borderRadius: "8px", background: "none", border: "1px solid #263033", color: "#aab3b0", width: "30px", height: "30px", cursor: "pointer", fontSize: "16px" }} className="slx17">
                    {"\u00d7"}
                  </button>
                </div>
                {(vm.aiEditing) ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".12em", color: "#7a8481", minWidth: "52px" }}>
                        {"NAME"}
                      </span>
                      <input value={vm.aiEditName ?? ''} onChange={vm.onAiEditName} style={{ flex: "1", minWidth: "0", borderRadius: "8px", background: "#08090a", border: "1px solid #263033", color: "#eef2f4", padding: "9px 12px", fontSize: "14px", outline: "none" }} />
                    </div>
                  </>
                ) : null}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".12em", color: "#7a8481", textTransform: "uppercase" }}>
                    {"Entry \u2014 all must be true"}
                  </span>
                  {(vm.labEntry || []).map((c, c__i) => (
                    <Fragment key={c__i}>
                      {(c?.single) ? (
                        <>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", border: "1px solid #1a1f21", background: "#0b0d0e", borderRadius: "10px", padding: "6px 8px" }}>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "10.5px", color: "#5f6966", width: "30px" }}>
                              {c?.join}
                            </span>
                            <select value={c?.aInd ?? ''} onChange={c?.onA} style={{ borderRadius: "6px", background: "#121a20", color: "#fbefc9", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", maxWidth: "190px" }}>
                              {(c?.indOpts || []).map((o, o__i) => (
                                <Fragment key={o__i}>
                                  <option value={o?.v}>
                                    {o?.l}
                                  </option>
                                </Fragment>
                              ))}
                            </select>
                            <span style={{ position: "relative", display: "inline-flex" }}>
                              <span role={"button"} onMouseEnter={c?.aTip?.on} onMouseLeave={c?.aTip?.off} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "15px", height: "15px", borderRadius: "50%", border: "1px solid #5a4a22", color: "#f0d68c", fontSize: "9.5px", fontWeight: "700", fontStyle: "italic", cursor: "help", lineHeight: "1" }} className="slx18">
                                {"i"}
                              </span>
                              {(c?.aTip?.open) ? (
                                <>
                                  <span style={{ position: "absolute", top: "calc(100% + 6px)", left: "-8px", zIndex: "30", width: "min(260px,70vw)", background: "#15130c", border: "1px solid #5a4a22", borderRadius: "8px", padding: "9px 11px", fontSize: "11.5px", lineHeight: "1.45", color: "#e6ebe8", boxShadow: "0 10px 30px rgba(0,0,0,.5)", textWrap: "pretty", pointerEvents: "none" }}>
                                    {c?.aTip?.txt}
                                  </span>
                                </>
                              ) : null}
                            </span>
                            {(c?.aLook) ? (
                              <>
                                <select value={c?.aNs ?? ''} onChange={c?.onAN} title={"Lookback"} style={{ borderRadius: "6px", background: "#0b0e10", color: "#e6ebe8", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontFamily: "'JetBrains Mono',monospace" }}>
                                  {(c?.lookOpts || []).map((o, o__i) => (
                                    <Fragment key={o__i}>
                                      <option value={o?.v}>
                                        {o?.l}
                                      </option>
                                    </Fragment>
                                  ))}
                                </select>
                              </>
                            ) : null}
                            {(c?.aHasN) ? (
                              <>
                                <input type={"number"} min={"1"} value={c?.aN ?? ''} onChange={c?.onAN} title={"Period"} style={{ borderRadius: "6px", width: "56px", background: "#0b0e10", color: "#e6ebe8", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontFamily: "'JetBrains Mono',monospace" }} />
                              </>
                            ) : null}
                            <select value={c?.op ?? ''} onChange={c?.onOp} style={{ borderRadius: "6px", background: "#0b0e10", color: "#f0d68c", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontWeight: "700" }}>
                              {(c?.opOpts || []).map((o, o__i) => (
                                <Fragment key={o__i}>
                                  <option value={o}>
                                    {o}
                                  </option>
                                </Fragment>
                              ))}
                            </select>
                            <span style={{ position: "relative", display: "inline-flex" }}>
                              <span role={"button"} onMouseEnter={c?.oTip?.on} onMouseLeave={c?.oTip?.off} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "15px", height: "15px", borderRadius: "50%", border: "1px solid #5a4a22", color: "#f0d68c", fontSize: "9.5px", fontWeight: "700", fontStyle: "italic", cursor: "help", lineHeight: "1" }} className="slx19">
                                {"i"}
                              </span>
                              {(c?.oTip?.open) ? (
                                <>
                                  <span style={{ position: "absolute", top: "calc(100% + 6px)", left: "-8px", zIndex: "30", width: "min(260px,70vw)", background: "#15130c", border: "1px solid #5a4a22", borderRadius: "8px", padding: "9px 11px", fontSize: "11.5px", lineHeight: "1.45", color: "#e6ebe8", boxShadow: "0 10px 30px rgba(0,0,0,.5)", textWrap: "pretty", pointerEvents: "none" }}>
                                    {c?.oTip?.txt}
                                  </span>
                                </>
                              ) : null}
                            </span>
                            {(c?.bHasMult) ? (
                              <>
                                <input type={"number"} step={"0.1"} value={c?.bMult ?? ''} onChange={c?.onBMult} title={"Multiplier"} style={{ borderRadius: "6px", width: "48px", background: "#0b0e10", color: "#e6ebe8", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontFamily: "'JetBrains Mono',monospace" }} />
                                <span style={{ color: "#5f6966", fontSize: "12px" }}>
                                  {"\u00d7"}
                                </span>
                              </>
                            ) : null}
                            <select value={c?.bInd ?? ''} onChange={c?.onB} style={{ borderRadius: "6px", background: "#121a20", color: "#fbefc9", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", maxWidth: "190px" }}>
                              {(c?.indOpts || []).map((o, o__i) => (
                                <Fragment key={o__i}>
                                  <option value={o?.v}>
                                    {o?.l}
                                  </option>
                                </Fragment>
                              ))}
                            </select>
                            <span style={{ position: "relative", display: "inline-flex" }}>
                              <span role={"button"} onMouseEnter={c?.bTip?.on} onMouseLeave={c?.bTip?.off} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "15px", height: "15px", borderRadius: "50%", border: "1px solid #5a4a22", color: "#f0d68c", fontSize: "9.5px", fontWeight: "700", fontStyle: "italic", cursor: "help", lineHeight: "1" }} className="slx20">
                                {"i"}
                              </span>
                              {(c?.bTip?.open) ? (
                                <>
                                  <span style={{ position: "absolute", top: "calc(100% + 6px)", right: "-8px", zIndex: "30", width: "min(260px,70vw)", background: "#15130c", border: "1px solid #5a4a22", borderRadius: "8px", padding: "9px 11px", fontSize: "11.5px", lineHeight: "1.45", color: "#e6ebe8", boxShadow: "0 10px 30px rgba(0,0,0,.5)", textWrap: "pretty", pointerEvents: "none" }}>
                                    {c?.bTip?.txt}
                                  </span>
                                </>
                              ) : null}
                            </span>
                            {(c?.bLook) ? (
                              <>
                                <select value={c?.bNs ?? ''} onChange={c?.onBN} title={"Lookback"} style={{ borderRadius: "6px", background: "#0b0e10", color: "#e6ebe8", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontFamily: "'JetBrains Mono',monospace" }}>
                                  {(c?.lookOpts || []).map((o, o__i) => (
                                    <Fragment key={o__i}>
                                      <option value={o?.v}>
                                        {o?.l}
                                      </option>
                                    </Fragment>
                                  ))}
                                </select>
                              </>
                            ) : null}
                            {(c?.bHasN) ? (
                              <>
                                <input type={"number"} min={"1"} value={c?.bN ?? ''} onChange={c?.onBN} title={"Period"} style={{ borderRadius: "6px", width: "56px", background: "#0b0e10", color: "#e6ebe8", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontFamily: "'JetBrains Mono',monospace" }} />
                              </>
                            ) : null}
                            {(c?.bIsNum) ? (
                              <>
                                <input type={"number"} step={"any"} value={c?.bV ?? ''} onChange={c?.onBV} title={"Value"} style={{ borderRadius: "6px", width: "70px", background: "#0b0e10", color: "#e6ebe8", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontFamily: "'JetBrains Mono',monospace" }} />
                              </>
                            ) : null}
                            {(c?.warn) ? (
                              <>
                                <span style={{ fontSize: "10px", fontWeight: "800", letterSpacing: ".06em", color: "#f08a4b", border: "1px solid #6b3a1c", padding: "2px 8px", borderRadius: "999px" }}>
                                  {"NEEDS DATA"}
                                </span>
                              </>
                            ) : null}
                            <button onClick={c?.onOr} title={"Add an OR alternative to this condition"} style={{ borderRadius: "6px", background: "none", border: "1px solid #263033", color: "#f0d68c", cursor: "pointer", fontSize: "10.5px", fontWeight: "800", letterSpacing: ".06em", padding: "3px 7px" }} className="slx21">
                              {"+ OR"}
                            </button>
                            <button onClick={c?.onDel} title={"Remove condition"} style={{ marginLeft: "auto", background: "none", border: "0", color: "#5f6966", cursor: "pointer", fontSize: "15px", lineHeight: "1", padding: "2px 4px" }} className="slx22">
                              {"\u00d7"}
                            </button>
                          </div>
                        </>
                      ) : null}
                      {(c?.isGroup) ? (
                        <>
                          <div style={{ display: "flex", gap: "6px", alignItems: "stretch" }}>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "10.5px", color: "#5f6966", width: "30px", paddingTop: "12px", flex: "none" }}>
                              {c?.join}
                            </span>
                            <div style={{ flex: "1", minWidth: "0", border: "1px dashed #5a4a22", borderRadius: "10px", padding: "8px", display: "flex", flexDirection: "column", gap: "6px", background: "rgba(201,162,74,.03)" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontSize: "10px", fontWeight: "800", letterSpacing: ".1em", color: "#f0d68c" }}>
                                  {"ANY ONE OF"}
                                </span>
                                <button onClick={c?.onDelGroup} title={"Remove group"} style={{ marginLeft: "auto", background: "none", border: "0", color: "#5f6966", cursor: "pointer", fontSize: "15px", lineHeight: "1", padding: "2px 4px" }} className="slx23">
                                  {"\u00d7"}
                                </button>
                              </div>
                              {(c?.subs || []).map((s, s__i) => (
                                <Fragment key={s__i}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", border: "1px solid #1a1f21", background: "#0d0f10", borderRadius: "8px", padding: "5px 7px" }}>
                                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "10.5px", color: "#5f6966", width: "30px" }}>
                                      {s?.join}
                                    </span>
                                    <select value={s?.aInd ?? ''} onChange={s?.onA} style={{ borderRadius: "6px", background: "#121a20", color: "#fbefc9", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", maxWidth: "190px" }}>
                                      {(s?.indOpts || []).map((o, o__i) => (
                                        <Fragment key={o__i}>
                                          <option value={o?.v}>
                                            {o?.l}
                                          </option>
                                        </Fragment>
                                      ))}
                                    </select>
                                    {(s?.aHasN) ? (
                                      <>
                                        <input type={"number"} min={"1"} value={s?.aN ?? ''} onChange={s?.onAN} title={"Period"} style={{ borderRadius: "6px", width: "56px", background: "#0b0e10", color: "#e6ebe8", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontFamily: "'JetBrains Mono',monospace" }} />
                                      </>
                                    ) : null}
                                    <select value={s?.op ?? ''} onChange={s?.onOp} style={{ borderRadius: "6px", background: "#0b0e10", color: "#f0d68c", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontWeight: "700" }}>
                                      {(s?.opOpts || []).map((o, o__i) => (
                                        <Fragment key={o__i}>
                                          <option value={o}>
                                            {o}
                                          </option>
                                        </Fragment>
                                      ))}
                                    </select>
                                    {(s?.bHasMult) ? (
                                      <>
                                        <input type={"number"} step={"0.1"} value={s?.bMult ?? ''} onChange={s?.onBMult} title={"Multiplier"} style={{ borderRadius: "6px", width: "48px", background: "#0b0e10", color: "#e6ebe8", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontFamily: "'JetBrains Mono',monospace" }} />
                                        <span style={{ color: "#5f6966", fontSize: "12px" }}>
                                          {"\u00d7"}
                                        </span>
                                      </>
                                    ) : null}
                                    <select value={s?.bInd ?? ''} onChange={s?.onB} style={{ borderRadius: "6px", background: "#121a20", color: "#fbefc9", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", maxWidth: "190px" }}>
                                      {(s?.indOpts || []).map((o, o__i) => (
                                        <Fragment key={o__i}>
                                          <option value={o?.v}>
                                            {o?.l}
                                          </option>
                                        </Fragment>
                                      ))}
                                    </select>
                                    {(s?.bHasN) ? (
                                      <>
                                        <input type={"number"} min={"1"} value={s?.bN ?? ''} onChange={s?.onBN} title={"Period"} style={{ borderRadius: "6px", width: "56px", background: "#0b0e10", color: "#e6ebe8", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontFamily: "'JetBrains Mono',monospace" }} />
                                      </>
                                    ) : null}
                                    {(s?.bIsNum) ? (
                                      <>
                                        <input type={"number"} step={"any"} value={s?.bV ?? ''} onChange={s?.onBV} title={"Value"} style={{ borderRadius: "6px", width: "70px", background: "#0b0e10", color: "#e6ebe8", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontFamily: "'JetBrains Mono',monospace" }} />
                                      </>
                                    ) : null}
                                    {(s?.warn) ? (
                                      <>
                                        <span style={{ fontSize: "10px", fontWeight: "800", letterSpacing: ".06em", color: "#f08a4b", border: "1px solid #6b3a1c", padding: "2px 8px", borderRadius: "999px" }}>
                                          {"NEEDS DATA"}
                                        </span>
                                      </>
                                    ) : null}
                                    <button onClick={s?.onDel} title={"Remove condition"} style={{ marginLeft: "auto", background: "none", border: "0", color: "#5f6966", cursor: "pointer", fontSize: "15px", lineHeight: "1", padding: "2px 4px" }} className="slx24">
                                      {"\u00d7"}
                                    </button>
                                  </div>
                                </Fragment>
                              ))}
                              <button onClick={c?.onAddOr} style={{ borderRadius: "6px", alignSelf: "flex-start", background: "none", border: "1px dashed #5a4a22", color: "#f0d68c", padding: "4px 9px", fontSize: "11.5px", fontWeight: "700", cursor: "pointer" }} className="slx25">
                                {"+ OR condition"}
                              </button>
                            </div>
                          </div>
                        </>
                      ) : null}
                    </Fragment>
                  ))}
                  <button onClick={vm.labAddEntry} style={{ borderRadius: "8px", alignSelf: "flex-start", background: "none", border: "1px dashed #5a4a22", color: "#f0d68c", padding: "6px 10px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }} className="slx26">
                    {"+ Add condition"}
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".12em", color: "#7a8481", textTransform: "uppercase" }}>
                    {"Exit \u2014 any one triggers"}
                  </span>
                  {(vm.labExit || []).map((c, c__i) => (
                    <Fragment key={c__i}>
                      {(c?.single) ? (
                        <>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", border: "1px solid #1a1f21", background: "#0b0d0e", borderRadius: "10px", padding: "6px 8px" }}>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "10.5px", color: "#5f6966", width: "30px" }}>
                              {c?.join}
                            </span>
                            <select value={c?.aInd ?? ''} onChange={c?.onA} style={{ borderRadius: "6px", background: "#121a20", color: "#fbefc9", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", maxWidth: "190px" }}>
                              {(c?.indOpts || []).map((o, o__i) => (
                                <Fragment key={o__i}>
                                  <option value={o?.v}>
                                    {o?.l}
                                  </option>
                                </Fragment>
                              ))}
                            </select>
                            <span style={{ position: "relative", display: "inline-flex" }}>
                              <span role={"button"} onMouseEnter={c?.aTip?.on} onMouseLeave={c?.aTip?.off} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "15px", height: "15px", borderRadius: "50%", border: "1px solid #5a4a22", color: "#f0d68c", fontSize: "9.5px", fontWeight: "700", fontStyle: "italic", cursor: "help", lineHeight: "1" }} className="slx27">
                                {"i"}
                              </span>
                              {(c?.aTip?.open) ? (
                                <>
                                  <span style={{ position: "absolute", top: "calc(100% + 6px)", left: "-8px", zIndex: "30", width: "min(260px,70vw)", background: "#15130c", border: "1px solid #5a4a22", borderRadius: "8px", padding: "9px 11px", fontSize: "11.5px", lineHeight: "1.45", color: "#e6ebe8", boxShadow: "0 10px 30px rgba(0,0,0,.5)", textWrap: "pretty", pointerEvents: "none" }}>
                                    {c?.aTip?.txt}
                                  </span>
                                </>
                              ) : null}
                            </span>
                            {(c?.aLook) ? (
                              <>
                                <select value={c?.aNs ?? ''} onChange={c?.onAN} title={"Lookback"} style={{ borderRadius: "6px", background: "#0b0e10", color: "#e6ebe8", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontFamily: "'JetBrains Mono',monospace" }}>
                                  {(c?.lookOpts || []).map((o, o__i) => (
                                    <Fragment key={o__i}>
                                      <option value={o?.v}>
                                        {o?.l}
                                      </option>
                                    </Fragment>
                                  ))}
                                </select>
                              </>
                            ) : null}
                            {(c?.aHasN) ? (
                              <>
                                <input type={"number"} min={"1"} value={c?.aN ?? ''} onChange={c?.onAN} title={"Period"} style={{ borderRadius: "6px", width: "56px", background: "#0b0e10", color: "#e6ebe8", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontFamily: "'JetBrains Mono',monospace" }} />
                              </>
                            ) : null}
                            <select value={c?.op ?? ''} onChange={c?.onOp} style={{ borderRadius: "6px", background: "#0b0e10", color: "#f0d68c", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontWeight: "700" }}>
                              {(c?.opOpts || []).map((o, o__i) => (
                                <Fragment key={o__i}>
                                  <option value={o}>
                                    {o}
                                  </option>
                                </Fragment>
                              ))}
                            </select>
                            <span style={{ position: "relative", display: "inline-flex" }}>
                              <span role={"button"} onMouseEnter={c?.oTip?.on} onMouseLeave={c?.oTip?.off} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "15px", height: "15px", borderRadius: "50%", border: "1px solid #5a4a22", color: "#f0d68c", fontSize: "9.5px", fontWeight: "700", fontStyle: "italic", cursor: "help", lineHeight: "1" }} className="slx28">
                                {"i"}
                              </span>
                              {(c?.oTip?.open) ? (
                                <>
                                  <span style={{ position: "absolute", top: "calc(100% + 6px)", left: "-8px", zIndex: "30", width: "min(260px,70vw)", background: "#15130c", border: "1px solid #5a4a22", borderRadius: "8px", padding: "9px 11px", fontSize: "11.5px", lineHeight: "1.45", color: "#e6ebe8", boxShadow: "0 10px 30px rgba(0,0,0,.5)", textWrap: "pretty", pointerEvents: "none" }}>
                                    {c?.oTip?.txt}
                                  </span>
                                </>
                              ) : null}
                            </span>
                            {(c?.bHasMult) ? (
                              <>
                                <input type={"number"} step={"0.1"} value={c?.bMult ?? ''} onChange={c?.onBMult} title={"Multiplier"} style={{ borderRadius: "6px", width: "48px", background: "#0b0e10", color: "#e6ebe8", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontFamily: "'JetBrains Mono',monospace" }} />
                                <span style={{ color: "#5f6966", fontSize: "12px" }}>
                                  {"\u00d7"}
                                </span>
                              </>
                            ) : null}
                            <select value={c?.bInd ?? ''} onChange={c?.onB} style={{ borderRadius: "6px", background: "#121a20", color: "#fbefc9", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", maxWidth: "190px" }}>
                              {(c?.indOpts || []).map((o, o__i) => (
                                <Fragment key={o__i}>
                                  <option value={o?.v}>
                                    {o?.l}
                                  </option>
                                </Fragment>
                              ))}
                            </select>
                            <span style={{ position: "relative", display: "inline-flex" }}>
                              <span role={"button"} onMouseEnter={c?.bTip?.on} onMouseLeave={c?.bTip?.off} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "15px", height: "15px", borderRadius: "50%", border: "1px solid #5a4a22", color: "#f0d68c", fontSize: "9.5px", fontWeight: "700", fontStyle: "italic", cursor: "help", lineHeight: "1" }} className="slx29">
                                {"i"}
                              </span>
                              {(c?.bTip?.open) ? (
                                <>
                                  <span style={{ position: "absolute", top: "calc(100% + 6px)", right: "-8px", zIndex: "30", width: "min(260px,70vw)", background: "#15130c", border: "1px solid #5a4a22", borderRadius: "8px", padding: "9px 11px", fontSize: "11.5px", lineHeight: "1.45", color: "#e6ebe8", boxShadow: "0 10px 30px rgba(0,0,0,.5)", textWrap: "pretty", pointerEvents: "none" }}>
                                    {c?.bTip?.txt}
                                  </span>
                                </>
                              ) : null}
                            </span>
                            {(c?.bLook) ? (
                              <>
                                <select value={c?.bNs ?? ''} onChange={c?.onBN} title={"Lookback"} style={{ borderRadius: "6px", background: "#0b0e10", color: "#e6ebe8", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontFamily: "'JetBrains Mono',monospace" }}>
                                  {(c?.lookOpts || []).map((o, o__i) => (
                                    <Fragment key={o__i}>
                                      <option value={o?.v}>
                                        {o?.l}
                                      </option>
                                    </Fragment>
                                  ))}
                                </select>
                              </>
                            ) : null}
                            {(c?.bHasN) ? (
                              <>
                                <input type={"number"} min={"1"} value={c?.bN ?? ''} onChange={c?.onBN} title={"Period"} style={{ borderRadius: "6px", width: "56px", background: "#0b0e10", color: "#e6ebe8", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontFamily: "'JetBrains Mono',monospace" }} />
                              </>
                            ) : null}
                            {(c?.bIsNum) ? (
                              <>
                                <input type={"number"} step={"any"} value={c?.bV ?? ''} onChange={c?.onBV} title={"Value"} style={{ borderRadius: "6px", width: "70px", background: "#0b0e10", color: "#e6ebe8", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontFamily: "'JetBrains Mono',monospace" }} />
                              </>
                            ) : null}
                            {(c?.warn) ? (
                              <>
                                <span style={{ fontSize: "10px", fontWeight: "800", letterSpacing: ".06em", color: "#f08a4b", border: "1px solid #6b3a1c", padding: "2px 8px", borderRadius: "999px" }}>
                                  {"NEEDS DATA"}
                                </span>
                              </>
                            ) : null}
                            <button onClick={c?.onOr} title={"Add an OR alternative to this condition"} style={{ borderRadius: "6px", background: "none", border: "1px solid #263033", color: "#f0d68c", cursor: "pointer", fontSize: "10.5px", fontWeight: "800", letterSpacing: ".06em", padding: "3px 7px" }} className="slx30">
                              {"+ OR"}
                            </button>
                            <button onClick={c?.onDel} title={"Remove condition"} style={{ marginLeft: "auto", background: "none", border: "0", color: "#5f6966", cursor: "pointer", fontSize: "15px", lineHeight: "1", padding: "2px 4px" }} className="slx31">
                              {"\u00d7"}
                            </button>
                          </div>
                        </>
                      ) : null}
                      {(c?.isGroup) ? (
                        <>
                          <div style={{ display: "flex", gap: "6px", alignItems: "stretch" }}>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "10.5px", color: "#5f6966", width: "30px", paddingTop: "12px", flex: "none" }}>
                              {c?.join}
                            </span>
                            <div style={{ flex: "1", minWidth: "0", border: "1px dashed #5a4a22", borderRadius: "10px", padding: "8px", display: "flex", flexDirection: "column", gap: "6px", background: "rgba(201,162,74,.03)" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontSize: "10px", fontWeight: "800", letterSpacing: ".1em", color: "#f0d68c" }}>
                                  {"ANY ONE OF"}
                                </span>
                                <button onClick={c?.onDelGroup} title={"Remove group"} style={{ marginLeft: "auto", background: "none", border: "0", color: "#5f6966", cursor: "pointer", fontSize: "15px", lineHeight: "1", padding: "2px 4px" }} className="slx32">
                                  {"\u00d7"}
                                </button>
                              </div>
                              {(c?.subs || []).map((s, s__i) => (
                                <Fragment key={s__i}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", border: "1px solid #1a1f21", background: "#0d0f10", borderRadius: "8px", padding: "5px 7px" }}>
                                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "10.5px", color: "#5f6966", width: "30px" }}>
                                      {s?.join}
                                    </span>
                                    <select value={s?.aInd ?? ''} onChange={s?.onA} style={{ borderRadius: "6px", background: "#121a20", color: "#fbefc9", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", maxWidth: "190px" }}>
                                      {(s?.indOpts || []).map((o, o__i) => (
                                        <Fragment key={o__i}>
                                          <option value={o?.v}>
                                            {o?.l}
                                          </option>
                                        </Fragment>
                                      ))}
                                    </select>
                                    {(s?.aHasN) ? (
                                      <>
                                        <input type={"number"} min={"1"} value={s?.aN ?? ''} onChange={s?.onAN} title={"Period"} style={{ borderRadius: "6px", width: "56px", background: "#0b0e10", color: "#e6ebe8", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontFamily: "'JetBrains Mono',monospace" }} />
                                      </>
                                    ) : null}
                                    <select value={s?.op ?? ''} onChange={s?.onOp} style={{ borderRadius: "6px", background: "#0b0e10", color: "#f0d68c", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontWeight: "700" }}>
                                      {(s?.opOpts || []).map((o, o__i) => (
                                        <Fragment key={o__i}>
                                          <option value={o}>
                                            {o}
                                          </option>
                                        </Fragment>
                                      ))}
                                    </select>
                                    {(s?.bHasMult) ? (
                                      <>
                                        <input type={"number"} step={"0.1"} value={s?.bMult ?? ''} onChange={s?.onBMult} title={"Multiplier"} style={{ borderRadius: "6px", width: "48px", background: "#0b0e10", color: "#e6ebe8", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontFamily: "'JetBrains Mono',monospace" }} />
                                        <span style={{ color: "#5f6966", fontSize: "12px" }}>
                                          {"\u00d7"}
                                        </span>
                                      </>
                                    ) : null}
                                    <select value={s?.bInd ?? ''} onChange={s?.onB} style={{ borderRadius: "6px", background: "#121a20", color: "#fbefc9", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", maxWidth: "190px" }}>
                                      {(s?.indOpts || []).map((o, o__i) => (
                                        <Fragment key={o__i}>
                                          <option value={o?.v}>
                                            {o?.l}
                                          </option>
                                        </Fragment>
                                      ))}
                                    </select>
                                    {(s?.bHasN) ? (
                                      <>
                                        <input type={"number"} min={"1"} value={s?.bN ?? ''} onChange={s?.onBN} title={"Period"} style={{ borderRadius: "6px", width: "56px", background: "#0b0e10", color: "#e6ebe8", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontFamily: "'JetBrains Mono',monospace" }} />
                                      </>
                                    ) : null}
                                    {(s?.bIsNum) ? (
                                      <>
                                        <input type={"number"} step={"any"} value={s?.bV ?? ''} onChange={s?.onBV} title={"Value"} style={{ borderRadius: "6px", width: "70px", background: "#0b0e10", color: "#e6ebe8", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontFamily: "'JetBrains Mono',monospace" }} />
                                      </>
                                    ) : null}
                                    {(s?.warn) ? (
                                      <>
                                        <span style={{ fontSize: "10px", fontWeight: "800", letterSpacing: ".06em", color: "#f08a4b", border: "1px solid #6b3a1c", padding: "2px 8px", borderRadius: "999px" }}>
                                          {"NEEDS DATA"}
                                        </span>
                                      </>
                                    ) : null}
                                    <button onClick={s?.onDel} title={"Remove condition"} style={{ marginLeft: "auto", background: "none", border: "0", color: "#5f6966", cursor: "pointer", fontSize: "15px", lineHeight: "1", padding: "2px 4px" }} className="slx33">
                                      {"\u00d7"}
                                    </button>
                                  </div>
                                </Fragment>
                              ))}
                              <button onClick={c?.onAddOr} style={{ borderRadius: "6px", alignSelf: "flex-start", background: "none", border: "1px dashed #5a4a22", color: "#f0d68c", padding: "4px 9px", fontSize: "11.5px", fontWeight: "700", cursor: "pointer" }} className="slx34">
                                {"+ OR condition"}
                              </button>
                            </div>
                          </div>
                        </>
                      ) : null}
                    </Fragment>
                  ))}
                  <button onClick={vm.labAddExit} style={{ borderRadius: "8px", alignSelf: "flex-start", background: "none", border: "1px dashed #5a4a22", color: "#f0d68c", padding: "6px 10px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }} className="slx35">
                    {"+ Add condition"}
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", borderTop: "1px solid #1a2328", paddingTop: "16px" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".12em", color: "#f0d68c" }}>
                      {"AFTER ENTRY"}
                    </span>
                    <span style={{ fontSize: "11.5px", color: "#7a8481", textWrap: "pretty" }}>
                      {vm.xpSum}
                    </span>
                    <button onClick={vm.xpMore?.onClick} style={{ marginLeft: "auto", background: "none", border: "0", padding: "0", color: "#f0d68c", fontSize: "11.5px", fontWeight: "700", cursor: "pointer" }} className="slx36">
                      {vm.xpMore?.l}
                    </button>
                  </div>
                  <div style={{ display: "flex", gap: "12px 18px", flexWrap: "wrap", alignItems: "center" }}>
                    {(vm.xpRows || []).map((r, r__i) => (
                      <Fragment key={r__i}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".1em", color: "#7a8481" }}>
                            {r?.t}
                          </span>
                          {(r?.segs || []).map((s, s__i) => (
                            <Fragment key={s__i}>
                              <div style={{ display: "flex", gap: "3px", background: "#08090a", border: "1px solid #1a1f21", borderRadius: "9px", padding: "3px" }}>
                                {(s?.opts || []).map((o, o__i) => (
                                  <Fragment key={o__i}>
                                    <button onClick={o?.onClick} style={{ borderRadius: "7px", border: "0", background: o?.bg, color: o?.c, padding: "6px 11px", fontSize: "12px", fontWeight: "700", cursor: o?.cur, whiteSpace: "nowrap" }}>
                                      {o?.l}
                                    </button>
                                  </Fragment>
                                ))}
                              </div>
                            </Fragment>
                          ))}
                          {(r?.note) ? (
                            <>
                              <span style={{ fontSize: "11px", color: "#5f6966" }}>
                                {r?.note}
                              </span>
                            </>
                          ) : null}
                        </div>
                      </Fragment>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", flexWrap: "wrap" }}>
                  {(vm.aiEditing) ? (
                    <>
                      <button onClick={vm.aiEditCancel} style={{ borderRadius: "8px", border: "1px solid #263033", background: "transparent", color: "#aab3b0", padding: "9px 16px", fontWeight: "700", fontSize: "12.5px", cursor: "pointer", marginRight: "auto" }} className="slx37">
                        {"Cancel"}
                      </button>
                    </>
                  ) : null}
                  <button onClick={vm.aiEditClose} style={{ borderRadius: "8px", border: "1px solid #5a4a22", background: "transparent", color: "#fbefc9", padding: "9px 16px", fontWeight: "700", fontSize: "12.5px", cursor: "pointer" }} className="slx38">
                    {vm.aiDoneL}
                  </button>
                  <button onClick={vm.aiEditRun} style={{ borderRadius: "8px", border: "1px solid #c9a24a", background: "#c9a24a", color: "#08090a", padding: "9px 16px", fontWeight: "800", fontSize: "12.5px", cursor: "pointer" }} className="slx39">
                    {vm.aiRunL}
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : null}
        {(vm.labS1) ? (
          <>
            <div ref={libRef} style={{ display: "flex", alignItems: "flex-end", gap: "0", flexWrap: "wrap", borderBottom: "1px solid #233038", marginBottom: "-4px" }}>
              {(vm.libTabs || []).map((t, t__i) => (
                <Fragment key={t__i}>
                  <button onClick={t?.onClick} style={{ display: "flex", alignItems: "center", gap: "8px", background: "none", border: "0", borderBottom: `2px solid ${t?.bd ?? ''}`, marginBottom: "-1px", padding: "4px 18px 8px 0", marginRight: "18px", cursor: "pointer", color: t?.c, fontFamily: "'Barlow Condensed',Manrope,sans-serif", fontWeight: "600", fontSize: "22px" }} className="slx40">
                    {t?.l}
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "11px", fontWeight: "400", color: "#7a8481" }}>
                      {t?.n}
                    </span>
                  </button>
                </Fragment>
              ))}
            </div>
            {(vm.libEmpty) ? (
              <>
                <div style={{ border: "1px dashed #5a4a22", borderRadius: "12px", padding: "28px", textAlign: "center", display: "flex", flexDirection: "column", gap: "6px", alignItems: "center" }}>
                  <span style={{ fontFamily: "'Barlow Condensed',Manrope,sans-serif", fontWeight: "600", fontSize: "22px", color: "#eef2f4" }}>
                    {"No saved strategies yet"}
                  </span>
                  <span style={{ fontSize: "13px", color: "#8b9592" }}>
                    {"Describe one in the search box above, then click \u201cSave strategy\u201d."}
                  </span>
                </div>
              </>
            ) : null}
            {(vm.libHas) ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(220px,300px) minmax(0,1fr)", gap: "18px", alignItems: "start" }}>
                  <div style={{ position: "relative", border: "1px solid #1a1f21", background: "#0d0f10", borderRadius: "12px", display: "flex", flexDirection: "column", gap: "6px", padding: "8px", position: "sticky", top: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", border: "1px solid #263033", borderRadius: "10px", background: "#08090a", padding: "0 10px" }} className="slx41">
                      <svg width={"15"} height={"15"} viewBox={"0 0 24 24"} fill={"none"} stroke={"#7a8481"} strokeWidth={"1.5"}>
                        <circle cx={"11"} cy={"11"} r={"7"} />
                        <path d={"m20 20-3.5-3.5"} />
                      </svg>
                      <input value={vm.libQ ?? ''} onChange={vm.onLibQ} placeholder={"Search strategies, e.g. breakout, RSI, Connors"} style={{ flex: "1", minWidth: "0", background: "transparent", border: "0", color: "#eef2f4", padding: "10px 0", fontSize: "13px", outline: "none" }} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px", fontSize: "11px", color: "#5f6966" }}>
                      <span>
                        {vm.libCount}
                      </span>
                      {(vm.libQ) ? (
                        <>
                          <button onClick={vm.libClear} style={{ background: "none", border: "0", padding: "0", color: "#f0d68c", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}>
                            {"Clear"}
                          </button>
                        </>
                      ) : null}
                    </div>
                    {(vm.libNone) ? (
                      <>
                        <div style={{ padding: "18px 10px", textAlign: "center", fontSize: "12.5px", color: "#8b9592" }}>
                          {"No strategies match \u201c"}
                          {vm.libQ}
                          {"\u201d."}
                        </div>
                      </>
                    ) : null}
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "640px", overflowY: "auto", scrollbarWidth: "thin", scrollbarColor: "#c9a24a #15130c" }}>
                      {(vm.pickList || []).map((p, p__i) => (
                        <Fragment key={p__i}>
                          <button onClick={p?.onClick} style={{ borderRadius: "8px", display: "flex", flexDirection: "column", gap: "3px", textAlign: "left", border: `1px solid ${p?.bl ?? ''}`, borderRadius: "10px", background: p?.bg, padding: "11px 13px", cursor: "pointer", color: "#e6ebe8", transition: "background .15s,box-shadow .15s" }} className="slx42">
                            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ fontSize: "9.5px", fontWeight: "800", letterSpacing: ".1em", color: "#f0d68c", textTransform: "uppercase" }}>
                                {p?.fam}
                              </span>
                            </span>
                            <span style={{ fontFamily: "'Barlow Condensed',Manrope,sans-serif", fontWeight: "600", fontSize: "18px", lineHeight: "1.1", color: p?.c }}>
                              {p?.name}
                            </span>
                            {(p?.auto) ? (
                              <>
                                <span style={{ alignSelf: "flex-start", fontSize: "9.5px", fontWeight: "800", letterSpacing: ".08em", padding: "2px 8px", borderRadius: "999px", border: "1px solid #1f4a33", color: "#3ddc84" }}>
                                  {p?.auto}
                                </span>
                              </>
                            ) : null}
                          </button>
                        </Fragment>
                      ))}
                    </div>
                  </div>
                  {(vm.libNoPick) ? (
                    <>
                      <div style={{ border: "1px dashed #263033", borderRadius: "14px", minHeight: "220px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", padding: "32px", textAlign: "center" }}>
                        <svg width={"28"} height={"28"} viewBox={"0 0 24 24"} fill={"none"} stroke={"#5a4a22"} strokeWidth={"1.5"}>
                          <path d={"M9 6l6 6-6 6"} />
                        </svg>
                        <span style={{ fontFamily: "'Barlow Condensed',Manrope,sans-serif", fontWeight: "600", fontSize: "22px", color: "#eef2f4" }}>
                          {"Select a strategy to see its findings"}
                        </span>
                        <span style={{ fontSize: "13px", color: "#7a8481", maxWidth: "42ch" }}>
                          {"Pick one from the list to see what it is, its rules, and the backtest results across every tracked US stock."}
                        </span>
                      </div>
                    </>
                  ) : null}
                  {(vm.libShowDetail) ? (
                    <>
                      <div ref={detRef} style={{ scrollMarginTop: "110px", position: "relative", border: "1px solid #2a2618", background: "#0d0f10", borderRadius: "14px", padding: "22px 24px", display: "flex", flexDirection: "column", gap: "20px", minWidth: "0" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px 18px" }}>
                          <div style={{ flex: "0 1 auto", minWidth: "0", maxWidth: "100%" }}>
                            {(vm.pk?.showFam) ? (
                              <>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", fontSize: "10px", fontWeight: "800", letterSpacing: ".1em", color: "#f0d68c", textTransform: "uppercase" }}>
                                  <span>
                                    {vm.pk?.fam}
                                  </span>
                                </div>
                              </>
                            ) : null}
                            <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "10px", marginTop: "4px" }}>
                              <span title={vm.pk?.name} style={{ fontFamily: "'Barlow Condensed',Manrope,sans-serif", fontWeight: "600", fontSize: "30px", lineHeight: "1.05", color: "#eef2f4", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: "0" }}>
                                {vm.pk?.name}
                              </span>
                              <span onMouseEnter={vm.pk?.whatIn} onMouseLeave={vm.pk?.whatOut} style={{ flex: "none", display: "flex", padding: "6px 0" }}>
                                <button onClick={vm.pk?.toggleWhat} onFocus={vm.pk?.whatIn} onBlur={vm.pk?.whatOut} aria-label={"What it is"} style={{ flex: "none", width: "20px", height: "20px", borderRadius: "50%", border: "1px solid #5a4a22", background: vm.pk?.whatBg, color: "#f0d68c", fontSize: "11px", fontWeight: "800", fontStyle: "italic", fontFamily: "Georgia,serif", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: "0" }} className="slx43">
                                  {"i"}
                                </button>
                                {(vm.pk?.whatOpen) ? (
                                  <>
                                    <div style={{ position: "absolute", top: "100%", left: "0", zIndex: "20", width: "min(460px,calc(100vw - 48px))", maxWidth: "calc(100vw - 48px)", background: "#121314", border: "1px solid #5a4a22", borderRadius: "12px", padding: "14px 16px", boxShadow: "0 12px 32px rgba(0,0,0,.55),0 0 24px rgba(201,162,74,.10)", display: "flex", flexDirection: "column", gap: "8px" }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".12em", color: "#f0d68c" }}>
                                          {"WHAT IT IS"}
                                        </span>
                                      </div>
                                      <div style={{ fontSize: "13.5px", lineHeight: "1.6", color: "#cfd6d3", textWrap: "pretty" }}>
                                        {vm.pk?.what}
                                      </div>
                                    </div>
                                  </>
                                ) : null}
                              </span>
                            </div>
                          </div>
                          <div style={{ flex: "1 1 auto", display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                            {(vm.pk?.canSave) ? (
                              <>
                                <button onClick={vm.pk?.onSave} style={{ borderRadius: "8px", border: "1px solid #5a4a22", background: "transparent", color: "#fbefc9", padding: "9px 14px", fontWeight: "700", fontSize: "12.5px", cursor: "pointer" }} className="slx44">
                                  {"Save strategy"}
                                </button>
                              </>
                            ) : null}
                            {(vm.pk?.canAuto) ? (
                              <>
                                <button onClick={vm.pk?.onAuto} style={{ borderRadius: "8px", border: `1px solid ${vm.pk?.autoBd ?? ''}`, background: "transparent", color: vm.pk?.autoC, padding: "9px 14px", fontWeight: "700", fontSize: "12.5px", cursor: "pointer", display: "flex", alignItems: "center", gap: "7px" }} className="slx45">
                                  <svg width={"14"} height={"14"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"1.5"}>
                                    <path d={"M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"} />
                                    <path d={"M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"} />
                                  </svg>
                                  {vm.pk?.autoL}
                                </button>
                              </>
                            ) : null}
                            {(vm.pk?.canEdit) ? (
                              <>
                                <button onClick={vm.pk?.onEdit} style={{ borderRadius: "8px", border: "1px solid #5a4a22", background: "transparent", color: "#fbefc9", padding: "9px 14px", fontWeight: "700", fontSize: "12.5px", cursor: "pointer", display: "flex", alignItems: "center", gap: "7px" }} className="slx46">
                                  <svg width={"13"} height={"13"} viewBox={"0 0 24 24"} fill={"none"} stroke={"currentColor"} strokeWidth={"1.5"}>
                                    <path d={"M12 20h9"} />
                                    <path d={"M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"} />
                                  </svg>
                                  {"Edit"}
                                </button>
                              </>
                            ) : null}
                            {(vm.dv?.primary) ? (
                              <>
                                <button onClick={vm.dv?.run} style={{ borderRadius: "8px", border: "1px solid #c9a24a", background: "#c9a24a", color: "#08090a", padding: "9px 16px", fontWeight: "800", fontSize: "12.5px", cursor: "pointer" }} className="slx47">
                                  {vm.dv?.btn}
                                </button>
                              </>
                            ) : null}
                            {(vm.dv?.secondary) ? (
                              <>
                                <button onClick={vm.dv?.run} style={{ borderRadius: "8px", border: "1px solid #5a4a22", background: "transparent", color: "#fbefc9", padding: "9px 16px", fontWeight: "700", fontSize: "12.5px", cursor: "pointer" }} className="slx48">
                                  {"Re-run backtest"}
                                </button>
                              </>
                            ) : null}
                            {(vm.pk?.canDel) ? (
                              <>
                                <span style={{ marginLeft: "auto", paddingLeft: "14px", display: "flex", gap: "8px", alignItems: "center" }}>
                                  {(vm.pk?.delAsk) ? (
                                    <>
                                      <span style={{ fontSize: "12.5px", color: "#f0a0a2" }}>
                                        {"Delete this strategy?"}
                                      </span>
                                      <button onClick={vm.pk?.delNo} style={{ borderRadius: "8px", border: "1px solid #263033", background: "transparent", color: "#aab3b0", padding: "9px 12px", fontWeight: "700", fontSize: "12.5px", cursor: "pointer" }} className="slx49">
                                        {"Cancel"}
                                      </button>
                                      <button onClick={vm.pk?.delYes} style={{ borderRadius: "8px", border: "1px solid #f0565a", background: "#f0565a", color: "#08090a", padding: "9px 14px", fontWeight: "800", fontSize: "12.5px", cursor: "pointer" }} className="slx50">
                                        {"Delete"}
                                      </button>
                                    </>
                                  ) : null}
                                  {(vm.pk?.delIdle) ? (
                                    <>
                                      <button onClick={vm.pk?.onDel} style={{ borderRadius: "8px", border: "1px solid #3a2224", background: "transparent", color: "#f0a0a2", padding: "9px 14px", fontWeight: "700", fontSize: "12.5px", cursor: "pointer" }} className="slx51">
                                        {"Delete"}
                                      </button>
                                    </>
                                  ) : null}
                                </span>
                              </>
                            ) : null}
                          </div>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", alignItems: "flex-start" }}>
                          {(vm.dv?.show) ? (
                            <>
                              <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: "0 1 auto", minWidth: "0" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                                  <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".1em", color: "#7a8481", minWidth: "118px" }}>
                                    {"CANDLE"}
                                  </span>
                                  <div style={{ display: "flex", gap: "3px", flexWrap: "wrap", background: "#08090a", border: "1px solid #1a1f21", borderRadius: "9px", padding: "3px" }}>
                                    {(vm.dv?.candleOpts || []).map((o, o__i) => (
                                      <Fragment key={o__i}>
                                        <button onClick={o?.onClick} style={{ borderRadius: "7px", border: "0", background: o?.bg, color: o?.c, padding: "5px 11px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }} className="slx52">
                                          {o?.l}
                                        </button>
                                      </Fragment>
                                    ))}
                                  </div>
                                  {(vm.dv?.candleNote) ? (
                                    <>
                                      <span style={{ fontSize: "11px", color: "#5f6966" }}>
                                        {vm.dv?.candleNote}
                                      </span>
                                    </>
                                  ) : null}
                                </div>
                                {(vm.dv?.hasPeriod) ? (
                                  <>
                                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                                      <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".1em", color: "#7a8481", minWidth: "118px" }}>
                                        {"BACKTEST PERIOD"}
                                      </span>
                                      <div style={{ display: "flex", gap: "3px", background: "#08090a", border: "1px solid #1a1f21", borderRadius: "9px", padding: "3px" }}>
                                        {(vm.dv?.periodOpts || []).map((o, o__i) => (
                                          <Fragment key={o__i}>
                                            <button onClick={o?.onClick} style={{ borderRadius: "7px", border: "0", background: o?.bg, color: o?.c, padding: "5px 11px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
                                              {o?.l}
                                            </button>
                                          </Fragment>
                                        ))}
                                      </div>
                                    </div>
                                  </>
                                ) : null}
                              </div>
                            </>
                          ) : null}
                          <div style={{ flex: "1 1 260px", minWidth: "0", display: "grid", gridTemplateColumns: "62px minmax(0,1fr)", gap: "8px 12px", fontSize: "13px", border: "1px solid #1a1f21", background: "#0b0d0e", borderRadius: "10px", padding: "12px 14px", alignContent: "start" }}>
                            <span style={{ color: "#5f6966", fontWeight: "700", fontSize: "10.5px", letterSpacing: ".08em", paddingTop: "2px" }}>
                              {"ENTRY"}
                            </span>
                            <span style={{ color: "#e6ebe8" }}>
                              {vm.pk?.entry}
                            </span>
                            <span style={{ color: "#5f6966", fontWeight: "700", fontSize: "10.5px", letterSpacing: ".08em", paddingTop: "2px" }}>
                              {"EXIT"}
                            </span>
                            <span style={{ color: "#e6ebe8" }}>
                              {vm.pk?.exit}
                            </span>
                            <span style={{ color: "#5f6966", fontWeight: "700", fontSize: "10.5px", letterSpacing: ".08em", paddingTop: "2px" }}>
                              {"SOURCE"}
                            </span>
                            <span style={{ color: "#8b9592" }}>
                              {vm.pk?.src}
                            </span>
                          </div>
                        </div>
                        {(vm.dv?.show) ? (
                          <>
                            <div style={{ display: "flex", flexDirection: "column", gap: "14px", minWidth: "0" }}>
                              <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
                                <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".12em", color: "#7a8481" }}>
                                  {"BACKTEST RESULTS"}
                                </span>
                                <span style={{ fontFamily: "'Barlow Condensed',Manrope,sans-serif", fontWeight: "600", fontSize: "20px", color: "#eef2f4" }}>
                                  {vm.dv?.head}
                                </span>
                                <span style={{ fontSize: "11.5px", color: "#5f6966", marginLeft: "auto" }}>
                                  {vm.dv?.meta}
                                </span>
                              </div>
                              {(vm.dv?.busy) ? (
                                <>
                                  <div style={{ height: "3px", background: "#15191b", borderRadius: "2px", overflow: "hidden" }}>
                                    <div style={{ height: "3px", width: vm.dv?.pct, background: "#c9a24a", transition: "width .2s" }}>
                                    </div>
                                  </div>
                                </>
                              ) : null}
                              {(vm.dv?.err) ? (
                                <>
                                  <div style={{ fontSize: "13px", color: "#f08a4b", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                                    <span>
                                      {vm.dv?.err}
                                    </span>
                                  </div>
                                </>
                              ) : null}
                              {(vm.dv?.stale) ? (
                                <>
                                  <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "12.5px", color: "#f08a4b" }}>
                                    {"Rules changed since this run."}
                                    <button onClick={vm.dv?.run} style={{ borderRadius: "8px", border: "1px solid #6b3a1c", background: "transparent", color: "#f7c9a8", padding: "4px 10px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
                                      {"Re-run"}
                                    </button>
                                  </div>
                                </>
                              ) : null}
                              {(vm.dv?.idle) ? (
                                <>
                                  <div style={{ fontSize: "13px", color: "#8b9592", lineHeight: "1.55", border: "1px dashed #263033", borderRadius: "10px", padding: "16px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                                    <span>
                                      {vm.dv?.idleT}
                                    </span>
                                  </div>
                                </>
                              ) : null}
                              {(vm.dv?.hasSum) ? (
                                <>
                                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(96px,1fr))", gap: "1px", background: "#1a1f21", border: "1px solid #1a1f21", borderRadius: "10px", overflow: "hidden" }}>
                                    {(vm.dv?.sum || []).map((f, f__i) => (
                                      <Fragment key={f__i}>
                                        <div style={{ background: "#0d0f10", padding: "9px 11px" }}>
                                          <div style={{ fontSize: "9.5px", fontWeight: "700", letterSpacing: ".08em", color: "#5f6966" }}>
                                            {f?.k}
                                          </div>
                                          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "15px", color: f?.c, marginTop: "2px" }}>
                                            {f?.v}
                                          </div>
                                        </div>
                                      </Fragment>
                                    ))}
                                  </div>
                                </>
                              ) : null}
                              {(vm.dv?.noneReady) ? (
                                <>
                                  <div style={{ fontSize: "13px", color: "#8b9592", border: "1px dashed #263033", borderRadius: "10px", padding: "16px" }}>
                                    {"No stock meets the rules right now. The summary above shows how the strategy has performed historically."}
                                  </div>
                                </>
                              ) : null}
                              {(vm.dv?.hasRows) ? (
                                <>
                                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                                    <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".1em", color: "#7a8481" }}>
                                      {"RETURN OVER"}
                                    </span>
                                    <div style={{ display: "flex", gap: "3px", background: "#08090a", border: "1px solid #1a1f21", borderRadius: "9px", padding: "3px" }}>
                                      {(vm.dv?.winOpts || []).map((o, o__i) => (
                                        <Fragment key={o__i}>
                                          <button onClick={o?.onClick} style={{ borderRadius: "7px", border: "0", background: o?.bg, color: o?.c, padding: "4px 10px", fontSize: "11.5px", fontWeight: "700", cursor: "pointer" }}>
                                            {o?.l}
                                          </button>
                                        </Fragment>
                                      ))}
                                    </div>
                                    <span style={{ fontSize: "11px", color: "#5f6966" }}>
                                      {"Strategy vs buy "}
                                      {"&"}
                                      {" hold over the last window of the backtest"}
                                    </span>
                                  </div>
                                </>
                              ) : null}
                              {(vm.dv?.hasRows) ? (
                                <>
                                  <div style={{ display: "flex", flexDirection: "column", maxHeight: "300px", overflowY: "auto", overflowX: "hidden", scrollbarWidth: "thin", scrollbarColor: "#c9a24a #15130c" }}>
                                    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.5fr) repeat(4,minmax(0,1fr))", gap: "6px", padding: "0 8px 6px", fontSize: "9.5px", fontWeight: "700", letterSpacing: ".08em", color: "#5f6966", position: "sticky", top: "0", background: "#0b0c0d" }}>
                                      <span>
                                        {"STOCK"}
                                      </span>
                                      <span style={{ textAlign: "center" }}>
                                        {vm.dv?.retHdr}
                                      </span>
                                      <span style={{ textAlign: "right" }} title={"Strategy return minus buy-and-hold return over the same window"}>
                                        {"VS B"}
                                        {"&"}
                                        {"H"}
                                      </span>
                                      <span style={{ textAlign: "right" }}>
                                        {"WIN %"}
                                      </span>
                                      <span style={{ textAlign: "center" }}>
                                        {"TRADES"}
                                      </span>
                                    </div>
                                    {(vm.dv?.rows || []).map((r, r__i) => (
                                      <Fragment key={r__i}>
                                        <button onClick={r?.onClick} title={`Open the full backtest on ${r?.t ?? ''}`} style={{ display: "grid", gridTemplateColumns: "minmax(0,1.5fr) repeat(4,minmax(0,1fr))", gap: "6px", alignItems: "center", background: "transparent", border: "0", borderTop: "1px solid #15191b", borderRadius: "8px", padding: "8px", color: "#e6ebe8", cursor: "pointer", textAlign: "left" }} className="slx53">
                                          <span style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: "0" }}>
                                            <span style={{ position: "relative", width: "24px", height: "24px", flex: "none", borderRadius: "6px", background: "#1a1f21", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "8px", fontWeight: "800", color: "#f0d68c", overflow: "hidden" }}>
                                              {r?.ini}
                                              <img src={r?.logo || undefined} onError={hideImg} alt={""} style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "contain", background: "#fff", padding: "2px" }} />
                                            </span>
                                            <span style={{ display: "flex", flexDirection: "column", minWidth: "0" }}>
                                              <span style={{ fontWeight: "800", fontSize: "12.5px" }}>
                                                {r?.t}
                                              </span>
                                              <span style={{ fontSize: "10.5px", color: "#7a8481", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                {r?.n}
                                              </span>
                                            </span>
                                          </span>
                                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "12px", textAlign: "center" }}>
                                            {r?.cagr}
                                          </span>
                                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "12px", textAlign: "right", color: r?.exC }}>
                                            {r?.ex}
                                          </span>
                                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "12px", textAlign: "right" }}>
                                            {r?.win}
                                          </span>
                                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "12px", textAlign: "center", color: "#aab3b0" }}>
                                            {r?.tr}
                                          </span>
                                        </button>
                                      </Fragment>
                                    ))}
                                  </div>
                                </>
                              ) : null}
                            </div>
                          </>
                        ) : null}
                        {(vm.scShow) ? (
                          <>
                            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                              <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
                                <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".12em", color: "#7a8481" }}>
                                  {"STOCKS FOLLOWING THIS STRATEGY"}
                                </span>
                                <span style={{ fontFamily: "'Barlow Condensed',Manrope,sans-serif", fontWeight: "600", fontSize: "20px", color: "#eef2f4" }}>
                                  {vm.scHead}
                                </span>
                                <span style={{ fontSize: "11.5px", color: "#5f6966", marginLeft: "auto" }}>
                                  {vm.scMeta}
                                </span>
                              </div>
                              {(vm.scBusy) ? (
                                <>
                                  <div style={{ height: "2px", background: "#12181b" }}>
                                    <div style={{ height: "2px", width: vm.scPct, background: "#c9a24a", transition: "width .2s" }}>
                                    </div>
                                  </div>
                                </>
                              ) : null}
                              {(vm.scErr) ? (
                                <>
                                  <div style={{ fontSize: "13px", color: "#f08a4b" }}>
                                    {vm.scErr}
                                  </div>
                                </>
                              ) : null}
                              {(vm.scEmpty) ? (
                                <>
                                  <div style={{ fontSize: "13px", color: "#8b9592", border: "1px dashed #263033", borderRadius: "12px", padding: "16px" }}>
                                    {vm.scEmptyT}
                                  </div>
                                </>
                              ) : null}
                              {(vm.scGroups || []).map((g, g__i) => (
                                <Fragment key={g__i}>
                                  <div style={{ display: "flex", flexDirection: "column" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 0" }}>
                                      <span style={{ width: "7px", height: "7px", background: g?.c }}>
                                      </span>
                                      <span style={{ fontSize: "10.5px", fontWeight: "800", letterSpacing: ".1em", color: g?.c }}>
                                        {g?.label}
                                      </span>
                                      <span style={{ fontSize: "11.5px", color: "#5f6966" }}>
                                        {g?.sub}
                                      </span>
                                    </div>
                                    {(g?.rows || []).map((r, r__i) => (
                                      <Fragment key={r__i}>
                                        <div style={{ display: "grid", gridTemplateColumns: "minmax(150px,220px) minmax(0,1fr) auto", gap: "14px", alignItems: "center", borderTop: "1px solid #15191b", padding: "10px 8px", borderRadius: "8px" }} className="slx54">
                                          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: "0" }}>
                                            <span style={{ position: "relative", width: "30px", height: "30px", flex: "none", border: "1px solid #1a1f21", background: "#1a1f21", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: "800", color: "#f0d68c", overflow: "hidden" }}>
                                              {r?.ini}
                                              <img src={r?.logo || undefined} onError={hideImg} alt={""} style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "contain", background: "#fff", padding: "3px" }} />
                                            </span>
                                            <span style={{ display: "flex", flexDirection: "column", minWidth: "0" }}>
                                              <span style={{ fontWeight: "800", fontSize: "13.5px" }}>
                                                {r?.t}
                                                {" "}
                                                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: "400", fontSize: "12px", color: "#aab3b0" }}>
                                                  {r?.px}
                                                </span>
                                                {" "}
                                                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: "400", fontSize: "12px", color: r?.chC }}>
                                                  {r?.ch}
                                                </span>
                                              </span>
                                              <span style={{ fontSize: "11.5px", color: "#7a8481", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                {r?.n}
                                              </span>
                                            </span>
                                          </div>
                                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", minWidth: "0" }}>
                                            <span style={{ fontSize: "11px", fontWeight: "700", color: r?.whenC, padding: "3px 0", marginRight: "4px" }}>
                                              {r?.when}
                                            </span>
                                            {(r?.conds || []).map((c, c__i) => (
                                              <Fragment key={c__i}>
                                                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "11px", padding: "3px 9px", borderRadius: "999px", border: `1px solid ${c?.bd ?? ''}`, color: c?.col }} title={c?.tip}>
                                                  {c?.mark}
                                                  {" "}
                                                  {c?.l}
                                                </span>
                                              </Fragment>
                                            ))}
                                          </div>
                                          <button onClick={r?.onTest} style={{ background: "none", border: "0", color: "#f0d68c", fontSize: "12px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap" }} className="slx55">
                                            {"Backtest on "}
                                            {r?.t}
                                            {" \u2192"}
                                          </button>
                                        </div>
                                      </Fragment>
                                    ))}
                                  </div>
                                </Fragment>
                              ))}
                            </div>
                          </>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                </div>
              </>
            ) : null}
          </>
        ) : null}
        {(vm.labS2) ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,380px),1fr))", gap: "18px", alignItems: "start" }}>
              <div style={{ position: "relative", border: "1px solid #1a1f21", background: "#0d0f10", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <div style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".12em", color: "#f0d68c" }}>
                    {"STRATEGY"}
                  </div>
                  <div style={{ fontFamily: "'Barlow Condensed',Manrope,sans-serif", fontWeight: "600", fontSize: "28px", lineHeight: "1.1" }}>
                    {vm.lab?.name}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".12em", color: "#7a8481", textTransform: "uppercase" }}>
                    {"Describe it in plain English"}
                  </span>
                  <div style={{ display: "flex", border: "1px solid #1a1f21", borderRadius: "10px", overflow: "hidden", background: "#0d0f10", padding: "3px", gap: "3px" }}>
                    <input value={vm.labAsk ?? ''} onChange={vm.onLabAsk} placeholder={"e.g. buy S&P 500 stocks after a strong earnings beat, hold 8 weeks"} style={{ borderRadius: "6px", flex: "1", minWidth: "0", background: "#0b0e10", border: "0", color: "#e6ebe8", padding: "10px 12px", fontSize: "13px", outline: "none" }} />
                    <button onClick={vm.labBuild} style={{ borderRadius: "8px", border: "0", borderLeft: "1px solid #5a4a22", background: "#2e2614", color: "#fbefc9", padding: "0 14px", fontWeight: "700", fontSize: "12.5px", cursor: "pointer", whiteSpace: "nowrap" }} className="slx56">
                      {"Build rules"}
                    </button>
                  </div>
                  <span style={{ fontSize: "11.5px", color: "#5f6966" }}>
                    {"Becomes \u201cYour strategy\u201d with editable conditions below. Anything the engine can't translate is listed, never guessed."}
                  </span>
                  {(vm.labUnparsed) ? (
                    <>
                      <span style={{ fontSize: "11.5px", color: "#f08a4b" }}>
                        {vm.labUnparsed}
                      </span>
                    </>
                  ) : null}
                </div>
                {(vm.aiEditing) ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".12em", color: "#7a8481", minWidth: "52px" }}>
                        {"NAME"}
                      </span>
                      <input value={vm.aiEditName ?? ''} onChange={vm.onAiEditName} style={{ flex: "1", minWidth: "0", borderRadius: "8px", background: "#08090a", border: "1px solid #263033", color: "#eef2f4", padding: "9px 12px", fontSize: "14px", outline: "none" }} />
                    </div>
                  </>
                ) : null}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".12em", color: "#7a8481", textTransform: "uppercase" }}>
                    {"Entry \u2014 all must be true"}
                  </span>
                  {(vm.labEntry || []).map((c, c__i) => (
                    <Fragment key={c__i}>
                      {(c?.single) ? (
                        <>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", border: "1px solid #1a1f21", background: "#0b0d0e", borderRadius: "10px", padding: "6px 8px" }}>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "10.5px", color: "#5f6966", width: "30px" }}>
                              {c?.join}
                            </span>
                            <select value={c?.aInd ?? ''} onChange={c?.onA} style={{ borderRadius: "6px", background: "#121a20", color: "#fbefc9", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", maxWidth: "190px" }}>
                              {(c?.indOpts || []).map((o, o__i) => (
                                <Fragment key={o__i}>
                                  <option value={o?.v}>
                                    {o?.l}
                                  </option>
                                </Fragment>
                              ))}
                            </select>
                            <span style={{ position: "relative", display: "inline-flex" }}>
                              <span role={"button"} onMouseEnter={c?.aTip?.on} onMouseLeave={c?.aTip?.off} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "15px", height: "15px", borderRadius: "50%", border: "1px solid #5a4a22", color: "#f0d68c", fontSize: "9.5px", fontWeight: "700", fontStyle: "italic", cursor: "help", lineHeight: "1" }} className="slx57">
                                {"i"}
                              </span>
                              {(c?.aTip?.open) ? (
                                <>
                                  <span style={{ position: "absolute", top: "calc(100% + 6px)", left: "-8px", zIndex: "30", width: "min(260px,70vw)", background: "#15130c", border: "1px solid #5a4a22", borderRadius: "8px", padding: "9px 11px", fontSize: "11.5px", lineHeight: "1.45", color: "#e6ebe8", boxShadow: "0 10px 30px rgba(0,0,0,.5)", textWrap: "pretty", pointerEvents: "none" }}>
                                    {c?.aTip?.txt}
                                  </span>
                                </>
                              ) : null}
                            </span>
                            {(c?.aLook) ? (
                              <>
                                <select value={c?.aNs ?? ''} onChange={c?.onAN} title={"Lookback"} style={{ borderRadius: "6px", background: "#0b0e10", color: "#e6ebe8", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontFamily: "'JetBrains Mono',monospace" }}>
                                  {(c?.lookOpts || []).map((o, o__i) => (
                                    <Fragment key={o__i}>
                                      <option value={o?.v}>
                                        {o?.l}
                                      </option>
                                    </Fragment>
                                  ))}
                                </select>
                              </>
                            ) : null}
                            {(c?.aHasN) ? (
                              <>
                                <input type={"number"} min={"1"} value={c?.aN ?? ''} onChange={c?.onAN} title={"Period"} style={{ borderRadius: "6px", width: "56px", background: "#0b0e10", color: "#e6ebe8", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontFamily: "'JetBrains Mono',monospace" }} />
                              </>
                            ) : null}
                            <select value={c?.op ?? ''} onChange={c?.onOp} style={{ borderRadius: "6px", background: "#0b0e10", color: "#f0d68c", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontWeight: "700" }}>
                              {(c?.opOpts || []).map((o, o__i) => (
                                <Fragment key={o__i}>
                                  <option value={o}>
                                    {o}
                                  </option>
                                </Fragment>
                              ))}
                            </select>
                            <span style={{ position: "relative", display: "inline-flex" }}>
                              <span role={"button"} onMouseEnter={c?.oTip?.on} onMouseLeave={c?.oTip?.off} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "15px", height: "15px", borderRadius: "50%", border: "1px solid #5a4a22", color: "#f0d68c", fontSize: "9.5px", fontWeight: "700", fontStyle: "italic", cursor: "help", lineHeight: "1" }} className="slx58">
                                {"i"}
                              </span>
                              {(c?.oTip?.open) ? (
                                <>
                                  <span style={{ position: "absolute", top: "calc(100% + 6px)", left: "-8px", zIndex: "30", width: "min(260px,70vw)", background: "#15130c", border: "1px solid #5a4a22", borderRadius: "8px", padding: "9px 11px", fontSize: "11.5px", lineHeight: "1.45", color: "#e6ebe8", boxShadow: "0 10px 30px rgba(0,0,0,.5)", textWrap: "pretty", pointerEvents: "none" }}>
                                    {c?.oTip?.txt}
                                  </span>
                                </>
                              ) : null}
                            </span>
                            {(c?.bHasMult) ? (
                              <>
                                <input type={"number"} step={"0.1"} value={c?.bMult ?? ''} onChange={c?.onBMult} title={"Multiplier"} style={{ borderRadius: "6px", width: "48px", background: "#0b0e10", color: "#e6ebe8", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontFamily: "'JetBrains Mono',monospace" }} />
                                <span style={{ color: "#5f6966", fontSize: "12px" }}>
                                  {"\u00d7"}
                                </span>
                              </>
                            ) : null}
                            <select value={c?.bInd ?? ''} onChange={c?.onB} style={{ borderRadius: "6px", background: "#121a20", color: "#fbefc9", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", maxWidth: "190px" }}>
                              {(c?.indOpts || []).map((o, o__i) => (
                                <Fragment key={o__i}>
                                  <option value={o?.v}>
                                    {o?.l}
                                  </option>
                                </Fragment>
                              ))}
                            </select>
                            <span style={{ position: "relative", display: "inline-flex" }}>
                              <span role={"button"} onMouseEnter={c?.bTip?.on} onMouseLeave={c?.bTip?.off} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "15px", height: "15px", borderRadius: "50%", border: "1px solid #5a4a22", color: "#f0d68c", fontSize: "9.5px", fontWeight: "700", fontStyle: "italic", cursor: "help", lineHeight: "1" }} className="slx59">
                                {"i"}
                              </span>
                              {(c?.bTip?.open) ? (
                                <>
                                  <span style={{ position: "absolute", top: "calc(100% + 6px)", right: "-8px", zIndex: "30", width: "min(260px,70vw)", background: "#15130c", border: "1px solid #5a4a22", borderRadius: "8px", padding: "9px 11px", fontSize: "11.5px", lineHeight: "1.45", color: "#e6ebe8", boxShadow: "0 10px 30px rgba(0,0,0,.5)", textWrap: "pretty", pointerEvents: "none" }}>
                                    {c?.bTip?.txt}
                                  </span>
                                </>
                              ) : null}
                            </span>
                            {(c?.bLook) ? (
                              <>
                                <select value={c?.bNs ?? ''} onChange={c?.onBN} title={"Lookback"} style={{ borderRadius: "6px", background: "#0b0e10", color: "#e6ebe8", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontFamily: "'JetBrains Mono',monospace" }}>
                                  {(c?.lookOpts || []).map((o, o__i) => (
                                    <Fragment key={o__i}>
                                      <option value={o?.v}>
                                        {o?.l}
                                      </option>
                                    </Fragment>
                                  ))}
                                </select>
                              </>
                            ) : null}
                            {(c?.bHasN) ? (
                              <>
                                <input type={"number"} min={"1"} value={c?.bN ?? ''} onChange={c?.onBN} title={"Period"} style={{ borderRadius: "6px", width: "56px", background: "#0b0e10", color: "#e6ebe8", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontFamily: "'JetBrains Mono',monospace" }} />
                              </>
                            ) : null}
                            {(c?.bIsNum) ? (
                              <>
                                <input type={"number"} step={"any"} value={c?.bV ?? ''} onChange={c?.onBV} title={"Value"} style={{ borderRadius: "6px", width: "70px", background: "#0b0e10", color: "#e6ebe8", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontFamily: "'JetBrains Mono',monospace" }} />
                              </>
                            ) : null}
                            {(c?.warn) ? (
                              <>
                                <span style={{ fontSize: "10px", fontWeight: "800", letterSpacing: ".06em", color: "#f08a4b", border: "1px solid #6b3a1c", padding: "2px 8px", borderRadius: "999px" }}>
                                  {"NEEDS DATA"}
                                </span>
                              </>
                            ) : null}
                            <button onClick={c?.onOr} title={"Add an OR alternative to this condition"} style={{ borderRadius: "6px", background: "none", border: "1px solid #263033", color: "#f0d68c", cursor: "pointer", fontSize: "10.5px", fontWeight: "800", letterSpacing: ".06em", padding: "3px 7px" }} className="slx60">
                              {"+ OR"}
                            </button>
                            <button onClick={c?.onDel} title={"Remove condition"} style={{ marginLeft: "auto", background: "none", border: "0", color: "#5f6966", cursor: "pointer", fontSize: "15px", lineHeight: "1", padding: "2px 4px" }} className="slx61">
                              {"\u00d7"}
                            </button>
                          </div>
                        </>
                      ) : null}
                      {(c?.isGroup) ? (
                        <>
                          <div style={{ display: "flex", gap: "6px", alignItems: "stretch" }}>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "10.5px", color: "#5f6966", width: "30px", paddingTop: "12px", flex: "none" }}>
                              {c?.join}
                            </span>
                            <div style={{ flex: "1", minWidth: "0", border: "1px dashed #5a4a22", borderRadius: "10px", padding: "8px", display: "flex", flexDirection: "column", gap: "6px", background: "rgba(201,162,74,.03)" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontSize: "10px", fontWeight: "800", letterSpacing: ".1em", color: "#f0d68c" }}>
                                  {"ANY ONE OF"}
                                </span>
                                <button onClick={c?.onDelGroup} title={"Remove group"} style={{ marginLeft: "auto", background: "none", border: "0", color: "#5f6966", cursor: "pointer", fontSize: "15px", lineHeight: "1", padding: "2px 4px" }} className="slx62">
                                  {"\u00d7"}
                                </button>
                              </div>
                              {(c?.subs || []).map((s, s__i) => (
                                <Fragment key={s__i}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", border: "1px solid #1a1f21", background: "#0d0f10", borderRadius: "8px", padding: "5px 7px" }}>
                                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "10.5px", color: "#5f6966", width: "30px" }}>
                                      {s?.join}
                                    </span>
                                    <select value={s?.aInd ?? ''} onChange={s?.onA} style={{ borderRadius: "6px", background: "#121a20", color: "#fbefc9", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", maxWidth: "190px" }}>
                                      {(s?.indOpts || []).map((o, o__i) => (
                                        <Fragment key={o__i}>
                                          <option value={o?.v}>
                                            {o?.l}
                                          </option>
                                        </Fragment>
                                      ))}
                                    </select>
                                    {(s?.aHasN) ? (
                                      <>
                                        <input type={"number"} min={"1"} value={s?.aN ?? ''} onChange={s?.onAN} title={"Period"} style={{ borderRadius: "6px", width: "56px", background: "#0b0e10", color: "#e6ebe8", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontFamily: "'JetBrains Mono',monospace" }} />
                                      </>
                                    ) : null}
                                    <select value={s?.op ?? ''} onChange={s?.onOp} style={{ borderRadius: "6px", background: "#0b0e10", color: "#f0d68c", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontWeight: "700" }}>
                                      {(s?.opOpts || []).map((o, o__i) => (
                                        <Fragment key={o__i}>
                                          <option value={o}>
                                            {o}
                                          </option>
                                        </Fragment>
                                      ))}
                                    </select>
                                    {(s?.bHasMult) ? (
                                      <>
                                        <input type={"number"} step={"0.1"} value={s?.bMult ?? ''} onChange={s?.onBMult} title={"Multiplier"} style={{ borderRadius: "6px", width: "48px", background: "#0b0e10", color: "#e6ebe8", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontFamily: "'JetBrains Mono',monospace" }} />
                                        <span style={{ color: "#5f6966", fontSize: "12px" }}>
                                          {"\u00d7"}
                                        </span>
                                      </>
                                    ) : null}
                                    <select value={s?.bInd ?? ''} onChange={s?.onB} style={{ borderRadius: "6px", background: "#121a20", color: "#fbefc9", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", maxWidth: "190px" }}>
                                      {(s?.indOpts || []).map((o, o__i) => (
                                        <Fragment key={o__i}>
                                          <option value={o?.v}>
                                            {o?.l}
                                          </option>
                                        </Fragment>
                                      ))}
                                    </select>
                                    {(s?.bHasN) ? (
                                      <>
                                        <input type={"number"} min={"1"} value={s?.bN ?? ''} onChange={s?.onBN} title={"Period"} style={{ borderRadius: "6px", width: "56px", background: "#0b0e10", color: "#e6ebe8", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontFamily: "'JetBrains Mono',monospace" }} />
                                      </>
                                    ) : null}
                                    {(s?.bIsNum) ? (
                                      <>
                                        <input type={"number"} step={"any"} value={s?.bV ?? ''} onChange={s?.onBV} title={"Value"} style={{ borderRadius: "6px", width: "70px", background: "#0b0e10", color: "#e6ebe8", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontFamily: "'JetBrains Mono',monospace" }} />
                                      </>
                                    ) : null}
                                    {(s?.warn) ? (
                                      <>
                                        <span style={{ fontSize: "10px", fontWeight: "800", letterSpacing: ".06em", color: "#f08a4b", border: "1px solid #6b3a1c", padding: "2px 8px", borderRadius: "999px" }}>
                                          {"NEEDS DATA"}
                                        </span>
                                      </>
                                    ) : null}
                                    <button onClick={s?.onDel} title={"Remove condition"} style={{ marginLeft: "auto", background: "none", border: "0", color: "#5f6966", cursor: "pointer", fontSize: "15px", lineHeight: "1", padding: "2px 4px" }} className="slx63">
                                      {"\u00d7"}
                                    </button>
                                  </div>
                                </Fragment>
                              ))}
                              <button onClick={c?.onAddOr} style={{ borderRadius: "6px", alignSelf: "flex-start", background: "none", border: "1px dashed #5a4a22", color: "#f0d68c", padding: "4px 9px", fontSize: "11.5px", fontWeight: "700", cursor: "pointer" }} className="slx64">
                                {"+ OR condition"}
                              </button>
                            </div>
                          </div>
                        </>
                      ) : null}
                    </Fragment>
                  ))}
                  <button onClick={vm.labAddEntry} style={{ borderRadius: "8px", alignSelf: "flex-start", background: "none", border: "1px dashed #5a4a22", color: "#f0d68c", padding: "6px 10px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }} className="slx65">
                    {"+ Add condition"}
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".12em", color: "#7a8481", textTransform: "uppercase" }}>
                    {"Exit \u2014 any one triggers"}
                  </span>
                  {(vm.labExit || []).map((c, c__i) => (
                    <Fragment key={c__i}>
                      {(c?.single) ? (
                        <>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", border: "1px solid #1a1f21", background: "#0b0d0e", borderRadius: "10px", padding: "6px 8px" }}>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "10.5px", color: "#5f6966", width: "30px" }}>
                              {c?.join}
                            </span>
                            <select value={c?.aInd ?? ''} onChange={c?.onA} style={{ borderRadius: "6px", background: "#121a20", color: "#fbefc9", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", maxWidth: "190px" }}>
                              {(c?.indOpts || []).map((o, o__i) => (
                                <Fragment key={o__i}>
                                  <option value={o?.v}>
                                    {o?.l}
                                  </option>
                                </Fragment>
                              ))}
                            </select>
                            <span style={{ position: "relative", display: "inline-flex" }}>
                              <span role={"button"} onMouseEnter={c?.aTip?.on} onMouseLeave={c?.aTip?.off} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "15px", height: "15px", borderRadius: "50%", border: "1px solid #5a4a22", color: "#f0d68c", fontSize: "9.5px", fontWeight: "700", fontStyle: "italic", cursor: "help", lineHeight: "1" }} className="slx66">
                                {"i"}
                              </span>
                              {(c?.aTip?.open) ? (
                                <>
                                  <span style={{ position: "absolute", top: "calc(100% + 6px)", left: "-8px", zIndex: "30", width: "min(260px,70vw)", background: "#15130c", border: "1px solid #5a4a22", borderRadius: "8px", padding: "9px 11px", fontSize: "11.5px", lineHeight: "1.45", color: "#e6ebe8", boxShadow: "0 10px 30px rgba(0,0,0,.5)", textWrap: "pretty", pointerEvents: "none" }}>
                                    {c?.aTip?.txt}
                                  </span>
                                </>
                              ) : null}
                            </span>
                            {(c?.aLook) ? (
                              <>
                                <select value={c?.aNs ?? ''} onChange={c?.onAN} title={"Lookback"} style={{ borderRadius: "6px", background: "#0b0e10", color: "#e6ebe8", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontFamily: "'JetBrains Mono',monospace" }}>
                                  {(c?.lookOpts || []).map((o, o__i) => (
                                    <Fragment key={o__i}>
                                      <option value={o?.v}>
                                        {o?.l}
                                      </option>
                                    </Fragment>
                                  ))}
                                </select>
                              </>
                            ) : null}
                            {(c?.aHasN) ? (
                              <>
                                <input type={"number"} min={"1"} value={c?.aN ?? ''} onChange={c?.onAN} title={"Period"} style={{ borderRadius: "6px", width: "56px", background: "#0b0e10", color: "#e6ebe8", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontFamily: "'JetBrains Mono',monospace" }} />
                              </>
                            ) : null}
                            <select value={c?.op ?? ''} onChange={c?.onOp} style={{ borderRadius: "6px", background: "#0b0e10", color: "#f0d68c", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontWeight: "700" }}>
                              {(c?.opOpts || []).map((o, o__i) => (
                                <Fragment key={o__i}>
                                  <option value={o}>
                                    {o}
                                  </option>
                                </Fragment>
                              ))}
                            </select>
                            <span style={{ position: "relative", display: "inline-flex" }}>
                              <span role={"button"} onMouseEnter={c?.oTip?.on} onMouseLeave={c?.oTip?.off} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "15px", height: "15px", borderRadius: "50%", border: "1px solid #5a4a22", color: "#f0d68c", fontSize: "9.5px", fontWeight: "700", fontStyle: "italic", cursor: "help", lineHeight: "1" }} className="slx67">
                                {"i"}
                              </span>
                              {(c?.oTip?.open) ? (
                                <>
                                  <span style={{ position: "absolute", top: "calc(100% + 6px)", left: "-8px", zIndex: "30", width: "min(260px,70vw)", background: "#15130c", border: "1px solid #5a4a22", borderRadius: "8px", padding: "9px 11px", fontSize: "11.5px", lineHeight: "1.45", color: "#e6ebe8", boxShadow: "0 10px 30px rgba(0,0,0,.5)", textWrap: "pretty", pointerEvents: "none" }}>
                                    {c?.oTip?.txt}
                                  </span>
                                </>
                              ) : null}
                            </span>
                            {(c?.bHasMult) ? (
                              <>
                                <input type={"number"} step={"0.1"} value={c?.bMult ?? ''} onChange={c?.onBMult} title={"Multiplier"} style={{ borderRadius: "6px", width: "48px", background: "#0b0e10", color: "#e6ebe8", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontFamily: "'JetBrains Mono',monospace" }} />
                                <span style={{ color: "#5f6966", fontSize: "12px" }}>
                                  {"\u00d7"}
                                </span>
                              </>
                            ) : null}
                            <select value={c?.bInd ?? ''} onChange={c?.onB} style={{ borderRadius: "6px", background: "#121a20", color: "#fbefc9", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", maxWidth: "190px" }}>
                              {(c?.indOpts || []).map((o, o__i) => (
                                <Fragment key={o__i}>
                                  <option value={o?.v}>
                                    {o?.l}
                                  </option>
                                </Fragment>
                              ))}
                            </select>
                            <span style={{ position: "relative", display: "inline-flex" }}>
                              <span role={"button"} onMouseEnter={c?.bTip?.on} onMouseLeave={c?.bTip?.off} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "15px", height: "15px", borderRadius: "50%", border: "1px solid #5a4a22", color: "#f0d68c", fontSize: "9.5px", fontWeight: "700", fontStyle: "italic", cursor: "help", lineHeight: "1" }} className="slx68">
                                {"i"}
                              </span>
                              {(c?.bTip?.open) ? (
                                <>
                                  <span style={{ position: "absolute", top: "calc(100% + 6px)", right: "-8px", zIndex: "30", width: "min(260px,70vw)", background: "#15130c", border: "1px solid #5a4a22", borderRadius: "8px", padding: "9px 11px", fontSize: "11.5px", lineHeight: "1.45", color: "#e6ebe8", boxShadow: "0 10px 30px rgba(0,0,0,.5)", textWrap: "pretty", pointerEvents: "none" }}>
                                    {c?.bTip?.txt}
                                  </span>
                                </>
                              ) : null}
                            </span>
                            {(c?.bLook) ? (
                              <>
                                <select value={c?.bNs ?? ''} onChange={c?.onBN} title={"Lookback"} style={{ borderRadius: "6px", background: "#0b0e10", color: "#e6ebe8", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontFamily: "'JetBrains Mono',monospace" }}>
                                  {(c?.lookOpts || []).map((o, o__i) => (
                                    <Fragment key={o__i}>
                                      <option value={o?.v}>
                                        {o?.l}
                                      </option>
                                    </Fragment>
                                  ))}
                                </select>
                              </>
                            ) : null}
                            {(c?.bHasN) ? (
                              <>
                                <input type={"number"} min={"1"} value={c?.bN ?? ''} onChange={c?.onBN} title={"Period"} style={{ borderRadius: "6px", width: "56px", background: "#0b0e10", color: "#e6ebe8", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontFamily: "'JetBrains Mono',monospace" }} />
                              </>
                            ) : null}
                            {(c?.bIsNum) ? (
                              <>
                                <input type={"number"} step={"any"} value={c?.bV ?? ''} onChange={c?.onBV} title={"Value"} style={{ borderRadius: "6px", width: "70px", background: "#0b0e10", color: "#e6ebe8", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontFamily: "'JetBrains Mono',monospace" }} />
                              </>
                            ) : null}
                            {(c?.warn) ? (
                              <>
                                <span style={{ fontSize: "10px", fontWeight: "800", letterSpacing: ".06em", color: "#f08a4b", border: "1px solid #6b3a1c", padding: "2px 8px", borderRadius: "999px" }}>
                                  {"NEEDS DATA"}
                                </span>
                              </>
                            ) : null}
                            <button onClick={c?.onOr} title={"Add an OR alternative to this condition"} style={{ borderRadius: "6px", background: "none", border: "1px solid #263033", color: "#f0d68c", cursor: "pointer", fontSize: "10.5px", fontWeight: "800", letterSpacing: ".06em", padding: "3px 7px" }} className="slx69">
                              {"+ OR"}
                            </button>
                            <button onClick={c?.onDel} title={"Remove condition"} style={{ marginLeft: "auto", background: "none", border: "0", color: "#5f6966", cursor: "pointer", fontSize: "15px", lineHeight: "1", padding: "2px 4px" }} className="slx70">
                              {"\u00d7"}
                            </button>
                          </div>
                        </>
                      ) : null}
                      {(c?.isGroup) ? (
                        <>
                          <div style={{ display: "flex", gap: "6px", alignItems: "stretch" }}>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "10.5px", color: "#5f6966", width: "30px", paddingTop: "12px", flex: "none" }}>
                              {c?.join}
                            </span>
                            <div style={{ flex: "1", minWidth: "0", border: "1px dashed #5a4a22", borderRadius: "10px", padding: "8px", display: "flex", flexDirection: "column", gap: "6px", background: "rgba(201,162,74,.03)" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontSize: "10px", fontWeight: "800", letterSpacing: ".1em", color: "#f0d68c" }}>
                                  {"ANY ONE OF"}
                                </span>
                                <button onClick={c?.onDelGroup} title={"Remove group"} style={{ marginLeft: "auto", background: "none", border: "0", color: "#5f6966", cursor: "pointer", fontSize: "15px", lineHeight: "1", padding: "2px 4px" }} className="slx71">
                                  {"\u00d7"}
                                </button>
                              </div>
                              {(c?.subs || []).map((s, s__i) => (
                                <Fragment key={s__i}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", border: "1px solid #1a1f21", background: "#0d0f10", borderRadius: "8px", padding: "5px 7px" }}>
                                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "10.5px", color: "#5f6966", width: "30px" }}>
                                      {s?.join}
                                    </span>
                                    <select value={s?.aInd ?? ''} onChange={s?.onA} style={{ borderRadius: "6px", background: "#121a20", color: "#fbefc9", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", maxWidth: "190px" }}>
                                      {(s?.indOpts || []).map((o, o__i) => (
                                        <Fragment key={o__i}>
                                          <option value={o?.v}>
                                            {o?.l}
                                          </option>
                                        </Fragment>
                                      ))}
                                    </select>
                                    {(s?.aHasN) ? (
                                      <>
                                        <input type={"number"} min={"1"} value={s?.aN ?? ''} onChange={s?.onAN} title={"Period"} style={{ borderRadius: "6px", width: "56px", background: "#0b0e10", color: "#e6ebe8", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontFamily: "'JetBrains Mono',monospace" }} />
                                      </>
                                    ) : null}
                                    <select value={s?.op ?? ''} onChange={s?.onOp} style={{ borderRadius: "6px", background: "#0b0e10", color: "#f0d68c", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontWeight: "700" }}>
                                      {(s?.opOpts || []).map((o, o__i) => (
                                        <Fragment key={o__i}>
                                          <option value={o}>
                                            {o}
                                          </option>
                                        </Fragment>
                                      ))}
                                    </select>
                                    {(s?.bHasMult) ? (
                                      <>
                                        <input type={"number"} step={"0.1"} value={s?.bMult ?? ''} onChange={s?.onBMult} title={"Multiplier"} style={{ borderRadius: "6px", width: "48px", background: "#0b0e10", color: "#e6ebe8", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontFamily: "'JetBrains Mono',monospace" }} />
                                        <span style={{ color: "#5f6966", fontSize: "12px" }}>
                                          {"\u00d7"}
                                        </span>
                                      </>
                                    ) : null}
                                    <select value={s?.bInd ?? ''} onChange={s?.onB} style={{ borderRadius: "6px", background: "#121a20", color: "#fbefc9", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", maxWidth: "190px" }}>
                                      {(s?.indOpts || []).map((o, o__i) => (
                                        <Fragment key={o__i}>
                                          <option value={o?.v}>
                                            {o?.l}
                                          </option>
                                        </Fragment>
                                      ))}
                                    </select>
                                    {(s?.bHasN) ? (
                                      <>
                                        <input type={"number"} min={"1"} value={s?.bN ?? ''} onChange={s?.onBN} title={"Period"} style={{ borderRadius: "6px", width: "56px", background: "#0b0e10", color: "#e6ebe8", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontFamily: "'JetBrains Mono',monospace" }} />
                                      </>
                                    ) : null}
                                    {(s?.bIsNum) ? (
                                      <>
                                        <input type={"number"} step={"any"} value={s?.bV ?? ''} onChange={s?.onBV} title={"Value"} style={{ borderRadius: "6px", width: "70px", background: "#0b0e10", color: "#e6ebe8", border: "1px solid #233038", padding: "4px 6px", fontSize: "12.5px", fontFamily: "'JetBrains Mono',monospace" }} />
                                      </>
                                    ) : null}
                                    {(s?.warn) ? (
                                      <>
                                        <span style={{ fontSize: "10px", fontWeight: "800", letterSpacing: ".06em", color: "#f08a4b", border: "1px solid #6b3a1c", padding: "2px 8px", borderRadius: "999px" }}>
                                          {"NEEDS DATA"}
                                        </span>
                                      </>
                                    ) : null}
                                    <button onClick={s?.onDel} title={"Remove condition"} style={{ marginLeft: "auto", background: "none", border: "0", color: "#5f6966", cursor: "pointer", fontSize: "15px", lineHeight: "1", padding: "2px 4px" }} className="slx72">
                                      {"\u00d7"}
                                    </button>
                                  </div>
                                </Fragment>
                              ))}
                              <button onClick={c?.onAddOr} style={{ borderRadius: "6px", alignSelf: "flex-start", background: "none", border: "1px dashed #5a4a22", color: "#f0d68c", padding: "4px 9px", fontSize: "11.5px", fontWeight: "700", cursor: "pointer" }} className="slx73">
                                {"+ OR condition"}
                              </button>
                            </div>
                          </div>
                        </>
                      ) : null}
                    </Fragment>
                  ))}
                  <button onClick={vm.labAddExit} style={{ borderRadius: "8px", alignSelf: "flex-start", background: "none", border: "1px dashed #5a4a22", color: "#f0d68c", padding: "6px 10px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }} className="slx74">
                    {"+ Add condition"}
                  </button>
                </div>
                <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", fontSize: "12px", color: "#7a8481" }}>
                  <span>
                    {"Data: "}
                    {vm.lab?.data}
                    {" \u00b7 Long-only, daily bars, fully invested per signal"}
                  </span>
                  {(vm.labEdited) ? (
                    <>
                      <button onClick={vm.labReset} style={{ background: "none", border: "0", padding: "0", color: "#f0d68c", fontSize: "12px", fontWeight: "700", cursor: "pointer", marginLeft: "auto" }}>
                        {"Reset to original rules"}
                      </button>
                    </>
                  ) : null}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".12em", color: "#7a8481", textTransform: "uppercase" }}>
                    {"Test on \u00b7 last 5 years"}
                  </span>
                  <div style={{ display: "flex", border: "1px solid #1a1f21", borderRadius: "10px", overflow: "hidden", background: "#0d0f10", padding: "3px", gap: "3px" }}>
                    {(vm.cfgSym || []).map((o, o__i) => (
                      <Fragment key={o__i}>
                        <button onClick={o?.onClick} style={{ borderRadius: "8px", flex: "1 1 0", border: "0", borderRight: "1px solid #233038", padding: "8px 10px", fontSize: "12.5px", fontWeight: "600", cursor: "pointer", background: o?.bg, color: o?.color, whiteSpace: "nowrap" }} className="slx75">
                          {o?.label}
                        </button>
                      </Fragment>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".12em", color: "#7a8481", textTransform: "uppercase" }}>
                    {"Stop loss"}
                  </span>
                  <div style={{ display: "flex", border: "1px solid #1a1f21", borderRadius: "10px", overflow: "hidden", background: "#0d0f10", padding: "3px", gap: "3px" }}>
                    {(vm.cfgStop || []).map((o, o__i) => (
                      <Fragment key={o__i}>
                        <button onClick={o?.onClick} style={{ borderRadius: "8px", flex: "1 1 0", border: "0", borderRight: "1px solid #233038", padding: "8px 10px", fontSize: "12.5px", fontWeight: "600", cursor: "pointer", background: o?.bg, color: o?.color, whiteSpace: "nowrap" }} className="slx76">
                          {o?.label}
                        </button>
                      </Fragment>
                    ))}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "14px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".12em", color: "#7a8481", textTransform: "uppercase" }}>
                      {"Take profit"}
                    </span>
                    <div style={{ display: "flex", border: "1px solid #1a1f21", borderRadius: "10px", overflow: "hidden", background: "#0d0f10", padding: "3px", gap: "3px" }}>
                      {(vm.cfgTp || []).map((o, o__i) => (
                        <Fragment key={o__i}>
                          <button onClick={o?.onClick} style={{ borderRadius: "8px", flex: "1 1 0", border: "0", borderRight: "1px solid #233038", padding: "8px 10px", fontSize: "12.5px", fontWeight: "600", cursor: "pointer", background: o?.bg, color: o?.color, whiteSpace: "nowrap" }} className="slx77">
                            {o?.label}
                          </button>
                        </Fragment>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".12em", color: "#7a8481", textTransform: "uppercase" }}>
                      {"Trailing stop"}
                    </span>
                    <div style={{ display: "flex", border: "1px solid #1a1f21", borderRadius: "10px", overflow: "hidden", background: "#0d0f10", padding: "3px", gap: "3px" }}>
                      {(vm.cfgTrail || []).map((o, o__i) => (
                        <Fragment key={o__i}>
                          <button onClick={o?.onClick} style={{ borderRadius: "8px", flex: "1 1 0", border: "0", borderRight: "1px solid #233038", padding: "8px 10px", fontSize: "12.5px", fontWeight: "600", cursor: "pointer", background: o?.bg, color: o?.color, whiteSpace: "nowrap" }} className="slx78">
                            {o?.label}
                          </button>
                        </Fragment>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".12em", color: "#7a8481", textTransform: "uppercase" }}>
                    {"Costs per trade"}
                  </span>
                  <div style={{ display: "flex", border: "1px solid #1a1f21", borderRadius: "10px", overflow: "hidden", background: "#0d0f10", padding: "3px", gap: "3px" }}>
                    {(vm.cfgCost || []).map((o, o__i) => (
                      <Fragment key={o__i}>
                        <button onClick={o?.onClick} style={{ borderRadius: "8px", flex: "1 1 0", border: "0", borderRight: "1px solid #233038", padding: "8px 10px", fontSize: "12.5px", fontWeight: "600", cursor: "pointer", background: o?.bg, color: o?.color, whiteSpace: "nowrap" }} className="slx79">
                          {o?.label}
                        </button>
                      </Fragment>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ position: "relative", border: "1px solid #1a1f21", background: "#0d0f10", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".12em", color: "#f0d68c" }}>
                  {"RUN SUMMARY"}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: "9px 12px", fontSize: "13px" }}>
                  <span style={{ color: "#8b9592" }}>
                    {"Mode"}
                  </span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace" }}>
                    {"Long \u00b7 Daily \u00b7 100% invested"}
                  </span>
                  <span style={{ color: "#8b9592" }}>
                    {"Rules"}
                  </span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace" }}>
                    {vm.lab?.ruleCnt}
                  </span>
                  <span style={{ color: "#8b9592" }}>
                    {"Period"}
                  </span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace" }}>
                    {vm.lab?.period}
                  </span>
                  <span style={{ color: "#8b9592" }}>
                    {"Stop \u00b7 target \u00b7 trail"}
                  </span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace" }}>
                    {vm.lab?.stop}
                    {" \u00b7 "}
                    {vm.lab?.tp}
                    {" \u00b7 "}
                    {vm.lab?.trail}
                  </span>
                  <span style={{ color: "#8b9592" }}>
                    {"Costs"}
                  </span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace" }}>
                    {vm.lab?.cost}
                  </span>
                  <span style={{ color: "#8b9592" }}>
                    {"Stock"}
                  </span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace" }}>
                    {vm.lab?.sym}
                  </span>
                  <span style={{ color: "#8b9592" }}>
                    {"Benchmark"}
                  </span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace" }}>
                    {vm.lab?.bench}
                  </span>
                </div>
                <div style={{ fontSize: "12px", color: "#7a8481", lineHeight: "1.5", borderTop: "1px solid #1a2328", paddingTop: "12px" }}>
                  {"Signals use the close of day "}
                  <i>
                    {"t"}
                  </i>
                  {"; fills at the open of day "}
                  <i>
                    {"t+1"}
                  </i>
                  {". The engine runs exactly the conditions shown on the left."}
                </div>
                <button onClick={vm.runLab} style={{ borderRadius: "8px", position: "relative", border: "0", background: "#c9a24a", color: "#fff", padding: "12px 16px", fontWeight: "800", fontSize: "13px", letterSpacing: ".06em", cursor: "pointer" }} className="slx80">
                  {"RUN BACKTEST"}
                </button>
              </div>
            </div>
          </>
        ) : null}
        {(vm.labS3) ? (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap" }}>
                <span style={{ fontFamily: "'Barlow Condensed',Manrope,sans-serif", fontWeight: "600", fontSize: "28px" }}>
                  {vm.lab?.name}
                </span>
                <span style={{ color: "#7a8481", fontSize: "12.5px" }}>
                  {vm.lab?.sym}
                  {" \u00b7 "}
                  {vm.lab?.period}
                  {" \u00b7 stop "}
                  {vm.lab?.stop}
                  {" \u00b7 costs "}
                  {vm.lab?.cost}
                </span>
              </div>
              {(vm.labNoRes) ? (
                <>
                  <div style={{ position: "relative", border: "1px dashed #5a4a22", background: "#0b0e10", padding: "36px 24px", textAlign: "center", display: "flex", flexDirection: "column", gap: "6px", alignItems: "center" }}>
                    <div style={{ fontFamily: "'Barlow Condensed',Manrope,sans-serif", fontWeight: "600", fontSize: "22px" }}>
                      {vm.labNoResT}
                    </div>
                    <div style={{ color: "#8b9592", fontSize: "13px", maxWidth: "560px", textWrap: "pretty" }}>
                      {vm.labNoResD}
                    </div>
                  </div>
                </>
              ) : null}
              {(vm.labHasRes) ? (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: "14px" }}>
                      {(vm.labMetrics || []).map((m, m__i) => (
                        <Fragment key={m__i}>
                          <div style={{ position: "relative", border: "1px solid #1a1f21", background: "#0d0f10", borderRadius: "12px", padding: "14px 16px" }}>
                            <div style={{ fontSize: "10px", fontWeight: "700", letterSpacing: ".1em", color: "#7a8481" }}>
                              {m?.l}
                            </div>
                            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "22px", color: m?.c, marginTop: "4px" }}>
                              {m?.v}
                            </div>
                            <div style={{ fontSize: "11.5px", color: "#5f6966" }}>
                              {m?.s}
                            </div>
                          </div>
                        </Fragment>
                      ))}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))", gap: "18px", alignItems: "start" }}>
                      <div style={{ position: "relative", border: "1px solid #1a1f21", background: "#0d0f10", borderRadius: "12px", padding: "18px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap", marginBottom: "12px" }}>
                          <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".12em", color: "#f0d68c" }}>
                            {"GROWTH OF $10,000"}
                          </span>
                          <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#cfd6d3", marginLeft: "auto" }}>
                            <span style={{ width: "14px", height: "2px", background: "#f0d68c" }}>
                            </span>
                            {"Strategy "}
                            {vm.lab?.endS}
                          </span>
                          <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#8b9592" }}>
                            <span style={{ width: "14px", height: "0", borderTop: "2px dashed #5d6764" }}>
                            </span>
                            {vm.lab?.bench}
                            {" "}
                            {vm.lab?.endB}
                          </span>
                        </div>
                        <svg viewBox={"0 0 600 200"} preserveAspectRatio={"none"} style={{ width: "100%", height: "220px", display: "block" }}>
                          <path d={"M0,50H600M0,100H600M0,150H600"} stroke={"#151c20"} strokeWidth={"1"} vectorEffect={"non-scaling-stroke"} />
                          <path d={vm.lab?.areaS} fill={"rgba(201,162,74,.12)"} />
                          <path d={vm.lab?.lineB} fill={"none"} stroke={"#5d6764"} strokeWidth={"1.6"} strokeDasharray={"5 4"} vectorEffect={"non-scaling-stroke"} />
                          <path d={vm.lab?.lineS} fill={"none"} stroke={"#f0d68c"} strokeWidth={"2"} vectorEffect={"non-scaling-stroke"} />
                        </svg>
                        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'JetBrains Mono',monospace", fontSize: "10.5px", color: "#5f6966", marginTop: "6px" }}>
                          {(vm.labAxis || []).map((a, a__i) => (
                            <Fragment key={a__i}>
                              <span>
                                {a}
                              </span>
                            </Fragment>
                          ))}
                        </div>
                      </div>
                      <div style={{ position: "relative", border: "1px solid #1a1f21", background: "#0d0f10", borderRadius: "12px", padding: "18px 20px" }}>
                        <div style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".12em", color: "#f0d68c", marginBottom: "10px" }}>
                          {"YEAR BY YEAR"}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", fontSize: "12.5px" }}>
                          <span style={{ color: "#5f6966", fontSize: "10.5px", fontWeight: "700", letterSpacing: ".08em", padding: "6px 0", borderBottom: "1px solid #1a2328" }}>
                            {"YEAR"}
                          </span>
                          <span style={{ color: "#5f6966", fontSize: "10.5px", fontWeight: "700", letterSpacing: ".08em", padding: "6px 0", borderBottom: "1px solid #1a2328", textAlign: "right" }}>
                            {"STRATEGY"}
                          </span>
                          <span style={{ color: "#5f6966", fontSize: "10.5px", fontWeight: "700", letterSpacing: ".08em", padding: "6px 0", borderBottom: "1px solid #1a2328", textAlign: "right" }}>
                            {"BUY "}
                            {"&"}
                            {" HOLD"}
                          </span>
                          <span style={{ color: "#5f6966", fontSize: "10.5px", fontWeight: "700", letterSpacing: ".08em", padding: "6px 0", borderBottom: "1px solid #1a2328", textAlign: "right" }}>
                            {"EXCESS"}
                          </span>
                          {(vm.labYears || []).map((y, y__i) => (
                            <Fragment key={y__i}>
                              <span style={{ fontFamily: "'JetBrains Mono',monospace", padding: "6px 0", borderBottom: "1px solid #12181b", color: "#aab3b0" }}>
                                {y?.y}
                              </span>
                              <span style={{ fontFamily: "'JetBrains Mono',monospace", padding: "6px 0", borderBottom: "1px solid #12181b", textAlign: "right", color: y?.sc }}>
                                {y?.s}
                              </span>
                              <span style={{ fontFamily: "'JetBrains Mono',monospace", padding: "6px 0", borderBottom: "1px solid #12181b", textAlign: "right", color: y?.bc }}>
                                {y?.b}
                              </span>
                              <span style={{ fontFamily: "'JetBrains Mono',monospace", padding: "6px 0", borderBottom: "1px solid #12181b", textAlign: "right", color: y?.ec }}>
                                {y?.e}
                              </span>
                            </Fragment>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div style={{ position: "relative", border: "1px solid #1a1f21", background: "#0d0f10", borderRadius: "12px", padding: "18px 20px", overflowX: "auto" }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginBottom: "10px" }}>
                        <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".12em", color: "#f0d68c" }}>
                          {"COMPARE ALL STRATEGIES"}
                        </span>
                        <span style={{ fontSize: "11.5px", color: "#5f6966" }}>
                          {"Same stock and settings \u00b7 click a header to sort, a row to switch"}
                        </span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "minmax(180px,1.6fr) repeat(6,minmax(70px,1fr))", minWidth: "680px", fontSize: "12.5px" }}>
                        {(vm.cmpHead || []).map((c, c__i) => (
                          <Fragment key={c__i}>
                            <button onClick={c?.onClick} style={{ background: "none", border: "0", borderBottom: "1px solid #1a2328", padding: "7px 0", textAlign: c?.al, fontSize: "10.5px", fontWeight: "700", letterSpacing: ".08em", color: c?.color, cursor: "pointer" }} className="slx81">
                              {c?.l}
                            </button>
                          </Fragment>
                        ))}
                        {(vm.cmpRows || []).map((r, r__i) => (
                          <Fragment key={r__i}>
                            <button onClick={r?.onClick} style={{ borderRadius: "8px", gridColumn: "1/-1", display: "grid", gridTemplateColumns: "subgrid", background: r?.bg, border: "0", borderBottom: "1px solid #12181b", padding: "0", cursor: "pointer", color: "#e6ebe8", textAlign: "left" }} className="slx82">
                              <span style={{ padding: "8px 0 8px 6px", fontWeight: "700", color: r?.nc }}>
                                {r?.name}
                              </span>
                              <span style={{ fontFamily: "'JetBrains Mono',monospace", padding: "8px 0", textAlign: "right" }}>
                                {r?.cagr}
                              </span>
                              <span style={{ fontFamily: "'JetBrains Mono',monospace", padding: "8px 0", textAlign: "right" }}>
                                {r?.sh}
                              </span>
                              <span style={{ fontFamily: "'JetBrains Mono',monospace", padding: "8px 0", textAlign: "right" }}>
                                {r?.so}
                              </span>
                              <span style={{ fontFamily: "'JetBrains Mono',monospace", padding: "8px 0", textAlign: "right", color: "#f0565a" }}>
                                {r?.dd}
                              </span>
                              <span style={{ fontFamily: "'JetBrains Mono',monospace", padding: "8px 0", textAlign: "right" }}>
                                {r?.win}
                              </span>
                              <span style={{ fontFamily: "'JetBrains Mono',monospace", padding: "8px 6px 8px 0", textAlign: "right" }}>
                                {r?.rr}
                              </span>
                            </button>
                          </Fragment>
                        ))}
                      </div>
                    </div>
                    <div style={{ position: "relative", border: "1px solid #1a1f21", background: "#0d0f10", borderRadius: "12px", padding: "18px 20px", overflowX: "auto" }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginBottom: "10px" }}>
                        <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".12em", color: "#f0d68c" }}>
                          {"TRADE LOG"}
                        </span>
                        <span style={{ fontSize: "11.5px", color: "#5f6966" }}>
                          {vm.labTradeCnt}
                        </span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(80px,1fr))", minWidth: "640px", fontSize: "12px" }}>
                        {(vm.tradeHead || []).map((c, c__i) => (
                          <Fragment key={c__i}>
                            <span style={{ color: "#5f6966", fontSize: "10.5px", fontWeight: "700", letterSpacing: ".08em", padding: "6px 0", borderBottom: "1px solid #1a2328", textAlign: c?.al }}>
                              {c?.l}
                            </span>
                          </Fragment>
                        ))}
                        {(vm.labTrades || []).map((t, t__i) => (
                          <Fragment key={t__i}>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", padding: "6px 0", borderBottom: "1px solid #12181b", color: "#aab3b0" }}>
                              {t?.inD}
                            </span>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", padding: "6px 0", borderBottom: "1px solid #12181b", textAlign: "right" }}>
                              {t?.inP}
                            </span>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", padding: "6px 0", borderBottom: "1px solid #12181b", color: "#aab3b0" }}>
                              {t?.outD}
                            </span>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", padding: "6px 0", borderBottom: "1px solid #12181b", textAlign: "right" }}>
                              {t?.outP}
                            </span>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", padding: "6px 0", borderBottom: "1px solid #12181b", textAlign: "right", color: t?.rc }}>
                              {t?.r}
                            </span>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", padding: "6px 0", borderBottom: "1px solid #12181b", textAlign: "right" }}>
                              {t?.d}
                            </span>
                            <span style={{ padding: "6px 0", borderBottom: "1px solid #12181b", textAlign: "right", color: "#8b9592" }}>
                              {t?.why}
                            </span>
                          </Fragment>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
              {(vm.labHasRes) ? (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))", gap: "18px", alignItems: "start" }}>
                    <div style={{ position: "relative", border: "1px solid #1a1f21", background: "#0d0f10", borderRadius: "12px", padding: "18px 20px" }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginBottom: "10px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".12em", color: "#f0d68c" }}>
                          {"VARIANCE TEST"}
                        </span>
                        <span style={{ fontSize: "11.5px", color: "#5f6966" }}>
                          {"Sharpe by stop \u00d7 target \u00b7 click a cell to apply"}
                        </span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "64px repeat(3,minmax(0,1fr))", gap: "4px", fontSize: "12px" }}>
                        <span>
                        </span>
                        {(vm.varHead || []).map((l, l__i) => (
                          <Fragment key={l__i}>
                            <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".06em", color: "#5f6966", textAlign: "center", padding: "4px 0" }}>
                              {l}
                            </span>
                          </Fragment>
                        ))}
                        {(vm.varRows || []).map((r, r__i) => (
                          <Fragment key={r__i}>
                            <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".06em", color: "#5f6966", alignSelf: "center" }}>
                              {"STOP "}
                              {r?.sl}
                            </span>
                            {(r?.cells || []).map((x, x__i) => (
                              <Fragment key={x__i}>
                                <button onClick={x?.onClick} style={{ borderRadius: "8px", background: x?.bg, border: `1px solid ${x?.bd ?? ''}`, color: "#e6ebe8", padding: "8px 4px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "1px" }} className="slx83">
                                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "14px" }}>
                                    {x?.sh}
                                  </span>
                                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "10.5px", color: "#aab3b0" }}>
                                    {x?.cg}
                                  </span>
                                </button>
                              </Fragment>
                            ))}
                          </Fragment>
                        ))}
                      </div>
                    </div>
                    <div style={{ position: "relative", border: "1px solid #1a1f21", background: "#0d0f10", borderRadius: "12px", padding: "18px 20px", overflowX: "auto" }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginBottom: "10px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".12em", color: "#f0d68c" }}>
                          {"GROUP TEST"}
                        </span>
                        <span style={{ fontSize: "11.5px", color: "#5f6966" }}>
                          {"Same rules on every loaded stock \u00b7 click to switch"}
                        </span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "70px repeat(6,minmax(58px,1fr))", minWidth: "460px", fontSize: "12.5px" }}>
                        <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".06em", color: "#5f6966", padding: "6px 0", borderBottom: "1px solid #1a2328" }}>
                          {"STOCK"}
                        </span>
                        <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".06em", color: "#5f6966", padding: "6px 0", borderBottom: "1px solid #1a2328", textAlign: "right" }}>
                          {"CAGR"}
                        </span>
                        <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".06em", color: "#5f6966", padding: "6px 0", borderBottom: "1px solid #1a2328", textAlign: "right" }}>
                          {"B"}
                          {"&"}
                          {"H"}
                        </span>
                        <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".06em", color: "#5f6966", padding: "6px 0", borderBottom: "1px solid #1a2328", textAlign: "right" }}>
                          {"EXCESS"}
                        </span>
                        <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".06em", color: "#5f6966", padding: "6px 0", borderBottom: "1px solid #1a2328", textAlign: "right" }}>
                          {"SHARPE"}
                        </span>
                        <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".06em", color: "#5f6966", padding: "6px 0", borderBottom: "1px solid #1a2328", textAlign: "right" }}>
                          {"MAX DD"}
                        </span>
                        <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".06em", color: "#5f6966", padding: "6px 0", borderBottom: "1px solid #1a2328", textAlign: "right" }}>
                          {"TRADES"}
                        </span>
                        {(vm.grpRows || []).map((g, g__i) => (
                          <Fragment key={g__i}>
                            <button onClick={g?.onClick} style={{ borderRadius: "8px", gridColumn: "1/-1", display: "grid", gridTemplateColumns: "subgrid", background: g?.bg, border: "0", borderBottom: "1px solid #12181b", padding: "0", cursor: "pointer", color: "#e6ebe8", textAlign: "left" }} className="slx84">
                              <span style={{ padding: "8px 0 8px 4px", fontWeight: "800" }}>
                                {g?.t}
                              </span>
                              <span style={{ fontFamily: "'JetBrains Mono',monospace", padding: "8px 0", textAlign: "right" }}>
                                {g?.cagr}
                              </span>
                              <span style={{ fontFamily: "'JetBrains Mono',monospace", padding: "8px 0", textAlign: "right", color: "#8b9592" }}>
                                {g?.bh}
                              </span>
                              <span style={{ fontFamily: "'JetBrains Mono',monospace", padding: "8px 0", textAlign: "right", color: g?.exC }}>
                                {g?.ex}
                              </span>
                              <span style={{ fontFamily: "'JetBrains Mono',monospace", padding: "8px 0", textAlign: "right" }}>
                                {g?.sh}
                              </span>
                              <span style={{ fontFamily: "'JetBrains Mono',monospace", padding: "8px 0", textAlign: "right", color: "#f0565a" }}>
                                {g?.dd}
                              </span>
                              <span style={{ fontFamily: "'JetBrains Mono',monospace", padding: "8px 4px 8px 0", textAlign: "right" }}>
                                {g?.tr}
                              </span>
                            </button>
                          </Fragment>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
              {(vm.labHasRes) ? (
                <>
                  <div style={{ position: "relative", border: "1px solid #2a2618", background: "#0d0f10", borderRadius: "14px", padding: "18px 20px", display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".12em", color: "#f0d68c" }}>
                        {"EVIDENCE"}
                      </span>
                      <span style={{ fontFamily: "'Barlow Condensed',Manrope,sans-serif", fontWeight: "600", fontSize: "20px" }}>
                        {vm.evSummary}
                      </span>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "11px", color: "#5f6966", marginLeft: "auto" }}>
                        {vm.evId}
                      </span>
                      <button onClick={vm.evExport} style={{ borderRadius: "8px", background: "none", border: "1px solid #5a4a22", color: "#cfd6d3", padding: "5px 10px", fontSize: "11.5px", fontWeight: "700", cursor: "pointer" }} className="slx85">
                        {"Export JSON"}
                      </button>
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", fontSize: "12px", color: "#8b9592" }}>
                      <span style={{ fontWeight: "700", color: vm.evCovC }}>
                        {"Coverage "}
                        {vm.evCov}
                      </span>
                      <span>
                        {"\u00b7 "}
                        {vm.evCovD}
                      </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {(vm.evClaims || []).map((c, c__i) => (
                        <Fragment key={c__i}>
                          <div style={{ display: "grid", gridTemplateColumns: "108px minmax(0,1fr) minmax(0,1fr)", gap: "12px", alignItems: "baseline", padding: "9px 0", borderTop: "1px solid #12181b" }}>
                            <span style={{ fontSize: "10px", fontWeight: "800", letterSpacing: ".08em", padding: "3px 7px", justifySelf: "start", border: `1px solid ${c?.bd ?? ''}`, color: c?.col }}>
                              {c?.status}
                            </span>
                            <span style={{ fontSize: "13px", color: "#e6ebe8" }}>
                              {c?.text}
                            </span>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "11.5px", color: "#8b9592" }}>
                              {c?.ev}
                            </span>
                          </div>
                        </Fragment>
                      ))}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: "12px 28px", borderTop: "1px solid #1a2328", paddingTop: "12px" }}>
                      <div>
                        <div style={{ fontSize: "10px", fontWeight: "700", letterSpacing: ".1em", color: "#7a8481", marginBottom: "6px" }}>
                          {"LIMITATIONS"}
                        </div>
                        {(vm.evLims || []).map((u, u__i) => (
                          <Fragment key={u__i}>
                            <div style={{ display: "flex", gap: "8px", fontSize: "12.5px", color: "#aab3b0", lineHeight: "1.5" }}>
                              <span style={{ color: "#c9a24a" }}>
                                {"+"}
                              </span>
                              <span>
                                {u}
                              </span>
                            </div>
                          </Fragment>
                        ))}
                      </div>
                      <div>
                        <div style={{ fontSize: "10px", fontWeight: "700", letterSpacing: ".1em", color: "#7a8481", marginBottom: "6px" }}>
                          {"OPEN UNKNOWNS \u00b7 FOLLOW-UP QUESTIONS"}
                        </div>
                        {(vm.evUnk || []).map((u, u__i) => (
                          <Fragment key={u__i}>
                            <div style={{ display: "flex", gap: "8px", fontSize: "12.5px", color: "#aab3b0", lineHeight: "1.5" }}>
                              <span style={{ color: "#c9a24a" }}>
                                {"?"}
                              </span>
                              <span>
                                {u?.q}
                                {" "}
                                <span style={{ color: "#5f6966" }}>
                                  {"\u2014 "}
                                  {u?.status}
                                </span>
                              </span>
                            </div>
                          </Fragment>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", flexWrap: "wrap" }}>
                <button onClick={vm.labRefine} style={{ borderRadius: "8px", background: "none", border: "1px solid #5a4a22", color: "#cfd6d3", padding: "10px 16px", fontWeight: "700", fontSize: "12.5px", cursor: "pointer" }} className="slx86">
                  {"\u2190 Refine rules"}
                </button>
                <button onClick={vm.labAct} style={{ borderRadius: "8px", position: "relative", border: "0", background: "#c9a24a", color: "#fff", padding: "10px 18px", fontWeight: "800", fontSize: "12.5px", letterSpacing: ".04em", cursor: "pointer" }} className="slx87">
                  {"See today's matches \u2192"}
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
