"use client";

import { useIQActions } from "../shell";
import { cls, sign } from "../utils";

const RECENT_IPOS = [
  { s: "RDDT", n: "Reddit",        date: "Mar 21 '24", offer: 34,   cur: 52.40, day1: 48,  sec: "Internet"  },
  { s: "ALAB", n: "Astera Labs",   date: "Mar 20 '24", offer: 36,   cur: 71.20, day1: 72,  sec: "Semis"     },
  { s: "ARM",  n: "Arm Holdings",  date: "Sep 14 '23", offer: 51,   cur: 118.30, day1: 25, sec: "Semis"     },
  { s: "CART", n: "Instacart",     date: "Sep 19 '23", offer: 30,   cur: 38.60, day1: 12,  sec: "Internet"  },
  { s: "RBRK", n: "Rubrik",        date: "Apr 25 '24", offer: 32,   cur: 38.90, day1: 16,  sec: "Software"  },
  { s: "BIRK", n: "Birkenstock",   date: "Oct 11 '23", offer: 46,   cur: 52.80, day1: -12, sec: "Consumer"  },
  { s: "KVYO", n: "Klaviyo",       date: "Sep 20 '23", offer: 30,   cur: 26.10, day1: 9,   sec: "Software"  },
  { s: "CAVA", n: "CAVA Group",    date: "Jun 15 '23", offer: 22,   cur: 84.40, day1: 99,  sec: "Consumer"  },
];

const PIPELINE = [
  { s: "CHYM", n: "Chime",         expected: "Q3 '25 (expected)",  sec: "Fintech"   },
  { s: "TTAN", n: "ServiceTitan",  expected: "Filed S-1",          sec: "Software"  },
  { s: "SKMS", n: "Skims",         expected: "Rumored 2025",       sec: "Consumer"  },
  { s: "DBRX", n: "Databricks",    expected: "2025 (expected)",    sec: "Data / AI" },
];

export function IPOsScreen() {
  const { openStockFull } = useIQActions();

  const winners = RECENT_IPOS.filter(r => r.cur > r.offer).length;
  const returns = RECENT_IPOS.map(r => (r.cur - r.offer) / r.offer * 100).sort((a, b) => a - b);
  const median = returns[Math.floor(returns.length / 2)];
  const best = RECENT_IPOS.reduce((a, b) => (b.cur - b.offer) / b.offer > (a.cur - a.offer) / a.offer ? b : a);
  const bestRet = ((best.cur - best.offer) / best.offer * 100).toFixed(0);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">New Issues</div>
          <div className="page-title">IPOs &amp; Recent Performance</div>
          <div className="page-sub">
            {RECENT_IPOS.length} recent IPOs tracked · {winners} trading above offer · returns measured from offer price
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="dash" style={{ marginBottom: 14 }}>
        <div className="col-4">
          <div className="card">
            <div className="card-b" style={{ textAlign: "center", padding: "18px" }}>
              <div style={{ fontSize: ".7rem", color: "var(--text-dim-solid)" }}>Trading above offer</div>
              <div className="mono up" style={{ fontSize: "1.6rem", fontWeight: 700 }}>
                {winners}/{RECENT_IPOS.length}
              </div>
            </div>
          </div>
        </div>
        <div className="col-4">
          <div className="card">
            <div className="card-b" style={{ textAlign: "center", padding: "18px" }}>
              <div style={{ fontSize: ".7rem", color: "var(--text-dim-solid)" }}>Best performer</div>
              <div className="mono up" style={{ fontSize: "1.6rem", fontWeight: 700 }}>
                {best.s} +{bestRet}%
              </div>
            </div>
          </div>
        </div>
        <div className="col-4">
          <div className="card">
            <div className="card-b" style={{ textAlign: "center", padding: "18px" }}>
              <div style={{ fontSize: ".7rem", color: "var(--text-dim-solid)" }}>Median since IPO</div>
              <div className={`mono ${cls(median)}`} style={{ fontSize: "1.6rem", fontWeight: 700 }}>
                {sign(median)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-h">
          <h3>Recent IPO performance</h3>
          <span style={{ fontSize: ".72rem", color: "var(--text-dim-solid)" }}>click any name to open its stock page</span>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Company</th>
                <th>Sector</th>
                <th>IPO date</th>
                <th className="num">Offer</th>
                <th className="num">Current</th>
                <th className="num">Day 1</th>
                <th className="num">Since IPO</th>
              </tr>
            </thead>
            <tbody>
              {RECENT_IPOS.map(r => {
                const ret = (r.cur - r.offer) / r.offer * 100;
                return (
                  <tr key={r.s} onClick={() => openStockFull(r.s)} style={{ cursor: "pointer" }}>
                    <td>
                      <div className="co">
                        <span className="s">{r.s}</span>
                        <span className="n">{r.n}</span>
                      </div>
                    </td>
                    <td>{r.sec}</td>
                    <td>{r.date}</td>
                    <td className="num">${r.offer.toFixed(2)}</td>
                    <td className="num">${r.cur.toFixed(2)}</td>
                    <td className={`num ${cls(r.day1)}`}>{sign(r.day1)}</td>
                    <td className={`num ${cls(ret)}`}>
                      <b>{sign(ret)}</b>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <h3>Upcoming pipeline</h3>
          <span style={{ fontSize: ".72rem", color: "var(--text-dim-solid)" }}>expected new issues</span>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Company</th>
                <th>Symbol</th>
                <th>Expected</th>
                <th>Sector</th>
              </tr>
            </thead>
            <tbody>
              {PIPELINE.map(p => (
                <tr key={p.s}>
                  <td><b style={{ color: "var(--text-hi)" }}>{p.n}</b></td>
                  <td style={{ fontFamily: "var(--f-mono)", fontWeight: 700, color: "var(--text-hi)" }}>{p.s}</td>
                  <td>{p.expected}</td>
                  <td>{p.sec}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p style={{ fontSize: ".72rem", color: "var(--text-dim-solid)", marginTop: 10 }}>
        Returns measured from IPO offer price. Source (production): SEC EDGAR + Polygon.io. Informational only — not investment advice.
      </p>
    </>
  );
}
