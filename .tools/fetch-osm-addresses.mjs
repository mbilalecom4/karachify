#!/usr/bin/env node
// Re-reads each verified record from OpenStreetMap/Nominatim with
// accept-language=en, so the catalogue stores a Latin-script address instead of
// whatever locale the first pass happened to return. Nothing is typed by hand.
// Writes docs/verification/osm-addresses.json (keyed by record name).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const BATCHES = ['batch-a-heritage', 'batch-c-coastline', 'batch-d-attractions', 'batch-b-museums'];

/** "node/516419993" | 516419993 | a link -> Nominatim osm_id token like "W516419993". */
function osmToken(record) {
  const raw = String(record.osmId ?? '');
  const m = raw.match(/(node|way|relation)\/(\d+)/i) || raw.match(/\/(node|way|relation)\/(\d+)/i);
  if (m) return { n: m[2], t: { node: 'N', way: 'W', relation: 'R' }[m[1].toLowerCase()] };
  const link = String(record.openStreetMapLink ?? '');
  const lm = link.match(/\/(node|way|relation)\/(\d+)/i);
  if (lm) return { n: lm[2], t: { node: 'N', way: 'W', relation: 'R' }[lm[1].toLowerCase()] };
  const bare = raw.match(/^(\d+)$/);
  return bare ? { n: bare[1], t: 'N' } : null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const out = {};
if (existsSync('docs/verification/osm-addresses.json'))
  Object.assign(out, JSON.parse(readFileSync('docs/verification/osm-addresses.json', 'utf8')));

for (const batch of BATCHES) {
  const path = `docs/verification/${batch}.json`;
  if (!existsSync(path)) continue;
  for (const r of JSON.parse(readFileSync(path, 'utf8'))) {
    if (out[r.name]?.address) continue;
    const tok = osmToken(r);
    if (!tok) {
      out[r.name] = { error: 'no osmId' };
      continue;
    }
    const url = `https://nominatim.openstreetmap.org/lookup?format=jsonv2&accept-language=en&addressdetails=1&osm_ids=${tok.t}${tok.n}`;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Karachify-verification/0.1 (contact: karachify.project@proton.me)' },
      });
      const body = await res.json();
      const hit = Array.isArray(body) ? body[0] : undefined;
      out[r.name] = hit
        ? { osmToken: `${tok.t}${tok.n}`, address: hit.display_name ?? null, lat: hit.lat, lon: hit.lon }
        : { osmToken: `${tok.t}${tok.n}`, address: null, error: 'no result' };
      console.log(`${r.name} -> ${out[r.name].address ?? out[r.name].error}`);
    } catch (e) {
      out[r.name] = { osmToken: `${tok.t}${tok.n}`, address: null, error: String(e.message) };
      console.log(`${r.name} FAILED ${e.message}`);
    }
    writeFileSync('docs/verification/osm-addresses.json', JSON.stringify(out, null, 2) + '\n');
    await sleep(1100); // Nominatim usage policy: 1 request/second
  }
}
console.log(`\nwrote docs/verification/osm-addresses.json (${Object.keys(out).length} entries)`);
