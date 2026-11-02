import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarRange, Check, Copy, MapPin, Route, RotateCcw, Users } from 'lucide-react';
import type { Listing } from '../types';
import { selectAreas, selectCategories, selectListings, useDB } from '../lib/store';
import { aroundTheClock, copyText, distanceKm, plural } from '../lib/format';
import { Note, PageHero } from '../components/Page';
import { SectionHeading, useToast } from '../components/ui';
import { LazyMap } from '../components/LazyMap';
import type { MapPoint, MapRoute } from '../components/KarachifyMap';

type Group = 'solo' | 'couple' | 'family' | 'friends';

const GROUPS: { id: Group; label: string; note: string }[] = [
  { id: 'solo', label: 'Solo', note: 'One area a day, fewer stops, room to walk.' },
  { id: 'couple', label: 'Couple', note: 'Two or three stops with time in between.' },
  { id: 'family', label: 'Family', note: 'Shorter hops and a pause in the middle of the day.' },
  { id: 'friends', label: 'Friends', note: 'More stops, the route does the walking.' },
];

const MAX_STOPS = 15;
const KEY = 'karachify.plan.v1';

// Dark enough to read over the base map, distinct enough for five days.
const DAY_COLORS = ['#0A6A63', '#B45309', '#0369A1', '#6D28D9', '#BE123C'];
const dayColor = (i: number) => DAY_COLORS[i % DAY_COLORS.length];

type Saved = { group: Group; days: number; areaIds: string[]; categoryIds: string[]; picked: string[] } | null;

function loadSaved(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Saved;
    if (!v || !Array.isArray(v.picked)) return null;
    return v;
  } catch {
    return null;
  }
}

/** Nearest-neighbour from the stop closest to the selected areas' centre. */
function orderStops(picked: Listing[], centres: { lat: number; lng: number }[]) {
  if (picked.length < 2) return picked;
  const start =
    centres.length === 0
      ? picked[0]
      : picked.reduce((best, p) => {
          const sum = (l: Listing) => centres.reduce((t, c) => t + distanceKm(l, c), 0);
          return sum(p) < sum(best) ? p : best;
        }, picked[0]);
  const remaining = picked.filter((p) => p.slug !== start.slug);
  const out = [start];
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

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ group, days, areaIds, categoryIds, picked }));
    } catch {
      /* storage full or blocked — the planner still works for this visit */
    }
  }, [group, days, areaIds, categoryIds, picked]);

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
      if (stops.length > 1) routes.push({ id: `day-${d + 1}`, color, stops: stops.map((l) => ({ lat: l.lat, lng: l.lng })) });
    });
    return { points, routes };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

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
    const ordered = orderStops(pickedListings, centres.length ? centres : areas);
    setPlan(splitAcrossDays(ordered, days));
  };

  const reset = () => {
    setPicked([]);
    setPlan(null);
  };

  const planText = () => {
    if (!plan) return '';
    const head = `Karachify suggested plan · ${days} ${days === 1 ? 'day' : 'days'} · ${GROUPS.find((g) => g.id === group)?.label}\nOrder is by straight-line distance on the map, not a driving route.\n`;
    const body = plan
      .map((stops, i) => {
        const rows = stops.map((l, j) => {
          const from = j === 0 ? '' : ` (${distanceKm(stops[j - 1], l).toFixed(1)} km from the previous stop)`;
          return `  ${j + 1}. ${l.name}, ${areaName(l.areaId)}${from}`;
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
        sub="Pick who is going, how many days you have and the places you want. Karachify orders the stops by map distance and splits them across your days — and tells you what it does not know."
        trail={[{ label: 'Home', to: '/' }, { label: 'Plan Your Day' }]}
      />

      <section className="shell section space-y-8">
        {/* 1 — who */}
        <div className="card p-5">
          <SectionHeading eyebrow="Step 1" title="Who is going, and for how long?" />
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

        {/* 2 — where and what */}
        <div className="card p-5">
          <SectionHeading eyebrow="Step 2" title="Which areas and what kind of place?" sub="Leave everything unselected to search the whole directory." />
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

        {/* 3 — pick places */}
        <div className="card p-5">
          <SectionHeading
            eyebrow="Step 3"
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
          <div className="space-y-4">
            <SectionHeading
              eyebrow="Your plan"
              title={`${days} ${days === 1 ? 'day' : 'days'} · ${pickedListings.length} stops`}
              sub="Each day is a run of stops ordered by map distance. The distance printed between stops is straight-line, not a driving route."
              action={
                <div className="flex gap-2">
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
                  <Link to={plan[0]?.[0] ? `/map?focus=${plan[0][0].slug}` : '/map'} className="btn-outline btn-sm">
                    <MapPin className="h-3.5 w-3.5" /> Open the map
                  </Link>
                </div>
              }
            />
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
                    Each colour is one day. The dashed line joins the recorded pins in the suggested order — it is not a driving route.
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
                        const leg = i === 0 ? null : distanceKm(stops[i - 1], l);
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
                                {leg != null && ` · ${leg.toFixed(1)} km from the previous stop`}
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
              distance between the recorded pins; it does not know about traffic, one-way streets, prayers, lunch queues or
              which gate is open. Karachify does not estimate driving time. Check each place&apos;s hours and pin label
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
