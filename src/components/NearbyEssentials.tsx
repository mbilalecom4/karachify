import { useCallback, useEffect, useMemo, useState } from 'react';
import { Crosshair, Loader2, Phone, RefreshCw, Search } from 'lucide-react';
import {
  askOverpass,
  fromSnapshot,
  KIND_LABEL,
  LIVE_FAILURE_COPY,
  loadSnapshot,
  osmUrl,
  type LiveResult,
  type NearbyKind,
  type Snapshot,
} from '../lib/nearby';
import { formatDate } from '../lib/format';

/**
 * "Is there a pharmacy near here?" — the question this site can answer without
 * inventing an answer.
 *
 * Nothing is fetched until somebody presses the button, because most pages are
 * read without ever wanting 240 KB of clinics. The press loads the snapshot the
 * site ships — instant, and available offline — and a second button asks
 * OpenStreetMap what is mapped there right now. Whichever of the two produced
 * the rows on screen is named above them with its date.
 */

const RADII = [
  { metres: 1000, label: '1 km' },
  { metres: 3000, label: '3 km' },
  { metres: 8000, label: '8 km' },
];

const ORDER: NearbyKind[] = ['pharmacy', 'hospital', 'clinic', 'atm'];

/** A listing page is not a directory; six of a kind is enough to act on. */
const SHOWN = 6;

type Props = {
  lat: number;
  lng: number;
  /** the place or locality the visitor is looking at, in their words */
  subject: string;
  /** what the coordinates actually are: a recorded pin, an area centre */
  positionLabel: string;
  /** the position is a neighbourhood marker, so distances are soft */
  approximate?: boolean;
  defaultMetres?: number;
};

const kmLabel = (metres: number) => (metres < 1000 ? `${metres} m` : `${metres / 1000} km`);

const distanceLabel = (km: number) => (km < 0.95 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);

export function NearbyEssentials({ lat, lng, subject, positionLabel, approximate = false, defaultMetres = 3000 }: Props) {
  const [metres, setMetres] = useState(defaultMetres);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [snapshotFailed, setSnapshotFailed] = useState(false);
  const [live, setLive] = useState<LiveResult | null>(null);
  const [asking, setAsking] = useState(false);

  /* A new radius makes the old live answer a lie about a different circle. */
  useEffect(() => setLive(null), [metres]);

  const open = useCallback(() => {
    setSnapshotFailed(false);
    loadSnapshot()
      .then(setSnapshot)
      .catch(() => setSnapshotFailed(true));
  }, []);

  const checkLive = useCallback(() => {
    setAsking(true);
    askOverpass(lat, lng, metres).then((res) => {
      setAsking(false);
      setLive(res);
    });
  }, [lat, lng, metres]);

  const snapshotRows = useMemo(() => (snapshot ? fromSnapshot(snapshot, lat, lng, metres) : []), [snapshot, lat, lng, metres]);
  const wider = useMemo(() => (snapshot ? fromSnapshot(snapshot, lat, lng, 8000).length : 0), [snapshot, lat, lng]);

  const liveOk = live?.ok ? live : null;
  const rows = liveOk ? liveOk.places : snapshotRows;
  const usingLive = Boolean(liveOk);

  if (snapshotFailed) {
    return (
      <article className="card nearby-panel p-5">
        <h2 className="section-title mb-1">Around {subject}</h2>
        <p
          role="status"
          className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[12.5px] leading-relaxed text-navy-700"
        >
          The file of OpenStreetMap places did not reach this device, so there is no list to show. That is a missing answer,
          not an empty neighbourhood.
        </p>
        <button type="button" className="btn-outline btn-sm mt-3" onClick={open}>
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </button>
      </article>
    );
  }

  if (!snapshot) {
    return (
      <article className="card nearby-panel p-5">
        <h2 className="section-title mb-1">Around {subject}</h2>
        <p className="text-[13px] leading-relaxed text-navy-500">
          Karachify can list the pharmacies, hospitals and clinics OpenStreetMap records around {positionLabel}, and then
          ask the map what is there right now. Nothing is looked up until you press this, and nothing is guessed when the
          file has no row.
        </p>
        <button type="button" className="btn-outline btn-sm mt-3" onClick={open}>
          <Search className="h-3.5 w-3.5" /> Show what is around {subject}
        </button>
      </article>
    );
  }

  return (
    <article className="card nearby-panel p-5">
      <h2 className="section-title mb-3">Around {subject}</h2>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12.5px] text-navy-500">Within</span>
        <div className="flex gap-1" role="group" aria-label="Search radius">
          {RADII.map((r) => (
            <button
              key={r.metres}
              type="button"
              onClick={() => setMetres(r.metres)}
              aria-pressed={metres === r.metres}
              className={metres === r.metres ? 'chip chip-active' : 'chip'}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p role="status" className="mt-3 rounded-xl border border-navy-100 bg-navy-50 px-3 py-2 text-[13px] leading-relaxed text-navy-600">
          {usingLive ? (
            <>
              OpenStreetMap maps no pharmacy, hospital, clinic or ATM within {kmLabel(metres)} of {positionLabel}. That is
              what the map holds, and a quiet map can mean an under-mapped street rather than an empty one.
            </>
          ) : (
            <>
              The shipped file has no pharmacy, hospital or clinic within {kmLabel(metres)} of {positionLabel}
              {wider ? ` — it does have ${wider} within 8 km, so try a wider circle` : ', and none within 8 km either'}. That
              is what the file holds, not proof that the streets are empty.
            </>
          )}
        </p>
      ) : (
        <div className="mt-3 space-y-4">
          {ORDER.filter((kind) => rows.some((r) => r.kind === kind)).map((kind) => {
            const some = rows.filter((r) => r.kind === kind);
            return (
              <div key={kind}>
                <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-teal-700">
                  {KIND_LABEL[kind]} <span className="text-navy-400">· {some.length}</span>
                </h3>
                <ul className="mt-1.5 divide-y divide-navy-100">
                  {some.slice(0, SHOWN).map((r, i) => (
                    <li key={`${r.osm ?? r.name}-${i}`} className="flex items-baseline gap-2 py-1.5">
                      <Crosshair className="h-3 w-3 shrink-0 translate-y-0.5 text-teal-600" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold text-navy-800">{r.name}</span>
                        <span className="block text-[12px] text-navy-500">
                          {distanceLabel(r.km)} away{r.phone ? ` · ${r.phone}` : ''}
                        </span>
                      </span>
                      {r.phone && (
                        <a className="btn-outline btn-sm shrink-0" href={`tel:${r.phone.replace(/[^\d+]/g, '')}`} aria-label={`Call ${r.name}`}>
                          <Phone className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {r.osm && (
                        <a
                          className="shrink-0 text-[12px] font-semibold text-teal-700 hover:text-teal-900"
                          href={osmUrl(r.osm)}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Open ${r.name} on OpenStreetMap`}
                        >
                          OSM
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
                {some.length > SHOWN && (
                  <p className="mt-1 text-[12px] text-navy-400">
                    {some.length - SHOWN} more of these are within {kmLabel(metres)} and are not shown.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!usingLive && snapshot.notCovered.includes('atm') && (
        <p className="mt-3 text-[12.5px] leading-relaxed text-navy-500">
          ATMs are not in the file Karachify ships, so this list neither claims one nor rules them out. The live check below
          does look for them.
        </p>
      )}

      <p className="mt-3 text-[12px] leading-relaxed text-navy-400">
        {liveOk ? (
          <>
            Read live from <span className="font-semibold text-navy-600">{liveOk.server}</span> at{' '}
            {new Date(liveOk.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} ·
            the map data is © OpenStreetMap contributors (ODbL), and a marker on a map is not an opening-times board.
          </>
        ) : (
          <>
            From the OpenStreetMap file Karachify ships, read{' '}
            <span className="font-semibold text-navy-600">{formatDate(snapshot.retrievedAt)}</span> · © OpenStreetMap
            contributors (ODbL). A place can have closed since, and the distance is measured to its mapped position rather
            than to its door.
          </>
        )}
      </p>

      {approximate && (
        <p className="mt-1.5 text-[12px] leading-relaxed text-navy-400">
          {positionLabel.charAt(0).toUpperCase() + positionLabel.slice(1)} is not a surveyed pin for each of these places, so
          read the distances as the neighbourhood rather than a step count.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className="btn-outline btn-sm" onClick={checkLive} disabled={asking}>
          {asking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {asking ? 'Asking OpenStreetMap…' : usingLive ? 'Ask OpenStreetMap again' : 'Check OpenStreetMap for right now'}
        </button>
        {usingLive && (
          <button type="button" className="btn-outline btn-sm" onClick={() => setLive(null)}>
            Back to the shipped file
          </button>
        )}
      </div>

      {live && !live.ok && (
        <p role="status" className="mt-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[12.5px] leading-relaxed text-navy-700">
          {LIVE_FAILURE_COPY[live.reason]} The list above is still the shipped file, dated as stated.
        </p>
      )}
    </article>
  );
}
