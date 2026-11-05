import { useCallback, useEffect, useState } from 'react';
import { Crosshair, Footprints, Loader2, Search, X } from 'lucide-react';
import { FAILURE_COPY, labelPoint, searchKarachi, whereAmI } from '../lib/geo';
import { knownStart, originLine, saveHereStart, type Start } from '../lib/startPoint';
import { walkKm, walkLeg, walkMinutes, type WalkResult } from '../lib/walk';
import { coordText, distanceKm } from '../lib/format';

/**
 * "How far is that on foot?" on a place page.
 *
 * The figure a visitor wants here is the one the planner already gets from an
 * OpenStreetMap router, but a place page has no plan and no start field of its
 * own. So it asks the same way: nothing is looked up until a button is pressed,
 * a point this device already offered is used before the browser is asked again,
 * and a refusal from the router leaves the straight-line figure on screen with
 * its name intact rather than a number nobody returned.
 */

type Props = {
  lat: number;
  lng: number;
  /** the place on the page, in its own words */
  subject: string;
  /** what the destination coordinates actually are */
  positionLabel: string;
  /** the pin is a neighbourhood marker, so the walk is to the area, not the door */
  approximate?: boolean;
};

export function WalkFrom({ lat, lng, subject, positionLabel, approximate = false }: Props) {
  const [origin, setOrigin] = useState<{ start: Start; from: 'here' | 'plan' } | null>(null);
  const [leg, setLeg] = useState<WalkResult | null>(null);
  const [asking, setAsking] = useState<'device' | 'search' | 'walk' | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  /* A point given on this device before is offered again; nothing is re-asked. */
  useEffect(() => setOrigin(knownStart()), []);

  const measure = useCallback((start: Start, from: 'here' | 'plan') => {
    setOrigin({ start, from });
    setGeoError(null);
    setAsking('walk');
    walkLeg({ lat: start.lat, lng: start.lng }, { lat, lng }).then((res) => {
      setAsking(null);
      setLeg(res);
    });
  }, [lat, lng]);

  const useDevice = async () => {
    setAsking('device');
    setGeoError(null);
    const point = await whereAmI();
    if (!point.ok) {
      setAsking(null);
      setGeoError(FAILURE_COPY[point.reason]);
      return;
    }
    const named = await labelPoint(point.lat, point.lng);
    const start: Start = named.ok ? { ...point, label: named.label, named: 'nominatim' } : { ...point };
    saveHereStart(start);
    if (!named.ok) {
      setGeoError(
        named.reason === 'offline'
          ? 'Your position came from the device, but OpenStreetMap could not be reached to name it.'
          : 'Your position came from the device. OpenStreetMap has no place name for that exact point, so it stays a coordinate.',
      );
    }
    measure(start, 'here');
  };

  const useSearch = async () => {
    if (query.trim().length < 2) return;
    setAsking('search');
    setGeoError(null);
    const point = await searchKarachi(query);
    if (!point.ok) {
      setAsking(null);
      setGeoError(FAILURE_COPY[point.reason]);
      return;
    }
    saveHereStart(point);
    setQuery('');
    measure(point, 'here');
  };

  const change = () => {
    setLeg(null);
    setOrigin(null);
    setGeoError(null);
    saveHereStart(null);
  };

  const walked = leg?.ok ? leg : null;
  const straight = origin ? distanceKm(origin.start, { lat, lng }) : null;

  return (
    <article className="card walk-from p-5">
      <h2 className="section-title mb-1">How far is {subject} on foot?</h2>

      {!origin && (
        <>
          <p className="text-[13px] leading-relaxed text-navy-500">
            Karachify can work the walk out from where you are — a route over the OpenStreetMap path network, not a
            guess. Nothing is looked up until you press one of these, and the point stays in this browser.
          </p>
          <div className="mt-3 space-y-3">
            <button type="button" className="btn-primary btn-sm" onClick={useDevice} disabled={asking === 'device'}>
              {asking === 'device' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crosshair className="h-3.5 w-3.5" />}
              {asking === 'device' ? 'Waiting for your browser…' : 'Use my location'}
            </button>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[220px] flex-1">
                <label htmlFor="walk-from-query" className="text-[12px] font-semibold uppercase tracking-[0.12em] text-navy-400">
                  Or name a place to walk from
                </label>
                <input
                  id="walk-from-query"
                  className="input mt-1 w-full"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      useSearch();
                    }
                  }}
                  placeholder="Tariq Road, Frere Hall, DHA Phase 6…"
                />
              </div>
              <button type="button" className="btn-outline btn-sm" onClick={useSearch} disabled={asking === 'search' || query.trim().length < 2}>
                {asking === 'search' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                {asking === 'search' ? 'Searching…' : 'Find it'}
              </button>
            </div>
          </div>
        </>
      )}

      {origin && (
        <div className="mt-2">
          <p className="text-[13px] font-semibold text-navy-800">{origin.start.label}</p>
          <p className="text-[12px] text-navy-500">
            {coordText(origin.start.lat, origin.start.lng)}
            {origin.start.accuracy ? ` · placed within about ${origin.start.accuracy} m` : ''}
          </p>
          <p className="text-[12px] text-navy-400">{originLine(origin)} · taken {new Date(origin.start.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>

          {asking === 'walk' ? (
            <p role="status" className="mt-3 flex items-center gap-2 text-[13px] text-navy-600">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Asking the OpenStreetMap router for a foot route…
            </p>
          ) : leg ? (
            <p className="mt-3 flex items-baseline gap-2 text-[15px] font-bold text-navy-800">
              <Footprints className="h-4 w-4 shrink-0 translate-y-0.5 text-teal-600" aria-hidden="true" />
              {leg.ok ? (
                <span>
                  {walkKm(leg.leg.metres)} km, about {walkMinutes(leg.leg.seconds)} on foot
                </span>
              ) : (
                <span>
                  {straight?.toFixed(1)} km straight-line —{' '}
                  <span className="text-[13px] font-semibold text-navy-500">
                    {leg.reason === 'offline'
                      ? 'the router could not be reached, so no walking figure is shown'
                      : 'the router found no foot path between those two points'}
                  </span>
                </span>
              )}
            </p>
          ) : (
            <button type="button" className="btn-outline btn-sm mt-3" onClick={() => measure(origin.start, origin.from)}>
              <Footprints className="h-3.5 w-3.5" /> Work out the walk
            </button>
          )}

          {walked && (
            <p className="mt-2 text-[12px] leading-relaxed text-navy-400">
              A foot route over the OpenStreetMap path network, worked out by OSRM on the{' '}
              <a href="https://routing.openstreetmap.de" target="_blank" rel="noopener noreferrer" className="link font-semibold">
                FOSSGIS public server
              </a>{' '}
              at {new Date(walked.leg.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}. It assumes a steady
              walk; it is not a driving time, and Karachify does not estimate one.
            </p>
          )}
          {approximate && (
            <p className="mt-1.5 text-[12px] leading-relaxed text-navy-400">
              {positionLabel.charAt(0).toUpperCase() + positionLabel.slice(1)} is not a surveyed pin, so the route ends at the
              neighbourhood rather than the door.
            </p>
          )}
        </div>
      )}

      {geoError && (
        <p role="status" className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[12.5px] leading-relaxed text-navy-700">
          {geoError}
        </p>
      )}

      {origin && (
        <div className="no-print mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn-outline btn-sm" onClick={change}>
            <X className="h-3.5 w-3.5" /> Walk from somewhere else
          </button>
        </div>
      )}
    </article>
  );
}
