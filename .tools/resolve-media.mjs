/**
 * Karachify media resolver.
 *
 * Reads every demo record from src/data, finds a real Karachi / subject-matched
 * photograph on Wikimedia Commons through the en.wikipedia.org API (commons.
 * wikimedia.org is DNS-blocked on this network, but the en.wikipedia API and
 * thumb.wikimedia.org both work), validates the 500px and 1280px thumbnail URLs,
 * captures the artist and licence, and writes src/data/media.json.
 *
 * Records that cannot be matched are left out; the app renders a designed
 * placeholder for them instead of an unrelated photo.
 *
 * Run: node .tools/resolve-media.mjs [--only <substr>]
 */
import { readdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const UA = 'Karachify/0.1 (city discovery demo; sourcing licensed Commons imagery)';
const SLEEP = 420;
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJSON(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (r.status === 429) {
        await sleep(2500 * (i + 1));
        continue;
      }
      if (!r.ok) return null;
      return await r.json();
    } catch {
      await sleep(1200 * (i + 1));
    }
  }
  return null;
}

async function head(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      const bytes = (await r.arrayBuffer()).byteLength;
      if (r.status === 200 && bytes > 3000) return { ok: true, bytes };
      if (r.status === 429) {
        await sleep(2200 * (i + 1));
        continue;
      }
      return { ok: false, bytes };
    } catch {
      await sleep(1500 * (i + 1));
    }
  }
  return { ok: false, bytes: 0 };
}

/** Build the commons thumb URL for a given width from any thumb/original URL. */
function normaliseThumb(sourceUrl, width) {
  if (!sourceUrl) return null;
  let u = sourceUrl.split('?')[0];
  if (u.startsWith('//')) u = `https:${u}`;
  // Already a thumb URL: swap the width token in place.
  const asThumb = u.replace(/\/(\d+)px-([^/]+)$/, `/${width}px-$2`);
  if (asThumb !== u) return asThumb;
  // Original file URL: insert the /thumb/ segment.
  const m = u.match(/^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/[a-z0-9]\/([a-z0-9]{2})\/([^/]+))$/);
  if (m) return `${m[1]}/thumb/${m[3]}/${width}px-${m[3]}`;
  return null;
}

function filePageFromUrl(u) {
  if (!u) return undefined;
  const clean = u.split('?')[0];
  const m = clean.match(/\/(?:thumb\/)?(?:\d+px-)?([^/]+\.(?:jpe?g|png|webp|JPG|JPEG|PNG))$/i);
  if (!m) return undefined;
  return `https://commons.wikimedia.org/wiki/File:${decodeURIComponent(m[1])}`;
}

function filenameFromUrl(url) {
  if (!url) return undefined;
  const seg = url.split('?')[0].split('/').pop();
  const m = seg?.match(/^(?:\d+px-)?(.+)$/);
  return m ? decodeURIComponent(m[1]) : undefined;
}

async function metadataFor(fileTitle) {
  const d = await getJSON(
    `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(`File:${fileTitle}`)}&prop=imageinfo&iiprop=url%7Cextmetadata%7Csize&iiextmetadatafilter=LicenseShortName%7CArtist%7CCopyrighted%7CUsageTerms&iiurlwidth=1280&format=json`
  );
  const p = d?.query?.pages && Object.values(d.query.pages)[0];
  const i = p?.imageinfo?.[0];
  if (!i) return null;
  const md = i.extmetadata ?? {};
  const strip = (v) => (v ? String(v).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : undefined);
  return {
    wide: i.thumburl,
    artist: strip(md.Artist?.value),
    license: strip(md.LicenseShortName?.value),
  };
}

async function summary(title) {
  return getJSON(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`);
}

async function searchPage(query) {
  const d = await getJSON(`https://en.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(query)}&limit=4`);
  return d?.pages ?? [];
}

const BAD_TITLE =
  /(bombing|attack|battle|disaster|crash|killing|blast|riot|scandal|wreck|shipwreck|epidemic|outbreak|assault|trial|fire of|incident|hostage|kidnapping|war|massacre|explosion|funeral|death)/i;

/** Vector maps and locator diagrams are never acceptable as "photography". */
const BAD_FILE = /\.svg(\.png)?$/i;

/** A subject photo must be of the city, not of an unrelated article on the same keyword. */
const LOCAL = /(karachi|sindh|pakistan)/i;

const STOP = new Set(['of', 'the', 'and', 'in', 'at', 'a', 'an', 'from', 'with', 'new', 'old', 'city']);
function words(s) {
  return (s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP.has(w));
}

function sharesToken(a, b) {
  const wb = new Set(words(b));
  return words(a).some((w) => wb.has(w));
}

function articleIsAbout(candidate, art) {
  const title = art?.title ?? '';
  if (!title) return false;
  if (BAD_TITLE.test(title)) return false;
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (norm(candidate).includes(norm(title)) || norm(title).includes(norm(candidate))) return true;
  return sharesToken(title, candidate) && sharesToken(title, art.description ?? '');
}

function accept(art, { local, candidate, requireImage = true }) {
  if (!art?.title) return false;
  if (BAD_TITLE.test(art.title)) return false;
  if (requireImage && !art.thumbnail?.source && !art.originalimage?.source) return false;
  if (local && !LOCAL.test(`${art.title} ${art.extract ?? ''} ${art.description ?? ''}`)) return false;
  if (candidate && !articleIsAbout(candidate, art)) return false;
  return true;
}

/** Resolve one subject into validated image URLs + attribution. */
async function resolveSubject(key, label, list) {
  const tried = new Set();
  for (const item of list) {
    const title = typeof item === 'string' ? { title: item, local: false } : item;
    if (!title.title || tried.has(title.title)) continue;
    tried.add(title.title);
    const local = title.local === true;
    let s = await summary(title.title);
    if (!accept(s, { local, candidate: title.title })) {
      s = null;
      const query = /karachi/i.test(title.title) ? title.title : `${title.title} Karachi`;
      const hits = (await searchPage(query)).filter((h) => accept(h, { local, candidate: title.title, requireImage: false }));
      for (const hit of hits.slice(0, 2)) {
        const alt = await summary(hit.title);
        if (accept(alt, { local, candidate: title.title })) {
          s = alt;
          break;
        }
      }
      await sleep(SLEEP);
    }
    if (!s) continue;
    const thumbSrc = s.thumbnail?.source;
    const origSrc = s.originalimage?.source;
    const src = thumbSrc ?? origSrc;
    if (!src || BAD_FILE.test(String(origSrc ?? thumbSrc))) continue;

    const fileTitle = filenameFromUrl(origSrc ?? thumbSrc);
    const wide = normaliseThumb(origSrc ?? thumbSrc, 1280) ?? thumbSrc;
    const card = normaliseThumb(thumbSrc ?? origSrc, 500) ?? thumbSrc;

    const [wideOk, cardOk] = [await head(wide), await head(card ?? wide)];
    await sleep(200);
    if (!wideOk.ok && !cardOk.ok) continue;

    const meta = fileTitle ? await metadataFor(fileTitle) : null;
    await sleep(SLEEP);

    const chosenWide = wideOk.ok ? wide : cardOk.ok ? card : thumbSrc;
    const chosenCard = cardOk.ok ? card : wideOk.ok ? wide : thumbSrc;
    return {
      key,
      subject: label,
      via: s.title,
      thumb: chosenCard,
      wide: chosenWide,
      filePage: filePageFromUrl(chosenWide) ?? filePageFromUrl(thumbSrc),
      artist: meta?.artist,
      license: meta?.license,
      verified: true,
    };
  }
  return null;
}

/* ---------- extract the records straight out of the TS data files ---------- */

function extractRecords() {
  const dir = path.join(ROOT, 'src/data/listings');
  const records = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.ts') && x !== 'index.ts')) {
    const text = readFileSync(path.join(dir, f), 'utf8');
    const consts = {};
    for (const m of text.matchAll(/^const ([A-Z_]+)\s*=\s*'([^']+)'/gm)) consts[m[1]] = m[2];
    const blocks = text.split(/\n(?=\s*makeListing\()/g).slice(1);
    for (const b of blocks) {
      const slug = b.match(/slug:\s*'([^']+)'/)?.[1];
      if (!slug) continue;
      const name = b.match(/name:\s*'((?:[^'\\]|\\.)*)'/)?.[1]?.replace(/\\'/g, "'") ?? slug;
      const cm = b.match(/categoryId:\s*('([^']+)'|([A-Za-z_$][\w$]*))/);
      const categoryId = cm ? (cm[2] ?? consts[cm[3]] ?? cm[3]) : '';
      const wiki = [...(b.match(/wiki:\s*\[([\s\S]*?)\]/)?.[1]?.matchAll(/'((?:[^'\\]|\\.)*)'/g) ?? [])].map((m) =>
        m[1].replace(/\\'/g, "'")
      );
      records.push({ key: slug, label: name, categoryId, wiki, kind: 'listing', file: f });
    }
  }

  const evText = readFileSync(path.join(ROOT, 'src/data/events.ts'), 'utf8');
  for (const b of evText.split(/\n(?=\s*ev\(\{)/g).slice(1)) {
    const slug = b.match(/slug:\s*'([^']+)'/)?.[1];
    if (!slug) continue;
    const name = b.match(/name:\s*'((?:[^'\\]|\\.)*)'/)?.[1]?.replace(/\\'/g, "'") ?? slug;
    const wiki = [...(b.match(/wiki:\s*\[([\s\S]*?)\]/)?.[1]?.matchAll(/'((?:[^'\\]|\\.)*)'/g) ?? [])].map((m) =>
      m[1].replace(/\\'/g, "'")
    );
    records.push({ key: slug, label: name, categoryId: 'events', wiki, kind: 'event' });
  }

  const gText = readFileSync(path.join(ROOT, 'src/data/guides.ts'), 'utf8');
  for (const b of gText.split(/\n(?=\s*\{\s*$)/g).slice(1)) {
    const slug = b.match(/slug:\s*'([^']+)'/)?.[1];
    if (!slug) continue;
    const title = b.match(/title:\s*'((?:[^'\\]|\\.)*)'/)?.[1]?.replace(/\\'/g, "'") ?? slug;
    const wiki = [...(b.match(/wiki:\s*\[([\s\S]*?)\]/)?.[1]?.matchAll(/'((?:[^'\\]|\\.)*)'/g) ?? [])].map((m) =>
      m[1].replace(/\\'/g, "'")
    );
    if (!wiki.length) continue;
    records.push({ key: `guide-${slug}`, label: title, categoryId: 'guides', wiki, kind: 'guide' });
  }

  return records;
}

const CATEGORY_TITLES = {
  'tourist-places': ['Karachi skyline', 'Frere Hall'],
  'museums-galleries': ['Mohatta Palace', 'Museum'],
  'parks-recreation': ['Ibn-e-Qasim Bagh Stadium', 'Park'],
  beaches: ['Clifton Beach', 'Sandspit, Karachi'],
  'religious-places': ['Masjid-e-Tooba, Karachi', 'Mosque'],
  'restaurants-cafes': ['Biryani', 'Karachi'],
  hotels: ['Pearl-Airconditioned Hotel & Conference Center', 'Hotel'],
  'wedding-venues': ['Karachi Expo Centre', 'Banquet'],
  events: ['Karachi Expo Centre', 'Concert'],
  shopping: ['Dolmen Mall Clifton', 'Empress Market'],
  'sports-fitness': ['National Stadium, Karachi', 'Cricket ground'],
  'art-culture': ['Frere Hall', 'Ajrak'],
  transport: ['Jinnah International Airport', 'Karachi Railway Station'],
  hospitals: ['Aga Khan University Hospital, Karachi', 'Hospital'],
  'doctors-clinics': ['Dentist', 'Clinic'],
  'pharmacies-labs': ['Pharmacy', 'Medical laboratory'],
  universities: ['University of Karachi', 'Campus'],
  schools: ['Karachi Grammar School', 'School'],
  government: ['Karachi Municipal Building', 'Government building'],
  emergency: ['Rescue 1122', 'Ambulance'],
  'professional-services': ['Office'],
  guides: ['Karachi'],
};

/* ------------------------------- run ------------------------------- */

const out = existsSync(path.join(ROOT, 'src/data/media.json'))
  ? JSON.parse(readFileSync(path.join(ROOT, 'src/data/media.json'), 'utf8'))
  : {};

const records = extractRecords();

// Category banners and the homepage hero are resolved from the same pipeline.
const extra = [
  { key: 'hero-karachi', label: 'Karachi coastline', categoryId: 'tourist-places', wiki: ['Karachi skyline', 'Clifton Beach', 'Karachi'], kind: 'hero' },
  { key: 'hero-karachi-night', label: 'Karachi at night', categoryId: 'tourist-places', wiki: ['Mazar-e-Quaid', 'Karachi at night'], kind: 'hero' },
  ...Object.entries(CATEGORY_TITLES).map(([key, wiki]) => ({ key: `banner-${key}`, label: key, categoryId: key, wiki, kind: 'banner' })),
];
records.unshift(...extra);

console.log(`Extracted ${records.length} records to resolve.`);

let done = 0;
const failures = [];

for (const rec of records) {
  const searchKey = rec.key;
  if (only && !searchKey.includes(only)) continue;
  if (out[searchKey]?.verified) continue;

  const strict = rec.kind === 'hero' || rec.kind === 'banner';
  const fallback = CATEGORY_TITLES[rec.categoryId] ?? [];
  const candidates = [
    ...(rec.wiki ?? []).map((title) => ({ title, local: strict })),
    ...fallback.map((title) => ({ title, local: true })),
    { title: rec.label, local: strict },
  ];
  const res = await resolveSubject(searchKey, rec.label, candidates);
  if (res) {
    out[searchKey] = res;
    done++;
  } else {
    failures.push(`${rec.kind}:${searchKey}`);
  }
  writeFileSync(path.join(ROOT, 'src/data/media.json'), `${JSON.stringify(out, null, 2)}\n`);
  console.log(`${res ? 'ok ' : 'MISS'} [${done}/${records.length}] ${searchKey} -> ${res?.via ?? 'placeholder'}`);
  await sleep(SLEEP);
}

/* ---- banner fallback: reuse a photograph already verified for a listing in that category ---- */
const reused = [];
for (const rec of records) {
  if (rec.kind !== 'banner') continue;
  if (out[rec.key]?.verified) continue;
  const donor = records.find((r) => r.kind === 'listing' && r.categoryId === rec.categoryId && out[r.key]?.verified);
  if (!donor) continue;
  out[rec.key] = { ...out[donor.key], key: rec.key, subject: rec.label, via: `reuse:${donor.key}` };
  reused.push(rec.key);
}
if (reused.length) console.log(`Banner reuse from category listings: ${reused.join(', ')}`);

writeFileSync(path.join(ROOT, 'src/data/media.json'), `${JSON.stringify(out, null, 2)}\n`);
console.log(`\nResolved ${done} new records. Total in media.json: ${Object.keys(out).length}`);
if (failures.length) console.log(`Unresolved (${failures.length}):\n${failures.join('\n')}`);
