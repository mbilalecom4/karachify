// Adds an honest `kind` to every media.json entry:
//   'subject'  — the photograph really depicts the record it is attached to
//   'related'  — a Karachi photo of the same *type*, standing in for the subject
// The UI labels 'related' images as illustrative instead of claiming they show
// the named place.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const MEDIA = path.join(ROOT, 'src/data/media.json');

const BANNERS = {
  'attractions': 'Karachi attractions',
  'historical-heritage-buildings': 'Heritage buildings in Karachi',
  'museums-galleries': 'Museums and galleries in Karachi',
  'parks-gardens': 'Parks and gardens in Karachi',
  'beaches-point': 'Karachi coastline',
  'restaurants': 'Karachi restaurants',
  'cafes-tea-lodges': 'Cafes and tea lodges in Karachi',
  'street-food': 'Street food in Karachi',
  'bakeries-sweets': 'Bakeries and sweet shops in Karachi',
  'hotels-guest-houses': 'Hotels in Karachi',
  'shopping-malls': 'Shopping malls in Karachi',
  'markets-bazaars': 'Bazaars in Karachi',
  'superstores': 'Superstores in Karachi',
  'hospitals-clinics': 'Hospitals in Karachi',
  'pharmacies-labs': 'Pharmacies and labs in Karachi',
  'doctors-clinics': 'Clinics in Karachi',
  'education-institutes': 'Campuses in Karachi',
  'libraries': 'Libraries in Karachi',
  'events': 'Events in Karachi',
  'community-centres': 'Community centres in Karachi',
  'sports-complexes': 'Sports venues in Karachi',
  'professional-services': 'Business services in Karachi',
  'transport-hubs': 'Transport hubs in Karachi',
  'government-offices': 'Government offices in Karachi',
  'religious-places': 'Places of worship in Karachi',
};

function recordNames() {
  const names = new Map();
  const dirs = [path.join(ROOT, 'src/data/listings')];
  const files = [
    path.join(ROOT, 'src/data/events.ts'),
    path.join(ROOT, 'src/data/guides.ts'),
    path.join(ROOT, 'src/data/taxonomy.ts'),
  ];
  const sources = [];
  for (const d of dirs) {
    for (const f of fs.readdirSync(d)) if (f.endsWith('.ts')) sources.push(fs.readFileSync(path.join(d, f), 'utf8'));
  }
  for (const f of files) sources.push(fs.readFileSync(f, 'utf8'));

  for (const src of sources) {
    // split into object blocks and pull slug/name pairs out of each
    for (const block of src.split(/\n\s*\{\n/).slice(1)) {
      const body = block.slice(0, 4000);
      const slug = body.match(/slug:\s*'([^']+)'/)?.[1];
      const name = body.match(/(?:^|\n)\s*name:\s*'([^']+)'/)?.[1];
      if (slug && name && !names.has(slug)) names.set(slug, name);
    }
  }
  return names;
}

const norm = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const toks = (s) => norm(s).split(' ').filter((t) => t.length >= 5);

// Judgement calls that the token rule cannot make on its own.
const OVERRIDE = {
  'swaminarayan-temple-khi': 'subject', // Swaminaraya Mandir, Kharadar — same building
  'chai-wali-karachi': 'subject',
  'iba-karachi': 'subject',
  siut: 'subject',
  nicv: 'subject',
  'hill-park-karachi': 'subject',
  'eid-mela-clifton': 'subject',
  'mohatta-mosque': 'subject',
  'tooba-mosque': 'related',
  'aquarium-club': 'related',
  'lawn-bowls-karachi': 'related',
  'westin-swim-tennis': 'related',
  'mithai-burns': 'related',
  'baijnath-temple': 'related',
  'chaliha-bazaar': 'related',
  'mama-parshuram-clinic-lyari': 'related',
  'khi-literary-society': 'related',
  'moihalla-arts': 'related',
  'hills-park-karachi': 'related',
};

const names = recordNames();
const media = JSON.parse(fs.readFileSync(MEDIA, 'utf8'));

let subject = 0;
let related = 0;
const review = [];

for (const [key, entry] of Object.entries(media)) {
  const photo = entry.subject ?? '';
  if (!photo) continue;

  let label;
  if (key.startsWith('banner-')) label = BANNERS[key.slice(7)] ?? norm(key.slice(7)).replace(/-/g, ' ');
  else label = names.get(key) ?? names.get(key.replace(/-2026$/, '')) ?? null;

  let kind;
  if (OVERRIDE[key]) kind = OVERRIDE[key];
  else if (!label) kind = 'subject'; // hero/area/guide keys whose label is the photo itself
  else {
    const a = toks(label);
    const b = new Set(toks(photo));
    const shared = a.some((t) => b.has(t));
    const contains = norm(photo).includes(norm(label)) || norm(label).includes(norm(photo));
    kind = shared || contains ? 'subject' : 'related';
    if (kind === 'related') review.push(`${key}: "${label}" -> "${photo}"`);
  }

  entry.kind = kind;
  if (kind === 'subject') subject++;
  else related++;
}

fs.writeFileSync(MEDIA, `${JSON.stringify(media, null, 2)}\n`);
console.log(`kind written — subject: ${subject}, related: ${related}`);
if (review.length) {
  console.log('\nflagged as illustrative (no shared token):');
  for (const r of review) console.log(`  ${r}`);
}
