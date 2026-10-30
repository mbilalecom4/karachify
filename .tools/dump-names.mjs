/** Dumps every seeded record's slug -> display name for the other .tools scripts. */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const names = new Map();

function take(src, splitter) {
  for (const block of src.split(splitter).slice(1)) {
    const b = block.slice(0, 3000);
    const slug = b.match(/slug:\s*'([^']+)'/)?.[1];
    const name =
      b.match(/(?:^|\n)\s*(?:name|title):\s*'((?:[^'\\]|\\.)*)'/)?.[1]?.replace(/\\'/g, "'") ??
      b.match(/(?:^|\n)\s*(?:name|title):\s*"((?:[^"\\]|\\.)*)"/)?.[1];
    if (slug && name && !names.has(slug)) names.set(slug, name);
  }
}

const dir = path.join(ROOT, 'src/data/listings');
for (const f of fs.readdirSync(dir)) if (f.endsWith('.ts')) take(fs.readFileSync(path.join(dir, f), 'utf8'), /\n(?=\s*makeListing\()/g);
take(fs.readFileSync(path.join(ROOT, 'src/data/events.ts'), 'utf8'), /\n(?=\s*ev\(\{)/g);

fs.writeFileSync(path.join(ROOT, '.tools/pick-names.json'), JSON.stringify(Object.fromEntries(names), null, 2));
console.log(`named ${names.size} records`);
