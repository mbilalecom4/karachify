/* Probes every image URL the site renders and reports placeholder coverage. */
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve('.');
const bundle = await build({
  stdin: {
    contents: `
      export { listings } from './listings';
      export { guides } from './guides';
      export { categories, areas } from './taxonomy';
      export { default as media } from './media.json';
      export { areaImageKey } from '../lib/media';
    `,
    resolveDir: join(root, 'src/data'),
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  write: false,
  logLevel: 'silent',
});
const dir = mkdtempSync(join(tmpdir(), 'karachify-img-'));
const file = join(dir, 'data.mjs');
writeFileSync(file, bundle.outputFiles[0].text);
const { listings, guides, categories, areas, media, areaImageKey } = await import(pathToFileURL(file).href);

const urls = [];
for (const [key, m] of Object.entries(media))
  for (const size of ['thumb', 'wide']) if (m[size]) urls.push({ key, size, url: m[size] });

const results = new Map();
let cursor = 0;
// Anonymous Wikimedia requests are rate-limited hard, so probe slowly rather
// than in parallel — a 429 here would look like a broken image and mislead.
async function worker() {
  while (cursor < urls.length) {
    const job = urls[cursor++];
    await new Promise((r) => setTimeout(r, 250));
    try {
      const res = await fetch(job.url, { headers: { 'User-Agent': 'KarachiFY-image-audit/1.0 (directory maintainer)' } });
      await res.body?.cancel().catch(() => {});
      results.set(job, { status: res.status });
    } catch (err) {
      results.set(job, { status: 0, error: String(err).slice(0, 80) });
    }
  }
}
await Promise.all(Array.from({ length: 3 }, worker));

const bad = [...results].filter(([, r]) => r.status !== 200);
console.log(`probed ${urls.length} urls · ${bad.length} not 200`);
for (const [job, r] of bad) console.log(`  ${r.status} ${job.key} [${job.size}] ${job.url}`);

const keys = new Set(Object.keys(media));
const shape = (label, items, keyOf) => {
  const gone = items.filter((i) => !keys.has(keyOf(i)));
  console.log(`${label}: ${items.length} total · ${items.length - gone.length} photo · ${gone.length} placeholder`);
  if (gone.length && gone.length <= 60) console.log('  ' + gone.map((i) => keyOf(i)).join(', '));
};
shape('listings', listings, (l) => l.slug);
shape('guides', guides, (g) => `guide-${g.slug}`);
shape('categories', categories, (c) => `banner-${c.id}`);
shape('areas (via the landmark photo the page actually uses)', areas, (a) => areaImageKey(a.id));
