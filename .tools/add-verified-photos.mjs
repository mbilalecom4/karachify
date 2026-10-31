#!/usr/bin/env node
// Registers a Commons photograph that the research files already identified by
// exact File: title (and that the researcher confirmed depicts the subject).
// resolve-media.mjs searches by article title; here the file is known, so the
// only job is to fetch its URLs, artist and licence from the API rather than
// transcribe them. Writes into src/data/media.json.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const UA = 'Karachify/0.1 (city discovery demo; sourcing licensed Commons imagery)';

/** slug -> Commons file title, taken from docs/verification/batch-*.json. */
const WANT = {
  'hawksbay-beach': 'HawksBay_Beach.jpg',
  'state-bank-of-pakistan-museum':
    'Old building of State Bank of Pakistan, Now its known as State Bank Museum.jpg',
  'tdf-magnifiscience-centre': 'MSC building night.jpg',
  'karachi-zoo':
    'An elephant bathing at the Karachi Zoological and Botanical Gardens, Pakistan - Sunday October 10,2021.jpg',
};

const SUBJECT = {
  'hawksbay-beach': "Hawke's Bay Beach",
  'state-bank-of-pakistan-museum': 'State Bank of Pakistan Museum',
  'tdf-magnifiscience-centre': 'TDF MagnifiScience Centre',
  'karachi-zoo': 'Karachi Zoo',
};

function thumbAt(url, width) {
  if (!url) return null;
  const u = url.split('?')[0];
  const swapped = u.replace(/\/(\d+)px-([^/]+)$/, `/${width}px-$2`);
  if (swapped !== u) return swapped;
  const m = u.match(/^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/[a-z0-9]\/([a-z0-9]{2})\/([^/]+))$/);
  return m ? `${m[1]}/thumb/${m[3]}/${width}px-${m[3]}` : null;
}

async function ok(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    const bytes = (await r.arrayBuffer()).byteLength;
    return r.status === 200 && bytes > 3000 ? bytes : 0;
  } catch {
    return 0;
  }
}

const media = JSON.parse(readFileSync(path.join(ROOT, 'src/data/media.json'), 'utf8'));

for (const [slug, file] of Object.entries(WANT)) {
  const api =
    `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(`File:${file}`)}` +
    '&prop=imageinfo&iiprop=url%7Cextmetadata%7Csize' +
    '&iiextmetadatafilter=LicenseShortName%7CArtist%7CCopyrighted%7CUsageTerms&iiurlwidth=1280&format=json';
  const res = await fetch(api, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  const data = await res.json();
  const page = Object.values(data?.query?.pages ?? {})[0];
  const info = page?.imageinfo?.[0];
  // A Commons-hosted file reports "missing" on the local wiki while still
  // returning imageinfo, so only the absence of imageinfo means "not found".
  if (!info) {
    console.log(`MISS ${slug}: "${file}" is not on Commons — leaving the placeholder in place`);
    continue;
  }
  const strip = (v) => (v ? String(v).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : undefined);
  const wide = thumbAt(info.thumburl ?? info.url, 1280) ?? info.thumburl;
  const card = thumbAt(info.thumburl ?? info.url, 500) ?? info.thumburl;
  const [wideBytes, cardBytes] = [await ok(wide), await ok(card)];
  if (!wideBytes && !cardBytes) {
    console.log(`MISS ${slug}: thumbnail URLs did not resolve`);
    continue;
  }
  media[slug] = {
    key: slug,
    subject: SUBJECT[slug] ?? slug,
    via: file,
    thumb: cardBytes ? card : wide,
    wide: wideBytes ? wide : card,
    filePage: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, '_'))}`,
    artist: strip(info.extmetadata?.Artist?.value),
    license: strip(info.extmetadata?.LicenseShortName?.value),
    verified: true,
    kind: 'subject',
  };
  console.log(`ok  ${slug}: ${media[slug].license} · ${media[slug].artist} · wide ${wideBytes}B card ${cardBytes}B`);
  await new Promise((r) => setTimeout(r, 400));
}

writeFileSync(path.join(ROOT, 'src/data/media.json'), `${JSON.stringify(media, null, 2)}\n`);
console.log(`\nmedia.json now holds ${Object.keys(media).length} entries`);
