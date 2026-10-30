/**
 * Targeted Karachi photo picker.
 *
 * The generic resolver falls back to type articles ("Shopping mall", "Hotel")
 * whose lead image is often a foreign building — unacceptable for a Karachi
 * directory. For the records where a real Karachi photograph is likely to exist,
 * this script searches the Wikipedia File namespace by name, validates the
 * thumbnail and records the licence, and writes a 'subject' entry.
 *
 * Run: node .tools/pick-media.mjs [--apply]
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const MEDIA = path.join(ROOT, 'src/data/media.json');
const UA = 'Karachify/0.1 (city discovery demo; sourcing licensed Commons imagery)';
const apply = process.argv.includes('--apply');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* record key -> { q: File-namespace search, must: words the file title must contain } */
const PICKS = {
  'mohatta-palace': { q: 'Mohatta Palace Karachi Sindh', must: ['mohatta'] },
  'data-darbar': { q: 'Data Darbar', must: ['data', 'darbar'] },
  'dolmen-mall-clifton': { q: 'Dolmen Mall Clifton', must: ['dolmen', 'clifton'] },
  'dolmen-mall-tariq-road': { q: 'Dolmen Mall Tariq', must: ['dolmen', 'tariq'] },
  'polyverse-mall': { q: 'Polyverse Mall', must: ['polyverse'] },
  'darman-mall': { q: 'Darman Mall', must: ['darman'] },
  'civil-hospital-karachi': { q: 'Civil Hospital Karachi', must: ['civil', 'hospital'] },
  'korangi-wholesale-mandi': { q: 'Korangi mandi vegetable market', must: ['korangi'] },
  'saddar-bohri-bazaar': { q: 'Bohri Bazaar Karachi', must: ['bohri'] },
  'chaliha-bazaar': { q: 'PECHS 11th street market Karachi', must: ['pechs', 'bazaar', 'market'] },
  'ziarat-market': { q: 'junk market Karachi used goods', must: ['karachi'] },
  'jolane-strip': { q: 'Johar Block 5 Karachi', must: ['johar', 'block'] },
  'nicc-convention': { q: 'Nations Complex Karachi convention', must: ['nations', 'nicc'] },
  'lizbum-hall': { q: 'Lizbum', must: ['lizbum'] },
  'karnal-park': { q: 'Karnal park Karachi', must: ['karnal'] },
  'malir-garden': { q: 'Malir Dam Karachi', must: ['malir'] },
  'red-line-bus-transit': { q: 'Red Line Rapid Bus Karachi BRT', must: ['karachi', 'brt', 'red line'] },
  'rafic-market': { q: 'leather market Saddar Karachi', must: ['leather', 'saddar'] },
  'shaheen-chemist-dha': { q: 'Shaheen Chemist Karachi', must: ['shaheen'] },
  'md-drug-store-clifton': { q: 'drug store pharmacy Karachi', must: ['karachi'] },
  'university-of-karachi': { q: 'University of Karachi campus building', must: ['university of karachi'] },
  'karachi-grammar-school': { q: 'Karachi Grammar School building', must: ['grammar school'] },
  'aga-khan-university-campus': { q: 'Aga Khan University Hospital Karachi building', must: ['aga khan'] },
  'iba-karachi': { q: 'Institute of Business Administration Karachi building', must: ['business administration'] },
  'habib-university': { q: 'Habib University Karachi', must: ['habib'] },
  'dow-university-health-sciences': { q: 'Dow University of Health Sciences Karachi', must: ['dow university'] },
  'rescue-1122-karachi': { q: 'Rescue 1122 ambulance Sindh', must: ['rescue 1122', '1122'] },
  'sindh-police-hq': { q: 'Sindh Police headquarters Karachi building', must: ['police'] },
  'karachi-metropolitan-corporation': { q: 'Karachi Metropolitan Corporation building Saddar', must: ['kmc', 'metropolitan'] },
  'st-anthonys-high-school': { q: "St. Anthony's High School Karachi", must: ['anthony'] },
};

/** Logos, crests and vector seals are fair-use or unusable as cover photography. */
const NOT_A_PHOTO = /(logo|crest|emblem|seal|flag|icon|\.svg|coat of arms|signature|map|locator|diagram|poster|cover|card)/i;

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

async function getJSON(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (r.status === 429) { await sleep(2600 * (i + 1)); continue; }
      if (!r.ok) return null;
      return await r.json();
    } catch { await sleep(1400 * (i + 1)); }
  }
  return null;
}

async function head(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    const bytes = (await r.arrayBuffer()).byteLength;
    return r.status === 200 && bytes > 3000;
  } catch { return false; }
}

async function searchFiles(q) {
  const d = await getJSON(`https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srnamespace=6&srlimit=8&srsearch=${encodeURIComponent(q)}`);
  return (d?.query?.search ?? []).map((x) => x.title.replace(/^File:/, ''));
}

async function imageInfo(title) {
  const d = await getJSON(
    `https://en.wikipedia.org/w/api.php?action=query&format=json&titles=${encodeURIComponent(`File:${title}`)}&prop=imageinfo&iiprop=url%7Cextmetadata%7Csize&iiurlwidth=1280&iiextmetadatafilter=LicenseShortName%7CArtist%7CCopyrighted`
  );
  const p = d?.query?.pages && Object.values(d.query.pages)[0];
  return p?.imageinfo?.[0];
}

const strip = (v) => (v ? String(v).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : undefined);
const names = JSON.parse(fs.readFileSync(path.join(ROOT, '.tools/pick-names.json'), 'utf8'));
const media = JSON.parse(fs.readFileSync(MEDIA, 'utf8'));

let picked = 0;
for (const [key, spec] of Object.entries(PICKS)) {
  const label = names[key];
  if (!label) { console.log(`skip ${key} (no record name)`); continue; }
  if (media[key]) { console.log(`have ${key}`); continue; }
  const files = await searchFiles(spec.q);
  const hit = files.find((f) => {
    const n = norm(f);
    return /\.(jpe?g|png|webp)$/i.test(f) && !NOT_A_PHOTO.test(n) && spec.must.some((w) => n.includes(w));
  });
  if (!hit) { console.log(`MISS ${key} — no named file for “${spec.q}”`); await sleep(300); continue; }
  const info = await imageInfo(hit);
  await sleep(280);
  if (!info?.thumburl || !info.url) { console.log(`MISS ${key} — ${hit} has no usable url`); continue; }
  if (/wikimedia\.org\/wikipedia\/en\//.test(info.url)) { console.log(`SKIP ${key} — ${hit} is a fair-use local file`); continue; }
  const [wideOk, cardOk] = [await head(info.thumburl), await head(info.url)];
  if (!wideOk && !cardOk) { console.log(`MISS ${key} — ${hit} thumbnails unreachable`); continue; }
  const md = info.extmetadata ?? {};
  const entry = {
    key,
    subject: label,
    via: hit.replace(/\.[a-z]+$/i, ''),
    thumb: cardOk ? info.url : info.thumburl,
    wide: info.thumburl,
    filePage: info.descriptionurl,
    artist: strip(md.Artist?.value),
    license: strip(md.LicenseShortName?.value),
    verified: true,
    kind: 'subject',
  };
  if (apply) media[key] = entry;
  picked++;
  console.log(`PICK ${key}  <-  ${hit}`);
  await sleep(320);
}

if (apply) fs.writeFileSync(MEDIA, `${JSON.stringify(media, null, 2)}\n`);
console.log(`\n${apply ? 'Wrote' : 'Would write'} ${picked} subject photographs.`);
