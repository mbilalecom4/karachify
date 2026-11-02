#!/usr/bin/env node
// Finds OpenStreetMap elements for listings that currently carry no named source,
// and writes a verification batch the existing merge pipeline can consume.
//
// Why this exists: the site's headline honesty claim is "N destinations whose
// address and map pin come from a named source, checked on <date>". Most records
// were seeded without one. OpenStreetMap is a free, ODbL-licensed source that
// genuinely does hold addresses and coordinates, so a matched element is real
// evidence rather than a placeholder.
//
// A match is only accepted when it is unambiguous, because a wrong pin is worse
// than an honest approximate one:
//   · the element's own name equals, or is contained by, the listing name
//     (and vice versa) after normalisation;
//   · the element is inside Karachi;
//   · it sits within --max-km of the pin we already show;
//   · no other candidate from the same search passes those three tests.
// Chain branches ("City School", "Burger Lab") are exactly what the last rule
// is for, and they are refused rather than guessed at.
//
//   node .tools/osm-locate.mjs            dry run — prints decisions, writes nothing
//   node .tools/osm-locate.mjs --write    writes docs/verification/batch-j-osm-locations.json
import { build } from 'esbuild';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const WRITE = process.argv.includes('--write');
const MAX_KM = Number((process.argv.find((a) => a.startsWith('--max-km=')) ?? '').split('=')[1] ?? 8);
const LIMIT = Number((process.argv.find((a) => a.startsWith('--limit=')) ?? '').split('=')[1] ?? 0);
const UA = 'Karachify-verification/0.1 (city directory maintainer; https://karachify.example)';
const ROOT = resolve('.');
const TODAY = new Date().toISOString().slice(0, 10);

const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/&.*$/, ' ')
    .replace(/,.*/, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Names match when one contains the other and neither is a substring accident. */
function namesMatch(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;
  if (shorter.length < 5) return false;
  return longer.includes(shorter);
}

function kmBetween(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const bundle = await build({
  stdin: {
    contents: `
      export { listings } from './listings';
      export { default as overrides } from './verified-overrides.json';
    `,
    resolveDir: join(ROOT, 'src/data'),
    loader: 'ts',
  },
  bundle: true, format: 'esm', platform: 'neutral', write: false, logLevel: 'silent',
});
const tmp = mkdtempSync(join(tmpdir(), 'karachify-osm-'));
const dataFile = join(tmp, 'data.mjs');
writeFileSync(dataFile, bundle.outputFiles[0].text);
const { listings, overrides } = await import(pathToFileURL(dataFile).href);

const sourced = new Set(Object.keys(overrides?.overrides ?? overrides ?? {}));
// Two listings can be the same real place under different spellings — Hawke's Bay
// Beach is seeded and also arrives from the coastline research. If the already-
// sourced one is found by name, this locator would write a second record for the
// same OSM way and the merge would resolve it by name onto the sourced record.
// So any name that a sourced listing already claims is off limits.
const claimedNames = new Set(
  listings.filter((l) => sourced.has(l.slug)).map((l) => norm(l.name))
);
const targets = listings.filter(
  (l) => !sourced.has(l.slug) && Number.isFinite(l.lat) && Number.isFinite(l.lng) && !claimedNames.has(norm(l.name))
);
if (LIMIT) targets.splice(0, targets.length, ...targets.slice(0, LIMIT));

const records = [];
let refused = 0;
for (const l of targets) {
  const q = `${l.name} Karachi`;
  // accept-language=en is not cosmetic: without it Nominatim answers in Urdu
  // script ("بوٹ بیسن") and every Latin-script name comparison silently fails.
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&accept-language=en&limit=5&q=${encodeURIComponent(q)}`;
  let hits = [];
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
    hits = await res.json();
  } catch (e) {
    console.log(`error     ${l.name} — ${e.message}`);
    refused++;
    await new Promise((r) => setTimeout(r, 2200));
    continue;
  }

  const want = norm(l.name);
  const passing = hits
    .map((h) => ({
      name: h.name ?? h.display_name,
      type: h.osm_type,
      id: h.osm_id,
      lat: Number(h.lat),
      lng: Number(h.lon),
      address: h.display_name,
      km: kmBetween(l, { lat: Number(h.lat), lng: Number(h.lon) }),
    }))
    .filter((h) => namesMatch(want, norm(h.name)) && /karachi/i.test(h.address ?? '') && h.km <= MAX_KM);

  const unique = passing.length === 1;
  if (!unique) {
    console.log(`refused   ${l.name} — ${passing.length} plausible match${passing.length === 1 ? '' : 'es'} of ${hits.length} hits`);
    refused++;
  } else {
    const h = passing[0];
    console.log(`MATCH     ${l.name} — ${h.type}/${h.id} @ ${h.km.toFixed(1)} km`);
    records.push({
      // The slug is the identity. The display name is not — the merge file is
      // read by name elsewhere, and two listings called "Hawke's Bay Beach"
      // would otherwise collapse onto whichever one the lookup met first.
      slug: l.slug,
      name: l.name,
      osmId: h.id,
      osmName: h.name,
      lat: h.lat,
      lng: h.lng,
      address: h.address,
      openStreetMapLink: `https://www.openstreetmap.org/${h.type.toLowerCase()}/${h.id}`,
      sources: [{ url: `https://www.openstreetmap.org/${h.type.toLowerCase()}/${h.id}`, supports: ['coordinates', 'address'] }],
      lastVerified: TODAY,
      // Only the pin and the postal line were read. Calling this "verified"
      // would vouch for hours, fees and photographs that were never opened.
      confidence: 'partially-verified',
      notes: `Located by an exact-name OpenStreetMap search within ${MAX_KM} km of the pin already shown; practical fields were not checked.`,
    });
  }
  await new Promise((r) => setTimeout(r, 1100)); // Nominatim usage policy: ≤1 request/second
}

const out = 'docs/verification/batch-j-osm-locations.json';
if (WRITE && records.length) {
  let merged = records;
  if (existsSync(out)) {
    const prev = JSON.parse(readFileSync(out, 'utf8'));
    const bySlug = new Map(prev.map((r) => [r.slug ?? `name:${r.name}`, r]));
    for (const r of records) bySlug.set(r.slug, r);
    merged = [...bySlug.values()];
  }
  writeFileSync(out, JSON.stringify(merged, null, 2) + '\n');
  console.log(`\nwrote ${out} with ${merged.length} records`);
} else {
  console.log(`\ndry run — ${records.length} would be written, ${refused} refused`);
}
