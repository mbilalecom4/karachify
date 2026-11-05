import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarRange, Check, Copy, Crosshair, MapPin, Plus, Printer, Route, RotateCcw, Search, Users, X } from 'lucide-react';
import type { Listing } from '../types';
import { selectAreas, selectCategories, selectListings, useDB } from '../lib/store';
import { aroundTheClock, coordText, copyText, distanceKm, plural } from '../lib/format';
import { FAILURE_COPY, fromArea, labelPoint, searchKarachi, whereAmI } from '../lib/geo';
import { sourceLine, type Start } from '../lib/startPoint';
import { legKey, walkKm, walkLeg, walkMinutes, type LatLng, type WalkResult } from '../lib/walk';
import { Note, PageHero } from '../components/Page';
import { SectionHeading, useToast } from '../components/ui';
import { LazyMap } from '../components/LazyMap';
import { KarachiToday } from '../components/KarachiToday';
import type { MapPoint, MapRoute } from '../components/KarachifyMap';

type Group = 'solo' | 'couple' | 'family' | 'friends';

const GROUPS: { id: Group; label: string; note: string }[] = [
  { id: 'solo', label: 'Solo', note: 'One area a day, fewer stops, room to walk.' },
  { id: 'couple', label: 'Couple', note: 'Two or three stops with time in between.' },
  { id: 'family', label: 'Family', note: 'Shorter hops and a pause in the middle of the day.' },
  { id: 'friends', label: 'Friends', note: 'More stops, the route does the walking.' },
];

const MAX_STOPS = 15;
const KEY = 'karachify.plan.v2';
/** The plan saved before the start point existed. Read once, then written to v2. */
const OLD_KEY = 'karachify.plan.v1';

// Dark enough to read over the base map, distinct enough for five days.
const DAY_COLORS = ['#0A6A63', '#B45309', '#0369A1', '#6D28D9', '#BE123C'];
const dayColor = (i: number) => DAY_COLORS[i % DAY_COLORS.length];

type Saved = { group: Group; days: number; areaIds: string[]; categoryIds: string[]; picked: string[]; start?: Start | null };

function loadSaved(): Saved {
  // v2 holds the start point as well as the picks, so a plan saved by the
  // previous version is read from its own key rather than starting the visitor
  // over on an empty page.
  for (const key of [KEY, OLD_KEY]) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const v = JSON.parse(raw) as Saved;
      if (v && Array.isArray(v.picked)) return v;
    } catch {
      /* a corrupt entry is no better than no entry */
    }
  }
  return { group: 'family', days: 2, areaIds: [], categoryIds: [], picked: [] };
}

/**
 * Nearest-neighbour over the recorded pins.
 *
 * With a start point the run begins at the stop nearest to where the visitor
 * actually is; without one it begins at the stop nearest the centre of the
 * areas they chose, which is the next best thing and is labelled as such on the
 * page. Either way the measure is straight-line distance between two pins, and
 * the page says so rather than implying a route.
 */
function orderStops(picked: Listing[], centres: { lat: number; lng: number }[], start?: Start | null) {
  if (picked.length < 2) return picked;
  const anchors = start ? [start] : centres;
  const first =
    anchors.length === 0
      ? picked[0]
      : picked.reduce((best, p) => {
          const sum = (l: Listing) => anchors.reduce((t, c) => t + distanceKm(l, c), 0);
          return sum(p) < sum(best) ? p : best;
        }, picked[0]);
  const remaining = picked.filter((p) => p.slug !== first.slug);
  const out = [first];
  while (remaining.length) {
    let bestIndex = 0;
    let bestDistance = Infinity;
    remaining.forEach((p, i) => {
      const d = distanceKm(out[out.length - 1], p);
      if (d < bestDistance) {
        bestDistance = d;
        bestIndex = i;
      }
    });
    out.push(remaining.splice(bestIndex, 1)[0]);
  }
  return out;
}

function splitAcrossDays<T>(items: T[], days: number) {
  // Hand the extra stops to the first days: a plan of four places over five days
  // should walk on day one, not open with a free day and leave the last one busy.
  const base = Math.floor(items.length / days);
  const extra = items.length % days;
  let cursor = 0;
  return Array.from({ length: days }, (_, d) => {
    const size = base + (d < extra ? 1 : 0);
    const slice = items.slice(cursor, cursor + size);
    cursor += size;
    return slice;
  });
}

export default function PlanDay() {
  const db = useDB();
  const toast = useToast();
  const listings = selectListings(db);
  const areas = selectAreas(db);
  const categories = selectCategories(db);

  const saved = useMemo(loadSaved, []);
  const [group, setGroup] = useState<Group>(saved?.group ?? 'family');
  const [days, setDays] = useState<number>(saved?.days ?? 2);
  const [areaIds, setAreaIds] = useState<string[]>(saved?.areaIds ?? []);
  const [categoryIds, setCategoryIds] = useState<string[]>(saved?.categoryIds ?? []);
  const [picked, setPicked] = useState<string[]>(saved?.picked ?? []);
  const [plan, setPlan] = useState<Listing[][] | null>(null);
  /** Walking legs of the built plan, filled in as the router answers each one. */
  const [legs, setLegs] = useState<Record<string, WalkResult>>({});

  const [start, setStart] = useState<Start | null>(saved?.start ?? null);
  const [asking, setAsking] = useState<'device' | 'search' | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ group, days, areaIds, categoryIds, picked, start }));
    } catch {
      /* storage full or blocked — the planner still works for this visit */
    }
  }, [group, days, areaIds, categoryIds, picked, start]);

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const pool = useMemo(
    () =>
      listings
        .filter((l) => (areaIds.length === 0 || areaIds.includes(l.areaId)) && (categoryIds.length === 0 || categoryIds.includes(l.categoryId)))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [listings, areaIds, categoryIds]
  );

  const pickedListings = picked
    .map((slug) => listings.find((l) => l.slug === slug))
    .filter((l): l is Listing => Boolean(l));

  const areaName = (id: string) => areas.find((a) => a.id === id)?.name ?? id;
  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? id;

  const planMap = useMemo(() => {
    if (!plan) return null;
    const points: MapPoint[] = [];
    const routes: MapRoute[] = [];
    plan.forEach((stops, d) => {
      const color = dayColor(d);
      stops.forEach((l, i) => {
        points.push({
          id: l.slug,
          title: l.name,
          subtitle: `Day ${d + 1} · stop ${i + 1} · ${areaName(l.areaId)}`,
          path: `/place/${l.slug}`,
          lat: l.lat,
          lng: l.lng,
          color,
          kind: 'listing',
        });
      });
      const line = stops.map((l) => ({ lat: l.lat, lng: l.lng }));
      // Day one leaves from where the visitor said they are, so the line shows the
      // whole day instead of starting in mid-air. The start itself gets no pin: a
      // pin here is a record with a page, and a start point is not one.
      const legs = d === 0 && start ? [{ lat: start.lat, lng: start.lng }, ...line] : line;
      if (legs.length > 1) routes.push({ id: `day-${d + 1}`, color, stops: legs });
    });
    return { points, routes };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, start]);

  const pick = (slug: string) => {
    if (picked.includes(slug)) {
      setPicked(picked.filter((s) => s !== slug));
      return;
    }
    if (picked.length >= MAX_STOPS) {
      toast.push(`A plan holds up to ${MAX_STOPS} stops — remove one first`, 'info');
      return;
    }
    setPicked([...picked, slug]);
  };

  const build = () => {
    if (pickedListings.length < 2) return;
    const centres = areas.filter((a) => areaIds.includes(a.id));
    const ordered = orderStops(pickedListings, centres.length ? centres : areas, start);
    setPlan(splitAcrossDays(ordered, days));
  };

  const reset = () => {
    setPicked([]);
    setPlan(null);
  };

  /**
   * Ask the router for every leg the built plan walks, one at a time. Each
   * answer lands on its own; a plan whose router goes quiet still shows the
   * straight-line figures it had before, labelled as what they are.
   */
  useEffect(() => {
    if (!plan) {
      setLegs({});
      return;
    }
    const pairs: [LatLng, LatLng][] = [];
    plan.forEach((stops, d) => {
      if (d === 0 && start && stops.length) pairs.push([start, stops[0]]);
      for (let i = 1; i < stops.length; i++) pairs.push([stops[i - 1], stops[i]]);
    });
    let live = true;
    pairs.forEach(([a, b]) => {
      walkLeg(a, b).then((res) => {
        if (live) setLegs((table) => ({ ...table, [legKey(a, b)]: res }));
      });
    });
    return () => {
      live = false;
    };
  }, [plan, start]);

  /* ------------------------------ start point ------------------------------ */

  /**
   * Ask the browser for the device position, then ask OpenStreetMap what to
   * call it. The second answer is not required: a point the geocoder does not
   * recognise is still a point, and it is kept under its coordinates rather than
   * a name nobody gave it.
   */
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
    setAsking(null);
    if (named.ok) {
      setStart({ ...point, label: named.label, named: 'nominatim' });
    } else {
      setStart({ ...point });
      setGeoError(
        named.reason === 'offline'
          ? 'Your position came from the device, but OpenStreetMap could not be reached to name it.'
          : 'Your position came from the device. OpenStreetMap has no place name for that exact point, so it stays a coordinate.',
      );
    }
  };

  const useSearch = async () => {
    if (query.trim().length < 2) return;
    setAsking('search');
    setGeoError(null);
    const point = await searchKarachi(query);
    setAsking(null);
    if (point.ok) {
      setStart(point);
      setQuery('');
    } else {
      setGeoError(FAILURE_COPY[point.reason]);
    }
  };

  const useArea = (areaId: string) => {
    const area = areas.find((a) => a.id === areaId);
    if (!area) return;
    setGeoError(null);
    setStart(fromArea(area));
  };

  const clearStart = () => {
    setStart(null);
    setGeoError(null);
  };

  /**
   * Unpicked records closest to the start. Sorted on straight-line distance,
   * which is what a shortlist is for; the figure is labelled as the crow flies
   * wherever it is shown.
   */
  const nearStart = useMemo(() => {
    if (!start) return [];
    return pool
      .filter((l) => !picked.includes(l.slug))
      .map((l) => ({ listing: l, km: distanceKm(start, l) }))
      .sort((a, b) => a.km - b.km)
      .slice(0, 5);
  }, [start, pool, picked]);

  /** The most recent router answer in the plan, or nothing if none arrived. */
  const walkedAt = useMemo(() => {
    const times = Object.values(legs).flatMap((r) => (r.ok ? [r.leg.at] : []));
    return times.length ? new Date(Math.max(...times)) : null;
  }, [legs]);

  const planText = () => {
    if (!plan) return '';
    const head =
      `Karachify suggested plan · ${days} ${days === 1 ? 'day' : 'days'} · ${GROUPS.find((g) => g.id === group)?.label}\n` +
      (start ? `Starting from: ${start.label} (${start.lat.toFixed(5)}, ${start.lng.toFixed(5)}) · ${sourceLine(start)}\n` : '') +
      `Order is by straight-line distance on the map. ${
        walkedAt
          ? `Walking figures come from an OpenStreetMap foot route (OSRM, FOSSGIS), computed ${walkedAt.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.`
          : 'No walking route was returned, so the distances below are straight-line.'
      }\n`;
    const body = plan
      .map((stops, i) => {
        const rows = stops.map((l, j) => {
          const origin: LatLng | null = j > 0 ? stops[j - 1] : i === 0 ? start : null;
          if (!origin) return `  ${j + 1}. ${l.name}, ${areaName(l.areaId)}`;
          const walked = legs[legKey(origin, l)];
          const measure = walked?.ok
            ? `${walkKm(walked.leg.metres)} km, about ${walkMinutes(walked.leg.seconds)} on foot`
            : `${distanceKm(origin, l).toFixed(1)} km straight-line`;
          return `  ${j + 1}. ${l.name}, ${areaName(l.areaId)} (${measure} ${j === 0 ? 'from the start' : 'from the previous stop'})`;
        });
        return `\nDay ${i + 1}\n${rows.length ? rows.join('\n') : '  — free day'}`;
      })
      .join('\n');
    return `${head}${body}\n`;
  };

  return (
    <div>
      <PageHero
        mediaKey="banner-guides"
        label="Planning a day in Karachi"
        eyebrow="Plan your day"
        title="Build a route you can actually walk"
        sub="Tell Karachify where the day starts, who is going and how many days you have. It orders the stops by map distance from your start and splits them across your days — and tells you what it does not know."
        trail={[{ label: 'Home', to: '/' }, { label: 'Plan Your Day' }]}
      />

      <section className="plan-page shell section space-y-8">
        {/* Live, so it does not print: the itinerary has to stand on its own on paper. */}
        <KarachiToday />

        {/* 1 — where the day starts */}
        <div className="card p-5">
          <SectionHeading
            eyebrow="Step 1"
            title="Where does the day start?"
            sub="Nothing is looked up until you press one of these. The point stays in this browser's own storage and is used only to order your stops and to list what is near you."
          />

          {start ? (
            <div className="mt-4 rounded-xl border border-teal-500 bg-teal-50 p-4">
              <div className="flex flex-wrap items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-700 text-white">
                  <Crosshair className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-[220px] flex-1">
                  <span className="block font-semibold text-navy-800">{start.label}</span>
                  <span className="block text-[12.5px] text-navy-500">
                    {coordText(start.lat, start.lng)}
                    {start.accuracy ? ` · the device placed you within about ${start.accuracy} m` : ''}
                  </span>
                  <span className="block text-[12px] text-navy-400">
                    {sourceLine(start)} · taken {new Date(start.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </span>
                <button type="button" className="btn-outline btn-sm sm:ml-auto" onClick={clearStart}>
                  <X className="h-3.5 w-3.5" /> Remove
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <button type="button" className="btn-primary" onClick={useDevice} disabled={asking === 'device'}>
                <Crosshair className="h-4 w-4" /> {asking === 'device' ? 'Waiting for your browser…' : 'Use my location'}
              </button>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[220px] flex-1">
                  <label htmlFor="plan-start-query" className="text-[12px] font-semibold uppercase tracking-[0.12em] text-navy-400">
                    Or name a place
                  </label>
                  <input
                    id="plan-start-query"
                    className="input mt-1 w-full"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        useSearch();
                      }
                    }}
                    placeholder="Tariq Road, DHA Phase 6, Frere Hall…"
                  />
                </div>
                <button type="button" className="btn-outline" onClick={useSearch} disabled={asking === 'search' || query.trim().length < 2}>
                  <Search className="h-4 w-4" /> {asking === 'search' ? 'Searching…' : 'Find it'}
                </button>
              </div>
              <div>
                <label htmlFor="plan-start-area" className="text-[12px] font-semibold uppercase tracking-[0.12em] text-navy-400">
                  Or start from an area
                </label>
                <select
                  id="plan-start-area"
                  className="select mt-1 w-full sm:w-72"
                  value=""
                  onChange={(e) => e.target.value && useArea(e.target.value)}
                >
                  <option value="">Choose an area</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[12px] text-navy-400">An area centre is the middle of that locality on the map, not your street.</p>
              </div>
            </div>
          )}

          {geoError && (
            <p role="status" className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[12.5px] leading-relaxed text-navy-700">
              {geoError}
            </p>
          )}
        </div>

        {start && nearStart.length > 0 && (
          <div className="card p-5">
            <SectionHeading
              eyebrow="Near your start"
              title="Places closest to where you are"
              sub="Measured in a straight line from your start point — not a walking route, and not a ranking. Tap one to add it to the plan."
            />
            <ul className="mt-4 divide-y divide-navy-100 overflow-hidden rounded-xl border border-navy-100">
              {nearStart.map(({ listing, km }) => (
                <li key={listing.slug}>
                  <button
                    type="button"
                    onClick={() => pick(listing.slug)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-navy-50/60"
                  >
                    <span className="w-14 shrink-0 text-[13px] font-bold text-teal-700">{km.toFixed(1)} km</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-semibold text-navy-800">{listing.name}</span>
                      <span className="block truncate text-[12.5px] text-navy-400">
                        {categoryName(listing.categoryId)} · {areaName(listing.areaId)}
                        {!listing.coordsVerified && ' · approximate pin'}
                      </span>
                    </span>
                    {picked.includes(listing.slug) ? (
                      <span className="shrink-0 rounded-full bg-teal-700 px-2 py-0.5 text-[11px] font-semibold text-white">In the plan</span>
                    ) : (
                      <Plus className="h-4 w-4 shrink-0 text-teal-600" aria-hidden />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 2 — who */}
        <div className="card p-5">
          <SectionHeading eyebrow="Step 2" title="Who is going, and for how long?" />
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {GROUPS.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGroup(g.id)}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  group === g.id ? 'border-teal-500 bg-teal-50' : 'border-navy-100 bg-white hover:border-navy-200'
                }`}
                aria-pressed={group === g.id}
              >
                <span className="flex items-center gap-2 font-semibold text-navy-800">
                  <Users className="h-4 w-4 text-teal-600" /> {g.label}
                </span>
                <span className="mt-1 block text-[12.5px] leading-snug text-navy-500">{g.note}</span>
              </button>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold text-navy-600">Days:</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setDays(n)}
                className={`h-9 min-w-9 rounded-full px-3 text-[13px] font-semibold ${
                  days === n ? 'bg-navy-800 text-white' : 'bg-navy-50 text-navy-600 hover:bg-navy-100'
                }`}
                aria-pressed={days === n}
              >
                {n === 5 ? '5+' : n}
              </button>
            ))}
            <span className="text-[12.5px] text-navy-400">A plan is split evenly; a day with no stops stays free.</span>
          </div>
        </div>

        {/* 3 — where and what */}
        <div className="card p-5">
          <SectionHeading eyebrow="Step 3" title="Which areas and what kind of place?" sub="Leave everything unselected to search the whole directory." />
          <div className="mt-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-navy-400">Areas</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {areas.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAreaIds(toggle(areaIds, a.id))}
                  className={`chip ${areaIds.includes(a.id) ? 'bg-teal-700 text-white' : ''}`}
                  aria-pressed={areaIds.includes(a.id)}
                >
                  {a.name}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-5">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-navy-400">Interests</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryIds(toggle(categoryIds, c.id))}
                  className={`chip ${categoryIds.includes(c.id) ? 'bg-teal-700 text-white' : ''}`}
                  aria-pressed={categoryIds.includes(c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 4 — pick places */}
        <div className="card p-5">
          <SectionHeading
            eyebrow="Step 4"
            title={`Choose the places (${picked.length}/${MAX_STOPS})`}
            sub={`${pool.length} records match the filters. A 24-hour badge means the record's own source states round-the-clock hours.`}
          />
          <ul className="mt-4 max-h-[420px] divide-y divide-navy-100 overflow-y-auto rounded-xl border border-navy-100">
            {pool.length === 0 && <li className="px-4 py-6 text-[14px] text-navy-500">No record matches those filters.</li>}
            {pool.map((l) => {
              const chosen = picked.includes(l.slug);
              const clock = aroundTheClock(l.hours);
              return (
                <li key={l.slug}>
                  <button
                    type="button"
                    onClick={() => pick(l.slug)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                      chosen ? 'bg-teal-50' : 'bg-white hover:bg-navy-50/60'
                    }`}
                    aria-pressed={chosen}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                        chosen ? 'border-teal-700 bg-teal-700 text-white' : 'border-navy-300 bg-white text-transparent'
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[14.5px] font-semibold text-navy-800">{l.name}</span>
                      <span className="block truncate text-[12.5px] text-navy-400">
                        {categoryName(l.categoryId)} · {areaName(l.areaId)}
                        {l.coordsVerified ? ' · pin checked' : ' · approximate pin'}
                      </span>
                    </span>
                    {clock && <span className="ml-auto shrink-0 rounded-full bg-navy-800 px-2 py-0.5 text-[11px] font-semibold text-white">24h</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={build} disabled={picked.length < 2}>
              <Route className="h-4 w-4" /> Build the plan
            </button>
            <button type="button" className="btn-outline" onClick={reset} disabled={!picked.length && !plan}>
              <RotateCcw className="h-4 w-4" /> Start over
            </button>
          </div>
          {picked.length === 1 && <p className="mt-2 text-[12.5px] text-navy-400">Pick at least two places to build an order.</p>}
        </div>

        {/* result */}
        {plan && (
          <div className="plan-result space-y-4">
            {/* Only the paper sees this: on screen the hero already says who we are. */}
            <p className="print-only text-[12px] font-semibold uppercase tracking-[0.12em] text-navy-600">
              Karachify · Karachi day plan · printed {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <SectionHeading
              eyebrow="Your plan"
              title={`${days} ${days === 1 ? 'day' : 'days'} · ${pickedListings.length} stops`}
              sub={
                start
                  ? 'The run begins at the stop nearest your start point. Where the router answered, each leg shows the walking distance and time; where it did not, the figure stays labelled straight-line.'
                  : 'Each day is a run of stops ordered by map distance from the centre of the areas you picked. Where the router answered, each leg shows the walking distance and time; where it did not, the figure stays labelled straight-line.'
              }
              action={
                <div className="no-print flex gap-2">
                  <button
                    type="button"
                    className="btn-outline btn-sm"
                    onClick={() =>
                      copyText(planText()).then(
                        () => toast.push('Plan copied as text', 'success'),
                        () => toast.push('Could not copy — select the text by hand', 'error')
                      )
                    }
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy plan
                  </button>
                  <button type="button" className="btn-outline btn-sm" onClick={() => window.print()}>
                    <Printer className="h-3.5 w-3.5" /> Print / PDF
                  </button>
                  <Link to={plan[0]?.[0] ? `/map?focus=${plan[0][0].slug}` : '/map'} className="btn-outline btn-sm">
                    <MapPin className="h-3.5 w-3.5" /> Open the map
                  </Link>
                </div>
              }
            />
            {start && (
              <p className="text-[13px] leading-relaxed text-navy-600">
                Day one leaves from <span className="font-semibold text-navy-800">{start.label}</span> ({coordText(start.lat, start.lng)}) ·{' '}
                {sourceLine(start)}, taken {new Date(start.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.
              </p>
            )}
            <p className="text-[12.5px] leading-relaxed text-navy-500">
              {walkedAt ? (
                <>
                  The walking figures are a foot route over the OpenStreetMap path network, worked out by OSRM on the{' '}
                  <a href="https://routing.openstreetmap.de" target="_blank" rel="noopener noreferrer" className="link font-semibold">
                    FOSSGIS public server
                  </a>{' '}
                  at {walkedAt.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}. They assume a steady walk; they are
                  not a driving time and Karachify does not offer one.
                </>
              ) : (
                <>
                  No walking route came back, so every leg below is the straight-line distance between the two pins. Karachify shows the straight figure rather than
                  a guess when the router cannot be reached or finds no path between those two points.
                </>
              )}
            </p>
            {planMap && planMap.points.length > 0 && (
              <figure className="card overflow-hidden p-1.5">
                <LazyMap points={planMap.points} routes={planMap.routes} className="h-[340px] w-full sm:h-[440px]" compact />
                <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2.5">
                  {plan.map((stops, d) => (
                    <span key={d} className="flex items-center gap-1.5 text-[12.5px] font-semibold text-navy-700">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: dayColor(d) }} />
                      Day {d + 1} · {stops.length ? plural(stops.length, 'stop') : 'free'}
                    </span>
                  ))}
                  <span className="text-[12.5px] text-navy-600">
                    Each colour is one day. The dashed line joins the recorded pins in the suggested order
                    {start ? ', leaving from your start point on day one' : ''} — it shows the sequence, not the street you would walk.
                  </span>
                </figcaption>
              </figure>
            )}
            <div className="grid gap-4 lg:grid-cols-2">
              {plan.map((stops, dayIndex) => (
                <article key={dayIndex} className="card p-5">
                  <header className="flex items-center gap-2 border-b border-navy-100 pb-3">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: dayColor(dayIndex) }} />
                    <CalendarRange className="h-4 w-4 text-teal-600" />
                    <h3 className="font-display text-[17px] font-bold text-navy-800">Day {dayIndex + 1}</h3>
                    <span className="ml-auto text-[12px] font-semibold uppercase tracking-[0.1em] text-navy-400">
                      {stops.length ? `${stops.length} stop${stops.length === 1 ? '' : 's'}` : 'free'}
                    </span>
                  </header>
                  {stops.length === 0 ? (
                    <p className="mt-3 text-[13.5px] leading-relaxed text-navy-500">
                      No stop left for this day — you have more days than places. Keep it free or pick another place.
                    </p>
                  ) : (
                    <ol className="mt-3 space-y-3">
                      {stops.map((l, i) => {
                        const origin: LatLng | null = i > 0 ? stops[i - 1] : dayIndex === 0 ? start ?? null : null;
                        const straight = origin ? distanceKm(origin, l) : null;
                        const walked = origin ? legs[legKey(origin, l)] : undefined;
                        const where = i === 0 ? 'from your start' : 'from the previous stop';
                        return (
                          <li key={l.slug} className="flex gap-3">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy-800 text-[12px] font-bold text-white">
                              {i + 1}
                            </span>
                            <div className="min-w-0">
                              <Link to={`/place/${l.slug}`} className="font-semibold text-navy-800 hover:text-teal-700">
                                {l.name}
                              </Link>
                              <p className="text-[12.5px] text-navy-400">
                                {areaName(l.areaId)}
                                {straight != null &&
                                  (walked?.ok
                                    ? ` · ${walkKm(walked.leg.metres)} km, about ${walkMinutes(walked.leg.seconds)} on foot ${where}`
                                    : ` · ${straight.toFixed(1)} km straight-line ${where}${walked ? ' — no walking route returned' : ' — working out the walk'}`)}
                              </p>
                              {l.address && <p className="mt-0.5 text-[12.5px] text-navy-500">{l.address}</p>}
                              <p className="text-[12px] text-navy-400">
                                {l.hours?.[0] ? `${l.hours[0].day}: ${l.hours[0].open}` : 'No verified hours'}
                                {!l.coordsVerified && ' · pin approximate'}
                              </p>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </article>
              ))}
            </div>

            <Note>
              <strong className="text-navy-700">What this plan is not.</strong> The order is a suggestion from straight-line
              distance {start ? 'from your start point and ' : ''}between the recorded pins; it does not know about traffic, one-way streets, prayers, lunch queues or
              which gate is open. The walking figures are a route over the map as it was drawn — a steady pace, no queues, no shade, and no driving time, which
              Karachify does not estimate. Check each place&apos;s hours and pin label
              before you set out, and treat an <span className="font-semibold">approximate pin</span> as the neighbourhood,
              not the door.
              <Link to="/sources" className="link ml-1 font-semibold">
                See what is verified
              </Link>
            </Note>
            <p className="text-[13px] text-navy-500">
              Want a human to look at the route?{' '}
              <Link to="/our-services" className="link font-semibold">
                Our services
              </Link>{' '}
              records a planning request on this device.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
