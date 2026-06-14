"use client";

import { useIQActions } from "../shell";
import { watch } from "../data";
import { cls, arr, fmt } from "../utils";

export function WatchlistScreen() {
  const { openStock } = useIQActions();

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Watchlist</div>
          <div className="page-sub">{watch.length} stocks tracked</div>
        </div>
        <div className="actions">
          <button className="chip">+ Add Stock</button>
        </div>
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Name</th>
              <th>Price</th>
              <th>Change</th>
              <th>Target</th>
              <th>Upside</th>
              <th>Thesis Note</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {watch.map(w => {
              const upside = (w.tgt - w.px) / w.px * 100;
              return (
                <tr key={w.s} onClick={() => openStock(w.s)}>
                  <td><span className="sym">{w.s}</span></td>
                  <td style={{ color: "var(--text-hi)" }}>{w.n}</td>
                  <td className="mono" style={{ color: "var(--text-hi)", fontWeight: 600 }}>${fmt(w.px)}</td>
                  <td>
                    <span className={cls(w.c)} style={{ fontWeight: 700, fontFamily: "var(--f-mono)" }}>
                      {arr(w.c)} {Math.abs(w.c).toFixed(2)}%
                    </span>
                  </td>
                  <td className="mono" style={{ color: "var(--text-dim-solid)" }}>${fmt(w.tgt)}</td>
                  <td>
                    <span className={cls(upside)} style={{ fontWeight: 700, fontFamily: "var(--f-mono)" }}>
                      {arr(upside)} {Math.abs(upside).toFixed(1)}%
                    </span>
                  </td>
                  <td style={{ color: "var(--text-dim-solid)", fontSize: 12 }}>{w.note}</td>
                  <td>
                    <button className="chip" style={{ fontSize: 10.5, padding: "2px 8px" }}
                      onClick={e => { e.stopPropagation(); openStock(w.s); }}>
                      Detail
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
