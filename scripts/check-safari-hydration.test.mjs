import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const script = await readFile(new URL('../fern/safari-hydration.js', import.meta.url), 'utf8');
const safari = 'Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/26.6.2 Safari/605.1.15';
const chrome = 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/157.0.0.0 Safari/537.36';
const storageKey = 'sixmm:safari-hydration-reload';

function fixture({ ua = safari, storage = new Map(), storageBlocked = false } = {}) {
  let now = 1_000_000;
  let reloads = 0;
  let serial = 0;
  let queries = 0;
  const timers = new Map();
  const listeners = new Map();
  const nodes = [];
  const islands = [];
  const on = (name, fn) => listeners.set(name, [...(listeners.get(name) || []), fn]);
  function element() {
    return {
      isConnected: false, children: [], attributes: {}, handlers: {},
      setAttribute(name, value) { this.attributes[name] = value; },
      addEventListener(name, fn) { this.handlers[name] = fn; },
      appendChild(child) { this.children.push(child); child.isConnected = true; },
      remove() { this.isConnected = false; },
    };
  }
  const document = {
    readyState: 'complete', hidden: false, documentElement: { lang: 'en' },
    addEventListener: on,
    querySelectorAll(selector) {
      queries++;
      return islands.filter(i => i.isConnected && (selector === 'astro-island[ssr]' ? i.ssr : i.critical));
    },
    createElement: element,
    body: { appendChild(node) { nodes.push(node); node.isConnected = true; } },
  };
  const navigator = { userAgent: ua, onLine: true };
  const window = {
    location: { href: 'https://docs.6mm.com/zh-CN/sdk/overview?x=1#intro', reload() { reloads++; } },
    addEventListener: on,
    setTimeout(fn, delay) { const id = ++serial; timers.set(id, { fn, at: now + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    sessionStorage: {
      getItem(key) { if (storageBlocked) throw new Error('storage denied'); return storage.get(key) ?? null; },
      setItem(key, value) { if (storageBlocked) throw new Error('storage denied'); storage.set(key, value); },
    },
  };
  function addIsland({ critical = true, loaded = true, healthy = false, repair = false } = {}) {
    const island = {
      critical, isConnected: true, ssr: !healthy, ready: healthy,
      Component: loaded ? function Component() {} : undefined,
      hydrator: healthy ? function render() {} : undefined,
      starts: 0,
      hasAttribute(name) { return name === 'ssr' ? this.ssr : name === 'data-fern-hydrated' && this.ready; },
      getAttribute(name) { return name === 'renderer-url' ? '/_astro/client.js' : null; },
      start() {
        this.starts++;
        if (repair) { this.hydrator = () => {}; this.ssr = false; this.ready = true; }
        return Promise.resolve();
      },
    };
    islands.push(island);
    return island;
  }
  const context = { window, document, navigator, Date: { now: () => now } };
  function boot() { runInNewContext(script, context); }
  function emit(name) { for (const fn of listeners.get(name) || []) fn(); }
  function tick(ms) {
    const until = now + ms;
    for (;;) {
      const next = [...timers].filter(([, t]) => t.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      now = next[1].at; timers.delete(next[0]); next[1].fn();
    }
    now = until;
  }
  return { boot, emit, tick, addIsland, document, navigator, window, storage, timers, listeners,
    get reloads() { return reloads; }, get queries() { return queries; },
    get notice() { return nodes.find(n => n.isConnected); } };
}

test('Chromium and Firefox register no hooks, query no DOM and never reload', () => {
  for (const ua of [chrome, chrome.replace('Chrome/', 'Edg/'), 'Mozilla/5.0 Firefox/145.0']) {
    const f = fixture({ ua }); f.addIsland(); f.boot(); f.tick(20_000);
    assert.equal(f.listeners.size, 0); assert.equal(f.timers.size, 0);
    assert.equal(f.queries, 0); assert.equal(f.reloads, 0);
  }
});

test('healthy Safari and ordinary slow imports are left alone', () => {
  for (const state of [{ healthy: true }, { loaded: false }]) {
    const f = fixture(); const island = f.addIsland(state); f.boot(); f.tick(20_000);
    assert.equal(island.starts, 0); assert.equal(f.reloads, 0); assert.equal(f.notice, undefined);
  }
});

test('React commits still in progress are not mistaken for a missing renderer', () => {
  const f = fixture(); const island = f.addIsland(); island.hydrator = () => {};
  f.boot(); f.tick(20_000); assert.equal(island.starts, 0); assert.equal(f.reloads, 0);
});

test('retries inert islands through Astro and recovers without a reload', () => {
  const f = fixture(); const header = f.addIsland({ repair: true });
  const article = f.addIsland({ critical: false, repair: true });
  const healthy = f.addIsland({ healthy: true });
  f.boot(); f.tick(4000);
  assert.equal(header.starts, 1); assert.equal(article.starts, 1); assert.equal(healthy.starts, 0);
  assert.equal(f.reloads, 0); assert.equal(f.notice, undefined);
});

test('an isolated noncritical failure never refreshes the document', () => {
  const f = fixture(); f.addIsland({ healthy: true }); const article = f.addIsland({ critical: false });
  f.boot(); f.tick(20_000); assert.equal(f.reloads, 0); assert.equal(article.starts, 0);
});

test('persistent missing renderer refreshes once and retains URL, query and fragment', () => {
  const f = fixture(); const island = f.addIsland(); const href = f.window.location.href;
  f.boot(); f.tick(4000);
  assert.equal(f.reloads, 1); assert.equal(island.starts, 1); assert.equal(f.window.location.href, href);
  assert.ok(f.storage.has(storageKey));
  const next = fixture({ storage: f.storage }); next.addIsland(); next.boot(); next.tick(4000);
  assert.equal(next.reloads, 0); assert.equal(next.notice.attributes.role, 'alert');
  next.notice.children[1].handlers.click(); assert.equal(next.reloads, 1, 'Manual retry is still available');
});

test('unavailable storage produces an actionable notice, never an automatic loop', () => {
  const f = fixture({ storageBlocked: true }); f.document.documentElement.lang = 'zh-CN';
  f.addIsland(); f.boot(); f.tick(4000);
  assert.equal(f.reloads, 0); assert.equal(f.notice.children[1].textContent, '重新载入');
});

test('a changed Astro API or failed retry still reaches bounded recovery', async () => {
  for (const start of [undefined, () => { throw new Error('failed'); }, () => Promise.reject(new Error('failed'))]) {
    const f = fixture(); const island = f.addIsland(); island.start = start;
    f.boot(); f.tick(4000); await Promise.resolve(); assert.equal(f.reloads, 1);
  }
});

test('an old reload budget expires without removing the current loop protection', () => {
  const f = fixture({ storage: new Map([[storageKey, '1']]) }); f.addIsland();
  f.boot(); f.tick(4000); assert.equal(f.reloads, 1);
  f.emit('pageshow'); f.tick(4000); assert.equal(f.reloads, 1); assert.ok(f.notice);
});

test('new Astro navigation cancels recovery for the outgoing page', () => {
  const f = fixture(); const old = f.addIsland(); f.boot(); f.tick(2500);
  f.emit('astro:before-preparation'); old.isConnected = false; f.addIsland({ healthy: true });
  f.window.location.href = 'https://docs.6mm.com/'; f.emit('astro:page-load'); f.tick(10_000);
  assert.equal(f.reloads, 0);
});

test('a changed URL cancels a stale verification even without an Astro event', () => {
  const f = fixture(); f.addIsland(); f.boot(); f.tick(2500);
  f.window.location.href += '-new'; f.tick(1500); assert.equal(f.reloads, 0);
});

test('background and offline pages are not refreshed; restoration checks again', () => {
  const f = fixture(); f.addIsland(); f.document.hidden = true; f.boot(); f.tick(10_000);
  assert.equal(f.reloads, 0);
  f.document.hidden = false; f.navigator.onLine = false; f.emit('pageshow'); f.tick(4000);
  assert.equal(f.reloads, 0); assert.ok(f.notice);
  f.navigator.onLine = true; f.emit('online'); f.tick(4000); assert.equal(f.reloads, 1);
});

test('pagehide cancels timers and pageshow checks restored islands', () => {
  const f = fixture(); f.addIsland(); f.boot(); f.tick(2500); f.emit('pagehide'); f.tick(5000);
  assert.equal(f.reloads, 0); f.emit('pageshow'); f.tick(4000); assert.equal(f.reloads, 1);
});

test('guard is a singleton and does not depend on afterInteractive scripts', () => {
  const f = fixture(); f.document.readyState = 'loading'; f.addIsland(); f.boot(); f.boot();
  assert.equal(f.listeners.get('load').length, 1); assert.equal(f.timers.size, 0);
  f.document.readyState = 'complete'; f.emit('load'); f.tick(4000); assert.equal(f.reloads, 1);
});

test('late successful hydration dismisses the failure notice', () => {
  const f = fixture({ storageBlocked: true }); const island = f.addIsland(); f.boot(); f.tick(4000);
  assert.ok(f.notice); island.ssr = false; island.ready = true; island.hydrator = () => {};
  f.emit('fern:island-hydrated'); assert.equal(f.notice, undefined);
});

test('guard is configured before interactive hydration and checked by CI', async () => {
  const config = await readFile(new URL('../fern/docs.yml', import.meta.url), 'utf8');
  assert.match(config, /path: \.\/safari-hydration\.js\s+strategy: beforeInteractive/);
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(pkg.scripts.check, /npm run safari:check/);
  assert.match(pkg.scripts['safari:check'], /node --test scripts\/check-safari-hydration\.test\.mjs/);
});
