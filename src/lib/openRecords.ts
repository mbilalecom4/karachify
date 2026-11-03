import { useCallback, useEffect, useState } from 'react';
import type { Listing } from '../types';
import { areaById, categoryById } from '../data/taxonomy';
import { alreadyChecked, checkedKeys } from './openDedupe';

/**
 * The open-records tier: every Karachi place found on OpenStreetMap that
 * Karachify has not checked by hand.
 *
 * It is deliberately NOT part of src/data/listings. That file is compiled into
 * the bundle and policed by .tools/check-data.mjs; this one is 7 MB of JSON the
 * visitor only downloads for the category they actually opened. The trade-off is
 * that nothing here can be linked to from the bundle by slug alone, so the route
 * carries the category — see listingHref.
 */

export interface OpenRecord {
  slug: string;
  name: string;
  categoryId: string;
  areaId: string;
  address: string;
  lat: number;
  lng: number;
  sourceUrl: string;
  createdAt: string;
  tags: string[];
  phone?: string;
  website?: string;
  email?: string;
  hours?: { day: string; open: string }[];
  facilities?: string[];
  subcategory?: string;
  retrievedAt?: string;
  licence?: string;
  wikipedia?: string;
  wikidata?: string;
}

export interface TierCategory {
  id: string;
  count: number;
  /** Records in `count` that no checked page already covers. */
  unchecked: number;
  areas: Record<string, number>;
  withContact: number;
  withHours: number;
}

export interface TierSummary {
  note: string;
  licence: string;
  retrievedAt: string;
  total: number;
  /** Map records that a checked page already covers, so they are hidden from the lists. */
  alreadyChecked: number;
  categories: TierCategory[];
  areas: { id: string; count: number }[];
}

const file = (name: string) => `${import.meta.env.BASE_URL}data/tier/${name}.json`;

type Load<T> = { data: T | null; failed: boolean };

const summaryCache: Load<TierSummary> = { data: null, failed: false };
let summaryPromise: Promise<TierSummary> | null = null;
const categoryCache = new Map<string, Load<OpenRecord[]>>();
const categoryPromises = new Map<string, Promise<OpenRecord[]>>();

async function getJson<T>(name: string): Promise<T> {
  const res = await fetch(file(name), { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export function loadTierSummary(): Promise<TierSummary> {
  if (summaryCache.data) return Promise.resolve(summaryCache.data);
  if (!summaryPromise) {
    summaryPromise = getJson<TierSummary>('index')
      .then((d) => {
        summaryCache.data = d;
        summaryCache.failed = false;
        return d;
      })
      .catch((e) => {
        summaryPromise = null;
        summaryCache.failed = true;
        throw e;
      });
  }
  return summaryPromise;
}

export function loadOpenCategory(categoryId: string): Promise<OpenRecord[]> {
  const cached = categoryCache.get(categoryId);
  if (cached?.data) return Promise.resolve(cached.data);
  let p = categoryPromises.get(categoryId);
  if (!p) {
    p = getJson<{ records: OpenRecord[] }>(categoryId)
      .then((d) => {
        categoryCache.set(categoryId, { data: d.records, failed: false });
        return d.records;
      })
      .catch((e) => {
        categoryPromises.delete(categoryId);
        categoryCache.set(categoryId, { data: null, failed: true });
        throw e;
      });
    categoryPromises.set(categoryId, p);
  }
  return p;
}

/* --------------------------------- hooks --------------------------------- */

export function useTierSummary() {
  const [state, setState] = useState<Load<TierSummary>>({ data: summaryCache.data, failed: summaryCache.failed });
  useEffect(() => {
    if (summaryCache.data) return setState({ data: summaryCache.data, failed: false });
    let live = true;
    loadTierSummary()
      .then((d) => live && setState({ data: d, failed: false }))
      .catch(() => {
        if (!live) return;
        summaryCache.failed = true;
        setState({ data: null, failed: true });
      });
    return () => {
      live = false;
    };
  }, []);
  const retry = useCallback(() => {
    summaryCache.failed = false;
    setState({ data: null, failed: false });
    loadTierSummary()
      .then((d) => setState({ data: d, failed: false }))
      .catch(() => {
        summaryCache.failed = true;
        setState({ data: null, failed: true });
      });
  }, []);
  return { ...state, retry };
}

/**
 * One category of the tier, fetched the first time someone asks for it.
 * `open` is a switch, not a hook: the records stay off the page until the
 * visitor says they want the unchecked ones, so a category page still paints
 * from the bundle alone.
 */
export function useOpenRecords(categoryId: string | undefined, open: boolean) {
  const [state, setState] = useState<Load<OpenRecord[]>>({ data: null, failed: false });
  useEffect(() => {
    if (!categoryId || !open) return;
    const cached = categoryCache.get(categoryId);
    if (cached?.data) return setState({ data: cached.data, failed: false });
    if (cached?.failed) return setState({ data: null, failed: true });
    let live = true;
    setState({ data: null, failed: false });
    loadOpenCategory(categoryId)
      .then((r) => live && setState({ data: r, failed: false }))
      .catch(() => live && setState({ data: null, failed: true }));
    return () => {
      live = false;
    };
  }, [categoryId, open]);
  const retry = useCallback(() => {
    if (!categoryId) return;
    categoryCache.delete(categoryId);
    setState({ data: null, failed: false });
    loadOpenCategory(categoryId)
      .then((r) => setState({ data: r, failed: false }))
      .catch(() => setState({ data: null, failed: true }));
  }, [categoryId]);
  return { ...state, retry };
}

/** Fetch a single record for the detail page, where the category is in the URL. */
export function useOpenRecord(categoryId: string | undefined, slug: string | undefined) {
  const [state, setState] = useState<{ record: OpenRecord | null; missing: boolean; failed: boolean }>({
    record: null,
    missing: false,
    failed: false,
  });
  useEffect(() => {
    if (!categoryId || !slug) return;
    let live = true;
    setState({ record: null, missing: false, failed: false });
    loadOpenCategory(categoryId)
      .then((rows) => {
        if (!live) return;
        const found = rows.find((r) => r.slug === slug) ?? null;
        setState({ record: found, missing: !found, failed: false });
      })
      .catch(() => live && setState({ record: null, missing: false, failed: true }));
    return () => {
      live = false;
    };
  }, [categoryId, slug]);
  const retry = useCallback(() => {
    if (!categoryId || !slug) return;
    categoryCache.delete(categoryId);
    setState({ record: null, missing: false, failed: false });
    loadOpenCategory(categoryId)
      .then((rows) => {
        const found = rows.find((r) => r.slug === slug) ?? null;
        setState({ record: found, missing: !found, failed: false });
      })
      .catch(() => setState({ record: null, missing: false, failed: true }));
  }, [categoryId, slug]);
  return { ...state, retry };
}

/* -------------------------------- adapting ------------------------------- */

/**
 * The tier is rendered with the same cards as everything else, so it is
 * converted to the same shape — with the fields a source never supplied left
 * absent rather than filled in.
 */
export function openToListing(r: OpenRecord): Listing {
  const category = categoryById.get(r.categoryId);
  const area = areaById.get(r.areaId);
  const where = area?.name ?? 'Karachi';
  const kind = r.subcategory ? humanTag(r.subcategory) : (category?.name ?? 'mapped feature');
  const fetched = formatDate(r.retrievedAt ?? r.createdAt);
  return {
    id: `open:${r.categoryId}:${r.slug}`,
    slug: r.slug,
    cityId: 'karachi',
    categoryId: r.categoryId,
    areaId: r.areaId,
    name: r.name,
    tagline: `OpenStreetMap feature (${kind}) — not checked by Karachify.`,
    description: `OpenStreetMap holds a ${kind} here, last read on ${fetched}. The map records its address as “${r.address}”. Karachify filed it under ${where} from that address and has not opened, phoned or visited it, so no rating, price or written description appears.`,
    address: r.address,
    lat: r.lat,
    lng: r.lng,
    phone: r.phone,
    website: r.website,
    email: r.email,
    hours: r.hours,
    facilities: r.facilities ?? [],
    tags: r.tags,
    featured: false,
    promoted: false,
    status: 'needs-review',
    sourceUrl: r.sourceUrl,
    osmId: osmIdOf(r.sourceUrl),
    coordsVerified: true,
    createdAt: r.createdAt,
  };
}

export function isOpenListing(l: Pick<Listing, 'id'>) {
  return l.id.startsWith('open:');
}

/** Where a listing's own page lives: curated by slug, open record by category too. */
export function listingHref(l: Pick<Listing, 'slug' | 'categoryId' | 'id'>) {
  return isOpenListing(l) ? `/directory/${l.categoryId}/${l.slug}` : `/place/${l.slug}`;
}

export function osmIdOf(sourceUrl: string) {
  const m = /\/(node|way|relation)\/(\d+)/.exec(sourceUrl);
  return m ? `${m[1]}/${m[2]}` : undefined;
}

/** `art_culture` and `fast_food` are OSM tag values; a visitor reads them better with spaces. */
export function humanTag(tag: string) {
  return tag.replace(/[_-]+/g, ' ').trim();
}

function formatDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function openAsListings(rows: OpenRecord[]) {
  return rows.map(openToListing);
}

/** The rule lives in openDedupe.ts so the summary can be counted with it too. */
export function withoutCheckedDuplicates(rows: Listing[], curated: Listing[]) {
  const keys = checkedKeys(curated);
  return rows.filter((l) => !alreadyChecked(l, keys));
}

/**
 * The second figure on a category tile: how many map records sit behind it that
 * nobody has opened. Counted at build time against the checked pages, so the
 * tile and the list opened from it agree instead of one of them guessing.
 * Undefined when there are none, so the tile stays a single line rather than
 * reading "· 0 more".
 */
export function openCountLabel(categoryId: string, summary: TierSummary | null) {
  const row = summary?.categories.find((c) => c.id === categoryId);
  return row && row.unchecked > 0 ? `${row.unchecked.toLocaleString()} more, unchecked` : undefined;
}
