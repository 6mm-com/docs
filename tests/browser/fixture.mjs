import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { locales } from '../../scripts/locale-config.mjs';

const fern = new URL('../../fern/', import.meta.url);
const config = parse(await readFile(new URL('docs.yml', fern), 'utf8'));
const strategies = ['beforeInteractive', 'afterInteractive', 'lazyOnload'];
for (const { path, strategy } of config.js) {
  assert.ok(strategies.includes(strategy), `Unsupported script strategy ${strategy}: ${path}`);
}
const scripts = await Promise.all(strategies
  .flatMap(strategy => config.js.filter(script => script.strategy === strategy))
  .map(({ path }) => readFile(new URL(path, fern), 'utf8')));
const css = await readFile(new URL('styles.css', fern), 'utf8');
export const origin = 'https://docs-regression.test';
export { locales };

const defaultMarkup = `
  <header id="fern-header">
    <button id="search">Search</button>
    <div><button class="fern-language-selector"><span class="language-dropdown-trigger"><span class="truncate">English</span></span></button>
    <button id="theme"><svg class="lucide-moon"></svg></button></div>
  </header>
  <main><article><h1 id="section">Guide</h1></article></main>
  <div class="fern-language-dropdown-content"><div class="fern-language-selector-radio-group"></div></div>`;

export async function flush(page) {
  await page.evaluate(async () => {
    for (let i = 0; i < 4; i++) await new Promise(resolve => requestAnimationFrame(resolve));
  });
}

// Fern routing/theme state and the external customer-support SDK are simulated.
// Scripts follow docs.yml loading phases, preserving order within each phase.
// The fixture models phase order, not Fern's parser/hydration or network timing.
export async function withPage(browser, options, exercise) {
  const { pathname = '/guide?mode=example#section', mobile = false, markup = defaultMarkup } = options;
  const page = await browser.newPage({ viewport: { width: mobile ? 600 : 1400, height: 950 } });
  page.setDefaultTimeout(10_000);
  const errors = [];
  const unexpectedRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) {
      unexpectedRequests.push(url.href);
      return route.abort();
    }
    return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><head></head><body></body></html>' });
  });
  try {
    await page.goto(origin + pathname);
    await page.evaluate(({ markup, locales, mobile }) => {
      document.documentElement.className = 'light';
      document.body.innerHTML = markup;
      const selector = document.querySelector('.fern-language-selector');
      if (mobile && selector) selector.parentElement.classList.add('lg:hidden');
      const group = document.querySelector('.fern-language-selector-radio-group');
      if (group) {
        for (const locale of [...locales].reverse()) {
          const option = document.createElement('a');
          option.setAttribute('role', 'menuitemradio');
          option.href = (locale.default ? '' : '/' + locale.code) + '/old';
          const label = document.createElement('span');
          label.className = 'fern-language-dropdown-item-label';
          label.textContent = locale.label;
          option.appendChild(label);
          group.appendChild(option);
        }
      }
      window.widgetCalls = [];
      window.CSWidget = {
        setLang: value => window.widgetCalls.push(['lang', value]),
        setTheme: value => window.widgetCalls.push(['theme', value]),
        open: () => { document.getElementById('cs-widget-container').style.display = 'block'; },
        close: () => { document.getElementById('cs-widget-container').style.display = 'none'; },
      };
      const widget = document.createElement('div');
      widget.innerHTML = '<script data-sixmm-support-widget="true"></script><button id="cs-widget-bubble">Support</button><div id="cs-widget-container" style="display:none;position:relative;width:340px;height:450px"><iframe src="/frame"></iframe></div>';
      while (widget.firstChild) document.body.appendChild(widget.firstChild);
      window.originalSupportFrame = document.querySelector('#cs-widget-container iframe');
      document.getElementById('cs-widget-bubble').onclick = () => window.CSWidget.open();
      const nativeTimeout = window.setTimeout;
      window.setTimeout = function (callback, delay, ...args) {
        if (delay === 12000) {
          window.expireSupportDeadline = callback;
          return nativeTimeout(callback, 120000, ...args);
        }
        return nativeTimeout(callback, delay, ...args);
      };
      function applyTheme(theme) {
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(theme);
      }
      window.addEventListener('storage', event => {
        if (event.key === 'theme') applyTheme(event.newValue);
      });
      const theme = document.getElementById('theme');
      if (theme) theme.onclick = () => applyTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark');
      document.addEventListener('click', event => {
        const link = event.target.closest('a');
        if (!link?.hidden) return;
        event.preventDefault();
        history.pushState({}, '', link.href);
        document.querySelector('article').textContent = 'Document ' + location.pathname;
        document.dispatchEvent(new Event('astro:page-load'));
      }, true);
    }, { markup, locales, mobile });
    await page.addStyleTag({ content: css });
    for (const content of scripts) await page.addScriptTag({ content });
    await page.evaluate(() => document.dispatchEvent(new Event('astro:page-load')));
    await flush(page);
    await exercise(page);
    assert.deepEqual(errors, [], 'Custom scripts must not throw browser errors');
    assert.deepEqual(unexpectedRequests, [], 'Fixtures must not contact production services');
  } finally {
    await page.close();
  }
}
