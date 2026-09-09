import { Suspense } from "react";
import { IQShell } from "../iq/shell";
import { FilingScreen } from "../iq/screens/filing";

/**
 * `/filing?cik=..&accession=..` — one SEC filing rendered in the app.
 *
 * A static route with query params rather than `/filing/[accession]`:
 * next.config sets `output: "export"`, so a dynamic segment would have to
 * enumerate every accession number at build time, which is impossible for
 * filings that appear after the build.
 *
 * The Suspense boundary is required — FilingScreen reads useSearchParams, and
 * a static export prerenders this shell before the query string exists.
 */
export default function FilingPage() {
  return (
    <IQShell>
      <Suspense fallback={null}>
        <FilingScreen />
      </Suspense>
    </IQShell>
  );
}
