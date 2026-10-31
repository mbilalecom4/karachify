#!/usr/bin/env node
// Builds src/data/verified-overrides.json from the research files in
// docs/verification/. Nothing here is invented: every value comes from a batch
// record, and each batch record names the URL it was read from.
//
// Deliberate exclusions live in DROP_* below so the reasons stay in the repo.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const BATCHES = ['batch-a-heritage', 'batch-c-coastline', 'batch-d-attractions', 'batch-b-museums'];

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
};

/**
 * New records need visitor-facing copy, and the research files are written as
 * provenance notes. These three sentences restate only facts the batch records
 * already carry (OSM geometry, official-site pages), nothing added.
 */
const NEW_RECORDS = {
  'Hawksbay Beach': {
    slug: 'hawksbay-beach',
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
const NAME_FROM_OSM = { 'hawksbay-beach': "Hawke's Bay Beach" };

/** The Latin-script address re-read from Nominatim with accept-language=en. */
const OSM_ADDRESSES = JSON.parse(readFileSync('docs/verification/osm-addresses.json', 'utf8'));

/** Nominatim returns "Karāchi District" for some records; keep one spelling. */
function cleanAddress(s) {
  return String(s)
    .replace(/\s+/g, ' ')
    .replace(/Karāchi/g, 'Karachi')
    .trim();
}

// The amount (Rs 1,000) contradicts its own label ("Rs. 500 redeemable"), and
// both came from social posts rather than a tariff page, so it is not published.
const DROP_FEES = new Set(['port-grand']);
// The Commissioner Karachi swimming-ban notification covers 01.07-23.08.2026, a
// window that has closed. Showing it as a live entry condition would mislead.
const DROP_ENTRY_CONDITIONS = new Set(['clifton-beach', 'seaview-point', 'sandspit-beach', 'manora-island', 'hawksbay-beach']);

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
    .replace(/\s*\(stated 24\/7\)/gi, '')
    .replace(/\s+[-–]\s+[^;]*$/, (m) => (/[a-z]/i.test(m) ? '' : m)) // trailing address, not a dash in a number
    .split(';')
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
function osmUrlFromToken(token) {
  const m = /^([NWR])(\d+)$/.exec(String(token ?? ''));
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

const out = { generatedFrom: [], note: 'Values copied from docs/verification/; absent means no source was found.', overrides: {} };

for (const batch of BATCHES) {
  const path = `docs/verification/${batch}.json`;
  if (!existsSync(path)) {
    console.log(`skip ${batch} (not written yet)`);
    continue;
  }
  out.generatedFrom.push(path);
  for (const r of JSON.parse(readFileSync(path, 'utf8'))) {
    const known = SLUG_MAP[r.name];
    const fresh = NEW_RECORDS[r.name];
    const slug = known ?? fresh?.slug;
    if (!slug) {
      console.log(`UNMAPPED: ${r.name} — add it to SLUG_MAP or NEW_RECORDS`);
      continue;
    }
    if (!r.lat || !r.lng) {
      console.log(`NO COORDS: ${r.name} — not merged`);
      continue;
    }
    const osm = OSM_ADDRESSES[r.name] ?? {};
    const address = cleanAddress(osm.address || r.address || '');
    if (!address) {
      console.log(`NO ADDRESS: ${r.name} — check osm-addresses.json`);
      continue;
    }
    // Coordinates come from the research file: for linear features (a 7 km beach
    // mapped as a way) the researcher picked the reachable end, which Nominatim's
    // centroid would not. Guard against a typo rather than against a choice.
    const lat = Number(r.lat);
    const lng = Number(r.lng);
    if (!(lat > 23.5 && lat < 26.5 && lng > 66.0 && lng < 68.7)) {
      console.log(`OUT OF BOUNDS: ${r.name} — ${lat},${lng}. Not merged.`);
      continue;
    }
    const { phone, email } = contactFrom(r.contact);
    const conditions = conditionsFrom(r, slug);
    const o = {
      isNew: !known,
      ...(fresh
        ? {
            categoryId: fresh.categoryId,
            areaId: fresh.areaId,
            name: NAME_FROM_OSM[slug] ?? r.name,
            description: fresh.description,
          }
        : {}),
      lat,
      lng,
      coordsVerified: true,
      address: address.charAt(0).toUpperCase() + address.slice(1),
      hours: hoursFrom(r),
      entryFees: feesFrom(r, slug),
      website: r.website ?? undefined,
      phone,
      email,
      status: r.confidence === 'verified' ? 'verified' : 'needs-review',
      sourceUrl: osmUrlFromToken(osm.osmToken) ?? r.openStreetMapLink ?? (Array.isArray(r.sources) ? r.sources[0] : undefined),
      lastVerified: r.lastVerified,
      osmId: osmIdFrom(r, osm),
    };
    if (conditions) o.entryConditions = conditions;
    if (!DROP_ENTRY_CONDITIONS.has(slug) && r.entryConditions) o.entryConditions = String(r.entryConditions).trim();
    if (r.facilities?.length) o.facilities = r.facilities;
    out.overrides[slug] = o;
    console.log(`merged ${slug} (${r.confidence})`);
  }
}

writeFileSync('src/data/verified-overrides.json', JSON.stringify(out, null, 2) + '\n');
console.log(`\nwrote src/data/verified-overrides.json with ${Object.keys(out.overrides).length} records`);
