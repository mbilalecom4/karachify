// Download freely licensed images for Karachi landmarks via the English Wikipedia API
// (which resolves Commons files). Only CC0 / public domain / CC BY / CC BY-SA are accepted.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve('data/images');
const API = 'https://en.wikipedia.org/w/api.php';
const UA = { 'User-Agent': 'KarachifyResearch/1.0 (Karachi listings image research)' };

const TARGETS = [
  ['mazar-e-quaid', 'Mazar-e-Quaid'],
  ['frere-hall', 'Frere Hall'],
  ['mohatta-palace', 'Mohatta Palace'],
  ['empress-market', 'Empress Market'],
  ['clifton-beach', 'Clifton Beach, Karachi'],
  ['hawkes-bay', 'Hawke\'s Bay, Karachi'],
  ['manora', 'Manora, Karachi'],
  ['port-grand', 'Port Grand'],
  ['paf-museum', 'Pakistan Air Force Museum'],
  ['national-museum', 'National Museum of Pakistan'],
  ['masjid-e-tooba', 'Masjid-e-Tooba'],
  ['st-patricks-cathedral', 'St Patrick\'s Cathedral, Karachi'],
  ['teen-talwar', 'Teen Talwar'],
  ['chinna-creek', 'Chinna Creek'],
  ['habib-bank-plaza', 'Habib Bank Plaza'],
  ['karachi-port', 'Karachi Port'],
];

const OK = /^(cc0|public domain|pd|cc[- ]by([- ]sa)?[- ]?\d?(\.\d)?|cc[- ]by([- ]sa)?)$/i;

function strip(html = '') {
  return String(html).replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', ...params })}`;
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`wikipedia ${res.status}`);
  return res.json();
}

await mkdir(OUT, { recursive: true });
const manifest = [];
const skipped = [];

for (const [slug, title] of TARGETS) {
  try {
    const page = await api({ action: 'query', titles: title, prop: 'images', imlimit: '30' });
    const images = Object.values(page.query?.pages ?? {})[0]?.images ?? [];
    const files = images.filter((i) => /\.(jpe?g|png)$/i.test(i.title)).slice(0, 12);

    let chosen = null;
    for (const f of files) {
      const infoRes = await api({
        action: 'query',
        titles: f.title,
        prop: 'imageinfo',
        iiprop: 'url|extmetadata',
        iiurlwidth: '1280',
      });
      const info = Object.values(infoRes.query?.pages ?? {})[0]?.imageinfo?.[0];
      if (!info) continue;
      const licence = strip(info.extmetadata?.LicenseShortName?.value);
      if (OK.test(licence)) { chosen = { f, info, licence }; break; }
    }
    if (!chosen) {
      skipped.push({ slug, title, reason: 'no freely licensed image found' });
      console.log(`${slug}: skipped`);
      continue;
    }
    const { f, info, licence } = chosen;
    const file = `${slug}.jpg`;
    const res = await fetch(info.thumburl ?? info.url, { headers: UA });
    if (!res.ok) throw new Error(`download ${res.status}`);
    await writeFile(path.join(OUT, file), Buffer.from(await res.arrayBuffer()));
    manifest.push({
      slug,
      wikiTitle: title,
      file,
      commonsTitle: f.title,
      filePage: `https://commons.wikimedia.org/wiki/${encodeURIComponent(f.title.replace(/ /g, '_'))}`,
      licence,
      licenceUrl: info.extmetadata?.LicenseUrl?.value ?? null,
      artist: strip(info.extmetadata?.Artist?.value),
      credit: strip(info.extmetadata?.Credit?.value),
      retrievedAt: new Date().toISOString().slice(0, 10),
      kind: 'subject',
    });
    console.log(`${slug}: ${f.title} [${licence}]`);
  } catch (e) {
    skipped.push({ slug, title, reason: e.message });
    console.log(`${slug}: skipped (${e.message})`);
  }
  await new Promise((r) => setTimeout(r, 500));
}

await writeFile(
  path.join(OUT, 'manifest.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), source: 'Wikimedia Commons via English Wikipedia API', images: manifest, skipped }, null, 1),
);
console.log(`\n${manifest.length} images, ${skipped.length} skipped`);
