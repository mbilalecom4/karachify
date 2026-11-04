import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Listing } from '../types';
import { areaById, categoryById } from '../data/taxonomy';
import { alreadyChecked, checkedKeys } from './openDedupe';

/**
 * The open-records tier: every Karachi place found on OpenStreetMap that
 * Karachify has not checked by hand.
 *
 * It is deliberately NOT part of src/data/listings. That file is compiled into
 * the bundle and policed by .tools/check-data.mjs; this one is 7 MB of JSON, held
 * in 200-record parts under public/data/tier/parts, that the visitor only
 * downloads for the category they actually opened — and for a single record page,
 * only the boundary index plus the one part that could hold it. The trade-off is
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

/* -------------------------------- the files -------------------------------- */

const file = (name: string) => `${import.meta.env.BASE_URL}data/tier/${name}.json`;

type Load<T> = { data: T | null; failed: boolean };

/** One 200-record slice of a category, and the boundary table that locates it. */
interface TierPart {
  id: string;
  count: number;
  records: OpenRecord[];
}

export interface TierPartBoundary {
  from: string;
  to: string;
  n: number;
}

interface TierPartsIndex {
  id: string;
  size: number;
  count: number;
  parts: TierPartBoundary[];
}

const indexName = (categoryId: string) => `parts/${categoryId}`;
const partName = (categoryId: string, position: number) => `parts/${categoryId}/${String(position + 1).padStart(3, '0')}`;

/**
 * Which part holds `slug`, by the boundary table, or -1 when the slug sorts
 * outside every part. The comparison is plain `<`/`>` because that is the order
 * the builder wrote the files in — a locale-aware compare would disagree with it.
 */
function partIndexOf(index: TierPartsIndex, slug: string) {
  let lo = 0;
  let hi = index.parts.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const bound = index.parts[mid];
    if (slug < bound.from) hi = mid - 1;
    else if (slug > bound.to) lo = mid + 1;
    else return mid;
  }
  return -1;
}

const cache = new Map<string, Load<unknown>>();
const readers = new Map<string, { promise: Promise<unknown>; refs: number; controller: AbortController }>();

const isAbort = (error: unknown) => error instanceof Error && /abort/i.test(error.name);

/**
 * Read one tier file, with a single network request shared by everyone waiting
 * for it. `release` is the other half of the deal: the request is aborted once
 * the last reader leaves, so navigating away from an 80 KB part stops spending on
 * a page nobody is looking at.
 */
function request<T>(name: string): Promise<T> {
  const cached = cache.get(name);
  if (cached?.data) return Promise.resolve(cached.data as T);
  const shared = readers.get(name);
  if (shared) {
    shared.refs += 1;
    return shared.promise as Promise<T>;
  }
  const controller = new AbortController();
  const entry: { promise: Promise<unknown>; refs: number; controller: AbortController } = {
    refs: 1,
    controller,
    promise: null as unknown as Promise<unknown>,
  };
  entry.promise = fetch(file(name), { headers: { Accept: 'application/json' }, signal: controller.signal })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((data) => {
      readers.delete(name);
      cache.set(name, { data, failed: false });
      return data;
    })
    .catch((error) => {
      readers.delete(name);
      /* A visitor who left is not a file that is missing: the next reader has to
         try again rather than inherit this as a permanent failure. */
      if (!isAbort(error)) cache.set(name, { data: null, failed: true });
      throw error;
    });
  readers.set(name, entry);
  return entry.promise as Promise<T>;
}

function release(name: string) {
  const shared = readers.get(name);
  if (!shared) return;
  shared.refs -= 1;
  if (shared.refs > 0) return;
  readers.delete(name);
  shared.controller.abort();
}

/* --------------------------------- hooks --------------------------------- */

/**
 * Read a fixed list of tier files for as long as the caller is mounted.
 * `files[i]` is null until that file arrives, so a caller can tell a record that
 * is still downloading from one the dump does not hold at all.
 */
function useTierFiles(names: string[]) {
  const key = names.join('|');
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<{ key: string; files: unknown[]; failed: boolean }>({ key: '', files: [], failed: false });
  useEffect(() => {
    if (!names.length) {
      setState({ key, files: [], failed: false });
      return;
    }
    let live = true;
    const files = names.map(() => null as unknown);
    let left = names.length;
    let failed = false;
    const settle = () => {
      if (live && left === 0) setState({ key, files: [...files], failed });
    };
    names.forEach((name, i) => {
      request<unknown>(name).then(
        (data) => {
          files[i] = data;
          left -= 1;
          settle();
        },
        () => {
          failed = true;
          left -= 1;
          settle();
        }
      );
    });
    settle();
    return () => {
      live = false;
      names.forEach((name) => release(name));
    };
  }, [key, nonce]);
  const retry = useCallback(() => {
    for (const name of key ? key.split('|') : []) cache.delete(name);
    setNonce((n) => n + 1);
  }, [key]);
  /* Until this exact list has settled, neither its files nor a failure from the
     list before it describe what the caller is asking for. */
  const settled = state.key === key;
  return { files: settled ? state.files : names.map(() => null), failed: settled ? state.failed : false, retry };
}

export function useTierSummary() {
  const { files, failed, retry } = useTierFiles(['index']);
  return { data: (files[0] as TierSummary | null) ?? null, failed, retry };
}

/**
 * A whole category of the tier, for the map layer and the directory list —
 * the boundary index plus every part, in parallel.
 * `open` is a switch, not a hook: the records stay off the page until the visitor
 * says they want the unchecked ones, so a category page still paints from the
 * bundle alone.
 */
export function useOpenRecords(categoryId: string | undefined, open: boolean) {
  const indexFile = useTierFiles(open && categoryId ? [indexName(categoryId)] : []);
  const index = (indexFile.files[0] as TierPartsIndex | null) ?? undefined;
  const parts = useMemo(() => (index ? index.parts.map((_, i) => partName(index.id, i)) : []), [index]);
  const partFiles = useTierFiles(parts);
  const data = useMemo(() => {
    /* A part that failed would make the list shorter than the count next to it,
       so a partial load is reported as a failure rather than shown as a list. */
    if (!index || partFiles.failed || partFiles.files.length !== parts.length || partFiles.files.some((f) => f === null))
      return null;
    const all: OpenRecord[] = [];
    for (const raw of partFiles.files) all.push(...(raw as TierPart).records);
    return all;
  }, [index, parts, partFiles.files, partFiles.failed]);
  return {
    data,
    failed: indexFile.failed || partFiles.failed,
    retry: () => {
      indexFile.retry();
      partFiles.retry();
    },
  };
}

/**
 * One record, for the page whose URL carries its category and slug. This is the
 * reason the parts exist: two small reads instead of the whole category, which
 * used to cost 1.9 MB to show a single place.
 */
export function useOpenRecord(categoryId: string | undefined, slug: string | undefined) {
  const indexFile = useTierFiles(categoryId ? [indexName(categoryId)] : []);
  const index = (indexFile.files[0] as TierPartsIndex | null) ?? undefined;
  const position = index && slug ? partIndexOf(index, slug) : -1;
  const partFile = useTierFiles(index && position >= 0 ? [partName(index.id, position)] : []);
  const part = (partFile.files[0] as TierPart | null) ?? undefined;
  const record = part?.records.find((r) => r.slug === slug) ?? null;
  const missing = Boolean(index) && (position < 0 || (part !== undefined && !record));
  return {
    record,
    missing,
    failed: indexFile.failed || partFile.failed,
    retry: () => {
      indexFile.retry();
      partFile.retry();
    },
  };
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
