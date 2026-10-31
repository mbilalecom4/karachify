#!/usr/bin/env node
// Removes the invented fields from the seed objects in src/data/listings:
//   rating / reviewCount — no rating source existed for any of them
//   priceRange           — the $ / $$ / $$$ bands were guesses, not tariffs
//   hours marked (demo)  — timings nobody checked, including the shared
//                          evening / allDay / parkHours / mallHours blocks
// Verified timings arrive from src/data/verified-overrides.json instead.
// Idempotent: run again and it reports every file clean.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'src/data/listings';
const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && f !== 'index.ts');
const DEMO = /\(demo[^)]*\)/;

let removed = 0;
for (const file of files) {
  const path = join(dir, file);
  const before = readFileSync(path, 'utf8');
  let text = before;

  // 1. invented scalars
  text = text.replace(/^[ \t]*(rating|reviewCount|priceRange):.*\n/gm, '');

  // 2. shared hour blocks that are nothing but guesses
  const dead = [];
  text = text.replace(/^const (\w+) = \[[^\]]*\];\n/gm, (block, name) => {
    const times = [...block.matchAll(/open: '([^']*)'/g)].map((m) => m[1]);
    if (times.length && times.every((t) => DEMO.test(t))) {
      dead.push(name);
      return '';
    }
    return block;
  });
  for (const name of dead) text = text.replace(new RegExp(`^[ \\t]*hours: ${name},\\n`, 'gm'), '');

  // 3. one-line hours arrays — keep the entries that are not labelled demo
  text = text.replace(/^([ \t]*)hours: \[[^\n]*\],\n/gm, (line, indent) => {
    const kept = [...line.matchAll(/\{[^{}]*\}/g)].map((m) => m[0]).filter((e) => !DEMO.test(e));
    return kept.length ? `${indent}hours: [${kept.join(', ')}],\n` : '';
  });

  // 4. multi-line hours arrays — drop the demo entries, then any empty block
  text = text.replace(/^[ \t]*\{[^{}]*\(demo[^{}]*\},?\n/gm, '');
  text = text.replace(/^[ \t]*hours: \[\n[ \t]*\],\n/gm, '');

  if (text !== before) {
    writeFileSync(path, text);
    const n = before.split('\n').length - text.split('\n').length;
    removed += n;
    console.log(`${file}: ${n} line(s) removed${dead.length ? ` (killed ${dead.join(', ')})` : ''}`);
  } else {
    console.log(`${file}: clean`);
  }
}
console.log(`\ntotal removed: ${removed}`);
