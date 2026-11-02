#!/usr/bin/env node
// Sets the media registry's honesty flags straight.
//
// `kind: 'subject'` is a claim: it says the photograph depicts the record the
// card is about, and the site prints no disclaimer next to it. `kind: 'related'`
// is the honest state for a stand-in — the card then carries the Illustrative
// stamp and names what the picture really shows.
//
// `audit-subject-claims.mjs` compared every 'subject' entry's record name with
// its own Wikimedia file name and found 72 that do not match. Each one was read
// and put into the table below; nothing here is a rule, it is a per-entry
// decision with the reason recorded.
//
// Two entries were checked and found to be correctly photographed after all —
// those went into REVIEWED in the audit instead, not here.
//
// The twelve DROP keys are registry entries attached to listings that no longer
// exist; they render nothing, but /image-credits still publishes a credit line
// for them.
//
//   node .tools/reclassify-media.mjs          dry run
//   node .tools/reclassify-media.mjs --write  rewrite src/data/media.json
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const WRITE = process.argv.includes('--write');
const ROOT = path.resolve(import.meta.dirname, '..');
const FILE = path.join(ROOT, 'src/data/media.json');

/* A plate of biryani is what the place serves, not what the place looks like. */
const DISH = [
  'bismillah-marwa', 'cairo-burns', 'chai-wali-karachi', 'darya-dining', 'ghari-kabab', 'hababs',
  'hotel-rehri-saddar', 'ice-cream-karachi-club', 'khi-dinner', 'kolhapichay-clifton',
  'landhi-biryani-house', 'mehboob-wharf', 'nihari-haveli', 'peshawar-restaurant-khi',
  'roastery-gulshan', 'saddar-bukhara', 'sea-shell-boatkasin', 'taftri-house', 'mithai-burns',
];
/* A recognisable Karachi scene used in place of the specific address. */
const SCENE = [
  'ansari-hall', 'brigo-beach', 'marine-drive-strip', 'paradise-point', 'beach-resort-hawkesbay',
  'ocean-park-karachi', 'swaminarayan-temple-khi', 'french-creek', 'gulshan-park', 'lumbini-park',
  'dolphin-park-clifton', 'malir-garden', 'sughar-house',
];
/* A real Karachi building — but a different one from the record's own. */
const NEIGHBOUR = [
  'indus-hospital-karachi', 'liaquat-national-hospital', 'national-hospital-karachi', 'nicv', 'siut',
  'south-city-hospital', 'jamia-masjid-karachi', 'gurdwara-karachi', 'st-andrews-scots-kirk',
  'st-patricks-cathedral', 'pearl-vohra', 'talwar-lawn', 'saddar-electronic-market',
  'karachi-port-cruise-terminal', 'seaview-ferry-terminal', 'hills-park-karachi', 'khi-literary-society',
];
/* A category header showing one member of the category. */
const TILE = [
  'banner-art-culture', 'banner-beaches', 'banner-doctors-clinics', 'banner-events', 'banner-government',
  'banner-guides',
  'banner-hospitals', 'banner-hotels', 'banner-museums-galleries', 'banner-parks-recreation',
  'banner-professional-services', 'banner-religious-places', 'banner-restaurants-cafes',
  'banner-shopping', 'banner-sports-fitness', 'banner-tourist-places', 'banner-transport',
  'banner-wedding-venues',
];
/* A guide cover: the walk, not the article. */
const COVER = [
  'guide-heritage-walk-saddar', 'guide-karachi-for-business-visitors', 'guide-karachi-in-the-monsoon',
  'guide-karachi-photo-spots', 'guide-karachi-with-kids', 'guide-one-day-in-karachi',
  'guide-shopping-in-karachi', 'guide-where-karachi-eats',
];

const REASONS = {
  'dish photo of what the place serves, not the premises': DISH,
  'a Karachi scene standing in for this specific address': SCENE,
  'a real Karachi building, but not the one this record is about': NEIGHBOUR,
  'one member of the category, used as the category header': TILE,
  'one scene from the guide, used as the article cover': COVER,
};

const DROP = [
  'ajrak-block-print-workshop', 'aquarium-club', 'beach-cleanup-drive', 'eid-mela-clifton',
  'interior-design-studio', 'karachi-book-fair', 'lawn-bowls-karachi', 'nadra-facilitation-centre',
  'psc-super-series-final', 'red-crescent-blood-bank', 'tooba-mosque', 'urdu-theatre-night',
];

/* `subject` is printed on /image-credits and in Admin; a slug there is not a caption. */
const SUBJECT_NAME = {
  'banner-art-culture': 'Art & Culture',
  'banner-doctors-clinics': 'Doctors & Clinics',
  'banner-museums-galleries': 'Museums & Art Galleries',
  'banner-parks-recreation': 'Parks & Recreation',
  'banner-religious-places': 'Religious Places',
  'banner-restaurants-cafes': 'Restaurants & Cafes',
  'banner-sports-fitness': 'Sports & Fitness',
  'banner-tourist-places': 'Tourist Places & Attractions',
  'banner-wedding-venues': 'Wedding & Event Venues',
  'guide-where-karachi-eats': 'Where Karachi eats: biryani, nihari, chai and the night shift',
  'st-andrews-scots-kirk': "St. Andrew's Scots Kirk",
  'st-patricks-cathedral': "St. Patrick's Cathedral",
  // The file behind this slot is a daytime Mazar-e-Quaid; the slot name claimed night.
  'hero-karachi-night': 'Mazar-e-Quaid, Karachi',
};

const media = JSON.parse(readFileSync(FILE, 'utf8'));
const before = Object.keys(media).length;
let flipped = 0;
let renamed = 0;

for (const [reason, keys] of Object.entries(REASONS)) {
  for (const key of keys) {
    const e = media[key];
    if (!e) {
      console.log(`  missing entry, skipped: ${key}`);
      continue;
    }
    if (e.kind === 'related' && e.illustrativeReason) continue;
    e.kind = 'related';
    e.illustrativeReason = reason;
    flipped++;
  }
}
for (const [key, subject] of Object.entries(SUBJECT_NAME)) {
  if (!media[key]) continue;
  if (media[key].subject !== subject) {
    media[key].subject = subject;
    renamed++;
  }
}
for (const key of DROP) delete media[key];

const kinds = Object.values(media).reduce((a, e) => ((a[e.kind] = (a[e.kind] ?? 0) + 1), a), {});
console.log(
  `${before} -> ${Object.keys(media).length} entries (dropped ${before - Object.keys(media).length}) · ` +
    `${flipped} re-labelled illustrative · ${renamed} subjects made readable · kinds: ${JSON.stringify(kinds)}`
);

if (WRITE) {
  writeFileSync(FILE, JSON.stringify(media, null, 2) + '\n');
  console.log('wrote src/data/media.json');
} else console.log('dry run — nothing written');
