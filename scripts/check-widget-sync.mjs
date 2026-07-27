import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { runInNewContext } from "node:vm";

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const supportScript = await readFile(
  path.join(projectRoot, "fern", "support-widget.js"),
  "utf8",
);
const languageScript = await readFile(
  path.join(projectRoot, "fern", "language-modal.js"),
  "utf8",
);

const localeSandbox = {
  window: {
    addEventListener() {},
    location: { pathname: "/home" },
    requestAnimationFrame() {},
  },
  document: {
    readyState: "loading",
    addEventListener() {},
    documentElement: { dataset: {} },
  },
  MutationObserver: class {
    observe() {}
  },
  URL,
};
runInNewContext(languageScript, localeSandbox);
const browserLocales = localeSandbox.window.__sixmmDocsLocales;

const listeners = {};
const intervals = [];
const observers = [];
const widgetCalls = [];
const docsLanguageNavigations = [];
const docsThemeNavigations = [];
const rootClasses = new Set(["light"]);
let appendedWidgetScript = null;

const documentElement = {
  dataset: { theme: "light" },
  style: {},
  classList: {
    contains(value) {
      return rootClasses.has(value);
    },
    add(value) {
      rootClasses.add(value);
    },
    remove(...values) {
      values.forEach((value) => rootClasses.delete(value));
    },
  },
};

const sandboxWindow = {
  location: { pathname: "/home" },
  __sixmmDocsLocales: browserLocales,
  CSWidget: {
    setLang(value) {
      widgetCalls.push(["lang", value]);
    },
    setTheme(value) {
      widgetCalls.push(["theme", value]);
    },
  },
  addEventListener(name, listener) {
    listeners[name] = listener;
  },
  setInterval(listener) {
    intervals.push(listener);
  },
  setTimeout(listener) {
    listener();
  },
  getComputedStyle() {
    return { getPropertyValue: () => "" };
  },
  localStorage: { setItem() {} },
  __sixmmNavigateDocsLocale(locale) {
    docsLanguageNavigations.push(locale);
    return true;
  },
  __sixmmNavigateDocsTheme(theme) {
    docsThemeNavigations.push(theme);
    documentElement.dataset.theme = theme;
    rootClasses.delete(theme === "dark" ? "light" : "dark");
    rootClasses.add(theme);
    return true;
  },
};
sandboxWindow.window = sandboxWindow;

const sandboxDocument = {
  readyState: "complete",
  documentElement,
  querySelector() {
    return null;
  },
  body: {
    appendChild(element) {
      appendedWidgetScript = element;
    },
  },
  createElement() {
    return { dataset: {} };
  },
};

class SandboxMutationObserver {
  constructor(listener) {
    this.listener = listener;
    observers.push(this);
  }
  observe() {}
}

runInNewContext(supportScript, {
  window: sandboxWindow,
  document: sandboxDocument,
  MutationObserver: SandboxMutationObserver,
});

assert.ok(appendedWidgetScript, "The support Widget script must be appended");
appendedWidgetScript.onload();
assert.deepEqual(widgetCalls, [
  ["lang", "en"],
  ["theme", "light"],
]);
widgetCalls.length = 0;

function emitWidgetLanguage(lang) {
  listeners["cs-widget-lang-change"]({ detail: { lang } });
}

function completeDocsNavigation(pathname) {
  sandboxWindow.location.pathname = pathname;
  intervals[0]();
}

// Widget -> Docs: navigate the host and never write the language back.
for (const [widgetLocale, docsLocale, pathname] of [
  ["pt", "pt-PT", "/pt-PT/home"],
  ["es", "es-ES", "/es-ES/home"],
  ["es-AR", "es-419", "/es-419/home"],
  ["en-Asia", "", "/home"],
]) {
  widgetCalls.length = 0;
  emitWidgetLanguage(widgetLocale);
  assert.equal(docsLanguageNavigations.at(-1), docsLocale);
  completeDocsNavigation(pathname);
  assert.deepEqual(widgetCalls, []);
  await Promise.resolve();
  assert.deepEqual(widgetCalls, []);
}

// Every pathname observed while Widget -> Docs navigation is still pending is
// internal. Neither an intermediate nor the final pathname may echo to Widget.
const originalNavigateDocsLocale = sandboxWindow.__sixmmNavigateDocsLocale;
let resolvePendingWidgetNavigation;
sandboxWindow.__sixmmNavigateDocsLocale = (locale) => {
  docsLanguageNavigations.push(locale);
  return new Promise((resolve) => {
    resolvePendingWidgetNavigation = resolve;
  });
};
widgetCalls.length = 0;
emitWidgetLanguage("fr");
completeDocsNavigation("/fr/loading");
completeDocsNavigation("/fr/home");
assert.deepEqual(widgetCalls, []);
resolvePendingWidgetNavigation(true);
await Promise.resolve();
assert.deepEqual(widgetCalls, []);

// A stale A request cannot clear a newer A marker in a rapid A -> B -> A switch.
const deferredNavigations = [];
sandboxWindow.__sixmmNavigateDocsLocale = (locale) => {
  docsLanguageNavigations.push(locale);
  return new Promise((resolve) => {
    deferredNavigations.push(resolve);
  });
};
widgetCalls.length = 0;
emitWidgetLanguage("ja");
emitWidgetLanguage("fr");
emitWidgetLanguage("ja");
deferredNavigations[0](false);
await Promise.resolve();
completeDocsNavigation("/ja/home");
assert.deepEqual(widgetCalls, []);
deferredNavigations.slice(1).forEach((resolve) => resolve(false));
await new Promise((resolve) => setImmediate(resolve));
sandboxWindow.__sixmmNavigateDocsLocale = originalNavigateDocsLocale;

// Docs -> Widget: intermediate and final paths for one locale write that
// Widget language only once.
widgetCalls.length = 0;
completeDocsNavigation("/pt-PT/loading");
completeDocsNavigation("/pt-PT/home");
assert.deepEqual(widgetCalls, [["lang", "pt"]]);

// Docs -> Widget: every published Docs locale selects its mapped Widget locale.
let expectedWidgetLanguage = "pt";
for (const locale of [
  ...browserLocales.filter((item) => item.code),
  browserLocales.find((item) => !item.code),
]) {
  widgetCalls.length = 0;
  completeDocsNavigation(`${locale.code ? `/${locale.code}` : ""}/home`);
  assert.deepEqual(
    widgetCalls,
    locale.widget === expectedWidgetLanguage ? [] : [["lang", locale.widget]],
  );
  expectedWidgetLanguage = locale.widget;
}

// Docs locales unsupported by Support use English in the Widget.
widgetCalls.length = 0;
completeDocsNavigation("/fr/home");
completeDocsNavigation("/tr/home");
assert.deepEqual(widgetCalls, [["lang", "fr"], ["lang", "en"]]);

// Widget locales unsupported by Docs navigate the host to English.
emitWidgetLanguage("th");
assert.equal(docsLanguageNavigations.at(-1), "");

// A supported Widget locale still navigates to its matching Docs locale.
emitWidgetLanguage("de");
assert.equal(docsLanguageNavigations.at(-1), "de");

// Widget -> Docs theme: update the host without writing setTheme back.
widgetCalls.length = 0;
listeners["cs-widget-theme-change"]({ detail: { theme: "dark" } });
observers[0].listener();
assert.equal(documentElement.dataset.theme, "dark");
assert.equal(docsThemeNavigations.at(-1), "dark");
assert.deepEqual(widgetCalls, []);

// Docs -> Widget theme: a host theme change calls setTheme exactly once.
rootClasses.delete("dark");
rootClasses.add("light");
documentElement.dataset.theme = "light";
observers[0].listener();
assert.deepEqual(widgetCalls, [["theme", "light"]]);

// Fern adapter: use the mounted Next.js router for locales and the native item
// for themes.
let activeMenu = null;
let activeThemeIcon = "light";
let languageTriggerClicks = 0;
const directRouterNavigations = [];
const directRouterRefreshes = [];
const adapterRootClasses = new Set(["light"]);
const adapterStorage = new Map([["theme", "light"]]);
const adapterStorageEvents = [];
const adapterRoot = {
  dataset: { theme: "light" },
  classList: {
    contains(value) {
      return adapterRootClasses.has(value);
    },
  },
};
const adapterWindow = {
  location: {
    href: "https://docs.6mm.com/home",
    origin: "https://docs.6mm.com",
    pathname: "/home",
    search: "",
    hash: "",
  },
  addEventListener() {},
  dispatchEvent(event) {
    if (event.type !== "storage" || event.key !== "theme") return true;
    adapterStorageEvents.push(event);
    adapterRoot.dataset.theme = event.newValue;
    adapterRootClasses.clear();
    adapterRootClasses.add(event.newValue);
    return true;
  },
  localStorage: {
    getItem(key) {
      return adapterStorage.get(key) ?? null;
    },
    setItem(key, value) {
      adapterStorage.set(key, value);
    },
  },
  requestAnimationFrame(listener) {
    listener();
  },
  setTimeout,
  clearTimeout,
};
const directRouter = {
  push() {},
  prefetch() {},
  replace(url, options) {
    directRouterNavigations.push([url, options]);
    const target = new URL(url, adapterWindow.location.origin);
    adapterWindow.location.pathname = target.pathname;
    adapterWindow.location.search = target.search;
    adapterWindow.location.hash = target.hash;
  },
  refresh() {
    directRouterRefreshes.push(adapterWindow.location.pathname);
  },
};
const mountedFernLink = {
  href: "/home",
  __reactFiber$test: {
    dependencies: {
      firstContext: {
        memoizedValue: directRouter,
        next: null,
      },
    },
    return: null,
  },
};

function makeClassList() {
  const values = new Set();
  return {
    contains(value) {
      return values.has(value);
    },
    add(value) {
      values.add(value);
    },
  };
}

const localeAnchors = browserLocales.map((locale) => {
  const code = locale.code;
  const label = { textContent: locale.label };
  return {
    href: `https://docs.6mm.com${code ? `/${code}` : ""}/home`,
    isConnected: true,
    dataset: {},
    matches(selector) {
      return selector === "a[href]";
    },
    querySelector(selector) {
      return selector === ".fern-language-dropdown-item-label" ? label : null;
    },
    click() {
      adapterWindow.location.pathname = `${code ? `/${code}` : ""}/home`;
    },
  };
});
const languageGroup = {
  querySelectorAll() {
    return localeAnchors;
  },
  appendChild() {},
};
const languageMenu = {
  isConnected: true,
  offsetParent: {},
  getClientRects: () => [1],
  classList: makeClassList(),
  firstChild: null,
  querySelector(selector) {
    return selector === ".fern-language-selector-radio-group"
      ? languageGroup
      : null;
  },
  querySelectorAll() {
    return localeAnchors;
  },
  insertBefore() {},
};
const languageSelector = {
  isConnected: true,
  offsetParent: null,
  dataset: { state: "closed" },
  getClientRects: () => [],
  getAttribute(name) {
    if (name === "aria-controls") return "language-menu";
    if (name === "aria-expanded") return activeMenu === languageMenu ? "true" : "false";
    return null;
  },
  click() {
    languageTriggerClicks += 1;
    activeMenu = languageMenu;
    this.dataset.state = "open";
  },
};

const themeOptions = ["light", "dark"].map((theme) => ({
  isConnected: true,
  textContent: theme,
  querySelector() {
    return null;
  },
  click() {
    activeThemeIcon = theme;
    adapterRoot.dataset.theme = theme;
    adapterRootClasses.clear();
    adapterRootClasses.add(theme);
  },
}));
const themeMenu = {
  isConnected: true,
  offsetParent: {},
  getClientRects: () => [1],
  querySelectorAll() {
    return themeOptions;
  },
};
const themeTrigger = {
  isConnected: true,
  offsetParent: {},
  dataset: { state: "closed" },
  getClientRects: () => [1],
  getAttribute(name) {
    if (name === "aria-controls") return "theme-menu";
    if (name === "aria-expanded") return activeMenu === themeMenu ? "true" : "false";
    return null;
  },
  querySelector(selector) {
    return selector.includes(
      `lucide-${activeThemeIcon === "dark" ? "moon" : "sun"}`,
    )
      ? {}
      : null;
  },
  click() {
    activeMenu = themeMenu;
    this.dataset.state = "open";
  },
};

const adapterDocument = {
  readyState: "loading",
  documentElement: adapterRoot,
  addEventListener() {},
  createElement() {
    return { className: "", textContent: "" };
  },
  getElementById(id) {
    if (id === "language-menu" && activeMenu === languageMenu) return languageMenu;
    if (id === "theme-menu" && activeMenu === themeMenu) return themeMenu;
    return null;
  },
  querySelectorAll(selector) {
    if (selector === "a[href]") return [mountedFernLink];
    if (selector === ".fern-language-selector") return [languageSelector];
    if (selector === ".fern-language-selector + button") return [themeTrigger];
    if (selector.includes(".fern-language-dropdown-content")) {
      return activeMenu ? [activeMenu] : [];
    }
    return [];
  },
};
class AdapterMutationObserver {
  observe() {}
  disconnect() {}
}
const adapterSandbox = {
  window: adapterWindow,
  document: adapterDocument,
  StorageEvent: class {
    constructor(type, init) {
      this.type = type;
      Object.assign(this, init);
    }
  },
  MutationObserver: AdapterMutationObserver,
  URL,
  Promise,
};
runInNewContext(languageScript, adapterSandbox);
assert.equal(
  adapterRoot.dataset.sixmmDocsLocale,
  "en",
  "The pathname locale must be set before DOMContentLoaded to prevent tab flashes",
);
assert.match(
  languageScript,
  /next\.article !== previous\.article/,
  "Locale navigation readiness must accept a replaced article with identical text",
);
assert.match(
  languageScript,
  /\.language-dropdown-trigger \.truncate/,
  "Locale routes must synchronize the Fern trigger label",
);
assert.equal(
  await adapterWindow.__sixmmNavigateDocsLocale("fr"),
  true,
);
assert.equal(adapterWindow.location.pathname, "/fr/home");
assert.equal(directRouterNavigations.at(-1)[0], "/fr/home");
assert.equal(directRouterNavigations.at(-1)[1].scroll, false);
assert.deepEqual(directRouterRefreshes, []);
assert.equal(
  languageTriggerClicks,
  0,
  "Widget locale navigation must not depend on clicking the hidden mobile language selector",
);
adapterWindow.location.search = "?from=widget";
adapterWindow.location.hash = "#example";
assert.equal(
  await adapterWindow.__sixmmNavigateDocsLocale("de"),
  true,
);
assert.equal(adapterWindow.location.pathname, "/de/home");
assert.equal(adapterWindow.location.search, "?from=widget");
assert.equal(adapterWindow.location.hash, "#example");
assert.equal(directRouterNavigations.at(-1)[0], "/de/home?from=widget#example");
assert.deepEqual(directRouterRefreshes, []);

activeMenu = null;
assert.equal(
  await adapterWindow.__sixmmNavigateDocsTheme("dark"),
  true,
);
assert.equal(adapterRoot.dataset.theme, "dark");
assert.equal(activeThemeIcon, "light");
assert.equal(adapterStorage.get("theme"), "dark");
assert.equal(adapterStorageEvents.length, 1);
assert.equal(adapterStorageEvents[0].oldValue, "light");
assert.equal(adapterStorageEvents[0].newValue, "dark");
assert.equal(
  activeMenu,
  null,
  "Widget theme navigation must update Fern state without opening a menu",
);

console.log("Widget sync checks passed: language and theme are bidirectional without echo.");
