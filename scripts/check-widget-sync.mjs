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
    requestAnimationFrame() {},
  },
  document: {
    readyState: "loading",
    addEventListener() {},
    documentElement: {},
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
  querySelector(selector) {
    return selector.includes("data-sixmm-support-widget") ? {} : null;
  },
  body: { appendChild() {} },
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

function emitWidgetLanguage(lang) {
  listeners["cs-widget-lang-change"]({ detail: { lang } });
}

function completeDocsNavigation(pathname) {
  sandboxWindow.location.pathname = pathname;
  intervals[0]();
}

// Widget -> Docs: navigate the host and never write the language back.
for (const [widgetLocale, docsLocale, pathname] of [
  ["pt", "pt", "/pt/home"],
  ["uz", "uz", "/uz/home"],
  ["fil", "fil", "/fil/home"],
  ["az", "az", "/az/home"],
  ["es-AR", "es-419", "/es-419/home"],
  ["en-Asia", "", "/home"],
]) {
  widgetCalls.length = 0;
  emitWidgetLanguage(widgetLocale);
  assert.equal(docsLanguageNavigations.at(-1), docsLocale);
  completeDocsNavigation(pathname);
  assert.deepEqual(widgetCalls, []);
}

// A stale A request cannot clear a newer A marker in a rapid A -> B -> A switch.
const originalNavigateDocsLocale = sandboxWindow.__sixmmNavigateDocsLocale;
const deferredNavigations = [];
sandboxWindow.__sixmmNavigateDocsLocale = (locale) => {
  docsLanguageNavigations.push(locale);
  return new Promise((resolve) => {
    deferredNavigations.push(resolve);
  });
};
widgetCalls.length = 0;
emitWidgetLanguage("az");
emitWidgetLanguage("fil");
emitWidgetLanguage("az");
deferredNavigations[0](false);
await Promise.resolve();
completeDocsNavigation("/az/home");
assert.deepEqual(widgetCalls, []);
deferredNavigations.slice(1).forEach((resolve) => resolve(false));
sandboxWindow.__sixmmNavigateDocsLocale = originalNavigateDocsLocale;

// Docs -> Widget: every published Docs locale calls the exact Widget locale.
for (const locale of [
  ...browserLocales.filter((item) => item.code),
  browserLocales.find((item) => !item.code),
]) {
  widgetCalls.length = 0;
  completeDocsNavigation(`${locale.code ? `/${locale.code}` : ""}/home`);
  assert.deepEqual(widgetCalls, [["lang", locale.widget]]);
}

// Multi-step Widget -> Docs navigation ignores intermediate Fern routes.
widgetCalls.length = 0;
emitWidgetLanguage("uz");
listeners["sixmm-docs-locale-navigation-start"]({
  detail: { id: 101, locale: "uz" },
});
completeDocsNavigation("/resources/overview");
completeDocsNavigation("/uz/home");
listeners["sixmm-docs-locale-navigation-settled"]({
  detail: { id: 101, locale: "uz", success: true },
});
assert.deepEqual(widgetCalls, []);

// Multi-step Docs -> Widget navigation sends only the final locale.
widgetCalls.length = 0;
listeners["sixmm-docs-locale-navigation-start"]({
  detail: { id: 102, locale: "fil" },
});
completeDocsNavigation("/resources/overview");
completeDocsNavigation("/fil/home");
listeners["sixmm-docs-locale-navigation-settled"]({
  detail: { id: 102, locale: "fil", success: true },
});
assert.deepEqual(widgetCalls, [["lang", "fil"]]);

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

// Fern adapter: wait for and click the native language anchor and theme item.
let activeMenu = null;
let activeThemeIcon = "light";
const adapterRootClasses = new Set(["light"]);
const adapterRoot = {
  dataset: { theme: "light" },
  classList: {
    contains(value) {
      return adapterRootClasses.has(value);
    },
  },
};
const adapterWindow = {
  location: { origin: "https://docs.6mm.com", pathname: "/home" },
  addEventListener() {},
  requestAnimationFrame(listener) {
    listener();
  },
  setTimeout,
  clearTimeout,
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
  offsetParent: {},
  dataset: { state: "closed" },
  getClientRects: () => [1],
  getAttribute(name) {
    if (name === "aria-controls") return "language-menu";
    if (name === "aria-expanded") return activeMenu === languageMenu ? "true" : "false";
    return null;
  },
  click() {
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

function routeLink(pathname) {
  return {
    href: `https://docs.6mm.com${pathname}`,
    isConnected: true,
    click() {
      adapterWindow.location.pathname = pathname;
    },
  };
}

const resourcesTabLink = routeLink("/resources/overview");
const uzStandaloneLink = routeLink("/uz/home");

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
    if (selector === ".fern-language-selector") return [languageSelector];
    if (selector.includes(".sixmm-theme-trigger")) return [themeTrigger];
    if (
      selector.includes("#fern-sidebar-scroll-area") &&
      selector.includes('[role="tab"]')
    ) {
      return adapterWindow.location.pathname === "/resources/overview"
        ? [resourcesTabLink, uzStandaloneLink]
        : [resourcesTabLink];
    }
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
  MutationObserver: AdapterMutationObserver,
  URL,
  Promise,
};
runInNewContext(languageScript, adapterSandbox);
assert.equal(
  await adapterWindow.__sixmmNavigateDocsLocale("uz"),
  true,
);
assert.equal(adapterWindow.location.pathname, "/uz/home");
activeMenu = null;
assert.equal(
  await adapterWindow.__sixmmNavigateDocsTheme("dark"),
  true,
);
assert.equal(adapterRoot.dataset.theme, "dark");
assert.equal(activeThemeIcon, "dark");

console.log("Widget sync checks passed: language and theme are bidirectional without echo.");
