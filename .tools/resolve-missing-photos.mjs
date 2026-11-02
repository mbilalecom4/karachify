#!/usr/bin/env node
// Sources photographs for records that currently render the designed placeholder.
//
// commons.wikimedia.org is not reachable from this machine, so all lookups run
// through the English Wikipedia API (which still returns imageinfo for
// Commons-hosted files) and the files themselves come from upload.wikimedia.org.
//
// Honesty gate: a file is registered only when the file's own name contains
// every distinctive word of the record's name — including "Karachi" when the
// record uses it. That is what rejects the Mövenpick brand article, whose lead
// photo is a hotel in Jordan. Artist, licence and URLs are read from the API.
//
// Anonymous calls to this API are rate-limited hard, so the work is done in
// three batched passes instead of six calls per record: one search per record,
// then one images-list for every article found, then one imageinfo for every
// file that survived the gate. A single lane, paced, never parallel.
//
//   node .tools/resolve-missing-photos.mjs            dry run (prints what it found)
//   node .tools/resolve-missing-photos.mjs --write    merge into src/data/media.json
//   node .tools/resolve-missing-photos.mjs --only=a,b re-run a shortlist
import { build } from 'esbuild';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const WRITE = process.argv.includes('--write');
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) ?? '').slice(7).split(',').filter(Boolean);
const MANUAL = process.argv.find((a) => a.startsWith('--manual='))?.slice(9) ?? null;
const UA = 'Karachify/0.1 (city directory maintainer; sourcing licensed imagery)';
const ROOT = resolve('.');
const API = 'https://en.wikipedia.org/w/api.php';
const PACE_MS = 1400;

const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'de', 'al', 'en', 'i']);
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = (s) => norm(s).split(' ').filter((t) => t.length > 2 && !STOP.has(t));
const IGNORED_FILE = /(\.svg|\.pdf|\.ogg|\.webm|\.gif|logo|icon|symbol|flag|coat|seal|crest|locator map|disambig|commons)/i;

let lastCall = 0;
async function api(params, attempt = 0) {
  const wait = PACE_MS - (Date.now() - lastCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  const url = `${API}?${new URLSearchParams(params)}&format=json`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (res.status === 429) {
      // Retry-After is a number of SECONDS here, and often fractional — reading
      // it as milliseconds turned every limit into a spin loop that made it worse.
      const raw = Number(res.headers.get('retry-after'));
      const secs = Number.isFinite(raw) && raw > 0 ? raw : 20 * (attempt + 1);
      if (attempt < 6) {
        const backoff = Math.min(120, Math.max(5, secs)) * 1000;
        process.stderr.write(`  rate limited, backing off ${Math.round(backoff / 1000)}s\n`);
        await new Promise((r) => setTimeout(r, backoff));
        return api(params, attempt + 1);
      }
      return {};
    }
    const text = await res.text();
    if (!text.startsWith('{')) {
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 2500 * (attempt + 1)));
        return api(params, attempt + 1);
      }
      return {};
    }
    return JSON.parse(text);
  } catch {
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 2000));
      return api(params, attempt + 1);
    }
    return {};
  }
}

/**
 * Every distinctive word of the record name must be evidenced, and the photo
 * itself must carry most of that evidence:
 *   · all of the words appear across the file name plus the article it was
 *     found in, and
 *   · at least half of them appear in the file name alone.
 * The second condition is what keeps a portrait of a founder out of a record
 * about the institution: being embedded in the right article is not enough,
 * the file has to be named for the thing too.
 */
function fileNamesRecord(name, fileTitle, articleTitle = '') {
  const f = norm(fileTitle.replace(/\.(jpe?g|png|webp|tiff)$/i, ''));
  const a = norm(articleTitle);
  const need = tokens(name);
  if (need.length < 2) return false;
  const inFile = need.filter((w) => f.includes(w));
  return inFile.length >= Math.ceil(need.length / 2) && need.every((w) => f.includes(w) || a.includes(w));
}

function thumbAt(url, width) {
  const u = (url ?? '').split('?')[0];
  const m = u.match(/^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons)\/([a-z0-9])\/([a-z0-9]{2})\/([^/]+)$/);
  if (!m) return null;
  return `${m[1]}/thumb/${m[2]}/${m[3]}/${m[4]}/${width}px-${m[4]}`;
}

async function probe(url) {
  if (!url) return 0;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    const bytes = r.ok ? (await r.arrayBuffer()).byteLength : 0;
    await r.body?.cancel().catch(() => {});
    return r.status === 200 && bytes > 6000 ? bytes : 0;
  } catch {
    return 0;
  }
}

const chunk = (xs, n) => xs.reduce((acc, x) => {
  if (!acc.length || acc[acc.length - 1].length >= n) acc.push([]);
  acc[acc.length - 1].push(x);
  return acc;
}, []);

const strip = (v) => (v ? String(v).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : undefined);

const bundle = await build({
  stdin: {
    contents: `
      export { listings } from './listings';
      export { categories } from './taxonomy';
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
const { listings, categories, media } = await import(pathToFileURL(dataFile).href);

const targets = [];
for (const l of listings) if (!media[l.slug]) targets.push({ key: l.slug, name: l.name, kind: 'listing' });
for (const c of categories) {
  const key = `banner-${c.id}`;
  if (!media[key]) targets.push({ key, name: c.name, kind: 'category' });
}
if (ONLY.length) targets.splice(0, targets.length, ...targets.filter((t) => ONLY.includes(t.key)));
if (MANUAL) {
  const picks = JSON.parse(readFileSync(join(ROOT, MANUAL), 'utf8'));
  for (const p of picks) {
    const t = targets.find((x) => x.key === p.key);
    if (t) t.picked = [{ article: p.article, file: p.file }];
  }
}

/* ── pass 1: which article most likely holds the photo ───────────────────── */
for (const target of targets) {
  if (target.picked) continue;
  const clean = target.name.replace(/\(.*?\)/g, ' ').replace(/&.*$/, ' ').replace(/,.*/, ' ').trim();
  const search = await api({ action: 'query', list: 'search', srsearch: `"${target.name}" Karachi`, srlimit: 4 });
  let hits = (search?.query?.search ?? []).map((s) => s.title);
  if (!hits.length) {
    const loose = await api({ action: 'query', list: 'search', srsearch: `${clean} Karachi`, srlimit: 4 });
    hits = (loose?.query?.search ?? []).map((s) => s.title);
  }
  target.articles = hits.slice(0, 3);
}

/* ── pass 2: every image embedded in those articles, in batched calls ────── */
const allArticles = [...new Set(targets.flatMap((t) => t.picked?.map((p) => p.article) ?? t.articles ?? []))];
const imagesByArticle = new Map();
for (const group of chunk(allArticles, 20)) {
  const data = await api({ action: 'query', titles: group.join('|'), prop: 'images', imlimit: 80 });
  for (const page of Object.values(data?.query?.pages ?? {})) {
    imagesByArticle.set(page.title, (page.images ?? []).map((i) => i.title.replace(/^File:/, '')).filter((f) => !IGNORED_FILE.test(f)));
  }
}
for (const target of targets) {
  const candidates = target.picked ?? (target.articles ?? []).flatMap((a) => (imagesByArticle.get(a) ?? []).map((file) => ({ article: a, file })));
  target.candidates = candidates.filter((c) => fileNamesRecord(target.name, c.file, c.article));
}

/* ── pass 3: licence + size + URLs for the survivors only ────────────────── */
const allFiles = [...new Set(targets.flatMap((t) => t.candidates.map((c) => c.file)))];
const infoByFile = new Map();
for (const group of chunk(allFiles, 25)) {
  const data = await api({
    action: 'query', titles: group.map((f) => `File:${f}`).join('|'), prop: 'imageinfo',
    iiprop: 'url|size|extmetadata', iiextmetadatafilter: 'LicenseShortName|Artist|UsageTerms',
  });
  for (const page of Object.values(data?.query?.pages ?? {})) {
    const name = (page.title ?? '').replace(/^File:/, '');
    if (page.imageinfo?.[0]) infoByFile.set(name, page.imageinfo[0]);
  }
}

const registry = { ...media };
let added = 0;
for (const target of targets) {
  let won = null;
  for (const { article, file } of target.candidates) {
    const info = infoByFile.get(file);
    if (!info || info.width < 800) continue;
    const wide = thumbAt(info.url, 1280);
    const card = thumbAt(info.url, 500) ?? wide;
    const cardBytes = await probe(card);
    const wideBytes = await probe(wide);
    if (!cardBytes && !wideBytes) continue;
    won = { article, file, info, wide, card, cardBytes, wideBytes };
    break;
  }
  if (!won) {
    console.log(`none      ${target.kind.padEnd(8)} ${target.name}`);
    continue;
  }
  const license = strip(won.info.extmetadata?.LicenseShortName?.value) ?? 'licence not stated';
  const artist = strip(won.info.extmetadata?.Artist?.value) ?? 'artist not stated';
  console.log(`FOUND     ${target.kind.padEnd(8)} ${target.name}\n            ${won.article} -> ${won.file}\n            ${license} · ${artist} · card ${won.cardBytes}B wide ${won.wideBytes}B`);
  if (WRITE) {
    registry[target.key] = {
      key: target.key,
      subject: target.name,
      via: won.article,
      thumb: won.cardBytes ? won.card : won.wide,
      wide: won.wideBytes ? won.wide : won.card,
      filePage: won.info.descriptionurl ?? `https://en.wikipedia.org/wiki/${won.article.replace(/ /g, '_')}`,
      artist,
      license,
      verified: true,
      kind: 'subject',
    };
    added++;
  }
}

if (WRITE && added) writeFileSync(join(ROOT, 'src/data/media.json'), `${JSON.stringify(registry, null, 2)}\n`);
console.log(`\nchecked ${targets.length} records · ${allFiles.length} files passed the name gate · registered ${WRITE ? added : 0}${WRITE ? '' : ' (dry run — nothing written)'}`);
