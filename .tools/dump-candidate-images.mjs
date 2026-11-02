#!/usr/bin/env node
// Prints the image files held by the Wikipedia article for each record that
// still renders a placeholder, so a human can pick the files whose own name
// identifies the subject. Read-only: nothing is written.
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const UA = 'Karachify/0.1 (city directory maintainer)';
const API = 'https://en.wikipedia.org/w/api.php';
const ROOT = resolve('.');

async function api(params) {
  const res = await fetch(`${API}?${new URLSearchParams(params)}&format=json`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  const text = await res.text();
  return text.startsWith('{') ? JSON.parse(text) : {};
}

const bundle = await build({
  stdin: { contents: `export { listings } from './listings';\nexport { default as media } from './media.json';`, resolveDir: join(ROOT, 'src/data'), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'neutral', write: false, logLevel: 'silent',
});
const tmp = mkdtempSync(join(tmpdir(), 'karachify-dump-'));
writeFileSync(join(tmp, 'd.mjs'), bundle.outputFiles[0].text);
const { listings, media } = await import(pathToFileURL(join(tmp, 'd.mjs')).href);

for (const l of listings.filter((x) => !media[x.slug])) {
  const clean = l.name.replace(/\(.*?\)/g, ' ').replace(/&.*$/, ' ').replace(/,.*/, ' ').trim();
  const search = await api({ action: 'query', list: 'search', srsearch: `${clean} Karachi`, srlimit: 3 });
  const hits = (search?.query?.search ?? []).map((s) => s.title);
  console.log(`\n### ${l.name}  [${l.slug}]`);
  for (const article of hits.slice(0, 2)) {
    const data = await api({ action: 'query', titles: article, prop: 'images', imlimit: 30 });
    const page = Object.values(data?.query?.pages ?? {})[0];
    const files = (page?.images ?? []).map((i) => i.title.replace(/^File:/, ''));
    console.log(`  -- ${article}`);
    for (const f of files.slice(0, 14)) console.log(`       ${f}`);
  }
  await new Promise((r) => setTimeout(r, 350));
}
