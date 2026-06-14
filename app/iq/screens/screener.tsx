"use client";

import { useState } from "react";
import { useIQActions } from "../shell";
import { screenerStocks, screenerPresets } from "../data";
import { cls, arr, fmt } from "../utils";

interface Filters {
  moat: string;
  eg: number;
  pe_max: number;
  yld: number;
}

const defaultFilters: Filters = { moat: "Any", eg: 0, pe_max: 9999, yld: 0 };

export function ScreenerScreen() {
  const { openStock } = useIQActions();
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [sortCol, setSortCol] = useState<keyof typeof screenerStocks[0]>("alpha");
  const [sortAsc, setSortAsc] = useState(false);

  function applyPreset(idx: number) {
    const p = screenerPresets[idx];
    const f = p.f as unknown as Record<string, string | number>;
    setFilters({
      moat: (f.moat as string) || "Any",
      eg: (f.eg as number) || 0,
      pe_max: (f.pe_max as number) || 9999,
      yld: (f.yld as number) || 0,
    });
  }

  function toggleSort(col: keyof typeof screenerStocks[0]) {
    if (sortCol === col) setSortAsc(a => !a);
    else { setSortCol(col); setSortAsc(false); }
  }

  const filtered = screenerStocks
    .filter(s => {
      if (filters.moat !== "Any" && s.moat !== filters.moat) return false;
      if (s.eg < filters.eg) return false;
      if (s.pe > filters.pe_max) return false;
      if (s.yld < filters.yld) return false;
      return true;
    })
    .sort((a, b) => {
      const va = a[sortCol] as number;
      const vb = b[sortCol] as number;
      return sortAsc ? va - vb : vb - va;
    });

  function SortTh({ col, label }: { col: keyof typeof screenerStocks[0]; label: string }) {
    const active = sortCol === col;
    return (
      <th style={{ cursor: "pointer", color: active ? "var(--brand-2)" : undefined }}
        onClick={() => toggleSort(col)}>
        {label} {active ? (sortAsc ? "▲" : "▼") : ""}
      </th>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Screener</div>
          <div className="page-sub">{filtered.length} of {screenerStocks.length} stocks match</div>
        </div>
        <div className="actions">
          <button className="chip" onClick={() => setFilters(defaultFilters)}>Reset Filters</button>
        </div>
      </div>

      <div className="scr-grid">
        {/* Filter panel */}
        <div className="scr-panel">
          <div className="scr-label">Presets</div>
          {screenerPresets.map((p, i) => (
            <div key={p.name} className="scr-preset" onClick={() => applyPreset(i)}>{p.name}</div>
          ))}

          <div className="scr-label">Moat</div>
          {["Any", "Wide", "Narrow"].map(v => (
            <div key={v} className="scr-row" style={{ cursor: "pointer" }}
              onClick={() => setFilters(f => ({ ...f, moat: v }))}>
              <span className="scr-key">{v}</span>
              {filters.moat === v && <span style={{ color: "var(--brand)" }}>✓</span>}
            </div>
          ))}

          <div className="scr-label">Min EPS Growth %</div>
          {[0, 10, 20, 30, 50].map(v => (
            <div key={v} className="scr-row" style={{ cursor: "pointer" }}
              onClick={() => setFilters(f => ({ ...f, eg: v }))}>
              <span className="scr-key">{v > 0 ? `≥ ${v}%` : "Any"}</span>
              {filters.eg === v && <span style={{ color: "var(--brand)" }}>✓</span>}
            </div>
          ))}

          <div className="scr-label">Max P/E</div>
          {[9999, 50, 35, 25, 20].map(v => (
            <div key={v} className="scr-row" style={{ cursor: "pointer" }}
              onClick={() => setFilters(f => ({ ...f, pe_max: v }))}>
              <span className="scr-key">{v === 9999 ? "Any" : `≤ ${v}×`}</span>
              {filters.pe_max === v && <span style={{ color: "var(--brand)" }}>✓</span>}
            </div>
          ))}

          <div className="scr-label">Min Dividend Yield %</div>
          {[0, 0.5, 1, 2].map(v => (
            <div key={v} className="scr-row" style={{ cursor: "pointer" }}
              onClick={() => setFilters(f => ({ ...f, yld: v }))}>
              <span className="scr-key">{v === 0 ? "Any" : `≥ ${v}%`}</span>
              {filters.yld === v && <span style={{ color: "var(--brand)" }}>✓</span>}
            </div>
          ))}
        </div>

        {/* Results */}
        <div style={{ overflowY: "auto" }}>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Name</th>
                  <th>Sector</th>
                  <SortTh col="px" label="Price" />
                  <SortTh col="mc" label="Mkt Cap" />
                  <SortTh col="pe" label="P/E" />
                  <SortTh col="eg" label="EPS Gr%" />
                  <th>Moat</th>
                  <SortTh col="roe" label="ROE%" />
                  <SortTh col="yld" label="Yield%" />
                  <SortTh col="alpha" label="α Today" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.s} onClick={() => openStock(s.s)}>
                    <td><span className={`sym ${cls(s.alpha)}`}>{s.s}</span></td>
                    <td style={{ color: "var(--text-hi)" }}>{s.n}</td>
                    <td><span className="pill flat">{s.sec}</span></td>
                    <td className="mono">${s.px}</td>
                    <td className="mono">${fmt(s.mc * 1e9)}</td>
                    <td className="mono">{s.pe}×</td>
                    <td className={cls(s.eg)} style={{ fontFamily: "var(--f-mono)", fontWeight: 600 }}>{s.eg}%</td>
                    <td>
                      <span style={{
                        fontSize: 11, padding: "2px 7px", borderRadius: 99, fontWeight: 600,
                        background: s.moat === "Wide" ? "var(--brand-dim)" : "var(--surface-3)",
                        color: s.moat === "Wide" ? "var(--brand-2)" : "var(--text-dim-solid)",
                      }}>{s.moat}</span>
                    </td>
                    <td className="mono">{s.roe}%</td>
                    <td className="mono">{s.yld > 0 ? `${s.yld}%` : "—"}</td>
                    <td>
                      <span className={cls(s.alpha)} style={{ fontFamily: "var(--f-mono)", fontWeight: 700 }}>
                        {s.alpha > 0 ? "+" : ""}{s.alpha}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
