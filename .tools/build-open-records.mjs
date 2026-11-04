#!/usr/bin/env node
/**
 * Turn the local OpenStreetMap research dump into the public "open records" tier.
 *
 * The source file is 31 MB and is not committed; its output is, because CI builds
 * from the repo and cannot re-download it. Every field that the dump did not
 * actually earn is dropped here rather than cleaned up later in the UI:
 *
 *   - rating / reviewCount are 0 on all 18,812 records. A zero published as a
 *     rating is a fake rating, so the keys go, and the gate in check-data.mjs
 *     would fail the build if they ever came back.
 *   - tagline / description are the same template sentence for every record, so
 *     the site composes that sentence from fields that do differ (the OSM
 *     subcategory and the area name) instead of shipping boilerplate.
 *   - research.socials holds Facebook/Instagram links, research.closed and
 *     prominenceScore are our own guesses, and the Google/Bing map links imply a
 *     partnership. None of it is OpenStreetMap saying something about a place,
 *     so none of it ships.
 *
 * Usage: node .tools/build-open-records.mjs
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, mkdtempSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const SRC = 'Karachify Research/data/by-category';
const OUT = 'public/data/tier';
const failures = [];
const fail = (m) => failures.push(m);

/** Total bytes of the files under `dir` that `keep` accepts, walking sub-directories. */
function filesUnder(dir, keep) {
  if (!existsSync(dir)) return 0;
  let n = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const at = join(dir, entry.name);
    if (entry.isDirectory()) n += filesUnder(at, keep);
    else if (keep(at.replace(/\\/g, '/'))) n += readFileSync(at).length;
  }
  return n;
}

const b = await build({
  stdin: {
    contents:
      "export { categories, areas } from './taxonomy';\n" +
      "export { listings } from './listings';\n" +
      "export { alreadyChecked, checkedKeys } from '../lib/openDedupe';",
    resolveDir: join(process.cwd(), 'src/data'),
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  write: false,
  logLevel: 'silent',
});
mkdirSync(join(process.cwd(), '.tmp'), { recursive: true });
const tmp = mkdtempSync(join(process.cwd(), '.tmp', 'openrec-'));
writeFileSync(join(tmp, 't.mjs'), b.outputFiles[0].text);
const { categories, areas, listings, alreadyChecked, checkedKeys } = await import(pathToFileURL(join(tmp, 't.mjs')).href);
const categoryIds = new Set(categories.map((c) => c.id));
const areaIds = new Set(areas.map((a) => a.id));
/* The same rule the browser uses, so "N more, unchecked" on a tile is the number
   of rows that page actually lists once the checked duplicates are removed. */
const checkedKeysOfSite = checkedKeys(listings);

/** Fields the dump can justify: what the mapper recorded, and where to check it. */
function clean(r) {
  const out = {
    slug: r.slug,
    name: r.name,
    categoryId: r.categoryId,
    areaId: r.areaId,
    address: r.address,
    lat: r.lat,
    lng: r.lng,
    sourceUrl: r.sourceUrl,
    tags: Array.isArray(r.tags) ? r.tags.slice(0, 8) : [],
    createdAt: r.createdAt,
  };
  if (r.phone) out.phone = r.phone;
  if (r.website) out.website = r.website;
  if (r.email) out.email = r.email;
  if (r.hours?.length) out.hours = r.hours.map((h) => ({ day: h.day, open: h.open }));
  if (r.facilities?.length) out.facilities = r.facilities.slice(0, 10);
  const sub = r.research?.subcategory;
  if (sub) out.subcategory = sub;
  const src0 = r.research?.sources?.[0];
  if (src0?.retrievedAt) out.retrievedAt = src0.retrievedAt;
  if (src0?.license) out.licence = src0.license;
  if (r.research?.wikipedia) out.wikipedia = r.research.wikipedia;
  if (r.research?.wikidata) out.wikidata = r.research.wikidata;
  return out;
}

const perCategory = new Map();
let total = 0;
let droppedRatings = 0;

for (const file of readdirSync(SRC).filter((f) => f.endsWith('.json')).sort()) {
  const rows = JSON.parse(readFileSync(join(SRC, file), 'utf8'));
  const id = file.replace(/\.json$/, '');
  if (!categoryIds.has(id)) fail(`${file}: category "${id}" is not in src/data/taxonomy.ts`);
  const kept = [];
  for (const r of rows) {
    if (!r.sourceUrl) fail(`${r.slug}: no sourceUrl, cannot be published`);
    if (!Number.isFinite(r.lat) || !Number.isFinite(r.lng)) fail(`${r.slug}: coordinates ${r.lat}/${r.lng}`);
    else if (Math.abs(r.lat - 24.86) > 1.2 || Math.abs(r.lng - 67.01) > 1.2) fail(`${r.slug}: ${r.lat},${r.lng} is not Karachi`);
    if (!areaIds.has(r.areaId)) fail(`${r.slug}: area "${r.areaId}" is not in the taxonomy`);
    const row = clean(r);
    if ('rating' in row || 'reviewCount' in row) fail(`${r.slug}: a rating survived the clean pass`);
    if (r.rating != null || r.reviewCount != null) droppedRatings++;
    kept.push(row);
  }
  kept.sort((a, b2) => a.name.localeCompare(b2.name) || a.slug.localeCompare(b2.slug));
  perCategory.set(id, kept);
  total += kept.length;
}

/* Duplicate slugs would make two records share one page. The route carries the
   category, so a clash is only a problem inside a single category file. */
for (const [id, kept] of perCategory) {
  const seen = new Set();
  for (const r of kept) {
    if (seen.has(r.slug)) fail(`${id}/${r.slug}: duplicate slug inside one category`);
    seen.add(r.slug);
  }
}

if (failures.length) {
  console.error('Open-records build failed:');
  for (const f of failures.slice(0, 25)) console.error('  - ' + f);
  if (failures.length > 25) console.error(`  … and ${failures.length - 25} more`);
  process.exit(1);
}

rmSync(join(tmp), { recursive: true, force: true });
/* Nothing in public/data/tier is hand-written — every file is produced here — so
   the directory is rebuilt from scratch. This is also what retires the old
   one-file-per-category layout rather than leaving it beside the parts. */
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
mkdirSync(join(OUT, 'parts'), { recursive: true });

const retrievedDates = new Set();
for (const kept of perCategory.values()) for (const r of kept) if (r.retrievedAt) retrievedDates.add(r.retrievedAt);

const summary = {
  note: 'Generated by .tools/build-open-records.mjs from the local OpenStreetMap research dump. Do not edit by hand.',
  licence: 'OpenStreetMap contributors, ODbL 1.0',
  retrievedAt: [...retrievedDates].sort().join(', '),
  total,
  /* Map records for a place that already has a checked page. Published as a number
     because the tiles below leave them out, and a total that did not mention them
     would look like a mistake. */
  alreadyChecked: [...perCategory.values()].reduce((n, kept) => n + kept.filter((r) => alreadyChecked(r, checkedKeysOfSite)).length, 0),
  categories: [...perCategory.entries()]
    .map(([id, kept]) => {
      const survivors = kept.filter((r) => !alreadyChecked(r, checkedKeysOfSite));
      const byArea = {};
      for (const r of survivors) byArea[r.areaId] = (byArea[r.areaId] ?? 0) + 1;
      return {
        id,
        count: kept.length,
        unchecked: survivors.length,
        areas: byArea,
        withContact: survivors.filter((r) => r.phone || r.website || r.email).length,
        withHours: survivors.filter((r) => r.hours).length,
      };
    })
    .sort((a, b2) => b2.count - a.count),
  areas: (() => {
    const t = {};
    for (const kept of perCategory.values())
      for (const r of kept) if (!alreadyChecked(r, checkedKeysOfSite)) t[r.areaId] = (t[r.areaId] ?? 0) + 1;
    return Object.entries(t).map(([id, count]) => ({ id, count })).sort((a, b2) => b2.count - a.count);
  })(),
};

writeFileSync(join(OUT, 'index.json'), JSON.stringify(summary));

/* A record page used to fetch its whole category to read one record: 1.9 MB for
   one restaurant out of a 4,581-record file. So the category IS the parts: every
   record is written once, under parts/<category>/ in slug order, 200 to a file,
   with a boundary index beside them listing the first and last slug of each
   part. A record page then reads a ~2 KB index and one ~90 KB part; the map and
   directory layer reads the same parts in parallel and gets the same bytes it
   fetched before in one file. There is no second copy to drift out of date.
     The sort is by code point, not localeCompare, and openRecords.ts searches
   with the same `<`/`>` — a locale-aware order would place "a-b" where that
   binary search cannot look. */
const PART_SIZE = 200;
const PARTS = join(OUT, 'parts');
const byCodePoint = (a, b2) => (a < b2 ? -1 : a > b2 ? 1 : 0);
let partFiles = 0;
for (const [id, kept] of perCategory) {
  const dir = join(PARTS, id);
  mkdirSync(dir, { recursive: true });
  const bySlug = [...kept].sort((a, b2) => byCodePoint(a.slug, b2.slug));
  const parts = [];
  for (let i = 0; i < bySlug.length; i += PART_SIZE) {
    const slice = bySlug.slice(i, i + PART_SIZE);
    const key = String(parts.length + 1).padStart(3, '0');
    writeFileSync(join(dir, `${key}.json`), JSON.stringify({ id, count: slice.length, records: slice }));
    parts.push({ from: slice[0].slug, to: slice[slice.length - 1].slug, n: slice.length });
    partFiles++;
  }
  writeFileSync(join(PARTS, `${id}.json`), JSON.stringify({ id, size: PART_SIZE, count: bySlug.length, parts }));
}

const bytes = filesUnder(OUT, (f) => f.endsWith('.json'));
console.log(
  `open records: ${total} across ${perCategory.size} categories → ${(bytes / 1048576).toFixed(2)} MB in ${OUT}` +
    ` as ${partFiles} parts of ${PART_SIZE} + ${perCategory.size} boundary indexes` +
    ` (dropped a placeholder rating/review count from ${droppedRatings} records)`
);
