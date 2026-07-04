// Mobile horizontal-overflow gate.
// Opens the page at 320/360/390/412/430 CSS px widths and asserts:
//   document.getElementById('bn-fit').scrollWidth <= window.innerWidth
//   document.documentElement.scrollWidth        <= window.innerWidth
// Also reports any console errors / uncaught page errors.
// Usage: node check-overflow.mjs [--url <pageUrl>]
// Exit code 1 if any width fails or errors occur.

import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const argVal = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const URL = argVal('--url', 'http://localhost:4601/index.html');
const WIDTHS = [320, 360, 390, 412, 430];

const browser = await chromium.launch();
let anyFail = false;

for (const width of WIDTHS) {
  const context = await browser.newContext({
    viewport: { width, height: 800 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

  try {
    await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
    try {
      await page.waitForFunction(() => !!window.React, null, { timeout: 45000 });
    } catch {
      throw new Error(
        'window.React never appeared — unpkg.com likely unreachable; page is blank.'
      );
    }
    await page.locator('#bn-hero').waitFor({ state: 'visible', timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForLoadState('networkidle', { timeout: 60000 });
    await page.waitForTimeout(1500);

    const r = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      fitScrollWidth: document.getElementById('bn-fit')
        ? document.getElementById('bn-fit').scrollWidth
        : -1,
      docScrollWidth: document.documentElement.scrollWidth,
    }));
    const fitOk = r.fitScrollWidth !== -1 && r.fitScrollWidth <= r.innerWidth;
    const docOk = r.docScrollWidth <= r.innerWidth;
    const pass = fitOk && docOk;
    if (!pass) anyFail = true;

    console.log(
      `${width}px: ${pass ? 'PASS' : 'FAIL'}  ` +
        `#bn-fit.scrollWidth=${r.fitScrollWidth} (${fitOk ? 'ok' : 'OVERFLOW'})  ` +
        `doc.scrollWidth=${r.docScrollWidth} (${docOk ? 'ok' : 'OVERFLOW'})  ` +
        `innerWidth=${r.innerWidth}`
    );
  } catch (err) {
    anyFail = true;
    console.error(`${width}px: ERROR — ${err.message}`);
  }

  if (errors.length) {
    anyFail = true;
    for (const e of errors) console.error(`${width}px: ${e}`);
  }
  await context.close();
}

await browser.close();
process.exit(anyFail ? 1 : 0);
