"use client";

import { Fragment } from "react";
import type { ChartSpec } from "./overview-charts";

/** The small grouped bar chart under a Fundamentals tile: one group per quarter, optional peer-average lines. */

const PLOT_H = 190;
/** Room kept at the top of the plot for the value labels. */
const LABEL_H = 22;

const CSS = `
.rcx{display:flex;flex-direction:column;gap:10px;margin-top:4px}
.rcx-lg{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:12.5px;color:var(--ov-mid)}
.rcx-lg span{display:inline-flex;align-items:center;gap:7px}
.rcx-lg b{font-weight:700}
.rcx-lg i{display:inline-block;width:12px;height:12px;border-radius:3px}
.rcx-lg i.d{height:0;width:24px;border-radius:0;border-top:4px solid}
.rcx-plot{position:relative}
.rcx-grp{position:absolute;top:0;bottom:0}
.rcx-grp.last{background:var(--ov-hl);border-radius:8px;box-shadow:inset 0 0 0 1px var(--ov-hl-edge)}
.rcx-bar{position:absolute;border-radius:3px 3px 0 0}
.rcx-bar.n{border-radius:0 0 3px 3px}
.rcx-bv{position:absolute;z-index:3;text-align:center;font-size:12.5px;font-weight:700;line-height:14px;white-space:nowrap;text-shadow:0 0 5px var(--ov-card),0 0 5px var(--ov-card)}
.rcx-base{position:absolute;left:0;right:0;height:1px;background:var(--ov-line)}
.rcx-ref{position:absolute;z-index:2;left:0;right:0;height:0;margin-bottom:-1.5px;border-top:3px solid;opacity:.92;pointer-events:none}
.rcx-tags{position:relative;height:15px;margin-top:5px}
.rcx-tg{position:absolute;top:0;bottom:0}
.rcx-tg span{position:absolute;top:0;text-align:center;font-size:11px;font-weight:600;line-height:15px;white-space:nowrap;color:var(--ov-body)}
.rcx-xl{display:flex;margin-top:6px}
.rcx-xl>div{flex:1;text-align:center;min-width:0}
.rcx-xl span{display:block;font-size:12px;color:var(--ov-sub)}
.rcx-xl span.last{color:var(--ov-hi);font-weight:700}
.rcx-xl small{display:block;margin-top:3px;font-size:12px;font-weight:700}
.rcx-empty{padding:28px 0;text-align:center;color:var(--ov-sub);font-size:14px}
`;

function Plot({ spec }: { spec: ChartSpec }) {
  const n = spec.groups.length;
  const values = spec.series.flatMap((s) => s.values).filter((v): v is number => v != null);
  const refValues = (spec.refs ?? []).map((r) => r.value);
  const top = Math.max(0, ...values, ...refValues);
  const below = Math.max(0, ...values.map((v) => -v));
  const labelRoom = below > 0 ? LABEL_H : 0;
  const scale = (PLOT_H - LABEL_H - labelRoom) / Math.max(1e-9, top + below);
  const baseline = labelRoom + below * scale;
  const step = 100 / n;
  const pair = spec.series.length === 2;
  const barMax = n <= 2 ? 76 : 52;
  const barW = pair ? `min(${barMax}px, 38%)` : `min(${barMax + 12}px, 44%)`;
  const barLeft = (si: number) => (pair ? (si === 0 ? `calc(50% - ${barW} - 2px)` : "calc(50% + 2px)") : `calc(50% - ${barW} / 2)`);

  return (
    <div>
      <div className="rcx-plot" style={{ height: PLOT_H }} role="img" aria-label={spec.series.map((s) => s.name).join(" and ")}>
        {spec.groups.map((group, gi) => {
          const last = gi === n - 1;
          const bright = !spec.highlightLast || last;
          return (
            <div key={group} className={`rcx-grp${spec.highlightLast && last ? " last" : ""}`} style={{ left: `${gi * step}%`, width: `${step}%` }}>
              {spec.series.map((s, si) => {
                const v = s.values[gi];
                const left = barLeft(si);
                const labelColor = v != null && v < 0 ? "var(--ov-dn)" : bright ? s.color(gi, true) : "var(--ov-body)";
                if (v == null) {
                  return (
                    <span key={s.name} className="rcx-bv" style={{ left, width: barW, bottom: baseline + 4, color: "var(--ov-sub)" }}>
                      {"—"}
                    </span>
                  );
                }
                const h = Math.max(3, Math.abs(v) * scale);
                return (
                  <Fragment key={s.name}>
                    <i className={`rcx-bar${v < 0 ? " n" : ""}`} style={{ left, width: barW, height: h, bottom: v >= 0 ? baseline : baseline - h, background: s.color(gi, bright) }} />
                    <span className="rcx-bv" style={{ left, width: barW, bottom: v >= 0 ? baseline + h + 4 : baseline - h - 4 - 14, color: labelColor }}>
                      {spec.fmt(v)}
                    </span>
                  </Fragment>
                );
              })}
            </div>
          );
        })}
        <div className="rcx-base" style={{ bottom: baseline }} />
        {(spec.refs ?? []).map((r) => (
          <div key={r.label} className="rcx-ref" style={{ bottom: baseline + r.value * scale, borderColor: r.color }} />
        ))}
      </div>
      {spec.series.some((s) => s.tag) && (
        <div className="rcx-tags" aria-hidden="true">
          {spec.groups.map((group, gi) => (
            <div key={group} className="rcx-tg" style={{ left: `${gi * step}%`, width: `${step}%` }}>
              {spec.series.map((s, si) => (s.tag ? <span key={s.name} title={s.name} style={{ left: barLeft(si), width: barW }}>{s.tag}</span> : null))}
            </div>
          ))}
        </div>
      )}
      <div className="rcx-xl">
        {spec.groups.map((group, gi) => {
          const latest = spec.highlightLast && gi === n - 1;
          return (
            <div key={group}>
              <span className={latest ? "last" : undefined}>
                {group}
                {latest ? " · latest" : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ReadChart({ spec }: { spec: ChartSpec }) {
  const drawn = spec.groups.length > 0 && spec.series.some((s) => s.values.some((v) => v != null));
  return (
    <div className="rcx">
      <style>{CSS}</style>
      {drawn ? (
        <>
          <Plot spec={spec} />
          {(spec.refs ?? []).length > 0 && (
            <div className="rcx-lg">
              {(spec.refs ?? []).map((r) => (
                <span key={r.label}>
                  <i className="d" style={{ borderColor: r.color }} />
                  {r.label}
                </span>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="rcx-empty">{spec.empty ?? "Not enough reported quarters to draw this yet."}</div>
      )}
    </div>
  );
}
