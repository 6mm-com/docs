import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Cold desktop loads of the public site; kept out of offline CI and regression.
const origin = 'https://docs.6mm.com';
const useWidgetHint = process.argv.includes('--widget-preconnect');
const paths = process.argv.slice(2).filter(arg => arg !== '--widget-preconnect');
if (!paths.length) paths.push('/zh-CN/', '/zh-CN/developer-api/rest-api/order');
const browser = await chromium.launch();
try {
  console.log(`Chromium ${browser.version()}, cold browser cache`);
  for (const path of paths) {
    const url = new URL(path, origin);
    assert.equal(url.origin, origin, 'Use a public docs path');
    const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
    try {
      if (useWidgetHint) await page.addInitScript(() => {
        if (window !== window.top) return;
        function hint() {
          if (!document.head) return;
          observer.disconnect();
          const link = document.createElement('link');
          link.rel = 'preconnect';
          link.href = 'https://cs.6mm.com';
          document.head.appendChild(link);
        }
        const observer = new MutationObserver(hint);
        observer.observe(document, { childList: true, subtree: true });
        hint();
      });
      const session = await page.context().newCDPSession(page);
      const requests = new Map();
      session.on('Network.requestWillBeSent', event => {
        const { requestId, request, initiator, type } = event;
        if (!/^https?:/.test(request.url)) return;
        requests.set(requestId, { url: request.url, type, initiator: initiator.stack?.callFrames[0]?.url || initiator.type });
      });
      session.on('Network.loadingFinished', ({ requestId, encodedDataLength }) => {
        const request = requests.get(requestId);
        if (request) request.bytes = encodedDataLength;
      });
      session.on('Network.responseReceived', ({ requestId, response }) => {
        const request = requests.get(requestId);
        if (new URL(response.url).pathname !== '/widget/widget.js' || !request) return;
        const timing = response.timing;
        request.widgetTiming = {
          reused: response.connectionReused,
          connectMs: timing?.connectStart >= 0 ? Math.round(timing.connectEnd - timing.connectStart) : 0,
          headersMs: Math.round(timing?.receiveHeadersEnd || 0),
        };
      });
      await session.send('Network.enable');
      await session.send('Network.setCacheDisabled', { cacheDisabled: true });
      const response = await page.goto(url.href, { waitUntil: 'load' });
      assert.equal(response?.status(), 200);
      await page.evaluate(async () => {
        for (let i = 0; i < 90; i++) await new Promise(requestAnimationFrame);
      });
      const navigation = await page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0];
        return {
          responseMs: Math.round(nav.responseStart), loadMs: Math.round(nav.loadEventEnd),
          fcpMs: Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0),
          eagerLinks: [...document.querySelectorAll('a[data-astro-prefetch="load"], a[data-astro-prefetch="viewport"]')]
            .map(link => link.pathname).slice(0, 10),
        };
      });
      const bytes = {}, summarize = ({ url, type, initiator, bytes }) => ({
        path: new URL(url).pathname, type, via: initiator.startsWith('https://') ? new URL(initiator).pathname : initiator, bytes,
      });
      for (const request of requests.values()) {
        const host = new URL(request.url).hostname;
        const key = `${host} ${request.type}`;
        bytes[key] = (bytes[key] || 0) + (request.bytes || 0);
      }
      const completed = [...requests.values()].filter(request => request.bytes > 0);
      console.log(path, JSON.stringify(navigation));
      console.log('transfer bytes:', JSON.stringify(bytes));
      const widget = completed.find(request => request.widgetTiming);
      if (widget) console.log(useWidgetHint ? 'widget (preconnect):' : 'widget:', JSON.stringify(widget.widgetTiming));
      console.log('largest:', JSON.stringify(completed.sort((a, b) => b.bytes - a.bytes).slice(0, 8).map(summarize)));
      const htmlFetches = completed.filter(request => {
        const resource = new URL(request.url);
        return resource.origin === origin && ['Fetch', 'Other'].includes(request.type) &&
          !/^\/(?:_astro|_fern-files|api)\b/.test(resource.pathname);
      }).map(summarize);
      console.log('same-origin HTML fetches:', JSON.stringify(htmlFetches));
      if (htmlFetches.length) {
        const links = await page.evaluate(({ html, paths }) => {
          const source = new DOMParser().parseFromString(html, 'text/html');
          return [...source.querySelectorAll('a[href]')].filter(link =>
            paths.includes(new URL(link.getAttribute('href'), location.href).pathname)).map(link => ({
            href: link.getAttribute('href'), prefetch: link.getAttribute('data-astro-prefetch'),
            area: ['#fern-sidebar-static', 'article', 'nav'].find(selector => link.closest(selector)),
            island: link.closest('astro-island')?.getAttribute('component-url'),
            card: link.classList.contains('fern-card'),
          }));
        }, { html: await response.text(), paths: htmlFetches.map(request => request.path) });
        console.log('server-rendered links:', JSON.stringify(links));
      }
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
