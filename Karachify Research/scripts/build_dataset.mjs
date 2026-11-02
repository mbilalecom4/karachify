// Build a Karachify-compatible dataset from OpenStreetMap (Overpass) raw data.
// OSM data (c) OpenStreetMap contributors, ODbL 1.0.
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const RAW = path.resolve('_raw/osm');
const OUT = path.resolve('data');
const TODAY = new Date().toISOString().slice(0, 10);

// ---- Karachify taxonomy (must match src/data/taxonomy.ts) --------------------
const AREAS = [
  ['clifton', 'Clifton', 24.81, 67.03],
  ['dha', 'DHA', 24.82, 67.05],
  ['saddar', 'Saddar', 24.862, 67.009],
  ['gulshan-e-iqbal', 'Gulshan-e-Iqbal', 24.813, 67.099],
  ['gulistan-e-johar', 'Gulistan-e-Johar', 24.845, 67.068],
  ['pechs', 'PECHS', 24.83, 67.047],
  ['north-nazimabad', 'North Nazimabad', 24.89, 67.025],
  ['federal-b-area', 'Federal B Area', 24.85, 67.029],
  ['bahadurabad', 'Bahadurabad', 24.857, 67.046],
  ['korangi', 'Korangi', 24.83, 67.12],
  ['malir', 'Malir', 24.89, 67.17],
  ['lyari', 'Lyari', 24.89, 66.965],
  ['shahrah-e-faisal', 'Shahrah-e-Faisal', 24.835, 67.03],
  ['gulberg-karachi', 'Gulberg', 24.851, 67.018],
  ['kemari', 'Kemari', 24.835, 66.95],
  ['orangi-town', 'Orangi Town', 24.85, 66.945],
  ['landhi', 'Landhi', 24.815, 67.18],
  ['surjani-town', 'Surjani Town', 24.932, 66.985],
];

// Extra locality hints -> nearest Karachify area (raw locality kept in research.areaRaw)
const LOCALITY_HINT = {
  'dha phase 1': 'dha', 'dha phase 2': 'dha', 'dha phase 4': 'dha', 'dha phase 5': 'dha',
  'dha phase 6': 'dha', 'dha phase 7': 'dha', 'dha phase 8': 'dha', 'defence': 'dha',
  'clifton block 1': 'clifton', 'clifton block 2': 'clifton', 'clifton block 5': 'clifton',
  'clifton block 6': 'clifton', 'clifton block 7': 'clifton', 'clifton block 8': 'clifton',
  'bath island': 'clifton', 'civil lines': 'saddar', 'cantt': 'saddar', 'saddar': 'saddar',
  'garden': 'saddar', 'empress market': 'saddar', 'burns road': 'saddar',
  'gulshan-e-iqbal': 'gulshan-e-iqbal', 'gulshan e iqbal': 'gulshan-e-iqbal',
  'gulistan-e-johar': 'gulistan-e-johar', 'gulistan e johar': 'gulistan-e-johar',
  'johar': 'gulistan-e-johar', 'pechs': 'pechs', 'bahadurabad': 'bahadurabad',
  'north nazimabad': 'north-nazimabad', 'nazimabad': 'north-nazimabad',
  'federal b area': 'federal-b-area', 'f.b area': 'federal-b-area', 'fb area': 'federal-b-area',
  'korangi': 'korangi', 'malir': 'malir', 'lyari': 'lyari', 'gulberg': 'gulberg-karachi',
  'kemari': 'kemari', 'keamari': 'kemari', 'orangi': 'orangi-town', 'landhi': 'landhi',
  'surjani': 'surjani-town', 'shahrah-e-faisal': 'shahrah-e-faisal', 'shahrah e faisal': 'shahrah-e-faisal',
  'gulshan': 'gulshan-e-iqbal', 'scheme 33': 'gulshan-e-iqbal', 'university road': 'gulshan-e-iqbal',
  'tariq road': 'pechs', 'bahadurabad': 'bahadurabad', 'sindhi muslim': 'pechs',
  'khadda market': 'dha', 'phase 6': 'dha', 'phase 5': 'dha', 'seaview': 'clifton',
  'sea view': 'clifton', 'do talwar': 'clifton', 'zainab market': 'saddar',
  'soldier bazar': 'saddar', 'sadar': 'saddar', 'gurumandir': 'saddar',
};

const CATEGORY_MAP = {
  restaurants: ['restaurants-cafes', 'restaurant'],
  cafes: ['restaurants-cafes', 'cafe'],
  fast_food: ['restaurants-cafes', 'fast_food'],
  hotels: ['hotels', 'hotel'],
  hospitals: ['hospitals', 'hospital'],
  universities: ['universities', 'university'],
  schools: ['schools', 'school'],
  parks: ['parks-recreation', 'park'],
  attractions: ['tourist-places', 'attraction'],
  beaches: ['beaches', 'beach'],
  religious: ['religious-places', 'place_of_worship'],
  shopping: ['shopping', 'shop'],
  pharmacies: ['pharmacies-labs', 'pharmacy'],
  transport: ['transport', 'transport'],
  events_venues: ['wedding-venues', 'event_venue'],
  sports: ['sports-fitness', 'sports'],
  government: ['government', 'government_office'],
  banks: ['professional-services', 'bank'],
  fuel: ['transport', 'fuel_station'],
  art_culture: ['art-culture', 'art_culture'],
  emergency: ['emergency', 'emergency_service'],
};

// Well-known Karachi names — used only as a prominence signal, never as a data source.
const KNOWN_BRANDS = [
  'kolachi', 'bbq tonight', 'bar b q tonight', 'kababjees', 'lal qila', 'chandni', 'al bustan',
  'sakura', 'ginsoy', 'ocean', 'casa bianca', 'la marea', 'tao', 'dynasty', 'china town',
  'waheed kabab', 'student biryani', 'javed nihari', 'zahid nihari', 'sabri nihari', 'delhi nihari',
  'burns road', 'hobnob', 'xanders', 'biggles', 'vista', 'mocca', 'butlers', 'gloria jeans',
  'coffee bean', 'espresso', 'chai wala', 'chai khana', 'cafe aylanto', 'arcadian', 'moscow cafe',
  'float', 'flo', 'burger o clock', 'hardees', 'kfc', 'mcdonald', 'pizza hut', 'dominos',
  'subway', 'starbucks', 'second cup', 'secret recipe', 'broadway pizza', 'jinnah',
  'pearl continental', 'movenpick', 'marriott', 'serena', 'avari', 'regent plaza', 'beach luxury',
  'aga khan', 'liaquat national', 'zubaida', 'nicvd', 'indus hospital', 'siut', 'south city',
  'dow university', 'aku', 'iba', 'nust', 'habib university', 'fast', 'ned', 'karachi university',
  'paf museum', 'mohatta', 'mazar-e-quaid', 'frere hall', 'empress market', 'clifton beach',
  'hawkes bay', 'sandspit', 'manora', 'churna island', 'port grand', 'dolmen', 'lucky one',
  'ocean mall', 'atrium', 'centaurus', 'forum', 'hyperstar', 'imtiaz', 'naheed', 'metro',
];

function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/['’`]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
}

function distKm(aLat, aLng, bLat, bLng) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function nearestArea(lat, lng, hint) {
  if (hint) {
    const key = hint.toLowerCase().trim();
    for (const [k, v] of Object.entries(LOCALITY_HINT)) if (key === k || key.includes(k)) return v;
  }
  let best = AREAS[0];
  let bestD = Infinity;
  for (const a of AREAS) {
    const d = distKm(lat, lng, a[2], a[3]);
    if (d < bestD) { bestD = d; best = a; }
  }
  return best[0];
}

function firstTag(t, keys) {
  for (const k of keys) if (t[k] && String(t[k]).trim()) return String(t[k]).trim();
  return undefined;
}

function normalisePhone(raw) {
  if (!raw) return undefined;
  const cleaned = raw.replace(/[^\d+]/g, '');
  if (!cleaned) return undefined;
  if (cleaned.startsWith('+92')) return cleaned;
  if (cleaned.startsWith('0092')) return '+92' + cleaned.slice(4);
  if (cleaned.startsWith('92') && cleaned.length >= 11) return '+' + cleaned;
  if (cleaned.startsWith('0')) return '+92' + cleaned.slice(1);
  return cleaned;
}

const DAY_SPAN = {
  mo: 'Monday', tu: 'Tuesday', we: 'Wednesday', th: 'Thursday', fr: 'Friday', sa: 'Saturday', su: 'Sunday',
};

function parseHours(raw) {
  if (!raw) return undefined;
  const s = raw.trim();
  if (/^24\/7$/i.test(s)) return [{ day: 'Every day', open: '24 hours' }];
  // e.g. "Mo-Su 10:00-23:00" or "Mo-Sa 09:00-22:00; Su 12:00-22:00"
  const parts = s.split(';').map((x) => x.trim()).filter(Boolean);
  const out = [];
  for (const part of parts) {
    const m = part.match(/^([A-Za-z,\-\s]+)\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
    if (!m) { out.length = 0; break; }
    const days = m[1].trim();
    const span = days.split('-').map((x) => x.trim().toLowerCase());
    let dayLabel = days;
    if (span.length === 2 && DAY_SPAN[span[0]] && DAY_SPAN[span[1]]) {
      dayLabel = `${DAY_SPAN[span[0]]} – ${DAY_SPAN[span[1]]}`;
    } else if (DAY_SPAN[span[0]]) {
      dayLabel = DAY_SPAN[span[0]];
    }
    out.push({ day: dayLabel, open: `${m[2]} – ${m[3]}` });
  }
  if (out.length) return out;
  const simple = s.match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
  if (simple) return [{ day: 'Every day', open: `${simple[1]} – ${simple[2]}` }];
  return [{ day: 'Opening hours (as tagged on OSM)', open: s }];
}

const CUISINE_SPLIT = /[;,]/;

function buildAddress(t, areaName) {
  const parts = [
    firstTag(t, ['addr:housenumber']),
    firstTag(t, ['addr:street']),
    firstTag(t, ['addr:suburb', 'addr:neighbourhood', 'addr:quarter', 'addr:district']),
    firstTag(t, ['addr:city']),
  ].filter(Boolean);
  if (parts.length >= 2) return parts.join(', ');
  if (parts.length === 1) return `${parts[0]}, ${areaName}, Karachi`;
  return `${areaName}, Karachi`;
}

function isClosed(t) {
  const keys = Object.keys(t);
  if (keys.some((k) => /^(disused|abandoned|closed|was):/.test(k))) return true;
  if (t.opening_hours && /^closed$/i.test(t.opening_hours.trim())) return true;
  if (t['shop'] === 'vacant' || t['amenity'] === 'vacant') return true;
  return false;
}

function prominence(t, name) {
  let score = 0;
  if (t.website || t['contact:website']) score += 4;
  if (t.phone || t['contact:phone'] || t['contact:mobile']) score += 3;
  if (t.opening_hours) score += 2;
  if (t.wikidata) score += 5;
  if (t.wikipedia) score += 5;
  if (t['addr:street']) score += 1;
  if (t.description) score += 1;
  if (t.brand) score += 2;
  if (t.cuisine) score += 1;
  const n = name.toLowerCase();
  if (KNOWN_BRANDS.some((b) => n.includes(b))) score += 6;
  return score;
}

// ---- load raw ---------------------------------------------------------------
const files = (await readdir(RAW)).filter((f) => f.endsWith('.json'));
const records = [];
const seenSlug = new Map();

for (const file of files) {
  const group = file.replace(/\.json$/, '');
  const [_categoryId, _subcategory] = CATEGORY_MAP[group] ?? [null, group];
  if (!_categoryId) continue;
  const { elements } = JSON.parse(await readFile(path.join(RAW, file), 'utf8'));

  for (const el of elements) {
    const t = el.tags ?? {};
    let categoryId = _categoryId;
    let subcategory = _subcategory;
    // refine categories that share one OSM selector
    if (group === 'hospitals' && t.amenity === 'clinic') { categoryId = 'doctors-clinics'; subcategory = 'clinic'; }
    if (group === 'attractions' && (t.tourism === 'museum' || t.tourism === 'gallery')) {
      categoryId = 'museums-galleries'; subcategory = t.tourism;
    }
    if (group === 'attractions' && t.tourism === 'zoo') { categoryId = 'parks-recreation'; subcategory = 'zoo'; }
    if (group === 'attractions' && t.tourism === 'theme_park') { categoryId = 'parks-recreation'; subcategory = 'theme_park'; }
    if (group === 'shopping' && t.shop === 'marketplace') { subcategory = 'market'; }

    const name = firstTag(t, ['name:en', 'name', 'official_name', 'brand']) ?? null;
    if (!name) continue;
    // drop generic placeholder names that carry no identifying information
    const GENERIC = /^(museum|park|masjid|mosque|school|hospital|clinic|market|beach|tower|building|shop|restaurant|cafe|hotel|pharmacy|bank|station|playground|garden|viewpoint|attraction)$/i;
    if (name.length < 3 || GENERIC.test(name.trim())) continue;

    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (typeof lat !== 'number' || typeof lng !== 'number') continue;

    const areaHint =
      firstTag(t, ['addr:suburb', 'addr:neighbourhood', 'addr:district', 'addr:city_district']) ??
      firstTag(t, ['addr:street']);
    const areaId = nearestArea(lat, lng, areaHint);
    const areaName = AREAS.find((a) => a[0] === areaId)[1];
    const nameSlug = slugify(name) || `osm-${el.type}-${el.id}`;
    const baseSlug = `${nameSlug}-${areaId}`;
    const n = (seenSlug.get(baseSlug) ?? 0) + 1;
    seenSlug.set(baseSlug, n);
    const slug = n === 1 ? baseSlug : `${baseSlug}-${n}`;

    const osmUrl = `https://www.openstreetmap.org/${el.type}/${el.id}`;
    const phoneRaw = firstTag(t, ['phone', 'contact:phone', 'contact:mobile', 'mobile']);
    const phone = normalisePhone(phoneRaw);
    const website = firstTag(t, ['website', 'contact:website', 'url']);
    const facebook = firstTag(t, ['contact:facebook', 'facebook']);
    const instagram = firstTag(t, ['contact:instagram', 'instagram']);
    const twitter = firstTag(t, ['contact:twitter', 'twitter']);
    const whatsapp = normalisePhone(firstTag(t, ['contact:whatsapp', 'whatsapp']));
    const hoursRaw = firstTag(t, ['opening_hours']);
    const cuisine = t.cuisine ? t.cuisine.split(CUISINE_SPLIT).map((x) => x.trim()).filter(Boolean) : [];

    const facilities = [];
    if (t.wheelchair === 'yes') facilities.push('Wheelchair accessible');
    if (t.outdoor_seating === 'yes') facilities.push('Outdoor seating');
    if (t.delivery === 'yes') facilities.push('Delivery');
    if (t.takeaway === 'yes') facilities.push('Takeaway');
    if (t.internet_access === 'wlan' || t.internet_access === 'yes') facilities.push('Wi-Fi');
    if (t.air_conditioning === 'yes') facilities.push('Air conditioning');
    if (t.parking === 'yes' || t['parking:lane']) facilities.push('Parking');

    const description = firstTag(t, ['description:en', 'description']);
    const tagline = `${subcategory.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())} in ${areaName}, Karachi`;
    const composed = description
      ? description
      : [
          `${name} is a ${subcategory.replace(/_/g, ' ')} in ${areaName}, Karachi.`,
          cuisine.length ? `Cuisine: ${cuisine.join(', ')}.` : '',
          `Record discovered from OpenStreetMap; not yet independently verified.`,
        ]
          .filter(Boolean)
          .join(' ');

    const closed = isClosed(t);
    const score = prominence(t, name);

    records.push({
      // ---- Karachify Listing fields ----
      id: slug,
      slug,
      cityId: 'karachi',
      categoryId,
      areaId,
      name,
      tagline,
      description: composed,
      address: buildAddress(t, areaName),
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      phone,
      website,
      email: firstTag(t, ['email', 'contact:email']),
      hours: parseHours(hoursRaw),
      priceRange: undefined,
      cuisine: cuisine.length ? cuisine : undefined,
      facilities,
      rating: 0,
      reviewCount: 0,
      tags: [...new Set([subcategory, ...cuisine.slice(0, 3), t.brand, t.operator].filter(Boolean))],
      featured: false,
      promoted: false,
      status: 'needs-review',
      sourceUrl: osmUrl,
      createdAt: TODAY,
      // ---- research metadata (not part of the TS interface; safe as extra fields) ----
      research: {
        subcategory,
        areaRaw: areaHint ?? null,
        closed,
        prominenceScore: score,
        phoneRaw: phoneRaw ?? null,
        whatsapp: whatsapp ?? null,
        socials: { facebook: facebook ?? null, instagram: instagram ?? null, twitter: twitter ?? null },
        openingHoursRaw: hoursRaw ?? null,
        brand: t.brand ?? t.operator ?? null,
        wikidata: t.wikidata ?? null,
        wikipedia: t.wikipedia ?? null,
        mapLinks: {
          osm: osmUrl,
          googleMaps: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
          bingMaps: `https://www.bing.com/maps?cp=${lat}~${lng}&lvl=16`,
        },
        sources: [{ url: osmUrl, type: 'openstreetmap', retrievedAt: TODAY, license: 'ODbL-1.0' }],
        verification: {
          date: TODAY,
          status: closed ? 'closed' : 'unverified',
          confidence: 'low',
          method: 'osm-import',
          notes: 'Imported from OpenStreetMap tags; fields reflect mapper-entered data and need a verification pass.',
        },
        ratingData: { value: null, count: null, source: null, date: null },
        services: [],
        prices: [],
        images: [],
        conflicts: [],
      },
    });
  }
}

// ---- dedupe ----------------------------------------------------------------
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const kept = [];
const dropped = [];
for (const rec of records) {
  const dup = kept.find(
    (k) =>
      (norm(k.name) === norm(rec.name) && distKm(k.lat, k.lng, rec.lat, rec.lng) < 0.15) ||
      (k.phone && rec.phone && k.phone === rec.phone && distKm(k.lat, k.lng, rec.lat, rec.lng) < 0.5),
  );
  if (dup) {
    dropped.push({
      duplicateOf: dup.id,
      name: rec.name,
      id: rec.id,
      coordinates: [rec.lat, rec.lng],
      matchedCoordinates: [dup.lat, dup.lng],
      distanceMeters: Math.round(distKm(dup.lat, dup.lng, rec.lat, rec.lng) * 1000),
      source: rec.sourceUrl,
    });
  } else {
    kept.push(rec);
  }
}

// ---- merge agent-verified curated records / patches --------------------------
try {
  const curFiles = (await readdir(path.resolve('_curated'))).filter((f) => f.endsWith('.json'));
  for (const f of curFiles) {
    const arr = JSON.parse(await readFile(path.resolve('_curated', f), 'utf8'));
    for (const item of arr) {
      if (item.patch && (item.id || item.match)) {
        const p = item.patch;
        let target;
        if (item.id) target = kept.find((k) => k.id === item.id);
        if (!target && item.match) {
          const needle = item.match.name.toLowerCase();
          const candidates = kept.filter((k) => k.name.toLowerCase().includes(needle));
          const pool = item.match.areaId ? candidates.filter((k) => k.areaId === item.match.areaId) : candidates;
          target =
            pool.find((k) => k.name.toLowerCase() === needle) ??
            pool.find((k) => k.name.toLowerCase().startsWith(needle)) ??
            pool[0];
        }
        if (!target) {
          console.warn(`patch target not found: ${item.id ?? item.match?.name}`);
          continue;
        }
        const research = { ...target.research, ...(p.research ?? {}) };
        research.sources = [...(target.research.sources ?? []), ...(p.research?.sources ?? [])];
        Object.assign(target, p, { research });
        continue;
      }
      const c = item;
      const match = kept.find(
        (k) =>
          (c.phone && k.phone && c.phone === k.phone && distKm(k.lat, k.lng, c.lat, c.lng) < 2) ||
          (norm(k.name) === norm(c.name) && distKm(k.lat, k.lng, c.lat, c.lng) < 3),
      );
      if (match) {
        const mergedResearch = { ...match.research, ...c.research };
        mergedResearch.sources = [...(match.research.sources ?? []), ...(c.research?.sources ?? [])];
        mergedResearch.images = c.research?.images ?? match.research.images;
        Object.assign(match, c, { research: mergedResearch });
      } else {
        kept.push(c);
      }
    }
  }
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}

// ---- presentation clean-up -------------------------------------------------
for (const r of kept) {
  if (r.research.verification.status === 'verified') {
    r.description = r.description.replace(
      'Record discovered from OpenStreetMap; not yet independently verified.',
      `Contact details verified against an official source on ${r.research.verification.date}.`,
    );
  }
}

// ---- sort (category, prominence, name) --------------------------------------
kept.sort((a, b) => a.categoryId.localeCompare(b.categoryId) || b.research.prominenceScore - a.research.prominenceScore || a.name.localeCompare(b.name));

// ---- outputs ---------------------------------------------------------------
await mkdir(OUT, { recursive: true });
await mkdir(path.join(OUT, 'by-category'), { recursive: true });

const byCategory = {};
for (const r of kept) (byCategory[r.categoryId] ??= []).push(r);
for (const [cat, rows] of Object.entries(byCategory)) {
  await writeFile(path.join(OUT, 'by-category', `${cat}.json`), JSON.stringify(rows, null, 1));
}

// ---- "top" shortlist per category (ranked by data completeness + brand signal) --
// Chains are capped so a shortlist reflects the category, not one brand's branches.
await mkdir(path.join(OUT, 'top'), { recursive: true });
for (const [cat, rows] of Object.entries(byCategory)) {
  const perBrand = new Map();
  const top = [];
  for (const r of [...rows].sort((a, b) => b.research.prominenceScore - a.research.prominenceScore || a.name.localeCompare(b.name))) {
    const brandKey = (r.research.brand || r.name.split(/\s+/)[0] || r.name).toLowerCase();
    const n = perBrand.get(brandKey) ?? 0;
    if (n >= 3) continue;
    perBrand.set(brandKey, n + 1);
    top.push(r);
    if (top.length >= 50) break;
  }
  await writeFile(path.join(OUT, 'top', `${cat}.json`), JSON.stringify(top, null, 1));
}

const closed = kept.filter((r) => r.research.closed);
const unverified = kept.filter((r) => r.research.verification.status === 'unverified');
const verified = kept.filter((r) => r.research.verification.status === 'verified');

await writeFile(path.join(OUT, 'karachify-dataset.json'), JSON.stringify(kept, null, 1));
await writeFile(path.join(OUT, 'karachify-dataset.min.json'), JSON.stringify(kept));
await writeFile(path.join(OUT, 'unverified.json'), JSON.stringify(unverified.map((r) => ({ id: r.id, name: r.name, categoryId: r.categoryId, source: r.sourceUrl, missing: Object.keys(r).filter((k) => ['phone', 'website', 'hours', 'email'].includes(k) && !r[k]) })), null, 1));
await writeFile(path.join(OUT, 'closed.json'), JSON.stringify(closed, null, 1));
await writeFile(path.join(OUT, 'duplicates.json'), JSON.stringify(dropped, null, 1));

// CSV
const COLS = ['id', 'slug', 'name', 'categoryId', 'areaId', 'address', 'lat', 'lng', 'phone', 'whatsapp', 'website', 'facebook', 'instagram', 'hours', 'cuisine', 'facilities', 'priceRange', 'rating', 'reviewCount', 'status', 'verificationStatus', 'confidence', 'closed', 'sourceUrl', 'googleMaps', 'wikidata', 'wikipedia', 'verificationDate', 'description'];
const esc = (v) => {
  if (v === undefined || v === null) return '';
  let s = Array.isArray(v) ? v.join('; ') : typeof v === 'object' ? JSON.stringify(v) : String(v);
  if (s.includes('"') || s.includes(',') || s.includes('\n')) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
};
const lines = [COLS.join(',')];
for (const r of kept) {
  lines.push(
    [
      r.id, r.slug, r.name, r.categoryId, r.areaId, r.address, r.lat, r.lng, r.phone,
      r.research.whatsapp, r.website, r.research.socials.facebook, r.research.socials.instagram,
      r.hours ? r.hours.map((h) => `${h.day}: ${h.open}`).join(' | ') : '',
      r.cuisine, r.facilities, r.priceRange, r.rating, r.reviewCount, r.status,
      r.research.verification.status, r.research.verification.confidence, r.research.closed,
      r.sourceUrl, r.research.mapLinks.googleMaps, r.research.wikidata, r.research.wikipedia,
      r.research.verification.date, r.description,
    ].map(esc).join(','),
  );
}
await writeFile(path.join(OUT, 'karachify-listings.csv'), '\uFEFF' + lines.join('\r\n'));

// Progress + stats
const stats = Object.fromEntries(
  Object.entries(byCategory).map(([cat, rows]) => [
    cat,
    {
      total: rows.length,
      withPhone: rows.filter((r) => r.phone).length,
      withWebsite: rows.filter((r) => r.website).length,
      withHours: rows.filter((r) => r.hours).length,
      withAddress: rows.filter((r) => !/^[^,]+?, Karachi$/.test(r.address)).length,
      closed: rows.filter((r) => r.research.closed).length,
      verified: rows.filter((r) => r.research.verification.status === 'verified').length,
    },
  ]),
);

await writeFile(
  path.join(OUT, 'progress.json'),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      city: 'karachi',
      totals: {
        records: kept.length,
        raw: records.length,
        duplicatesRemoved: dropped.length,
        closed: closed.length,
        verified: verified.length,
        unverified: unverified.length,
        categories: Object.keys(byCategory).length,
      },
      categories: stats,
      pendingVerification: Object.entries(stats).filter(([, s]) => s.verified === 0).map(([c]) => c),
    },
    null,
    1,
  ),
);

console.log('records', kept.length, 'raw', records.length, 'duplicates', dropped.length, 'closed', closed.length);

// ---- machine-readable source index -----------------------------------------
const sourceIndex = new Map();
for (const r of kept) {
  for (const s of r.research.sources ?? []) {
    const key = s.url;
    const cur = sourceIndex.get(key) ?? { url: s.url, type: s.type, license: s.license, retrievedAt: s.retrievedAt, usedBy: 0 };
    cur.usedBy += 1;
    sourceIndex.set(key, cur);
  }
}
await writeFile(
  path.join(OUT, 'sources.json'),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      primary: {
        name: 'OpenStreetMap',
        license: 'ODbL-1.0',
        licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
        attribution: '© OpenStreetMap contributors',
        extraction: { api: 'Overpass', bbox: '24.75,66.85,25.05,67.35', date: TODAY },
      },
      verifiedSources: [...sourceIndex.values()].filter((s) => s.type !== 'openstreetmap'),
      counts: {
        osmElements: [...sourceIndex.values()].filter((s) => s.type === 'openstreetmap').length,
        external: [...sourceIndex.values()].filter((s) => s.type !== 'openstreetmap').length,
      },
    },
    null,
    1,
  ),
);

// ---- human-readable progress report ----------------------------------------
const md = [];
md.push('# Karachify data build — progress');
md.push('');
md.push(`Generated: ${new Date().toISOString().slice(0, 10)} · City: Karachi · Source base: OpenStreetMap (ODbL 1.0) + official-site verification batch`);
md.push('');
md.push('| Category | Records | Phone | Website | Hours | Closed | Verified |');
md.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: |');
for (const [cat, s] of Object.entries(stats).sort((a, b) => b[1].total - a[1].total)) {
  md.push(`| ${cat} | ${s.total} | ${s.withPhone} | ${s.withWebsite} | ${s.withHours} | ${s.closed} | ${s.verified} |`);
}
md.push('');
md.push(`**Totals:** ${kept.length} records · ${dropped.length} duplicates removed · ${closed.length} closed · ${verified.length} verified · ${unverified.length} awaiting verification.`);
md.push('');
md.push('## Status');
md.push('');
md.push('- **Discovered** — real OSM place records with coordinates, tags, and whatever contact data mappers recorded.');
md.push('- **Verified** — cross-checked against an official website on the date in `research.verification.date`.');
md.push('- **Unverified** — imported but not yet checked. No rating, price or description was invented.');
await writeFile(path.join(OUT, 'PROGRESS.md'), md.join('\n') + '\n');

console.log(Object.entries(stats).map(([c, s]) => `${c}: ${s.total} (phone ${s.withPhone}, web ${s.withWebsite}, hours ${s.withHours})`).join('\n'));
