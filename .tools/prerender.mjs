#!/usr/bin/env node
/*
 * The static half of the site.
 *
 * Vite builds one shell. This turns that shell into the pages the app can be
 * opened at, so that a crawler or a link preview receives a title, a
 * description and a structured-data block naming the place behind the URL
 * instead of the homepage's.
 *
 * Where the tags come from is the point: they are generated from
 * `src/lib/pageMeta.ts`, the same module `MetaManager` reads in the browser, and
 * from the same data the pages render. Nothing is asserted here that the build
 * cannot check, and the build stops when the two disagree — a head describing a
 * page differently from the page itself is a claim nobody verified, which is the
 * one thing Karachify promises not to ship.
 *
 * Runs after `vite build`, because it needs the hashed asset names in the shell.
 */
import { build } from 'esbuild';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve('.');
const dist = join(root, 'dist');
const shellPath = join(dist, 'index.html');
const base = (process.env.KARACHIFY_BASE || 'karachify').replace(/^\/+|\/+$/g, '');

const BEGIN = '<!-- prerender:head:begin';
const END = '<!-- prerender:head:end -->';

const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
  return ok;
};

/* ------------------------------ the shared source ----------------------------- */

const bundled = await build({
  entryPoints: [join(root, 'src/lib/pageMeta.ts')],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  write: false,
  logLevel: 'silent',
});

const tmp = mkdtempSync(join(tmpdir(), 'karachify-prerender-'));
const moduleFile = join(tmp, 'pageMeta.mjs');
writeFileSync(moduleFile, bundled.outputFiles[0].text);
const { SITE_URL, absoluteUrl, headHtml, indexablePaths, metaForPath } = await import(pathToFileURL(moduleFile).href);

/* --------------------------------- the shell --------------------------------- */

if (!check(existsSync(shellPath), `${shellPath} is missing — run vite build before prerendering`)) bail();

const shell = readFileSync(shellPath, 'utf8');
// Both markers stay in every file written: what they say is where the head came
// from, and a page that lost its explanation would look hand-made again.
const from = shell.indexOf('-->', shell.indexOf(BEGIN));
const to = shell.indexOf(END);
if (!check(from > -1 && to > from, 'index.html carries no prerender:head region for the generated tags to live in')) bail();

/** The shell with the region between the two markers replaced. */
const withHead = (head) => `${shell.slice(0, from + 3)}\n    ${head}\n    ${shell.slice(to)}`;

// The hand-written canonical in index.html and SITE_URL are one fact in two
// files; this is what keeps them that way.
const servedCanonical = /<link rel="canonical" href="([^"]+)"/.exec(shell.slice(from, to))?.[1];
check(
  servedCanonical === SITE_URL,
  `index.html canonicalises ${servedCanonical ?? 'nothing'} while pageMeta.ts publishes ${SITE_URL}`
);

// GitHub Pages serves the site under /<repo>/, and every absolute URL below has
// to be built for the base this bundle was actually made for.
const publishedPath = new URL(SITE_URL).pathname;
check(publishedPath === `/${base}/`, `SITE_URL points at ${publishedPath} but this build is for /${base}/`);

/* ---------------------------------- the pages --------------------------------- */

const paths = indexablePaths();
check(paths.includes('/'), 'indexablePaths() omits the homepage, so the shell itself would keep the hand-written head');

let written = 0;
for (const path of paths) {
  const meta = metaForPath(path);
  if (!meta) {
    failures.push(`${path} is listed as indexable but metaForPath() declines to describe it`);
    continue;
  }
  // A page may only canonicalise itself. An alias would tell two URLs to be the
  // same document while this script writes a real file for each of them.
  if (meta.path !== path) {
    failures.push(`${path} would be published with a canonical for ${meta.path}`);
    continue;
  }

  // '/' is the shell; everything else is a directory holding an index.html,
  // which is the address a static host answers with a 200.
  const target = path === '/' ? shellPath : join(dist, `.${path}`, 'index.html');
  if (path !== '/' && existsSync(target)) {
    failures.push(`prerendering ${path} would overwrite a file vite built at ${target}`);
    continue;
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, withHead(headHtml(meta)));
  written += 1;
}
check(written === paths.length, `${paths.length - written} indexable page(s) were not written — see the list above`);

/* -------------------------------- the fallback -------------------------------- */

/*
 * GitHub Pages answers an unknown path with this file, and the app opens the
 * page anyway, because the shell underneath is the same shell. It carries no
 * canonical: this document is served at as many addresses as nobody could
 * answer, and naming one of them would be inventing the rest.
 */
const notFound = [
  '<title>Page not found · Karachify</title>',
  '<meta name="description" content="Karachify has no page at this address. The directory lists Karachi places with the source each field came from; a mistyped address, or a page that has since been removed, lands here.">',
];
writeFileSync(join(dist, '404.html'), withHead(notFound.join('\n    ')));

/* --------------------------------- the sitemap -------------------------------- */

const urls = paths.map((p) => `  <url><loc>${absoluteUrl(p).replace(/&/g, '&amp;')}</loc></url>`).join('\n');
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Every URL below is a file this build just wrote, so nothing here is a page
       the site hopes exists. No lastmod: Karachify cannot say when an individual
       page's data last changed, and a date stamped by the build would claim that
       every page changed today. -->
${urls}
</urlset>
`;
writeFileSync(join(dist, 'sitemap.xml'), xml);

if (failures.length) bail();
console.log(
  `✓ prerender: ${written} pages under dist/, 404.html for the fallback, sitemap.xml listing exactly those ${paths.length}`
);

function bail() {
  console.error(`✗ prerender: ${failures.length || 1} problem(s)`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
