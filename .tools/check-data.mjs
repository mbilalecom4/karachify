#!/usr/bin/env node
// The no-fabrication gate. Karachify's whole claim is that it publishes nothing
// it cannot cite, so that claim is checked against the shipped data on every
// build — a violation fails the build rather than reaching the site.
//
// The data lives in TypeScript, so it is bundled with the esbuild that Vite
// already ships and imported from there: this checks the same objects the app
// renders, not a re-reading of the source files.
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve('.');
const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
  return ok;
};

const bundle = await build({
  stdin: {
    contents: `
      export { listings } from './listings';
      export { events } from './events';
      export { categories, areas, city } from './taxonomy';
      export { alreadyChecked, checkedKeys } from '../lib/openDedupe';
    `,
    resolveDir: join(root, 'src/data'),
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  write: false,
  logLevel: 'silent',
});

const dir = mkdtempSync(join(tmpdir(), 'karachify-check-'));
const file = join(dir, 'data.mjs');
writeFileSync(file, bundle.outputFiles[0].text);
const { listings, events, categories, areas, city, alreadyChecked, checkedKeys } = await import(`file:///${file.replace(/\\/g, '/')}`);

const overrides = JSON.parse(await readText('src/data/verified-overrides.json'));
const provenance = JSON.parse(await readText('src/data/provenance.json'));
const media = JSON.parse(await readText('src/data/media.json'));

async function readText(rel) {
  const { readFileSync } = await import('node:fs');
  return readFileSync(join(root, rel), 'utf8');
}

const categoryIds = new Set(categories.map((c) => c.id));
const areaIds = new Set(areas.map((a) => a.id));
const bySlug = new Map(listings.map((l) => [l.slug, l]));

/* ------------------------- 1. nothing invented -------------------------- */

check(events.length === 0, `events.ts ships ${events.length} seeded event(s); the board stays empty until a dated source names one`);

for (const l of listings) {
  const at = `${l.slug} (${l.name})`;

  if (l.rating != null) failures.push(`${at}: carries rating ${l.rating} — no rating is published without a source that states it`);
  if (l.reviewCount != null) failures.push(`${at}: carries reviewCount ${l.reviewCount} — visitor counts and review totals are never generated`);

  if (l.hours?.length && !l.sourceUrl) failures.push(`${at}: ${l.hours.length} opening-hours row(s) with no sourceUrl`);
  if (l.entryFees?.length) {
    if (!l.sourceUrl) failures.push(`${at}: admission prices with no sourceUrl`);
    for (const f of l.entryFees) {
      if (!Number.isFinite(f.amount) || f.amount < 0) failures.push(`${at}: admission "${f.label}" has amount ${f.amount}`);
      if (!['official', 'press'].includes(f.basis)) failures.push(`${at}: admission "${f.label}" has basis "${f.basis}" — must be official or press`);
    }
  }
  if ((l.phone || l.email || l.website) && !l.sourceUrl) {
    failures.push(`${at}: publishes contact details (${[l.phone && 'phone', l.email && 'email', l.website && 'website'].filter(Boolean).join(', ')}) with no sourceUrl`);
  }

  // Round-the-clock availability is the claim a reader is most likely to act on
  // at 3am, so it is the one field a record cannot state without a source —
  // not in an hours row, a facility chip, a tag or the prose either.
  const alwaysOpen = /\b(24\s*\/\s*7|24[\s-]?hours?\b|round[\s-]the[\s-]clock|around[\s-]the[\s-]clock|open\s+all\s+night)\b/i.exec(
    [...(l.hours ?? []).map((h) => `${h.day} ${h.open}`), ...(l.facilities ?? []), ...(l.tags ?? []), l.description ?? '', l.tagline ?? '', l.entryConditions ?? ''].join(' | ')
  );
  if (alwaysOpen && !l.sourceUrl) {
    failures.push(`${at}: states "${alwaysOpen[0]}" availability with no sourceUrl`);
  }

  // "No official hours found" is a research finding, not a visitor rule.
  if (/^\s*(no|not|none)\b/i.test(l.entryConditions ?? '')) {
    failures.push(`${at}: entryConditions states an absence instead of a rule — "${String(l.entryConditions).slice(0, 60)}…"`);
  }

  if (l.coordsVerified) {
    if (!l.osmId) failures.push(`${at}: coordsVerified without an osmId to cite`);
    if (!l.sourceUrl || !l.lastVerified) failures.push(`${at}: coordsVerified without sourceUrl + lastVerified`);
  }
  if (l.status === 'verified' && !(l.sourceUrl && l.lastVerified)) {
    failures.push(`${at}: badged verified without a source and a check date`);
  }
  // A check date is the strongest claim a record makes: it may only arrive with
  // the citation that was checked, which means through the generated overrides.
  if (l.lastVerified && !provenance.records[l.slug]) {
    failures.push(`${at}: lastVerified ${l.lastVerified} with no provenance record — a date typed into a seed file is not a verification`);
  }

  const demoish = [l.name, l.tagline, l.description, l.address, ...(l.tags ?? []), ...(l.facilities ?? []), ...(l.hours ?? []).map((h) => `${h.day} ${h.open}`), l.entryConditions ?? '']
    .join(' \u0001 ');
  const marker = /\b(demo|dummy|placeholder|lorem ipsum|sample record|test record|tbd|n\/a)\b/i.exec(demoish);
  if (marker) failures.push(`${at}: contains the placeholder marker "${marker[0]}"`);

  if (!/^[a-z0-9][a-z0-9-]*$/.test(l.slug)) failures.push(`${at}: slug "${l.slug}" is not URL-safe`);
  if (!categoryIds.has(l.categoryId)) failures.push(`${at}: categoryId "${l.categoryId}" is not in the taxonomy`);
  if (!areaIds.has(l.areaId)) failures.push(`${at}: areaId "${l.areaId}" is not in the taxonomy`);
  if (l.cityId !== city.id) failures.push(`${at}: cityId "${l.cityId}" is not ${city.id}`);
  if (!(Number.isFinite(l.lat) && Number.isFinite(l.lng))) failures.push(`${at}: coordinates ${l.lat},${l.lng} are not numbers`);
  else if (!(l.lat > 23.5 && l.lat < 26.5 && l.lng > 66.0 && l.lng < 68.7)) {
    failures.push(`${at}: coordinates ${l.lat},${l.lng} fall outside the Karachi bounding box`);
  }
}

const slugs = listings.map((l) => l.slug);
const ids = listings.map((l) => l.id);
for (const dup of new Set(slugs.filter((s, i) => slugs.indexOf(s) !== i))) failures.push(`duplicate slug "${dup}" — two records would share one URL`);
for (const dup of new Set(ids.filter((s, i) => ids.indexOf(s) !== i))) failures.push(`duplicate id "${dup}"`);

/* --------------------- 2. the provenance trail holds -------------------- */

for (const path of overrides.generatedFrom) {
  check(existsSync(join(root, path)), `verified-overrides.json cites ${path}, which does not exist`);
}
for (const slug of Object.keys(overrides.overrides)) {
  check(bySlug.has(slug), `verified-overrides.json overrides "${slug}", which is not in the catalogue`);
}
for (const slug of Object.keys(provenance.records)) {
  check(bySlug.has(slug), `provenance.json describes "${slug}", which is not in the catalogue`);
}
const sameKeys = JSON.stringify(Object.keys(overrides.overrides).sort()) === JSON.stringify(Object.keys(provenance.records).sort());
check(sameKeys, 'provenance.json and verified-overrides.json cover different slugs — the audit trail is out of step with the data');

const KNOWN_FIELDS = new Set([
  'lat', 'lng', 'osmId', 'osmName', 'name', 'coordinates', 'address', 'website', 'hours', 'ticketPrices', 'entryFees',
  'entryConditions', 'contact', 'phone', 'email', 'description', 'photo', 'facilities', 'accessibility',
  'familySuitability', 'sourceUrl', 'lastVerified',
]);

for (const [slug, p] of Object.entries(provenance.records)) {
  const listing = bySlug.get(slug);
  if (!listing) continue;
  for (const s of p.sources) {
    let url;
    try {
      url = new URL(s.url);
    } catch {
      failures.push(`${slug}: citation "${String(s.url).slice(0, 60)}" is not an absolute URL`);
      continue;
    }
    if (!/^https:$/.test(url.protocol)) failures.push(`${slug}: citation ${s.url} is not https`);
    for (const t of s.supports) {
      if (!KNOWN_FIELDS.has(t)) failures.push(`${slug}: citation claims to support unknown field "${t}"`);
    }
  }
  // `published` is a statement about the live record, so it must match it.
  for (const f of p.published) {
    const present =
      f === 'entryFees' ? listing.entryFees?.length > 0 : f === 'sourceUrl' ? Boolean(listing.sourceUrl) : Boolean(listing[f]);
    if (!present) failures.push(`${slug}: provenance says "${f}" is published from a source, but the record does not carry it`);
  }
  for (const f of p.notFound) {
    if (!KNOWN_FIELDS.has(f)) failures.push(`${slug}: notFound names unknown field "${f}"`);
    if (f === 'hours' && listing.hours?.length) failures.push(`${slug}: provenance says no source for hours, yet hours are published`);
    if (f === 'ticketPrices' && listing.entryFees?.length) failures.push(`${slug}: provenance says no source for prices, yet prices are published`);
    if (f === 'contact' && (listing.phone || listing.email)) failures.push(`${slug}: provenance says no source for contact, yet a contact is published`);
    if (f === 'website' && listing.website) failures.push(`${slug}: provenance says no source for website, yet one is published`);
  }
}

for (const e of provenance.exclusions) {
  check(bySlug.has(e.slug), `exclusion names "${e.slug}", which is not in the catalogue`);
  const listing = bySlug.get(e.slug);
  if (listing && e.field === 'entryFees' && listing.entryFees?.length) {
    failures.push(`${e.slug}: excluded as unpublished admission prices, yet prices are on the record`);
  }
  if (listing && e.field === 'entryConditions' && listing.entryConditions) {
    failures.push(`${e.slug}: excluded as unpublished visitor rules, yet rules are on the record`);
  }
}

/* ---------------------- 3. licence discipline for art -------------------- */

const IMAGE_HOSTS = /(wikimedia\.org|wikivoyage\.org|wikipedia\.org)$/;
for (const [key, m] of Object.entries(media)) {
  for (const field of ['thumb', 'wide']) {
    if (!m[field]) continue;
    let host;
    try {
      host = new URL(m[field]).host;
    } catch {
      failures.push(`media ${key}: ${field} "${m[field]}" is not an absolute URL`);
      continue;
    }
    if (!IMAGE_HOSTS.test(host)) failures.push(`media ${key}: ${field} is hotlinked from ${host}, which is not a Wikimedia project`);
  }
  if (m.filePage && !m.filePage.startsWith('https://commons.wikimedia.org/wiki/File:')) {
    failures.push(`media ${key}: file page ${m.filePage} is not a Commons file page`);
  }
  if (m.kind !== 'related' && !m.artist && !m.filePage) {
    failures.push(`media ${key}: depicts its subject under an attribution licence but credits neither an author nor a file page to read it from`);
  }
  if (m.kind !== 'related' && !m.license) failures.push(`media ${key}: depicts its subject but states no licence`);
}

/* ------------------- 4. the open-records tier stays honest ------------------- */

/* The tier is not compiled into the bundle, so the loop above cannot see it. It
   is 18,812 records nobody at Karachify has checked, which is exactly the kind
   of data a fabricated field hides inside — so it is read from disk and held to
   the same rules. */

const TIER = join(root, 'public/data/tier');
let tierCount = 0;
if (existsSync(TIER)) {
  const summary = JSON.parse(readFileSync(join(TIER, 'index.json'), 'utf8'));
  /* The tiles on Home and Explore quote these numbers, so they are recomputed
     here with the same rule the browser applies. A count that drifts from the
     list behind it is a claim no source supports. */
  const siteKeys = checkedKeys(listings);
  let uncheckedTotal = 0;
  const files = readdirSync(TIER).filter((f) => f.endsWith('.json') && f !== 'index.json');
  check(
    files.length === summary.categories.length,
    `tier: index.json describes ${summary.categories.length} categories but ${files.length} files are shipped`
  );
  let seenSlugs = 0;
  for (const row of summary.categories) {
    const file = join(TIER, `${row.id}.json`);
    if (!check(existsSync(file), `tier: category "${row.id}" is counted in index.json but its file is missing`)) continue;
    const chunk = JSON.parse(readFileSync(file, 'utf8'));
    check(chunk.count === chunk.records.length, `tier/${row.id}: index says ${row.count}, count field ${chunk.count}, file holds ${chunk.records.length}`);
    check(chunk.id === row.id, `tier/${row.id}: the file declares itself "${chunk.id}"`);
    const inner = new Set();
    for (const r of chunk.records) {
      const at = `tier/${row.id}/${r.slug}`;
      seenSlugs++;
      if (inner.has(r.slug)) failures.push(`${at}: duplicate slug inside one category`);
      inner.add(r.slug);
      for (const banned of ['rating', 'reviewCount', 'tagline', 'description', 'featured', 'promoted', 'priceRange', 'lastVerified']) {
        if (r[banned] !== undefined) failures.push(`${at}: carries "${banned}", which no source supplied for an unchecked record`);
      }
      if (!/^[a-z0-9][a-z0-9-]*$/.test(r.slug)) failures.push(`${at}: slug is not URL-safe`);
      if (!categoryIds.has(r.categoryId)) failures.push(`${at}: categoryId "${r.categoryId}" is not in the taxonomy`);
      if (!areaIds.has(r.areaId)) failures.push(`${at}: areaId "${r.areaId}" is not in the taxonomy`);
      if (!r.sourceUrl) failures.push(`${at}: published with no sourceUrl — an unchecked record must still say where it came from`);
      else {
        let u;
        try {
          u = new URL(r.sourceUrl);
        } catch {
          failures.push(`${at}: sourceUrl "${String(r.sourceUrl).slice(0, 60)}" is not absolute`);
        }
        if (u && u.protocol !== 'https:') failures.push(`${at}: sourceUrl ${r.sourceUrl} is not https`);
        if (u && !/(openstreetmap\.org|wikipedia\.org|wikimedia\.org)$/.test(u.host))
          failures.push(`${at}: cites ${u.host}, which is not a source this project is licensed to republish`);
      }
      if (!(Number.isFinite(r.lat) && Number.isFinite(r.lng))) failures.push(`${at}: coordinates ${r.lat},${r.lng} are not numbers`);
      else if (!(r.lat > 23.5 && r.lat < 26.5 && r.lng > 66.0 && r.lng < 68.7)) {
        failures.push(`${at}: coordinates ${r.lat},${r.lng} fall outside the Karachi bounding box`);
      }
      if (r.hours?.some((h) => !h.day || !h.open)) failures.push(`${at}: an opening-hours row is missing its day or its time`);
      if (!r.name || /^unnamed\b/i.test(r.name.trim())) failures.push(`${at}: has no name to list — a map feature nobody named is not a directory record`);
      /* "Unnamed Road" is what a reverse geocode returns for an unlit lane, and it
         is the map's own words, so it is not a placeholder marker here. */
      const marker = /\b(demo|dummy|lorem ipsum|test record|sample record|tbd|n\/a)\b/i.exec([r.name, r.address, ...(r.tags ?? [])].join(' '));
      if (marker) failures.push(`${at}: contains the placeholder marker "${marker[0]}"`);
    }
    const survivors = chunk.records.filter((r) => !alreadyChecked(r, siteKeys));
    uncheckedTotal += survivors.length;
    check(
      row.unchecked === survivors.length,
      `tier/${row.id}: index.json says ${row.unchecked} unchecked but the checked pages leave ${survivors.length}`
    );
    check(
      row.withContact === survivors.filter((r) => r.phone || r.website || r.email).length,
      `tier/${row.id}: index.json says ${row.withContact} with a contact but ${survivors.filter((r) => r.phone || r.website || r.email).length} of the listed records have one`
    );
  }
  check(seenSlugs === summary.total, `tier: index.json totals ${summary.total} but the files hold ${seenSlugs}`);
  check(
    summary.alreadyChecked === seenSlugs - uncheckedTotal,
    `tier: index.json hides ${summary.alreadyChecked} records as copies of a checked page but ${seenSlugs - uncheckedTotal} match one`
  );
  tierCount = seenSlugs;
}

/* ------------------------- the source, not just the data ------------------ */
/* Two mistakes this site has already made are cheap to make permanent:
   publishing a date the code invented, and linking a category slug that the
   taxonomy does not have. Both are lintable, so they are gated here rather
   than left to whoever notices next. */
{
  const knownCategorySlugs = new Set(categories.map((c) => c.slug));
  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []
    );
  for (const file of walk(join(root, 'src'))) {
    const rel = file.slice(root.length + 1).replace(/\\/g, '/');
    const text = readFileSync(file, 'utf8');
    text.split('\n').forEach((line, i) => {
      if (/Date\.now\(\s*[+*-]\s*\d/.test(line) && !/^\s*(\/\/|\*|\/\*)/.test(line))
        failures.push(`${rel}:${i + 1}: adds or subtracts from the clock — a date this site invents is a fabricated field`);
      const link = /\/category\/([a-z0-9-]+)/.exec(line);
      if (link && !knownCategorySlugs.has(link[1]))
        failures.push(`${rel}:${i + 1}: links to /category/${link[1]}, which is not in the taxonomy`);
    });
  }
}

/* -------------------------------- report -------------------------------- */

if (failures.length) {
  console.error(`\n✗ check-data: ${failures.length} problem(s) in ${listings.length} listings + ${tierCount} open records\n`);
  for (const f of failures.slice(0, 60)) console.error(`  · ${f}`);
  if (failures.length > 60) console.error(`  … and ${failures.length - 60} more`);
  process.exit(1);
}

const sourced = listings.filter((l) => l.sourceUrl).length;
console.log(
  `✓ check-data: ${listings.length} listings (${sourced} with a named source), ${events.length} seeded events, ` +
    `${Object.keys(provenance.records).length} audited records, ${Object.keys(media).length} credited images, ` +
    `${tierCount} open records all citing OpenStreetMap — no fabricated fields found`
);
