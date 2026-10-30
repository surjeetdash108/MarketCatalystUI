// Originally generated from the Strategy AI Lab prototype markup (scripts/strategy-lab/build.sh, now retired).
// Maintained by hand; the results panel, report, facts and edit modal live in lab-panels.jsx.
import { Fragment } from "react";
import { EditModal, FactsBlock, Report, ResultsPanel } from "./lab-panels";

/** A logo that fails to load is hidden (the prototype's data-logo-src behaviour). */

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
                      {(vm.aiParas || []).map((p, p__i) => (
                        <Fragment key={p__i}>
                          <div style={{ fontSize: "14px", lineHeight: "1.6", color: "#cfd6d3", textWrap: "pretty" }}>
                            {p}
                          </div>
                        </Fragment>
                      ))}
                      <FactsBlock f={vm.aiF} />
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
                    <ResultsPanel r={vm.hv} />
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
        <EditModal e={vm.edit} />
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
                          {"Pick one from the list to see what it is, its rules, and the backtest results across the 50 largest S&P 500 stocks."}
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
                          <div style={{ flex: "1 1 100%", minWidth: "0" }}><FactsBlock f={vm.pkF} /></div>
                        </div>
                        <ResultsPanel r={vm.dv} />
                      </div>
                    </>
                  ) : null}
                </div>
              </>
            ) : null}
          </>
        ) : null}
        {(vm.labS3) ? (<Report p={vm.rep} />) : null}
      </div>
    </>
  );
}
