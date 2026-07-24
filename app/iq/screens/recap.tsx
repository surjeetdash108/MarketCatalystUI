"use client";

import { useRouter } from "next/navigation";
import { useIQActions } from "../shell";
import { cls, arr, sign, StockLogo, heatCol, DataState, isEmptyState } from "../utils";
import { useCollection } from "../hooks/useCollection";

// ── Live EOD recap (R28) — `recaps/{date}`, written by the Recaps EOD data job ──
// It composes indices / movers / sectors / breadth (all Polygon-derived) into one
// frozen snapshot. The prose lead + AI news briefing (R36) are not yet live, so
// this screen shows only the real market data — no fabricated narrative.
type RecapMover = { ticker: string; name?: string; pctChange: number | null; sector?: string | null };
type RecapIndex = { id: string; label?: string; pctChange: number | null };
type RecapInternals = {
  advancers?: number | null; decliners?: number | null; netAdvancers?: number | null;
  breadthPct?: number | null; trin?: number | null; upVolume?: number | null; downVolume?: number | null;
} | null;
interface RecapDoc {
  id: string;
  date?: string;
  indices?: RecapIndex[];
  topGainers?: RecapMover[];
  topLosers?: RecapMover[];
  internals?: RecapInternals;
}
interface SectorDoc { id: string; sector: string; pctChange: number; }

function fmtNum(n: number | null | undefined): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US");
}

function heatColor(v: number): string {
  const a = Math.min(Math.abs(v) / 2.2, 1);
  if (v >= 0) return `rgba(47,230,166,${(0.15 + a * 0.6).toFixed(2)})`;
  return `rgba(255,84,112,${(0.15 + a * 0.6).toFixed(2)})`;
}

// ---- Main screen ----
export function RecapScreen() {
  const router = useRouter();
  const { openStock, openSector } = useIQActions();

  const { data: recapDocs, loading, error } = useCollection<RecapDoc>("recaps");
  const { data: sectors } = useCollection<SectorDoc>("sectors");
  const liveRecap = [...recapDocs].sort((a, b) => (b.id ?? "").localeCompare(a.id ?? ""))[0];

  if (!liveRecap) {
    return (
      <div style={{ padding: 18 }}>
        <DataState
          loading={loading}
          error={error}
          empty={isEmptyState(loading, error, recapDocs.length)}
          label="end-of-day recap"
          emptyMsg="No end-of-day recap has synced yet."
          subMsg="The recap is composed automatically after each market close."
        />
      </div>
    );
  }

  const recapDate = liveRecap.date ?? liveRecap.id;

  const heroIndices = (liveRecap.indices ?? [])
    .filter((i) => typeof i.pctChange === "number")
    .map((i) => ({ label: i.label ?? i.id, value: i.pctChange as number }));

  const moverRows = [...(liveRecap.topGainers ?? []), ...(liveRecap.topLosers ?? [])]
    .filter((m) => typeof m.pctChange === "number")
    .map((m) => ({ ticker: m.ticker, reason: m.sector ?? m.name ?? "", pctChange: m.pctChange as number }))
    .sort((a, b) => b.pctChange - a.pctChange);

  const iv = liveRecap.internals ?? null;
  const internalRows = iv ? [
    { label: "Advancers", value: fmtNum(iv.advancers), direction: 1 },
    { label: "Decliners", value: fmtNum(iv.decliners), direction: -1 },
    { label: "Net advancers", value: fmtNum(iv.netAdvancers), direction: (iv.netAdvancers ?? 0) >= 0 ? 1 : -1 },
    { label: "Breadth", value: typeof iv.breadthPct === "number" ? `${(iv.breadthPct * 100).toFixed(0)}%` : "—", direction: (iv.breadthPct ?? 0.5) >= 0.5 ? 1 : -1 },
    { label: "TRIN (Arms)", value: typeof iv.trin === "number" ? iv.trin.toFixed(2) : "—", direction: (iv.trin ?? 1) <= 1 ? 1 : -1 },
    { label: "Up/Down volume", value: typeof iv.upVolume === "number" && typeof iv.downVolume === "number" && iv.downVolume > 0 ? (iv.upVolume / iv.downVolume).toFixed(2) : "—", direction: (iv.upVolume ?? 0) >= (iv.downVolume ?? 0) ? 1 : -1 },
  ] : [];

  const sectorRows = [...sectors].sort((a, b) => b.pctChange - a.pctChange);

  return (
    <>
      {/* ── Page head ── */}
      <div className="page-head">
        <div>
          <h1 className="page-title">End-of-Day Recap</h1>
        </div>
        <span style={{ fontSize: ".78rem", color: "var(--text-dim-solid)" }}>{recapDate}</span>
      </div>

      <div style={{ padding: "14px 18px 18px" }}>
        {/* Hero index tiles — real EOD % moves */}
        {heroIndices.length > 0 && (
          <div className="recap-hero">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {heroIndices.map(idx => {
                const { bg, fg } = heatCol(idx.value);
                return (
                  <div key={idx.label} style={{ background: bg, borderRadius: 10, padding: "8px 14px", minWidth: 90 }}>
                    <div style={{ fontSize: ".68rem", color: fg, opacity: 0.8, marginBottom: 3 }}>{idx.label}</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 700, fontFamily: "var(--f-mono)", color: fg }}>
                      {arr(idx.value)}{sign(idx.value)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Biggest movers + market internals */}
        <div className="dash" style={{ marginTop: 14, padding: "0 0 14px" }}>
          <div className="col-6">
            <div className="card">
              <div className="card-h">
                <h3>Biggest movers</h3>
                <button className="link" onClick={() => router.push("/menu/movers")}>View all →</button>
              </div>
              <div className="card-b" style={{ paddingTop: 6 }}>
                {moverRows.length === 0 ? (
                  <div style={{ fontSize: ".78rem", color: "var(--text-dim-solid)", padding: "8px 0" }}>No movers in this recap.</div>
                ) : moverRows.map(m => (
                  <div key={m.ticker} className="minirow" style={{ cursor: "pointer" }} onClick={() => openStock(m.ticker)}>
                    <StockLogo sym={m.ticker} size={20} />
                    <span className="tkr">{m.ticker}</span>
                    <span className="mid">{m.reason}</span>
                    <span className={`r ${cls(m.pctChange)}`}>{sign(m.pctChange)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="col-6">
            <div className="card">
              <div className="card-h">
                <h3>Market internals</h3>
                <button className="link" onClick={() => router.push("/menu/movers")}>View all →</button>
              </div>
              <div className="card-b" style={{ paddingTop: 6 }}>
                {internalRows.length === 0 ? (
                  <div style={{ fontSize: ".78rem", color: "var(--text-dim-solid)", padding: "8px 0" }}>Breadth not available in this recap.</div>
                ) : internalRows.map(r => (
                  <div key={r.label} className="minirow">
                    <span className="mid">{r.label}</span>
                    <span className={`r ${r.direction > 0 ? "up" : r.direction < 0 ? "down" : ""}`}>{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sector heatmap — live `sectors` collection */}
        {sectorRows.length > 0 && (
          <div className="card">
            <div className="card-h">
              <h3>Sector heatmap</h3>
              <span className="link" onClick={() => router.push("/menu/heatmap")}>View all →</span>
            </div>
            <div className="card-b">
              <div className="heat">
                {sectorRows.map(s => (
                  <div key={s.sector} className="s"
                    style={{ background: heatColor(s.pctChange), cursor: "pointer" }}
                    onClick={() => openSector(s.sector)}>
                    <div className="nm">{s.sector}</div>
                    <div className="v">{sign(s.pctChange)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
