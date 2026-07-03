// Un-bundles a "__bundler/manifest"+"__bundler/template" single-file HTML export
// into a normal static project (index.html + assets/ + js/).
// Usage: node tools/extract-bundle.mjs --src "Bundled Page.html" --out out/bundled
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((a, v, i, arr) =>
    v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a, [])
);
const SRC = args.src, OUT = args.out;
if (!SRC || !OUT) throw new Error('need --src and --out');

const html = readFileSync(SRC, 'utf8');
const grab = (type) => {
  const m = html.match(new RegExp(`<script type="__bundler/${type}">([\\s\\S]*?)<\\/script>`));
  if (!m) throw new Error('missing __bundler/' + type);
  return m[1];
};
const manifest = JSON.parse(grab('manifest'));
let template = JSON.parse(grab('template')); // JSON string -> real HTML

const EXT = { 'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/svg+xml':'svg',
  'font/woff2':'woff2','font/woff':'woff','text/javascript':'js','application/javascript':'js','text/css':'css' };
const DIR = { image:'assets/images', font:'assets/fonts', 'text/javascript':'js',
  'application/javascript':'js', 'text/css':'css' };
const dirFor = (mime) => DIR[mime] || DIR[mime.split('/')[0]] || 'assets/misc';

const write = (rel, buf) => { const p = join(OUT, rel); mkdirSync(dirname(p), {recursive:true}); writeFileSync(p, buf); };

const map = {};
for (const [uuid, a] of Object.entries(manifest)) {
  let raw = a.data;
  // handle data: URIs and raw base64
  if (typeof raw === 'string' && raw.startsWith('data:')) raw = raw.split(',')[1];
  let buf = Buffer.from(raw, 'base64');
  if (a.compressed) buf = gunzipSync(buf);
  const ext = EXT[a.mime] || 'bin';
  const rel = `${dirFor(a.mime)}/${uuid}.${ext}`;
  write(rel, buf);
  map[uuid] = rel;
}

// Rewrite UUID references -> real relative paths, in the HTML...
for (const [uuid, rel] of Object.entries(map)) template = template.split(uuid).join(rel);
// ...and inside every extracted JS/CSS asset (they may reference other assets by UUID).
for (const [uuid, rel] of Object.entries(map)) {
  if (!/\.(js|css)$/.test(rel)) continue;
  const p = join(OUT, rel);
  let s = readFileSync(p, 'utf8');
  for (const [u2, r2] of Object.entries(map)) s = s.split(u2).join(r2);
  writeFileSync(p, s);
}

writeFileSync(join(OUT, 'index.html'), template);
console.log(`Extracted ${Object.keys(map).length} assets -> ${OUT}/index.html`);
