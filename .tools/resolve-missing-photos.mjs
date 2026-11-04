#!/usr/bin/env node
// Sources photographs for records that currently render the designed placeholder.
//
// Two searches run per record, because they find different things: the English
// Wikipedia API (article first, then the images embedded in it) and the Commons
// file search on api.wikimedia.org, which finds a photograph by its own name even
// when the place has no article — most Karachi hospitals, schools and shops do
// not. commons.wikimedia.org itself does not answer from this machine; the hosted
// API does. Licence, artist and sized URLs are read back from the Wikipedia API,
// and the files themselves are served from upload.wikimedia.org.
//
// Honesty gate: a file is registered only when the file's own name contains
// every distinctive word of the record's name — including "Karachi" when the
// record uses it. That is what rejects the Mövenpick brand article, whose lead
// photo is a hotel in Jordan. A Commons description is read as supporting
// evidence, never as the credit: the credit names where the file was found.
//
// A third kind of target comes from the open tier: the records whose own map
// entry carries a link to an English Wikipedia article. That link is the mapper's
// claim about what the place is, so the article's photographs are evidence about
// the subject without anyone here having to guess a match — and the search pass
// is skipped entirely, because the article is already named.
//
// Anonymous calls to these APIs are rate-limited hard and the limit is shared
// across every Wikimedia host from one IP, so: one slow lane, and every answer
// is written to .tools/photos-cache.json as it arrives. A run that is stopped
// half-way — by a block, a reboot or a Ctrl-C — reads its own cache back and
// only asks the network for what it does not already know.
//
//   node .tools/resolve-missing-photos.mjs            dry run (prints what it found)
//   node .tools/resolve-missing-photos.mjs --write    merge into src/data/media.json
//   node .tools/resolve-missing-photos.mjs --only=a,b re-run a shortlist
//   node .tools/resolve-missing-photos.mjs --pace=8000  wait longer between calls
//   node .tools/resolve-missing-photos.mjs --explain  say WHY each empty record came up empty
import { build } from 'esbuild';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const WRITE = process.argv.includes('--write');
const EXPLAIN = process.argv.includes('--explain');
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) ?? '').slice(7).split(',').filter(Boolean);
const MANUAL = process.argv.find((a) => a.startsWith('--manual='))?.slice(9) ?? null;
const PACE = Number(process.argv.find((a) => a.startsWith('--pace='))?.slice(7)) || 5000;
const UA = 'Karachify/0.1 (city directory maintainer; sourcing licensed imagery)';
const ROOT = resolve('.');
const API = 'https://en.wikipedia.org/w/api.php';
const COMMONS_API = 'https://api.wikimedia.org/core/v1/commons/search/page';
const CACHE_FILE = join(ROOT, '.tools/photos-cache.json');

const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'de', 'al', 'en', 'i']);
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = (s) => norm(s).split(' ').filter((t) => t.length > 2 && !STOP.has(t));
const IGNORED_FILE = /(\.svg|\.pdf|\.ogg|\.webm|\.gif|logo|icon|symbol|flag|coat|seal|crest|locator map|disambig|commons)/i;

const cache = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : {};
let cacheDirty = false;
function remember(url, body) {
  cache[url] = body;
  cacheDirty = true;
  // Written after every answer because the run is long and any part of it may
  // be cut off; a cache that only survives to the end is not a resume point.
  writeFileSync(CACHE_FILE, `${JSON.stringify(cache, null, 0)}\n`);
}

let lastCall = 0;
async function paced(url, attempt = 0) {
  if (cache[url]) return cache[url];
  const wait = PACE - (Date.now() - lastCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (res.status === 429) {
      // Retry-After is a number of SECONDS here, and often fractional — reading
      // it as milliseconds turned every limit into a spin loop that made it worse.
      const raw = Number(res.headers.get('retry-after'));
      const secs = Number.isFinite(raw) && raw > 0 ? raw : 20 * (attempt + 1);
      await res.body?.cancel().catch(() => {});
      if (attempt < 8) {
        const backoff = Math.min(180, Math.max(5, secs) + PACE / 1000) * 1000;
        process.stderr.write(`  rate limited, backing off ${Math.round(backoff / 1000)}s\n`);
        await new Promise((r) => setTimeout(r, backoff));
        return paced(url, attempt + 1);
      }
      return {};
    }
    const text = await res.text();
    if (!text.startsWith('{')) {
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 2500 * (attempt + 1)));
        return paced(url, attempt + 1);
      }
      return {};
    }
    const body = JSON.parse(text);
    remember(url, body);
    return body;
  } catch {
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 2000));
      return paced(url, attempt + 1);
    }
    return {};
  }
}

async function api(params) {
  return paced(`${API}?${new URLSearchParams(params)}&format=json`);
}

/**
 * File names are searched on Commons itself, through the hosted API —
 * commons.wikimedia.org does not answer from this machine, but api.wikimedia.org
 * does, and it returns the file's own description alongside the title. The
 * licence and the sized URLs still come from pass 3.
 */
async function commonsFiles(phrase) {
  const data = await paced(`${COMMONS_API}?q=${encodeURIComponent(phrase)}&limit=8`);
  return (data?.pages ?? [])
    /* The search answers with pages of every namespace; a Category: page is a
       list of files, not one, and has no licence of its own to read. */
    .filter((p) => /^File:/i.test(p.title ?? ''))
    .map((p) => ({ file: p.title.replace(/^File:/i, '').replace(/_/g, ' '), desc: strip(p.excerpt) ?? '' }))
    .filter((p) => p.file && !IGNORED_FILE.test(p.file));
}

/* Every one of these markers was seen in this repository's own rejects: a cast
   photo standing in for the Arts Council, a student speaking at a university,
   and U.S. Navy sports-trophy pictures standing in for the Pakistan Naval
   Academy. A marker that is part of the record's own name does not count — a
   record about a football stadium is not disqualified from its own photographs
   because the word "football" is what the place is called. */
const NOT_THE_SUBJECT = /\b(pictured|portrait|meets?|meeting|inaugurat\w*|visits?|awarded?|ceremony|graduating|convocation|class of|with the|speaking|cast crew|performers?|trophy|cricket|volleyball|basketball|handball|hockey|rugby|match|tournament|concert|musical|festival|protest)\b/i;
const OTHER_CITY = /\b(lahore|islamabad|rawalpindi|multan|peshawar|quetta|sialkot|faisalabad|hyderabad|gujranwala|indore|delhi|mumbai|london|dubai|new york)\b/i;

/* Filled once the record names are read, just below: the words that carry no
   identification because our own records use them over and over. */
let GENERIC = new Set();

/**
 * Every distinctive word of the record name must be evidenced, and the photo
 * itself must carry most of that evidence:
 *   · all of the words appear across the file name plus the article it was
 *     found in, and
 *   · at least half of them appear in the file name alone.
 * The second condition is what keeps a portrait of a founder out of a record
 * about the institution: being embedded in the right article is not enough,
 * the file has to be named for the thing too.
 *
 * Three shapes of near-miss the token test cannot see, all of them observed
 * here: a file named for a *person* at the building, a file of the same
 * institution's branch in another city, and a file whose name belongs to a
 * different Karachi place that happens to share a word with this record.
 *
 * Returns null when the file passes every test, otherwise the one line that
 * explains the rejection. `--explain` prints those, because "Commons has no
 * photograph of this" and "our gate refused it" look identical from outside
 * and need opposite fixes.
 */
function gateVerdict(name, fileTitle, articleTitle = '', place = ['karachi'], localityEvidenced = false, others = [], otherAreas = []) {
  const f = norm(fileTitle.replace(/\.(jpe?g|png|webp|tiff)$/i, ''));
  const a = norm(articleTitle);
  /* "Campus" and "Branch" are words we added to tell two records apart, not part
     of what the building is called, so a file named for the institution itself is
     still evidence about this subject. Area words stay required: a photo of the
     wrong City School campus would be exactly the mistake this gate exists for. */
  const need = tokens(name).filter((w) => w !== 'campus' && w !== 'branch');
  const event = NOT_THE_SUBJECT.exec(`${fileTitle} ${articleTitle}`);
  if (event && !need.includes(norm(event[1]))) return 'a person or event at the building, not the building';
  if (OTHER_CITY.test(fileTitle)) return 'names a different city';
  /* A photograph whose own name belongs to a different Karachi place is evidence
     about that place. "PK Karachi … Bagh Ibne Qasim.jpg" landing on the Malir
     record called "Bagh e Karachi" is exactly the swap this whole gate exists to
     stop, and the words in the file name say so plainly. */
  const hijack = others.find((o) => o.words.every((w) => f.includes(w)));
  if (hijack) return `named for ${hijack.label}, which is a different place`;
  /* "Bahadurabad Area Karachi City.jpg" is a picture of Bahadurabad, whatever
     the word "City" is doing at the end of its name. A file that names one of
     the city's other localities — and the record is not in that locality — is
     about the locality, not about this record. */
  const wrongArea = otherAreas.find((o) => o.words.every((w) => f.includes(w)));
  if (wrongArea) return `names ${wrongArea.label}, a different part of Karachi`;
  /* Something has to put the picture in this city. Without it, a photograph of
     St Anthony's High School in Goa or Lahore reads as a perfectly good match
     for the Karachi record of the same name. Either the words say so, or the
     article the file sits in is itself geo-tagged inside the Karachi box —
     `localityEvidenced`, which is how an article titled "NED University of
     Engineering & Technology", with no city in its name, still places its
     photographs here. */
  if (!localityEvidenced && !place.some((w) => f.includes(w) || a.includes(w))) return 'nothing places it in Karachi';
  if (need.length < 2) return 'the record name is too generic to identify one photograph';
  const inFile = need.filter((w) => f.includes(w));
  if (inFile.length < Math.ceil(need.length / 2)) return `file name carries ${inFile.length} of the ${need.length} words that identify it`;
  /* Sharing only words that thousands of Karachi records also use proves
     nothing: "Karachi City" is answered by "Techno City in Karachi", "Bagh e
     Karachi" by any garden in the city. So the file has to carry a word that
     makes *this* record specific — and when the record's own name contains no
     such word at all, the only honest proof left is the whole name, in order.
     The phrase is built from `need`, so the "Campus" and "Branch" we added to
     tell two records apart are not demanded of a photograph. */
  const distinctive = need.filter((w) => !GENERIC.has(w));
  if (distinctive.length) {
    if (!inFile.some((w) => distinctive.includes(w))) return `carries only shared words, none of ${distinctive.join(', ')}`;
  } else if (!f.includes(need.join(' '))) {
    return `"${name}" is made only of words shared by many Karachi places, and the file is not named that phrase`;
  }
  const missing = need.filter((w) => !f.includes(w) && !a.includes(w));
  if (missing.length) return `not evidenced anywhere: ${missing.join(', ')}`;
  return null;
}

function thumbAt(url, width) {
  const u = (url ?? '').split('?')[0];
  const m = u.match(/^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons)\/([a-z0-9])\/([a-z0-9]{2})\/([^/]+)$/);
  if (!m) return null;
  return `${m[1]}/thumb/${m[2]}/${m[3]}/${m[4]}/${width}px-${m[4]}`;
}

/**
 * Does this URL really carry a picture, and how big is it? HEAD first: the file
 * backend is not the API and a two-hundred-kabyte download per candidate, three
 * times over a long run, is traffic this IP has already been told off for.
 *
 * The file backend is rate-limited too, and a 429 says nothing about the
 * picture, so it is waited out and never written to the cache. A run that cached
 * its rate limits remembered four perfectly good photographs as missing.
 */
async function probe(url, attempt = 0) {
  if (!url) return 0;
  if (cache[url] !== undefined) return cache[url];
  const wait = PACE - (Date.now() - lastCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  const res = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': UA } }).catch(() => null);
  if (res) {
    const length = Number(res.headers.get('content-length'));
    await res.body?.cancel().catch(() => {});
    if (res.status === 429 && attempt < 8) {
      const secs = Number(res.headers.get('retry-after')) || 20 * (attempt + 1);
      const backoff = Math.min(180, Math.max(5, secs) + PACE / 1000) * 1000;
      process.stderr.write(`  file backend is limiting, waiting ${Math.round(backoff / 1000)}s\n`);
      await new Promise((r) => setTimeout(r, backoff));
      return probe(url, attempt + 1);
    }
    if (res.status === 200 && Number.isFinite(length)) {
      remember(url, length > 6000 ? length : 0);
      return cache[url];
    }
  }
  /* No HEAD answer, or no length in it: ask once for the file itself. The body
     read is wrapped too — a connection reset halfway through a download rejects
     here, and that ended a run once. */
  const got = await fetch(url, { headers: { 'User-Agent': UA } }).catch(() => null);
  if (!got) return attempt < 8 ? probe(url, attempt + 1) : 0;
  const bytes = got.ok ? await got.arrayBuffer().then((b) => b.byteLength).catch(() => 0) : 0;
  if (got.status === 429) {
    if (attempt >= 8) return 0;
    await new Promise((r) => setTimeout(r, Math.min(180, (Number(got.headers.get('retry-after')) || 20) * (attempt + 1)) * 1000));
    return probe(url, attempt + 1);
  }
  if (got.status === 200 && !bytes) return attempt < 8 ? probe(url, attempt + 1) : 0;
  const kept = got.status === 200 && bytes > 6000 ? bytes : 0;
  remember(url, kept);
  return kept;
}

const chunk = (xs, n) => xs.reduce((acc, x) => {
  if (!acc.length || acc[acc.length - 1].length >= n) acc.push([]);
  acc[acc.length - 1].push(x);
  return acc;
}, []);

const strip = (v) => (v ? String(v).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : undefined);

/**
 * The `wikipedia` field of a map record is written by whoever mapped it and
 * arrives in three shapes. Only an English title can be read from the API used
 * here, so the other projects are left alone rather than translated by guesswork.
 */
function enArticle(value) {
  const s = (value ?? '').trim();
  const prefixed = /^en:(.+)$/.exec(s);
  if (prefixed) return prefixed[1].replace(/_/g, ' ').trim();
  const link = /^https?:\/\/en\.wikipedia\.org\/wiki\/(.+)$/.exec(s);
  if (link) {
    try {
      return decodeURIComponent(link[1]).replace(/_/g, ' ').trim();
    } catch {
      return link[1].replace(/_/g, ' ').trim();
    }
  }
  return null;
}

const bundle = await build({
  stdin: {
    contents: `
      export { listings } from './listings';
      export { categories, areas } from './taxonomy';
      export { default as media } from './media.json';
    `,
    resolveDir: join(ROOT, 'src/data'),
    loader: 'ts',
  },
  bundle: true, format: 'esm', platform: 'neutral', write: false, logLevel: 'silent',
});
const tmp = mkdtempSync(join(tmpdir(), 'karachify-photos-'));
const dataFile = join(tmp, 'data.mjs');
writeFileSync(dataFile, bundle.outputFiles[0].text);
const { listings, categories, areas, media } = await import(pathToFileURL(dataFile).href);

const areaNameById = new Map(areas.map((a) => [a.id, a.name]));
/** The words that tie a photograph to this city, and to this part of it. */
const placeWords = (l) => [...new Set(['karachi', ...(l?.areaId ? tokens(areaNameById.get(l.areaId) ?? '') : [])])];

const targets = [];
for (const l of listings) {
  if (media[l.slug]) continue;
  /* A curated record's `wiki` names are written by whoever compiled the listing
     and are read as the article the photographs should come from — the same kind
     of pre-named evidence a map record's article link is for the open tier. */
  const named = (l.wiki ?? []).filter((t) => typeof t === 'string' && t.trim());
  targets.push({ key: l.slug, name: l.name, kind: 'listing', areaId: l.areaId, place: placeWords(l), articles: named.length ? named : undefined });
}
for (const c of categories) {
  const key = `banner-${c.id}`;
  if (!media[key]) targets.push({ key, name: c.name, kind: 'category', place: ['karachi'] });
}
const TIER_DIR = join(ROOT, 'public/data/tier');
const PART_ROOT = join(TIER_DIR, 'parts');
/** Every name in the open tier, whether or not it is a target this run: the
 *  pool the "does this word identify anything?" count is taken from. */
const tierNames = [];
if (existsSync(PART_ROOT)) {
  for (const indexFile of readdirSync(PART_ROOT).filter((f) => f.endsWith('.json'))) {
    const index = JSON.parse(readFileSync(join(PART_ROOT, indexFile), 'utf8'));
    for (let i = 0; i < index.parts.length; i++) {
      const part = JSON.parse(readFileSync(join(PART_ROOT, index.id, `${String(i + 1).padStart(3, '0')}.json`), 'utf8'));
      for (const r of part.records) {
        tierNames.push(r.name);
        const title = enArticle(r.wikipedia);
        if (!title) continue;
        const key = `open:${index.id}:${r.slug}`;
        if (media[key]) continue;
        targets.push({
          key,
          name: r.name,
          kind: 'open',
          areaId: r.areaId,
          articles: [title],
          place: [...new Set(['karachi', ...(r.areaId ? tokens(areaNameById.get(r.areaId) ?? '') : [])])],
        });
      }
    }
  }
}
if (ONLY.length) targets.splice(0, targets.length, ...targets.filter((t) => ONLY.includes(t.key)));
if (MANUAL) {
  const picks = JSON.parse(readFileSync(join(ROOT, MANUAL), 'utf8'));
  for (const p of picks) {
    const t = targets.find((x) => x.key === p.key);
    if (t) t.picked = [{ article: p.article, file: p.file }];
  }
}

/* ── pass 1: which article or Commons file most likely holds the photo ───── */
let step = 0;
for (const target of targets) {
  /* A hand-picked shortlist (`--manual=`) needs no looking up at all. */
  if (target.picked) continue;
  process.stderr.write(`  looking up ${++step}/${targets.length} ${target.name}\n`);
  const clean = target.name.replace(/\(.*?\)/g, ' ').replace(/&.*$/, ' ').replace(/,.*/, ' ').trim();
  if (!target.articles) {
    const search = await api({ action: 'query', list: 'search', srsearch: `"${target.name}" Karachi`, srlimit: 4 });
    let hits = (search?.query?.search ?? []).map((s) => s.title);
    if (!hits.length) {
      const loose = await api({ action: 'query', list: 'search', srsearch: `${clean} Karachi`, srlimit: 4 });
      hits = (loose?.query?.search ?? []).map((s) => s.title);
    }
    target.articles = hits.slice(0, 3);
  }
  const core = clean.replace(/\b(campus|branch)\b/i, ' ').replace(/\s+/g, ' ').trim();
  target.commons = await commonsFiles(`"${target.name}"`);
  if (target.commons.length < 3) target.commons.push(...(await commonsFiles(`${core} Karachi`)));
  target.commons = [...new Map(target.commons.map((c) => [c.file, c])).values()];
}

/* ── pass 2: every image embedded in those articles, in batched calls ────── */
const allArticles = [...new Set(targets.flatMap((t) => t.picked?.map((p) => p.article) ?? t.articles ?? []))];
const imagesByArticle = new Map();
/* A map record's article link is often to a redirect ("Askari Park" → "Kashmir
   Park"), and a batched titles= query returns the page the redirect resolves
   TO. Without following them, the images simply never appear under the title
   the map named. The credit uses the resolved title, so it names the article
   the photograph actually came from. */
const articleResolved = new Map();
for (const group of chunk(allArticles, 20)) {
  const data = await api({ action: 'query', titles: group.join('|'), prop: 'images', imlimit: 80, redirects: 1 });
  for (const r of data?.query?.redirects ?? []) articleResolved.set(r.index ?? r.from, r.to);
  for (const page of Object.values(data?.query?.pages ?? {})) {
    imagesByArticle.set(page.title, (page.images ?? []).map((i) => i.title.replace(/^File:/, '')).filter((f) => !IGNORED_FILE.test(f)));
  }
}
for (const target of targets) target.articles = (target.articles ?? []).map((a) => articleResolved.get(a) ?? a);

/* ── pass 2b: does the article itself sit inside Karachi? ────────────────── */
/* Most institutions are named without their city — the article is "NED
   University of Engineering & Technology", and so is every photograph inside
   it, so the word test alone throws all of them away. A geo-tagged article is
   the stronger statement anyway: its coordinates are maintained on the article
   itself, and lying inside this box is what makes it evidence about Karachi. */
const IN_KARACHI = (lat, lng) => lat >= 24.4 && lat <= 25.4 && lng >= 66.6 && lng <= 67.9;
const localArticles = new Set();
for (const group of chunk([...new Set(targets.flatMap((t) => t.articles ?? []))], 25)) {
  const data = await api({ action: 'query', titles: group.join('|'), prop: 'coordinates', colimit: 1 });
  for (const page of Object.values(data?.query?.pages ?? {})) {
    const c = (page.coordinates ?? []).find((x) => x.primary) ?? (page.coordinates ?? [])[0];
    if (c && IN_KARACHI(Number(c.lat), Number(c.lon))) localArticles.add(page.title);
  }
}

/* ── pass 2c: the picture Wikipedia leads the article with ───────────────── */
/* When an article's own title IS the record, its lead image is that article's
   claim about its subject — better evidence than any file name, because a
   school's photograph is often captioned nothing more than "KGS campus.jpg".
   Only the lead image is trusted this way; the rest of the gallery is portraits
   of founders and alumni, and those still have to name themselves.
   `nameMatch` is deliberately two-sided: every word of the article title must
   be in the record name (so "List of schools in Karachi" can never match) and
   most of the record's words must be in the title (so the record's own extra
   qualifiers — a "TDF" prefix, a parenthesised acronym — do not block it). */
const coreWords = (s) => tokens(String(s ?? '').replace(/\(.*?\)/g, ' ')).filter((w) => w !== 'campus' && w !== 'branch');
function nameMatch(recordName, articleTitle) {
  const x = coreWords(recordName);
  const y = coreWords(articleTitle);
  if (y.length < 2 || x.length < 2) return false;
  return y.every((w) => x.includes(w)) && x.filter((w) => y.includes(w)).length >= Math.ceil(x.length / 2);
}
const leadGate = (file, article = '') =>
  NOT_THE_SUBJECT.test(`${file} ${article}`) ? 'a person or event at the building, not the building'
    : OTHER_CITY.test(file) ? 'names a different city'
      : null;

const leadPairs = [];
for (const target of targets) {
  const place = target.place ?? ['karachi'];
  for (const a of target.articles ?? []) {
    if (!nameMatch(target.name, a)) continue;
    if (!localArticles.has(a) && !place.some((w) => norm(a).includes(w))) continue;
    leadPairs.push({ key: target.key, article: a });
  }
}
const leadImage = new Map();
for (const group of chunk([...new Set(leadPairs.map((p) => p.article))], 20)) {
  const data = await api({ action: 'query', titles: group.join('|'), prop: 'pageimages', piprop: 'name', redirects: 1 });
  for (const page of Object.values(data?.query?.pages ?? {})) {
    const file = (page.pageimage ?? '').replace(/^File:/, '');
    if (file && !IGNORED_FILE.test(file)) leadImage.set(page.title, file);
  }
}
const leadByTarget = new Map();
for (const p of leadPairs) {
  const file = leadImage.get(p.article);
  if (!file) continue;
  const list = leadByTarget.get(p.key) ?? [];
  list.push({ article: p.article, file, source: p.article, lane: 'lead' });
  leadByTarget.set(p.key, list);
}

/* Every Karachi subject this build knows about, by name — the 156 curated
   records, everything already credited, and all 18,812 map records, whether or
   not they are being searched this run. A candidate file that names one of them
   — and is at least as specific as the record it is being offered to — is
   talking about that other place. */
const knownLabels = [
  ...new Set([...listings.map((l) => l.name), ...Object.values(media).map((m) => m.subject), ...tierNames]),
].filter((n) => typeof n === 'string' && n.trim());

/* Counted from those names, not hand-written: a word carried by twenty of them
   cannot single any one out. "Karachi", "market", "city" and "park" are what
   this finds, and it is why a file named "Techno City in Karachi" proves
   nothing about the record called "Karachi City". */
const labelWords = new Map();
for (const n of knownLabels) for (const w of new Set(tokens(n))) labelWords.set(w, (labelWords.get(w) ?? 0) + 1);
GENERIC = new Set([...labelWords].filter(([, c]) => c >= 20).map(([w]) => w));
if (EXPLAIN) console.error(`words shared by 20+ record names: ${[...GENERIC].sort().join(', ')}`);

let awaitedLocality = null;
for (const target of targets) {
  const need = tokens(target.name).filter((w) => w !== 'campus' && w !== 'branch');  const others = knownLabels
    .filter((n) => norm(n) !== norm(target.name) && !nameMatch(target.name, n))
    .map((n) => ({ label: n, words: tokens(n).filter((w) => w !== 'campus' && w !== 'branch') }))
    .filter((o) => o.words.length >= 2 && o.words.length >= need.length && !o.words.every((w) => need.includes(w)));
  target.others = others;
  const otherAreas = areas
    .filter((a) => a.id !== target.areaId)
    .map((a) => ({ label: a.name, words: tokens(a.name).filter((w) => !GENERIC.has(w)) }))
    .filter((o) => o.words.length >= 1);
  /* `source` is what the registry credits: an article title, or the plain
     "Wikimedia Commons" when the file was found by name there. The Commons
     description travels as `article` because that is the text the name gate
     reads, but it is prose, not something to print in a photo credit. */
  const fromArticles = (target.articles ?? []).flatMap((a) => (imagesByArticle.get(a) ?? []).map((file) => ({ article: a, file, source: a })));
  const fromCommons = (target.commons ?? []).map((c) => ({ article: c.desc, file: c.file, source: 'Wikimedia Commons' }));
  const candidates = target.picked?.map((p) => ({ ...p, source: p.article })) ?? [...(leadByTarget.get(target.key) ?? []), ...fromCommons, ...fromArticles];
  target.candidates = [];
  target.rejected = [];
  target.otherAreas = otherAreas;
  for (const c of candidates) {
    const verdict = c.lane === 'lead' ? leadGate(c.file, c.article) : gateVerdict(target.name, c.file, c.article, target.place ?? ['karachi'], localArticles.has(c.article), others, otherAreas);
    if (verdict === 'nothing places it in Karachi') (awaitedLocality ??= []).push({ target, c });
    else if (verdict) target.rejected.push({ ...c, why: verdict });
    else target.candidates.push(c);
  }
}

/* ── pass 2e: usage as evidence of the city ─────────────────────────────────
   A file whose name carries no city can still be pinned to Karachi by where
   Wikipedia actually puts it: a photograph used in the article titled
   "Karachi", or in this record's own article, is a Karachi photograph. Only
   the city is proved this way — the name gate still has to decide whether the
   file is about *this* place — so the whole gate runs again on these files
   with locality settled, and everything else about them is unchanged. */
if (awaitedLocality?.length) {
  const files = [...new Set(awaitedLocality.map((x) => x.c.file))];
  const placed = new Map();
  let checked = 0;
  for (const group of chunk(files, 50)) {
    const data = await api({
      action: 'query', titles: group.map((f) => `File:${f}`).join('|'),
      prop: 'globalusage|fileusage', redirects: 1, agulimit: 40,
    });
    for (const page of Object.values(data?.query?.pages ?? {})) {
      const name = (page.title ?? '').replace(/^File:/, '');
      const used = [...(page.globalusage ?? []), ...(page.fileusage ?? [])].map((u) => u.title.replace(/_/g, ' '));
      /* Only the article for the city itself counts. "Karachi Fire Brigade" is
         an article about a service, and a file used there proves nothing about
         where it was taken. */
      if (used.some((t) => /^karachi(\s*\((city|division)\))?$/.test(t))) placed.set(name, 'Karachi');
    }
    checked += group.length;
    process.stderr.write(`  checked ${checked}/${files.length} files for city usage\n`);
  }
  for (const { target, c } of awaitedLocality) {
    const via = placed.get(c.file);
    if (!via) continue;
    const again = gateVerdict(target.name, c.file, c.article, target.place ?? ['karachi'], true, target.others, target.otherAreas);
    if (again) target.rejected.push({ ...c, why: `${again} (usage says Karachi, via “${via}”)` });
    else {
      if (EXPLAIN) console.error(`  usage placed ${c.file} in Karachi through “${via}”`);
      target.candidates.push(c);
    }
  }
}

/* ── pass 3: licence + size + URLs for the survivors only ────────────────── */
const allFiles = [...new Set(targets.flatMap((t) => t.candidates.map((c) => c.file)))];
const infoByFile = new Map();
const fileResolved = new Map();
for (const group of chunk(allFiles, 25)) {
  const data = await api({
    action: 'query', titles: group.map((f) => `File:${f}`).join('|'), prop: 'imageinfo',
    iiprop: 'url|size|extmetadata', iiextmetadatafilter: 'LicenseShortName|Artist|ImageDescription|UsageTerms', redirects: 1,
  });
  for (const r of data?.query?.redirects ?? []) fileResolved.set(r.index ?? r.from, r.to);
  for (const page of Object.values(data?.query?.pages ?? {})) {
    const name = (page.title ?? '').replace(/^File:/, '');
    if (page.imageinfo?.[0]) infoByFile.set(name, page.imageinfo[0]);
  }
}

const registry = { ...media };
let added = 0;
for (const target of targets) {
  let won = null;
  const why = [];
  for (const { article, file, source } of target.candidates) {
    const info = infoByFile.get(fileResolved.get(file) ?? file);
    if (!info) {
      why.push(`${file}: no licence record came back`);
      continue;
    }
    if (info.width < 800) {
      why.push(`${file}: ${info.width}px wide, too small to print at banner size`);
      continue;
    }
    /* The line written under the file is the loudest statement of what it shows.
       "Dolmen City Karachi.jpg" captioned "Clifton Beach in Karachi" is about one
       of those two places, and this record is neither — so a caption naming any
       other Karachi subject, or naming an event rather than a building, ends it. */
    const caption = strip(info.extmetadata?.ImageDescription?.value) ?? '';
    const contradicted = (target.others ?? []).find((o) => o.words.every((w) => norm(caption).includes(w)));
    if (contradicted) {
      why.push(`${file}: its own caption names ${contradicted.label}`);
      continue;
    }
    const captionEvent = NOT_THE_SUBJECT.exec(`${file} ${article} ${caption}`);
    if (captionEvent && !tokens(target.name).includes(norm(captionEvent[1]))) {
      why.push(`${file}: caption is about "${captionEvent[1]}", not the place`);
      continue;
    }
    const wide = thumbAt(info.url, 1280);
    /* One probe per candidate, not two: the 1280px and the 500px address are
       the same file rendered by the same backend, so the large one answering
       is enough to promise the small one — and this backend has its own rate
       limit, which the last run spent on a second request for nothing. */
    const bytes = await probe(wide);
    if (!bytes) {
      why.push(`${file}: the URL it returned did not load`);
      continue;
    }
    won = { article, file, source, info, wide, card: thumbAt(info.url, 500) ?? wide, bytes };
    break;
  }
  if (!won) {
    console.log(`none      ${target.kind.padEnd(8)} ${target.name}${target.candidates.length ? ` — ${why.slice(0, 2).join('; ')}` : ''}`);
    if (EXPLAIN) {
      console.log(`            searched articles: ${target.articles?.length ? target.articles.join(' | ') : '(none found)'}`);
      console.log(`            commons name hits: ${target.commons?.length ?? 0} · lead image: ${(leadByTarget.get(target.key) ?? []).map((c) => c.file).join(', ') || '(none)'} · files examined: ${target.candidates.length + target.rejected.length} · refused by the gate: ${target.rejected.length}`);
      for (const r of target.rejected.slice(0, 4)) console.log(`              ✗ ${r.file} — ${r.why}`);
    }
    continue;
  }
  const license = strip(won.info.extmetadata?.LicenseShortName?.value) ?? 'licence not stated';
  /* Commons stores a literal "Unknown authorUnknown author" on old public-domain
     scans. Printing that as a credit would look like a mistake by us, and a file
     page link says the same thing honestly, so the credit is left off instead. */
  const artistRaw = strip(won.info.extmetadata?.Artist?.value);
  const artist = artistRaw && !/^(unknown( ?author)?|self|n\/?a|photographer unknown)/i.test(artistRaw) ? artistRaw : undefined;
  console.log(`FOUND     ${target.kind.padEnd(8)} ${target.name}\n            ${won.source} -> ${won.file}\n            ${license} · ${artist ?? 'no named author'} · ${won.bytes}B at 1280px`);
  if (WRITE) {
    registry[target.key] = {
      key: target.key,
      subject: target.name,
      via: won.source,
      thumb: won.card,
      wide: won.wide,
      filePage: won.info.descriptionurl ?? `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(won.file.replace(/ /g, '_'))}`,
      artist,
      license,
      verified: true,
      kind: 'subject',
    };
    added++;
    /* Written as each one lands, not once at the end: a reset connection
       halfway through pass 3 used to throw away every photograph found so far. */
    writeFileSync(join(ROOT, 'src/data/media.json'), `${JSON.stringify(registry, null, 2)}\n`);
  }
}

console.log(`\nchecked ${targets.length} records · ${allFiles.length} files passed the name gate · registered ${WRITE ? added : 0}${WRITE ? '' : ' (dry run — nothing written)'}`);
