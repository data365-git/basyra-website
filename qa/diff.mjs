// Pixel-diff two capture directories (pixelmatch, threshold 0.1).
// Usage:
//   node diff.mjs --a baselines --b runs/<name> [--max <allowedDiffPixels>]
// Compares every desktop-<width>.png present in BOTH dirs (plus any identically
// named png pair). Writes <name>.diff.png next to dir B when pixels differ.
// Exit code 1 if any pair has mismatched dimensions, or exceeds --max (when given).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const QA_DIR = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const argVal = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};

const dirA = path.resolve(QA_DIR, argVal('--a', 'baselines'));
const dirB = path.resolve(QA_DIR, argVal('--b', 'runs/latest'));
const maxArg = argVal('--max', null);
const maxDiffPixels = maxArg === null ? null : Number(maxArg);

for (const d of [dirA, dirB]) {
  if (!fs.existsSync(d)) {
    console.error(`Directory not found: ${d}`);
    process.exit(2);
  }
}

const pngsIn = (d) =>
  fs.readdirSync(d).filter((f) => f.endsWith('.png') && !f.endsWith('.diff.png'));
const names = pngsIn(dirA).filter((f) => pngsIn(dirB).includes(f));
if (names.length === 0) {
  console.error('No common .png filenames between the two directories.');
  process.exit(2);
}

let dimensionMismatch = false;
let worst = { name: null, pixels: -1 };
let exceeded = false;

for (const name of names) {
  const a = PNG.sync.read(fs.readFileSync(path.join(dirA, name)));
  const b = PNG.sync.read(fs.readFileSync(path.join(dirB, name)));

  if (a.width !== b.width || a.height !== b.height) {
    dimensionMismatch = true;
    console.error(
      `!!! DIMENSION MISMATCH ${name}: A=${a.width}x${a.height} B=${b.width}x${b.height}\n` +
        `!!! Full-page height differs between runs — the page is NOT rendering deterministically.\n` +
        `!!! Investigate settle logic (increase delay / check lazy content) before accepting a baseline.`
    );
    continue;
  }

  const diff = new PNG({ width: a.width, height: a.height });
  const pixels = pixelmatch(a.data, b.data, diff.data, a.width, a.height, {
    threshold: 0.1,
  });
  const total = a.width * a.height;
  const pct = ((pixels / total) * 100).toFixed(4);
  console.log(`${name}: ${pixels} diff pixels (${pct}% of ${a.width}x${a.height})`);

  if (pixels > worst.pixels) worst = { name, pixels };
  if (pixels > 0) {
    const diffPath = path.join(dirB, name.replace(/\.png$/, '.diff.png'));
    fs.writeFileSync(diffPath, PNG.sync.write(diff));
    console.log(`  diff image: ${diffPath}`);
  }
  if (maxDiffPixels !== null && pixels > maxDiffPixels) {
    exceeded = true;
    console.error(`  EXCEEDS allowed maxDiffPixels=${maxDiffPixels}`);
  }
}

if (worst.name !== null) {
  console.log(`\nmax diff pixel count: ${worst.pixels} (${worst.name})`);
}
if (dimensionMismatch) process.exit(1);
if (exceeded) process.exit(1);
