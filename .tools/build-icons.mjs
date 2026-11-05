/*
 * Rasterises the brand mark into the PNG icons a web app manifest is graded on.
 *
 * Chrome's installability check wants a 192px and a 512px raster; an SVG alone
 * is not enough on every platform, and a PNG stretched up from a smaller one is
 * a lie about resolution. So each file is drawn at the size it is published at,
 * by the same Chromium the rest of this repo measures with, and written out —
 * nothing here is resampled after the fact.
 *
 *   node .tools/build-icons.mjs
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, 'public', 'icons');

// Playwright is not a dependency of the site — it is the copy npx keeps in the
// global cache, which is what every measurement pass in this repo has used.
const require = createRequire('C:/Users/Bilal (ShahNoor)/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/package.json');
const { chromium } = require('playwright');

/** Brand palette (tailwind.config.js): navy-800 ground, lime-500 mark, navy-100 horizon. */
const GROUND = '#063231';
const MARK = '#CBFF54';
const LINE = '#CFE9E6';

/**
 * The mark is authored on the same 32-unit grid as `BrandLogo.tsx`, then scaled
 * into the canvas. `inset` is the fraction of the canvas the artwork may fill:
 * a normal icon can nearly touch the edges because it draws its own rounded
 * square, but a maskable one is cropped by the platform into a circle or a
 * squircle, and the spec asks for the middle 80% to be the only safe part.
 */
function svg(size, { maskable }) {
  const radius = maskable ? 0 : Math.round(size * 0.22);
  const inset = maskable ? 0.6 : 0.78;
  const span = size * inset;
  const scale = span / 32;
  const offset = (size - span) / 2;
  // A maskable icon is cropped by the launcher, so it paints edge to edge and
  // keeps the artwork inside the safe middle. A plain one draws its own rounded
  // square and leaves the corners transparent, which is what a tab icon reads as.
  const ground = maskable
    ? `<rect width="${size}" height="${size}" fill="${GROUND}"/>`
    : `<rect width="${size}" height="${size}" rx="${radius}" fill="${GROUND}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${ground}
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    <path d="M8 22V10h3v5l5-5h3.6l-5.2 5.4L22.6 22H18.6l-4.4-4.8L11 19.6V22z" fill="${MARK}"/>
    <path d="M4 25.5h24" stroke="${LINE}" stroke-width="1.6" stroke-linecap="round" opacity="0.75"/>
  </g>
</svg>`;
}

const jobs = [
  { name: 'icon-192.png', size: 192, maskable: false },
  { name: 'icon-512.png', size: 512, maskable: false },
  { name: 'icon-maskable-512.png', size: 512, maskable: true },
  { name: 'apple-touch-icon.png', size: 180, maskable: false },
];

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Users/Bilal (ShahNoor)/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe',
});
const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });

for (const job of jobs) {
  await page.setViewportSize({ width: job.size, height: job.size });
  await page.setContent(svg(job.size, job), { waitUntil: 'load' });
  await page.screenshot({ path: join(outDir, job.name), clip: { x: 0, y: 0, width: job.size, height: job.size } });
  console.log(`✓ public/icons/${job.name} — ${job.size}px ${job.maskable ? 'maskable' : 'rounded'}`);
}

await browser.close();
console.log(`\n${jobs.length} icons written. They are static files in public/, so "npm run build" copies them unchanged.`);
