# Optimize & Deploy Plan — Basyra Landing → Vercel

🤖 Build on: **sonnet** · reasoning: **high** — image pipeline + loader patch need judgment & careful verification; nothing here is money/auth but visual-fidelity risk is real.

## Goal
Take the 41.5 MB single-file standalone HTML → fast static site on Vercel, **no perceptible quality loss**, no change to copy/titles/design/chat widget.

## Verified facts (from research + file analysis + bundler inspection)
- 41.5 MB file = 99.7% manifest (base64 assets). 62 assets.
- **25 PNGs = 29.4 MB (71%)** ← the entire problem. 1 JPEG 0.8 MB. 34 woff2 = 0.8 MB. 2 identical JS.
- base64 tax = 10.25 MB (24.7%).
- Dead asset `283c9302` (2.46 MB PNG, **0 references**) → free delete. 2 JS blobs identical → dedupe.
- Loader = inline `<script>` in `<head>`; `atob(entry.data)` → Blob → `URL.createObjectURL`; `template.split(uuid).join(blobUrl)`. **Unconditional base64 decode** → approach B1 (URL in manifest) impossible without patching loader.
- Chat mascot uses React-bound `onclick="{{ onToggle }}"` inside `x-dc` component → runtime must stay alive.
- Oversized offenders (downscale to ~2× display box before encode): portrait `4e32a76d` 1122×1402→~1200w; JPEG `a1b2c3d4` 1500×2100 shown ~200px→~460w; logo `c29c734a` 4471×1071 shown 46px tall→~400w; magnifier `d8e65ec8`→~500w; folder `138baa25`/`ef5b4cc1`→~1200w; mascot `882867af`→~260w. Four 1672×941 full-bleed backgrounds → keep ~1672w, rely on WebP/AVIF.
- Fonts: keep **latin + latin-ext** per family (Uzbek ʻ = U+02BB is in latin-ext); drop cyrillic/greek/vietnamese → ~0.4 MB floor.
- Tooling: pin `/Library/Developer/CommandLineTools/usr/bin/python3` (Pillow 11.3, WebP+AVIF encode confirmed). Node 22 present (sharp fallback). No cwebp/avifenc installed.
- 14/24 imgs already `loading="lazy"`; 0 preloads.

## Chosen approach: **B2-lite** (externalize assets + 3-line loader patch, keep JS runtime)
- Externalize 59 image/font assets → hashed files under `dist/assets/`; strip their base64 from manifest.
- Patch loader: for `image/*` & `font/*` UUIDs, resolve to `assets/<file>` and `continue` (skip atob); JS assets still decode from base64 → chat widget/nav/theme byte-identical.
- Images reference `.webp` (95%+ support); preload the LCP hero portrait. AVIF `<picture>` = optional stretch.
- **Why not full B2 (hand-rebuild DOM):** too risky with `x-dc` components. **Why not A (base64-in-place):** stays one uncacheable file, no lazy/preload — doesn't deliver "fast on Vercel." A is the fallback if render-diff fails.

## Steps (cheap → safe → impactful)
0. **Backup** → `cp "...standalone.html" "99-archive/pre-optimize <ts>.html.bak"`. Verify size 43,487,595.
1. **Pin Python** + confirm WebP/AVIF encode on a test image.
2. **Prune dead/dup** — delete `283c9302` (0 refs) + orphan JS. Assert `template.count(uuid)==0` before delete. −2.5 MB.
3. **Font subset** — drop cyrillic/greek/vietnamese `@font-face` + their woff2 UUIDs; keep latin+latin-ext. Assert every kept family still has ≥1 face; verify ʻ renders. 0.8→0.4 MB.
4. **Image pipeline** — per raster: decode → downscale to caps above (LANCZOS, preserve alpha) → encode **WebP q80 method6** (+ AVIF q~64 speed4). 31.6 MB → ~3 MB.
5. **A/B quality gate (BEFORE global commit)** ⚠️ — hero portrait + one bg + the JPEG at q78/80/85; require **SSIM ≥ 0.995** + 100%-zoom eyeball (no banding in amber gradients/skin). Pick lowest passing q.
6. **Emit hashed files** → `dist/assets/<uuid8>-<hash8>.{webp,avif,woff2}`.
7. **Build flattened HTML** ⚠️ (highest risk) — strip image/font base64 from manifest (keep 1 JS blob); add `file` field per asset; 3-line loader patch; preload LCP hero; keep `</`→`/` escaping + json round-trip. Byte-diff chat/`x-dc` regions vs source. 41.5 MB inline → ~0.2 MB.
8. **vercel.json** (below).
9. **Render-diff verify** ⚠️ — serve `dist/`, screenshot-diff hero/portrait/before-after/metodika/nav/chat-open vs original. Zero perceptible diff; chat opens+themes; console clean.
10. **Weight/LCP check** — above-fold ≤ ~2 MB, hero preloaded, no 41 MB blob.
11. **(Stretch) AVIF `<picture>`** for top-5 images only if 9–10 clean.
12. **Deploy** — `cd dist && vercel deploy --prod` (or Git→Vercel, preset "Other"). Re-verify + `curl -sI` cache headers/brotli on prod.

## vercel.json
```json
{
  "headers": [
    { "source": "/assets/(.*)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] },
    { "source": "/index.html", "headers": [{ "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }] },
    { "source": "/", "headers": [{ "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }] }
  ]
}
```

## Rollback
Restore monolith from `99-archive/pre-optimize <ts>.html.bak` (renders standalone, zero deps). On Vercel `vercel rollback`. Hashed assets = a bad re-encode never poisons a cached good one.

## Expected outcome
41.5 MB → **~0.2 MB HTML + ~3 MB WebP (~2 MB AVIF) + ~0.4 MB fonts**, CDN-cacheable, ~1–2 MB above the fold, pixel-faithful, chat/nav/theme intact.

## Output files to create
- `04-build/dist/index.html` · `04-build/dist/vercel.json` · `04-build/dist/assets/` (hashed webp/avif/woff2)
