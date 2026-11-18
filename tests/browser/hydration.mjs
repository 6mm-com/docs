import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const guard = await readFile(new URL('../../fern/safari-hydration.js', import.meta.url), 'utf8');
const origin = 'https://hydration-regression.test';

// Use native custom elements and ES modules; only the Astro island API is simulated.
export async function verifyNativeHydration(browser, { registration, safari }) {
  const page = await browser.newPage();
  const errors = [];
  const requests = [];
  const unexpectedRequests = [];
  page.setDefaultTimeout(10_000);
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    requests.push(url.pathname);
    if (url.origin !== origin) {
      unexpectedRequests.push(url.href);
      return route.abort();
    }
    if (url.pathname === '/renderer.mjs') return route.fulfill({
      contentType: 'text/javascript',
      body: `window.trace.push('renderer:start');
        await new Promise(resolve => { window.releaseRenderer = resolve; });
        window.trace.push('renderer:ready');
        export default function hydrate(island) {
          island.removeAttribute('ssr');
          island.setAttribute('data-fern-hydrated', '');
          window.trace.push('hydrated:' + island.id);
          document.dispatchEvent(new Event('fern:island-hydrated'));
        }`,
    });
    if (url.pathname === '/component.mjs') return route.fulfill({
      contentType: 'text/javascript',
      body: `window.trace.push('component:ready'); export default function Component() {}`,
    });
    return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' });
  });
  try {
    await page.goto(origin);
    await page.evaluate(() => {
      window.trace = [];
      window.originalDefine = customElements.define;
      window.TestIsland = class extends HTMLElement {
        importWithRetry(url) { return import(url); }
        async start() {
          trace.push('start:' + this.id);
          const [component, renderer] = await Promise.all([
            this.importWithRetry(this.getAttribute('component-url')),
            this.importWithRetry(this.getAttribute('renderer-url')),
          ]);
          this.Component = component.default;
          this.hydrator = renderer.default;
          this.hydrator(this);
        }
        connectedCallback() { this.start(); }
      };
      window.originalStart = TestIsland.prototype.start;
    });
    const defineIsland = () => page.evaluate(() => customElements.define('astro-island', TestIsland));
    if (registration === 'before') await defineIsland();
    await page.addScriptTag({ content: guard });
    if (registration === 'after') await defineIsland();
    await page.evaluate(() => {
      for (const id of ['first', 'second']) {
        const island = document.createElement('astro-island');
        island.id = id;
        island.setAttribute('ssr', '');
        island.setAttribute('renderer-url', '/renderer.mjs');
        island.setAttribute('component-url', '/component.mjs');
        document.body.appendChild(island);
      }
    });
    await page.waitForFunction(() => typeof window.releaseRenderer === 'function');
    assert.equal(await page.locator('astro-island[data-fern-hydrated]').count(), 0);
    if (safari) assert.deepEqual(await page.evaluate(() => trace), ['renderer:start']);
    await page.evaluate(() => window.releaseRenderer());
    await page.waitForFunction(() => document.querySelectorAll('astro-island[data-fern-hydrated]').length === 2);
    const result = await page.evaluate(() => ({
      trace,
      defineRestored: customElements.define === originalDefine,
      startPatched: TestIsland.prototype.start !== originalStart,
      guardActive: window.__sixmmSafariHydrationGuard === true,
    }));
    assert.deepEqual(errors, []);
    assert.deepEqual(unexpectedRequests, []);
    assert.equal(requests.filter(url => url === '/renderer.mjs').length, 1);
    assert.equal(result.trace.filter(event => event === 'renderer:ready').length, 1);
    // WebKit can request the component twice while evaluating its module only once.
    assert.equal(result.trace.filter(event => event === 'component:ready').length, 1);
    assert.equal(result.defineRestored, true);
    assert.equal(result.startPatched, safari);
    assert.equal(result.guardActive, safari);
    if (safari) {
      for (const event of ['start:first', 'start:second', 'component:ready']) {
        assert.ok(result.trace.indexOf('renderer:ready') < result.trace.indexOf(event));
      }
    }
  } finally {
    await page.close();
  }
}
