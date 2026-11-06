#!/usr/bin/env node
// Flickr as a licensed source — the lane Wikimedia Commons left empty.
//
// Flickr carries a large body of Karachi photographs and a share of them come with
// a Creative Commons licence: the photographer keeps the copyright and grants
// reuse in writing, on their own page. That is the only kind of photograph this
// registry may publish, so this run asks for the licence before it looks at the
// picture, and refuses the file when the licence is not there.
//
// Three facts about Flickr decide the shape of this script, and each was checked
// against the live service rather than assumed:
//   · the public feed answers without an API key, and it carries the photographer's
//     own title, description and tags — enough to ask who is in the picture;
//   · flickr.photos.search, which is the call that reports a licence, needs a key
//     we do not have;
//   · a photo page's HTML contains EVERY licence name and every CC deed link,
//     because the licence picker is embedded in it. Grepping the page for
//     "creativecommons.org" therefore calls an all-rights-reserved photo free.
//     The only honest reading is the one block the page shows the visitor,
//     <div class="photo-license-info">, which states this photo's licence and
//     nothing else. Every file accepted here was read from that block.
//
// Accepted licences: CC BY, CC BY-SA, CC0 and Public Domain marks. Not accepted:
// "All rights reserved", and any NC or ND licence — this is a published directory
// and the site is resized by the host, which a non-commercial or no-derivatives
// grant does not cover.
//
// The identity and locality gates are the Commons lane's, unchanged: the
// photographer's own words have to name this subject, and Karachi has to come
// from those same words or from the camera's position. A tourist's picture of a
// Karachi street tagged "karachi" is a picture of a street.
//
//   node .tools/resolve-flickr-photos.mjs --five          the five records asked for
//   node .tools/resolve-flickr-photos.mjs                 every record still empty
//   node .tools/resolve-flickr-photos.mjs --only=a,b      a shortlist
import { build } from 'esbuild';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const WRITE = process.argv.includes('--write');
const FIVE = process.argv.includes('--five');
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) ?? '').slice(7).split(',').filter(Boolean);
const PACE = Number(process.argv.find((a) => a.startsWith('--pace='))?.slice(7)) || 2500;
const PAGES = Number(process.argv.find((a) => a.startsWith('--pages='))?.slice(8)) || 6;
const ROOT = resolve('.');
const CACHE_FILE = join(ROOT, '.tools/flickr-cache.json');
const REVIEW_FILE = join(ROOT, '.tools/photo-flickr-review.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Karachify/0.1 (city directory maintainer; sourcing licensed imagery)';
const FEED = 'https://api.flickr.com/services/feeds/photos_public.gne';

/* The five records this pass exists to answer. Public institutions a visitor
   photographs, so a Flickr match is plausible rather than hopeful. */
const FIVE_KEYS = ['civil-hospital-karachi', 'jinnah-postgraduate-medical-centre', 'karachi-grammar-school', 'szabist-karachi', 'rescue-1122-karachi'];

const IN_KARACHI = (lat, lng) => lat >= 24.4 && lat <= 25.4 && lng >= 66.6 && lng <= 67.9;
const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'de', 'al', 'en', 'i']);
const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = (s) => norm(s).split(' ').filter((t) => t.length > 2 && !STOP.has(t));
const sameWord = (a, b) => a === b || (a.startsWith(b) && a.length - b.length <= 1) || (b.startsWith(a) && b.length - a.length <= 1);
const hasWord = (text, w) => norm(text).split(' ').some((t) => sameWord(t, w));
const OTHER_CITY = /\b(lahore|islamabad|rawalpindi|multan|peshawar|quetta|sialkot|faisalabad|gujranwala|hyderabad|murree|delhi|mumbai|london|dubai|new york)\b/i;
const NOT_THE_SUBJECT = /\b(pictured|portrait|meets?|meeting|inaugurat\w*|visits?|awarded?|ceremony|graduating|convocation|with the|speaking|cast crew|performers?|trophy|cricket|volleyball|basketball|handball|hockey|rugby|match|tournament|concert|festival|protest)\b/i;
const stripTags = (s) => String(s ?? '').replace(/<[^>]*>/g, ' ').replace(/&#0?39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

/* Naming a place is not being a picture of it: the address slot rule from the
   Commons lane, unchanged. */
const PLACE_BEFORE = new Set(['in', 'at', 'inside', 'within', 'near', 'opposite', 'behind', 'beside', 'along', 'above', 'below']);
function namesItAsAddress(text, need) {
  const ws = text.split(' ');
  const at = ws.findIndex((w) => need.some((n) => sameWord(w, n)));
  if (at < 1) return false;
  if (PLACE_BEFORE.has(ws[at - 1])) return true;
  return at > 1 && /^(in|at|inside|within|near)$/.test(ws[at - 1]) && /^(located|situated|found|based|photographed|shot)$/i.test(ws[at - 2]);
}

const cache = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : {};
function remember(url, body) {
  cache[url] = body;
  /* Flushed after every answer: this run is long, this machine's network drops
     without warning, and a cache that only survives to the end is not a resume
     point. A non-answer is never stored, so a retry is a real retry. */
  writeFileSync(CACHE_FILE, `${JSON.stringify(cache, null, 0)}\n`);
}

let lastCall = 0;
async function get(url, { text = false, attempt = 0 } = {}) {
  if (cache[url] !== undefined) return cache[url];
  const wait = PACE - (Date.now() - lastCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: text ? 'text/html' : 'application/json' } });
    if (res.status !== 200) {
      await res.body?.cancel().catch(() => {});
      throw new Error(`HTTP ${res.status}`);
    }
    const body = text ? await res.text() : JSON.parse(await res.text());
    remember(url, body);
    return body;
  } catch (err) {
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      return get(url, { text, attempt: attempt + 1 });
    }
    process.stderr.write(`    ! ${String(err.message ?? err).slice(0, 50)} ${url.slice(0, 80)}\n`);
    return null;
  }
}

const km = (a, b, c, d) => {
  const rad = (x) => (x * Math.PI) / 180;
  const h = Math.sin(rad((c - a) / 2)) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad((d - b) / 2)) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

/* ── the records still without a photograph ─────────────────────────────── */
const bundle = await build({
  stdin: {
    contents: `
      export { listings } from './listings';
      export { areas } from './taxonomy';
      export { default as media } from './media.json';
    `,
    resolveDir: join(ROOT, 'src/data'),
    loader: 'ts',
  },
  bundle: true, format: 'esm', platform: 'neutral', write: false, logLevel: 'silent',
});
const tmp = mkdtempSync(join(tmpdir(), 'karachify-flickr-'));
writeFileSync(join(tmp, 'data.mjs'), bundle.outputFiles[0].text);
const { listings, areas, media } = await import(pathToFileURL(join(tmp, 'data.mjs')).href);

const areaNameById = new Map(areas.map((a) => [a.id, a.name]));
let targets = listings.filter((l) => !media[l.slug]).map((l) => ({
  key: l.slug,
  name: l.name,
  lat: Number.isFinite(l.lat) ? l.lat : null,
  lng: Number.isFinite(l.lng) ? l.lng : null,
  place: [...new Set(['karachi', ...(l.areaId ? tokens(areaNameById.get(l.areaId) ?? '') : [])])],
}));
if (FIVE) targets = FIVE_KEYS.map((k) => targets.find((t) => t.key === k)).filter(Boolean);
if (ONLY.length) targets = targets.filter((t) => ONLY.includes(t.key));

const knownLabels = [...new Set([...listings.map((l) => l.name), ...Object.values(media).map((m) => m.subject)])];
const labelWords = new Map();
for (const n of knownLabels) for (const w of new Set(tokens(n))) labelWords.set(w, (labelWords.get(w) ?? 0) + 1);
const GENERIC = new Set([...labelWords].filter(([, c]) => c >= 20).map(([w]) => w));

/* ── searching: Flickr tags, which are single tokens, not phrases ───────── */
function tagForms(t) {
  const core = t.name.replace(/\(.*?\)/g, ' ').replace(/,.*/, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const words = tokens(core).filter((w) => !GENERIC.has(w));
  const out = [core.replace(/\s+/g, ' '), words.join(''), words.join('-')];
  if (words.length >= 2) out.push(words.slice(0, 2).join(''), words.slice(0, 2).join('-'));
  const initials = words.map((w) => w[0]).join('');
  if (initials.length >= 3 && initials.length <= 5) out.push(initials);
  return [...new Set(out.filter((x) => x.length > 2))];
}

async function feedItems(t) {
  const seen = new Map();
  for (const tag of tagForms(t).slice(0, 5)) {
    for (const [joined, mode] of [[tag.replace(/\s+/g, ','), 'all'], [tag.replace(/\s+/g, '-'), 'all']]) {
      const data = await get(`${FEED}?tags=${encodeURIComponent(`karachi,${joined}`)}&tagmode=${mode}&format=json&nojsoncallback=1`);
      for (const it of data?.items ?? []) if (it?.link && !seen.has(it.link)) seen.set(it.link, it);
    }
  }
  return [...seen.values()].filter((it) => it?.media?.m);
}

/* ── the photo page: its licence as the visitor is shown it, and its sizes ─ */
function licenceOf(html) {
  const block = /class="photo-license-info"[\s\S]{0,3000}/.exec(html)?.[0] ?? '';
  const label = (/class="license-text"[^>]*title="([^"]+)"/.exec(block) ?? [])[1]
    ?? (/title="([^"]+)"[^>]*class="license-text"/.exec(block) ?? [])[1] ?? '';
  const deed = (/https:\/\/creativecommons\.org\/(licenses|publicdomain)\/[a-z-]*\/?[0-9.]*/i.exec(block) ?? [])[0] ?? null;
  return { label: label.trim(), deed };
}

/* The page states the ladder it will actually serve, with each width. */
function sizesOf(html) {
  const flat = html.split('\\/').join('/').split('\\"').join('"');
  const out = new Map();
  for (const m of flat.matchAll(/(https?:)?\/\/live\.staticflickr\.com\/\d+\/\d+_[a-z0-9]+(?:_([a-z]))?\.jpg"[^{}]{0,80}?"width":(\d+),"height":(\d+)/g)) {
    const url = m[1] ? m[0].replace(/^"$/, '') : `https:${m[0].split('"')[0]}`;
    const width = Number(m[3]);
    const height = Number(m[4]);
    if (width > 0 && !out.has(width)) out.set(width, { url, width, height });
  }
  return [...out.values()].sort((a, b) => a.width - b.width);
}

function readPage(html) {
  const meta = (prop) => (/`<meta[^>]+property="${prop}"[^>]+content="([^"]*)"`/.exec(html) ?? [])[1] ?? '';
  const geoJson = /"latitude":\s*([-0-9.]+)[\s\S]{0,60}?"longitude":\s*([-0-9.]+)/.exec(html);
  const lic = licenceOf(html);
  return {
    licence: lic.label,
    licenceUrl: lic.deed,
    lat: geoJson ? Number(geoJson[1]) : null,
    lng: geoJson ? Number(geoJson[2]) : null,
    sizes: sizesOf(html),
    /* The picker lists every deed, so the id in the page's own state is the only
       other reading worth comparing the label against. */
    licenceId: (/,"license":(\d+)/.exec(html) ?? [])[1] ?? null,
  };
}

const FREE = (label) => /^(cc by|cc by-sa|cc0|public domain)/i.test(label) && !/-(nc|nd)/i.test(label);

/* ── the gate ───────────────────────────────────────────────────────────── */
function judgeFeed(t, item) {
  const tags = norm(item.tags ?? '');
  const desc = stripTags(item.description ?? '').replace(/posted a photo:?\s*/i, ' ');
  const carriers = [
    { where: 'its title', text: norm(item.title) },
    { where: 'the tags the photographer chose', text: tags },
    { where: 'its description', text: norm(desc) },
  ].filter((c) => c.text);
  const need = [...new Set(tokens(t.name).filter((w) => !t.place.includes(w) && !GENERIC.has(w)))];
  if (!need.length) return { why: 'the record name carries no word that could identify a photograph' };
  const all = carriers.map((c) => c.text).join(' ');
  if (OTHER_CITY.test(all)) return { why: 'its own words name a different city' };
  const event = NOT_THE_SUBJECT.exec(`${norm(item.title)} ${norm(desc)}`);
  if (event && !need.some((w) => sameWord(w, norm(event[1])))) return { why: `it is about “${event[1]}”, an event or a person, not the place` };
  const clean = carriers.filter((c) => !namesItAsAddress(c.text, need));
  const namedBy = clean.find((c) => need.every((w) => hasWord(c.text, w)));
  if (!namedBy) {
    const address = carriers.find((c) => need.every((w) => hasWord(c.text, w)));
    return {
      why: address
        ? `it names the place only as an address — “${address.text.slice(0, 60)}” is a photograph of something else`
        : `only ${need.filter((w) => carriers.some((c) => hasWord(c.text, w))).length} of the ${need.length} words that name it appear on the photo`,
    };
  }
  const geoOk = Number.isFinite(item.geoLat) && IN_KARACHI(item.geoLat, item.geoLon);
  if (!/karachi/.test(all) && !geoOk) return { why: `the words that name it — “${namedBy.text.slice(0, 60)}” — say nothing about Karachi` };
  return { ok: true, namedBy, text: namedBy.text, author: (/[("]([^")]+)[" )]$/.exec(item.author ?? '') ?? [])[1] };
}

const registry = { ...media };
const review = [];
let added = 0;
for (const t of targets) {
  process.stderr.write(`  flickr ${t.name}\n`);
  const items = await feedItems(t);
  const pre = items.map((item) => ({ item, v: judgeFeed(t, item) }));
  const shortlist = pre.filter((x) => x.v.ok).slice(0, PAGES);
  const final = [];
  for (const x of shortlist) {
    const html = await get(x.item.link, { text: true });
    if (!html) { x.refused = 'its Flickr page did not answer, so its licence cannot be read'; continue; }
    const page = readPage(html);
    if (!page.licence) { x.refused = 'its Flickr page states no licence to the visitor, so nothing was granted'; continue; }
    if (!FREE(page.licence)) { x.refused = `licensed “${page.licence}” on its own page, which does not allow this kind of republication`; continue; }
    const big = page.sizes.filter((s) => s.width >= 600).pop();
    if (!big) { x.refused = page.sizes.length ? `its largest served size is ${page.sizes.at(-1).width}px, too small to print at banner size` : 'its page lists no image sizes'; continue; }
    const near = t.lat && t.lng && Number.isFinite(page.lat) && IN_KARACHI(page.lat, page.lng) ? km(t.lat, t.lng, page.lat, page.lng) : null;
    final.push({
      ...x,
      page,
      big,
      near,
      score: (x.v.namedBy.where === 'its title' ? 2 : 1) + (near !== null ? (near <= 1.2 ? 4 : near <= 4 ? 3 : 0) : 0) + Math.min(2, Math.floor(big.width / 1024)),
    });
  }
  final.sort((a, b) => b.score - a.score);
  review.push({
    key: t.key, name: t.name, photosFound: items.length, named: pre.filter((x) => x.v.ok).length, pagesRead: shortlist.length,
    accepted: final.slice(0, 3).map((x) => ({
      link: x.item.link, title: x.item.title, licence: x.page.licence, licenceUrl: x.page.licenceUrl, licenceId: x.page.licenceId,
      artist: x.v.author ?? null, width: x.big.width, height: x.big.height, wide: x.big.url,
      ladder: x.page.sizes.map((s) => s.width), namedBy: x.v.namedBy.where, text: x.v.text.slice(0, 120), near,
    })),
    refused: [...pre.filter((x) => !x.v.ok).slice(0, 4).map((x) => ({ title: x.item.title, why: x.v.why })),
      ...shortlist.map((x) => x.refused).filter(Boolean).map((why) => ({ why }))],
  });
  const won = final[0];
  if (!won) {
    /* When photos did name the place, the answer the owner needs is why they were
       not usable — that is almost always the licence, and saying so is the whole
       point of this lane. */
    const why = shortlist.map((x) => x.refused).find(Boolean)
      ?? pre.filter((x) => !x.v.ok)[0]?.v.why ?? null;
    console.log(`none      ${t.name} — ${items.length} photos tagged, ${pre.filter((x) => x.v.ok).length} named it${why ? `; ${why}` : ''}`);
    continue;
  }
  console.log(`LICENSED  ${t.name}\n            ${won.item.link}\n            ${won.page.licence} · ${won.v.author ?? 'no named author'} · ${won.big.width}x${won.big.height} · ladder ${won.page.sizes.map((s) => s.width).join('/')}\n            named by ${won.v.namedBy.where}: “${won.v.text.slice(0, 80)}”${won.near !== null ? ` · photographed ${won.near < 1 ? `${Math.round(won.near * 1000)} m` : `${won.near.toFixed(1)} km`} from this record's pin` : ''}`);
  if (WRITE) {
    const small = won.page.sizes.find((s) => s.width >= 480 && s.width <= 640) ?? won.page.sizes.at(0);
    registry[t.key] = {
      key: t.key,
      subject: t.name,
      via: 'Flickr',
      thumb: small?.url ?? won.big.url,
      wide: won.big.url,
      filePage: won.item.link,
      artist: won.v.author,
      license: won.page.licence,
      licenseUrl: won.page.licenceUrl,
      verified: true,
      kind: 'subject',
      w: won.big.width,
      h: won.big.height,
      px: won.page.sizes.map((s) => s.width),
      evidence: `named by ${won.v.namedBy.where} on its own Flickr page: “${won.v.text.slice(0, 90)}” · licence as the page states it: ${won.page.licence}${won.page.licenceUrl ? ` (${won.page.licenceUrl})` : ''}${won.near !== null ? ` · photographed ${won.near < 1 ? `${Math.round(won.near * 1000)} m` : `${won.near.toFixed(1)} km`} from this record's own pin` : ''}`,
    };
    added++;
    writeFileSync(join(ROOT, 'src/data/media.json'), `${JSON.stringify(registry, null, 2)}\n`);
  }
}

writeFileSync(REVIEW_FILE, `${JSON.stringify(review, null, 2)}\n`);
console.log(`\nchecked ${targets.length} records · ${review.reduce((n, r) => n + r.accepted.length, 0)} licensed and named matches · registered ${WRITE ? added : 0}${WRITE ? '' : ' (dry run — nothing written)'}`);
console.log(`review written to ${REVIEW_FILE}`);
