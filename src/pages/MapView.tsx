import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Info, Navigation, Search, X } from 'lucide-react';
import { selectAreas, selectCategories, selectEvents, selectListings, useDB } from '../lib/store';
import { categoryById } from '../data/taxonomy';
import { KarachifyMap, type MapPoint } from '../components/KarachifyMap';
import { PageHero, Note } from '../components/Page';
import { EmptyState, Select, TextInput } from '../components/ui';
import { pinCaption, plural } from '../lib/format';

const PALETTE = ['#13A89E', '#102A43', '#0EA5E9', '#F59E0B', '#8B5CF6', '#EF4444', '#10B981', '#EC4899'];

export default function MapView() {
  const db = useDB();
  const listings = selectListings(db);
  const events = selectEvents(db);
  const categories = selectCategories(db);
  const areas = selectAreas(db);
  const [params, setParams] = useSearchParams();

  const [pinned, setPinned] = useState<string[]>(() => params.getAll('c'));
  const [areaId, setAreaId] = useState(params.get('area') ?? 'all');
  const [withEvents, setWithEvents] = useState(true);
  const [q, setQ] = useState('');
  const [active, setActive] = useState<string | null>(params.get('focus') ?? null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const focusSlug = params.get('focus');
  useEffect(() => {
    if (!focusSlug) return;
    const l = listings.find((x) => x.slug === focusSlug);
    if (l) setActive(l.id);
  }, [focusSlug, listings]);

  const points = useMemo<MapPoint[]>(() => {
    const term = q.trim().toLowerCase();
    const inCategory = (id: string) => pinned.length === 0 || pinned.includes(id);
    const inArea = (id: string) => areaId === 'all' || id === areaId;
    const matches = (text: string) => (term ? text.toLowerCase().includes(term) : true);

    const l = listings
      .filter((x) => inCategory(x.categoryId) && inArea(x.areaId) && matches(`${x.name} ${x.address} ${x.tags.join(' ')}`))
      .map((x) => ({
        id: x.id,
        title: x.name,
        subtitle: `${categoryById.get(x.categoryId)?.name ?? 'Listing'} · ${pinCaption(x.coordsVerified)}`,
        path: `/place/${x.slug}`,
        lat: x.lat,
        lng: x.lng,
        color: PALETTE[Math.abs(hash(x.categoryId)) % PALETTE.length],
        kind: 'listing',
      }));

    const e = withEvents && (pinned.length === 0 || pinned.includes('events'))
      ? events
          .filter((x) => inArea(x.areaId) && matches(`${x.name} ${x.venue}`))
          .map((x) => ({
            id: x.id,
            title: x.name,
            subtitle: `${x.eventCategory} · ${x.venue} · locality centre, not a doorway`,
            path: `/events/${x.slug}`,
            lat: x.lat,
            lng: x.lng,
            color: '#F59E0B',
            kind: 'event',
          }))
      : [];

    return [...l, ...e];
  }, [listings, events, pinned, areaId, withEvents, q, areas]);

  const grouped = useMemo(() => {
    const map = new Map<string, MapPoint[]>();
    for (const p of points) {
      const key = p.kind === 'event' ? 'events' : (p.subtitle.split(' · ')[0] ?? 'other');
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [points]);

  const toggleCategory = (id: string) =>
    setPinned((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const dirty = pinned.length > 0 || areaId !== 'all' || !withEvents || q !== '';

  return (
    <div>
      <PageHero
        mediaKey="banner-tourist-places"
        label="Karachi map"
        eyebrow="Interactive map"
        title="Explore Karachi on the map"
        sub="Filter by category and locality, click a pin for a preview card, then open the full listing. A pin on a verified record is that place's own OpenStreetMap feature; the rest sit near the middle of their locality."
        trail={[{ label: 'Home', to: '/' }, { label: 'Map' }]}
        height="min-h-[240px] sm:min-h-[260px]"
      />

      <section className="shell py-8">
        <div className="card mb-4 space-y-3 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400" />
              <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a name, address or tag on the map…" aria-label="Search map results" className="pl-10" />
            </div>
            <Select value={areaId} onChange={(e) => setAreaId(e.target.value)} aria-label="Filter map by area" className="lg:w-52">
              <option value="all">All of Karachi</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
            <label className="flex items-center gap-2 whitespace-nowrap text-sm font-semibold text-navy-700">
              <input type="checkbox" className="checkbox" checked={withEvents} onChange={(e) => setWithEvents(e.target.checked)} />
              Include sample events
            </label>
            {dirty && (
              <button
                className="btn-outline btn-sm"
                onClick={() => {
                  setPinned([]);
                  setAreaId('all');
                  setWithEvents(true);
                  setQ('');
                  setParams({});
                }}
              >
                <X className="h-3.5 w-3.5" /> Reset
              </button>
            )}
          </div>

          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {categories.map((c) => {
              const on = pinned.includes(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggleCategory(c.id)}
                  aria-pressed={on}
                  className={`chip whitespace-nowrap ${on ? 'chip-active' : ''}`}
                >
                  {c.name}
                  <span className={on ? 'text-teal-100' : 'text-navy-400'}>{listings.filter((l) => l.categoryId === c.id).length}</span>
                </button>
              );
            })}
          </div>
        </div>

        <p className="mb-3 text-sm text-navy-500" aria-live="polite">
          {plural(points.length, 'place')} shown{dirty ? ' after filtering' : ''} · each pin states how it was positioned
        </p>

        {points.length === 0 ? (
          <EmptyState
            title="No pins for this combination"
            body="Every filter is combined, so an area plus one narrow category can legitimately have nothing in it. Reset the filters to see the whole catalogue."
            action={
              <button
                className="btn-outline"
                onClick={() => {
                  setPinned([]);
                  setAreaId('all');
                  setQ('');
                }}
              >
                Show everything
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="card order-2 min-w-0 overflow-hidden p-1.5 lg:order-1">
              <KarachifyMap points={points} activeId={active} onSelect={(p) => setActive(p.id)} className="h-[420px] w-full sm:h-[560px]" />
            </div>
            <div ref={listRef} className="order-1 min-w-0 lg:order-2">
              <div className="card max-h-[420px] overflow-x-hidden overflow-y-auto p-3 sm:max-h-[560px]">
                {grouped.map(([label, items]) => (
                  <div key={label} className="mb-4 last:mb-0">
                    <p className="mb-2 px-1 text-[12px] font-bold uppercase tracking-wide text-navy-400">
                      {label} · {items.length}
                    </p>
                    <ul className="space-y-2">
                      {items.slice(0, 40).map((p) => (
                        <li key={p.id}>
                          <div
                            className={`rounded-xl border p-3 transition-colors ${
                              active === p.id ? 'border-teal-400 bg-teal-50' : 'border-navy-100 bg-white hover:border-teal-200'
                            }`}
                          >
                            <button onClick={() => setActive(p.id)} className="w-full text-left" aria-pressed={active === p.id}>
                              <span className="flex items-start gap-2">
                                <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
                                <span className="min-w-0">
                                  <span className="block truncate font-semibold text-navy-800">{p.title}</span>
                                  <span className="block truncate text-[13px] text-navy-500">{p.subtitle}</span>
                                </span>
                              </span>
                            </button>
                            <span className="mt-2 flex flex-wrap gap-2">
                              <Link to={p.path} className="btn-outline btn-sm">
                                Open
                              </Link>
                              <a
                                href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=driving`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-ghost btn-sm"
                              >
                                <Navigation className="h-3.5 w-3.5" /> Directions
                              </a>
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="mt-5 flex items-start gap-3">
          <Info className="mt-1 h-4 w-4 shrink-0 text-navy-500" />
          <Note className="flex-1">
            Tiles come from the public OpenStreetMap raster servers through MapLibre, which is fine at this traffic level
            but not for heavy production use — before launch, switch to a self-hosted tile stack or a licensed provider
            (the provider policy explicitly asks commercial sites not to hammer the public servers). A pin on a verified
            record is that place's own OpenStreetMap feature; every other pin is offset from the centre of its locality
            and is not an address.
          </Note>
        </div>
      </section>
    </div>
  );
}

function hash(s: string) {
  let h = 5;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 99991;
  return h;
}
