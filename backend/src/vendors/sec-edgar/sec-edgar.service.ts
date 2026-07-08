import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { XMLParser } from 'fast-xml-parser';
import { fetchJson } from '../../common/http.util';

const SUBMISSIONS_BASE = 'https://data.sec.gov/submissions';
const ARCHIVES_BASE = 'https://www.sec.gov/Archives/edgar/data';
const MIN_DELAY_MS = 150; // stays under SEC's 10 req/sec fair-access limit

// parseTagValue: false — fast-xml-parser otherwise auto-converts all-digit
// text (e.g. a CUSIP like "023135106") into a JS number, silently dropping
// leading zeros and breaking string methods. Callers do their own Number()
// coercion wherever a field is actually numeric.
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
});
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface SecFiling {
  form: string;
  filingDate: string;
  accessionNumber: string;
  primaryDocument: string;
}

// Only the fields this service reads — the rest of each XML shape is
// unvalidated vendor structure, deliberately left untyped rather than
// guessed at. Callers assert their own row shape downstream (see
// sec-13f.job.ts/sec-form4.job.ts), same as get13FInformationTable/
// getForm4Transactions already return unknown[]/unknown here.
interface Form13FXml {
  informationTable?: { infoTable?: unknown };
}

interface Form4Xml {
  ownershipDocument?: {
    issuer?: {
      issuerCik?: string;
      issuerName?: string;
      issuerTradingSymbol?: string;
    };
    reportingOwner?: {
      reportingOwnerId?: { rptOwnerCik?: string; rptOwnerName?: string };
      reportingOwnerRelationship?: {
        isOfficer?: string | boolean;
        officerTitle?: string;
      };
    };
    nonDerivativeTable?: { nonDerivativeTransaction?: unknown };
  };
}

/**
 * SEC EDGAR requires NO API key, only a descriptive User-Agent per its fair-
 * access policy (confirmed 200 OK during setup). Rate-limited client-side to
 * ~6-7 req/sec to stay safely under SEC's 10 req/sec cap.
 */
@Injectable()
export class SecEdgarService {
  private readonly logger = new Logger(SecEdgarService.name);
  private readonly userAgent: string;
  private lastRequestAt = 0;

  constructor(private readonly config: ConfigService) {
    this.userAgent = this.config.get<string>(
      'SEC_EDGAR_USER_AGENT',
      'FinApp26 (unset-contact@example.com)',
    );
  }

  private async throttledFetch<T>(url: string): Promise<T> {
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < MIN_DELAY_MS) await sleep(MIN_DELAY_MS - elapsed);
    this.lastRequestAt = Date.now();
    return fetchJson<T>(url, { headers: { 'User-Agent': this.userAgent } });
  }

  private async throttledFetchText(url: string): Promise<string> {
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < MIN_DELAY_MS) await sleep(MIN_DELAY_MS - elapsed);
    this.lastRequestAt = Date.now();
    const res = await fetch(url, { headers: { 'User-Agent': this.userAgent } });
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
    return res.text();
  }

  private pad10(cik: string): string {
    return cik.replace(/\D/g, '').padStart(10, '0');
  }

  async getSubmissions(
    cik: string,
  ): Promise<{ name: string; recentFilings: SecFiling[] }> {
    const data = await this.throttledFetch<{
      name: string;
      filings: { recent: Record<string, string[]> };
    }>(`${SUBMISSIONS_BASE}/CIK${this.pad10(cik)}.json`);

    const r = data.filings.recent;
    const recentFilings: SecFiling[] = r.form.map((form, i) => ({
      form,
      filingDate: r.filingDate[i],
      accessionNumber: r.accessionNumber[i],
      primaryDocument: r.primaryDocument[i],
    }));

    return { name: data.name, recentFilings };
  }

  private async getFilingFileNames(
    cik: string,
    accessionNumber: string,
  ): Promise<string[]> {
    const accNoDash = accessionNumber.replace(/-/g, '');
    const idx = await this.throttledFetch<{
      directory: { item: Array<{ name: string }> };
    }>(`${ARCHIVES_BASE}/${this.pad10(cik)}/${accNoDash}/index.json`);
    return idx.directory.item.map((i) => i.name);
  }

  /** Returns the parsed <informationTable> holdings for a 13F-HR filing. */
  async get13FInformationTable(
    cik: string,
    accessionNumber: string,
  ): Promise<unknown[]> {
    const accNoDash = accessionNumber.replace(/-/g, '');
    const files = await this.getFilingFileNames(cik, accessionNumber);
    const infoTableFile = files.find(
      (f) =>
        f.endsWith('.xml') && f !== 'primary_doc.xml' && !f.includes('index'),
    );
    if (!infoTableFile) {
      throw new Error(
        `No information table XML found in filing ${accessionNumber} for CIK ${cik}`,
      );
    }

    const xml = await this.throttledFetchText(
      `${ARCHIVES_BASE}/${this.pad10(cik)}/${accNoDash}/${infoTableFile}`,
    );
    const parsed = xmlParser.parse(xml) as Form13FXml;
    const rows = parsed.informationTable?.infoTable ?? [];
    // Array.isArray narrows to `any[]` regardless of the input's static
    // type — cast back to `unknown[]` rather than let that any[] escape.
    return (Array.isArray(rows) ? rows : [rows]) as unknown[];
  }

  /** Returns parsed non-derivative transactions for a Form 4 filing. */
  async getForm4Transactions(cik: string, accessionNumber: string) {
    const accNoDash = accessionNumber.replace(/-/g, '');
    const files = await this.getFilingFileNames(cik, accessionNumber);
    const form4File = files.find(
      (f) => f.endsWith('.xml') && !f.includes('index'),
    );
    if (!form4File) {
      throw new Error(
        `No Form 4 XML found in filing ${accessionNumber} for CIK ${cik}`,
      );
    }

    const xml = await this.throttledFetchText(
      `${ARCHIVES_BASE}/${this.pad10(cik)}/${accNoDash}/${form4File}`,
    );
    const parsed = xmlParser.parse(xml) as Form4Xml;
    const doc = parsed.ownershipDocument;
    if (!doc) return { issuer: null, owner: null, transactions: [] };

    const rows = doc.nonDerivativeTable?.nonDerivativeTransaction ?? [];
    const transactions = Array.isArray(rows) ? rows : [rows];

    return {
      issuer: {
        cik: doc.issuer?.issuerCik,
        name: doc.issuer?.issuerName,
        ticker: doc.issuer?.issuerTradingSymbol,
      },
      owner: {
        cik: doc.reportingOwner?.reportingOwnerId?.rptOwnerCik,
        name: doc.reportingOwner?.reportingOwnerId?.rptOwnerName,
        isOfficer:
          doc.reportingOwner?.reportingOwnerRelationship?.isOfficer ===
            'true' ||
          doc.reportingOwner?.reportingOwnerRelationship?.isOfficer === true,
        officerTitle:
          doc.reportingOwner?.reportingOwnerRelationship?.officerTitle ?? null,
      },
      transactions,
    };
  }
}
