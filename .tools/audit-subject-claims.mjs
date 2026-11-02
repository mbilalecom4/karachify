#!/usr/bin/env node
// Finds records whose registry entry claims to show the subject itself
// (kind is not 'related') while the Wikimedia file name says otherwise.
//
// entry.subject is written from the record, so comparing it to the record name
// proves nothing. The only evidence of what a picture shows is the file name
// and the article it came from, so that is what this compares.
//
//   node .tools/audit-subject-claims.mjs
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve('.');

const bundle = await build({
  stdin: {
    contents: `
      export { listings } from './listings';
      export { categories, areas } from './taxonomy';
      export { guides } from './guides';
      export { default as media } from './media.json';
    `,
    resolveDir: join(ROOT, 'src/data'),
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  write: false,
  logLevel: 'silent',
});
const tmp = mkdtempSync(join(tmpdir(), 'karachify-claims-'));
const dataFile = join(tmp, 'data.mjs');
writeFileSync(dataFile, bundle.outputFiles[0].text);
const { listings, categories, areas, guides, media } = await import(pathToFileURL(dataFile).href);

const records = new Map();
for (const l of listings) records.set(l.slug, l.name);
for (const c of categories) records.set(`banner-${c.id}`, c.name);
for (const a of areas) records.set(`area-${a.id}`, a.name);
for (const g of guides) records.set(`guide-${g.slug}`, g.title);

const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'de', 'al', 'en', 'in', 'at', 'to', 'karachi', 'sindh', 'pakistan']);
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = (s) => norm(s).split(' ').filter((t) => t.length > 2 && !STOP.has(t));
const fileName = (e) => norm(decodeURIComponent((e.filePage ?? '').split('/File:')[1] ?? '').replace(/\.(jpe?g|png|webp|tiff|gif)$/i, ''));

/* A file supports a record only when *every* distinctive word of the record is
   in the file name, or the file came from an article named after the record.
   "some" is not enough: an Islamabad campus photo whose article is called
   "Bahria University" would otherwise pass for the Karachi campus. */
function supports(entry, name) {
  const need = tokens(name);
  if (!need.length) return true;
  const f = fileName(entry);
  const via = norm(entry.via ?? '');
  return need.every((w) => f.includes(w) || via.includes(w));
}

/* Records checked by hand and found to be correctly photographed, where the
   strict word-match fails only because the Commons file is titled slightly
   differently from the record. Anything else that appears here is a claim to
   investigate, not a false alarm to add a line for. */
const REVIEWED = {
  'bahadurabad-bus-terminal': 'file "Bahadurabad area Karachi City" is the Bahadurabad interchange',
  'data-darbar': 'file "Data Darbar 2" is the Data Darbar shrine complex',
  'hawkes-bay-beach': 'file "HawksBay Beach" is the same beach, spelling differs',
  'karachi-circular-railway': 'file names the Karachi Circular Railway',
  'karachi-expo-centre': 'file "Expocenter Karachi" is the same venue, one word',
  'karachi-zoo': 'file names the Karachi Zoological and Botanical Gardens',
  'ibne-bin-qasim-bagh': 'file names Ibn-e-Qasim Bagh Stadium inside the garden',
  'mazar-gardens': 'file is Mazar-e-Quaid, the garden the record is about',
  'seaview-point': 'file is Seaview, Clifton Beach — the view point itself',
  'masjid-e-tooba': 'file "…Tooba Mosque" is Masjid-e-Tooba; the "(Gol Mahal Masjid)" alias is all the strict match rejects',
  'pakistan-railways-heritage': 'file "Karachi Cantonment railway station" is the station the record names',
};

// Page slots — the hero of a page rather than a photograph of a record. They
// have no catalogue name to match against, so they are listed rather than skipped:
// an entry that matches nothing and is not on this list is a mistake.
const SLOTS = new Set(['hero-karachi', 'hero-karachi-night', 'banner-guides']);

const claims = [];
const unexplained = [];
const nameless = [];
for (const [key, entry] of Object.entries(media)) {
  const name = records.get(key);
  if (entry.kind === 'related') {
    if (!entry.illustrativeReason) unexplained.push(key);
    continue;
  }
  if (!name) {
    if (!SLOTS.has(key)) nameless.push(key);
    continue;
  }
  if (REVIEWED[key]) continue;
  if (!supports(entry, name))
    claims.push({ key, name, file: decodeURIComponent(fileName(entry)), via: entry.via ?? '—' });
}

const subjects = Object.values(media).filter((m) => m.kind !== 'related').length;
console.log(
  `${Object.keys(media).length} registry entries · ${subjects} claim to show the subject itself · ` +
    `${claims.length} of those claim a photograph the file name does not support ` +
    `(${Object.keys(REVIEWED).length} hand-checked passes excluded)`
);
if (unexplained.length)
  console.log(`\n${unexplained.length} marked illustrative with no reason recorded:\n  ${unexplained.join('\n  ')}`);
if (nameless.length)
  console.log(`\n${nameless.length} entries match no catalogue record and are not declared page slots:\n  ${nameless.join('\n  ')}`);
console.log('');
for (const c of claims.sort((a, b) => a.key.localeCompare(b.key)))
  console.log(`  ${c.key}\n      record: ${c.name}\n      file:   ${c.file}\n      via:    ${c.via}`);
