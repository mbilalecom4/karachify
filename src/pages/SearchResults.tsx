import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, FolderSearch, MapPin, Sparkles, Tag, X } from 'lucide-react';
import { search, TYPE_LABEL, type ResultType, type SearchDoc } from '../lib/search';
import { selectAreas, selectCategories, selectListings, selectEvents, useDB } from '../lib/store';
import { imageFor, pictureSubject } from '../lib/media';
import { EventCard, ListingCard } from '../components/cards';
import { SearchBox } from '../components/SearchBox';
import { EmptyState, Select, Tabs } from '../components/ui';
import { plural } from '../lib/format';
import { useDocumentTitle } from '../lib/useDocumentTitle';

const TYPES: ResultType[] = ['listing', 'event', 'area', 'category', 'guide'];

export default function SearchResults() {
  useDocumentTitle('Search');
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const db = useDB();
  const q = params.get('q') ?? '';
  const [type, setType] = useState<ResultType | 'all'>('all');
  const [categoryId, setCategoryId] = useState('all');
  const [areaId, setAreaId] = useState('all');

  useEffect(() => {
    setType('all');
  }, [q]);

  const results = useMemo(() => (q.trim() ? search(db, q, { limit: 200 }) : []), [db, q]);
  const scoped = useMemo(
    () =>
      results.filter((d) => {
        if (type !== 'all' && d.type !== type) return false;
        if (categoryId !== 'all' && d.categoryId && d.categoryId !== categoryId) return false;
        if (areaId !== 'all' && d.areaId && d.areaId !== areaId) return false;
        return true;
      }),
    [results, type, categoryId, areaId]
  );

  const grouped = useMemo(() => {
    const map = new Map<ResultType, SearchDoc[]>();
    for (const d of scoped) map.set(d.type, [...(map.get(d.type) ?? []), d]);
    return TYPES.filter((t) => map.has(t)).map((t) => ({ type: t, docs: map.get(t) ?? [] }));
  }, [scoped]);

  const listings = selectListings(db);
  const events = selectEvents(db);
  const categories = selectCategories(db);
  const areas = selectAreas(db);

  return (
    <div>
      <section className="border-b border-navy-100 bg-mist">
        <div className="shell py-10">
          <p className="eyebrow mb-1">Search</p>
          <h1 className="font-display text-[clamp(1.7rem,4vw,2.4rem)] font-extrabold leading-tight tracking-[-0.03em] text-navy-900">
            {q ? `Results for “${q}”` : 'Search Karachify'}
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] text-navy-600">
            Global search runs against every record Karachify holds — {plural(listings.length, 'listing')},{' '}
            {plural(events.length, 'event')}, {plural(areas.length, 'area')}, {plural(categories.length, 'category')} and the city guides.
          </p>
          <div className="mt-5 max-w-3xl">
            <SearchBox variant="page" placeholder="Search places, restaurants, events, hotels and more..." />
          </div>
        </div>
      </section>

      <section className="shell section">
        {!q.trim() ? (
          <EmptyState
            title="Type something to search"
            body="Try “biryani”, “Clifton”, “museum”, “hospital” or “Mazar-e-Quaid”. Search only knows the records in this dataset — it never invents a result to fill an empty page, and each hit opens the place's own sourcing notes."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {['beach', 'nihari', 'DHA', 'university', 'mall'].map((t) => (
                  <button key={t} className="chip" onClick={() => setParams({ q: t })}>
                    {t}
                  </button>
                ))}
              </div>
            }
            icon={<FolderSearch className="h-6 w-6" />}
          />
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <Tabs
                tabs={[{ id: 'all', label: 'Everything', count: results.length }, ...TYPES.map((t) => ({ id: t, label: TYPE_LABEL[t], count: results.filter((d) => d.type === t).length }))]}
                active={type}
                onChange={(id) => setType(id as ResultType | 'all')}
                size="sm"
              />
              <div className="flex flex-wrap gap-2">
                <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Filter results by category" className="w-52">
                  <option value="all">All categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
                <Select value={areaId} onChange={(e) => setAreaId(e.target.value)} aria-label="Filter results by area" className="w-44">
                  <option value="all">All areas</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
                {(type !== 'all' || categoryId !== 'all' || areaId !== 'all') && (
                  <button
                    className="btn-outline btn-sm"
                    onClick={() => {
                      setType('all');
                      setCategoryId('all');
                      setAreaId('all');
                    }}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>

            {scoped.length === 0 ? (
              results.length > 0 ? (
                <EmptyState
                  title={`“${q}” has ${plural(results.length, 'match')}, but the filters removed them all`}
                  body="Filters are combined, so a narrow type plus one area can legitimately empty the page. Take a filter off, or start from the whole result set again."
                  action={
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {type !== 'all' && (
                        <button className="chip chip-solid" onClick={() => setType('all')}>
                          {TYPE_LABEL[type]} <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {categoryId !== 'all' && (
                        <button className="chip chip-solid" onClick={() => setCategoryId('all')}>
                          {categories.find((c) => c.id === categoryId)?.name ?? categoryId} <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {areaId !== 'all' && (
                        <button className="chip chip-solid" onClick={() => setAreaId('all')}>
                          {areas.find((a) => a.id === areaId)?.name ?? areaId} <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button className="btn-primary btn-sm" onClick={() => { setType('all'); setCategoryId('all'); setAreaId('all'); }}>
                        Show all {plural(results.length, 'match')}
                      </button>
                    </div>
                  }
                />
              ) : (
                <EmptyState
                  title={`Nothing matched “${q}”`}
                  body="Karachify only knows what is in the dataset. Shorter words match better, and the spelling used in the record matters — try the category pages if you cannot find it."
                  action={
                    <div className="flex flex-wrap justify-center gap-2">
                      <Link to="/explore" className="btn-primary">
                        Browse categories
                      </Link>
                      <button className="btn-outline" onClick={() => navigate('/map')}>
                        Open the map instead
                      </button>
                    </div>
                  }
                />
              )
            ) : (
              <div className="space-y-10">
                {grouped.map((g) => (
                  <div key={g.type}>
                    <div className="mb-4 flex items-center gap-2">
                      {g.type === 'listing' && <MapPin className="h-4 w-4 text-teal-600" />}
                      {g.type === 'event' && <Sparkles className="h-4 w-4 text-teal-600" />}
                      {g.type === 'area' && <Tag className="h-4 w-4 text-teal-600" />}
                      {g.type === 'category' && <Tag className="h-4 w-4 text-teal-600" />}
                      {g.type === 'guide' && <BookOpen className="h-4 w-4 text-teal-600" />}
                      <h2 className="font-display text-xl font-bold text-navy-800">
                        {TYPE_LABEL[g.type]}
                        <span className="ml-2 text-sm font-medium text-navy-400">{g.docs.length}</span>
                      </h2>
                    </div>

                    {g.type === 'listing' && (
                      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {g.docs
                          .map((d) => listings.find((l) => l.id === d.id))
                          .filter((l): l is NonNullable<typeof l> => Boolean(l))
                          .map((l) => (
                            <ListingCard key={l.id} listing={l} />
                          ))}
                      </div>
                    )}

                    {g.type === 'event' && (
                      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {g.docs.map((d) => {
                          const e = events.find((x) => x.id === d.id);
                          return e ? <EventCard key={e.id} event={e} /> : null;
                        })}
                      </div>
                    )}

                    {(g.type === 'area' || g.type === 'category' || g.type === 'guide') && (
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {g.docs.map((d) => {
                          const media = imageFor(d.mediaKey, d.title);
                          return (
                            <Link key={`${d.type}-${d.slug}`} to={d.path} className="card card-hover flex items-center gap-4 overflow-hidden p-0">
                              <span className="block h-24 w-32 shrink-0 overflow-hidden bg-navy-50">
                                <img
                                  src={media.thumb}
                                  alt=""
                                  aria-hidden
                                  title={media.entry?.kind === 'related' ? `Illustrative photo — shows ${pictureSubject(media.entry)}` : undefined}
                                  className="h-full w-full object-cover"
                                  onError={(e) => (e.currentTarget.src = media.fallback)}
                                />
                              </span>
                              <span className="min-w-0 py-3 pr-4">
                                <span className="block truncate font-display font-bold text-navy-800">{d.title}</span>
                                <span className="mt-0.5 block text-[13px] text-navy-500">{d.subtitle}</span>
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
