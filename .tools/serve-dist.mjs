/** Minimal static server for dist/ so the production bundle can be verified in a browser. */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = normalize(fileURLToPath(new URL('../dist', import.meta.url)));
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
};

createServer(async (req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  const rel = url.replace(new RegExp(`^/${base}`), '') || '/';
  let file = join(root, rel);
  let body;
  let type = types[extname(file)] ?? 'application/octet-stream';
  try {
    body = await readFile(file);
  } catch {
    body = await readFile(join(root, 'index.html'));
    type = 'text/html';
  }
  res.writeHead(200, { 'Content-Type': type });
  res.end(body);
}).listen(4174, () => console.log(`dist served on http://localhost:4174/${base}/`));