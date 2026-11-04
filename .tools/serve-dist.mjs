/**
 * Minimal static server for dist/, so a production build can be checked in a
 * browser. It answers paths the way GitHub Pages does, because that is the only
 * thing worth verifying here: a real file, then a directory's index.html, then
 * the 404 fallback with a 404 status — not the SPA shell served over everything,
 * which would hide a broken deep link instead of showing it.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const base = process.env.KARACHIFY_BASE || 'karachify';
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
  '.webmanifest': 'application/manifest+json',
};

/** Windows and POSIX separators differ; `relative` knows both. */
const withinRoot = (path) => !relative(root, path).startsWith('..');

createServer(async (req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  const rel = url.replace(new RegExp(`^/${base}`), '') || '/';
  const file = join(root, rel);
  if (!withinRoot(file)) {
    res.writeHead(400).end('outside dist/');
    return;
  }

  // A directory is asked for as /place/foo/ and answered from its index.html.
  for (const candidate of [file, join(file, 'index.html')]) {
    try {
      const body = await readFile(candidate);
      res.writeHead(200, { 'Content-Type': types[extname(candidate)] ?? 'application/octet-stream' });
      res.end(body);
      return;
    } catch {
      /* try the next candidate */
    }
  }

  if (extname(file)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found');
    return;
  }
  try {
    const fallback = await readFile(join(root, '404.html'));
    res.writeHead(404, { 'Content-Type': 'text/html' }).end(fallback);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found');
  }
}).listen(4174, () => console.log(`dist served on http://localhost:4174/${base}/`));
