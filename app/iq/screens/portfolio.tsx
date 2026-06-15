"use client";

import { useIQActions } from "../shell";
import { folio } from "../data";
import { cls, arr, sign } from "../utils";

const ALERTS = [
  { title: "Earnings posted",       subs: "NVDA, AAPL" },
  { title: "Move > 5% post-ER",     subs: "All holdings" },
  { title: "Analyst up/downgrade",  subs: "All holdings" },
  { title: "Unusual options",       subs: "NVDA, TSLA" },
  { title: "13F change",            subs: "Tracked funds" },
];

const PULSE = [
  "NVDA is your standout, up +8.2% after a beat-and-raise. It's now your largest position by weight — consider whether you want to trim into strength.",
  "AAPL reports after close. Options imply a ±4.8% move. You hold a large position with high conviction — set a post-earnings alert.",
  "TSLA caught a UBS upgrade (Sell → Neutral). The stock is your only red year-to-date holding at -8.1%.",
  "HD lowered guidance — down -1.1%. Low conviction, small size; not a portfolio risk today.",
];

function convPill(conv: string) {
  const c = conv === "High" ? "up" : conv === "Low" ? "dn" : "amc";
  return <span className={`pill ${c}`}>{conv}</span>;
}

export function PortfolioScreen() {
  const { openStock } = useIQActions();

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">My Portfolio</div>
          <div className="page-title">Portfolio Pulse</div>
          <div className="page-sub">
            {folio.length} holdings · $128,430 ·{" "}
            <span className="up">+1.42% today (+$1,798)</span>
          </div>
        </div>
        <button className="btn primary">
          <svg viewBox="0 0 24 24" fill="none" style={{ width: 14, height: 14 }}>
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Add holding
        </button>
      </div>

      <div className="dash" style={{ padding: "0 18px 18px" }}>
        {/* col-8: WMN + holdings */}
        <div className="col-8" style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* AI Portfolio Pulse block */}
          <div className="wmn">
            <div className="wmn-h">
              <div className="t">
                <div className="wmn-orb">
                  <svg viewBox="0 0 24 24" fill="none" style={{ width: 16, height: 16 }}>
                    <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9z" fill="currentColor" />
                  </svg>
                </div>
                <div>
                  <h2>Portfolio Pulse · Today</h2>
                  <div className="meta">
                    <span className="live"><span className="dot" />Live</span>
                    · generated 10:24 ET
                  </div>
                </div>
              </div>
            </div>
            <ul className="wmn-body" style={{ columns: 1 }}>
              {PULSE.map((p, i) => (
                <li key={i}>
                  <span className="bullet" />
                  <span dangerouslySetInnerHTML={{ __html: p
                    .replace(/\+8\.2%/, '<b class="up">+8.2%</b>')
                    .replace(/-8\.1%/, '<b class="down">-8.1%</b>')
                    .replace(/-1\.1%/, '<b class="down">-1.1%</b>')
                    .replace(/(NVDA|AAPL|TSLA|HD)/, '<b>$1</b>')
                  }} />
                </li>
              ))}
            </ul>
            <div className="wmn-foot">
              <span style={{ color: "var(--ai)" }}>
                4 of {folio.length} holdings had a material event today · AI-generated, not investment advice
              </span>
            </div>
          </div>

          {/* Holdings table */}
          <div className="card">
            <div className="card-h">
              <h3>Holdings</h3>
              <span className="link">Manage alerts →</span>
            </div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Stock</th>
                    <th className="num">Price</th>
                    <th className="num">Day</th>
                    <th className="num">G/L</th>
                    <th>Size</th>
                    <th>Conviction</th>
                    <th>Today's event</th>
                  </tr>
                </thead>
                <tbody>
                  {folio.map(f => (
                    <tr key={f.s} style={{ cursor: "pointer" }} onClick={() => openStock(f.s)}>
                      <td>
                        <div className="co">
                          <span className="s">{f.s}</span>
                          <span className="n">{f.n}</span>
                        </div>
                      </td>
                      <td className="num">${f.p.toFixed(2)}</td>
                      <td className={`num ${cls(f.c)}`}>{sign(f.c)}</td>
                      <td className={`num ${cls(f.gl)}`}>{sign(f.gl)}</td>
                      <td><span className="pill hold">{f.size}</span></td>
                      <td>{convPill(f.conv)}</td>
                      <td style={{
                        color: f.evt === "—" ? "var(--text-dim-solid)" : "var(--text)",
                        fontSize: ".8rem",
                      }}>{f.evt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* col-4: Active alerts */}
        <div className="col-4">
          <div className="card">
            <div className="card-h">
              <h3>Active alerts</h3>
              <span className="link">Edit →</span>
            </div>
            <div className="card-b">
              {ALERTS.map(a => (
                <div key={a.title} className="minirow">
                  <span className="mid">
                    <b style={{ color: "var(--text-hi)" }}>{a.title}</b>
                    <div style={{ fontSize: ".7rem", color: "var(--text-dim-solid)" }}>{a.subs}</div>
                  </span>
                  <span className="r"><span className="pill up">On</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
