/**
 * The one rule that decides whether a map record is a new place or the same
 * place a checked page already describes.
 *
 * Slug alone is not enough: the dump names a feature after the area it sits in,
 * so "Hawke's Bay Beach" exists as a checked page and as
 * `hawkes-bay-beach-orangi-town` — two cards for one beach.
 *
 * Both sides read it from here. .tools/build-open-records.mjs counts the survivors
 * into the summary, the browser hides them from the list, so the figure printed on
 * a category tile is the number of cards that appear when the tile is opened.
 */

export interface DedupeRow {
  slug: string;
  name: string;
  categoryId: string;
}

const normName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const nameKey = (row: DedupeRow) => `${normName(row.name)}|${row.categoryId}`;

export function checkedKeys(checked: DedupeRow[]) {
  return {
    slugs: new Set(checked.map((c) => c.slug)),
    names: new Set(checked.map(nameKey)),
  };
}

export function alreadyChecked(row: DedupeRow, keys: ReturnType<typeof checkedKeys>) {
  return keys.slugs.has(row.slug) || keys.names.has(nameKey(row));
}
