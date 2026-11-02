#!/usr/bin/env node
// Builds src/data/verified-overrides.json from the research files in
// docs/verification/. Nothing here is invented: every value comes from a batch
// record, and each batch record names the URL it was read from.
//
// Deliberate exclusions live in DROP_* below so the reasons stay in the repo.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const BATCHES = [
  'batch-a-heritage',
  'batch-c-coastline',
  'batch-d-attractions',
  'batch-b-museums',
  'batch-f-practical',
  'batch-g-institutions',
  'batch-h-emergency',
  'batch-i-around-the-clock',
  'batch-j-osm-locations',
];

/** Verified name in the research file -> slug used by the catalogue. */
const SLUG_MAP = {
  'Mazar-e-Quaid': 'mazar-e-quaid',
  'Mohatta Palace': 'mohatta-palace',
  'Frere Hall': 'frere-hall',
  'Empress Market': 'empress-market',
  'Wazir Mansion': 'wazir-mansion',
  'Clifton Beach (Karachi Beach)': 'clifton-beach',
  'Sea View (Seaface / Boat Basin stretch)': 'seaview-point',
  'Sandspit Beach': 'sandspit-beach',
  'Manora (island village and Manora Point beach)': 'manora-island',
  'Port Grand': 'port-grand',
  'Karachi Zoo': 'karachi-zoo',
  'Chaukhandi Tombs': 'chaukhandi-tombs',
  'Pakistan Maritime Museum': 'pakistan-maritime-museum',
  'PAF Museum (Pakistan Air Force Museum)': 'paaf-museum-karachi',
  'National Museum of Pakistan': 'national-museum-pakistan',
  'State Bank of Pakistan Museum (SBP Museum)': 'state-bank-of-pakistan-museum',
  // batch-g: the city's institutions — hospitals, universities, malls, transit.
  'Aga Khan University Hospital': 'aga-khan-university-hospital',
  'Data Darbar Shrine': 'data-darbar',
  'Dolmen Mall Clifton': 'dolmen-mall-clifton',
  'Edhi Foundation Ambulance Service': 'edhi-foundation-karachi',
  'Jinnah International Airport': 'jinnah-international-airport',
  'Jinnah Postgraduate Medical Centre (JPMC)': 'jinnah-postgraduate-medical-centre',
  'Karachi Circular Railway (KCR)': 'karachi-circular-railway',
  'Karachi Expo Centre': 'karachi-expo-centre',
  'Karachi Grammar School': 'karachi-grammar-school',
  'Karachi Metropolitan Corporation (KMC)': 'karachi-metropolitan-corporation',
  'Lucky One Mall': 'lucky-one-mall',
  'Masjid-e-Tooba (Gol Mahal Masjid)': 'masjid-e-tooba',
  'National Stadium Karachi': 'national-stadium-karachi',
  'NED University of Engineering & Technology': 'ned-university',
  'Ocean Park Karachi': 'ocean-park-karachi',
  'Rescue 1122': 'rescue-1122-karachi',
  'University of Karachi': 'university-of-karachi',
  // batch-h: the two city-wide hotlines whose numbers are published but whose
  // offices were never mapped — contact-only records, so no pin is written.
  'Sindh Police Headquarters & Complaint Cell': 'sindh-police-hq',
  'Karachi Fire Brigade': 'karachi-fire-brigade',
  // batch-i: the places whose own page states round-the-clock availability.
  'Liaquat National Hospital': 'liaquat-national-hospital',
};

/**
 * New records need visitor-facing copy, and the research files are written as
 * provenance notes. These three sentences restate only facts the batch records
 * already carry (OSM geometry, official-site pages), nothing added.
 */
const NEW_RECORDS = {
  'Hawksbay Beach': {
    // The seed file already carries this beach, as `hawkes-bay-beach`. The
    // coastline research found the same OSM way (516419993) under a different
    // spelling — two catalogue entries for one shoreline is a data bug, so the
    // sourced record now lands on the seeded slug instead of creating a twin.
    slug: 'hawkes-bay-beach',
    categoryId: 'beaches',
    areaId: 'kemari',
    description:
      "A long, quiet stretch of open coast in Keamari Town — OpenStreetMap maps it as roughly seven kilometres of shoreline, with the pin set at the road-accessible end nearest Sandspit. No official page publishes hours, fees or facilities for it, so plan on daylight and carry what you need.",
  },
  'Bahria Adventure Land': {
    slug: 'bahria-adventure-land',
    categoryId: 'parks-recreation',
    areaId: 'gadap',
    description:
      'A theme park inside Bahria Town Karachi on the Super Highway, built with Italian ride manufacturers. The official site lists five zones and 25 attractions with food outlets, arcade games, parking and ATMs; entry is by height-based ticket, sold at the gate.',
  },
  // OSM puts it in the old Central Business District; Saddar is the nearest
  // area the catalogue already models, and the verified pin carries the record.
  'TDF MagnifiScience Centre': {
    slug: 'tdf-magnifiscience-centre',
    categoryId: 'museums-galleries',
    areaId: 'saddar',
    description:
      "The Dawood Foundation's interactive science centre, described on its own website as Pakistan's first, a few minutes from Karachi City Railway Station. Exhibitions spread over several floors plus a science garden, with weekday, weekend and annual passes; closed Fridays.",
  },
};

/** OSM's own spelling, preferred over the shorthand used in the research file. */
const NAME_FROM_OSM = { 'hawkes-bay-beach': "Hawke's Bay Beach" };

/** The Latin-script address re-read from Nominatim with accept-language=en. */
const OSM_ADDRESSES = JSON.parse(readFileSync('docs/verification/osm-addresses.json', 'utf8'));

/**
 * Nominatim returns "Karāchi District" for some records; keep one spelling.
 * batch-g writes its addresses with the provenance pasted on the end —
 * "…Karachi 75270, Pakistan (official neduet.edu.pk Contact Us page); OSM: the
 * Admin Block way" — which is evidence for the audit file, not something a
 * visitor can navigate to. The note stays in the research file and on /sources;
 * the catalogue gets the postal line only.
 */
const PROVENANCE_OPEN = /^\(\s*[^()]*\b(?:official|per|OSM|OpenStreetMap|Nominatim|Wikipedia|addr|tags?|script|page|site|source)\b/i;

function cleanAddress(s) {
  const value = String(s);
  const open = value.indexOf('(');
  // Cut from the first parenthesis that opens a provenance note — the note is
  // sometimes closed and sometimes runs past a semicolon inside it.
  const postal = open >= 0 && PROVENANCE_OPEN.test(value.slice(open)) ? value.slice(0, open) : value.split(';')[0];
  // A note that was the whole string would leave nothing: keep the original
  // rather than ship an empty address.
  const kept = postal.trim() ? postal : value;
  return kept.replace(/\s+/g, ' ').replace(/Karāchi/g, 'Karachi').trim().replace(/[,;:]\s*$/, '');
}

// The amount (Rs 1,000) contradicts its own label ("Rs. 500 redeemable"), and
// both came from social posts rather than a tariff page, so it is not published.
const DROP_FEES = new Set(['port-grand']);
// The Commissioner Karachi swimming-ban notification covers 01.07-23.08.2026, a
// window that has closed. Showing it as a live entry condition would mislead.
const DROP_ENTRY_CONDITIONS = new Set(['clifton-beach', 'seaview-point', 'sandspit-beach', 'manora-island', 'hawkes-bay-beach']);

/**
 * Evidence about one element is not evidence about the record the reader is
 * looking at, so some verified fields are held back even though a source named
 * them. The reason travels to /sources with the suppression.
 */
const SUPPRESS_FIELDS = {
  coordinates: ['lat', 'lng', 'coordsVerified', 'osmId', 'sourceUrl'],
  address: ['address'],
};
const SUPPRESS = {
  'rescue-1122-karachi': {
    groups: ['coordinates', 'address'],
    reason:
      'OpenStreetMap maps one Rescue station (SIEHS-1122 North Nazimabad Station 7), not the service. Pinning the city-wide Rescue 1122 record to that one station, or printing its street as the service’s address, would claim a verified headquarters that no source states — so the record keeps only the 1122 number, which is the thing the reader actually needs.',
  },
  'karachi-grammar-school': {
    groups: ['coordinates'],
    reason:
      'The only Karachi node OpenStreetMap names “Karachi Grammar School” sits in North Nazimabad, while the school’s own published address is Clifton Block 5 (the campus has three sites). The mismatch is recorded in the research notes; until one of the two is shown to be the senior school, no verified pin is published for it.',
  },
};

/**
 * The same rules that suppress a value are published on /sources, so a reader
 * can see that a source existed and why its content did not ship. Derived from
 * the DROP_ sets above: the disclosure cannot drift from the enforcement.
 */
const EXCLUSIONS = [
  ...[...DROP_FEES].map((slug) => ({
    slug,
    field: 'entryFees',
    reason:
      'The entry price circulating for this place came from the operator’s own social posts, where the amount contradicted its own label (“Rs. 1,000 (Rs. 500 redeemable)”). No tariff page could be read, so no price is published.',
  })),
  ...Object.entries(SUPPRESS).map(([slug, v]) => ({
    slug,
    field: v.groups.includes('coordinates') ? 'coordinates' : 'address',
    reason: v.reason,
  })),
  ...[...DROP_ENTRY_CONDITIONS].map((slug) => ({
    slug,
    field: 'entryConditions',
    reason:
      'The only published rule was the Commissioner Karachi swimming-ban notification, which covers 01.07–23.08.2026 — a window that has closed. Presenting it as a current condition would mislead, so it is not shown.',
  })),
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** "09:00am", "9:30 a.m", "11.00 pm", "10:00 PM" -> "21:00"; null when unparseable. */
function to24(raw) {
  if (raw == null) return null;
  const s = String(raw)
    .toLowerCase()
    .replace(/([ap])\./g, '$1') // "a.m"/"p.m" -> "am"/"pm"
    .replace(/\s+/g, ' ')
    .trim();
  const m = s.match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (m[3] === 'pm' && h !== 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/**
 * Research files state opening times three different ways — {open, close} pairs,
 * one "09:00am - 10:00pm" string, or a bare "Closed". Normalise all of them to
 * the app's {day, open} shape, then fold runs of identical days into one row so
 * a seven-day tariff block does not become seven near-identical lines.
 */
function hoursFrom(record) {
  if (!Array.isArray(record.hours)) return null;
  const perDay = record.hours.map((h) => {
    const day = h.day;
    if (h.closed || h.open == null || /^closed$/i.test(String(h.open))) return { day, value: 'Closed' };
    if (h.close) {
      const a = to24(h.open);
      const b = to24(h.close);
      return { day, value: a && b ? `${a} – ${b}` : `${h.open} – ${h.close}` };
    }
    const range = String(h.open).split(/\s+[–-]\s+/);
    if (range.length === 2) {
      const a = to24(range[0]);
      const b = to24(range[1]);
      return { day, value: a && b ? `${a} – ${b}` : String(h.open).trim() };
    }
    const single = to24(h.open);
    return { day, value: single ? `${single}` : String(h.open).trim() };
  });

  const rows = [];
  for (const { day, value } of perDay) {
    const last = rows[rows.length - 1];
    const dayIsConsecutive = last && DAYS.indexOf(last.to) + 1 === DAYS.indexOf(day);
    if (last && last.value === value && dayIsConsecutive) last.to = day;
    else rows.push({ from: day, to: day, value });
  }
  return rows.map((r) => ({
    day: r.from === r.to ? r.from : `${r.from} – ${r.to}`,
    open: r.value,
  }));
}

/**
 * Fee labels carry their provenance inline: "Green Ticket (…) — official Ticket
 * Info page" or "Adult (press: entry fee set at Rs 50, reported by Geo.tv)".
 * Split that tail off into the `basis` flag. "Full Annual Pass — Family of 3"
 * has no provenance tail, so the dash there must survive.
 */
function splitProvenance(label) {
  const parts = String(label).split(/\s+—\s+/);
  if (parts.length === 2 && /official|press|page|reported|stated/i.test(parts[1])) {
    return { label: parts[0].trim(), provenance: parts[1] };
  }
  return { label: String(label), provenance: '' };
}

function feesFrom(record, slug) {
  if (DROP_FEES.has(slug) || !Array.isArray(record.ticketPrices)) return undefined;
  return record.ticketPrices.map((t) => {
    const { label, provenance } = splitProvenance(t.label);
    // "(press: …)" inside parentheses is the other way researchers tag a source.
    const pressish = /press|Geo\.tv|Dawn/i.test(`${provenance} ${label}`);
    return {
      label: label.replace(/\s*\((?:official wording|press:[^)]*)\)?\s*$/i, '').replace(/\s+/g, ' ').trim(),
      amount: Number(t.amount),
      currency: t.currency ?? 'PKR',
      basis: pressish ? 'press' : 'official',
    };
  });
}

/**
 * Contacts arrive as an object, or as "Label: number; Label: email" strings with
 * a trailing address pasted in. Keep every line that actually has a number in
 * it, drop the e-mails (they go to `email`) and cut the address fragment.
 */
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

function contactFrom(c) {
  if (c == null) return {};
  const raw = typeof c === 'object' ? [c.phone, c.email].filter(Boolean).join('; ') : String(c);
  const email = (raw.match(EMAIL_RE) ?? [])[0];
  const lines = raw
    .replace(EMAIL_RE, '')
    .replace(/\((?![\d+\s-])[^\)]*\)/g, '') // "(also a Fax …)" is a note; "(021)" is part of the number
    .replace(/\s+[-–]\s+[^;]*$/, (m) => (/[a-z]/i.test(m) ? '' : m)) // trailing address, not a dash in a number
    .split(/[;]/)
    .flatMap((s) => s.split(/\s+\/\s+/)) // one line may hold a list of alternate numbers
    .map((s) => s.replace(/^Tel\.?\s*/i, '').replace(/\s+/g, ' ').replace(/[:,]\s*$/, '').trim())
    .filter((s) => /\d/.test(s));
  return { phone: lines.length ? lines.join('; ') : undefined, email };
}

/**
 * "No official entry restriction found. The Commissioner …" is a research note
 * about missing evidence, not something a visitor can act on. Publish only the
 * rules that were actually stated somewhere.
 */
function conditionsFrom(record, slug) {
  if (DROP_ENTRY_CONDITIONS.has(slug) || !record.entryConditions) return undefined;
  const s = String(record.entryConditions).trim();
  if (/^no official .*?(found|retrieved)/i.test(s)) return undefined;
  return s;
}

/** Nominatim's "W479576908" -> the OSM element page, a stable citation. */
function osmUrlFromToken(token) {  const m = /^([NWR])(\d+)$/.exec(String(token ?? ''));
  if (!m) return null;
  return `https://www.openstreetmap.org/${{ N: 'node', W: 'way', R: 'relation' }[m[1]]}/${m[2]}`;
}

/** The research files spell OSM ids three different ways; publish one. */
function osmIdFrom(r, osm) {
  if (osm.osmToken) return osm.osmToken;
  if (typeof r.osmId === 'string') return r.osmId;
  // A bare number carries no element type (node vs way) — keep it as evidence,
  // but do not build a link from a guess.
  return r.osmId != null ? String(r.osmId) : undefined;
}

/**
 * Research files cite sources two ways: {url, supports:[field…]} (batches a/b)
 * or "url (what it was used for)" (batches c/d). Normalise both into
 * {url, supports, note} so the /sources page can print one shape.
 */
const FIELD_TOKENS = new Set([
  'lat', 'lng', 'osmId', 'osmName', 'address', 'name', 'coordinates', 'website', 'hours',
  'ticketPrices', 'entryConditions', 'contact', 'phone', 'email', 'description', 'photo', 'facilities',
  'accessibility', 'familySuitability',
]);

function sourcesFrom(record, batch) {
  if (!Array.isArray(record.sources)) return [];
  return record.sources.map((s) => {
    const raw = typeof s === 'string' ? s : String(s.url ?? '');
    let url = raw.trim();
    let note = typeof s === 'string' ? '' : String(typeof s.supports === 'string' ? s.supports : '');
    if (typeof s === 'string') {
      const m = url.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
      if (m) {
        try {
          url = new URL(m[1]).href;
          note = m[2].trim();
        } catch {
          /* the parenthesis belonged to the URL itself */
        }
      }
    }
    const tokens = Array.isArray(s?.supports)
      ? s.supports.filter((t) => typeof t === 'string' && FIELD_TOKENS.has(t))
      : note
          .split(/[,;\s]+/)
          .map((t) => t.replace(/[^a-zA-Z]/g, ''))
          .filter(Boolean)
          .map((t) => t.toLowerCase());
    // Only a pure list of field names may become "backs". A sentence that happens
    // to contain the word "hours" — “checked for hours and entry fee: NONE
    // published” — is evidence of absence, and printing it as a covered field
    // would claim the opposite of what the researcher wrote.
    const isFieldList = tokens.length > 0 && tokens.every((t) => FIELD_TOKENS.has(t));
    return { url, supports: isFieldList ? [...new Set(tokens)] : [], note, batch };
  });
}

/**
 * What the researcher concluded about the evidence is published on /sources, not
 * on the visitor's page — including the passages that say a rule could not be
 * found, which `conditionsFrom` keeps out of entryConditions.
 */
function notesFrom(record, batch) {
  const notes = [];
  if (!isBlank(record.notes)) notes.push({ kind: 'evidence', text: String(record.notes).trim(), batch });
  if (!isBlank(record.entryConditions) && !conditionsFrom(record, '')) {
    notes.push({ kind: 'absence', text: String(record.entryConditions).trim(), batch });
  }
  return notes;
}

/** Which fields the shipped override actually carries, so /sources says what a source was allowed to say. */
function publishedFields(o) {
  const f = ['lat', 'lng', 'address', 'sourceUrl', 'osmId', 'lastVerified'].filter((k) => o[k] != null);
  if (o.hours?.length) f.push('hours');
  if (o.entryFees?.length) f.push('entryFees');
  if (o.entryConditions) f.push('entryConditions');
  if (o.website) f.push('website');
  if (o.phone) f.push('phone');
  if (o.email) f.push('email');
  if (o.facilities?.length) f.push('facilities');
  if (o.description) f.push('description');
  return f;
}

/**
 * A place can appear in more than one batch: the first pass pins it and names it,
 * a later pass re-checks the practical details it could not find. Merge on the
 * research name before anything ships, so a re-check adds evidence instead of
 * overwriting the first one.
 */
const MERGED_FIELDS = [
  'lat',
  'lng',
  'address',
  'website',
  'contact',
  'hours',
  'ticketPrices',
  'entryConditions',
  'facilities',
  'description',
  'osmId',
  'openStreetMapLink',
];

/**
 * "contact.phone" is a path inside the research record; the field the catalogue
 * actually carries is "phone". Published lists (missingFields, notFound) must name
 * the shipped field, or /sources reports a gap in something that does not exist.
 */
function canonicalField(f) {
  return String(f).replace(/^contact./, '');
}

/** Field a later batch may fill or correct, except coordinates (see PIN CONFLICT below). */
function isBlank(v) {
  return v == null || (Array.isArray(v) && v.length === 0) || (typeof v === 'string' && !v.trim());
}

/**
 * batch-f was contracted for opening hours and fees at seven sites and returned
 * the finding that their official managers publish neither. Its entryConditions
 * prose is therefore a record of absence, not a visitor rule.
 */
const ABSENCE_BATCHES = new Set(['batch-f-practical']);

const CONFIDENCE_RANK = { verified: 0, 'partially-verified': 1, unverified: 2 };

const entries = new Map();

const out = { generatedFrom: [], note: 'Values copied from docs/verification/; absent means no source was found.', overrides: {} };
const provenance = {
  generatedFrom: [],
  note: 'Per-record citations written by .tools/apply-verification.mjs from docs/verification/. Nothing here is hand-transcribed.',
  records: {},
  exclusions: EXCLUSIONS,
};

for (const batch of BATCHES) {
  const path = `docs/verification/${batch}.json`;
  if (!existsSync(path)) {
    console.log(`skip ${batch} (not written yet)`);
    continue;
  }
  out.generatedFrom.push(path);
  provenance.generatedFrom.push(path);
  for (const raw of JSON.parse(readFileSync(path, 'utf8'))) {
    let r = raw;
    if (ABSENCE_BATCHES.has(batch) && !isBlank(raw.entryConditions)) r = { ...raw, entryConditions: null };
    const prev = entries.get(r.name);
    if (!prev) {
      entries.set(r.name, {
        record: { ...r },
        sources: sourcesFrom(raw, batch),
        notes: notesFrom(raw, batch),
        missing: [...(Array.isArray(r.missingFields) ? r.missingFields : [])].map(canonicalField),
        confidences: [r.confidence].filter(Boolean),
        dates: [r.lastVerified].filter(Boolean),
        batches: [batch],
      });
      continue;
    }
    for (const k of MERGED_FIELDS) {
      if (isBlank(r[k])) continue;
      // A re-check that lands a different pin is a disagreement, not an update:
      // the first coordinate was chosen deliberately (beach ends, building nodes),
      // so it is kept and the conflict is reported for a human to resolve.
      if ((k === 'lat' || k === 'lng') && Math.abs(Number(r[k]) - Number(prev.record[k])) > 0.0009) {
        console.log(`PIN CONFLICT: ${r.name} ${k} ${prev.record[k]} vs ${r[k]} in ${batch} — kept the first value`);
        continue;
      }
      prev.record[k] = r[k];
    }
    prev.sources.push(...sourcesFrom(raw, batch));
    prev.notes.push(...notesFrom(raw, batch));
    prev.missing.push(...(Array.isArray(r.missingFields) ? r.missingFields : []).map(canonicalField));
    if (r.confidence) prev.confidences.push(r.confidence);
    if (r.lastVerified) prev.dates.push(r.lastVerified);
    prev.batches.push(batch);
  }
}

/**
 * The seed files read without the verified overlay. `isNew` can only mean "the
 * catalogue did not already carry this place", but the composed listings module
 * folds the previous run's new records into its export — so a slug merged twice
 * would look seeded the second time and quietly lose its copy. These nine
 * modules are the actual seed, and none of them import the overrides.
 */
async function seededSlugs() {
  const bundle = await build({
    stdin: {
      contents: `
        export { attractions } from './listings/attractions';
        export { culture } from './listings/culture';
        export { civic } from './listings/civic';
        export { dining } from './listings/dining';
        export { education } from './listings/education';
        export { health } from './listings/health';
        export { parksAndBeaches } from './listings/parks';
        export { shopping } from './listings/shopping';
        export { stays } from './listings/stays';
      `,
      resolveDir: join(resolve('.'), 'src/data'),
      loader: 'ts',
    },
    bundle: true, format: 'esm', platform: 'neutral', write: false, logLevel: 'silent',
  });
  const file = join(mkdtempSync(join(tmpdir(), 'karachify-seed-')), 'seed.mjs');
  writeFileSync(file, bundle.outputFiles[0].text);
  const mod = await import(pathToFileURL(file).href);
  return new Set(Object.values(mod).flat().map((l) => l.slug));
}

const seeded = await seededSlugs();
const claimedBySlug = new Map();

for (const entry of entries.values()) {
  const r = entry.record;
  const known = SLUG_MAP[r.name];
  const fresh = NEW_RECORDS[r.name];
  // A batch record that names its own catalogue entry wins over the name maps:
  // the maps were written for the research files that spell places differently
  // from the site, and matching by spelling is how one record overwrote another.
  const slug = r.slug ?? known ?? fresh?.slug;
  if (!slug) {
    console.log(`UNMAPPED: ${r.name} — add it to SLUG_MAP or NEW_RECORDS`);
    continue;
  }
  const isSeeded = seeded.has(slug);
  if (!isSeeded && !fresh) {
    console.log(`NEW WITHOUT COPY: ${slug} ("${r.name}") — the catalogue has no such entry and NEW_RECORDS has no copy for it`);
    continue;
  }
  if (claimedBySlug.has(slug)) {
    console.log(`SLUG CONFLICT: "${r.name}" and "${claimedBySlug.get(slug)}" both resolve to ${slug} — kept the first`);
    continue;
  }
  claimedBySlug.set(slug, r.name);
  if (!known && !r.slug) console.log(`note: ${slug} matched only by research spelling, not by an explicit slug`);
  const contactOnly = r.contactOnly === true;
  if (!contactOnly && (!r.lat || !r.lng)) {
    console.log(`NO COORDS: ${r.name} — not merged`);
    continue;
  }
  const osm = OSM_ADDRESSES[r.name] ?? {};
  const address = cleanAddress(osm.address || r.address || '');
  if (!contactOnly && !address) {
    console.log(`NO ADDRESS: ${r.name} — check osm-addresses.json`);
    continue;
  }
  // Coordinates come from the research file: for linear features (a 7 km beach
  // mapped as a way) the researcher picked the reachable end, which Nominatim's
  // centroid would not. Guard against a typo rather than against a choice.
  const lat = Number(r.lat);
  const lng = Number(r.lng);
  if (!contactOnly && !(lat > 23.5 && lat < 26.5 && lng > 66.0 && lng < 68.7)) {
    console.log(`OUT OF BOUNDS: ${r.name} — ${lat},${lng}. Not merged.`);
    continue;
  }
  const { phone, email } = contactFrom(r.contact);
  const conditions = conditionsFrom(r, slug);
  // The worst confidence across the batches wins: a re-check that found no
  // tariff page cannot upgrade a record the first pass called partial.
  const confidence = [...entry.confidences].sort((a, b) => (CONFIDENCE_RANK[b] ?? 9) - (CONFIDENCE_RANK[a] ?? 9))[0];
  // The earliest date, not the latest: `lastVerified` vouches for every field on
  // the page, so it can only claim the least recently checked one.
  const lastVerified = [...entry.dates].sort()[0] ?? null;
  const o = {
    // Derived from the seed files, not from which map the name happened to be
    // in: an existing listing that research located is not a new record.
    isNew: !isSeeded,
    ...(fresh
      ? {
          categoryId: fresh.categoryId,
          areaId: fresh.areaId,
          name: NAME_FROM_OSM[slug] ?? r.name,
          description: fresh.description,
        }
      : {}),
    // A hotline is not a place. Research can verify the number a service
    // publishes without verifying any building it works from, so a contact-only
    // record writes no pin at all and refuses the seeded street address.
    ...(contactOnly
      ? { address: address ? address.charAt(0).toUpperCase() + address.slice(1) : null }
      : {
          lat,
          lng,
          coordsVerified: true,
          address: address.charAt(0).toUpperCase() + address.slice(1),
        }),
    hours: hoursFrom(r),
    entryFees: feesFrom(r, slug),
    website: r.website ?? undefined,
    phone,
    email,
    status: confidence === 'verified' ? 'verified' : 'needs-review',
    sourceUrl: osmUrlFromToken(osm.osmToken) ?? r.openStreetMapLink ?? entry.sources[0]?.url,
    lastVerified,
    osmId: contactOnly ? undefined : osmIdFrom(r, osm),
  };
  if (conditions) o.entryConditions = conditions;
  if (r.facilities?.length) o.facilities = r.facilities;
  for (const group of SUPPRESS[slug]?.groups ?? []) {
    for (const key of SUPPRESS_FIELDS[group]) delete o[key];
  }
  // A refused pin also refuses the link that pointed at it: the record's one
  // "read the source" link must back a field the page actually shows.
  if (SUPPRESS[slug] && entry.sources.length) {
    const shipped = new Set(publishedFields(o));
    const fits = (c) => (c.supports ?? []).some((t) => shipped.has(t) || (t === 'contact' && (o.phone || o.email)));
    const better = entry.sources.find((c) => fits(c) && !/openstreetmap|nominatim|overpass/i.test(c.url));
    if (better) o.sourceUrl = better.url;
  }
  out.overrides[slug] = o;
  provenance.records[slug] = {
    researchName: r.name,
    status: o.status,
    lastVerified,
    confidence,
    batches: entry.batches,
    published: publishedFields(o),
    sources: entry.sources,
    notFound: [...new Set(entry.missing)].filter((f) => isBlank(r[f])),
    notes: entry.notes,
  };
  console.log(`merged ${slug} (${confidence}, ${entry.batches.length} batch${entry.batches.length > 1 ? 'es' : ''})`);
}

writeFileSync('src/data/verified-overrides.json', JSON.stringify(out, null, 2) + '\n');
writeFileSync('src/data/provenance.json', JSON.stringify(provenance, null, 2) + '\n');
console.log(`\nwrote src/data/verified-overrides.json with ${Object.keys(out.overrides).length} records`);
console.log(`wrote src/data/provenance.json with ${Object.keys(provenance.records).length} citations`);
