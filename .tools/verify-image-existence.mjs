//   node .tools/verify-image-existence.mjs
//
// Prove a registry file exists without hammering upload.wikimedia.org: the
// MediaWiki API answers on a different host and returns the canonical thumb
// URL for any width, so a 429 from the CDN stops being an unknown.
import { readFileSync } from 'node:fs';
const media = JSON.parse(readFileSync('src/data/media.json', 'utf8'));
const titleOf = (u) => { const m = /\/File:([^/]+)$/.exec(decodeURIComponent(u || '')); return m ? m[1] : null; };
const pxOf = (u) => { const m = /\/(\d+)px-/.exec(u || ''); return m ? +m[1] : null; };
const api = async (body) => (await fetch('https://en.wikipedia.org/w/api.php', {
  method: 'POST', body, headers: { 'User-Agent': 'Karachify-research/1.0 (contact: site owner)', 'Content-Type': 'application/x-www-form-urlencoded' },
})).json();

const want = [];
for (const [key, e] of Object.entries(media)) {
  for (const field of ['thumb', 'wide']) {
    const t = titleOf(e.filePage); const px = pxOf(e[field]);
    if (t && px) want.push({ key, field, t, px });
  }
}
const byTitle = new Map();
for (const w of want) { if (!byTitle.has(w.t)) byTitle.set(w.t, []); byTitle.get(w.t).push(w); }
const titles = [...byTitle.keys()];
const ok = new Map();
for (let i = 0; i < titles.length; i += 20) {
  const body = new URLSearchParams({ action: 'query', titles: titles.slice(i, i + 20).map((t) => 'File:' + t).join('|'), prop: 'imageinfo', iiprop: 'url|size', iiurlwidth: '1280', redirects: '1', format: 'json' });
  const j = await api(body);
  for (const p of Object.values(j?.query?.pages ?? {})) {
    const ii = p.imageinfo?.[0];
    if (ii) ok.set(p.title.replace(/^File:/, '').replace(/_/g, ' ').toLowerCase(), ii);
  }
  await new Promise((s) => setTimeout(s, 400));
}
let missing = 0, unproxyable = 0;
for (const w of want) {
  const ii = ok.get(w.t.replace(/_/g, ' ').toLowerCase());
  if (!ii) { console.log(`NO SUCH FILE  ${w.key}.${w.field}  ${w.t}`); missing++; continue; }
  if (w.px > ii.width) { console.log(`WIDER THAN SOURCE  ${w.key}.${w.field}  asks ${w.px}px, file is ${ii.width}px  ${w.t}`); unproxyable++; }
}
console.log(`\n${titles.length} distinct Commons files · ${want.length} registry URLs · ${missing} missing · ${unproxyable} asking more pixels than the file has`);
