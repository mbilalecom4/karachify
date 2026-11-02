#!/usr/bin/env node
// Gives every registry entry a `wide` that is actually wide.
//
// The first pass of media sourcing took whatever thumbnail the article API
// happened to return, so 61 of the 134 entries carry a `wide` that is the same
// 500 px file as their `thumb`. Those images are painted into full-width banners
// and hero panels, so a 500 px file is stretched to 1280 and reads as blur —
// which is what "the images look bad" turns out to have been.
//
// Nothing here guesses at a URL. The same English Wikipedia API that sourced the
// files is asked for `iiurlwidth=1280`, and it answers with the real thumbnail
// URL plus the original's pixel size. The entry is only rewritten when the API
// returns a strictly larger image than the one already stored.
//
//   node .tools/widen-images.mjs            dry run
//   node .tools/widen-images.mjs --write    merge into src/data/media.json
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const WRITE = process.argv.includes('--write');
const WANT_W = 1280;
const UA = 'Karachify/0.1 (city directory maintainer; sourcing licensed imagery)';
const ROOT = path.resolve(import.meta.dirname, '..');
const API = 'https://en.wikipedia.org/w/api.php';
const FILE = path.join(ROOT, 'src/data/media.json');

const pxW = (url) => Number((String(url ?? '').match(/\/(\d+)px-[^/]*$/)?.[1] ?? 0)) || 0;
const base = (url) => String(url).split('?')[0];
/** "https://…/commons/thumb/a/ab/File.jpg/500px-File.jpg" -> "File:File.jpg" */
function fileTitle(url) {
  const tail = base(url).split('/').pop() ?? '';
  if (!tail) return null;
  try {
    return `File:${decodeURIComponent(tail.replace(/^\d+px-/, ''))}`;
  } catch {
    return null;
  }
}

/**
 * MediaWiki hands back "File:Agha Khan Hospital.jpg" for a file whose URL says
 * "Agha_Khan_Hospital.jpg" — underscores are title-space separators — so both
 * spellings have to be folded before anything can be looked up.
 */
const titleKey = (t) =>
  String(t ?? '')
    .replace(/^File:/i, '')
    .replace(/_/g, ' ')
    .trim()
    .toLowerCase();

let lastCall = 0;
const PACE_MS = 1400;
async function api(params, attempt = 0) {
  const wait = PACE_MS - (Date.now() - lastCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  const url = `${API}?${new URLSearchParams(params)}&format=json`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (res.status === 429) {
    // Retry-After is a count of SECONDS, often fractional.
    const raw = Number(res.headers.get('retry-after'));
    const secs = Number.isFinite(raw) && raw > 0 ? raw : 20 * (attempt + 1);
    if (attempt < 6) {
      await new Promise((r) => setTimeout(r, Math.min(120, Math.max(5, secs)) * 1000));
      return api(params, attempt + 1);
    }
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const media = JSON.parse(readFileSync(FILE, 'utf8'));

// One entry can borrow another's file; group by title so each is asked once.
const targets = Object.entries(media).filter(([, e]) => pxW(e.wide) < WANT_W && e.thumb);
const byTitle = new Map();
for (const [key, e] of targets) {
  const t = fileTitle(e.thumb);
  if (!t) continue;
  if (!byTitle.has(t)) byTitle.set(t, []);
  byTitle.get(t).push(key);
}
console.log(`${targets.length} entries below ${WANT_W}px, across ${byTitle.size} distinct Commons files`);

const titles = [...byTitle.keys()];
const info = new Map();
for (let i = 0; i < titles.length; i += 20) {
  const chunk = titles.slice(i, i + 20);
  const body = await api({
    action: 'query', titles: chunk.join('|'), prop: 'imageinfo',
    iiprop: 'url|size', iiurlwidth: WANT_W, redirects: 1,
  });
  for (const p of Object.values(body?.query?.pages ?? {})) {
    const ii = p.imageinfo?.[0];
    if (ii) info.set(titleKey(p.title), { thumburl: ii.thumburl, width: ii.width, title: p.title });
  }
  console.log(`  imageinfo ${Math.min(i + 20, titles.length)}/${titles.length}`);
}

const changes = [];
for (const [key, e] of Object.entries(media)) {
  if (pxW(e.wide) >= WANT_W) continue;
  const t = fileTitle(e.thumb);
  const hit = t && info.get(titleKey(t));
  if (!hit?.thumburl) continue;
  const url = base(hit.thumburl);
  // pxW === 0 means the API handed back the original file because nothing is
  // gained by thumbing it — that is still an upgrade on a 500 px thumb.
  const upgraded = pxW(url) === 0 ? !url.endsWith(base(e.wide)) : pxW(url) > pxW(e.wide);
  if (!upgraded || base(url) === base(e.wide)) continue;
  changes.push({ key, from: pxW(e.wide), to: pxW(url) || 'full file', sourceWidth: hit.width });
  if (WRITE) e.wide = url;
}

console.log(`\n${changes.length} entries would get a wider file`);
for (const c of changes) console.log(`  ${c.key}: ${c.from}px -> ${c.to}px (original ${c.sourceWidth}px)`);

if (WRITE) {
  writeFileSync(FILE, JSON.stringify(media, null, 2) + '\n');
  console.log(`\nwrote ${path.relative(ROOT, FILE)}`);
} else {
  console.log('\ndry run — nothing written');
}
