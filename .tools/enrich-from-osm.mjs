#!/usr/bin/env node
// Fills the blanks in the 156 checked listings from the OpenStreetMap elements
// that are the same place, and records which element each value came from.
//
// Why this is the lane to run: the catalogue's own coverage audit found hours on
// 8% of records, a phone on 13% and a website on 14%, while OpenStreetMap tags
// opening_hours on 597 Karachi elements, a phone on 2,080 and a website on 403.
// That data is open (ODbL 1.0), it is the same source the map tier, the nearby
// panel and the published hours rows already cite, and a reader can click
// straight through to the element every value came from.
//
// Three evidence lanes, strongest first:
//   1. the element this record ALREADY cites. Some listings carry an `osmId`
//      and some a `sourceUrl` pointing at one; their tags are re-read live from
//      Overpass, because the dump on disk is months old.
//   2. ten pins at a time, a circle around each, read from Overpass today
//      rather than from the dump. Every element near a door that carries a
//      phone, website, email or opening_hours tag — including the shop and
//      tourism classes the local dump never fetched — is then available to the
//      same name-and-distance rules.
//   3. the local dump under `Karachify Research/_raw/osm/`, which needs no
//      network and is all the first pass of this tool had to work from.
//
// What keeps it honest:
//   - a value is only ever written where the record did not already carry one,
//     so this pass can never overwrite something research checked at an operator;
//   - identity has to be proved, and the proof tightens as the pin gets weaker:
//     a record whose coordinates came from a real geocode (`coordsVerified`)
//     joins on name agreement within 400 m, while a record whose pin is an area
//     centre — which can itself be kilometres from the place — is allowed only
//     an exact whole-name match within 1 km. A same-named chain branch is
//     precisely the mistake these two rules exist to stop;
//   - every field written gains a citation in provenance.json naming the exact
//     OSM element it was read from, and leaves that record's `notFound` list,
//     because `.tools/check-data.mjs` fails a build that publishes a field its
//     own audit says has no source;
//   - opening hours are only taken when they parse to real day-and-time rows. A
//     tag this reader cannot read stays unread: the site says so rather than
//     guessing a schedule;
//   - nothing here invents a rating, a review count or a price. Those are not
//     OpenStreetMap fields and are not touched.
//
//   node .tools/enrich-from-osm.mjs              dry run: what would be written, and why not
//   node .tools/enrich-from-osm.mjs --write      merge into verified-overrides.json + provenance.json
//   node .tools/enrich-from-osm.mjs --offline    skip lanes 1 and 2, use the dump only
//
// Run after `.tools/apply-verification.mjs`, which rewrites both files from the
// research batches; this one adds to what that left. Then re-run
// `npm run build:area-hours`, whose counts are derived from what is published.
import { build } from 'esbuild';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const WRITE = process.argv.includes('--write');
const OFFLINE = process.argv.includes('--offline');
/** Public Overpass servers are shared and sometimes full; when they are, the
 *  cited elements and the local dump still answer, so the pin circles can be
 *  left for a run that lands when the server does. */
const SKIP_PINS = process.argv.includes('--skip-pins');
const ROOT = resolve('.');
const OSM_DIR = join(ROOT, 'Karachify Research', '_raw', 'osm');
const CACHE_FILE = join(ROOT, '.tools/osm-tags-cache.json');
/** Which pins this pass has already stood a circle around. A run that dies
 *  halfway through a flaky server should not have to re-ask the 80 records it
 *  already answered, and should not report them as if they had been checked. */
const PIN_LEDGER = join(ROOT, '.tools/osm-pins-read.json');
const TODAY = '2026-11-06';
const UA = 'Karachify-verification/0.1 (city directory maintainer; https://karachify.example)';
/* Measured from this machine on 2026-11-06: a one-element id lookup to the
   kumi.private.coffee mirror did not answer in 60 s, and neither did anything
   else tried against it — while overpass-api.de answers a real circle in half
   a minute. Asking the dead host twice per request step would cost more wall
   time than the whole lane, so only the instance that answers is used, and a
   refusal there is reported rather than papered over with a second dead try. */
const HOSTS = ['https://overpass-api.de/api/interpreter'];
const REQUEST_MS = 120000;

/** The pin is a real geocode, so proximity means something. */
const MAX_METRES_GEOCODED = 400;
/** The pin is an area centre, so only an exact name may bridge it. */
const MAX_METRES_APPROX = 1000;
const ID_CHUNK = 20;
/** Doors asked about per request. The cost is dominated by the request, not
 *  the circles: measured here, one 1 km circle took 33.6 s and returned 363
 *  elements, while three circles took 38.6 s. A whole-city query, on the other
 *  hand, is what makes a public server answer "queue is full". */
const PIN_CHUNK = 5;

const failures = [];
const fail = (m) => failures.push(m);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------- overpass --------------------------------- */

/**
 * Ask a public Overpass instance for the answer to one query.
 *
 * These servers are shared and frequently full: `overpass-api.de` answers 502
 * with "currently at capacity, retry with exponential backoff", which is a
 * different thing from a query it refuses outright. So a busy server is waited
 * on and retried, both request shapes are tried (a POST that is refused has
 * been seen to succeed as a GET within seconds of the same query), and a query
 * that is refused on its own merits stops this pass rather than being repeated.
 */
async function overpass(query, what) {
  let last = 'no host tried';
  for (const wait of [0, 15000, 45000, 90000]) {
    if (wait) {
      console.log(`  waiting ${wait / 1000}s then retrying — ${last}`);
      await sleep(wait);
    }
    for (const host of HOSTS) {
      for (const shape of ['post', 'get']) {
        try {
          const res =
            shape === 'post'
              ? await fetch(host, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
                  body: `data=${encodeURIComponent(query)}`,
                  signal: AbortSignal.timeout(REQUEST_MS),
                })
              : await fetch(`${host}?data=${encodeURIComponent(query)}`, {
                  headers: { 'User-Agent': UA },
                  signal: AbortSignal.timeout(REQUEST_MS),
                });
          const text = await res.text();
          if (res.ok) return JSON.parse(text).elements ?? [];
          /* The useful half of a 400 body is past the HTML boilerplate, so the
             complaint is picked out of it rather than the first 160 characters. */
          last = `${host} ${shape.toUpperCase()} ${res.status}: ${
            res.status === 400
              ? (text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').match(/(Query build failed|parse|Unknown|expected)[^.]*/i)?.[0] ?? text.replace(/\s+/g, ' ').slice(0, 160))
              : text.replace(/\s+/g, ' ').slice(0, 160)
          }`;
          /* A refused query stays refused however many times it is sent. */
          if (res.status === 400) {
            fail(`${what}: ${last} — the query itself was refused, so nothing was read and nothing is guessed`);
            return null;
          }
        } catch (e) {
          /* A dropped connection is not evidence the server is gone, and there
             is no second instance to hand the request to, so the wait ladder
             below is what decides whether this lane gets an answer at all. */
          last = `${host} ${shape.toUpperCase()} — ${e.name === 'TimeoutError' ? `no answer in ${REQUEST_MS / 1000}s` : e.message}`;
        }
      }
    }
  }
  fail(`${what}: ${last} — that lane is skipped and nothing is guessed in its place`);
  return null;
}

/* ----------------------------- the catalogue ------------------------------ */

const bundle = await build({
  stdin: {
    contents: "export { listings } from './listings';\n",
    resolveDir: join(ROOT, 'src', 'data'),
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  write: false,
  logLevel: 'silent',
});
const tmp = join(mkdtempSync(join(tmpdir(), 'osm-enrich-')), 'data.mjs');
writeFileSync(tmp, bundle.outputFiles[0].text);
const { listings } = await import(pathToFileURL(tmp).href);

const OVERRIDES_FILE = join(ROOT, 'src/data/verified-overrides.json');
const PROVENANCE_FILE = join(ROOT, 'src/data/provenance.json');
const overrides = JSON.parse(readFileSync(OVERRIDES_FILE, 'utf8'));
const provenance = JSON.parse(readFileSync(PROVENANCE_FILE, 'utf8'));

/* ------------------------------- the names -------------------------------- */

const DAY = { mo: 'Monday', tu: 'Tuesday', we: 'Wednesday', th: 'Thursday', fr: 'Friday', sa: 'Saturday', su: 'Sunday' };
const GENERIC = new Set(['the', 'of', 'and', 'a', 'in', 'at', 'karachi', 'sind', 'pakistan', 'branch', 'main']);

const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’`´]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const words = (s) => norm(s).split(' ').filter((w) => w && !GENERIC.has(w));

/** Metres between two points, from the haversine formula. */
function metres(aLat, aLng, bLat, bLng) {
  const r = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

/**
 * Does one name name this place?
 *
 * Equal, or one running as a whole-word prefix of the other: "Aga Khan
 * University Hospital" and "Aga Khan University Hospital - Paediatric Centre"
 * are the same institution seen two ways, while "Dolmen Mall" against "Bata,
 * Dolmen Mall" is a shop inside the mall, which the prefix rule refuses because
 * the shorter side does not start the longer one.
 */
function samePlace(a, b) {
  const x = words(a);
  const y = words(b);
  if (!x.length || !y.length) return false;
  if (x.join(' ') === y.join(' ')) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  if (short.length < 2) return false;
  return long.slice(0, short.length).join(' ') === short.join(' ');
}

/** The stricter rule, for a record whose own position is only approximate. */
function sameName(a, b) {
  const x = words(a);
  const y = words(b);
  return x.length > 0 && y.length > 0 && x.join(' ') === y.join(' ');
}

/* ------------------------------- the fields ------------------------------- */

/** A Pakistani landline or mobile, in the form the catalogue publishes. */
function phoneOf(tags) {
  const raw = tags.phone ?? tags['contact:phone'] ?? tags['contact:mobile'];
  if (!raw) return '';
  const cleaned = String(raw).split(/[,;]/)[0].replace(/[^\d+]/g, '');
  let full = '';
  if (cleaned.startsWith('+92')) full = cleaned;
  else if (cleaned.startsWith('0092')) full = `+92${cleaned.slice(4)}`;
  else if (cleaned.startsWith('92') && cleaned.length >= 11) full = `+${cleaned}`;
  else if (cleaned.startsWith('0') && cleaned.length >= 11) full = `+92${cleaned.slice(1)}`;
  else return '';
  const landline = full.match(/^\+92(21)(\d{7,8})$/);
  const mobile = full.match(/^\+92(3\d{2})(\d{7})$/);
  if (landline) return `+92 ${landline[1]} ${landline[2]}`;
  if (mobile) return `+92 ${mobile[1]} ${mobile[2]}`;
  return full;
}

/**
 * OSM's `opening_hours` into the rows this site prints — the same reading
 * `Karachify Research/scripts/build_dataset.mjs` used for the map tier, so a
 * card and a map row never disagree about one tag.
 *
 * Returns nothing when the tag cannot be read: quoting the raw string is right
 * for a data dump and wrong for a visitor-facing card.
 */
function hoursOf(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (/^24\/7$/i.test(s)) return [{ day: 'Every day', open: '24 hours' }];
  const rows = [];
  for (const part of s.split(';').map((x) => x.trim()).filter(Boolean)) {
    const m = part.match(/^([A-Za-z,\-\s]+)\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
    if (!m) return null;
    const span = m[1].trim().split('-').map((x) => x.trim().toLowerCase());
    const day =
      span.length === 2 && DAY[span[0]] && DAY[span[1]]
        ? `${DAY[span[0]]} – ${DAY[span[1]]}`
        : DAY[span[0]] ?? m[1].trim();
    rows.push({ day, open: `${m[2]} – ${m[3]}` });
  }
  if (!rows.length) return null;
  const simple = s.match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
  return simple ? [{ day: 'Every day', open: `${simple[1]} – ${simple[2]}` }] : rows;
}

const WANTED = ['opening_hours', 'phone', 'contact:phone', 'contact:mobile', 'website', 'contact:website', 'url', 'email', 'contact:email'];
/** What this element can tell a visitor. */
const richness = (e) => WANTED.filter((k) => e.tags?.[k]).length;
const pos = (e) =>
  Number.isFinite(e.lat) ? e : e.center && Number.isFinite(e.center.lat) ? { lat: e.center.lat, lon: e.center.lon } : null;
const keyOf = (e) => `${e.type}/${e.id}`;
const elementUrl = (e) => `https://www.openstreetmap.org/${e.type}/${e.id}`;

/* ------------------------------ lane 3: the dump -------------------------- */

const dump = [];
for (const f of readdirSync(OSM_DIR)) {
  if (!f.endsWith('.json')) continue;
  for (const e of JSON.parse(readFileSync(join(OSM_DIR, f), 'utf8')).elements ?? []) {
    if (!e.tags?.name || !pos(e) || !richness(e)) continue;
    dump.push(e);
  }
}

/* ------------------------- lanes 1 and 2: live Overpass ------------------- */

/** "N123" | "node/123" | an openstreetmap.org link | a bare id -> "node/123". */
function refOf(raw) {
  const s = String(raw ?? '');
  const typed = s.match(/(node|way|relation)\/(\d+)/i);
  if (typed) return `${typed[1].toLowerCase()}/${typed[2]}`;
  const token = s.match(/^([nwr])(\d+)$/i);
  if (token) return `${{ n: 'node', w: 'way', r: 'relation' }[token[1].toLowerCase()]}/${token[2]}`;
  const bare = s.match(/^(\d+)$/);
  return bare ? `node/${bare[1]}` : null;
}

const cache = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : {};
const live = new Map();
for (const [k, v] of Object.entries(cache)) {
  if (!v?.tags) continue;
  live.set(k, { type: k.split('/')[0], id: Number(k.split('/')[1]), lat: v.lat, lon: v.lon, center: v.center, tags: v.tags });
}
const saveCache = () => writeFileSync(CACHE_FILE, `${JSON.stringify(cache, null, 1)}\n`);

const pinsRead = existsSync(PIN_LEDGER) ? JSON.parse(readFileSync(PIN_LEDGER, 'utf8')) : {};
/** The radius is part of the identity: change the matching rule and every pin
 *  becomes unread again, rather than keeping a stale answer under a new rule. */
const pinKeyOf = (l) =>
  `${l.lat},${l.lng}:${l.coordsVerified ? MAX_METRES_GEOCODED : MAX_METRES_APPROX}`;
const savePins = () => writeFileSync(PIN_LEDGER, `${JSON.stringify(pinsRead, null, 1)}\n`);

if (!OFFLINE) {
  /* lane 1: re-read the elements these records already cite */
  const citedRefs = [...new Set(listings.map((l) => refOf(l.osmId) ?? refOf(l.sourceUrl)).filter(Boolean))];
  const missing = citedRefs.filter((k) => !live.has(k));
  console.log(`lane 1: ${citedRefs.length} element(s) this catalogue cites, ${missing.length} not yet read`);
  for (let i = 0; i < missing.length; i += ID_CHUNK) {
    const chunk = missing.slice(i, i + ID_CHUNK);
    const statements = chunk.map((k) => {
      const [type, id] = k.split('/');
      return `  ${type}(${id});`;
    });
    const q = `[out:json][timeout:60];\n(\n${statements.join('\n')}\n);\nout tags center;`;
    const got = await overpass(q, `cited-element read #${i / ID_CHUNK + 1}`);
    if (!got) break;
    for (const e of got) {
      live.set(keyOf(e), e);
      cache[keyOf(e)] = { tags: e.tags, lat: e.lat, lon: e.lon, center: e.center, readOn: TODAY, why: 'cited by a record' };
    }
    saveCache();
    console.log(`  read ${Math.min(i + ID_CHUNK, missing.length)}/${missing.length} cited elements`);
    await sleep(1500);
  }

  /* lane 2: a circle around each pin that is still missing a field, so the
     record is compared against what OpenStreetMap says today rather than only
     the commerce categories the local dump happens to hold. Circles rather
     than a city-wide read: a whole-city query is what makes these servers
     answer "currently at capacity", while a handful of doors costs about the
     same as one and covers exactly the area the matching rules care about. */
  const KEY_RE = WANTED.join('|');
  const needing = listings.filter((l) => !l.phone || !l.website || !l.email || !l.hours?.length);
  console.log(SKIP_PINS ? `lane 2: skipped (--skip-pins); ${needing.length} record(s) still miss a field` : `lane 2: ${needing.length} record(s) still miss a phone, website, email or hours row`);
  let refusedChunks = 0;
  for (let i = 0; !SKIP_PINS && i < needing.length; i += PIN_CHUNK) {
    const upto = `${i + 1}–${Math.min(i + PIN_CHUNK, needing.length)} of ${needing.length}`;
    /* A pin read on an earlier run is not asked about again; its elements are
       already in the cache and so already in the pool this pass matches with. */
    const chunk = needing.slice(i, i + PIN_CHUNK).filter((l) => !pinsRead[pinKeyOf(l)]);
    if (!chunk.length) {
      console.log(`  lane 2 chunk ${i / PIN_CHUNK + 1}/${Math.ceil(needing.length / PIN_CHUNK)}: ${PIN_CHUNK} pin(s) already read on an earlier run, not asked again`);
      continue;
    }
    const statements = chunk.map((l) => {
      const r = l.coordsVerified ? MAX_METRES_GEOCODED : MAX_METRES_APPROX;
      /* `[~"^…$"~"." ]` is the Overpass spelling for "this element carries at
         least one tag whose key is one of ours". Spelling it with a literal
         `"~"` key makes the whole query unsyntaxable and the server answers
         HTTP 400 — which this lane correctly reads as "refused", not "busy". */
      return `  nwr(around:${r},${l.lat},${l.lng})["name"][~"^(${KEY_RE})$"~"."];`;
    });
    const q = `[out:json][timeout:90];\n(\n${statements.join('\n')}\n);\nout tags center 3000;`;
    const got = await overpass(q, `pins ${upto}`);
    if (!got) {
      refusedChunks++;
      /* Reaching here means every step of the wait ladder failed on this one
         query. Two queries in a row like that is not bad luck, and an hour of
         waiting on a shared server would be its own problem, so the lane stops
         and the records it never reached stay unpublished and are named. */
      if (refusedChunks >= 2) {
        const left = needing.filter((l, j) => j >= i && !pinsRead[pinKeyOf(l)]).length;
        console.log(`  lane 2 stopped: the public server failed two chunks in a row, ${left} record(s) were never asked about`);
        fail(`lane 2 stopped early — ${left} record(s) were not compared against live OpenStreetMap in this run; re-run the pass when the server answers`);
        break;
      }
      continue;
    }
    refusedChunks = 0;
    let kept = 0;
    for (const e of got) {
      if (!e.tags?.name || !pos(e) || !richness(e)) continue;
      live.set(keyOf(e), e);
      cache[keyOf(e)] = { tags: e.tags, lat: e.lat, lon: e.lon, center: e.center, readOn: TODAY, why: 'circle around a published pin' };
      kept++;
    }
    for (const l of chunk) pinsRead[pinKeyOf(l)] = { readOn: TODAY, name: l.name, answered: got.length };
    saveCache();
    savePins();
    console.log(`  lane 2 chunk ${i / PIN_CHUNK + 1}/${Math.ceil(needing.length / PIN_CHUNK)}: ${got.length} answered, ${kept} usable · pool now ${live.size}`);
    await sleep(2000);
  }
}

/* A live answer supersedes the dump for the same element: the dump is months
   old and an element can have been edited, or deleted, since. */
const pool = new Map();
for (const e of dump) pool.set(keyOf(e), e);
for (const e of live.values()) if (e.tags?.name && pos(e) && richness(e)) pool.set(keyOf(e), e);
const elements = [...pool.values()];

/** What this element can give this record, and what it must not touch. */
function fieldsFrom(l, e) {
  const t = e.tags;
  const patch = {};
  const supports = [];
  const skipped = [];
  const wasCheckedNotFound = (k) => (overrides.overrides[l.slug] ?? {})[k] === null;

  const phone = phoneOf(t);
  if (phone) {
    if (l.phone) skipped.push('phone: the record already carries one');
    else {
      patch.phone = phone;
      supports.push('phone', 'contact');
      if (wasCheckedNotFound('phone')) skipped.push('phone had been recorded as "checked, not found"');
    }
  }
  const site = t.website ?? t['contact:website'] ?? t.url;
  if (site) {
    if (l.website) skipped.push('website: already carried');
    else {
      patch.website = /^https?:/.test(site) ? site : `https://${site}`;
      supports.push('website');
      if (wasCheckedNotFound('website')) skipped.push('website had been recorded as "checked, not found"');
    }
  }
  const email = t.email ?? t['contact:email'];
  if (email) {
    if (l.email) skipped.push('email: already carried');
    else {
      patch.email = email;
      supports.push('contact', 'email');
      if (wasCheckedNotFound('email')) skipped.push('email had been recorded as "checked, not found"');
    }
  }
  const hours = hoursOf(t.opening_hours);
  if (t.opening_hours && !hours)
    skipped.push(`hours: tagged "${t.opening_hours}", which this reader cannot turn into a schedule — left unpublished`);
  else if (hours) {
    if (l.hours?.length) skipped.push('hours: already carried');
    else {
      patch.hours = hours;
      supports.push('hours');
      if (wasCheckedNotFound('hours')) skipped.push('hours had been recorded as "checked, not found"');
    }
  }
  if (norm(l.name) !== norm(t.name)) skipped.push(`the element is tagged "${t.name}"`);
  return { patch, supports, skipped };
}

/* -------------------------------- matching -------------------------------- */

const touched = [];
const refused = [];

for (const l of listings) {
  const geocoded = Boolean(l.coordsVerified);
  const limit = geocoded ? MAX_METRES_GEOCODED : MAX_METRES_APPROX;
  const nameRule = geocoded ? samePlace : sameName;
  const ref = refOf(l.osmId) ?? refOf(l.sourceUrl);
  const cited = ref ? pool.get(ref) : undefined;

  const near = elements
    .filter((e) => keyOf(e) !== ref && nameRule(l.name, e.tags.name) && metres(l.lat, l.lng, pos(e).lat, pos(e).lon) <= limit)
    .sort(
      (a, b) =>
        richness(b) - richness(a) ||
        metres(l.lat, l.lng, pos(a).lat, pos(a).lon) - metres(l.lat, l.lng, pos(b).lat, pos(b).lon)
    );

  /* A record already links to `ref` on screen and in provenance, so that
     element's identity is settled and its tags are read whether or not its name
     still spells the place the same way — any mismatch is printed, never hidden. */
  const candidates = [];
  if (cited && pos(cited)) candidates.push({ element: cited, lane: 'the element this record already cites' });
  for (const e of near)
    candidates.push({
      element: e,
      lane: geocoded ? 'name and distance agree with this geocoded pin' : 'exact name within 1 km of an approximate pin',
    });

  let picked = null;
  for (const c of candidates) {
    const f = fieldsFrom(l, c.element);
    if (Object.keys(f.patch).length) {
      picked = { ...c, ...f };
      break;
    }
  }

  if (!picked) {
    const named = elements.filter((e) => nameRule(l.name, e.tags.name));
    const offered = candidates.map((c) => fieldsFrom(l, c.element).skipped).flat();
    refused.push({
      slug: l.slug,
      name: l.name,
      matched: candidates.map((c) => keyOf(c.element)),
      why: candidates.length
        ? `matched ${candidates.map((c) => `${keyOf(c.element)} "${c.element.tags.name}"`).join(', ')} — every field they hold the record already carries`
        : named.length
          ? `${named.length} element(s) of this name sit ${Math.round(Math.min(...named.map((e) => metres(l.lat, l.lng, pos(e).lat, pos(e).lon))))} m or more from this pin, beyond the ${limit} m this ${geocoded ? 'geocoded' : 'approximate'} pin allows`
          : `no element in the pool of ${elements.length} names this place with a phone, website, email or opening_hours tag worth taking`,
      notes: offered,
    });
    continue;
  }

  const e = picked.element;
  const url = elementUrl(e);
  if (!l.sourceUrl) {
    picked.patch.sourceUrl = url;
    picked.supports.push('sourceUrl');
  }
  /* Today becomes the record's check date only when the element that answered
     is the element this record already cites — that page really was opened
     again today. When the match came from a circle around the pin instead, the
     record keeps the date its own source was read, and the new element is
     cited for the field it supplied and nothing else. */
  if (!l.sourceUrl || (ref && keyOf(e) === ref)) {
    picked.patch.lastVerified = TODAY;
    picked.supports.push('lastVerified');
  }
  /* `osmId` is a claim about where this record's coordinates and address were
     read from, so it is only ever written for the element the record already
     cites. A name-and-distance match is cited in provenance.json instead,
     which says where the value came from without rewriting the pin's story. */
  if (!l.osmId && ref && keyOf(e) === ref) {
    picked.patch.osmId = keyOf(e).replace(/^node/, 'N').replace(/^way/, 'W').replace(/^relation/, 'R');
    picked.supports.push('osmId');
  }

  touched.push({
    listing: l,
    patch: picked.patch,
    supports: [...new Set(picked.supports)],
    skipped: picked.skipped,
    element: e,
    lane: picked.lane,
    metres: Math.round(metres(l.lat, l.lng, pos(e).lat, pos(e).lon)),
    elementUrl: url,
    ambiguous: candidates.length > 1,
  });
}

/* -------------------------------- printed --------------------------------- */

const gained = { phone: 0, website: 0, email: 0, hours: 0, sourceUrl: 0 };
for (const t of touched) for (const k of Object.keys(gained)) if (t.patch[k]) gained[k]++;
console.log(`\n${listings.length} listings · ${elements.length} elements in the pool (${dump.length} from the local dump, ${live.size} read live)`);
console.log(`${touched.length} records gain a field, ${refused.length} do not`);
console.log('   ', Object.entries(gained).map(([k, v]) => `${k} +${v}`).join(' · '));
const unreadable = touched.filter((t) => t.skipped.some((s) => s.startsWith('hours: tagged')));
if (unreadable.length) console.log(`    ${unreadable.length} more carry an opening_hours tag this reader cannot parse — left unpublished`);
console.log('\ngains:');
for (const t of touched) {
  console.log(`  ${t.listing.slug} ← ${t.element.tags.name} (${t.metres} m, ${keyOf(t.element)}, ${t.lane})`);
  console.log(`     ${Object.entries(t.patch).map(([k, v]) => `${k}: ${JSON.stringify(v).slice(0, 80)}`).join('\n     ')}`);
  for (const s of t.skipped) console.log(`     · ${s}`);
}
console.log('\nrefusals, first twenty:');
for (const r of refused.slice(0, 20)) console.log(`  ${r.slug}: ${r.why}`);

/* -------------------------------- written --------------------------------- */

if (!WRITE) {
  console.log('\ndry run — nothing written. Add --write to merge into the catalogue.');
  process.exit(failures.length ? 1 : 0);
}

for (const t of touched) {
  const slug = t.listing.slug;
  overrides.overrides[slug] = { ...(overrides.overrides[slug] ?? {}), ...t.patch };
  /* isNew records are made by the research batches; a patch must not turn an
     unlisted record into a listing by itself. */
  if (!provenance.records[slug]) {
    provenance.records[slug] = {
      researchName: t.listing.name,
      status: t.listing.status,
      lastVerified: TODAY,
      confidence: 'partially-verified',
      batches: ['osm-tags'],
      published: [],
      notFound: [],
      sources: [],
    };
  }
  const p = provenance.records[slug];
  p.batches = [...new Set([...(p.batches ?? []), 'osm-tags'])];
  p.lastVerified = t.patch.lastVerified ?? TODAY;
  p.sources = [
    ...(p.sources ?? []).filter((s) => s.url !== t.elementUrl),
    {
      url: t.elementUrl,
      supports: t.supports,
      /* The day this element's tags were read, which is a different fact from
         the day the record as a whole was last checked. */
      readOn: TODAY,
      note: `OpenStreetMap element tagged "${t.element.tags.name}"; fields taken only where the record carried none.`,
      batch: 'osm-tags',
    },
  ];
  /* `published` is checked field by field against the live record, so only what
     this patch actually writes may be claimed. */
  p.published = [...new Set([...(p.published ?? []), ...Object.keys(t.patch)])];
  /* A field the audit had recorded as "checked, not found" is now published, so
     the claim has to leave that list or check-data fails the build. */
  const clears = new Set();
  for (const k of Object.keys(t.patch)) {
    if (k === 'phone' || k === 'email') clears.add('contact');
    if (k === 'hours') clears.add('hours');
    if (k === 'website') clears.add('website');
  }
  p.notFound = (p.notFound ?? []).filter((f) => !clears.has(f) && !Object.keys(t.patch).includes(f));
}

/* One record, one date. The place page prints the record's own check date and
   the sources page prints the provenance one; if an earlier pass moved only the
   second, the same record would be shown as checked on two different days, so
   the evidence file is brought back to the date the catalogue carries. */
const bySlug = new Map(listings.map((l) => [l.slug, l]));
let aligned = 0;
for (const [slug, p] of Object.entries(provenance.records)) {
  const shown = bySlug.get(slug)?.lastVerified;
  if (!shown || !p.lastVerified || p.lastVerified === shown) continue;
  p.lastVerified = shown;
  aligned++;
}
if (aligned) console.log(`  ${aligned} provenance date(s) aligned to the date the record itself carries`);

/* What the osm-tags batch stands behind in the catalogue as it now stands.
   A run that fills nothing still has to be readable: without this, the review
   file would say "0 gained" over a catalogue holding three fields this lane
   wrote on an earlier run, and the difference would be invisible. */
const osmTagsNow = Object.entries(provenance.records)
  .filter(([, p]) => (p.sources ?? []).some((s) => s.batch === 'osm-tags'))
  .map(([slug, p]) => {
    const cited = new Set(
      (p.sources ?? []).filter((s) => s.batch === 'osm-tags').flatMap((s) => s.supports ?? [])
    );
    return { slug, fields: (p.published ?? []).filter((f) => cited.has(f)) };
  })
  .filter((r) => r.fields.length);

writeFileSync(OVERRIDES_FILE, `${JSON.stringify(overrides, null, 2)}\n`);
writeFileSync(PROVENANCE_FILE, `${JSON.stringify(provenance, null, 2)}\n`);
writeFileSync(
  join(ROOT, '.tools/osm-enrichment-review.json'),
  `${JSON.stringify(
    {
      ranOn: TODAY,
      offline: OFFLINE,
      limits: { geocodedPinMetres: MAX_METRES_GEOCODED, approximatePinMetres: MAX_METRES_APPROX },
      pool: { fromDump: dump.length, readLive: live.size },
      gained: touched.length,
      fieldCounts: gained,
      osmTagsNow,
      records: touched.map((t) => ({
        slug: t.listing.slug,
        from: t.elementUrl,
        lane: t.lane,
        named: t.element.tags.name,
        metres: t.metres,
        fields: Object.keys(t.patch),
        values: t.patch,
        notes: t.skipped,
        ambiguous: t.ambiguous,
      })),
      refused,
      failedLanes: failures,
    },
    null,
    2,
  )}\n`,
);
console.log(`\nwrote ${touched.length} record(s) into verified-overrides.json + provenance.json`);
console.log(
  `the osm-tags batch now stands behind ${osmTagsNow.length} record(s): ` +
    osmTagsNow.map((r) => `${r.slug} [${r.fields.join(', ')}]`).join(', ')
);
console.log('next: npm run build:area-hours && npm run verify');
if (failures.length) {
  console.log(`${failures.length} problem(s):`);
  for (const f of failures.slice(0, 10)) console.log('  ', f);
  process.exit(1);
}
