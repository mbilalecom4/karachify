/** Checks every URL in src/data/media.json still resolves — a 404 here is a broken image on the site. */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const media = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/media.json'), 'utf8'));
const UA = 'Karachify/0.1 (city discovery demo; verifying licensed imagery)';

async function check(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
      const bytes = (await r.arrayBuffer()).byteLength;
      if (r.status === 429) { await new Promise((s) => setTimeout(s, 1800 * (i + 1))); continue; }
      return { ok: r.status === 200 && bytes > 3000, status: r.status, bytes };
    } catch (e) {
      await new Promise((s) => setTimeout(s, 1200 * (i + 1)));
      if (i === 2) return { ok: false, status: 0, bytes: 0, err: e.message };
    }
  }
  return { ok: false, status: 429, bytes: 0 };
}

// upload.wikimedia.org rate-limits this machine aggressively, so a full sweep
// always ends with a tail of 429s that prove nothing about the files. Those are
// re-checked on their own, one lane, slower:
//   node .tools/check-media-urls.mjs --only=port-grand,sandspit-beach
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) ?? '').slice(7).split(',').filter(Boolean);

const jobs = [];
for (const [key, e] of Object.entries(media)) {
  if (ONLY.length && !ONLY.includes(key)) continue;
  for (const field of ['thumb', 'wide']) if (e[field]) jobs.push({ key, field, url: e[field] });
}

const bad = [];
let done = 0;
// Six at a time got the whole batch rate-limited last run, which turns a dead-link
// check into a list of 429s that proves nothing. Two lanes with a gap between
// requests keeps the answer readable; a retry pass goes to a single slow lane.
const POOL = ONLY.length ? 1 : 2;
const GAP = ONLY.length ? 1200 : 350;
async function worker() {
  while (jobs.length) {
    const j = jobs.shift();
    const r = await check(j.url);
    if (!r.ok) bad.push(`${j.key}.${j.field}  HTTP ${r.status}  ${r.bytes}b  ${j.url.slice(0, 90)}`);
    if (++done % 40 === 0) console.log(`  ${done} checked`);
    await new Promise((s) => setTimeout(s, GAP));
  }
}
console.log(`checking ${jobs.length} media URLs from ${ONLY.length ? ONLY.length : Object.keys(media).length} entries`);
await Promise.all(Array.from({ length: POOL }, worker));
console.log(bad.length ? `\nBROKEN (${bad.length}):\n${bad.join('\n')}` : '\nAll media URLs resolve.');
