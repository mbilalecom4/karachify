import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, Clock, RefreshCw } from 'lucide-react';
import { loadAreaHours, summariseArea, type AreaHoursFile, type HoursRecord } from '../lib/areaHours';
import { hoursQuote } from '../lib/hoursRead';
import { formatDate } from '../lib/format';

/**
 * "How many of the places here say they are open right now?"
 *
 * The count is cut from records whose published hours name a source, and nothing
 * else: a checked page must carry a citation that supports its hours, a map row
 * must link to the OpenStreetMap element holding the tag. Words this site cannot
 * parse are counted as unreadable rather than guessed into a bucket, and the
 * records that state no hours at all are printed next to the number so a reader
 * can see how much of the locality the figure actually covers.
 *
 * The file behind it is 150 KB, so the panel waits for a press the way the
 * nearby list does.
 */

/** A listing page is not a directory; eight names is enough to act on. */
const SHOWN = 8;

const GROUPS = [
  { key: 'open', title: 'Open at this minute', blurb: 'their own published hours cover this moment' },
  { key: 'shutNow', title: 'Shut at this minute', blurb: 'their hours name other moments of today' },
  { key: 'closedToday', title: 'No hours for this day', blurb: 'their hours name other days, or state that today is closed' },
  { key: 'unreadable', title: 'Hours Karachify could not read', blurb: 'the words on the record are a shape this site will not guess at' },
] as const;

export function AreaOpenHours({ areaId, areaName }: { areaId: string; areaName: string }) {
  const [file, setFile] = useState<AreaHoursFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [tick, setTick] = useState(() => Date.now());

  const open = useCallback(() => {
    setFailed(false);
    setLoading(true);
    loadAreaHours()
      .then((f) => setFile(f))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  /* The headline names a minute, so it must not keep reading 10:00 while the
     clock moves on: the tick is what makes the buckets a statement about now. */
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const rows = useMemo(() => (file ? (file.areas[areaId] ?? []) : []), [file, areaId]);
  const summary = useMemo(() => (file ? summariseArea(rows, new Date(tick)) : null), [file, rows, tick]);

  if (failed) {
    return (
      <article className="card area-hours p-5">
        <h2 className="section-title mb-1">Opening hours in {areaName}</h2>
        <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[12.5px] leading-relaxed text-navy-700">
          The hours file did not reach this device, so there is no count to give. A missing count is not a closed locality.
        </p>
        <button type="button" className="btn-outline btn-sm mt-3" onClick={open}>
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </button>
      </article>
    );
  }

  if (!file || !summary) {
    return (
      <article className="card area-hours p-5">
        <h2 className="section-title mb-1">Opening hours in {areaName}</h2>
        <p className="text-[13px] leading-relaxed text-navy-500">
          Karachify can count how many records in {areaName} publish hours that name a source, and sort them by what those
          words say about this minute in Karachi. Nothing is fetched until you press this, and a record whose hours nobody
          stated is never counted as open.
        </p>
        <button type="button" className="btn-outline btn-sm mt-3" onClick={open} disabled={loading}>
          <Clock className="h-3.5 w-3.5" /> {loading ? 'Reading the hours file…' : 'Count the records that publish hours'}
        </button>
      </article>
    );
  }

  const lists: Record<(typeof GROUPS)[number]['key'], HoursRecord[]> = {
    open: summary.open,
    shutNow: summary.shutNow,
    closedToday: summary.closedToday,
    unreadable: summary.unreadable,
  };
  const stated = summary.stated;
  /* The denominator comes from the same file as the rows, so the two cannot
     disagree about what the locality holds. */
  const recordCount = file.totals[areaId] ?? stated;
  const unstated = Math.max(recordCount - stated, 0);

  return (
    <article className="card area-hours p-5">
      <h2 className="section-title mb-3">Opening hours in {areaName}</h2>

      <p className="text-[13px] leading-relaxed text-navy-600">
        <b className="font-display text-[17px] text-teal-700">{lists.open.length}</b> of the <b>{stated}</b> records here
        that publish hours name a time covering{' '}
        <b>
          {summary.clock.weekday} {summary.clock.hour}
        </b>{' '}
        — read on Karachi&apos;s own clock (UTC+5), not this device&apos;s.
      </p>

      <ul className="mt-2 divide-y divide-navy-100">
        {GROUPS.map((g) => {
          const some = lists[g.key];
          const shown = expanded[g.key] ? some : some.slice(0, SHOWN);
          return (
            <li key={g.key} className="py-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[13.5px] font-semibold text-navy-800">
                  {g.title} <span className="font-normal text-navy-400">· {some.length}</span>
                </span>
                {some.length > SHOWN && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-[12px] font-semibold text-teal-700 hover:text-teal-900"
                    onClick={() => setExpanded((e) => ({ ...e, [g.key]: !e[g.key] }))}
                    aria-expanded={Boolean(expanded[g.key])}
                  >
                    {expanded[g.key] ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    {expanded[g.key] ? `Hide the other ${some.length - SHOWN}` : `Show all ${some.length}`}
                  </button>
                )}
              </div>
              <p className="text-[12px] text-navy-500">{g.blurb}</p>
              {some.length === 0 ? (
                <p className="mt-1 text-[12.5px] text-navy-400">None here.</p>
              ) : (
                <ul className="mt-1.5 space-y-1.5">
                  {shown.map((r) => (
                    <li key={r.path} className="text-[13px] leading-snug">
                      <Link to={r.path} className="link font-semibold">
                        {r.name}
                      </Link>
                      <span className="block text-[12px] text-navy-500">
                        {hoursQuote(r.hours)} ·{' '}
                        <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" className="link">
                          {new URL(r.sourceUrl).hostname.replace(/^www\./, '')}
                        </a>
                        {r.statedOn ? ` (read ${formatDate(r.statedOn)})` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-[12px] leading-relaxed text-navy-400">
        {unstated.toLocaleString()} of the {recordCount.toLocaleString()} records this locality holds state no opening
        hours at all, so they sit outside every number above
        {file.hoursWithoutSource
          ? `; ${file.hoursWithoutSource} checked ${file.hoursWithoutSource === 1 ? 'page states' : 'pages state'} hours
             with no citation behind them and are excluded too`
          : ''}
        . The hours are the sources&apos; own words, cut from the same read as the rest of the site
        {file.retrievedAt ? ` (map hours dated ${formatDate(file.retrievedAt)})` : ''}. A door can still close early for a
        holiday, a rush or a power cut — nothing here replaces the phone number when the journey matters.
      </p>
    </article>
  );
}
