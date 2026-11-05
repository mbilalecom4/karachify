#!/usr/bin/env node
/**
 * Cut the per-area opening-hours file the area pages read.
 *
 * Why a file instead of the live records: an area page loads the checked pages
 * from the bundle and nothing of the 18,812-row map tier, which arrives one
 * category at a time. Counting "how many of these are open right now" would
 * therefore have to fetch all forty categories, and a figure assembled from
 * whatever happened to load is not a figure at all. So the counts are cut here,
 * from the same two sources the pages already publish, and shipped as one small
 * JSON the area page can fetch in full.
 *
 * What earns a row:
 *   - a map record whose hours came from OpenStreetMap and whose OSM element link
 *     is intact, so the reader can open the tag that says it;
 *   - a checked page whose OWN citation lists "hours" in `supports`. Hours on a
 *     checked page with no hours citation are dropped, not counted, and the
 *     number dropped is published so the page can say so.
 *
 * Nothing is added: no invented schedule, no "probably open". A row carries the
 * source's own words, and src/lib/hoursRead.ts refuses to guess at a shape it
 * cannot read.
 *
 * Usage: node .tools/build-area-hours.mjs
 */
import { build } from 'esbuild';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const OUT = join(root, 'public', 'data', 'hours-by-area.json');
const failures = [];
const fail = (m) => failures.push(m);

/* ------------------------------- the curated half ------------------------------ */

const bundled = await build({
  stdin: {
    contents:
      "export { areas, categories } from './taxonomy';\n" +
      "export { listings } from './listings';\n" +
      "export { alreadyChecked, checkedKeys } from '../lib/openDedupe';",
    resolveDir: join(root, 'src', 'data'),
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  write: false,
  logLevel: 'silent',
});
mkdirSync(join(root, '.tmp'), { recursive: true });
const tmp = mkdtempSync(join(root, '.tmp', 'areahours-'));
const moduleFile = join(tmp, 't.mjs');
writeFileSync(moduleFile, bundled.outputFiles[0].text);
const { areas, categories, listings, alreadyChecked, checkedKeys } = await import(pathToFileURL(moduleFile).href);

const provenance = JSON.parse(readFileSync(join(root, 'src', 'data', 'provenance.json'), 'utf8')).records;
const hoursCited = (slug) => (provenance[slug]?.sources ?? []).filter((c) => c.supports?.includes('hours'));

/* --------------------------------- the map half -------------------------------- */

const tierDir = join(root, 'public', 'data', 'tier', 'parts');
if (!existsSync(tierDir)) fail(`${tierDir} is missing — run npm run build:open first`);
const tierIndex = existsSync(join(root, 'public', 'data', 'tier', 'index.json'))
  ? JSON.parse(readFileSync(join(root, 'public', 'data', 'tier', 'index.json'), 'utf8'))
  : null;
if (!tierIndex) fail('public/data/tier/index.json is missing — run npm run build:open first');

const rowsOf = (file) => {
  const j = JSON.parse(readFileSync(file, 'utf8'));
  return Array.isArray(j) ? j : (j.records ?? []);
};

const tierRows = [];
if (existsSync(tierDir)) {
  for (const entry of readdirSync(tierDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    for (const part of readdirSync(join(tierDir, entry.name))) {
      for (const r of rowsOf(join(tierDir, entry.name, part))) tierRows.push(r);
    }
  }
}

/* A map record a checked page already covers is hidden from every list, so it
   must not be counted here either — otherwise an area would claim a place twice. */
const checkedKeysOfSite = checkedKeys(listings);
const mapRows = tierRows.filter((r) => !alreadyChecked(r, checkedKeysOfSite));

const areaIds = new Set(areas.map((a) => a.id));
const categoryIds = new Set(categories.map((c) => c.id));
const OSM_ELEMENT = /^https:\/\/www\.openstreetmap\.org\/(node|way|relation)\/\d+$/;

const byArea = new Map();
const push = (areaId, row) => {
  if (!byArea.has(areaId)) byArea.set(areaId, []);
  byArea.get(areaId).push(row);
};

let droppedNoSource = 0;
const dates = new Set();

for (const l of listings) {
  if (!l.hours?.length) continue;
  if (!areaIds.has(l.areaId)) fail(`checked page ${l.slug}: areaId "${l.areaId}" is not a known area`);
  const cites = hoursCited(l.slug);
  if (!cites.length) {
    droppedNoSource += 1;
    continue;
  }
  const url = cites[0].url;
  if (!/^https?:\/\//.test(url)) fail(`checked page ${l.slug}: its hours citation is not a URL (${url})`);
  push(l.areaId, {
    name: l.name,
    path: `/place/${l.slug}`,
    categoryId: l.categoryId,
    hours: l.hours.map((h) => ({ day: h.day, open: h.open })),
    sourceUrl: url,
    statedOn: l.lastVerified ?? null,
    tier: 'checked',
  });
}

for (const r of mapRows) {
  if (!r.hours?.length) continue;
  if (!areaIds.has(r.areaId)) fail(`map record ${r.slug}: areaId "${r.areaId}" is not a known area`);
  if (!categoryIds.has(r.categoryId)) fail(`map record ${r.slug}: categoryId "${r.categoryId}" is not in the taxonomy`);
  if (!OSM_ELEMENT.test(r.sourceUrl ?? ''))
    fail(`map record ${r.slug}: states hours but carries no OpenStreetMap element link to check them on (${r.sourceUrl})`);
  if (!r.retrievedAt) fail(`map record ${r.slug}: states hours with no date it was read`);
  else dates.add(r.retrievedAt);
  push(r.areaId, {
    name: r.name,
    path: `/directory/${r.categoryId}/${r.slug}`,
    categoryId: r.categoryId,
    hours: r.hours.map((h) => ({ day: h.day, open: h.open })),
    sourceUrl: r.sourceUrl,
    statedOn: r.retrievedAt,
    tier: 'map',
  });
}

if (dates.size > 1) fail(`the map hours were read on more than one day (${[...dates].join(', ')}); rebuild the tier so the file dates itself honestly`);
if (tierIndex && dates.size === 1 && [...dates][0] !== tierIndex.retrievedAt)
  fail(`map hours read ${[...dates][0]} but tier index says ${tierIndex.retrievedAt}`);

/* Every record the area page can show, so "N of M" uses a real denominator
   rather than the number this file happens to cover. */
const totals = {};
for (const a of areas) {
  const checked = listings.filter((l) => l.areaId === a.id).length;
  const map = mapRows.filter((r) => r.areaId === a.id).length;
  totals[a.id] = checked + map;
}

for (const [areaId, rows] of byArea) {
  if (!areaIds.has(areaId)) fail(`hours file would carry area "${areaId}", which the taxonomy does not have`);
  if (!totals[areaId]) fail(`area ${areaId} carries hours rows but the site shows no records there`);
  rows.sort((x, y) => x.name.localeCompare(y.name));
}

const retrievedAt = tierIndex?.retrievedAt ?? null;
const file = {
  note: 'Generated by .tools/build-area-hours.mjs. One row per Karachi record whose published opening hours name a source: a checked page cites its own source, a map row links to the OpenStreetMap element carrying the tag. Hours this reader cannot parse stay unparsed — see src/lib/hoursRead.ts.',
  licence: 'Map hours: OpenStreetMap contributors, ODbL 1.0. Checked pages: the source cited on each page.',
  retrievedAt,
  areas: Object.fromEntries([...byArea.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
  totals,
  /** Checked pages that show hours no citation backs — excluded, and said so. */
  hoursWithoutSource: droppedNoSource,
};

const bytes = JSON.stringify(file).length;
if (failures.length) {
  console.error(`\n✗ build-area-hours: ${failures.length} problem(s)\n`);
  for (const f of failures.slice(0, 40)) console.error(`  · ${f}`);
  if (failures.length > 40) console.error(`  … and ${failures.length - 40} more`);
  process.exit(1);
}

writeFileSync(OUT, JSON.stringify(file));
const rowCount = [...byArea.values()].reduce((n, rows) => n + rows.length, 0);
console.log(
  `✓ area-hours: ${rowCount} records with sourced hours across ${byArea.size} areas, ` +
    `${droppedNoSource} checked pages state hours with no citation and are excluded, ` +
    `${Math.round(bytes / 1024)} KB${retrievedAt ? ` · map hours read ${retrievedAt}` : ''}`
);
