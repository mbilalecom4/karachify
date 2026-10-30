import type { DB } from './store';
import { selectAreas, selectCategories, selectEvents, selectListings } from './store';
import { guides } from '../data/guides';

export type ResultType = 'listing' | 'event' | 'area' | 'category' | 'guide';

export interface SearchDoc {
  type: ResultType;
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  /** key into the media registry, used for the card image */
  mediaKey: string;
  path: string;
  categoryId?: string;
  areaId?: string;
  haystack: string;
  /** small, well-known records rank a little higher on equal text match */
  weight: number;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export function buildIndex(db: DB): SearchDoc[] {
  const listings = selectListings(db);
  const events = selectEvents(db);
  const areas = selectAreas(db);
  const categories = selectCategories(db);

  const areaName = (id: string) => areas.find((a) => a.id === id)?.name ?? 'Karachi';
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? '';

  return [
    ...listings.map((l) => ({
      type: 'listing' as const,
      id: l.id,
      slug: l.slug,
      title: l.name,
      subtitle: `${catName(l.categoryId)} · ${areaName(l.areaId)}`,
      mediaKey: l.slug,
      path: `/place/${l.slug}`,
      categoryId: l.categoryId,
      areaId: l.areaId,
      haystack: norm(
        [l.name, l.tagline, l.description, l.address, areaName(l.areaId), catName(l.categoryId), l.cuisine?.join(' '), l.tags.join(' '), l.facilities.join(' ')]
          .filter(Boolean)
          .join(' ')
      ),
      weight: (l.featured ? 3 : 0) + (l.promoted ? 2 : 0) + Math.min(2, (l.reviewCount ?? 0) / 400),
    })),
    ...events.map((e) => ({
      type: 'event' as const,
      id: e.id,
      slug: e.slug,
      title: e.name,
      subtitle: `${e.eventCategory} · ${e.venue}`,
      mediaKey: e.slug,
      path: `/events/${e.slug}`,
      categoryId: 'events',
      areaId: e.areaId,
      haystack: norm([e.name, e.description, e.venue, areaName(e.areaId), e.eventCategory, e.organiser].join(' ')),
      weight: 1,
    })),
    ...areas.map((a) => ({
      type: 'area' as const,
      id: a.id,
      slug: a.slug,
      title: a.name,
      subtitle: `Area · ${a.zone} Karachi`,
      mediaKey: `banner-tourist-places`,
      path: `/area/${a.slug}`,
      areaId: a.id,
      haystack: norm([a.name, a.zone, a.blurb, 'area', 'neighbourhood', 'karachi'].join(' ')),
      weight: 2.5,
    })),
    ...categories.map((c) => ({
      type: 'category' as const,
      id: c.id,
      slug: c.slug,
      title: c.name,
      subtitle: `Category · ${c.group}`,
      mediaKey: `banner-${c.id}`,
      path: `/category/${c.slug}`,
      categoryId: c.id,
      haystack: norm([c.name, c.group, c.blurb, 'category'].join(' ')),
      weight: 2.2,
    })),
    ...guides.map((g) => ({
      type: 'guide' as const,
      id: g.id,
      slug: g.slug,
      title: g.title,
      subtitle: `Guide · ${g.tag}`,
      mediaKey: `guide-${g.slug}`,
      path: `/guides/${g.slug}`,
      haystack: norm([g.title, g.excerpt, g.tag, g.area, g.sections.map((s) => `${s.heading} ${s.body.join(' ')}`).join(' ')].join(' ')),
      weight: 1,
    })),
  ];
}

function scoreDoc(doc: SearchDoc, terms: string[]): number {
  const title = norm(doc.title);
  let score = 0;
  for (const t of terms) {
    if (!t) continue;
    if (title === t) score += 40;
    else if (title.startsWith(t)) score += 22;
    else if (title.includes(t)) score += 14;
    const hits = doc.haystack.split(' ').filter((w) => w.startsWith(t)).length;
    if (doc.haystack.includes(t)) score += 6;
    score += Math.min(6, hits);
  }
  return score + doc.weight;
}

export interface SearchOptions {
  types?: ResultType[];
  categoryId?: string;
  areaId?: string;
  limit?: number;
}

export function search(db: DB, query: string, opts: SearchOptions = {}) {
  const index = buildIndex(db);
  const q = norm(query);
  if (!q) return [];
  const terms = q.split(' ').filter((t) => t.length > 1);
  const filtered = index.filter((d) => {
    if (opts.types?.length && !opts.types.includes(d.type)) return false;
    if (opts.categoryId && d.categoryId && d.categoryId !== opts.categoryId) return false;
    if (opts.areaId && d.areaId && d.areaId !== opts.areaId) return false;
    return true;
  });

  return filtered
    .map((d) => ({ doc: d, score: scoreDoc(d, terms) }))
    .filter((r) => r.score > 4)
    .sort((a, b) => b.score - a.score || a.doc.title.localeCompare(b.doc.title))
    .slice(0, opts.limit ?? 200)
    .map((r) => r.doc);
}

export function suggest(db: DB, query: string, limit = 7): SearchDoc[] {
  return search(db, query, { limit });
}

export const TYPE_LABEL: Record<ResultType, string> = {
  listing: 'Places',
  event: 'Events',
  area: 'Areas',
  category: 'Categories',
  guide: 'Guides',
};

export function groupByType(docs: SearchDoc[]) {
  const groups = new Map<ResultType, SearchDoc[]>();
  for (const d of docs) {
    const list = groups.get(d.type) ?? [];
    list.push(d);
    groups.set(d.type, list);
  }
  return groups;
}
