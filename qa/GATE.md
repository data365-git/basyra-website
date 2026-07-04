# QA Gate — Mobile Optimization (Phase 0 baseline)

Captured 2026-07-04 on branch `mobile-optimization` at commit `4b4fd82`, Chromium 149
(Playwright 1.61.1), Windows 11. Site served locally; page requires React 18 + Babel
from unpkg.com to render.

## How to run

```bash
# 1. Static server (working dir = repo root), leave running:
python -m http.server 4601

# 2. From qa/ — capture desktop screenshots:
node capture.mjs --set desktop --out baselines        # baselines (already captured; do NOT overwrite mid-phase)
node capture.mjs --set desktop --out runs/<batch>     # a batch run

# 3. Diff a batch against baselines (pixelmatch threshold 0.1):
node diff.mjs --a baselines --b runs/<batch> --max 0

# 4. Mobile overflow gate (320/360/390/412/430):
node check-overflow.mjs

# Mobile "before" documentation shots (already captured):
node capture.mjs --set mobile-before --out baselines
```

## Flake floor / maxDiffPixels

**maxDiffPixels = 0** at all four desktop widths (1280 / 1440 / 1672 / 1920).

Verified across 3 identical capture runs: 0 diff pixels at every width, and full-page
dimensions were byte-identical between runs (1280x8686, 1440x9774, 1672x11349,
1920x13032 CSS px — heights differ per width because of the JS `transform: scale()`
on `#bn-page`, scale = viewportWidth / 1672; that is expected).

Known non-determinism, handled in the harness: `index.html` re-applies the
`.ar-selected` highlight on the Ariza "Tadbirkor" role chip in a `setTimeout(500)`
(index.html:1982) that races the React runtime's re-render, so the chip's highlight
was flaky (~1154 px at 1280 before normalization). `capture.mjs` re-runs the page's
own highlight logic before every screenshot, so captures are deterministic. Do not
remove that normalization step; if the underlying race is ever fixed in index.html,
re-baseline.

`diff.mjs` exits 1 and prints a loud `DIMENSION MISMATCH` banner if full-page height
differs between runs — that means non-deterministic rendering; investigate settle
logic before accepting any baseline or batch result.

## Lighthouse mobile baseline ("before")

Command (Lighthouse 13.4.0; `--emulated-form-factor` no longer exists — default config
is mobile emulation + simulated throttling):

```bash
npx lighthouse http://localhost:4601/index.html --preset=perf --form-factor=mobile \
  --max-wait-for-load=120000 --output=json \
  --output-path=baselines/lighthouse-before.json --chrome-flags="--headless=new"
```

Saved report: `baselines/lighthouse-before.json`.

| Metric | Run 1 (saved baseline) | Run 2 (stability check) |
|---|---|---|
| Performance score | **0.39** | 0.59 |
| LCP | **33.6 s** | 2.4 s |
| CLS | **0.026** | 0.001 |
| TBT | **1471 ms** | 2334 ms |
| Total byte weight | **22,490,029 B (~22.5 MB)** | 22,481,164 B |

Caveats (record-keeping, applies to any "after" comparison):
- LCP/score are highly unstable run-to-run because the page paints nothing until
  React + Babel arrive from unpkg (CDN latency dominates under simulated throttle).
  Treat score/LCP as directional; **total byte weight (~22.5 MB) is the stable
  "before" number** and the primary regression/improvement metric.
- Both runs warn "The page loaded too slowly to finish within the time limit" —
  results may be incomplete even at 120 s max wait.
- A chrome-launcher `EPERM ... Temp\lighthouse.*` error prints at the end of every
  run on this machine — temp-profile cleanup only, the report is still written.

## Per-batch gate procedure

For every change batch during mobile optimization:

1. **Capture**: `node capture.mjs --set desktop --out runs/<batch>`
2. **Diff**: `node diff.mjs --a baselines --b runs/<batch> --max 0`
   Must report **0 diff pixels at all 4 desktop widths** (the flake floor). Any
   dimension mismatch or nonzero diff = batch fails; the desktop layout regressed.
3. **Mobile overflow**: `node check-overflow.mjs` — asserts at 320/360/390/412/430:

   ```js
   document.getElementById('bn-fit').scrollWidth <= window.innerWidth
     && document.documentElement.scrollWidth <= window.innerWidth
   ```

   Phase 0 status: **FAILS at every width** — `#bn-fit.scrollWidth` is 1672 at all
   mobile widths (the fixed-width desktop layout scaled down by transform). That is
   the bug being fixed; this gate flips to required-PASS once the mobile layout work
   lands. `check-overflow.mjs` also fails the gate on any console error / pageerror.

## Baseline inventory

- `baselines/desktop-1280.png`, `desktop-1440.png`, `desktop-1672.png`, `desktop-1920.png`
- `baselines/mobile-before-390.png`, `mobile-before-360.png` (documentation of the
  pre-fix scaled-down mobile rendering — will look tiny; expected)
- `baselines/lighthouse-before.json`

## Known pre-existing page issues (NOT introduced by QA setup)

- `assets/images/nimani-bg.png` 404s on every load (section background at
  index.html:1323, referenced but absent). Surfaces as a console error in
  `check-overflow.mjs`. If the file is ever added, desktop baselines MUST be
  re-captured (it paints the "Nimani o'rganasiz" section background).
- `assets/images/natija-mobile.png` was also missing during initial capture but
  appeared mid-Phase-0 (concurrent asset work also added `assets/images/mobile/*.webp`
  and `og-image.webp`). It only renders at ≤768px (index.html:1506-1509), so desktop
  baselines were unaffected; the mobile before-shots were re-captured after it
  appeared and are accurate. The `mobile/*.webp` and `og-image.webp` files are not
  referenced by the current index.html and have no render impact yet.
- Baselines are only valid for commit `4b4fd82` + the asset state above. If
  index.html or referenced assets change outside a gated batch, re-baseline.
