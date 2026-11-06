#!/usr/bin/env node
// The second look at the records the name gate left empty.
//
// resolve-missing-photos.mjs reads a photograph's NAME, and for most of what is
// still empty here the name says nothing: a picture of Karachi Grammar School is
// filed as "School building 2019.jpg". Commons keeps three further statements
// about every file, written or curated by the people who upload it, and those are
// what a reader of a well-sourced page is really being shown — so this run reads
// them instead:
//   · the file page's own categories. A file sitting in "Category:Mazar-e-Quaid"
//     is sitting there because a curator judged that it shows the mausoleum.
//   · the description and "object name" the uploader wrote for the file.
//   · the position the camera recorded, which is compared with this record's own
//     map pin: a photo shot 200 m from the pin is about what stands at the pin.
// Files are found through the subject itself rather than through a phrase: the
// place's Wikidata item, its Commons category (P373) and the files Commons tags
// as depicting it (P180). An item only counts when the community's own claims put
// it in Karachi, so the identity is checked before any picture is offered.
//
// Nothing here loosens the rule that a record is only photographed when the
// evidence names it — the evidence is simply read from more than the filename.
// Every accepted file is stored with its author, licence and file page, and the
// reason it was accepted, so a reader can check it. Hotlinking a news site's or a
// hotel's own photograph is a different thing: that image is their copyright, not
// a licensed file, so it is never copied here.
//
//   node .tools/resolve-verified-photos.mjs                 dry run + review dump
//   node .tools/resolve-verified-photos.mjs --write         merge into media.json
//   node .tools/resolve-verified-photos.mjs --only=a,b      a shortlist
//   node .tools/resolve-verified-photos.mjs --pace=8000     wait longer per call
import { build } from 'esbuild';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const WRITE = process.argv.includes('--write');
const TRACE = process.argv.includes('--trace');
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) ?? '').slice(7).split(',').filter(Boolean);
const PACE = Number(process.argv.find((a) => a.startsWith('--pace='))?.slice(7)) || 3000;
const ROOT = resolve('.');
const CACHE_FILE = join(ROOT, '.tools/photos-cache.json');
const REVIEW_FILE = join(ROOT, '.tools/photo-verified-review.json');
const UA = 'Karachify/0.1 (city directory maintainer; sourcing licensed imagery)';
const EN_API = 'https://en.wikipedia.org/w/api.php';
const WD_API = 'https://www.wikidata.org/w/api.php';
const COMMONS_API = 'https://api.wikimedia.org/core/v1/commons/search/page';

const KARACHI_QID = 'Q8660';
const IN_KARACHI = (lat, lng) => lat >= 24.4 && lat <= 25.4 && lng >= 66.6 && lng <= 67.9;

const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'de', 'al', 'en', 'i']);
const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = (s) => norm(s).split(' ').filter((t) => t.length > 2 && !STOP.has(t));
const IGNORED_FILE = /(\.svg|\.pdf|\.ogg|\.webm|\.gif|logo|icon|symbol|flag|coat|seal|crest|locator map|disambig|commons|\bplan\b|\bmap\b|diagram|signboard|\bsign\b|\bposter\b|\bcover\b)/i;
const NOT_THE_SUBJECT = /\b(pictured|portrait|meets?|meeting|inaugurat\w*|visits?|awarded?|ceremony|graduating|convocation|with the|speaking|cast crew|performers?|trophy|cricket|volleyball|basketball|handball|hockey|rugby|match|tournament|concert|musical|festival|protest)\b/i;
const OTHER_CITY = /\b(lahore|islamabad|rawalpindi|multan|peshawar|quetta|sialkot|faisalabad|gujranwala|hyderabad|murree|abbottabad|gilgit|skardu|indore|delhi|mumbai|london|dubai|new york)\b/i;
const strip = (v) => (v ? String(v).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : undefined);
/* Substring matching is not word matching: asked whether a file page mentions
   "Kara Medical Clinic", a plain `includes` finds it inside "Karachi" and throws
   away a hospital's photograph. A one-letter difference is allowed, because
   Commons writes plurals ("Schools in Karachi" for a record called a school). */
const sameWord = (a, b) => a === b || (a.startsWith(b) && a.length - b.length <= 1) || (b.startsWith(a) && b.length - a.length <= 1);
const carrierHas = (set, w) => set.has(w) || [...set].some((t) => sameWord(t, w));
/** Do these two names call the same place? Two-sided, so neither can be a lucky
    subset of the other: every word of the shorter must be in the longer, and that
    must be most of the longer too. */
const agree = (x, y) => {
  const a = tokens(x);
  const b = tokens(y);
  if (!a.length || !b.length) return false;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  const shared = short.filter((w) => long.some((t) => sameWord(t, w))).length;
  return shared === short.length && shared >= Math.ceil(long.length / 2);
};
const chunk = (xs, n) => xs.reduce((acc, x) => {
  const last = acc[acc.length - 1];
  if (!last || last.length >= n) acc.push([x]);
  else last.push(x);
  return acc;
}, []);

/* Filled once the record names are read: words our own records use over and over,
   which therefore identify nothing. */
let GENERIC = new Set();

const cache = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : {};
function remember(url, body) {
  cache[url] = body;
  /* Written after every answer: this run is long and any part of it may be cut
     off, and a cached rate limit would be worse than no answer at all — so a 429
     never reaches the file. */
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
      const secs = Number(res.headers.get('retry-after'));
      await res.body?.cancel().catch(() => {});
      if (attempt < 8) {
        const backoff = Math.min(180, Math.max(5, Number.isFinite(secs) && secs > 0 ? secs : 20 * (attempt + 1)) + PACE / 1000) * 1000;
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

const en = (params) => paced(`${EN_API}?${new URLSearchParams(params)}&format=json`);
const wd = (params) => paced(`${WD_API}?${new URLSearchParams(params)}&format=json`);
const commons = (q, limit = 30) => paced(`${COMMONS_API}?${new URLSearchParams({ q, limit })}`);
/* A coordinate arrives as a number, a string, or MediaWiki's {raw, ...} shape. */
const num = (v) => Number(v?.value?.raw ?? v?.value ?? v);

/** The file pages of a Commons category, by the category's own name. */
async function filesInCategory(name) {
  const data = await commons(`incategory:"${name}"`);
  return (data?.pages ?? [])
    .filter((p) => /^File:/i.test(p.title ?? ''))
    .map((p) => p.title.replace(/^File:/i, '').replace(/_/g, ' '))
    .filter((f) => f && !IGNORED_FILE.test(f));
}

/** Files whose structured data says they depict this very entity. */
async function filesDepicting(qid) {
  const data = await commons(`haswbstatement:P180=${qid}`);
  return (data?.pages ?? [])
    .filter((p) => /^File:/i.test(p.title ?? ''))
    .map((p) => p.title.replace(/^File:/i, '').replace(/_/g, ' '))
    .filter((f) => f && !IGNORED_FILE.test(f));
}

function thumbAt(url, width) {
  const u = (url ?? '').split('?')[0];
  const m = u.match(/^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons)\/([a-z0-9])\/([a-z0-9]{2})\/([^/]+)$/);
  return m ? `${m[1]}/thumb/${m[2]}/${m[3]}/${m[4]}/${width}px-${m[4]}` : null;
}

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
      await new Promise((r) => setTimeout(r, Math.min(180, Math.max(5, secs) + PACE / 1000) * 1000));
      return probe(url, attempt + 1);
    }
    if (res.status === 200 && Number.isFinite(length)) {
      remember(url, length > 6000 ? length : 0);
      return cache[url];
    }
  }
  return attempt < 2 ? probe(url, attempt + 1) : 0;
}

const km = (a, b, c, d) => {
  const rad = (x) => (x * Math.PI) / 180;
  const h = Math.sin(rad((c - a) / 2)) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad((d - b) / 2)) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

/* ── what this build needs, and every Karachi name it must not confuse ────── */
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
const tmp = mkdtempSync(join(tmpdir(), 'karachify-verified-'));
const dataFile = join(tmp, 'data.mjs');
writeFileSync(dataFile, bundle.outputFiles[0].text);
const { listings, areas, media } = await import(pathToFileURL(dataFile).href);

const areaNameById = new Map(areas.map((a) => [a.id, a.name]));
const targets = [];
for (const l of listings) {
  if (media[l.slug]) continue;
  targets.push({
    key: l.slug,
    name: l.name,
    lat: Number.isFinite(l.lat) ? l.lat : null,
    lng: Number.isFinite(l.lng) ? l.lng : null,
    place: [...new Set(['karachi', ...(l.areaId ? tokens(areaNameById.get(l.areaId) ?? '') : [])])],
    articles: (l.wiki ?? []).filter((t) => typeof t === 'string' && t.trim()),
  });
}
if (ONLY.length) targets.splice(0, targets.length, ...targets.filter((t) => ONLY.includes(t.key)));

const PART_ROOT = join(ROOT, 'public/data/tier/parts');
const tierNames = [];
if (existsSync(PART_ROOT)) {
  for (const indexFile of readdirSync(PART_ROOT).filter((f) => f.endsWith('.json'))) {
    const index = JSON.parse(readFileSync(join(PART_ROOT, indexFile), 'utf8'));
    for (let i = 0; i < (index.parts?.length ?? 0); i++) {
      const part = JSON.parse(readFileSync(join(PART_ROOT, index.id, `${String(i + 1).padStart(3, '0')}.json`), 'utf8'));
      for (const r of part.records ?? []) tierNames.push(r.name);
    }
  }
}
const knownLabels = [...new Set([
  ...listings.map((l) => l.name),
  ...Object.values(media).map((m) => m.subject),
  ...tierNames,
])].filter((n) => typeof n === 'string' && n.trim() && n.length > 3);
const labelWords = new Map();
for (const n of knownLabels) for (const w of new Set(tokens(n))) labelWords.set(w, (labelWords.get(w) ?? 0) + 1);
GENERIC = new Set([...labelWords].filter(([, c]) => c >= 20).map(([w]) => w));

/* ── pass 1: the entity each record is, and where the community puts it ──── */
const byline = new Map();
for (const group of chunk([...new Set(targets.flatMap((t) => t.articles))], 25)) {
  const data = await en({ action: 'query', titles: group.join('|'), prop: 'pageprops|coordinates', ppprop: 'wikibase_item', redirects: 1, colimit: 1 });
  for (const page of Object.values(data?.query?.pages ?? {})) {
    const qid = page.pageprops?.wikibase_item;
    if (!qid?.startsWith('Q')) continue;
    const c = (page.coordinates ?? [])[0];
    byline.set((page.title ?? '').replace(/_/g, ' '), { qid, inKarachi: c ? IN_KARACHI(Number(c.lat), Number(c.lon)) : false });
  }
}
/* The record's own `wiki` line is the curator's claim about which article holds
   this place, so its order is the order of trustworthiness — the first named
   article with an entity wins, rather than whichever page came back first. */
for (const t of targets) {
  for (const a of t.articles) {
    const hit = byline.get(a) ?? byline.get(a.replace(/_/g, ' '));
    if (!hit) continue;
    t.qid = hit.qid;
    t.qidVia = `the article “${a}” this record names`;
    t.articleInKarachi = hit.inKarachi;
    t.articleTitle = a;
    break;
  }
}

process.stderr.write(`  searching Wikidata for ${targets.filter((t) => !t.qid).length} records without an article\n`);
for (const t of targets.filter((x) => !x.qid)) {
  const clean = t.name.replace(/\(.*?\)/g, ' ').replace(/,.*/, ' ').replace(/\s+/g, ' ').trim();
  const hit = await wd({ action: 'wbsearchentities', search: clean, language: 'en', limit: 4, uselang: 'en' });
  const matches = (hit?.search ?? []).map((s) => ({
    qid: s.id,
    label: s.display?.label?.value ?? s.label ?? '',
    desc: s.display?.description?.value ?? s.description ?? '',
  })).filter((m) => m.qid?.startsWith('Q') && agree(t.name, m.label));
  const best = matches.find((m) => /karachi|sindh/i.test(m.desc)) ?? matches[0];
  if (best) {
    t.qid = best.qid;
    t.qidVia = `Wikidata searched for “${t.name}”`;
    t.wdDesc = best.desc;
    t.wdLabel = best.label;
  }
}

/* The community's own claims about each entity: does it sit in Karachi, and what
   is its Commons category? Two batched calls cover every entity found above. */
const qids = [...new Set(targets.map((t) => t.qid).filter(Boolean))];
const entities = new Map();
for (const group of chunk(qids, 40)) {
  const data = await wd({ action: 'wbgetentities', ids: group.join('|'), props: 'claims|labels|descriptions', languages: 'en' });
  for (const e of Object.values(data?.entities ?? {})) {
    const claims = e.claims ?? {};
    const value = (pid) => (claims[pid] ?? []).map((c) => c.mainsnak?.datavalue?.value?.id).filter(Boolean);
    entities.set(e.id, {
      label: e.labels?.en?.value ?? '',
      desc: e.descriptions?.en?.value ?? '',
      cats: (claims.P373 ?? []).map((c) => c.mainsnak?.datavalue?.value).filter(Boolean),
      in: value('P131'),
      coords: (claims.P625 ?? []).map((c) => c.mainsnak?.datavalue?.value).filter(Boolean),
      instance: value('P31'),
    });
  }
}
/* One hop up the "located in" chain, because a school is filed under its town
   rather than the city. */
const parents = [...new Set([...entities.values()].flatMap((e) => e.in).filter((q) => q !== KARACHI_QID))];
for (const group of chunk(parents, 40)) {
  const data = await wd({ action: 'wbgetentities', ids: group.join('|'), props: 'claims' });
  for (const e of Object.values(data?.entities ?? {})) {
    const up = (e.claims?.P131 ?? []).map((c) => c.mainsnak?.datavalue?.value?.id).filter(Boolean);
    for (const t of targets) if (t.qid && entities.get(t.qid)?.in.includes(e.id)) entities.get(t.qid).in.push(...up);
  }
}

for (const t of targets) {
  const e = t.qid ? entities.get(t.qid) : null;
  if (!e) continue;
  const saysKarachi = /karachi/i.test(`${e.desc} ${e.label}`) || /karachi/i.test(t.wdDesc ?? '');
  /* A Wikidata globe coordinate is {latitude, longitude}, not {lat, lon}. */
  const coords = e.coords.some((c) => IN_KARACHI(Number(c.latitude ?? c.lat), Number(c.longitude ?? c.lon)));
  const chain = e.in.includes(KARACHI_QID);
  /* An entity is this record's own subject only when it answers to the record's
     name. A record for “DHA Senior Secondary School” names the article about the
     Defence Housing Authority neighbourhood for context, and that item really is
     in Karachi — but its category is full of DHA parks and mosques, none of which
     is the school. */
  t.qidOwn = agree(t.name, e.label) || agree(t.name, t.articleTitle ?? '');
  if (t.articleTitle && !t.qidOwn) t.qidNotSubject = `its item is ${e.label || t.qid}, which is what the record's article is about, not what the record is called`;
  if (t.articleInKarachi || saysKarachi || coords || chain) {
    t.inKarachi = true;
    t.qidLabel = e.label;
    t.qidCats = e.cats;
    t.qidProof = [chain && 'its “located in” chain reaches Karachi', coords && 'its coordinate is inside the Karachi box',
      saysKarachi && 'its description names Karachi', t.articleInKarachi && 'the article it comes from is geo-tagged in Karachi'].filter(Boolean).join(', ');
  } else {
    t.qidRejected = `the entity ${e.label || t.qid} is not placed in Karachi by its own claims`;
    delete t.qid;
  }
}

/* ── pass 2a: what the article this record names for itself shows ───────── */
const articleLead = new Map();
const articleGallery = new Map();
const resolved = new Map();
for (const group of chunk([...new Set(targets.flatMap((t) => t.articles))], 20)) {
  const data = await en({ action: 'query', titles: group.join('|'), prop: 'images|pageimages', imlimit: 80, piprop: 'name', redirects: 1 });
  for (const r of data?.query?.redirects ?? []) resolved.set((r.from ?? '').replace(/_/g, ' '), (r.to ?? '').replace(/_/g, ' '));
  for (const page of Object.values(data?.query?.pages ?? {})) {
    const title = (page.title ?? '').replace(/_/g, ' ');
    const lead = (page.pageimage ?? '').replace(/^File:/, '');
    if (lead && !IGNORED_FILE.test(lead)) articleLead.set(title, lead);
    articleGallery.set(title, (page.images ?? []).map((x) => x.title.replace(/^File:/, '')).filter((f) => f && !IGNORED_FILE.test(f)));
  }
}

/* ── pass 2: the files Commons itself attributes to each subject ─────────── */
const PRIORITY = { lead: 0, depicts: 1, category: 2, byname: 3, article: 4, wordsearch: 5 };
let step = 0;
for (const t of targets) {
  process.stderr.write(`  looking up ${++step}/${targets.length} ${t.name}\n`);
  const lanes = [];
  const namedArticle = t.articles.map((a) => resolved.get(a) ?? a).find((a) => agree(t.name, a));
  const localityOk = t.articleInKarachi || /karachi/i.test(`${t.name} ${t.articles.join(' ')}`);
  if (namedArticle && localityOk) {
    const lead = articleLead.get(namedArticle);
    if (lead) lanes.push({ file: lead, lane: 'lead', proven: true, via: `the article “${namedArticle}”` });
    lanes.push(...(articleGallery.get(namedArticle) ?? []).map((f) => ({ file: f, lane: 'article', proven: false, via: `the article “${namedArticle}”` })));
  }
  /* A Commons category is made by curators, and two kinds of it can lead here: the
     one the entity declares as its own (P373), and one whose name is the record's
     or its article's. Only the first is a claim about identity; the second still
     has to be a category that names this place. Commons writes places with a
     comma — "Civil Hospital, Karachi" — so both shapes are asked. */
  const core = t.name.replace(/\(.*?\)/g, ' ').replace(/,.*/, ' ').replace(/\s+/g, ' ').trim();
  const commaForm = /karachi/i.test(core) ? core.replace(/\s*\bKarachi\b/i, ', Karachi').replace(/\s+,/, ',') : `${core}, Karachi`;
  const cats = [];
  const pushCat = (cat, proven) => {
    if (cat && !cats.some((c) => norm(c.cat) === norm(cat))) cats.push({ cat, proven });
  };
  for (const c of (t.inKarachi && t.qidOwn ? t.qidCats ?? [] : [])) pushCat(c, true);
  pushCat(t.articleTitle, false);
  pushCat(core, false);
  pushCat(commaForm, false);
  for (const { cat, proven } of cats.slice(0, 4)) {
    lanes.push(...(await filesInCategory(cat)).map((f) => ({ file: f, lane: proven ? 'category' : 'byname', proven, via: `Commons category “${cat}”` })));
  }
  if (t.qid && t.inKarachi && t.qidOwn) {
    lanes.push(...(await filesDepicting(t.qid)).map((f) => ({ file: f, lane: 'depicts', proven: true, via: `Commons files tagged as depicting ${t.qidLabel ?? t.qid}` })));
  }
  const phrase = await commons(`"${t.name}"`, 12);
  lanes.push(...(phrase?.pages ?? [])
    .filter((p) => /^File:/i.test(p.title ?? ''))
    .map((p) => ({ file: p.title.replace(/^File:/i, '').replace(/_/g, ' '), lane: 'wordsearch', proven: false, via: 'Wikimedia Commons', desc: strip(p.excerpt) ?? '' })));
  lanes.sort((a, b) => PRIORITY[a.lane] - PRIORITY[b.lane]);
  if (TRACE) process.stderr.write(`    trace ${JSON.stringify({ name: t.name, articleTitle: t.articleTitle ?? null, namedArticle: namedArticle ?? null, lead: articleLead.get(namedArticle ?? '') ?? null, gallery: (articleGallery.get(namedArticle ?? '') ?? []).length, qidCats: t.qidCats ?? null, cats: cats.map((c) => c.cat), lanes: lanes.map((l) => l.lane) })}\n`);
  t.lanes = [...new Map(lanes.map((l) => [l.file.replace(/ /g, '_').toLowerCase(), l])).values()].slice(0, 30);
}

/* ── pass 3: what each file says about itself ───────────────────────────── */
const allFiles = [...new Set(targets.flatMap((t) => t.lanes.map((l) => l.file)))];
const info = new Map();
process.stderr.write(`  reading the file pages of ${allFiles.length} candidates\n`);
for (const group of chunk(allFiles, 30)) {
  const data = await en({
    action: 'query', titles: group.map((f) => `File:${f.replace(/ /g, '_')}`).join('|'),
    prop: 'imageinfo', iiprop: 'url|size|extmetadata', converttitles: 1, redirects: 1,
    iiextmetadatafilter: 'LicenseShortName|Artist|ImageDescription|ObjectName|Categories|GPSLatitude|GPSLongitude|UsageTerms|Copyrighted',
  });
  for (const page of Object.values(data?.query?.pages ?? {})) {
    const name = (page.title ?? '').replace(/^File:/, '').replace(/_/g, ' ');
    if (page.imageinfo?.[0]) info.set(name, page.imageinfo[0]);
  }
}

/* Each thing a file page asserts about its own subject, read separately. The
   Categories field is one pipe-joined string, and a file sits in several
   categories at once — "Schools in Karachi" plus "Convent of Jesus and Mary
   (Murree)" — so joining them would let one category's words answer for
   another's and place a Murree school in Karachi. */
function carriers(lane, meta) {
  const cats = String(meta.Categories?.value ?? '').split('|').map(norm).filter(Boolean);
  return [
    { where: 'its file name', text: norm(lane.file.replace(/\.(jpe?g|png|webp|tiff)$/i, '')) },
    ...cats.map((c) => ({ where: 'the category it is filed under', text: c })),
    { where: 'its own description', text: norm(strip(meta.ImageDescription?.value)) },
    { where: 'its object name', text: norm(strip(meta.ObjectName?.value)) },
  ].filter((c) => c.text).map((c) => ({ ...c, words: new Set(tokens(c.text)) }));
}

/* Every other Karachi subject this build knows, indexed by the words that make it
   itself, so a file page is compared only with the subjects its own rarest word
   could possibly name. */
const subjectIndex = new Map();
for (const n of knownLabels) {
  const o = { label: n, key: norm(n), words: tokens(n).filter((w) => !GENERIC.has(w) && w !== 'campus' && w !== 'branch') };
  if (!o.words.length) continue;
  for (const w of new Set(o.words)) {
    if (!subjectIndex.has(w)) subjectIndex.set(w, []);
    subjectIndex.get(w).push(o);
  }
}
const namedForAnotherPlace = (t, needSet, carrier) => {
  const rarest = [...carrier.words].map((w) => ({ w, n: (subjectIndex.get(w) ?? []).length }))
    .filter((x) => x.n > 0).sort((a, b) => a.n - b.n)[0];
  if (!rarest) return null;
  return (subjectIndex.get(rarest.w) ?? [])
    .filter((o) => o.key !== norm(t.name) && o.words.length >= needSet.size && !o.words.every((w) => needSet.has(w)))
    .filter((o) => o.words.every((w) => carrierHas(carrier.words, w)))
    .sort((a, b) => b.words.length - a.words.length)[0] ?? null;
};

/* Naming a place is not the same as being a picture of it. "Mariamman temple in
   Jinnah Postgraduate Medical Centre" and "Drug Bank located at Civil Hospital"
   both contain the hospital's whole name, and both are photographs of something
   standing INSIDE it — the hospital is the address the uploader gave the real
   subject, not the subject. So the words that come before the first word of our
   record's name decide: a preposition of place means we are the address. */
const PLACE_BEFORE = new Set(['in', 'at', 'inside', 'within', 'near', 'opposite', 'behind', 'beside', 'along', 'above', 'below']);
const AT_OR_IN = /^(in|at|inside|within|near)$/;
function namesItAsAddress(text, need) {
  const ws = text.split(' ');
  const at = ws.findIndex((w) => need.some((n) => sameWord(w, n)));
  if (at < 1) return false;
  if (PLACE_BEFORE.has(ws[at - 1])) return true;
  return at > 1 && AT_OR_IN.test(ws[at - 1] ?? '') && /^(located|situated|found|based|photographed|shot)$/i.test(ws[at - 2] ?? '');
}

/* The judgement, per candidate. Returns the reason it was accepted, or the one
   line that says why it was refused. Two things have to be true, and both have
   to be said by the file itself rather than inferred by us:
     · identity — the file names this subject in one of its own fields, or it is
       the picture the article this record named for itself leads with, or Commons
       tags it as depicting the entity that article is about;
     · locality — Karachi is in the same words, the camera's own position is inside
       the city, or that entity is placed in Karachi by its own claims. */
function judge(t, lane, i) {
  if (!i) return { why: 'its file page did not answer, so nothing about it can be checked' };
  const meta = i.extmetadata ?? {};
  const fname = norm(lane.file.replace(/\.(jpe?g|png|webp|tiff)$/i, ''));
  const list = carriers(lane, meta);
  const desc = norm(strip(meta.ImageDescription?.value));
  const all = `${fname} ${list.map((c) => c.text).join(' ')} ${lane.desc ?? ''}`;
  const lat = num(meta.GPSLatitude);
  const lng = num(meta.GPSLongitude);
  const hasGps = Number.isFinite(lat) && Number.isFinite(lng) && (lat || lng);
  const gpsInKarachi = hasGps && IN_KARACHI(lat, lng);
  /* The city and the neighbourhood are the locality question, not the identity
     one, so they are not asked of the file's words here. */
  const need = [...new Set(tokens(t.name).filter((w) => !t.place.includes(w)))];
  const needSet = new Set(need);
  if (!need.length) return { why: 'the record name carries no word that could identify a photograph' };

  if (OTHER_CITY.test(all)) return { why: 'its own words name a different city' };
  const event = NOT_THE_SUBJECT.exec(`${fname} ${desc}`);
  if (event && !needSet.has(norm(event[1]))) return { why: `it is about “${event[1]}”, an event or a person, not the place` };
  const hijack = list.map((c) => namedForAnotherPlace(t, needSet, c)).filter(Boolean)
    .sort((a, b) => b.words.length - a.words.length)[0];
  if (hijack) return { why: `one of its own fields names ${hijack.label}, which is a different place` };

  const addressed = list.filter((c) => need.every((w) => carrierHas(c.words, w)) && namesItAsAddress(c.text, need));
  /* A field that puts us in the address slot cannot also be the evidence that the
     file is about us, and the same words scattered across the rest of the page
     would say no more — so those carriers are set aside before identity is asked. */
  const list2 = list.filter((c) => !addressed.includes(c));
  const namedBy = list2.find((c) => need.every((w) => carrierHas(c.words, w)));
  const spread = need.every((w) => list2.some((c) => carrierHas(c.words, w)));
  const identity = namedBy ? { where: namedBy.where, text: namedBy.text, strong: true }
    : spread ? { where: 'its file page, word by word', text: '', strong: false }
      : lane.lane === 'lead' ? { where: `the lead picture of ${lane.via}`, text: '', strong: false }
        : lane.proven && t.articleTitle ? { where: `Commons tags it as depicting ${t.qidLabel ?? t.qid}`, text: '', strong: false }
          : null;
  if (addressed.length && !namedBy && !spread && lane.lane !== 'lead' && !lane.proven) {
    return { why: `it names the place only as an address — “${addressed[0].text.slice(0, 60)}” is a photograph of what stands inside it` };
  }
  if (!identity) {
    return { why: `only ${need.filter((w) => list2.some((c) => carrierHas(c.words, w))).length} of the ${need.length} words that name it appear on the file page` };
  }

  const localHere = /karachi/.test(identity.text) || gpsInKarachi
    || (/karachi/.test(all) && (lane.proven || spread || namedBy))
    || (lane.proven && !!t.inKarachi);
  if (!localHere) {
    return { why: hasGps && !gpsInKarachi
      ? `the camera's own position (${lat.toFixed(2)}, ${lng.toFixed(2)}) is not in Karachi`
      : `the words that name it — “${identity.text.slice(0, 60)}” — say nothing about Karachi` };
  }

  const width = i.width ?? 0;
  const height = i.height ?? 0;
  /* The floor is the smallest original already credited in this registry (600px),
     and `measure-renditions` then offers only the widths that really answer, so a
     soft old photograph reaches a phone card crisply and a desktop banner only as
     far as it can. */
  if (width < 600) return { why: `${width}px wide, too small to print at banner size` };
  const license = strip(meta.LicenseShortName?.value);
  if (!license) return { why: 'no licence is stated on its file page' };
  if (/fair use|non-free|unfree/i.test(license)) return { why: `licensed “${license}”, which is not free to republish` };

  const near = t.lat && t.lng && hasGps ? km(t.lat, t.lng, lat, lng) : null;
  let score = identity.strong ? 3 : 1;
  if (identity.where === 'the category it is filed under') score += 2;
  if (lane.proven) score += 2;
  if (near !== null) score += near <= 1.2 ? 4 : near <= 4 ? 3 : near <= 12 ? 1 : -2;
  const artistRaw = strip(meta.Artist?.value);
  const artist = artistRaw && !/^(unknown( ?author)?|self|n\/?a|photographer unknown)/i.test(artistRaw) ? artistRaw : undefined;
  return {
    ok: true,
    score,
    file: lane.file,
    width,
    height,
    license,
    artist,
    url: i.url,
    descriptionurl: i.descriptionurl,
    identity: identity.where,
    near,
    /* The credit says where the file was found, in the same shape the rest of the
       registry uses: an article title, or Wikimedia Commons itself. What makes the
       file this subject's picture belongs in `evidence`, where it can be read. */
    via: (lane.lane === 'lead' || lane.lane === 'article') ? (t.articleTitle ?? lane.via) : 'Wikimedia Commons',
    evidence: [
      namedBy && `named by ${identity.where}: “${namedBy.text.slice(0, 90)}”`,
      !namedBy && spread && `names it word by word across its file page: ${need.join(', ')}`,
      lane.lane === 'lead' && 'the picture this article leads with, which is its own claim about its subject',
      !namedBy && !spread && lane.lane !== 'lead' && lane.proven && t.articleTitle && (lane.lane === 'depicts'
        ? `no words of its own, but Commons tags it as depicting ${t.qidLabel ?? t.qid} (${t.qid})`
        : `no words of its own, but it sits in ${lane.via}, the category of ${t.qidLabel ?? t.qid}`),
      (lane.lane === 'category' || lane.lane === 'byname') && namedBy && `found through ${lane.via}`,
      t.qid && lane.lane === 'depicts' && namedBy && `also tagged as depicting ${t.qidLabel ?? t.qid} (${t.qid})`,
      near !== null && `photographed ${near < 1 ? `${Math.round(near * 1000)} m` : `${near.toFixed(1)} km`} from this record's own pin`,
      t.qidProof && `the item's Karachi claim: ${t.qidProof}`,
    ].filter(Boolean).join(' · '),
  };
}

const registry = { ...media };
let added = 0;
const review = [];
for (const t of targets) {
  const judged = t.lanes.map((lane) => ({ lane, v: judge(t, lane, info.get(lane.file)) }));
  const ok = judged.filter((x) => x.v.ok).sort((a, b) => b.v.score - a.v.score || b.v.width - a.v.width);
  const refused = judged.filter((x) => !x.v.ok).map((x) => ({ file: x.lane.file, via: x.lane.via, why: x.v.why }));
  review.push({
    key: t.key, name: t.name, qid: t.qid ?? null, qidVia: t.qidVia ?? null, qidOwn: !!t.qidOwn, qidNotSubject: t.qidNotSubject ?? null, inKarachi: !!t.inKarachi,
    pin: t.lat && t.lng ? [t.lat, t.lng] : null, lanes: t.lanes.map((l) => l.lane),
    candidates: t.lanes.length, accepted: ok.slice(0, 4).map((x) => ({ file: x.v.file, evidence: x.v.evidence, license: x.v.license, artist: x.v.artist ?? null, width: x.v.width, height: x.v.height, filePage: x.v.descriptionurl, score: x.v.score })),
    refused: refused.slice(0, 8),
  });
  const won = ok[0];
  if (!won) {
    console.log(`none      ${t.name}${refused.length ? ` — ${refused.slice(0, 2).map((r) => r.why).join('; ')}` : ' — no file found through the subject itself'}`);
    continue;
  }
  const v = won.v;
  const wide = thumbAt(v.url, 1280) ?? v.url;
  const bytes = await probe(wide);
  if (!bytes) {
    console.log(`none      ${t.name} — ${v.file}: the URL it returned did not load`);
    continue;
  }
  console.log(`FOUND     ${t.name}\n            ${v.via ?? 'Wikimedia Commons'} -> ${v.file}\n            ${v.license} · ${v.artist ?? 'no named author'} · ${v.width}x${v.height}\n            ${v.evidence}`);
  if (WRITE) {
    registry[t.key] = {
      key: t.key,
      subject: t.name,
      via: v.via ?? 'Wikimedia Commons',
      thumb: thumbAt(v.url, 500) ?? wide,
      wide,
      filePage: v.descriptionurl ?? `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(v.file.replace(/ /g, '_'))}`,
      artist: v.artist,
      license: v.license,
      verified: true,
      kind: 'subject',
      evidence: v.evidence,
    };
    added++;
    writeFileSync(join(ROOT, 'src/data/media.json'), `${JSON.stringify(registry, null, 2)}\n`);
  }
}

writeFileSync(REVIEW_FILE, `${JSON.stringify(review, null, 2)}\n`);
console.log(`\nchecked ${targets.length} records · ${review.reduce((n, r) => n + r.accepted.length, 0)} accepted above the line · ${allFiles.length} file pages read · registered ${WRITE ? added : 0}${WRITE ? '' : ' (dry run — nothing written)'}`);
console.log(`review written to ${REVIEW_FILE}`);
