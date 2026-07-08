import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fetchJson } from '../../common/http.util';

const BASE_URL = 'https://api.stlouisfed.org/fred';

export interface FredObservation {
  date: string;
  value: string; // FRED returns numbers as strings; "." means no value for that period
}

interface FredObservationsResponse {
  observations: FredObservation[];
}

/**
 * FRED (Federal Reserve Economic Data, stlouisfed.org) — free API, needs a
 * free key from https://fredaccount.stlouisfed.org/apikeys. Chosen as the
 * macro-events source because Finnhub's /calendar/economic is confirmed
 * BLOCKED on the current plan (see FinnhubService's docblock).
 *
 * Unlike a calendar API, FRED is a pure time-series API: /series/observations
 * returns published readings for a named series (e.g. CPIAUCSL), nothing
 * else. There is no consensus-estimate field and no reliable forward-looking
 * "next release date" without FRED's separate /releases/dates endpoint,
 * which is keyed by numeric release_id values this integration does not use
 * (they'd need to be verified against the live API, which isn't reachable
 * from this environment) — so macro-events only ever reports what has
 * actually been published, never a forecast.
 */
@Injectable()
export class FredService {
  private readonly logger = new Logger(FredService.name);
  private readonly apiKey: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('FRED_API_KEY', '');
    if (!this.apiKey) {
      this.logger.warn(
        'FRED_API_KEY not set — macro-events job will fail. Get a free key at https://fredaccount.stlouisfed.org/apikeys',
      );
    }
  }

  /** Most recent `limit` observations for a series, newest first. */
  async getLatestObservations(
    seriesId: string,
    limit = 2,
  ): Promise<FredObservation[]> {
    const res = await fetchJson<FredObservationsResponse>(
      `${BASE_URL}/series/observations?series_id=${seriesId}&api_key=${this.apiKey}&file_type=json&sort_order=desc&limit=${limit}`,
    );
    return res.observations ?? [];
  }
}
