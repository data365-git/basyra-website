// Batch 1 functional gate — mobile scaler neutralization.
// Usage: node check-batch1.mjs [--url <pageUrl>]
// Asserts at 390x844 (mobile emulation):
//   (a) computed style of #bn-page has transform: none (scaler neutralized)
//   (b) no unexpected console errors during load (known pre-existing
//       assets/images/nimani-bg.png 404 — see qa/GATE.md — is allowlisted)
//   (c) clicking a [data-nav-target] anchor link scrolls the page and lands
//       the target section's top near the viewport top
// Exit code 1 on any failure.

import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const argVal = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const URL = argVal('--url', 'http://localhost:4601/index.html');

// Known pre-existing issue (qa/GATE.md "Known pre-existing page issues"):
// assets/images/nimani-bg.png is referenced but absent — 404s on every load,
// independent of this batch's change. Not introduced by, or fixable within,
// Batch 1.
const KNOWN_ERROR_SUBSTRINGS = ['nimani-bg.png'];

let anyFail = false;
const fail = (msg) => {
  anyFail = true;
  console.error(`FAIL: ${msg}`);
};
const pass = (msg) => console.log(`PASS: ${msg}`);

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();

const consoleErrors = [];
const failedRequests = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));
page.on('response', (r) => {
  if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url()}`);
});

try {
  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
  try {
    await page.waitForFunction(() => !!window.React, null, { timeout: 45000 });
  } catch {
    throw new Error('window.React never appeared — unpkg.com likely unreachable; page is blank.');
  }
  await page.locator('#bn-hero').waitFor({ state: 'visible', timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle', { timeout: 60000 });
  await page.waitForTimeout(1500);

  // (a) scaler neutralized
  const transform = await page.evaluate(() => {
    const el = document.getElementById('bn-page');
    return el ? getComputedStyle(el).transform : null;
  });
  if (transform === 'none') {
    pass(`#bn-page computed transform is 'none' (got "${transform}")`);
  } else {
    fail(`#bn-page computed transform expected 'none', got "${transform}"`);
  }

  // (b) no unexpected console errors during load.
  // console.error text for a failed resource load is a generic "Failed to
  // load resource" string (no URL), so cross-check against the response log
  // (which does have URLs) to allowlist the known pre-existing 404.
  const unexpectedFailedRequests = failedRequests.filter(
    (r) => !KNOWN_ERROR_SUBSTRINGS.some((s) => r.includes(s))
  );
  const nonResourceConsoleErrors = consoleErrors.filter(
    (e) => !e.includes('Failed to load resource')
  );

  if (nonResourceConsoleErrors.length === 0 && unexpectedFailedRequests.length === 0) {
    pass(
      `no unexpected console errors ` +
        `(${consoleErrors.length} total console error(s), all explained by known pre-existing 404s: ${failedRequests.join(', ') || 'none'})`
    );
  } else {
    fail(
      `unexpected console errors/requests — ` +
        `console: ${JSON.stringify(trulyUnexpectedConsoleErrors)}; ` +
        `failed requests: ${JSON.stringify(unexpectedFailedRequests)}`
    );
  }

  // (c) anchor nav click scrolls to target
  const scrollYBefore = await page.evaluate(() => window.scrollY);
  const clicked = await page.evaluate(() => {
    const link = document.querySelector('[data-nav-target="dastur"]');
    if (!link) return false;
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return true;
  });
  if (!clicked) fail('could not find [data-nav-target="dastur"] link to click');

  // Wait for the smooth-scroll to settle (poll until scrollY stops changing).
  let lastY = -1;
  let stableFor = 0;
  for (let i = 0; i < 40 && stableFor < 3; i++) {
    await page.waitForTimeout(150);
    const y = await page.evaluate(() => window.scrollY);
    if (y === lastY) stableFor++;
    else stableFor = 0;
    lastY = y;
  }

  const result = await page.evaluate(() => {
    const target = document.getElementById('dastur');
    return {
      scrollY: window.scrollY,
      targetTop: target ? target.getBoundingClientRect().top : null,
    };
  });

  if (result.scrollY !== scrollYBefore) {
    pass(`window.scrollY changed (${scrollYBefore} -> ${result.scrollY})`);
  } else {
    fail(`window.scrollY did not change after clicking nav link (stayed ${scrollYBefore})`);
  }

  const TOLERANCE_PX = 10;
  if (result.targetTop !== null && Math.abs(result.targetTop) <= TOLERANCE_PX) {
    pass(`#dastur boundingRect.top is near 0 (${result.targetTop.toFixed(1)}px, tolerance ${TOLERANCE_PX}px)`);
  } else {
    fail(`#dastur boundingRect.top expected within ${TOLERANCE_PX}px of 0, got ${result.targetTop}`);
  }
} catch (err) {
  fail(`unhandled error: ${err.message}`);
} finally {
  await context.close();
  await browser.close();
}

process.exit(anyFail ? 1 : 0);
