"use client";

import { useState, useEffect } from "react";
import { apiGet } from "./backend";
import { StockLogo, fmt, sign, VendorTag, cleanCatalystText } from "./utils";
import type { MoverCatalystDoc, NewsArticleDoc } from "./types";

interface MoverNewsModalProps {
  ticker: string;
  name?: string;
  price?: number | null;
  pctChange?: number | null;
  direction?: string;
  onClose: () => void;
}

export function MoverNewsModal({
  ticker,
  name,
  price,
  pctChange,
  direction,
  onClose,
}: MoverNewsModalProps) {
  const [catalystDoc, setCatalystDoc] = useState<MoverCatalystDoc | null>(null);
  const [newsList, setNewsList] = useState<NewsArticleDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"catalyst" | "news">("catalyst");

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const dirParam = direction ?? (pctChange != null ? (pctChange >= 0 ? "gainer" : "loser") : "");
    const changeParam = pctChange != null ? `&pctChange=${pctChange}` : "";

    const fetchCatalyst = apiGet<MoverCatalystDoc>(
      `/market-data/mover-catalyst/${encodeURIComponent(ticker)}?direction=${dirParam}${changeParam}`,
    ).catch(() => null);

    const fetchNews = apiGet<NewsArticleDoc[]>(
      `/live/news?ticker=${encodeURIComponent(ticker)}`,
    ).catch(() => []);

    Promise.all([fetchCatalyst, fetchNews]).then(([cat, news]) => {
      if (!isMounted) return;
      setCatalystDoc(cat);
      setNewsList(news ?? []);
      setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [ticker, direction, pctChange]);

  const isUp = (pctChange ?? 0) >= 0;

  const vendorBadge = (vendor?: string, source?: string) => {
    const v = vendor?.toLowerCase() ?? "";
    const s = source?.toLowerCase() ?? "";

    if (v === "benzinga" || s === "benzinga_wiim") {
      return (
        <span
          style={{
            background: "rgba(74,222,128,0.14)",
            color: "var(--brand)",
            border: "1px solid rgba(74,222,128,0.4)",
            padding: "3px 9px",
            borderRadius: 6,
            fontSize: ".7rem",
            fontWeight: 700,
            letterSpacing: ".04em",
            textTransform: "uppercase",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          ⚡ Benzinga WIIM
        </span>
      );
    }

    if (s === "ai_synthesis" || v === "llm") {
      return (
        <span
          style={{
            background: "linear-gradient(135deg, rgba(74,222,128,0.2), rgba(74,222,128,0.25))",
            color: "#A7F3C0",
            border: "1px solid rgba(167,243,192,0.4)",
            padding: "3px 9px",
            borderRadius: 6,
            fontSize: ".7rem",
            fontWeight: 700,
            letterSpacing: ".04em",
            textTransform: "uppercase",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          Market<span style={{ color: "var(--brand)" }}>Catalyst</span> Synthesis
        </span>
      );
    }

    return <VendorTag v={(vendor as any) || "polygon"} />;
  };

  return (
    <>
      {/* Dark backdrop scrim */}
      <div className="scrim" onClick={onClose} style={{ zIndex: 100 }} />

      {/* Main Centered Modal */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 101,
          width: "min(680px, 94vw)",
          maxHeight: "88vh",
          background: "var(--surface-1, #0B0D10)",
          border: "1px solid var(--border-soft, rgba(255,255,255,0.12))",
          borderRadius: 16,
          boxShadow: "0 24px 60px -10px rgba(0,0,0,0.75)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily: "var(--f-body, sans-serif)",
          color: "var(--text-hi, #F4F6F5)",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-soft, rgba(255,255,255,0.08))",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--surface-2, rgba(255,255,255,0.02))",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <StockLogo sym={ticker} size={36} />
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontFamily: "var(--f-display, sans-serif)",
                    fontWeight: 700,
                    fontSize: "1.15rem",
                  }}
                >
                  {ticker}
                </span>
                {pctChange != null && (
                  <span
                    style={{
                      background: isUp ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)",
                      color: isUp ? "var(--up, #4ADE80)" : "var(--down, #F87171)",
                      padding: "2px 8px",
                      borderRadius: 6,
                      fontSize: ".8rem",
                      fontWeight: 700,
                      fontFamily: "var(--f-mono, monospace)",
                    }}
                  >
                    {sign(pctChange)}
                  </span>
                )}
              </div>
              {name && (
                <div style={{ fontSize: ".76rem", color: "var(--text-dim-solid, #A6AEB5)", marginTop: 2 }}>
                  {name} {price != null ? `· $${fmt(price)}` : ""}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="closebtn"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-dim-solid, #A6AEB5)",
              fontSize: "1.2rem",
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: 6,
            }}
          >
            ✕
          </button>
        </div>

        {/* Navigation Sub-Tabs */}
        <div
          style={{
            display: "flex",
            gap: 12,
            padding: "10px 20px",
            borderBottom: "1px solid var(--border-soft, rgba(255,255,255,0.06))",
            background: "var(--surface-1, #0B0D10)",
          }}
        >
          <button
            onClick={() => setActiveTab("catalyst")}
            style={{
              background: activeTab === "catalyst" ? "var(--brand, #4ADE80)" : "transparent",
              color: activeTab === "catalyst" ? "#ffffff" : "var(--text-dim-solid, #A6AEB5)",
              border: "none",
              borderRadius: 8,
              padding: "6px 14px",
              fontSize: ".8rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            📰 Why It Moved (Catalyst)
          </button>
          <button
            onClick={() => setActiveTab("news")}
            style={{
              background: activeTab === "news" ? "var(--brand, #4ADE80)" : "transparent",
              color: activeTab === "news" ? "#ffffff" : "var(--text-dim-solid, #A6AEB5)",
              border: "none",
              borderRadius: 8,
              padding: "6px 14px",
              fontSize: ".8rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            All Breaking News ({newsList.length})
          </button>
        </div>

        {/* Modal Body Scroll Area */}
        <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
          {loading ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-dim-solid, #A6AEB5)" }}>
              <div style={{ fontSize: "1.1rem", marginBottom: 8 }}>Fetching latest news & catalyst data…</div>
              <div style={{ fontSize: ".8rem" }}>Checking Benzinga WIIM, Polygon & AI synthesis</div>
            </div>
          ) : activeTab === "catalyst" ? (
            <div>
              {/* Hero Catalyst Explanation Card */}
              <div
                style={{
                  background: "linear-gradient(145deg, var(--surface-2, rgba(255,255,255,0.04)), rgba(74,222,128,0.06))",
                  border: "1px solid var(--brand-dim, rgba(74,222,128,0.3))",
                  borderRadius: 12,
                  padding: 18,
                  marginBottom: 20,
                  position: "relative",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: ".7rem",
                      fontWeight: 700,
                      letterSpacing: ".06em",
                      textTransform: "uppercase",
                      color: "var(--text-dim-solid, #A6AEB5)",
                    }}
                  >
                    Primary Movement Driver
                  </div>
                  {vendorBadge(catalystDoc?.vendor, catalystDoc?.source)}
                </div>

                <div
                  style={{
                    fontSize: "1.05rem",
                    fontWeight: 600,
                    lineHeight: 1.5,
                    color: "var(--text-hi, #F4F6F5)",
                    marginBottom: 12,
                  }}
                >
                  {catalystDoc?.catalyst ? cleanCatalystText(catalystDoc.catalyst) : "No specific catalyst identified for this move yet."}
                </div>

                {catalystDoc?.headline && catalystDoc.headline !== catalystDoc.catalyst && (
                  <div
                    style={{
                      fontSize: ".82rem",
                      color: "var(--text-dim-solid, #A6AEB5)",
                      borderTop: "1px solid rgba(255,255,255,0.06)",
                      paddingTop: 10,
                      marginTop: 10,
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>Headline:</span> {catalystDoc.headline}
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: ".72rem",
                    color: "var(--text-dim-solid, #A6AEB5)",
                    marginTop: 12,
                  }}
                >
                  <span>
                    Updated: {catalystDoc?.updatedAt ? new Date(catalystDoc.updatedAt).toLocaleTimeString() : "Just now"}
                  </span>

                  {catalystDoc?.newsUrl && (
                    <a
                      href={catalystDoc.newsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: "var(--brand, #4ADE80)",
                        textDecoration: "none",
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      Read Source Article ↗
                    </a>
                  )}
                </div>
              </div>

              {/* Top Recent News Snapshot */}
              {newsList.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: ".82rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: ".05em",
                      color: "var(--text-dim-solid, #A6AEB5)",
                      marginBottom: 12,
                    }}
                  >
                    Recent Related Stories
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {newsList.slice(0, 3).map((item) => (
                      <a
                        key={item.id}
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "block",
                          background: "var(--surface-2, rgba(255,255,255,0.02))",
                          border: "1px solid var(--border-soft, rgba(255,255,255,0.06))",
                          borderRadius: 10,
                          padding: "12px 14px",
                          textDecoration: "none",
                          color: "inherit",
                          transition: "background 0.15s ease",
                        }}
                      >
                        <div
                          style={{
                            fontSize: ".88rem",
                            fontWeight: 600,
                            color: "var(--text-hi, #F4F6F5)",
                            marginBottom: 4,
                          }}
                        >
                          {item.headline}
                        </div>
                        {item.summary && (
                          <div
                            style={{
                              fontSize: ".78rem",
                              color: "var(--text-dim-solid, #A6AEB5)",
                              lineHeight: 1.4,
                              marginBottom: 6,
                            }}
                          >
                            {item.summary.slice(0, 160)}…
                          </div>
                        )}
                        <div
                          style={{
                            fontSize: ".7rem",
                            color: "var(--text-dim-solid, #A6AEB5)",
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>{item.source}</span>
                          <span>·</span>
                          <span>{item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : ""}</span>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Full News Articles List Tab */
            <div>
              {newsList.length === 0 ? (
                <div style={{ padding: "30px 0", textAlign: "center", color: "var(--text-dim-solid, #A6AEB5)" }}>
                  No recent news articles found for {ticker}.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {newsList.map((item) => (
                    <a
                      key={item.id}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "block",
                        background: "var(--surface-2, rgba(255,255,255,0.02))",
                        border: "1px solid var(--border-soft, rgba(255,255,255,0.06))",
                        borderRadius: 10,
                        padding: 14,
                        textDecoration: "none",
                        color: "inherit",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: 6,
                        }}
                      >
                        <div style={{ fontSize: ".72rem", color: "var(--brand, #4ADE80)", fontWeight: 600 }}>
                          {item.source}
                        </div>
                        <div style={{ fontSize: ".7rem", color: "var(--text-dim-solid, #A6AEB5)" }}>
                          {item.publishedAt ? new Date(item.publishedAt).toLocaleString() : ""}
                        </div>
                      </div>

                      <div
                        style={{
                          fontSize: ".9rem",
                          fontWeight: 600,
                          color: "var(--text-hi, #F4F6F5)",
                          marginBottom: 6,
                        }}
                      >
                        {item.headline}
                      </div>

                      {item.summary && (
                        <div
                          style={{
                            fontSize: ".8rem",
                            color: "var(--text-dim-solid, #A6AEB5)",
                            lineHeight: 1.45,
                          }}
                        >
                          {item.summary}
                        </div>
                      )}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
