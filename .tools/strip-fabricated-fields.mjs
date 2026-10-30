#!/usr/bin/env node
// Removes the two fabricated fields (rating, reviewCount) from the demo seed
// objects in src/data/listings. Idempotent: run again to confirm zero left.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'src/data/listings';
const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && f !== 'index.ts');
const FIELD = /^(\s*)(rating|reviewCount):\s*[0-9.]+,\s*$/;

let total = 0;
for (const file of files) {
  const path = join(dir, file);
  const src = readFileSync(path, 'utf8');
  const kept = src.split('\n').filter((line) => !FIELD.test(line));
  const removed = src.split('\n').length - kept.length;
  if (removed > 0) {
    writeFileSync(path, kept.join('\n'));
    total += removed;
    console.log(`${file}: removed ${removed} fabricated line(s)`);
  } else {
    console.log(`${file}: clean`);
  }
}
console.log(`\ntotal removed: ${total}`);
