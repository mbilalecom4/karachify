#!/usr/bin/env node
// Renders the built site in a real Chromium viewport and reports what the
// image layer actually did — which rendition the browser picked, whether the
// bytes arrived, and a screenshot as the evidence.
//
// The in-app Browser can be opened with a zero-size surface; `window.innerWidth`
// is then 0, every `sizes` calculation collapses, and nothing about the picture
// can be trusted. This script starts its own throwaway profile instead, so it
// never reads or writes the maintainer's own Chrome data.
//
//   node .tools/shoot.mjs --page=place/tdf-magnifiscience-centre --at=1440x900
//   node .tools/shoot.mjs --page=place/karachi-grammar-school --at=390x844
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const CHROME = process.env.CHROME_PATH
  ?? 'C:/Users/Bilal (ShahNoor)/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe';
const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, '.tools', '_shots');
const BASE = process.env.SHOT_BASE ?? 'http://localhost:4174/karachify/';

const arg = (name, fallback) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? fallback;

const page = arg('page', '');
const [w, h] = arg('at', '1440x900').split('x').map(Number);
const full = arg('full', '0') === '1';
/* When this machine cannot resolve anything, `--match=<url fragment> --stub=<file>`
   answers the picture request from a copy already downloaded, so the layout it
   paints into — crop, contrast, how far it stretches — can still be looked at.
   It proves nothing about whether the live host answers, and says so. */
const match = arg('match', '');
const stub = arg('stub', '');
if (!page) {
  console.error('give a page, e.g. --page=place/tdf-magnifiscience-centre');
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
const file = path.join(OUT, `${page.replace(/[^a-z0-9]+/gi, '_')}_${w}x${h}.png`);

/* Playwright gives a launch its own throwaway profile, which is the point: the
   maintainer's own Chrome data is never opened, read or written. */
/* Chromium's own asynchronous resolver asks the configured DNS server directly
   over UDP, and on this machine that is refused while the ordinary system
   lookup works — so every picture arrived as `ERR_NAME_NOT_RESOLVED` here while
   the same URL answered 200 everywhere else. Forcing the system resolver is
   what makes this harness test the same network a visitor is on. */
const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-async-dns', '--force-system-resolver'],
});
/* The offline cache is a second network in front of the page: with it running,
   a picture request is answered by the service worker, not by the browser, and
   neither a stub nor a live failure can be attributed to the code under test.
   This harness asks the app directly.
   Wikimedia's edge answers the stock `HeadlessChrome` user agent with a
   refusal, which reaches the page as a failure on every picture — including
   ones this site has carried for months — so the UA a real visitor sends is
   the condition being tested, and this sends that. */
const context = await browser.newContext({
  viewport: { width: w, height: h },
  deviceScaleFactor: 1,
  serviceWorkers: 'block',
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
});
const errors = [];
const failed = [];
const shot = await context.newPage();
shot.on('pageerror', (e) => errors.push(String(e.message).slice(0, 160)));
shot.on('requestfailed', (r) => failed.push(`${r.failure()?.errorText ?? 'failed'} ${r.url().slice(0, 110)}`));
if (match && stub) {
  await shot.route('**upload.wikimedia.org/**', (route) =>
    route.request().url().includes(match)
      ? route.fulfill({ path: stub, contentType: 'image/jpeg' })
      : route.abort(),
  );
}

await shot.goto(new URL(page.replace(/\/$/, '') + '/', BASE).href, { waitUntil: 'load', timeout: 60000 });
/* A frame painted below the fold is `loading="lazy"` and stays unfetched until
   the page has travelled to it, so the pass scrolls, then waits on the lead
   picture's own bytes rather than a fixed sleep. */
await shot.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await shot.waitForTimeout(1200);
await shot.evaluate(() => window.scrollTo(0, 0));
await shot
  .waitForFunction(
    () => {
      const i = document.querySelector('img.h-full.w-full.object-cover:not([class*="transition"])');
      return !i || (i.complete && i.naturalWidth > 0);
    },
    null,
    { timeout: 30000 },
  )
  .catch(() => {});
await shot.waitForTimeout(1500);

const report = await shot.evaluate(() => {
  const px = (el) => {
    const box = el.getBoundingClientRect();
    return { painted: `${Math.round(box.width)}x${Math.round(box.height)}`, top: Math.round(box.top) };
  };
  const read = (i) => {
    const srcset = i.getAttribute('srcset');
    return {
      alt: (i.alt ?? '').slice(0, 70),
      offered: srcset ? srcset.split(',').length : 1,
      chosen: (i.currentSrc || i.src).slice(0, 150),
      bytes: i.naturalWidth + 'x' + i.naturalHeight,
      done: i.complete,
      ...px(i),
    };
  };
  /* The lead frame is the one element that carries no `transition` class, and
     when its bytes fail it is wearing a `data:` placeholder — so it is read by
     its own selector instead of a filter that would drop it. */
  const hero = document.querySelector('img.h-full.w-full.object-cover:not([class*="transition"])');
  const imgs = [...document.querySelectorAll('img')].slice(0, 10).map(read);
  return {
    title: document.title,
    viewport: window.innerWidth + 'x' + window.innerHeight,
    hero: hero ? read(hero) : null,
    imgs,
    bodyText: document.body.innerText.replace(/\s+/g, ' ').slice(0, 1400),
  };
});

await shot.screenshot({ path: file, fullPage: full });
await browser.close();

console.log(
  JSON.stringify(
    {
      ...report,
      screenshot: file,
      /* Naming a stubbed screenshot "verified" would be a lie about the host. */
      pictureBytesFrom: match && stub ? `a local copy (${path.basename(stub)}) — the live host was not asked` : 'the live host',
      pageErrors: errors,
      requestFailures: failed.slice(0, 8),
    },
    null,
    1,
  ),
);
