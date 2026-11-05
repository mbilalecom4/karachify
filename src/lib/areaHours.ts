import { karachiClock, statusAt, type HoursRow, type HoursStatus } from './hoursRead';

/**
 * The per-area hours file, cut at build time by .tools/build-area-hours.mjs.
 *
 * It is a separate file rather than a walk over the live records because an area
 * page shows the checked pages from the bundle and one category at a time of the
 * map tier — a count taken from "whatever happened to load" would be a number
 * with no denominator. Here every row is a record whose own published hours name
 * a source, and `totals` says how many records the area really holds.
 */

export type HoursRecord = {
  name: string;
  path: string;
  categoryId: string;
  hours: HoursRow[];
  sourceUrl: string;
  statedOn: string | null;
  tier: 'checked' | 'map';
};

export type AreaHoursFile = {
  note: string;
  licence: string;
  retrievedAt: string | null;
  areas: Record<string, HoursRecord[]>;
  totals: Record<string, number>;
  hoursWithoutSource: number;
};

let request: Promise<AreaHoursFile> | null = null;

export function loadAreaHours(): Promise<AreaHoursFile> {
  if (!request) {
    request = fetch(`${import.meta.env.BASE_URL}data/hours-by-area.json`, { headers: { accept: 'application/json' } })
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json() as Promise<AreaHoursFile>;
      })
      .catch((err) => {
        request = null;
        throw err;
      });
  }
  return request;
}

export type AreaHoursSummary = {
  /** Records in this area whose published hours name a source. */
  stated: number;
  open: HoursRecord[];
  shutNow: HoursRecord[];
  closedToday: HoursRecord[];
  unreadable: HoursRecord[];
  clock: ReturnType<typeof karachiClock>;
};

/** Sort every sourced row by what its own words say about this minute. */
export function summariseArea(rows: HoursRecord[], at = new Date()): AreaHoursSummary {
  const clock = karachiClock(at);
  const bucket: Record<HoursStatus, HoursRecord[]> = {
    'open-now': [],
    'closed-for-now': [],
    'closed-today': [],
    unreadable: [],
    'no-hours': [],
  };
  for (const row of rows) bucket[statusAt(row.hours, clock)].push(row);
  const byName = (a: HoursRecord, b: HoursRecord) => a.name.localeCompare(b.name);
  return {
    stated: rows.length,
    open: bucket['open-now'].sort(byName),
    shutNow: bucket['closed-for-now'].sort(byName),
    closedToday: bucket['closed-today'].sort(byName),
    unreadable: [...bucket.unreadable, ...bucket['no-hours']].sort(byName),
    clock,
  };
}
