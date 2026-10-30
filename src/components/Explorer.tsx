import { useEffect, useMemo, useState } from 'react';
import { LayoutGrid, List, Search, SlidersHorizontal, X } from 'lucide-react';
import type { Listing } from '../types';
import { selectAreas, useDB } from '../lib/store';
import { ListingCard } from './cards';
import { EmptyState, Select, SkeletonGrid, TextInput } from './ui';

export type SortKey = 'recommended' | 'rating' | 'reviews' | 'az' | 'area';

const SORTS: { id: SortKey; label: string }[] = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'rating', label: 'Top rated' },
  { id: 'reviews', label: 'Most reviewed' },
  { id: 'az', label: 'Name (A–Z)' },
  { id: 'area', label: 'Group by area' },
];

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function useListingSort(items: Listing[], sort: SortKey) {
  return useMemo(() => {
    const list = [...items];
    switch (sort) {
      case 'rating':
        return list.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
      case 'reviews':
        return list.sort((a, b) => b.reviewCount - a.reviewCount);
      case 'az':
        return list.sort((a, b) => a.name.localeCompare(b.name));
      case 'area':
        return list.sort((a, b) => a.areaId.localeCompare(b.areaId) || b.rating - a.rating);
      default:
        return list.sort(
          (a, b) => Number(b.featured || b.promoted) - Number(a.featured || a.promoted) || b.rating - a.rating
        );
    }
  }, [items, sort]);
}

/**
 * The one listing browser reused by every category page, area page, the
 * services hub and the search results: keyword filter, area filter, sorting,
 * grid/list toggle, load-more pagination and an empty state.
 */
export function ListingExplorer({
  items,
  areaFilterIds,
  defaultAreaId,
  showArea = true,
  pageSize = 12,
  emptyTitle = 'No listings match these filters',
  emptyBody = 'Try a different area, clear the search box, or browse another category — every record in Karachify is demo data you can filter freely.',
}: {
  items: Listing[];
  /** Restrict the area dropdown to the areas actually present in these items. */
  areaFilterIds?: string[];
  defaultAreaId?: string;
  showArea?: boolean;
  pageSize?: number;
  emptyTitle?: string;
  emptyBody?: string;
}) {
  const db = useDB();
  const allAreas = selectAreas(db);
  const [query, setQuery] = useState('');
  const [areaId, setAreaId] = useState('all');
  const [sort, setSort] = useState<SortKey>('recommended');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [shown, setShown] = useState(pageSize);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 260);
    return () => clearTimeout(t);
  }, []);

  const areaOptions = useMemo(() => {
    const ids = areaFilterIds ?? Array.from(new Set(items.map((l) => l.areaId)));
    return allAreas.filter((a) => ids.includes(a.id));
  }, [items, allAreas, areaFilterIds]);

  useEffect(() => {
    if (defaultAreaId) setAreaId(defaultAreaId);
  }, [defaultAreaId]);

  const filtered = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return items;
    return items.filter((l) => {
      const hay = norm([l.name, l.tagline, l.description, l.address, l.tags.join(' '), l.cuisine?.join(' ') ?? '', l.facilities?.join(' ') ?? ''].join(' '));
      return q.split(' ').every((term) => hay.includes(term));
    });
  }, [items, query]);

  const sorted = useListingSort(areaId === 'all' ? filtered : filtered.filter((l) => l.areaId === areaId), sort);

  const itemKey = useMemo(() => items.map((l) => l.id).join(','), [items]);
  useEffect(() => setShown(pageSize), [query, areaId, sort, itemKey, pageSize]);

  const visible = sorted.slice(0, shown);
  const dirty = query.trim() !== '' || areaId !== 'all';

  return (
    <div>
      <div className="card z-30 mb-6 flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400" />
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search within these listings…"
            aria-label="Search within these listings"
            className="pl-10"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-navy-400 hover:bg-navy-50 hover:text-navy-700"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="hidden items-center gap-1.5 text-[13px] font-semibold text-navy-500 sm:inline-flex">
            <SlidersHorizontal className="h-4 w-4" />
            Filter
          </span>
          <Select value={areaId} onChange={(e) => setAreaId(e.target.value)} aria-label="Filter by area" className="min-w-[170px] py-2.5">
            <option value="all">All areas of Karachi</option>
            {areaOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort listings" className="min-w-[160px] py-2.5">
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
          <div className="flex items-center gap-1 rounded-full border border-navy-200 bg-white p-1">
            <button
              onClick={() => setView('grid')}
              aria-pressed={view === 'grid'}
              aria-label="Grid view"
              className={`rounded-full p-2 ${view === 'grid' ? 'bg-navy-800 text-white' : 'text-navy-500 hover:bg-navy-50'}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView('list')}
              aria-pressed={view === 'list'}
              aria-label="List view"
              className={`rounded-full p-2 ${view === 'list' ? 'bg-navy-800 text-white' : 'text-navy-500 hover:bg-navy-50'}`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <p className="mb-4 text-sm text-navy-500" aria-live="polite">
        {loading ? 'Loading listings…' : `${sorted.length} listing${sorted.length === 1 ? '' : 's'}${dirty ? ' matching your filters' : ''}`}
      </p>

      {loading ? (
        <SkeletonGrid count={Math.min(8, pageSize)} />
      ) : visible.length === 0 ? (
        <EmptyState
          title={emptyTitle}
          body={emptyBody}
          action={
            dirty ? (
              <button
                className="btn-outline"
                onClick={() => {
                  setQuery('');
                  setAreaId('all');
                }}
              >
                Clear filters
              </button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className={view === 'grid' ? 'grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'flex flex-col gap-4'}>
            {visible.map((l) => (
              <ListingCard key={l.id} listing={l} view={view} showArea={showArea} />
            ))}
          </div>
          {shown < sorted.length && (
            <div className="mt-9 flex flex-col items-center gap-3">
              <p className="text-sm text-navy-500">
                Showing {visible.length} of {sorted.length}
              </p>
              <button className="btn-outline" onClick={() => setShown((s) => s + pageSize)}>
                Load more listings
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
