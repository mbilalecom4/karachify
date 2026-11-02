/**
 * Turn the research handoff into something the site can actually ship.
 *
 *   node .tools/build-research-index.mjs           // report only
 *   node .tools/build-research-index.mjs --write   // write public/data/research-index.json
 *
 * The handoff is 18,812 full Listing-shaped records (~35 MB). Bundling that is
 * not an option, and three of its fields would break our honesty rules if they
 * went through untouched:
 *
 *   - `rating` and `reviewCount` are present on every record as `0`. On this
 *     site an absent rating means "we have no rating"; a zero means "this place
 *     is rated zero". Both are dropped here rather than normalised later.
 *   - `tagline` and `description` are template sentences ("X is a art culture
 *     in Y"), so they are not copy and are not carried over.
 *   - `research.closed` records are skipped: a closed pin should not advertise
 *     a place as findable.
 *
 * What survives is what a directory row genuinely needs — name, position, the
 * contact fields that are actually filled — plus the source link, because the
 * whole set is OpenStreetMap data under ODbL and has to travel with its
 * attribution.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'Karachify Research', 'data', 'karachify-dataset.json');
const OUT = join(root, 'public', 'data', 'research-index.json');
const WRITE = process.argv.includes('--write');

if (!existsSync(SRC)) {
  console.error(`No dataset at ${SRC}`);
  process.exit(1);
}

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Slugs and names of places we already curate, so the index cannot duplicate them. */
function curatedKeys() {
  const dir = join(root, 'src', 'data', 'listings');
  const keys = new Set();
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.ts') || file === 'index.ts') continue;
    const txt = readFileSync(join(dir, file), 'utf8');
    for (const m of txt.matchAll(/\bslug:\s*'([^']+)'/g)) keys.add(m[1]);
    for (const m of txt.matchAll(/\bname:\s*'([^']+)'/g)) keys.add(norm(m[1]));
  }
  return keys;
}

const curated = curatedKeys();
const rows = JSON.parse(readFileSync(SRC, 'utf8'));
const list = Array.isArray(rows) ? rows : rows.listings || rows.records || rows.data;

const kept = [];
const dropped = { closed: 0, duplicate: 0, unnamed: 0 };
let withPhone = 0;
let withSite = 0;
let withHours = 0;

for (const r of list) {
  if (!r.name || !r.slug) {
    dropped.unnamed++;
    continue;
  }
  if (r.research && r.research.closed) {
    dropped.closed++;
    continue;
  }
  if (curated.has(r.slug) || curated.has(norm(r.name))) {
    dropped.duplicate++;
    continue;
  }
  const hours = (r.research && r.research.openingHoursRaw) || null;
  if (r.phone) withPhone++;
  if (r.website) withSite++;
  if (hours) withHours++;
  kept.push({
    s: r.slug,
    n: r.name,
    c: r.categoryId,
    a: r.areaId,
    la: Number(r.lat).toFixed(5),
    ln: Number(r.lng).toFixed(5),
    ad: r.address || null,
    p: r.phone || null,
    w: r.website || null,
    h: hours,
    u: r.sourceUrl || (r.research && r.research.mapLinks && r.research.mapLinks.osm) || null,
  });
}

/* Richest rows first, so a category's opening screen shows the places we know
   the most about rather than whatever order the extractor happened to emit. */
const weight = (x) => (x.p ? 3 : 0) + (x.w ? 3 : 0) + (x.h ? 2 : 0) + (x.ad ? 1 : 0);
kept.sort((a, b) => weight(b) - weight(a) || a.n.localeCompare(b.n));

const payload = {
  generatedAt: new Date().toISOString().slice(0, 10),
  license: '© OpenStreetMap contributors',
  licenseKind: 'ODbL 1.0',
  notice: 'Discovered from OpenStreetMap. Names, positions and contact fields are not independently checked, so nothing here carries a rating, a review count or a written description.',
  count: kept.length,
  places: kept,
};

const json = JSON.stringify(payload);
const bytes = Buffer.byteLength(json);

console.log(`source records       ${list.length}`);
console.log(`dropped              ${JSON.stringify(dropped)}`);
console.log(`kept                 ${kept.length}`);
console.log(`  with phone         ${withPhone}`);
console.log(`  with website       ${withSite}`);
console.log(`  with opening hours ${withHours}`);
console.log(`payload              ${(bytes / 1024 / 1024).toFixed(2)} MB uncompressed`);

if (WRITE) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, json);
  console.log(`wrote ${OUT}`);
} else {
  console.log('report only — pass --write to emit public/data/research-index.json');
}
