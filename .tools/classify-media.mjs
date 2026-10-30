/**
 * Karachify media honesty audit.
 *
 * The resolver writes entry.subject as the *record's* name, so it can never
 * prove what the photograph shows. This script compares the record name with
 * the evidence that does describe the picture: entry.via (the Wikipedia article
 * the image came from) and the Commons file name.
 *
 *   subject  the file/via really names this record
 *   related  a Karachi/Pakistan picture of the same kind, shown as illustrative
 *   dropped  a picture of an unrelated foreign subject — removed so the app
 *            renders its designed placeholder instead
 *
 * Run: node .tools/classify-media.mjs          (report only)
 *      node .tools/classify-media.mjs --apply
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const MEDIA = path.join(ROOT, 'src/data/media.json');
const apply = process.argv.includes('--apply');

function recordNames() {
  const names = new Map();
  const take = (src, splitter) => {
    for (const block of src.split(splitter).slice(1)) {
      const body = block.slice(0, 3000);
      const slug = body.match(/slug:\s*'([^']+)'/)?.[1] ?? body.match(/id:\s*'([^']+)'/)?.[1];
      const name =
        body.match(/(?:^|\n)\s*(?:name|title):\s*'((?:[^'\\]|\\.)*)'/)?.[1]?.replace(/\\'/g, "'") ??
        body.match(/(?:^|\n)\s*(?:name|title):\s*"((?:[^"\\]|\\.)*)"/)?.[1];
      if (slug && name && !names.has(slug)) names.set(slug, name);
    }
  };
  const dir = path.join(ROOT, 'src/data/listings');
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.ts')) continue;
    take(fs.readFileSync(path.join(dir, f), 'utf8'), /\n(?=\s*makeListing\()/g);
  }
  take(fs.readFileSync(path.join(ROOT, 'src/data/events.ts'), 'utf8'), /\n(?=\s*ev\(\{)/g);
  const guides = fs.readFileSync(path.join(ROOT, 'src/data/guides.ts'), 'utf8');
  for (const block of guides.split(/\n(?=\s*\{\s*$)/g).slice(1)) {
    const slug = block.match(/slug:\s*'([^']+)'/)?.[1];
    const title = block.match(/title:\s*'([^']+)'/)?.[1];
    if (slug && title && !names.has(`guide-${slug}`)) names.set(`guide-${slug}`, title);
  }
  const tax = fs.readFileSync(path.join(ROOT, 'src/data/taxonomy.ts'), 'utf8');
  for (const m of tax.matchAll(/slug:\s*'([^']+)'/g)) {
    const body = tax.slice(m.index, m.index + 400);
    const name = body.match(/name:\s*'([^']+)'/)?.[1];
    if (name && !names.has(m[1])) names.set(m[1], name);
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

/* Words that describe a *type* of place; sharing one of these proves nothing. */
const GENERIC = new Set([
  'hotel', 'market', 'school', 'hospital', 'stadium', 'mosque', 'beach', 'park', 'tower', 'club',
  'restaurant', 'mall', 'centre', 'center', 'university', 'institute', 'shrine', 'temple', 'masjid',
  'grill', 'cafe', 'bazaar', 'garden', 'terminal', 'lodge', 'road', 'building', 'hall', 'gallery',
  'museum', 'office', 'clinic', 'station', 'airport', 'lawn', 'house', 'court', 'campus', 'studio',
  'agency', 'practice', 'company', 'services', 'service', 'cathedral', 'kirk', 'church', 'mandir',
  'gurdwara', 'fun', 'point', 'old', 'new', 'city', 'karachi', 'sindh', 'pakistan',
]);

/* Regional food: a plate of biryani is honest illustration for a Karachi eatery. */
const DISH = /(biryani|kebab|kabob|karahi|qorma|musallam|halwa|kulfi|chapli|haleem|nihari|paye|paratha|samosa|jalebi|lassi|falooda|mithai|gulab|jamun|pakora|pulao|pilaf|fried fish|prawn|penaeus|lentil|tea|chai|coffee|latte|dessert|cuisine|curry|tandoori|dumpling)/i;

const LOCAL = /(karachi|sindh|pakistan|clifton|\bdha\b|gulshan|saddar|manora|seaview|sea view|tooba|mazar|quaid|empress|frere|dolmen|lucky one|chaukhandi|burns|bohri|korangi|malir|lyari|pechs|nazimabad|federal b|jinnah|aga khan|\bned\b|\biba\b|urdu|ghalib|mushaira|bahadurabad|expo|national stadium|ibn-e-qasim|ibne bin qasim|lumbini|hill park|port grand|maritime|siut|nicv|rescue 1122|kmc|metropolitan corporation|grammar school|air force museum|baptist|st\.? patrick|scots kirk|mohatta|kiamari|machar|rehri|civil lines|chundrigar|achaibar|ashura|muharram|qawwali|sufi|ajrak|block [0-9]|indus|keti|bunder)/i;

const names = recordNames();
const media = JSON.parse(fs.readFileSync(MEDIA, 'utf8'));

function fileOf(entry) {
  const u = entry.filePage ?? entry.thumb ?? '';
  const seg = decodeURIComponent(String(u).split('/File:')[1] ?? String(u).split('/').pop() ?? '');
  return seg.replace(/\/\$$/, '').replace(/\.(jpe?g|png|webp|gif|svg)(\.[a-z]+)?$/i, ' ').replace(/_/g, ' ');
}

const report = { subject: [], related: [], dropped: [], skipped: [] };

for (const [key, entry] of Object.entries(media)) {
  /* Files in en.wikipedia's own namespace are fair-use logos, not free
     photographs — they block hotlinking, so they can never be site imagery. */
  if (/wikimedia\.org\/wikipedia\/en\//.test(`${entry.thumb}${entry.wide}`)) {
    report.dropped.push(`${key}  <- fair-use logo hosted on en.wikipedia, not hotlinkable`);
    if (apply) delete media[key];
    continue;
  }
  if (key.startsWith('banner-') || key.startsWith('hero-')) {
    entry.kind = 'related';
    report.related.push(`${key}  [category banner]  via ${entry.via}`);
    continue;
  }
  const label = names.get(key) ?? names.get(key.replace(/-2026$/, '')) ?? null;
  if (!label) {
    entry.kind = entry.kind ?? 'subject';
    report.skipped.push(`${key} (no record name, left as ${entry.kind})`);
    continue;
  }
  const evidence = `${fileOf(entry)} ${entry.via ?? ''}`;
  const nl = norm(label);
  const words = nl.split(' ').filter((w) => w.length > 3 && !GENERIC.has(w));
  const hits = words.filter((w) => norm(evidence).includes(w));
  const sameSubject = hits.length >= 2 || (hits.length >= 1 && words.length === hits.length) || norm(evidence).includes(nl);
  const local = LOCAL.test(evidence);
  const dish = DISH.test(evidence);

  if (sameSubject) {
    entry.kind = 'subject';
    report.subject.push(`${key}  "${label}"  <- ${fileOf(entry).slice(0, 48)}`);
  } else if (local) {
    entry.kind = 'related';
    report.related.push(`${key}  "${label}"  <- ${fileOf(entry).slice(0, 48)}  (Karachi photo of ${entry.via})`);
  } else if (dish) {
    entry.kind = 'related';
    report.related.push(`${key}  "${label}"  <- ${fileOf(entry).slice(0, 48)}  (dish photo)`);
  } else {
    report.dropped.push(`${key}  "${label}"  <- ${fileOf(entry).slice(0, 58)}  via ${entry.via}`);
    if (apply) delete media[key];
  }
}

const line = (a) => console.log(a);
line(`subject ${report.subject.length}  related ${report.related.length}  dropped ${report.dropped.length}  skipped ${report.skipped.length}`);
if (apply) fs.writeFileSync(MEDIA, `${JSON.stringify(media, null, 2)}\n`);
fs.writeFileSync(path.join(ROOT, '.tools/classify-report.txt'), `${JSON.stringify(report, null, 2)}\n`);
line('\n--- DROPPED (no Karachi photo found; designed placeholder will render) ---');
for (const d of report.dropped) line(`  ${d}`);
line('\n--- RELATED (illustrative, labelled in the UI) ---');
for (const r of report.related) line(`  ${r}`);
