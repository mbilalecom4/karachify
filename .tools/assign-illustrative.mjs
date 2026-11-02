#!/usr/bin/env node
// Gives records that have no photograph of their own a licensed Karachi picture
// of the same kind, copied from an entry the project already verified.
//
// The registry marks these `kind: "related"` and the UI says so out loud: the
// place card carries an "Illustrative photo" stamp and the detail page names
// what the picture actually shows. That is the alternative to a bare grey
// placeholder on half the directory.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const FILE = path.join(ROOT, 'src/data/media.json');

/** target key -> existing registry key whose subject is the same kind of thing.
 *
 * Only editorial keys are listed. A business or institution card is a claim
 * that the picture shows *that* place, so a same-city stand-in stays off the
 * directory records and they keep the designed placeholder that names them.
 * Category banners and guides illustrate a theme, which is what `kind:
 * 'related'` honestly means. */
const MAP = {
  'banner-doctors-clinics': 'banner-hospitals',
  'banner-professional-services': 'karachi-expo-centre',
  'guide-one-day-in-karachi': 'mazar-e-quaid',
  'guide-where-karachi-eats': 'banner-restaurants-cafes',
  'guide-heritage-walk-saddar': 'frere-hall',
  'guide-karachi-with-kids': 'karachi-zoo',
  'guide-shopping-in-karachi': 'dolmen-mall-clifton',
  'guide-karachi-in-the-monsoon': 'clifton-beach',
  'guide-karachi-for-business-visitors': 'karachi-expo-centre',
  'guide-karachi-photo-spots': 'mohatta-palace',
};

const media = JSON.parse(readFileSync(FILE, 'utf8'));
let added = 0;
let skipped = [];

for (const [target, source] of Object.entries(MAP)) {
  const from = media[source];
  if (!from) {
    skipped.push(`${target} (source ${source} is not in the registry)`);
    continue;
  }
  if (media[target] && media[target].kind === 'subject') {
    skipped.push(`${target} (already has a photograph of the subject itself)`);
    continue;
  }
  media[target] = {
    key: target,
    subject: from.subject,
    via: from.via,
    thumb: from.thumb,
    wide: from.wide,
    filePage: from.filePage,
    artist: from.artist,
    license: from.license,
    verified: true,
    kind: 'related',
  };
  added++;
}

writeFileSync(FILE, `${JSON.stringify(media, null, 2)}\n`);
console.log(`illustrative entries added: ${added}`);
if (skipped.length) console.log(`skipped:\n  ${skipped.join('\n  ')}`);
console.log(`registry now holds ${Object.keys(media).length} entries`);
