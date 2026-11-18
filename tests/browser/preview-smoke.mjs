import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Exercise the real Fern preview rather than the offline routing fixture.
const base = new URL(process.argv[2] || 'http://127.0.0.1:3010');
assert.ok(base.origin === 'https://docs.6mm.com' ||
  (base.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(base.hostname)),
  'Use the public docs or a local Fern preview');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
  const route = '/developer-api/rest-api/order';
  const response = await page.goto(new URL(`/zh-CN${route}?source=preview-smoke`, base).href);
  assert.equal(response?.status(), 200);
  await page.waitForFunction(() => typeof window.__sixmmNavigateDocsLocale === 'function');
  const article = page.locator('main article').first();
  await article.waitFor();
  const title = page.locator('main h1').first();
  const chinese = await title.textContent();

  await page.mouse.move(700, 420);
  await page.mouse.wheel(0, 800);
  await page.waitForFunction(() => scrollY > 500);

  const section = page.locator('#fern-toc a[href^="#"]').nth(1);
  const anchor = decodeURIComponent((await section.getAttribute('href')).slice(1));
  await section.click();
  await page.waitForFunction(anchor => decodeURIComponent(location.hash.slice(1)) === anchor, anchor);
  await page.waitForFunction(anchor => {
    const heading = document.getElementById(anchor);
    return heading && Math.abs(heading.getBoundingClientRect().top) < innerHeight / 2;
  }, anchor);
  assert.ok(await page.evaluate(() => scrollY) > 0);
  const canonical = await page.evaluate(anchor => {
    const target = document.getElementById(anchor);
    return target.dataset.sixmmAnchorTarget || target.dataset.sixmmCanonicalAnchor ||
      target.previousElementSibling?.dataset.sixmmCanonicalAnchor || anchor;
  }, anchor);

  const previousTheme = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  await page.locator('.sixmm-theme-trigger:visible').first().click();
  await page.waitForFunction(previous => document.documentElement.classList.contains('dark') !== previous, previousTheme);

  // Local Fern preview can use a full navigation instead of a client swap.
  const navigated = page.waitForURL(url => url.pathname.replace(/\/$/, '') === `/ja${route}`, { waitUntil: 'commit' });
  await Promise.all([
    navigated,
    page.evaluate(() => { void window.__sixmmNavigateDocsLocale('ja'); }).catch(error => {
      if (!error.message.includes('Execution context was destroyed')) throw error;
    }),
  ]).catch(error => { throw new Error(`Locale navigation ended at ${page.url()}`, { cause: error }); });
  await page.waitForFunction(() => document.documentElement.lang === 'ja');
  const localized = new URL(page.url());
  assert.equal(localized.pathname.replace(/\/$/, ''), `/ja${route}`);
  assert.equal(localized.search, '?source=preview-smoke');
  assert.equal(decodeURIComponent(localized.hash.slice(1)), canonical, 'Keep the selected chapter');
  assert.notEqual(await title.textContent(), chinese);
  console.log(`Fern renderer smoke passed: ${base.origin}, long-page wheel, TOC jump, theme, locale, query and chapter preserved.`);
} finally {
  await browser.close();
}
