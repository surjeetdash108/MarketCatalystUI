"use client";

import { Fragment } from "react";
import type { FundamentalsPaneModel, FxBar, FxChip, FxMarginRow, FxMarginsTile, FxMini, FxPeLine, FxSeg, FxStatTile, FxStatus, FxTone, FxValuationTile } from "./fundamentals-model";

/**
 * The Overview's Fundamentals pane, drawn as in the new design (pltr-fundamentals.html): a pill and a headline over a
 * grid of four tiles. It only paints what fundamentals-model.ts hands it. The styles are classes, not inline styles:
 * the screen's own rules rewrite inline letter-spaced and card-looking styles, which would restyle the tile headings.
 * Colours come from the screen's --ov-* tokens (dark and light); the few the design adds are scoped to .fxp.
 */

const PLOT_H = 76;

const CSS = `
.fxp{container-type:inline-size;--fx-chip:#161a20;--fx-chip-line:#262b33;--fx-track:#20252d;--fx-axis:#343b46;--fx-blue:#6aa9ff;--fx-blue-dk:#36577f;--fx-amber:#e6b94f;--fx-dot:#5b6472}
.si-screen[data-theme="light"] .fxp,.iq-root[data-theme="light"] .si-screen .fxp{--fx-chip:#f1f5f9;--fx-chip-line:#e2e8f0;--fx-track:#e2e8f0;--fx-axis:#cbd5e1;--fx-blue:#2563eb;--fx-blue-dk:#93b4f5;--fx-amber:#b45309;--fx-dot:#94a3b8}
.fxp-card{display:flex;flex-direction:column;gap:18px;padding:22px 24px;background:var(--ov-card);border:1px solid var(--ov-line);border-radius:16px;box-sizing:border-box}
.fxp-top{display:flex;align-items:center;gap:12px}
.fxp-pill{flex:none;padding:5px 10px;border-radius:8px;font-size:12px;font-weight:700;white-space:nowrap}
.fxp-pill.up{background:color-mix(in srgb,var(--ov-up) 12%,transparent)}
.fxp-pill.dn{background:color-mix(in srgb,var(--ov-dn) 12%,transparent)}
.fxp-pill.mid{background:color-mix(in srgb,var(--ov-mid) 14%,transparent)}
.fxp-lead{margin:0;font-size:18px;font-weight:700;line-height:1.35;color:var(--ov-hi);text-transform:none}
.fxp-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;align-items:stretch}
.fxp-grid.one{grid-template-columns:minmax(0,1fr)}
.fxp-tile{container-type:inline-size;display:flex;flex-direction:column;gap:12px;padding:18px 20px;background:var(--ov-card2);border:1px solid var(--ov-line);border-radius:12px;min-width:0;box-sizing:border-box}
.fxp-th{display:flex;justify-content:space-between;align-items:center;gap:10px}
.fxp-t{margin:0;font-size:13px;font-weight:700;letter-spacing:.06em;color:var(--ov-mid);text-transform:none}
.fxp-st{font-size:13px;font-weight:700;text-align:right}
.fxp-row{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px 20px;flex:1}
.fxp-left{display:flex;flex-direction:column;gap:10px;min-width:0}
.fxp-cap{font-size:12px;font-weight:600;color:var(--ov-mid)}
.fxp-cap b{font-weight:600;color:var(--ov-hi)}
.fxp-bigrow{display:flex;align-items:baseline;flex-wrap:wrap;gap:6px 10px}
.fxp-big{font-size:44px;font-weight:800;line-height:1}
.fxp-badge{font-size:12px;font-weight:700;padding:3px 8px;border-radius:6px;white-space:nowrap}
.fxp-badge.warn{background:color-mix(in srgb,var(--fx-amber) 12%,transparent)}
.fxp-badge.dn{background:color-mix(in srgb,var(--ov-dn) 12%,transparent)}
.fxp-badge.up{background:color-mix(in srgb,var(--ov-up) 12%,transparent)}
.fxp-badge.mid,.fxp-badge.hi,.fxp-badge.blue{background:var(--fx-chip)}
.fxp-chips{display:flex;flex-wrap:wrap;gap:8px}
.fxp-chip{display:flex;flex-direction:column;gap:2px;padding:8px 12px;border-radius:8px;background:var(--fx-chip);border:1px solid var(--fx-chip-line)}
.fxp-chip span{font-size:11px;font-weight:600;letter-spacing:.04em;color:var(--ov-sub);text-transform:none}
.fxp-chip b{font-size:15px;font-weight:700}
.fxp-note{margin:0;font-size:12px;line-height:1.4;color:var(--ov-mid)}
.fxp-note strong{color:var(--ov-hi);font-weight:700}
.fxp-mini{display:flex;flex-direction:column;gap:6px;flex:0 0 220px;width:220px}
.fxp-plot{position:relative;display:flex;gap:8px}
.fxp-col{position:relative;flex:1;min-width:0}
.fxp-bar{position:absolute;left:0;right:0;border-radius:3px 3px 0 0;display:block}
.fxp-bar.n{border-radius:0 0 3px 3px}
.fxp-bar.up{background:var(--ov-up-dk)}.fxp-bar.up.b{background:var(--ov-up)}
.fxp-bar.blue{background:var(--fx-blue-dk)}.fxp-bar.blue.b{background:var(--fx-blue)}
.fxp-bar.dn{background:var(--ov-dn-dk)}.fxp-bar.dn.b{background:var(--ov-dn)}
.fxp-bar.none{background:var(--fx-axis);border-radius:0}
.fxp-bl{position:absolute;left:0;right:0;text-align:center;font-size:11px;line-height:13px;color:var(--ov-mid);white-space:nowrap}
.fxp-bl.none{color:var(--ov-sub)}
.fxp-bl.b{font-weight:700}
.fxp-bl.b.up{color:var(--ov-up)}.fxp-bl.b.blue{color:var(--fx-blue)}.fxp-bl.b.dn{color:var(--ov-dn)}
.fxp-base{position:absolute;left:0;right:0;height:1px;background:var(--fx-axis)}
.fxp-xl{display:flex;gap:8px;font-size:10px;color:var(--ov-sub);text-align:center}
.fxp-xl span{flex:1;min-width:0}
.fxp-xl span.b{color:var(--ov-hi);font-weight:700}
.fxp-mrows{flex:1;display:flex;flex-direction:column;justify-content:center;gap:14px}
.fxp-mrow{display:grid;grid-template-columns:90px 1fr minmax(70px,auto);align-items:center;gap:14px}
.fxp-mname{font-size:13px;color:var(--ov-body)}
.fxp-track{position:relative;height:10px;border-radius:5px;background:var(--fx-track)}
.fxp-fill{position:absolute;left:0;top:0;bottom:0;border-radius:5px}
.fxp-fill.up{background:var(--ov-up)}.fxp-fill.blue{background:var(--fx-blue)}.fxp-fill.dn{background:var(--ov-dn)}
.fxp-tick{position:absolute;top:-4px;bottom:-4px;width:2px;background:var(--ov-hi)}
.fxp-mval{font-size:22px;font-weight:800;text-align:right}
.fxp-msub{grid-column:2/4;margin-top:-8px;font-size:12px;color:var(--ov-sub)}
.fxp-msub strong{font-weight:700}
.fxp-pe{display:flex;flex-direction:column;gap:8px;flex:0 0 240px;width:240px}
.fxp-pe-line{position:relative;height:92px}
.fxp-pe-axis{position:absolute;left:0;right:0;top:36px;height:2px;background:var(--fx-axis)}
.fxp-pe-seg{position:absolute;top:35px;height:4px;border-radius:2px}
.fxp-pe-seg.r-dn{background:linear-gradient(90deg,var(--fx-dot),var(--ov-dn))}
.fxp-pe-seg.r-up{background:linear-gradient(90deg,var(--fx-dot),var(--ov-up))}
.fxp-pe-seg.r-hi{background:linear-gradient(90deg,var(--fx-dot),var(--ov-mid))}
.fxp-pe-seg.l-dn{background:linear-gradient(90deg,var(--ov-dn),var(--fx-dot))}
.fxp-pe-seg.l-up{background:linear-gradient(90deg,var(--ov-up),var(--fx-dot))}
.fxp-pe-seg.l-hi{background:linear-gradient(90deg,var(--ov-mid),var(--fx-dot))}
.fxp-pe-dot{position:absolute;top:30px;width:14px;height:14px;margin-left:-7px;border-radius:50%;border:2px solid var(--ov-card2);box-sizing:border-box}
.fxp-pe-dot.mid{background:var(--ov-mid)}.fxp-pe-dot.warn{background:var(--fx-amber)}.fxp-pe-dot.dn{background:var(--ov-dn)}.fxp-pe-dot.up{background:var(--ov-up)}.fxp-pe-dot.hi{background:var(--ov-hi)}
.fxp-pe-lb{position:absolute;top:52px;transform:translateX(-50%);font-size:11px;font-weight:700;white-space:nowrap;text-align:center;line-height:1.3}
.fxp-pe-lb.above{top:0}
.fxp-pe-ax{display:flex;justify-content:space-between;font-size:10px;color:var(--ov-sub)}
.fx-up{color:var(--ov-up)}.fx-dn{color:var(--ov-dn)}.fx-hi{color:var(--ov-hi)}.fx-mid{color:var(--ov-mid)}.fx-blue{color:var(--fx-blue)}.fx-warn{color:var(--fx-amber)}
@container (max-width: 640px){.fxp-grid{grid-template-columns:minmax(0,1fr)}}
@container (max-width: 480px){.fxp-row{flex-direction:column;align-items:stretch;justify-content:flex-start}.fxp-mini,.fxp-pe{flex:none;width:auto}.fxp-mrow{grid-template-columns:76px 1fr minmax(64px,auto);gap:10px}.fxp-big{font-size:38px}}
`;

const tone = (t: FxTone) => `fx-${t}`;

function Segs({ segs }: { segs: FxSeg[] }) {
  return (
    <>
      {segs.map((s, i) =>
        s.strong ? (
          <strong key={i} className={tone(s.tone ?? "hi")}>
            {s.t}
          </strong>
        ) : (
          <Fragment key={i}>{s.t}</Fragment>
        ),
      )}
    </>
  );
}

function Head({ title, status }: { title: string; status: FxStatus }) {
  return (
    <div className="fxp-th">
      <h3 className="fxp-t" data-caps>
        {title}
      </h3>
      <span className={`fxp-st ${tone(status.tone)}`}>{status.text}</span>
    </div>
  );
}

function Chips({ chips }: { chips: FxChip[] }) {
  if (!chips.length) return null;
  return (
    <div className="fxp-chips">
      {chips.map((c) => (
        <div key={c.label} className="fxp-chip">
          <span data-caps>{c.label}</span>
          <b className={`ovx-mono ${tone(c.tone)}`}>{c.value}</b>
        </div>
      ))}
    </div>
  );
}

function Big({ big, badge }: { big: { text: string; tone: FxTone }; badge: FxStatus | null }) {
  const num = <span className={`fxp-big ovx-mono ${tone(big.tone)}`}>{big.text}</span>;
  if (!badge) return num;
  return (
    <span className="fxp-bigrow">
      {num}
      <span className={`fxp-badge ${badge.tone} ${tone(badge.tone)}`}>{badge.text}</span>
    </span>
  );
}

function Mini({ mini }: { mini: FxMini }) {
  const deepest = Math.max(0, ...mini.bars.map((b) => (b.h < 0 ? -b.h : 0)));
  // Room under the baseline for a negative bar and the label hanging from it.
  const below = deepest > 0 ? deepest + 15 : 0;
  return (
    <div className="fxp-mini">
      <div className="fxp-plot" role="img" aria-label={mini.ariaLabel} style={{ height: PLOT_H + below }}>
        {mini.bars.map((b: FxBar) => {
          const size = b.h === 0 ? 2 : Math.abs(b.h);
          const barBottom = b.h < 0 ? below - size : below;
          const labelBottom = b.h < 0 ? barBottom - 15 : below + size + 3;
          return (
            <div key={b.x} className="fxp-col">
              <span className={`fxp-bl ${b.tone}${b.latest ? " b" : ""}`} style={{ bottom: labelBottom }}>
                {b.text}
              </span>
              <i className={`fxp-bar ${b.tone}${b.latest ? " b" : ""}${b.h < 0 ? " n" : ""}`} style={{ bottom: barBottom, height: size }} />
            </div>
          );
        })}
        <div className="fxp-base" style={{ bottom: below }} />
      </div>
      <div className="fxp-xl" aria-hidden="true">
        {mini.bars.map((b) => (
          <span key={b.x} className={b.latest ? "b" : undefined}>
            {b.x}
          </span>
        ))}
      </div>
    </div>
  );
}

function StatTile({ t }: { t: FxStatTile }) {
  return (
    <article className="fxp-tile" aria-label={t.title}>
      <Head title={t.title} status={t.status} />
      <div className="fxp-row">
        <div className="fxp-left">
          <span className="fxp-cap">
            {t.caption}
            {t.period && (
              <>
                {" · "}
                <b>{t.period}</b>
              </>
            )}
          </span>
          <Big big={t.big} badge={t.badge} />
          <Chips chips={t.chips} />
          {t.note && <p className="fxp-note">{t.note}</p>}
        </div>
        {t.mini && <Mini mini={t.mini} />}
      </div>
    </article>
  );
}

function MarginRow({ r }: { r: FxMarginRow }) {
  return (
    <div className="fxp-mrow">
      <span className="fxp-mname">{r.name}</span>
      <div className="fxp-track" role="img" aria-label={`${r.name} margin ${r.text}`}>
        <div className={`fxp-fill ${r.fill}`} style={{ width: `${r.width}%` }} />
        {r.tick && <div className="fxp-tick" aria-hidden="true" title={r.tick.label} style={{ left: `${r.tick.at}%` }} />}
      </div>
      <span className={`fxp-mval ovx-mono ${tone(r.tone)}`}>{r.text}</span>
      <span />
      {r.sub.length > 0 && (
        <span className="fxp-msub">
          <Segs segs={r.sub} />
        </span>
      )}
    </div>
  );
}

function MarginsTile({ t }: { t: FxMarginsTile }) {
  return (
    <article className="fxp-tile" aria-label={t.title}>
      <Head title={t.title} status={t.status} />
      <div className="fxp-mrows">
        {t.rows.map((r) => (
          <MarginRow key={r.name} r={r} />
        ))}
      </div>
    </article>
  );
}

function PeLine({ line }: { line: FxPeLine }) {
  const seg = line.seg;
  const edge = (at: number) => `clamp(26px, ${at}%, calc(100% - 26px))`;
  return (
    <>
      <div className="fxp-pe-line" role="img" aria-label={line.ariaLabel}>
        <div className="fxp-pe-axis" />
        {seg && <div className={`fxp-pe-seg ${seg.side}-${seg.tone}`} style={{ left: `${seg.from}%`, right: `${100 - seg.to}%` }} />}
        {line.markers.map((m) => (
          <Fragment key={m.key}>
            <i className={`fxp-pe-dot ${m.tone}`} style={{ left: `${m.at}%` }} />
            <span className={`fxp-pe-lb ${tone(m.tone)}${m.above ? " above" : ""}`} style={{ left: edge(m.labelAt) }}>
              {m.name}
              <br />
              {m.text}
            </span>
          </Fragment>
        ))}
      </div>
      <div className="fxp-pe-ax" aria-hidden="true">
        <span>0{"×"}</span>
        <span>
          {line.mid}
          {"×"}
        </span>
        <span>
          {line.max}
          {"×"}
        </span>
      </div>
    </>
  );
}

function ValuationTile({ t }: { t: FxValuationTile }) {
  // "Forward P/E implies about 75% EPS growth ..." keeps its figure bright.
  const note = t.note ? /^(.*?)(\d+% EPS growth)(.*)$/.exec(t.note) : null;
  return (
    <article className="fxp-tile" aria-label={t.title}>
      <Head title={t.title} status={t.status} />
      <div className="fxp-row">
        <div className="fxp-left">
          <span className="fxp-cap">
            {t.caption}
            {t.period && (
              <>
                {" · "}
                <b>{t.period}</b>
              </>
            )}
          </span>
          <Big big={t.big} badge={t.badge} />
          <Chips chips={t.chips} />
        </div>
        {(t.line || t.note) && (
          <div className="fxp-pe">
            {t.line && <PeLine line={t.line} />}
            {t.note && (
              <p className="fxp-note">
                {note ? (
                  <>
                    {note[1]}
                    <strong>{note[2]}</strong>
                    {note[3]}
                  </>
                ) : (
                  t.note
                )}
              </p>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

export function FundamentalsPane({ model }: { model: FundamentalsPaneModel }) {
  return (
    <div className="fxp">
      <style>{CSS}</style>
      <section className="fxp-card" aria-label="Fundamentals">
        <div className="fxp-top">
          <span className={`fxp-pill ${model.pill.tone} ${tone(model.pill.tone)}`}>{model.pill.text}</span>
          <h2 className="fxp-lead">{model.lead}</h2>
        </div>
        <div className={`fxp-grid${model.tiles.length === 1 ? " one" : ""}`}>
          {model.tiles.map((t) => {
            switch (t.kind) {
              case "margins":
                return <MarginsTile key={t.kind} t={t} />;
              case "valuation":
                return <ValuationTile key={t.kind} t={t} />;
              default:
                return <StatTile key={t.kind} t={t} />;
            }
          })}
        </div>
      </section>
    </div>
  );
}
