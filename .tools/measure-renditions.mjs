#!/usr/bin/env node
// Measures, for every photograph the registry uses, which renditions the image
// host really serves — and writes that into src/data/media.json.
//
// A card 290 px wide should not download a 500 px file, and a hero painted at
// 1900 px should not be stretched out of a 1280 px file. Both are decided by
// two facts the site did not hold: how wide the original is, and which
// renditions the host agrees to make.
//
// Nothing is guessed. Two sources of truth are asked and they have to agree:
//
//   1. MediaWiki's own API, per allowed width, for the rendition path it uses
//      and the file's intrinsic size. (It answers on thumb.wikimedia.org while
//      the registry stores upload.wikimedia.org — the same path on a different
//      host — so the two are compared by path, not by whole URL.)
//   2. A live request for each exact URL this site would put in a srcset. The
//      API will hand out a thumbnail URL at a width the host then refuses — two
//      stored `wide` values here answer 400 for exactly that reason — so the
//      host's own answer is what decides, and a width that does not answer is
//      dropped rather than recorded.
//
// The width list is what this host answers at all: every other size returns 400
// with "Use thumbnail sizes listed on https://w.wiki/GHai". A width at or above
// the original's own is not recorded — the host hands back the full file wearing
// a thumbnail URL, which is more bytes than that frame can ever show.
//
//   node .tools/measure-renditions.mjs                     dry run, prints what would change
//   node .tools/measure-renditions.mjs --write             merge into src/data/media.json
//   node .tools/measure-renditions.mjs --limit=60 --write  one chunk of the live pass;
//          repeats until every URL is answered, then writes. Exit 3 is "run it again",
//          exit 2 is "this machine could not complete the request", exit 1 is a real problem.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const WRITE = process.argv.includes('--write');
const LIMIT = Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? 0) || 0;
const UA = 'Karachify/0.1 (city directory maintainer; sourcing licensed imagery)';
const ROOT = path.resolve(import.meta.dirname, '..');
const API = 'https://en.wikipedia.org/w/api.php';
const FILE = path.join(ROOT, 'src/data/media.json');

/* Several hundred requests is longer than one shell command should be made to
   last, and a pass killed or throttled half-way back would otherwise throw away
   everything the image host had already answered. Cleared by hand when the
   allow-list changes. */
const CACHE_FILE = path.join(tmpdir(), 'karachify-renditions.json');
const cache = { api: {}, live: {}, ...(existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : {}) };
let cacheDirty = false;
const saveCache = () => {
  if (!cacheDirty) return;
  writeFileSync(CACHE_FILE, JSON.stringify(cache));
  cacheDirty = false;
};

/** The thumbnail widths this host is known to answer with 200. */
const ALLOWED = [120, 250, 330, 500, 960, 1280, 1920];

const base = (url) => String(url ?? '').split('?')[0];
const pxW = (url) => Number((String(url ?? '').match(/\/(\d+)px-[^/]*$/)?.[1] ?? 0)) || 0;
/** host apart, so an API answer and a stored URL can be compared for real */
const pathOf = (url) => base(url).replace(/^https?:\/\/[^/]+/, '');
/* Which file a URL points at. Wikimedia keeps a file at /x/xx/Name and renders
   it at /thumb/x/xx/Name/Npx-Name, so the name and its hash directory are the
   identity; where the name repeats as a directory, it is not part of it. */
const fileOf = (url) => {
  const p = pathOf(url);
  const name = String(p.split('/').pop() ?? '').replace(/^\d+px-/, '');
  const hash = p.match(/\/([0-9a-f])\/([0-9a-f]{2})\//);
  return `${hash ? `${hash[1]}/${hash[2]}/` : ''}${name}`;
};
/* The API writes `%2C` where this registry stores a literal comma, and neither
   spelling is a different file — comparing raw paths called every one of them
   a mismatch until the live answers said otherwise. */
const sameFile = (a, b) => {
  const d = (s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  };
  return d(fileOf(a)) === d(fileOf(b));
};

function fileTitle(url) {
  const tail = base(url).split('/').pop() ?? '';
  if (!tail) return null;
  try {
    return `File:${decodeURIComponent(tail.replace(/^\d+px-/, ''))}`;
  } catch {
    return null;
  }
}

/* "File:Agha Khan Hospital.jpg" is the title for a URL spelling it with
   underscores; fold both spellings before anything is looked up. */
const titleKey = (t) =>
  String(t ?? '')
    .replace(/^File:/i, '')
    .replace(/_/g, ' ')
    .trim()
    .toLowerCase();

/** The same file on this site's own host, thumbnailed at another width. */
const rewidth = (thumbUrl, width) => base(thumbUrl).replace(/\/(\d+)px-([^/]*)$/, `/${width}px-$2`);

let lastApi = 0;
const API_PACE_MS = 1400;
const DEADLINE_MS = 12000;
async function api(params, attempt = 0) {
  const url = `${API}?${new URLSearchParams(params)}&format=json`;
  if (cache.api[url]) return cache.api[url];
  const wait = API_PACE_MS - (Date.now() - lastApi);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastApi = Date.now();
  /* A request with no deadline can simply never answer — one did while an
     earlier live pass was running — and a script that hangs silently is worse
     than one that fails. */
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(DEADLINE_MS),
  }).catch(async (e) => {
    if (attempt < 3) return api(params, attempt + 1);
    throw new Error(`API call failed after ${attempt + 1} tries: ${e.name} ${e.message}`);
  });
  if (res.status === 429) {
    const raw = Number(res.headers.get('retry-after'));
    const secs = Number.isFinite(raw) && raw > 0 ? raw : 20 * (attempt + 1);
    if (attempt < 6) {
      await new Promise((r) => setTimeout(r, Math.min(120, Math.max(5, secs)) * 1000));
      return api(params, attempt + 1);
    }
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  cache.api[url] = body;
  cacheDirty = true;
  return body;
}

async function imageinfo(titles, width) {
  const out = new Map();
  for (let i = 0; i < titles.length; i += 20) {
    const chunk = titles.slice(i, i + 20);
    const params = { action: 'query', titles: chunk.join('|'), prop: 'imageinfo', iiprop: 'url|size', redirects: 1 };
    if (width) params.iiurlwidth = width;
    const body = await api(params);
    for (const p of Object.values(body?.query?.pages ?? {})) {
      const ii = p.imageinfo?.[0];
      if (ii) out.set(titleKey(p.title), ii);
    }
    process.stdout.write(`\r  imageinfo${width ? ` @${width}px` : ' (originals)'} ${Math.min(i + 20, titles.length)}/${titles.length}   `);
  }
  return out;
}

let lastLive = 0;
/* Sequential with a pause: six at a time and the host answers 429 for most of
   them, which proves nothing about the files and wastes the pass. */
const LIVE_PACE_MS = 300;
const LIVE_TRIES = 4;
/* A width the host has not rendered before is rendered on the first ask, which
   takes longer than the request that follows it. */
const LIVE_DEADLINE_MS = 30000;
/** Stalls and throttles say nothing about a file, so they are never cached. */
const isPending = (v) => v.startsWith('stalled') || v === 'throttled';
/** Ask the image host for the exact URL a browser would be given. */
async function live(url, attempt = 0) {
  if (cache.live[url]) return cache.live[url];
  const wait = LIVE_PACE_MS - (Date.now() - lastLive);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastLive = Date.now();
  let res;
  try {
    const signal = AbortSignal.timeout(LIVE_DEADLINE_MS);
    res = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': UA }, signal });
    if (res.status === 400 || res.status === 405)
      res = await fetch(url, { method: 'GET', headers: { 'User-Agent': UA, Range: 'bytes=0-0' }, signal });
  } catch (e) {
    /* `TypeError: fetch failed` — a dropped connection — is as much this
       machine's bad minute as a timeout is, and an earlier pass wrote 125 of
       them off as verdicts because only timeouts were retried. */
    if (attempt < LIVE_TRIES) {
      await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
      return live(url, attempt + 1);
    }
    return `stalled (${e?.name ?? 'error'})`;
  }
  if (res.status === 429) {
    if (attempt < LIVE_TRIES) {
      await new Promise((r) => setTimeout(r, 15000 * (attempt + 1)));
      return live(url, attempt + 1);
    }
    return 'throttled';
  }
  const verdict = res.ok || res.status === 206 ? 'ok' : res.status === 404 ? 'missing' : `http ${res.status}`;
  cache.live[url] = verdict;
  cacheDirty = true;
  return verdict;
}

async function liveAll(urls) {
  const queue = [...urls];
  const total = queue.length;
  const verdicts = new Map();
  let done = 0;
  const stamp = () => {
    const pending = [...verdicts.values()].filter(isPending).length;
    const refused = [...verdicts.values()].filter((v) => v !== 'ok' && !isPending(v)).length;
    process.stdout.write(`\r  live ${done}/${total}: ${refused} refused, ${pending} unanswered by us   `);
    saveCache();
  };
  for (const url of queue) {
    verdicts.set(url, await live(url));
    done++;
    /* Written down after every answer, not every twenty-fifth: a pass taken down
       half-way here otherwise throws away the rendering time the slowest of
       these requests just paid for. */
    if (done % 10 === 0 || done === total) stamp();
    else saveCache();
  }
  return verdicts;
}

const media = JSON.parse(readFileSync(FILE, 'utf8'));
const entries = Object.entries(media);
const titles = [...new Set(entries.map(([, e]) => fileTitle(e.thumb)).filter(Boolean))];
console.log(`${entries.length} entries across ${titles.length} distinct Commons files`);

const originals = await imageinfo(titles, 0);
const renditions = new Map();
for (const width of ALLOWED) {
  const answer = await imageinfo(titles, width);
  for (const [key, ii] of answer) {
    if (!renditions.has(key)) renditions.set(key, new Map());
    renditions.get(key).set(ii.thumburl ? pxW(ii.thumburl) || width : width, ii);
  }
}
console.log('');

const problems = [];
const measured = new Map(); // entry key -> {w,h,px}

for (const [key, e] of entries) {
  const title = fileTitle(e.thumb);
  const tk = title ? titleKey(title) : '';
  const info = tk ? originals.get(tk) : null;
  if (!info) {
    problems.push(`${key}: the API has no imageinfo for "${title}"`);
    continue;
  }
  const w = Number(info.width);
  const h = Number(info.height);
  if (!(Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0)) {
    problems.push(`${key}: intrinsic size ${w}x${h} is not a pair of numbers`);
    continue;
  }
  const px = [];
  for (const width of ALLOWED) {
    /* A rendition at or above the original's own width is the full file wearing a
       thumbnail URL — asking for it downloads more than it can ever show. */
    if (width >= w) continue;
    const ii = renditions.get(tk)?.get(width);
    if (!ii?.thumburl) {
      problems.push(`${key}: the API gave no answer at ${width}px`);
      continue;
    }
    const constructed = rewidth(e.thumb, width);
    if (!sameFile(constructed, ii.thumburl)) {
      problems.push(`${key}: ${width}px — API path ${pathOf(ii.thumburl)} is not what the stored thumb rewrites to (${pathOf(constructed)})`);
      continue;
    }
    px.push(width);
  }
  /* A file narrower than some of the listed widths simply has fewer candidates.
     Only a file with nothing left is a problem worth stopping the write for. */
  if (!px.length) problems.push(`${key}: a ${w}px original leaves no usable rendition`);
  measured.set(key, { w, h, px });
}

/* Live pass. What a browser can be handed is three things: the entry's stored
   thumb, its `wide`, and the srcset built by re-cutting the thumb path at the
   widths in `px`. So the thumb and the widest rendition of every entry are
   asked, and each distinct file is asked at one further width that is neither —
   a real srcset URL for that file. The remaining widths of that file are not
   each asked: every one is the API's own answer for the same path at the same
   size, the file has been proved to render here at two other sizes, and 83
   files × 7 sizes is 450 more requests than this connection makes in an hour.
   What the pass did find argues for that: the only refusals in the registry
   were two `wide` values at sizes not on the host's list. */
let rot = 0;
const sampled = new Map(); // title key -> a srcset URL the registry does not already store
for (const [key, e] of entries) {
  const tk = titleKey(fileTitle(e.thumb) ?? '');
  const m = measured.get(key);
  if (!m?.px.length || sampled.has(tk)) continue;
  const others = m.px.filter((width) => width !== pxW(e.thumb) && width !== m.px[m.px.length - 1]);
  if (!others.length) continue;
  sampled.set(tk, rewidth(e.thumb, others[rot++ % others.length]));
}
const candidates = new Set();
for (const [key, e] of entries) {
  candidates.add(base(e.thumb));
  const m = measured.get(key);
  if (m?.px.length) candidates.add(rewidth(e.thumb, m.px[m.px.length - 1]));
  const tk = titleKey(fileTitle(e.thumb) ?? '');
  if (sampled.has(tk)) candidates.add(sampled.get(tk));
}

console.log(`checking ${candidates.size} URLs against the image host`);
/* Every uncached URL would be one command of forty minutes, and a command that
   long gets taken down half-way here — the last pass lost four minutes of
   answers that way. `--limit` makes the pass a chunk of a few minutes that
   leaves its verdicts in the cache, so the next chunk starts where this one
   stopped. Exit 3 means "same command again", not "something is wrong". */
const todo = [...candidates].filter((u) => !cache.live[u]);
const chunk = LIMIT ? todo.slice(0, LIMIT) : todo;
const verdicts = new Map();
if (chunk.length) {
  for (const [url, v] of Object.entries(cache.live)) if (candidates.has(url)) verdicts.set(url, v);
  for (const [url, v] of await liveAll(chunk)) verdicts.set(url, v);
} else {
  for (const url of candidates) verdicts.set(url, cache.live[url]);
}
if (todo.length > chunk.length) {
  console.log(`\n  ${chunk.length} asked this pass, ${todo.length - chunk.length} still uncached — run the same command again`);
  saveCache();
  process.exit(3);
}
const refused = [...verdicts].filter(([, v]) => v !== 'ok' && !isPending(v));
const unanswered = [...verdicts].filter(([, v]) => isPending(v));
process.stdout.write(`\n  live ${verdicts.size}/${candidates.size}: ${refused.length} refused, ${unanswered.length} we could not ask\n`);

/* What the registry would look like after the write. Most of the widths in `px`
   are not asked directly — see the live pass above — so a width is only dropped
   when the host actually refused the URL for it. An answer of nothing because
   this machine could not ask is not a refusal, and stops the write instead. */
const planned = new Map();
let rehosted = 0;
let dropped = 0;
for (const [key, m] of measured) {
  const e = media[key];
  const answer = (url) => verdicts.get(url);
  const refusedWidth = (width) => {
    const v = answer(rewidth(e.thumb, width));
    return v !== undefined && v !== 'ok' && !isPending(v);
  };
  const live_px = m.px.filter((width) => !refusedWidth(width));
  dropped += m.px.length - live_px.length;
  if (live_px.length !== m.px.length) console.log(`  · ${key}: host refused ${m.px.filter((x) => !live_px.includes(x)).join(', ')}px`);
  const thumbWidth = pxW(e.thumb);
  /* A thumb narrower than the original must be on the list the API confirmed;
     one at or above it is the file itself, which the host is asked to confirm. */
  if (!live_px.includes(thumbWidth) && thumbWidth < m.w) {
    problems.push(`${key}: the stored ${thumbWidth}px thumb is not among the renditions that answer (${live_px.join(', ') || 'none'})`);
    continue;
  }
  if (answer(base(e.thumb)) !== 'ok') {
    problems.push(`${key}: the stored thumb answers ${answer(base(e.thumb)) ?? 'nothing'}`);
    continue;
  }
  if (e.wide && !sameFile(e.wide, e.thumb)) {
    problems.push(`${key}: its wide is a different file (${pathOf(e.wide)}) from its thumb (${pathOf(e.thumb)})`);
    continue;
  }
  /* `wide` was written by an earlier pass that took the API's own URL, and that
     pass asked for widths this host does not serve — two of them answer 400
     today, and nineteen more handed the browser the full-size original. One
     host per entry and the widest rendition the file really has, proved by this
     pass because it is always one of the URLs asked. */
  const wide = live_px.length ? rewidth(e.thumb, live_px[live_px.length - 1]) : e.wide;
  if (live_px.length && answer(wide) !== 'ok') {
    problems.push(`${key}: the widest rendition this pass would ship answers ${answer(wide) ?? 'nothing'} at ${wide}`);
    continue;
  }
  if (wide !== e.wide) rehosted++;
  planned.set(key, { w: m.w, h: m.h, px: live_px, wide });
}

console.log(`\n${measured.size} entries measured, ${problems.length} problem(s), ${dropped} refused width(s) dropped`);
for (const p of problems.slice(0, 30)) console.log(`  · ${p}`);
if (problems.length > 30) console.log(`  … and ${problems.length - 30} more`);

const hist = {};
const widths = {};
for (const p of planned.values()) {
  hist[p.px.length] = (hist[p.px.length] ?? 0) + 1;
  for (const q of p.px) widths[q] = (widths[q] ?? 0) + 1;
}
console.log('candidates per entry:', hist);
console.log('entries serving each width:', widths);
console.log(`${rehosted} entries whose wide URL moves host or size`);
saveCache();

if (unanswered.length) {
  /* Not a verdict about those files — this machine could not complete the
     request. The cache keeps everything already answered, so a re-run asks only
     these. */
  console.error(`\n✗ ${unanswered.length} URL(s) unanswered by us — nothing written, run again`);
  process.exit(2);
}

if (WRITE) {
  if (problems.length) {
    console.error(`\n✗ refusing to write: ${problems.length} check(s) failed`);
    process.exit(1);
  }
  for (const [key, p] of planned) {
    media[key].w = p.w;
    media[key].h = p.h;
    media[key].px = p.px;
    media[key].wide = p.wide;
  }
  writeFileSync(FILE, JSON.stringify(media, null, 2) + '\n');
  console.log(`\nwrote ${path.relative(ROOT, FILE)}`);
} else {
  console.log('\ndry run — nothing written');
}
