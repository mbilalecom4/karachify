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

const jobs = [];
for (const [key, e] of Object.entries(media)) {
  for (const field of ['thumb', 'wide']) if (e[field]) jobs.push({ key, field, url: e[field] });
}

const bad = [];
let done = 0;
const POOL = 6;
async function worker() {
  while (jobs.length) {
    const j = jobs.shift();
    const r = await check(j.url);
    if (!r.ok) bad.push(`${j.key}.${j.field}  HTTP ${r.status}  ${r.bytes}b  ${j.url.slice(0, 90)}`);
    if (++done % 40 === 0) console.log(`  ${done} checked`);
  }
}
console.log(`checking ${jobs.length} media URLs from ${Object.keys(media).length} entries`);
await Promise.all(Array.from({ length: POOL }, worker));
console.log(bad.length ? `\nBROKEN (${bad.length}):\n${bad.join('\n')}` : '\nAll media URLs resolve.');
