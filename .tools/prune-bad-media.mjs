#!/usr/bin/env node
// Removes registry entries whose photograph does not honestly belong to the
// record. Deleting a key is what makes the page fall back to the designed
// placeholder that names the real subject, which is the state the project spec
// demands when no picture of the subject itself has been sourced.
//
// Every reason below is read from the file name and source article stored with
// the entry — the only evidence of what the picture shows.
//
//   node .tools/prune-bad-media.mjs           print what would go
//   node .tools/prune-bad-media.mjs --write   remove and rewrite media.json
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const FILE = path.join(ROOT, 'src/data/media.json');

const REMOVE = {
  /* Claimed to photograph the record, but the file is a different place. */
  'bahria-university-karachi': 'file is "Bahria nc isb" — an Islamabad campus, shown as the Karachi campus',
  'karachi-fire-brigade': 'file is "Gul Plaza 1" — a shopping mall, shown as the fire brigade',
  'tdf-magnifiscience-centre': 'file is "MSC building night" — nothing names MagnifiScience Centre',

  /* Illustrative stand-ins that mislead more than a placeholder would. */
  'mama-parshuram-clinic-lyari': 'file is "Kakri Ground, Moosa Lane" — a cricket ground for a clinic',
  'dha-phase-8-school': 'file is "Tooba Mosque-3" — a mosque for a school',
  'passport-office-karachi': 'file is "Pakistani e-Passport Front New" — a document graphic, not a place',
  'karachi-tech-summit': 'file is "TCS Pakistan logo.svg" — a company logo, not free to hotlink',
  'hussainia-pechs': 'file names Imam Hossein Square, Tehran — photographed in Iran',
  'muharram-community-programme': 'file names Imam Hossein Square, Tehran — photographed in Iran',
  'sufi-qawwali-night': 'file names Ajmer Sharif dargah — photographed in India',
  'baijnath-temple': 'file names Haddid Uddin — the Himachal Pradesh temple, not Karachi\'s',
  'banner-pharmacies-labs': 'file is "PharmacistsMortar.svg" — a clip-art icon, not a Karachi photograph',
  'banner-universities': 'copied from the Islamabad campus photograph',
  'banner-schools': 'copied from the Tooba Mosque photograph',
  'banner-emergency': 'copied from the Gul Plaza photograph',

  /* Found by .tools/audit-subject-claims.mjs with the strict gate. */
  'beach-country-club': 'file is the Waverley Country Club clubhouse in Portland, Oregon',
  'tandoor-karachi-gulberg': 'file is "tandoorimumbai" — a tandoor photographed in Mumbai',
  'burger-lab-korangi': 'file is "reddot burger" — another chain\'s product, not Burger Lab',
  'rehman-transfusion-memon': 'file is "Memon masjid night" — a mosque, shown for Memon Hospital',
  'urdu-poetry-mushaira': 'file is "Ghalib at the Last Mushaira" — a Delhi scene, not a Karachi gathering',
};

const WRITE = process.argv.includes('--write');
const media = JSON.parse(readFileSync(FILE, 'utf8'));
const before = Object.keys(media).length;
let removed = 0;

for (const [key, reason] of Object.entries(REMOVE)) {
  if (!media[key]) {
    console.log(`absent    ${key}`);
    continue;
  }
  console.log(`${WRITE ? 'removed  ' : 'would go '} ${key}\n            ${reason}`);
  removed++;
  if (WRITE) delete media[key];
}

if (WRITE) writeFileSync(FILE, `${JSON.stringify(media, null, 2)}\n`);
console.log(`\n${WRITE ? `media.json: ${before} entries -> ${Object.keys(media).length} (${removed} removed)` : `dry run: ${removed} entries would go (nothing written)`}`);
