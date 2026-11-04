import { useEffect, useRef, useState } from 'react';
import { alreadyChecked, checkedKeys, type DedupeRow } from './openDedupe';
import type { SearchDoc } from './search';

/**
 * The names of every record in the open tier, as one small file.
 *
 * A category page reads the full records — address, coordinates, hours — and
 * those are 7.5 MB across the whole tier. Search needs three fields per row, so
 * `.tools/build-tier-names.mjs` writes just those, and this module asks for it
 * the first time a query is long enough to be worth answering from the tier.
 * Nothing else on the site pulls it.
 */

interface NamesFile {
  note: string;
  licence: string;
  retrievedAt: string;
  total: number;
  byCategory: Record<string, [slug: string, name: string, areaId: string][]>;
}

export interface OpenName {
  slug: string;
  name: string;
  categoryId: string;
  areaId: string;
  needle: string;
}

let index: Promise<OpenName[]> | null = null;
let indexTotal: number | null = null;

/** How many records the tier index covers, phrased for copy. Null until the file
 *  has been read, so a sentence says "the unchecked records" rather than quoting
 *  a number the browser has not actually fetched. */
export function tierLabel() {
  return indexTotal ? `${indexTotal.toLocaleString()} unchecked OpenStreetMap records` : 'unchecked OpenStreetMap records';
}

function flatten(file: NamesFile): OpenName[] {
  indexTotal = file.total;
  const rows: OpenName[] = [];
  for (const [categoryId, entries] of Object.entries(file.byCategory)) {
    for (const [slug, name, areaId] of entries) {
      rows.push({ slug, name, categoryId, areaId, needle: name.toLowerCase() });
    }
  }
  return rows;
}

export function openNameIndex(): Promise<OpenName[]> {
  if (!index) {
    index = fetch(`${import.meta.env.BASE_URL}data/tier/names.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`names.json answered ${r.status}`);
        return r.json() as Promise<NamesFile>;
      })
      .then(flatten)
      .catch((e) => {
        // A failed read must be retryable, not a promise that poisons every
        // later search with the same rejection.
        index = null;
        throw e;
      });
  }
  return index;
}

/** Every term has to appear in the name; a tier record has nothing else to
 *  match on, so a partial match would be a guess about what the place is. */
function matches(name: string, terms: string[]) {
  return terms.every((t) => name.includes(t));
}

function scoreName(name: string, terms: string[]) {
  let score = 0;
  for (const t of terms) {
    if (name === t) score += 30;
    else if (name.startsWith(t)) score += 16;
    else if (name.includes(t)) score += 8;
  }
  return score;
}

export function openNameDocs(rows: OpenName[], query: string, curated: DedupeRow[], limit = 8): SearchDoc[] {
  const terms = query.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 1);
  if (terms.length < 1) return [];
  const keys = checkedKeys(curated);
  const hits: { row: OpenName; score: number }[] = [];
  for (const row of rows) {
    if (row.needle.length < 2) continue;
    if (!matches(row.needle, terms)) continue;
    if (alreadyChecked(row, keys)) continue;
    hits.push({ row, score: scoreName(row.needle, terms) });
  }
  hits.sort((a, b) => b.score - a.score || a.row.name.localeCompare(b.row.name));
  return hits.slice(0, limit).map(({ row }) => ({
    type: 'open' as const,
    id: `open:${row.categoryId}:${row.slug}`,
    slug: row.slug,
    title: row.name,
    subtitle: 'OpenStreetMap · not checked by Karachify',
    mediaKey: `open:${row.categoryId}:${row.slug}`,
    path: `/directory/${row.categoryId}/${row.slug}`,
    categoryId: row.categoryId,
    areaId: row.areaId,
    haystack: row.needle,
    weight: 0,
  }));
}

/**
 * The tier half of a search, asked for only when the words are long enough to
 * land on something. The index is fetched once and shared; the debounce keeps a
 * fast typist from firing a match over 18,812 names on every keystroke.
 */
export function useOpenNames(query: string, curated: DedupeRow[], limit = 8) {
  const q = query.trim();
  const [state, setState] = useState<{ docs: SearchDoc[]; loading: boolean; failed: boolean }>({
    docs: [],
    loading: false,
    failed: false,
  });
  /* The caller builds this list from the store on every render, so it is never
     the same array twice. Reading it from a ref keeps it out of the dependency
     list — as a dependency it would re-arm the timer after every answer, and the
     answer would re-render the caller, and so on forever. */
  const curatedRef = useRef(curated);
  curatedRef.current = curated;

  useEffect(() => {
    if (q.length < 3) {
      setState((s) => (s.docs.length || s.loading || s.failed ? { docs: [], loading: false, failed: false } : s));
      return;
    }
    let cancelled = false;
    // The previous answer matches different words, not these, so it goes away the
    // moment the query changes rather than sitting under the new one until the
    // timer fires. The status line explains the gap.
    setState({ docs: [], loading: true, failed: false });
    const timer = window.setTimeout(() => {
      openNameIndex()
        .then((rows) => {
          if (cancelled) return;
          setState({ docs: openNameDocs(rows, q, curatedRef.current, limit), loading: false, failed: false });
        })
        .catch(() => {
          if (!cancelled) setState({ docs: [], loading: false, failed: true });
        });
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [q, limit]);

  return state;
}
