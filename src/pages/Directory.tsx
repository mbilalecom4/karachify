import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, ExternalLink, MapPin, Phone, Search } from 'lucide-react';
import { selectAreas, selectCategories, useDB } from '../lib/store';
import { EmptyState, LoadMore, Select, SkeletonGrid, TextInput } from '../components/ui';
import { Note, PageHero } from '../components/Page';

interface Place {
  s: string;
  n: string;
  c: string;
  a: string;
  la: string;
  ln: string;
  ad: string | null;
  p: string | null;
  w: string | null;
  h: string | null;
  u: string | null;
}

interface ResearchIndex {
  generatedAt: string;
  license: string;
  licenseKind: string;
  notice: string;
  count: number;
  places: Place[];
}

const PAGE = 50;

export default function Directory() {
  const db = useDB();
  const categories = selectCategories(db);
  const areas = selectAreas(db);
  const [index, setIndex] = useState<ResearchIndex | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [area, setArea] = useState('all');
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    let live = true;
    fetch(`${import.meta.env.BASE_URL}data/research-index.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => live && setIndex(d))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const areaName = useMemo(() => new Map(areas.map((a) => [a.id, a.name])), [areas]);

  /* Only offer filters that actually have rows behind them — an empty dropdown
     option is the same dead shelf we removed from the nav. */
  const usedCats = useMemo(() => {
    if (!index) return [];
    const seen = new Set(index.places.map((p) => p.c));
    return categories.filter((c) => seen.has(c.id)).map((c) => ({ id: c.id, name: c.name, count: index.places.filter((p) => p.c === c.id).length }));
  }, [index, categories]);
  const usedAreas = useMemo(() => {
    if (!index) return [];
    const seen = new Set(index.places.map((p) => p.a));
    return areas
      .filter((a) => seen.has(a.id))
      .map((a) => ({ id: a.id, name: a.name, count: index.places.filter((p) => p.a === a.id).length }));
  }, [index, areas]);

  const filtered = useMemo(() => {
    if (!index) return [];
    const term = q.trim().toLowerCase();
    return index.places.filter(
      (p) =>
        (cat === 'all' || p.c === cat) &&
        (area === 'all' || p.a === area) &&
        (term ? `${p.n} ${p.ad ?? ''}`.toLowerCase().includes(term) : true)
    );
  }, [index, q, cat, area]);

  const visible = filtered.slice(0, shown);

  return (
    <div>
      <PageHero
        mediaKey="hero-karachi"
        label="Karachi directory"
        eyebrow="Wider map"
        title="The wider Karachi directory"
        sub="Every place Karachify has found on OpenStreetMap, including the ones we have not verified yet. This is a discovery list, not a recommendation."
        trail={[{ label: 'Home', to: '/' }, { label: 'Directory' }]}
      />

      <section className="shell section">
        {failed && (
          <Note tone="warn">
            The directory file could not be loaded. The curated pages under <Link to="/explore" className="font-semibold underline">Explore</Link> do
            not need it and still work.
          </Note>
        )}

        {!index && !failed && (
          <div>
            <p className="mb-4 text-[15px] text-navy-500">Loading the directory — about 0.6 MB, fetched once and cached by your browser.</p>
            <SkeletonGrid count={8} />
          </div>
        )}

        {index && (
          <>
            <div className="card mb-5 flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400" />
                <TextInput
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setShown(PAGE);
                  }}
                  placeholder="Search a name or street — “biryani”, “Shaheed-e-Millat”…"
                  aria-label="Search the directory"
                  className="pl-10"
                />
              </div>
              <Select
                value={cat}
                onChange={(e) => {
                  setCat(e.target.value);
                  setShown(PAGE);
                }}
                aria-label="Filter by category"
                className="lg:w-56"
              >
                <option value="all">All categories ({index.count})</option>
                {usedCats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.count})
                  </option>
                ))}
              </Select>
              <Select
                value={area}
                onChange={(e) => {
                  setArea(e.target.value);
                  setShown(PAGE);
                }}
                aria-label="Filter by area"
                className="lg:w-56"
              >
                <option value="all">All areas</option>
                {usedAreas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.count})
                  </option>
                ))}
              </Select>
            </div>

            <Note tone="warn">
              {index.notice} {index.license}, {index.licenseKind}. Extracted {index.generatedAt}.
            </Note>

            <p className="mt-5 text-[14px] font-semibold text-navy-600">
              {filtered.length.toLocaleString()} records match these filters · {visible.length.toLocaleString()} on screen
            </p>

            {filtered.length === 0 ? (
              <EmptyState
                title="Nothing in the directory matches that"
                body="The wider map only holds what OpenStreetMap has mapped, so a name that is not there may simply be unmarked rather than closed."
                action={
                  <button
                    className="btn-outline"
                    onClick={() => {
                      setQ('');
                      setCat('all');
                      setArea('all');
                    }}
                  >
                    Clear filters
                  </button>
                }
              />
            ) : (
              <ul className="mt-4 divide-y divide-navy-100 overflow-hidden rounded-2xl border border-navy-100 bg-white">
                {visible.map((p) => (
                  <li key={p.s} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                    <div className="min-w-0">
                      <p className="font-display text-[16px] font-bold text-navy-800">{p.n}</p>
                      <p className="mt-0.5 text-[13px] text-navy-500">
                        {catName.get(p.c) ?? p.c} · {areaName.get(p.a) ?? p.a}
                      </p>
                      {p.ad && (
                        <p className="mt-1.5 flex items-start gap-1.5 text-[13px] text-navy-600">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600" />
                          <span className="min-w-0">{p.ad}</span>
                        </p>
                      )}
                      {p.h && (
                        <p className="mt-1 flex items-center gap-1.5 text-[13px] text-navy-600">
                          <Clock className="h-3.5 w-3.5 shrink-0 text-teal-600" /> {p.h}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-3 sm:justify-end">
                      {p.p && (
                        <a href={`tel:${p.p.replace(/[^\d+]/g, '')}`} className="flex items-center gap-1.5 text-[13px] font-semibold text-teal-700 hover:text-teal-800">
                          <Phone className="h-3.5 w-3.5" /> {p.p}
                        </a>
                      )}
                      {p.w && (
                        <a href={p.w} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-1.5 text-[13px] font-semibold text-teal-700 hover:text-teal-800">
                          Website <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {p.u && (
                        <a href={p.u} target="_blank" rel="noopener noreferrer" className="text-[12px] font-semibold text-navy-400 hover:text-navy-600">
                          OpenStreetMap
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {filtered.length > shown && <LoadMore shown={visible.length} total={filtered.length} onClick={() => setShown((s) => s + PAGE)} />}
          </>
        )}
      </section>
    </div>
  );
}
