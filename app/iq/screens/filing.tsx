"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { DataState } from "../utils";
import { apiGet, BackendApiError } from "../backend";

interface FilingDoc {
  cik: string;
  accessionNumber: string;
  companyName: string | null;
  form: string | null;
  filingDate: string | null;
  primaryDocument: string | null;
  html: string;
  truncated: boolean;
  edgarUrl: string;
}

/**
 * One SEC filing, rendered as a page in the app.
 *
 * EDGAR's full-index only gives `edgar/data/{cik}/{accession}.txt` — the
 * complete submission, every document concatenated as raw SGML, which is the
 * wall of plain text a browser shows when that URL is linked directly. The
 * backend resolves the actual filing document out of that submission; this
 * renders it with our own chrome around it.
 *
 * The document goes in a SANDBOXED iframe rather than into the page:
 *
 *  - A prospectus is typeset for white paper and ships its own CSS. Injected
 *    into the app it would both inherit the dark theme (unreadable tables) and
 *    leak its own global rules back out into the shell.
 *  - The sandbox has no `allow-scripts` and no same-origin access, so nothing
 *    in a third-party document can reach the app, the session or the DOM. The
 *    backend also strips active content before it ever gets here.
 *
 * The route is a static one reading query params, not `/filing/[accession]` —
 * next.config sets `output: "export"`, so a dynamic segment would need every
 * accession number known at build time.
 */
export function FilingScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const cik = params.get("cik") ?? "";
  const accession = params.get("accession") ?? "";
  // Passed through from the caller so the header reads correctly while the
  // document is still loading — the backend confirms both once it responds.
  const hintName = params.get("company") ?? "";
  const hintForm = params.get("form") ?? "";

  const [doc, setDoc] = useState<FilingDoc | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    // Nothing to fetch without both params; the render path reports that.
    if (!cik || !accession) return;
    apiGet<FilingDoc>(
      `/live/filing?cik=${encodeURIComponent(cik)}&accession=${encodeURIComponent(accession)}`,
    )
      .then(d => { if (active) setDoc(d); })
      .catch((err: unknown) => {
        if (!active) return;
        const status = err instanceof BackendApiError ? err.status : 0;
        setError(
          status === 404
            ? "This filing has no readable document — open it on EDGAR instead."
            : status === 401 || status === 403
              ? "Session expired — sign in again to read filings."
              : "Could not load this filing from SEC EDGAR.",
        );
      });
    return () => { active = false; };
  }, [cik, accession]);

  // Derived, not state: a missing query param is a property of the URL, so
  // setting it from an effect would only schedule a second render to say so.
  const shown = error ?? (!cik || !accession ? "No filing specified." : null);
  const name = doc?.companyName || hintName || "SEC filing";
  const form = doc?.form || hintForm;
  // Always available, even before the document loads or if it fails.
  const edgarUrl =
    doc?.edgarUrl ??
    `https://www.sec.gov/Archives/edgar/data/${cik.replace(/\D/g, "")}/${accession.replace(/-/g, "")}/${accession}-index.htm`;

  return (
    <>
      <div className="page-head">
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", width: "100%" }}>
          <button className="iq-btn-ghost" onClick={() => router.back()} style={{ flexShrink: 0 }}>
            ← Back
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="page-title" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {name}
            </div>
            <div className="page-sub">
              {form ? <span className="pill amc" style={{ marginRight: 6 }}>{form}</span> : null}
              {doc?.filingDate ? `Filed ${doc.filingDate} · ` : ""}
              CIK {cik.replace(/\D/g, "")} · {accession}
            </div>
          </div>
          <a className="btn" href={edgarUrl} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0 }}>
            View original on EDGAR →
          </a>
        </div>
      </div>

      <div className="card">
        <div className="card-b" style={{ padding: 0 }}>
          {shown ? (
            <div style={{ padding: 16 }}><DataState label={shown} /></div>
          ) : !doc ? (
            <div style={{ padding: 16 }}><DataState loading label="" /></div>
          ) : (
            <>
              {doc.truncated && (
                <div style={{
                  padding: "9px 14px", fontSize: ".72rem", lineHeight: 1.5,
                  background: "var(--warn-dim)", color: "var(--warn)",
                  borderBottom: "1px solid var(--border)",
                }}>
                  This filing is too large to show in full here — the end of the
                  document is cut off. Open the original on EDGAR to read all of it.
                </div>
              )}
              {/* The document keeps its own white page; the app frames it. */}
              <iframe
                title={`${form || "SEC filing"} — ${name}`}
                srcDoc={doc.html}
                sandbox=""
                style={{
                  display: "block", width: "100%", height: "calc(100vh - 210px)",
                  minHeight: 480, border: "none", background: "#fff",
                  borderRadius: "0 0 var(--r) var(--r)",
                }}
              />
            </>
          )}
        </div>
      </div>

      <p style={{ fontSize: ".68rem", color: "var(--text-dim-solid)", padding: "8px 2px 0" }}>
        Filed document as submitted to SEC EDGAR. Exhibits and the other
        documents in this submission are on the EDGAR filing page.
      </p>
    </>
  );
}
