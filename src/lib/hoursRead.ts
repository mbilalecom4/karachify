/**
 * Reading a published opening-hours line without inventing a schedule.
 *
 * The words on a Karachify record come from a source page or an OpenStreetMap
 * tag, and they take a handful of shapes: "Monday – Friday" plus "09:00 – 17:00",
 * "Every day" plus "24 hours", "Monday" plus "Closed", and a long tail of
 * one-offs ("sunrise-sunset", "0900:-17:00", "Mo-Th 09:00-17:30; Fr 09:00-13:00").
 * This module understands the first four shapes and nothing else. A line it
 * cannot read is reported as unreadable rather than guessed at, because a guess
 * rendered as "open now" is exactly the fabricated claim this site removed.
 *
 * The clock is Karachi's, not the visitor's: the city runs on UTC+5 with no
 * daylight saving, so a reader in London still sees whether a door is open in
 * Saddar.
 */

export type HoursRow = { day: string; open: string };

/** Sunday-first, matching `getUTCDay()` once the +5 offset is applied. */
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const MINUTES_IN_DAY = 1440;

const DAY_ALIASES: Record<string, number> = {
  su: 0, sun: 0, sunday: 0,
  mo: 1, mon: 1, monday: 1,
  tu: 2, tue: 2, tues: 2, tuesday: 2,
  we: 3, wed: 3, wednesday: 3,
  th: 4, thu: 4, thur: 4, thurs: 4, thursday: 4,
  fr: 5, fri: 5, friday: 5,
  sa: 6, sat: 6, saturday: 6,
};

/** Day indexes covered by a published day label, or null when it says nothing readable. */
export function daysNamed(label: string): number[] | null {
  const text = label.toLowerCase().replace(/[–—]/g, '-').trim();
  if (/^(every day|all days|daily|7 days|all week|monday - sunday|sunday - saturday)$/.test(text)) {
    return [0, 1, 2, 3, 4, 5, 6];
  }
  /* Comma and "and" separate the list; a dash inside one segment is a range.
     Splitting on the dash first would turn "Monday - Friday" into two loose days. */
  const segments = text.split(/,\s*|\s+and\s+|;\s*/).map((s) => s.trim()).filter(Boolean);
  const days: number[] = [];
  for (const segment of segments) {
    const range = /^([a-z]+)\s*-\s*([a-z]+)$/.exec(segment);
    if (range) {
      const from = DAY_ALIASES[range[1]];
      const to = DAY_ALIASES[range[2]];
      if (from === undefined || to === undefined) return null;
      for (let d = from; ; d = (d + 1) % 7) {
        if (!days.includes(d)) days.push(d);
        if (d === to) break;
      }
      continue;
    }
    const single = DAY_ALIASES[segment];
    if (single === undefined) return null;
    if (!days.includes(single)) days.push(single);
  }
  return days.length ? days.sort((a, b) => a - b) : null;
}

/** Some rows name the department instead of the days and say the week inside the hours column. */
function daysFromOpenText(value: string): number[] | null {
  const text = value.toLowerCase();
  return /seven days a week|all seven days|6\s*\/\s*7|7\s*\/\s*7|24\s*\/\s*7|every day|all week/.test(text)
    ? [0, 1, 2, 3, 4, 5, 6]
    : null;
}

/** "09:00 – 17:00", "9am-5pm", "24 hours", "Closed" — the shapes we can stand behind. */
export function timesNamed(value: string): { ranges: [number, number][]; closed: boolean; allDay: boolean } | null {
  const text = value.toLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
  if (/^(closed|shut|not open)\b/.test(text)) return { ranges: [], closed: true, allDay: false };
  if (/^24\s*(\/\s*7\s*(hours?|a day)?)?(hours?|h)?$/.test(text) || /24\s*hours|round[\s-]the[\s-]clock|open\s+all\s+night|all\s+day/.test(text))
    return { ranges: [[0, MINUTES_IN_DAY]], closed: false, allDay: true };

  const parts = text.split(/,(?![^0-9])/).map((p) => p.trim()).filter(Boolean);
  const ranges: [number, number][] = [];
  for (const part of parts) {
    const m = /^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\s*-\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?$/.exec(part);
    if (!m) return null;
    const from = clockMinute(m[1], m[2], m[3]);
    const to = clockMinute(m[4], m[5], m[6]);
    if (from === null || to === null) return null;
    /* A span that ends before it starts runs past midnight: "17:00 - 01:00". */
    ranges.push(to <= from ? [from, to + MINUTES_IN_DAY] : [from, to]);
  }
  return ranges.length ? { ranges, closed: false, allDay: false } : null;
}

function clockMinute(hourText: string, minuteText: string | undefined, meridiem: string | undefined) {
  let hour = Number(hourText);
  const minute = Number(minuteText ?? '0');
  if (!Number.isFinite(hour) || hour > 24 || minute > 59) return null;
  if (meridiem === 'pm' && hour < 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;
  if (meridiem && hour > 12 && hour < 24 && Number(hourText) <= 12) return null;
  return hour * 60 + minute;
}

export type ReadSchedule =
  | { ok: true; days: { ranges: [number, number][]; closed: boolean }[] }
  | { ok: false; reason: 'no-hours' | 'unreadable' };

/** Fold every published row for one place into a seven-day schedule. */
export function readSchedule(rows?: HoursRow[]): ReadSchedule {
  if (!rows?.length) return { ok: false, reason: 'no-hours' };
  const days = Array.from({ length: 7 }, () => ({ ranges: [] as [number, number][], closed: false }));
  let matched = 0;
  for (const row of rows) {
    const hours = timesNamed(row.open ?? '');
    if (!hours) continue;
    const named = daysNamed(row.day ?? '') ?? daysFromOpenText(row.open ?? '');
    if (!named) continue;
    matched += 1;
    for (const d of named) {
      if (hours.closed) days[d].closed = true;
      for (const r of hours.ranges) days[d].ranges.push(r);
    }
  }
  if (!matched) return { ok: false, reason: 'unreadable' };
  for (const d of days) d.ranges.sort((a, b) => a[0] - b[0]);
  return { ok: true, days };
}

/** Karachi wall-clock time: UTC+5, fixed, no daylight saving. */
export function karachiClock(at = new Date()) {
  const shifted = new Date(at.getTime() + 5 * 60 * 60 * 1000);
  const two = (n: number) => String(n).padStart(2, '0');
  return {
    day: shifted.getUTCDay(),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
    hour: `${two(shifted.getUTCHours())}:${two(shifted.getUTCMinutes())}`,
    weekday: DAY_NAMES[shifted.getUTCDay()],
    iso: shifted.toISOString().slice(0, 10),
  };
}

export type HoursStatus = 'open-now' | 'closed-for-now' | 'closed-today' | 'unreadable' | 'no-hours';

/** What the published words say about this moment, or why they cannot say. */
export function statusAt(rows: HoursRow[] | undefined, clock = karachiClock()): HoursStatus {
  const schedule = readSchedule(rows);
  if (!schedule.ok) return schedule.reason;
  const today = schedule.days[clock.day];
  /* Spans are stored in the frame of the day that opens them, so one that runs
     past midnight ends above 1440 — "17:00 – 01:00" is [1020, 1500]. Reading it
     in today's frame would call a place open at 11:00 because yesterday's
     morning shift covered 05:00 to 18:00. */
  const covers = (ranges: [number, number][], minute: number) =>
    ranges.some(([from, to]) => minute >= from && minute < to);

  if (covers(today.ranges, clock.minutes)) return 'open-now';
  if (covers(schedule.days[(clock.day + 6) % 7].ranges, clock.minutes + MINUTES_IN_DAY)) return 'open-now';
  return today.closed || today.ranges.length === 0 ? 'closed-today' : 'closed-for-now';
}

export const STATUS_LABEL: Record<HoursStatus, string> = {
  'open-now': 'Open at this minute',
  'closed-for-now': 'Shut right now',
  'closed-today': 'No hours today',
  unreadable: 'Hours not readable',
  'no-hours': 'No hours stated',
};

/** The line a reader can check the count against: the source's own words. */
export function hoursQuote(rows?: HoursRow[]) {
  return (rows ?? []).map((r) => `${r.day}: ${r.open}`).join(' · ');
}
