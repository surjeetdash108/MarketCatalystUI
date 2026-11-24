/**
 * What an empty cell in the Financials-tab sales table should say.
 *
 * "No data" for every empty cell hid two different situations behind one label.
 * On ANT (listed Nov 2026, seven quarters lifted from its IPO filing, no
 * earnings report as a public company yet) %Chg was empty on the oldest four
 * quarters because there is no year-ago quarter to compare with, and Surp was
 * empty on all of them because no consensus-versus-actual comparison exists
 * until the first report. Neither is missing data: they are "not applicable".
 *
 * "N/A" is for those; "No data" stays for a figure that should exist but is
 * missing. Both carry a hover reason.
 */

export interface SalesCellNote {
  label: string;
  title: string;
}

/**
 * %Chg compares a period with the one `back` rows earlier (4 quarters, 1 year).
 * With no such row it cannot apply; with one, a null result means a sales
 * figure on either side is missing (or the prior one is zero).
 */
export function salesChangeNote({ isQ, hasPriorPeriod }: { isQ: boolean; hasPriorPeriod: boolean }): SalesCellNote {
  if (!hasPriorPeriod) {
    return {
      label: "N/A",
      title: isQ
        ? "No year-ago quarter on file to compare with"
        : "No prior fiscal year on file to compare with",
    };
  }
  return {
    label: "No data",
    title: isQ
      ? "Sales are missing (or zero) for this quarter or the year-ago quarter"
      : "Sales are missing (or zero) for this year or the one before",
  };
}

/** The slice of the financials doc that tells whether any report has been made. */
export interface ReportHistory {
  epsHistory?: Array<{ epsActual: number | null }> | null;
  quarters?: Array<{ epsActualReported?: number | null }> | null;
}

/**
 * True once the company has put out an earnings report: any vendor EPS actual,
 * in the report history or on a quarter. Only used to pick tooltip wording, so
 * it is deliberately simple — if it errs towards true, the cell says "No data"
 * with an accurate reason instead of "N/A".
 */
export function hasPublicEarningsReport(doc: ReportHistory | null | undefined): boolean {
  if (!doc) return false;
  return (
    (doc.epsHistory ?? []).some(h => h.epsActual != null) ||
    (doc.quarters ?? []).some(q => q.epsActualReported != null)
  );
}

/**
 * Surp = reported sales against the consensus that stood when the quarter was
 * reported. Before the first report there is none for any quarter; after it, an
 * empty cell means that quarter's estimate was not recorded.
 */
export function salesSurpriseNote(
  { reportedYet, nextReportLabel }: { reportedYet: boolean; nextReportLabel?: string | null },
): SalesCellNote {
  if (!reportedYet) {
    return {
      label: "N/A",
      title: nextReportLabel
        ? `Not reported yet — the first earnings report as a public company is due ${nextReportLabel}`
        : "Not reported yet — no earnings report as a public company so far",
    };
  }
  return { label: "No data", title: "No analyst revenue estimate was recorded for this quarter" };
}
