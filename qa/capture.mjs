// Screenshot capture for visual-regression QA.
// Usage:
//   node capture.mjs --set desktop --out baselines
//   node capture.mjs --set desktop --out runs/<name>
//   node capture.mjs --set mobile-before --out baselines
// Optional: --url <pageUrl>   (default http://localhost:4601/index.html)

import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const QA_DIR = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const argVal = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};

const OUT_DIR = path.resolve(QA_DIR, argVal('--out', 'runs/latest'));
const SET = argVal('--set', 'desktop');
const URL = argVal('--url', 'http://localhost:4601/index.html');

const SETS = {
  desktop: [1280, 1440, 1672, 1920].map((w) => ({
    name: `desktop-${w}`,
    contextOptions: { viewport: { width: w, height: 900 }, deviceScaleFactor: 1 },
  })),
  'mobile-before': [
    { w: 390, h: 844 },
    { w: 360, h: 800 },
  ].map(({ w, h }) => ({
    name: `mobile-before-${w}`,
    contextOptions: {
      viewport: { width: w, height: h },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    },
  })),
};

const profiles = SETS[SET];
if (!profiles) {
  console.error(`Unknown --set "${SET}". Available: ${Object.keys(SETS).join(', ')}`);
  process.exit(2);
}

const KILL_MOTION_CSS =
  '*,*::before,*::after{animation:none!important;transition:none!important}';

async function capture(browser, profile) {
  const context = await browser.newContext(profile.contextOptions);
  const page = await context.newPage();
  try {
    await page.goto(URL, { waitUntil: 'load', timeout: 60000 });

    // Freeze CSS motion before the React app renders (dc-runtime reveal animations).
    await page.addStyleTag({ content: KILL_MOTION_CSS });

    // The dc-runtime hides all content until React 18 + Babel arrive from unpkg.com.
    try {
      await page.waitForFunction(() => !!window.React, null, { timeout: 45000 });
    } catch {
      throw new Error(
        'window.React never appeared after 45s — unpkg.com (React/Babel CDN) is ' +
          'likely unreachable. Refusing to capture a blank page.'
      );
    }

    await page.locator('#bn-hero').waitFor({ state: 'visible', timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForLoadState('networkidle', { timeout: 60000 });

    // Scroll to the bottom in steps (fires lazy loads + reveal states), then back to top.
    await page.evaluate(async () => {
      const step = Math.max(200, window.innerHeight);
      for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
      window.scrollTo(0, document.documentElement.scrollHeight);
      await new Promise((r) => setTimeout(r, 250));
      window.scrollTo(0, 0);
    });
    await page.waitForLoadState('networkidle', { timeout: 60000 });

    // Fixed settle delay so late reveal/measure work is deterministic.
    await page.waitForTimeout(3000);

    // Normalize the Ariza role-chip highlight. index.html re-applies .ar-selected in a
    // setTimeout(500) that races the React runtime's re-render (unpkg latency dependent),
    // so the "Tadbirkor" chip is highlighted in some runs and not others. Re-run the
    // page's own logic so every capture shows the correct settled state.
    await page.evaluate(() => {
      const t = document.querySelector('#ariza-form input[value="Tadbirkor"]');
      if (t) t.checked = true;
      document.querySelectorAll('#ariza-form .ar-role').forEach((l) => {
        const inp = l.querySelector('input');
        l.classList.toggle('ar-selected', !!(inp && inp.checked));
      });
    });

    const file = path.join(OUT_DIR, `${profile.name}.png`);
    await page.screenshot({ path: file, fullPage: true, animations: 'disabled' });

    const dims = await page.evaluate(() => ({
      docScrollHeight: document.documentElement.scrollHeight,
      docScrollWidth: document.documentElement.scrollWidth,
    }));
    console.log(
      `captured ${profile.name}.png  (page ${dims.docScrollWidth}x${dims.docScrollHeight} CSS px)`
    );
  } finally {
    await context.close();
  }
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch();
let failed = false;
try {
  for (const profile of profiles) {
    try {
      await capture(browser, profile);
    } catch (err) {
      failed = true;
      console.error(`FAILED ${profile.name}: ${err.message}`);
    }
  }
} finally {
  await browser.close();
}
console.log(`output dir: ${OUT_DIR}`);
process.exit(failed ? 1 : 0);
