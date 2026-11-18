import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
import { flush, locales, origin, withPage } from './fixture.mjs';
import { verifyNativeHydration } from './hydration.mjs';
import { readScopedTocCss, sampleTocMotion } from './toc.mjs';

for (const [name, engine] of Object.entries({ chromium, webkit })) {
  test(`${name}: documentation interactions`, { timeout: 120_000 }, async t => {
    const browser = await engine.launch();
    try {
      for (const registration of ['before', 'after']) {
        await t.test(`native module loading with island registration ${registration} the guard`, () =>
          verifyNativeHydration(browser, { registration, safari: name === 'webkit' }));
      }

      await t.test('TOC fill and nested connectors keep native motion and reduced-motion behavior', async () => {
        const page = await browser.newPage();
        const scopedCss = await readScopedTocCss();
        const fixture = `<style>
          @property --toc-fill-top { syntax:"<length>"; inherits:true; initial-value:0px; }
          @property --toc-fill-bottom { syntax:"<length>"; inherits:true; initial-value:0px; }
          @media (prefers-reduced-motion: no-preference) {
            .toc-root[data-toc-measured] { transition: --toc-fill-top 250ms ease-out, --toc-fill-bottom 250ms ease-out; }
          }
          .toc-fill {
            clip-path: inset(clamp(-2px, var(--toc-fill-top) - var(--toc-li-top) - var(--toc-track-top), 100%) 0
              clamp(-2px, var(--toc-li-top) + var(--toc-li-h) - var(--toc-track-bottom) - var(--toc-fill-bottom), 100%) 0 round 1px);
          }
          .toc-connector-fill {
            clip-path: inset(clamp(0px, var(--toc-fill-top) - (var(--toc-li-top) + var(--toc-li-h) - 12px), 100%) 0
              clamp(0px, var(--toc-li-top) + var(--toc-li-h) + 4px - var(--toc-fill-bottom), 100%) 0);
          }
          .toc-item { --toc-li-h: 28px; --toc-track-top: 4px; --toc-track-bottom: 0px; }
        </style><aside id="fern-toc">
          <ul class="toc-root" data-toc-measured style="--toc-fill-top:0px;--toc-fill-bottom:20px">
            <li class="toc-item" style="--toc-li-top:0px"><span class="toc-fill"></span><a href="#one">First</a></li>
            <li class="toc-item" style="--toc-li-top:28px"><span class="toc-connector-fill"></span><span class="toc-fill"></span><a href="#two">Nested</a></li>
            <li class="toc-item" style="--toc-li-top:56px"><span class="toc-fill"></span><a href="#three">Last</a></li>
          </ul>
        </aside>`;
        try {
          for (const reducedMotion of ['no-preference', 'reduce']) {
            await page.emulateMedia({ reducedMotion });
            await page.setContent(fixture);
            await flush(page);
            const live = await sampleTocMotion(page);
            await page.addStyleTag({ content: scopedCss });
            await flush(page);
            const scoped = await sampleTocMotion(page);
            assert.deepEqual(scoped.frames, live.frames);
            assert.notDeepEqual(scoped.frames[0], scoped.frames.at(-1));
            if (reducedMotion === 'no-preference') {
              assert.equal(scoped.frames.length, 5);
              assert.deepEqual(live.owners, ['toc-root']);
              assert.deepEqual(scoped.owners, ['toc-connector-fill', 'toc-fill']);
            } else {
              assert.equal(scoped.frames.length, 2);
              assert.deepEqual(scoped.owners, []);
            }
          }
        } finally { await page.close(); }
      });

      await t.test('reloaded SEO scripts reuse initialization and keep metadata updates working', async () => {
        const source = await readFile(new URL('../../fern/seo-structured-data.js', import.meta.url), 'utf8');
        await withPage(browser, {}, async page => {
          await page.evaluate(() => {
            window.extraSeoSetup = { observers: 0, listeners: 0 };
            const NativeObserver = window.MutationObserver;
            window.MutationObserver = class extends NativeObserver {
              constructor(callback) { super(callback); extraSeoSetup.observers++; }
            };
            const addWindowListener = window.addEventListener.bind(window);
            const addDocumentListener = document.addEventListener.bind(document);
            window.addEventListener = (type, ...args) => {
              if (type === 'popstate' || type === 'pageshow') extraSeoSetup.listeners++;
              return addWindowListener(type, ...args);
            };
            document.addEventListener = (type, ...args) => {
              if (type === 'DOMContentLoaded') extraSeoSetup.listeners++;
              return addDocumentListener(type, ...args);
            };
          });
          for (let reload = 0; reload < 5; reload++) await page.addScriptTag({ content: source });
          await flush(page);
          assert.deepEqual(await page.evaluate(() => extraSeoSetup), { observers: 0, listeners: 0 });
          await page.evaluate(() => {
            history.replaceState({}, '', '/ja/sdk/overview');
            document.title = 'Navigation check | 6MM Docs';
            window.dispatchEvent(new PopStateEvent('popstate'));
          });
          await flush(page);
          const schema = await page.locator('script[data-sixmm-schema="webpage"]').textContent();
          assert.equal(JSON.parse(schema).name, 'Navigation check');
          assert.equal(JSON.parse(schema).url, 'https://docs.6mm.com/ja/sdk/overview');
          assert.equal(JSON.parse(schema).inLanguage, 'ja');
          await page.evaluate(() => document.querySelectorAll('script[data-sixmm-schema]').forEach(node => node.remove()));
          await flush(page);
          assert.equal(await page.locator('script[data-sixmm-schema="webpage"]').count(), 1);
          assert.equal(await page.locator('script[data-sixmm-schema="breadcrumb"]').count(), 1);
          assert.equal(await page.locator('script[data-sixmm-schema="webpage"]').textContent(), schema);
        });
      });

      await t.test('structured data ignores body churn and follows navigation and metadata changes', async () => {
        const page = await browser.newPage();
        try {
          await page.route(origin + '/**', route => route.fulfill({
            contentType: 'text/html',
            body: '<!doctype html><html><head><title>Guide | 6MM Docs</title></head><body><main></main></body></html>',
          }));
          await page.goto(origin + '/guide');
          await page.evaluate(() => {
            window.seoMutationCount = 0;
            const NativeObserver = window.MutationObserver;
            window.MutationObserver = class extends NativeObserver {
              constructor(callback) {
                super((records, observer) => {
                  seoMutationCount += records.length;
                  callback(records, observer);
                });
              }
            };
          });
          await page.addScriptTag({ content: await readFile(new URL('../../fern/seo-structured-data.js', import.meta.url), 'utf8') });
          await flush(page);
          const schema = async () => JSON.parse(await page.locator('head script[data-sixmm-schema="webpage"]').textContent());
          assert.equal((await schema()).name, 'Guide');
          await page.evaluate(() => {
            seoMutationCount = 0;
            const main = document.querySelector('main');
            for (let i = 0; i < 300; i++) {
              const result = document.createElement('div');
              result.innerHTML = '<span>Search result</span>';
              main.appendChild(result);
              result.remove();
            }
          });
          await flush(page);
          assert.equal(await page.evaluate(() => seoMutationCount), 0);

          // Astro navigation can keep both the head and title unchanged.
          await page.evaluate(() => {
            history.pushState({}, '', '/ar/sdk/overview');
            document.dispatchEvent(new Event('astro:page-load'));
          });
          await flush(page);
          assert.equal((await schema()).url, 'https://docs.6mm.com/ar/sdk/overview');
          assert.equal((await schema()).inLanguage, 'ar');

          await page.evaluate(() => {
            const nextHead = document.createElement('head');
            nextHead.innerHTML = '<title>Replaced | 6MM Docs</title>';
            document.head.replaceWith(nextHead);
          });
          await flush(page);
          assert.equal((await schema()).name, 'Replaced');
          await page.evaluate(() => { document.querySelector('title').firstChild.data = 'Updated | 6MM Docs'; });
          await flush(page);
          assert.equal((await schema()).name, 'Updated');
          await page.evaluate(() => {
            document.querySelector('head script[data-sixmm-schema="webpage"]').remove();
          });
          await flush(page);
          assert.equal((await schema()).name, 'Updated');
        } finally {
          await page.close();
        }
      });

      await t.test('static sidebar links use intent-based prefetch before initial and swapped markup is scanned', async () => {
        const source = await readFile(new URL('../../fern/language-modal.js', import.meta.url), 'utf8');
        const markup = `<aside id="fern-sidebar-static">
          <a id="visible" href="/relative" data-astro-prefetch="viewport">Link</a>
          <a id="eager" href="/eager" data-astro-prefetch="load">Link</a>
          <a id="disabled" href="/disabled" data-astro-prefetch="false">Link</a>
          <astro-island><a id="react" href="/react" data-astro-prefetch="viewport">React link</a></astro-island>
        </aside>
        <main><a id="outside" href="/outside" data-astro-prefetch="viewport">Outside sidebar</a></main>`;
        const page = await browser.newPage();
        try {
          await page.route(origin + '/**', route => route.fulfill({
            contentType: 'text/html',
            body: `<!doctype html><head><script>
              document.addEventListener('DOMContentLoaded', () => {
                window.initialSidebarStrategy = document.getElementById('visible').dataset.astroPrefetch;
              });
            </script><script>${source}</script></head><body>${markup}<script>
              (async () => {
                // Let the initial insertion settle, then measure separate
                // mutation batches while the document is still being parsed.
                await Promise.resolve();
                const sidebar = document.getElementById('fern-sidebar-static');
                let fullScans = 0;
                const query = sidebar.querySelectorAll.bind(sidebar);
                sidebar.querySelectorAll = selector => {
                  fullScans++;
                  return query(selector);
                };
                const main = document.querySelector('main');
                for (let index = 0; index < 24; index++) {
                  main.appendChild(document.createElement('p'));
                  await Promise.resolve();
                }
                const nested = document.createElement('div');
                sidebar.appendChild(nested);
                nested.innerHTML = '<a id="late-nested" href="/nested" data-astro-prefetch="load">Nested</a>';
                const direct = document.createElement('a');
                direct.href = '/direct';
                direct.dataset.astroPrefetch = 'viewport';
                sidebar.appendChild(direct);
                await Promise.resolve();
                window.prefetchDuringParsing = {
                  state: document.readyState,
                  fullScans,
                  nested: document.getElementById('late-nested').dataset.astroPrefetch,
                  direct: direct.dataset.astroPrefetch,
                };
                delete sidebar.querySelectorAll;
              })();
            </script></body>`,
          }));
          await page.goto(origin + '/guide');
          assert.deepEqual(await page.evaluate(() => window.prefetchDuringParsing), {
            state: 'loading', fullScans: 0, nested: 'hover', direct: 'hover',
          });
          assert.equal(await page.evaluate(() => initialSidebarStrategy), 'hover');
          assert.equal(await page.locator('#eager').getAttribute('data-astro-prefetch'), 'hover');
          assert.equal(await page.locator('#disabled').getAttribute('data-astro-prefetch'), 'false');
          assert.equal(await page.locator('#react').getAttribute('data-astro-prefetch'), 'viewport');
          assert.equal(await page.locator('#outside').getAttribute('data-astro-prefetch'), 'viewport');
          assert.equal(await page.locator('#visible').getAttribute('href'), '/relative');
          const swapped = await page.evaluate(markup => {
            const event = new Event('astro:before-swap');
            event.newDocument = new DOMParser().parseFromString(markup, 'text/html');
            document.dispatchEvent(event);
            return ['visible', 'eager', 'disabled', 'react', 'outside'].map(id =>
              event.newDocument.getElementById(id).dataset.astroPrefetch);
          }, markup);
          assert.deepEqual(swapped, ['hover', 'hover', 'false', 'viewport', 'viewport']);
        } finally { await page.close(); }
      });

      await t.test('theme confirmation ignores unrelated document changes', async () => {
        const source = await readFile(new URL('../../fern/language-modal.js', import.meta.url), 'utf8');
        const page = await browser.newPage();
        try {
          await page.route(origin + '/**', route => route.fulfill({
            contentType: 'text/html',
            body: '<!doctype html><html><head><title>Theme</title></head><body><main></main></body></html>',
          }));
          await page.goto(origin + '/guide');
          await page.addScriptTag({ content: source });
          const result = await page.evaluate(async () => {
            const native = window.MutationObserver;
            let checks = 0;
            window.MutationObserver = class extends native {
              constructor(callback) {
                super((...args) => { checks++; callback(...args); });
              }
            };
            try {
              const dark = window.__sixmmNavigateDocsTheme('dark');
              const root = document.documentElement;
              const main = document.querySelector('main');
              for (let index = 0; index < 24; index++) {
                main.appendChild(document.createElement('p')).className = 'new';
                root.dataset.unrelated = index;
                await Promise.resolve();
              }
              const unrelatedChecks = checks;
              root.dataset.theme = 'dark';
              const darkConfirmed = await dark;
              const light = window.__sixmmNavigateDocsTheme('light');
              root.classList.add('light');
              const lightConfirmed = await light;
              root.classList.remove('light');
              await Promise.resolve();
              return { unrelatedChecks, darkConfirmed, lightConfirmed, checks };
            } finally {
              window.MutationObserver = native;
            }
          });
          assert.deepEqual(result, { unrelatedChecks: 0, darkConfirmed: true, lightConfirmed: true, checks: 2 });
        } finally { await page.close(); }
      });

      await t.test('all locales retain the page, query, section and support frame', async () => {
        await withPage(browser, {}, async page => {
          for (const locale of locales) {
            const route = locale.default ? '' : locale.code;
            const option = page.locator(`[role="menuitemradio"][data-sixmm-locale="${route}"]`);
            await option.click();
            await flush(page);
            assert.equal(page.url(), `${origin}${route ? '/' + route : ''}/guide?mode=example#section`);
            assert.equal(await option.getAttribute('aria-checked'), 'true');
            assert.equal(await page.locator('html').getAttribute('lang'), locale.code);
            assert.equal(await page.locator('html').getAttribute('dir'), locale.code === 'ar' ? 'rtl' : 'ltr');
            assert.equal(await page.evaluate(() => document.querySelector('iframe') === window.originalSupportFrame), true);
          }
          await page.locator('#theme').click();
          await flush(page);
          assert.equal(await page.locator('html').evaluate(node => node.classList.contains('dark')), true);
          assert.deepEqual(await page.evaluate(() => widgetCalls.filter(([kind]) => kind === 'theme').at(-1)), ['theme', 'dark']);
          await page.evaluate(() => window.dispatchEvent(new CustomEvent('cs-widget-theme-change', { detail: { theme: 'light' } })));
          await flush(page);
          assert.equal(await page.locator('html').evaluate(node => node.classList.contains('light')), true);
          await page.evaluate(() => window.dispatchEvent(new CustomEvent('cs-widget-lang-change', { detail: { lang: 'ja' } })));
          await flush(page);
          assert.equal(new URL(page.url()).pathname, '/ja/guide');
          await page.goBack();
          await flush(page);
          assert.equal(new URL(page.url()).pathname, '/ar/guide');
          assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
        });
      });

      await t.test('locale navigation reads incoming article text only when the element is reused', async () => {
        const source = await readFile(new URL('../../fern/language-modal.js', import.meta.url), 'utf8');
        const page = await browser.newPage();
        try {
          await page.route(origin + '/**', route => route.fulfill({
            contentType: 'text/html',
            body: '<!doctype html><html><body><main><article>English content</article></main></body></html>',
          }));
          await page.goto(origin + '/guide?source=test#section');
          await page.addScriptTag({ content: source });
          const result = await page.evaluate(async () => {
            let articleReads = 0;
            let replaceArticle = true;
            const getText = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent').get;
            document.addEventListener('click', event => {
              const link = event.target.closest('a[hidden]');
              if (!link) return;
              event.preventDefault();
              history.pushState({}, '', link.href);
              const current = document.querySelector('article');
              if (replaceArticle) {
                const incoming = document.createElement('article');
                incoming.textContent = current.textContent;
                Object.defineProperty(incoming, 'textContent', { get() { articleReads++; return getText.call(this); } });
                current.replaceWith(incoming);
                replaceArticle = false;
              } else {
                current.firstChild.data = 'Reused article';
              }
            });
            const replaced = await window.__sixmmNavigateDocsLocale('ja');
            const replacementReads = articleReads;
            const reused = await window.__sixmmNavigateDocsLocale('ko');
            return { replaced, replacementReads, reused, reuseReads: articleReads - replacementReads,
              url: location.pathname + location.search + location.hash };
          });
          assert.deepEqual(result, {
            replaced: true, replacementReads: 0, reused: true, reuseReads: 2, url: '/ko/guide?source=test#section',
          });
        } finally { await page.close(); }
      });

      await t.test('locale wait sees asynchronous text edits and cancels a superseded wait', async () => {
        const source = await readFile(new URL('../../fern/language-modal.js', import.meta.url), 'utf8');
        const page = await browser.newPage();
        try {
          await page.route(origin + '/**', route => route.fulfill({
            contentType: 'text/html',
            body: '<!doctype html><aside><div></div></aside><main><article>English</article></main>',
          }));
          await page.goto(origin + '/guide');
          await page.addScriptTag({ content: source });
          const result = await page.evaluate(async () => {
            const title = document.querySelector('main article').firstChild;
            const deadlines = new Set();
            const startTimer = window.setTimeout.bind(window);
            const clearTimer = window.clearTimeout.bind(window);
            window.setTimeout = (cb, delay, ...args) => {
              const timer = startTimer(cb, delay, ...args);
              if (delay === 15000) deadlines.add(timer);
              return timer;
            };
            window.clearTimeout = timer => {
              deadlines.delete(timer);
              clearTimer(timer);
            };
            document.addEventListener('click', event => {
              const link = event.target.closest('a[hidden]');
              if (!link) return;
              event.preventDefault();
              history.pushState({}, '', link.href);
            });
            const old = window.__sixmmNavigateDocsLocale('ja');
            const current = window.__sixmmNavigateDocsLocale('ko');
            const liveWaits = deadlines.size;
            const superseded = await old;
            document.querySelector('aside div').textContent = 'Unrelated update';
            await Promise.resolve();
            const stillWaiting = deadlines.size;
            title.data = '한국어';
            const confirmed = await current;
            return { liveWaits, superseded, stillWaiting, confirmed, remaining: deadlines.size };
          });
          assert.deepEqual(result, { liveWaits: 1, superseded: false, stillWaiting: 1, confirmed: true, remaining: 0 });
        } finally { await page.close(); }
      });

      await t.test('language direction follows updated definitions without a route change', async () => {
        await withPage(browser, { pathname: '/ar/guide' }, async page => {
          const states = await page.evaluate(() => {
            const states = [];
            const sync = () => {
              document.dispatchEvent(new Event('astro:page-load'));
              states.push([document.documentElement.lang, document.documentElement.dir]);
            };
            sync();
            const arabic = window.__sixmmDocsLocales.find(locale => locale.code === 'ar');
            arabic.htmlLang = 'en';
            sync();
            arabic.htmlLang = 'ar';
            sync();
            delete window.__sixmmDocsLocales;
            sync();
            window.__sixmmDocsLocales = [{ code: 'ar', htmlLang: 'ar' }];
            sync();
            return states;
          });
          assert.deepEqual(states, [['ar', 'rtl'], ['en', 'ltr'], ['ar', 'rtl'], ['en', 'ltr'], ['ar', 'rtl']]);
          await flush(page);
          assert.equal(new URL(page.url()).pathname, '/ar/guide');
        });
      });

      await t.test('mobile language dialog keeps focus, closes and navigates', async () => {
        await withPage(browser, { mobile: true }, async page => {
          const trigger = page.locator('.fern-language-selector');
          await trigger.click();
          const panel = page.locator('.sixmm-mobile-language-dialog-panel');
          await panel.waitFor({ state: 'visible' });
          const buttons = panel.locator('button:not([disabled])');
          await buttons.last().focus();
          await page.keyboard.press('Tab');
          assert.equal(await buttons.first().evaluate(node => node === document.activeElement), true);
          await page.keyboard.press('Shift+Tab');
          assert.equal(await buttons.last().evaluate(node => node === document.activeElement), true);
          await page.keyboard.press('Escape');
          await panel.waitFor({ state: 'detached' });
          assert.equal(await trigger.evaluate(node => node === document.activeElement), true);
          await trigger.click();
          await page.locator('.sixmm-mobile-language-dialog-option').filter({ hasText: '日本語' }).click();
          await flush(page);
          assert.equal(new URL(page.url()).pathname, '/ja/guide');
          assert.equal(await panel.count(), 0);
        });
      });

      await t.test('locale swaps preserve incoming SSR labels and hydration strategies at every loading phase', async () => {
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        try {
          await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><body></body></html>' }));
          await page.goto(origin);
          for (const script of ['language-modal.js', 'docs-interface.js']) {
            await page.addScriptTag({ content: await readFile(new URL('../../fern/' + script, import.meta.url), 'utf8') });
            const results = await page.evaluate(locales => {
              return locales.flatMap(locale => {
                const target = locale.default ? '' : '/' + locale.code;
                return [target, '', '/ja', '/ar'].map(source => {
                  const incoming = new DOMParser().parseFromString('<!doctype html><html><body></body></html>', 'text/html');
                  incoming.documentElement.lang = locale.code;
                  incoming.body.innerHTML = ['load', 'idle', 'visible', 'lazy', 'only'].map((strategy, index) =>
                    `<astro-island client="${strategy}" opts='{"name":"PageHeaderIsland","value":true}'>
                      <header id="${index ? 'header-' + index : 'fern-header'}"><button aria-label="搜索">搜索</button></header>
                      <div class="fern-page-actions"><button title="Copy page">Copy page</button><button>编辑此页面</button></div>
                      <p>${locale.label}</p><astro-slot>Localized content</astro-slot>
                    </astro-island>`).join('');
                  const before = incoming.documentElement.outerHTML;
                  const event = new Event('astro:before-swap');
                  Object.assign(event, { from: new URL(source + '/guide', location.origin), to: new URL(target + '/guide', location.origin), newDocument: incoming });
                  document.dispatchEvent(event);
                  return { locale: locale.code, source, preserved: incoming.documentElement.outerHTML === before };
                });
              });
            }, locales);
            assert.equal(results.length, locales.length * 4);
            assert.deepEqual(results.filter(result => !result.preserved), [], `${script}: incoming text, attributes and loading strategies must survive until native hydration`);
          }
          assert.deepEqual(errors, []);
        } finally { await page.close(); }
      });

      await t.test('nested hydration and excluded content preserve server text', async () => {
        const markup = `<astro-island id="layout"><astro-island id="header-island"><header id="fern-header"><button id="search">Search</button></header></astro-island></astro-island>
          <div id="fern-ask-ai-panel"><pre><code>${'<span>Search</span>'.repeat(100)}</code></pre>
          <main><article><p>Search</p><button id="article-copy">Copy page</button></article></main>
          <astro-island id="late"><button id="late-search">Search</button></astro-island></div>`;
        await withPage(browser, { pathname: '/ar/guide', markup }, async page => {
          assert.equal(await page.locator('#search').textContent(), 'Search');
          assert.equal(await page.locator('#late-search').textContent(), 'Search');
          await page.evaluate(() => {
            document.getElementById('header-island').setAttribute('data-fern-hydrated', '');
            document.dispatchEvent(new Event('fern:island-hydrated'));
          });
          await flush(page);
          assert.equal(await page.locator('#search').textContent(), 'Search');
          await page.evaluate(() => {
            document.getElementById('layout').setAttribute('data-fern-hydrated', '');
            document.dispatchEvent(new Event('fern:island-hydrated'));
            document.getElementById('late').setAttribute('data-fern-hydrated', '');
          });
          await flush(page);
          assert.equal(await page.locator('#search').textContent(), 'بحث');
          assert.equal(await page.locator('#late-search').textContent(), 'بحث');
          assert.equal(await page.locator('article p').textContent(), 'Search');
          assert.equal(await page.locator('#article-copy').textContent(), 'نسخ الصفحة');
          assert.equal(await page.locator('pre').textContent(), 'Search'.repeat(100));
          await page.evaluate(() => {
            document.getElementById('late').removeAttribute('data-fern-hydrated');
            document.getElementById('late-search').textContent = 'Search';
          });
          await flush(page);
          assert.equal(await page.locator('#late-search').textContent(), 'Search');
        });
      });

      await t.test('outer readiness does not translate React content before deferred host bindings attach', async () => {
        await withPage(browser, { pathname: '/uk/guide' }, async page => {
          await page.evaluate(() => {
            const island = document.createElement('astro-island');
            island.setAttribute('data-fern-hydrated', '');
            island.__reactContainer$fixture = {};
            island.setAttribute('component-url', '/FooterIsland.fixture.js');
            island.innerHTML = '<div id="fern-search-panel"><button id="deferred-label" aria-label="Search">Search</button></div>' +
              '<a id="deferred-edit" href="https://github.com/6mm-com/docs/blob/main/fern/docs/pages/guide.mdx?plain=1" data-astro-prefetch="load">Edit</a>';
            island.firstElementChild.__reactProps$fixture = {};
            const outer = document.createElement('astro-island');
            outer.setAttribute('data-fern-hydrated', '');
            outer.__reactContainer$outer = {};
            outer.appendChild(island);
            document.body.appendChild(outer);
            document.dispatchEvent(new Event('fern:island-hydrated'));
          });
          await page.waitForTimeout(120);
          const label = page.locator('#deferred-label');
          const edit = page.locator('#deferred-edit');
          assert.equal(await label.textContent(), 'Search');
          assert.equal(await label.getAttribute('aria-label'), 'Search');
          assert.equal(await edit.getAttribute('data-astro-prefetch'), 'load');
          assert.match(await edit.getAttribute('href'), /\/fern\/docs\//);
          await page.evaluate(() => {
            window.deferredFullScans = 0;
            const query = document.querySelectorAll.bind(document);
            document.querySelectorAll = (selector, ...args) => {
              if (selector.startsWith('#fern-header,') || selector.startsWith('a[href^="https://github.com/6mm-com/docs/') ||
                  selector.startsWith('a[data-astro-prefetch="viewport"]')) window.deferredFullScans++;
              return query(selector, ...args);
            };
          });
          // React attaches host bindings without changing matching server markup.
          await label.evaluate(node => { node.__reactProps$fixture = {}; });
          await page.waitForFunction(() => document.getElementById('deferred-label').textContent === 'Пошук');
          assert.equal(await label.getAttribute('aria-label'), 'Пошук');
          assert.equal(await edit.getAttribute('data-astro-prefetch'), 'load', 'Other deferred controls must stay untouched');
          await edit.evaluate(node => { node.__reactProps$fixture = {}; });
          await page.waitForFunction(() => document.getElementById('deferred-edit').dataset.astroPrefetch === 'hover');
          assert.equal(await edit.getAttribute('href'), 'https://github.com/6mm-com/docs/blob/main/fern/translations/uk/docs/pages/guide.mdx?plain=1');
          assert.equal(await page.evaluate(() => window.deferredFullScans), 0, 'Ready bindings must not cause document-wide scans');
          await label.evaluate(node => node.closest('astro-island').remove());
        });
      });

      await t.test('unrelated element updates do not rescan cards', async () => {
        await withPage(browser, {}, async page => {
          await flush(page);
          await page.evaluate(() => {
            window.cardScans = 0;
            const query = document.querySelectorAll.bind(document);
            document.querySelectorAll = (selector, ...args) => {
              if (selector === 'article') cardScans++;
              return query(selector, ...args);
            };
          });
          // Separate frames model repeated search results, support messages and
          // article content updates rather than a single coalesced mutation.
          for (let update = 0; update < 12; update++) {
            await page.evaluate(() => {
              for (const root of [document.querySelector('article'), document.querySelector('#cs-widget-container'), document.body]) {
                const content = document.createElement('div');
                content.innerHTML = '<p>Updated content <span>with nested markup</span></p>';
                root.appendChild(content);
                content.remove();
              }
            });
            await flush(page);
          }
          assert.equal(await page.evaluate(() => cardScans), 0);
          // New targets still register, including direct children whose target
          // selector depends on an ancestor outside the added subtree.
          for (const [container, child, effect] of [
            ['<article><div class="fern-card-group"></div></article>', '<a class="fern-card">Card</a>', 'sixmm-content-card'],
            ['<article><div class="sixmm-stat-grid"></div></article>', '<div>Statistic</div>', 'sixmm-content-card'],
            ['<footer class="fern-layout-footer"><nav class="fern-footer-nav"></nav></footer>', '<a>Next page</a>', 'sixmm-content-card'],
            ['<div class="sixmm-language-menu-enhanced"><div class="fern-language-selector-radio-group"></div></div>', '<a class="fern-language-dropdown-item">Language</a>', 'sixmm-language-option-effect'],
            ['<div class="fern-language-dropdown-content"><div class="fern-language-selector-radio-group"></div></div>', '<a class="fern-language-dropdown-item" role="menuitemradio" href="/guide"><span class="fern-language-dropdown-item-label">English</span></a>', 'sixmm-language-option-effect'],
            ['<div class="sixmm-mobile-language-dialog-options"></div>', '<button class="sixmm-mobile-language-dialog-option">Language</button>', 'sixmm-language-option-effect'],
          ]) {
            await page.evaluate(({ container, child }) => {
              const wrapper = document.createElement('section');
              wrapper.id = 'dynamic-effect-fixture';
              wrapper.innerHTML = container;
              document.body.appendChild(wrapper);
              let parent = wrapper;
              while (parent.firstElementChild) parent = parent.firstElementChild;
              parent.insertAdjacentHTML('beforeend', child);
              window.dynamicEffectTarget = parent.lastElementChild;
            }, { container, child });
            await flush(page);
            assert.equal(await page.evaluate(effect => dynamicEffectTarget.classList.contains(effect), effect), true);
            const beforeRemoval = await page.evaluate(() => cardScans);
            await page.evaluate(() => dynamicEffectTarget.remove());
            await flush(page);
            assert.equal(await page.evaluate(() => cardScans), beforeRemoval + 1, 'Detached targets must trigger group cleanup');
            await page.locator('#dynamic-effect-fixture').evaluate(node => node.remove());
            await flush(page);
          }
        });
      });

      await t.test('nested UI controls share the parent observer and are rediscovered after a move', async () => {
        await withPage(browser, { pathname: '/uk/guide', markup: `
          <header id="fern-header">
            <button class="fern-copy-button" id="nested-control">Search</button>
            ${'<button class="fern-copy-button">Search</button>'.repeat(23)}
          </header>
          <main><article>Guide</article></main>` }, async page => {
          const control = page.locator('#nested-control');
          assert.equal(await control.textContent(), 'Пошук');
          await page.evaluate(() => {
            const observe = MutationObserver.prototype.observe;
            window.observedLabels = [];
            MutationObserver.prototype.observe = function (target, options) {
              if (options?.attributeFilter?.includes('data-fern-hydrated')) window.observedLabels.push(target.id);
              observe.call(this, target, options);
            };
            document.dispatchEvent(new Event('astro:page-load'));
          });
          await flush(page);
          assert.deepEqual(await page.evaluate(() => observedLabels), ['fern-header']);
          await control.evaluate(node => { node.textContent = 'Search'; });
          await page.waitForFunction(() => document.getElementById('nested-control').textContent === 'Пошук');
          await control.evaluate(node => document.body.appendChild(node));
          await page.waitForFunction(() => observedLabels.includes('nested-control'));
          await control.evaluate(node => { node.textContent = 'Search'; });
          await page.waitForFunction(() => document.getElementById('nested-control').textContent === 'Пошук');
        });
      });

      await t.test('card glow skips invisible and unchanged values without changing the fade', async () => {
        await withPage(browser, { markup: `<main><article>
          <div class="fern-card-group" style="display:flex;justify-content:space-between;width:900px">
            <a class="fern-card" id="near-card" style="display:block;width:120px;height:96px" href="#near">Near</a>
            <a class="fern-card" id="far-card" style="display:block;width:120px;height:96px" href="#far">Far</a>
          </div></article></main>` }, async page => {
          const result = await page.evaluate(async () => {
            const near = document.getElementById('near-card');
            const far = document.getElementById('far-card');
            const intensity = '--sixmm-card-intensity';
            const x = '--sixmm-card-x';
            const writes = { near: 0, far: 0 };
            for (const [key, card] of Object.entries({ near, far })) {
              const write = card.style.setProperty.bind(card.style);
              card.style.setProperty = (name, value) => {
                if (name === intensity) writes[key]++;
                return write(name, value);
              };
            }
            async function move(card, offset) {
              const { left, top } = card.getBoundingClientRect();
              card.dispatchEvent(new PointerEvent('pointermove', {
                pointerType: 'mouse', bubbles: true, clientX: left + offset, clientY: top + 40,
              }));
              await new Promise(requestAnimationFrame);
            }
            await move(near, 25);
            const first = {
              near: near.style.getPropertyValue(intensity),
              far: getComputedStyle(far, '::before').opacity,
              farX: far.style.getPropertyValue(x),
            };
            await move(near, 35);
            const steady = { x: near.style.getPropertyValue(x), writes: { ...writes } };
            await move(far, 30);
            const fading = {
              near: near.style.getPropertyValue(intensity),
              nearX: parseFloat(near.style.getPropertyValue(x)),
              far: far.style.getPropertyValue(intensity),
            };
            document.dispatchEvent(new Event('scroll'));
            return { first, steady, fading, reset: far.style.getPropertyValue(intensity),
              hovered: far.hasAttribute('data-sixmm-card-hovered') };
          });
          assert.deepEqual(result.first, { near: '1.000', far: '0', farX: '' });
          assert.deepEqual(result.steady, { x: '35px', writes: { near: 1, far: 0 } });
          assert.equal(result.fading.near, '0.000');
          assert.ok(result.fading.nearX > 700, 'A fading gradient must keep following the pointer');
          assert.equal(result.fading.far, '1.000');
          assert.equal(result.reset, '0.000');
          assert.equal(result.hovered, false);
        });
      });

      await t.test('late cards retain their existing effects after body replacements', async () => {
        await withPage(browser, {}, async page => {
          for (let swap = 0; swap < 2; swap++) {
            await page.evaluate(() => {
              document.dispatchEvent(new Event('astro:before-swap'));
              const nextBody = document.createElement('body');
              while (document.body.firstChild) nextBody.appendChild(document.body.firstChild);
              document.body.replaceWith(nextBody);
              document.dispatchEvent(new Event('astro:page-load'));
            });
            await flush(page);
            await page.evaluate(() => {
              const group = document.createElement('div');
              group.className = 'fern-card-group';
              const card = document.createElement('a');
              card.className = 'fern-card';
              card.textContent = 'Existing card content';
              card.style.cssText = 'display:block;width:220px;height:120px';
              group.appendChild(card);
              document.querySelector('article').appendChild(group);
            });
            await flush(page);
            const card = page.locator('.fern-card').last();
            assert.equal(await card.evaluate(node => node.classList.contains('sixmm-content-card')), true);
            await card.hover();
            await flush(page);
            assert.equal(await card.getAttribute('data-sixmm-card-hovered'), 'true');
            assert.equal(await card.evaluate(node => node.style.getPropertyValue('--sixmm-card-intensity')), '1.000');
            await page.evaluate(() => document.dispatchEvent(new Event('pointerleave')));
            assert.equal(await card.getAttribute('data-sixmm-card-hovered'), null);
          }
        });
      });

      await t.test('support controls mounted after a body replacement retain keyboard access', async () => {
        await withPage(browser, {}, async page => {
          for (let swap = 0; swap < 2; swap++) {
            await page.evaluate(() => {
              const nextBody = document.createElement('body');
              while (document.body.firstChild) nextBody.appendChild(document.body.firstChild);
              document.body.replaceWith(nextBody);
              document.dispatchEvent(new Event('astro:page-load'));
            });
            await flush(page);
            await page.evaluate(() => {
              document.getElementById('cs-widget-bubble').remove();
              document.getElementById('cs-widget-container').remove();
            });
            await flush(page);
            await page.evaluate(() => {
              const bubble = document.createElement('div');
              bubble.id = 'cs-widget-bubble';
              bubble.textContent = 'Support';
              bubble.onclick = () => { widgetCalls.push(['open']); window.CSWidget.open(); };
              const container = document.createElement('div');
              container.id = 'cs-widget-container';
              container.style.display = 'none';
              document.body.append(bubble, container);
            });
            await flush(page);
            const bubble = page.locator('#cs-widget-bubble');
            assert.equal(await bubble.getAttribute('role'), 'button');
            assert.equal(await bubble.getAttribute('tabindex'), '0');
            const opens = await page.evaluate(() => widgetCalls.filter(([kind]) => kind === 'open').length);
            await bubble.press('Enter');
            await flush(page);
            assert.equal(await page.evaluate(() => widgetCalls.filter(([kind]) => kind === 'open').length), opens + 1);
            assert.equal(await bubble.getAttribute('aria-expanded'), 'true');
          }
        });
      });

      await t.test('delayed support SDK coalesces retries and receives the current host settings', async () => {
        await withPage(browser, {}, async page => {
          await page.evaluate(() => {
            window.readySupportSDK = window.CSWidget;
            window.CSWidget = undefined;
            const nativeTimeout = window.setTimeout;
            const nativeClearTimeout = window.clearTimeout;
            const pending = window.supportSyncTimers = new Map();
            let nextId = -1;
            window.setTimeout = (callback, delay, ...args) => {
              if (delay !== 100) return nativeTimeout(callback, delay, ...args);
              const id = nextId--;
              pending.set(id, callback);
              return id;
            };
            window.clearTimeout = id => {
              if (!pending.delete(id)) nativeClearTimeout(id);
            };
            history.replaceState({}, '', '/ja/guide');
            document.documentElement.classList.replace('light', 'dark');
            widgetCalls.length = 0;
            for (let event = 0; event < 50; event++) document.dispatchEvent(new Event('astro:page-load'));
          });
          await flush(page);
          assert.equal(await page.evaluate(() => supportSyncTimers.size), 2);
          await page.evaluate(() => {
            window.CSWidget = window.readySupportSDK;
            for (const [id, callback] of [...supportSyncTimers]) {
              if (supportSyncTimers.delete(id)) callback();
            }
          });
          await flush(page);
          assert.equal(await page.evaluate(() => supportSyncTimers.size), 0);
          assert.deepEqual(await page.evaluate(() => widgetCalls.slice().sort()), [['lang', 'ja'], ['theme', 'dark']]);
        });
      });

      await t.test('support scroll locks survive a swap and stay cleared after closing', async () => {
        await withPage(browser, {}, async page => {
          const expected = await page.evaluate(() => {
            window.scrollLockProperties = ['overflow', 'position', 'top', 'left', 'right', 'width', 'background', 'padding-right'];
            window.readScrollLocks = () => [document.body, document.documentElement].map(element =>
              scrollLockProperties.map(name => [name, element.style.getPropertyValue(name), element.style.getPropertyPriority(name)]));
            // Model the external SDK's scroll lock; the host must carry it over
            // when Astro replaces the body, then respect the SDK's close cleanup.
            window.CSWidget.open();
            for (const element of [document.body, document.documentElement]) {
              element.style.cssText = 'overflow:hidden!important;position:fixed;top:-120px;left:0;right:0;width:100%;background:rgb(1,2,3);padding-right:12px';
            }
            const expected = readScrollLocks();
            const event = new Event('astro:before-swap');
            event.newDocument = document.implementation.createHTMLDocument();
            document.dispatchEvent(event);
            const body = event.newDocument.body;
            body.replaceChildren(...document.body.childNodes);
            document.body.replaceWith(body);
            document.documentElement.style.cssText = '';
            document.dispatchEvent(new Event('astro:page-load'));
            return expected;
          });
          await flush(page);
          assert.deepEqual(await page.evaluate(() => readScrollLocks()), expected);
          assert.equal(await page.locator('#cs-widget-container').evaluate(node => node.style.display), 'block');
          await page.evaluate(() => {
            window.CSWidget.close();
            for (const element of [document.body, document.documentElement]) {
              for (const name of scrollLockProperties) element.style.removeProperty(name);
            }
            for (let repeat = 0; repeat < 3; repeat++) document.dispatchEvent(new Event('astro:page-load'));
            const spacer = document.createElement('div');
            spacer.style.height = '3000px';
            document.body.appendChild(spacer);
          });
          await flush(page);
          assert.equal(await page.locator('#cs-widget-container').evaluate(node => node.style.display), 'none');
          assert.equal(await page.evaluate(() => readScrollLocks().flat().every(([, value, priority]) => !value && !priority)), true);
          await page.evaluate(() => window.scrollTo(0, 120));
          await flush(page);
          assert.ok(await page.evaluate(() => window.scrollY > 0), 'The page must scroll again after support closes');
        });
      });

      await t.test('completed swaps do not restore retired support controls', async () => {
        await withPage(browser, {}, async page => {
          await page.evaluate(() => {
            const event = new Event('astro:before-swap');
            event.newDocument = document.implementation.createHTMLDocument();
            document.dispatchEvent(event);
            document.dispatchEvent(new Event('astro:page-load'));
          });
          await flush(page);
          assert.equal(await page.evaluate(() => document.querySelector('#cs-widget-container iframe') === window.originalSupportFrame), true);
          await page.evaluate(() => {
            const oldBubble = document.getElementById('cs-widget-bubble');
            const oldContainer = document.getElementById('cs-widget-container');
            const nextContainer = oldContainer.cloneNode(true);
            nextContainer.querySelector('.sixmm-support-status').remove();
            oldBubble.replaceWith(oldBubble.cloneNode(true));
            oldContainer.replaceWith(nextContainer);
          });
          await flush(page);
          await page.evaluate(() => document.dispatchEvent(new Event('astro:page-load')));
          await flush(page);
          assert.equal(await page.locator('#cs-widget-bubble').count(), 1);
          assert.equal(await page.locator('#cs-widget-container').count(), 1);
          assert.equal(await page.evaluate(() => window.originalSupportFrame.isConnected), false);
        });
      });

      await t.test('replaced support frames keep a single current loading status', async () => {
        await withPage(browser, {}, async page => {
          for (let replacement = 0; replacement < 2; replacement++) {
            await page.evaluate(() => {
              const container = document.getElementById('cs-widget-container');
              const oldFrame = container.querySelector('iframe');
              window.retiredSupportMessage = new MessageEvent('message', {
                source: oldFrame.contentWindow,
                origin: location.origin,
                data: { type: 'cs-widget-browser-theme' },
              });
              const nextFrame = document.createElement('iframe');
              nextFrame.src = '/frame';
              oldFrame.replaceWith(nextFrame);
              container.style.display = container.style.display === 'none' ? 'block' : 'none';
            });
            await flush(page);
            const status = page.locator('.sixmm-support-status');
            assert.equal(await status.count(), 1);
            await page.evaluate(() => window.dispatchEvent(window.retiredSupportMessage));
            await flush(page);
            assert.equal(await status.evaluate(node => node.hidden), false);
            await page.evaluate(() => window.dispatchEvent(new MessageEvent('message', {
              source: document.querySelector('#cs-widget-container iframe').contentWindow,
              origin: location.origin,
              data: { type: 'cs-widget-browser-theme' },
            })));
            await flush(page);
            assert.equal(await status.evaluate(node => node.hidden), true);
          }
        });
      });

      await t.test('support timeout, explicit retry and trusted readiness remain usable', async () => {
        await withPage(browser, {}, async page => {
          await page.locator('#cs-widget-bubble').press('Enter');
          await flush(page);
          const status = page.locator('.sixmm-support-status');
          assert.equal(await status.getAttribute('data-state'), 'loading');
          await page.evaluate(() => window.expireSupportDeadline());
          await flush(page);
          assert.equal(await status.getAttribute('data-state'), 'error');
          await status.locator('button').first().click();
          assert.equal(await status.getAttribute('data-state'), 'loading');
          for (const trusted of [false, true]) {
            await page.evaluate(trusted => {
              const frame = document.querySelector('#cs-widget-container iframe');
              window.dispatchEvent(new MessageEvent('message', {
                source: frame.contentWindow,
                origin: trusted ? location.origin : 'https://untrusted.test',
                data: { type: 'cs-widget-browser-theme' },
              }));
            }, trusted);
            await flush(page);
            assert.equal(await status.evaluate(node => node.hidden), trusted);
          }
          await page.locator('iframe').evaluate(frame => frame.dispatchEvent(new Event('error')));
          await flush(page);
          assert.equal(await status.evaluate(node => node.hidden), true, 'A late iframe error must not cover an active conversation');
        });
      });
    } finally {
      await browser.close();
    }
  });
}
