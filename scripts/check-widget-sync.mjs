import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { runInNewContext } from "node:vm";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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
let widgetOpenCalls = 0;
const docsLanguageNavigations = [];
const docsThemeNavigations = [];
const rootClasses = new Set(["light"]);
let appendedWidgetScript = null;
const documentListeners = {};
let widgetScriptLoads = 0;
const loadedWidgetScripts = new Set();
const widgetBodyNodes = [];
const widgetHeadNodes = [];
const supportDeadlines = new Map();
let deadlineId = 0;

function widgetNode(tag) {
  const attributes = new Map();
  return {
    tagName: tag.toUpperCase(),
    dataset: {},
    style: {},
    listeners: {},
    children: [],
    appendChild(node) { this.children.push(node); node.parentNode=this; return node; },
    addEventListener(name, listener) { this.listeners[name] = listener; },
    querySelector(selector) { return selector === "iframe" ? this.iframe ?? null : null; },
    click() { this.clicks = (this.clicks || 0) + 1; },
    remove() { this.isConnected = false; const i=widgetBodyNodes.indexOf(this); if(i>=0)widgetBodyNodes.splice(i,1); },
    isConnected: false,
    getAttribute: (name) => attributes.get(name) ?? null,
    setAttribute(name, value) { attributes.set(name, value); },
  };
}

function widgetParent(nodes) {
  return {
    style: fakeStyle(),
    appendChild(node) {
      if (!nodes.includes(node)) nodes.push(node);
      node.parentNode = this;
      node.isConnected = true;
      return node;
    },
  };
}

function fakeStyle() {
  return { getPropertyValue(name) { return this[name] || ''; }, getPropertyPriority() {return '';}, setProperty(name,value) {this[name]=value;} };
}

function findWidgetNode(selector, nodes) {
  if (selector === 'script[data-sixmm-support-widget="true"]') {
    return nodes.find((node) => node.dataset.sixmmSupportWidget === "true") ?? null;
  }
  const match = selector.match(/^\[data-astro-transition-persist="([^"]+)"\]$/);
  return match
    ? nodes.find((node) => node.getAttribute("data-astro-transition-persist") === match[1]) ?? null
    : null;
}

const documentElement = {
  dataset: { theme: "light" },
  style: fakeStyle(),
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
  __sixmmDocsHost: localeSandbox.window.__sixmmDocsHost,
  CSWidget: {
    open() { widgetOpenCalls++; },
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
  clearTimeout(id) { supportDeadlines.delete(id); },
  setTimeout(listener, delay) {
    if (delay === 12000) { const id=++deadlineId; supportDeadlines.set(id,listener); return id; }
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
  addEventListener(name, listener) {
    const previous=documentListeners[name];
    documentListeners[name] = previous ? (event)=>{previous(event);listener(event);} : listener;
  },
  getElementById(id) {
    return [...widgetBodyNodes, ...widgetHeadNodes].find((node) => node.id === id) ?? null;
  },
  querySelector(selector) {
    return findWidgetNode(selector, [...widgetBodyNodes, ...widgetHeadNodes]);
  },
  head: widgetParent(widgetHeadNodes),
  body: widgetParent(widgetBodyNodes),
  createElement: widgetNode,
};
const appendWidgetNode = sandboxDocument.body.appendChild;
sandboxDocument.body.appendChild = function (element) {
  if (element.tagName === "SCRIPT") {
    appendedWidgetScript = element;
    if (!loadedWidgetScripts.has(element)) {
      loadedWidgetScripts.add(element);
      widgetScriptLoads++;
    }
  }
  return appendWidgetNode.call(this, element);
};

class SandboxMutationObserver {
  constructor(listener) {
    this.listener = listener;
    observers.push(this);
  }
  observe(target) { this.target = target; }
  disconnect() { this.target = null; }
}

runInNewContext(supportScript, {
  window: sandboxWindow,
  document: sandboxDocument,
  MutationObserver: SandboxMutationObserver,
  URL,
});

assert.ok(appendedWidgetScript,'The SDK starts loading on page initialization without a click');
assert.equal(appendedWidgetScript.src, "https://cs.6mm.com/widget/widget.js");
assert.equal(appendedWidgetScript.dataset.appKey, "app_-ofLSy2QTO0xAI4pkAiQ3Jch");
assert.equal(appendedWidgetScript.dataset.appId, undefined, "Legacy appId must not replace the SaaS tenant credential");
assert.equal(appendedWidgetScript.dataset.lang, "en");
assert.equal(appendedWidgetScript.dataset.theme, "light");
assert.equal(widgetOpenCalls,0,'Background initialization must not open the support panel');
const launcher = sandboxDocument.getElementById('sixmm-support-launcher');
assert.ok(launcher,'A keyboard-accessible support entry must remain visible before SDK load');
launcher.listeners.click(); launcher.listeners.click();
assert.ok(appendedWidgetScript, 'An early support click reuses the SDK already loading');
assert.equal(widgetScriptLoads,1,'Repeated clicks while loading must not duplicate the SDK');
assert.equal(appendedWidgetScript.dataset.astroExec, "",
  "Astro's script runner must skip the already-executing retained SDK");
appendedWidgetScript.onload();
assert.deepEqual(widgetCalls, [
  ["lang", "en"],
  ["theme", "light"],
]);
widgetCalls.length = 0;

// A delayed SDK must not accumulate independent retry chains for every event.
const originalSupportTimeout = sandboxWindow.setTimeout;
const originalSupportClearTimeout = sandboxWindow.clearTimeout;
const readyWidget = sandboxWindow.CSWidget;
const pendingSyncTimers = new Map();
let syncTimerId = 0;
sandboxWindow.setTimeout = (callback, delay) => {
  assert.equal(delay, 100, 'Keep the SDK synchronization retry interval');
  const id = ++syncTimerId;
  pendingSyncTimers.set(id, callback);
  return id;
};
sandboxWindow.clearTimeout = id => pendingSyncTimers.delete(id);
function runSyncTimers() {
  const timers = [...pendingSyncTimers];
  for (const [id, callback] of timers) {
    if (!pendingSyncTimers.delete(id)) continue;
    callback();
  }
}
sandboxWindow.CSWidget = undefined;
appendedWidgetScript.onload();
for (let event = 0; event < 20; event++) documentListeners['astro:page-load']();
assert.equal(pendingSyncTimers.size, 2);
sandboxWindow.CSWidget = readyWidget;
runSyncTimers();
assert.equal(pendingSyncTimers.size, 0);
assert.deepEqual([...widgetCalls].sort(), [['lang', 'en'], ['theme', 'light']], 'SDK load must still force synchronization of unchanged values');
widgetCalls.length = 0;
sandboxWindow.CSWidget = undefined;
sandboxWindow.location.pathname = '/ja/home';
rootClasses.delete('light'); rootClasses.add('dark');
for (let event = 0; event < 50; event++) documentListeners['astro:page-load']();
assert.equal(pendingSyncTimers.size, 2, 'At most one retry per synchronization direction should remain pending');
for (let attempt = 0; attempt < 19; attempt++) {
  runSyncTimers();
  assert.equal(pendingSyncTimers.size, 2);
}
runSyncTimers();
assert.equal(pendingSyncTimers.size, 0, 'Stop after the existing 20 retries');
documentListeners['astro:page-load']();
sandboxWindow.CSWidget = readyWidget;
runSyncTimers();
assert.equal(pendingSyncTimers.size, 0);
assert.deepEqual([...widgetCalls].sort(), [['lang', 'ja'], ['theme', 'dark']]);
sandboxWindow.setTimeout = originalSupportTimeout;
sandboxWindow.clearTimeout = originalSupportClearTimeout;
sandboxWindow.location.pathname = '/home';
rootClasses.delete('dark'); rootClasses.add('light');
documentListeners['astro:page-load']();
widgetCalls.length = 0;

function emitWidgetLanguage(lang) {
  listeners["cs-widget-lang-change"]({ detail: { lang } });
}

function completeDocsNavigation(pathname) {
  sandboxWindow.location.pathname = pathname;
  documentListeners['astro:page-load']();
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
observers.find((observer) => observer.target === documentElement).listener();
assert.equal(documentElement.dataset.theme, "dark");
assert.equal(docsThemeNavigations.at(-1), "dark");
assert.deepEqual(widgetCalls, []);

// Docs -> Widget theme: a host theme change calls setTheme exactly once.
rootClasses.delete("dark");
rootClasses.add("light");
documentElement.dataset.theme = "light";
observers.find((observer) => observer.target === documentElement).listener();
assert.deepEqual(widgetCalls, [["theme", "light"]]);

// Reproduce Astro's body replacement. An unmarked widget or one without an
// incoming placeholder is removed; matching persisted nodes keep their identity.
const bubble = widgetNode("div");
bubble.id = "cs-widget-bubble";
const container = widgetNode("div");
container.id = "cs-widget-container";
container.style.display = "none";
container.iframe = Object.assign(widgetNode("iframe"), {
  conversation: "active", draft: "unfinished",
  src: 'https://csadmin.6mm.com/widget/?app_id=6mm-docs', contentWindow: {},
});
const widgetStyle = widgetNode("style");
widgetStyle.id = "cs-bubble-style";
sandboxDocument.body.appendChild(bubble);
sandboxDocument.body.appendChild(container);
sandboxDocument.head.appendChild(widgetStyle);
observers.find((observer) => observer.target === sandboxDocument.body).listener();
assert.equal(widgetOpenCalls,1,'The SDK opens automatically once the first requested panel becomes ready');
const status=container.children.find(node=>node.className==='sixmm-support-status');
assert.equal(status.hidden,false,'Cover the empty iframe until the application mounts');
listeners.message({origin:'https://untrusted.example',source:container.iframe.contentWindow,data:{type:'cs-widget-browser-theme'}});
listeners.message({origin:'https://csadmin.6mm.com',source:{},data:{type:'cs-widget-browser-theme'}});
assert.equal(status.hidden,false,'Ignore readiness messages from another origin or frame');
const [expiredId,expiredCallback]=supportDeadlines.entries().next().value;
supportDeadlines.delete(expiredId);
expiredCallback();
assert.equal(status.dataset.state,'error','A stalled frame shows a recoverable loading failure');
const retry=status.children.find(node=>node.tagName==='BUTTON');
assert.equal(retry.hidden,false);
const localizedStatuses = JSON.parse(supportScript.match(/var statusLabels = (\{[\s\S]*?\n\s*\});/)[1]);
assert.equal(Object.keys(localizedStatuses).length, browserLocales.length);
for (const locale of browserLocales) {
  const code = locale.code || 'en';
  const labels = localizedStatuses[code];
  assert.equal(labels.length, 4, `All support status labels exist for ${code}`);
  completeDocsNavigation(`${locale.code ? `/${locale.code}` : ''}/sdk/overview`);
  assert.equal(retry.textContent, labels[2], `Retry updates without reloading the frame for ${code}`);
  assert.equal(status.children.find(node => node.tagName === 'P').textContent, labels[1]);
  assert.equal(container.iframe.draft, 'unfinished');
}
retry.listeners.click();
assert.equal(status.dataset.state,'loading');
listeners.message({origin:'https://csadmin.6mm.com',source:container.iframe.contentWindow,data:{type:'cs-widget-browser-theme'}});
assert.equal(status.hidden,true,'Reveal content only after the widget application mounts');
assert.equal(supportDeadlines.size,0,'Readiness cancels the pending timeout');
const originalFrame = container.iframe;
let overlay;

for (let navigation = 0; navigation < 3; navigation++) {
  if (navigation === 1) {
    container.style.display = "block";
    overlay=widgetNode('div'); overlay.id='cs-widget-overlay';
    sandboxDocument.body.appendChild(overlay);
    sandboxDocument.body.style.position='fixed'; sandboxDocument.body.style.top='-320px';
    sandboxDocument.body.style.overflow='hidden'; documentElement.style.overflow='hidden';
    emitWidgetLanguage("fr");
    completeDocsNavigation("/fr/home");
    await Promise.resolve();
  }
  const incomingBody = [];
  const incomingHead = [];
  const incoming = {
    body: widgetParent(incomingBody),
    head: widgetParent(incomingHead),
    documentElement:{style:fakeStyle()},
    createElement: widgetNode,
    querySelector: (selector) => findWidgetNode(selector, [...incomingBody, ...incomingHead]),
  };
  documentListeners["astro:before-swap"]({ newDocument: incoming });
  documentListeners["astro:before-swap"]({ newDocument: incoming });
  assert.equal(incomingBody.length, navigation ? 4 : 3, "Repeated swap preparation must not duplicate placeholders");
  assert.equal(incomingHead.length, 1);
  for (const [live, next, parent] of [
    [widgetBodyNodes, incomingBody, sandboxDocument.body],
    [widgetHeadNodes, incomingHead, sandboxDocument.head],
  ]) {
    const persisted = live.filter((node) => next.some(
      (placeholder) => placeholder.getAttribute("data-astro-transition-persist")
        === node.getAttribute("data-astro-transition-persist"),
    ));
    live.forEach((node) => { node.isConnected = false; });
    live.length = 0;
    persisted.forEach((node) => parent.appendChild(node));
  }
  sandboxDocument.body.style=fakeStyle(); documentElement.style=fakeStyle();
  documentListeners["astro:page-load"]();
  if(navigation) {
    assert.equal(sandboxDocument.getElementById('cs-widget-overlay'),overlay,'The active modal overlay must retain its identity and listeners');
    assert.equal(sandboxDocument.body.style.position,'fixed');
    assert.equal(sandboxDocument.body.style.top,'-320px','Preserve the reading position represented by the mobile body lock');
    assert.equal(sandboxDocument.body.style.overflow,'hidden');
    assert.equal(documentElement.style.overflow,'hidden');
  }
  assert.equal(sandboxDocument.getElementById("cs-widget-bubble"), bubble);
  assert.equal(sandboxDocument.getElementById("cs-widget-container"), container);
  assert.equal(sandboxDocument.getElementById("cs-bubble-style"), widgetStyle);
  assert.equal(container.iframe, originalFrame, "Navigation must retain the active iframe");
  assert.equal(container.iframe.draft, "unfinished");
  assert.equal(widgetScriptLoads, 1, "Page navigation must not reload the widget SDK");
  assert.equal(bubble.getAttribute("role"), "button");
  assert.equal(bubble.getAttribute("tabindex"), navigation ? "-1" : "0");
  assert.equal(container.style.display, navigation ? "block" : "none",
    "A widget-initiated language change must retain the open conversation panel");
  assert.ok(bubble.getAttribute("aria-label"));
}
let prevented = 0;
for (const key of ["Enter", " "]) {
  bubble.listeners.keydown({ key, repeat: false, preventDefault() { prevented++; } });
}
assert.equal(bubble.clicks, 2, "Enter and Space activate the retained customer support button");
assert.equal(prevented, 2, "Space must not scroll the document");
container.style.display = "block";
documentListeners["astro:page-load"]();
assert.equal(bubble.getAttribute("tabindex"), "-1", "The invisible entry must not receive keyboard focus while the panel is open");
assert.equal(bubble.getAttribute("aria-expanded"), "true");
const observersBeforeReload = observers.length;
runInNewContext(supportScript, {
  window: sandboxWindow, document: sandboxDocument,
  MutationObserver: SandboxMutationObserver,
});
assert.equal(intervals.length, 0, 'Navigation synchronization must not poll the pathname');
assert.equal(observers.length, observersBeforeReload, "Re-executing the loader must not add accessibility observers");

const containerObserverCount = observers.length;
const bodyObserver = observers.find(observer => observer.target === sandboxDocument.body);
const replacementContainer = widgetNode('div');
replacementContainer.id = container.id;
replacementContainer.iframe = container.iframe;
replacementContainer.style.display = 'none';
for (let cycle = 0; cycle < 5; cycle++) {
  for (const next of [replacementContainer, container]) {
    const index = widgetBodyNodes.findIndex(node => node.id === container.id);
    widgetBodyNodes[index] = next;
    bodyObserver.listener();
    assert.equal(observers.filter(observer => observer.target === container || observer.target === replacementContainer).length, 1,
      'Only the current widget container should remain observed');
    assert.equal(observers.filter(observer => observer.target === next).length, 1);
  }
}
assert.equal(observers.length, containerObserverCount, 'Container replacements must reuse the existing style observer');
const containerIndex = widgetBodyNodes.indexOf(container);
widgetBodyNodes.splice(containerIndex, 1);
bodyObserver.listener();
assert.equal(observers.filter(observer => observer.target === container || observer.target === replacementContainer).length, 0,
  'A removed widget container should no longer be observed');
widgetBodyNodes.splice(containerIndex, 0, container);
bodyObserver.listener();
assert.equal(observers.filter(observer => observer.target === container).length, 1);
assert.equal(observers.length, containerObserverCount);

for (let swap = 0; swap < 3; swap++) {
  const oldBody = sandboxDocument.body;
  sandboxDocument.body = widgetParent(widgetBodyNodes);
  documentListeners['astro:page-load']();
  assert.equal(bodyObserver.target, sandboxDocument.body, 'Observe the current body after navigation');
  assert.equal(observers.some(observer => observer.target === oldBody), false, 'Release the previous body');
  assert.equal(observers.length, containerObserverCount, 'Body replacements must reuse the existing observers');
}

// Fern adapter: navigate through standard links without a React/Next router.
let activeMenu = null;
let activeThemeIcon = "light";
let languageTriggerClicks = 0;
const nativeLinkNavigations = [];
let adapterArticle = { textContent: "English page" };
let replaceAdapterArticle = false;
const adapterRootClasses = new Set(["light"]);
const adapterStorage = new Map([["theme", "light"]]);
const adapterStorageEvents = [];
const adapterTimers = new Map();
let adapterTimerId = 0;
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
  setTimeout(listener, delay) { const id = ++adapterTimerId; adapterTimers.set(id, { listener, delay }); return id; },
  clearTimeout(id) { adapterTimers.delete(id); },
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

const adapterDocumentListeners = {};
const adapterDocument = {
  readyState: "loading",
  documentElement: adapterRoot,
  addEventListener(name, listener) { adapterDocumentListeners[name] = listener; },
  removeEventListener(name, listener) {
    if (adapterDocumentListeners[name] === listener) delete adapterDocumentListeners[name];
  },
  body: { appendChild() {} },
  createElement(tag) {
    if (tag !== "a") return { className: "", textContent: "" };
    return {
      href: "",
      hidden: false,
      setAttribute(name, value) {
        this[name] = value;
      },
      click() {
        assert.equal(this["data-astro-reload"], undefined,
          "Locale navigation must retain the open support iframe instead of reloading the document");
        nativeLinkNavigations.push(this.href);
        const target = new URL(this.href, adapterWindow.location.origin);
        adapterWindow.location.pathname = target.pathname;
        adapterWindow.location.search = target.search;
        adapterWindow.location.hash = target.hash;
        if (replaceAdapterArticle) {
          adapterArticle = { textContent: adapterArticle.textContent };
        } else {
          adapterArticle.textContent = "Page " + target.pathname;
        }
      },
      remove() {},
    };
  },
  querySelector(selector) {
    return selector === "main article" ? adapterArticle : null;
  },
  getElementById(id) {
    if (id === "language-menu" && activeMenu === languageMenu) return languageMenu;
    if (id === "theme-menu" && activeMenu === themeMenu) return themeMenu;
    if (id === "基本参与流程") return { dataset: {}, previousElementSibling: { dataset: { sixmmCanonicalAnchor: "the-participation-journey" } } };
    return null;
  },
  querySelectorAll(selector) {
    if (selector === "a[href]") return [];
    if (selector === ".fern-language-selector") return [languageSelector];
    if (selector === ".fern-language-selector + button") return [themeTrigger];
    if (selector.includes(".fern-language-dropdown-content")) {
      return activeMenu ? [activeMenu] : [];
    }
    return [];
  },
};
const adapterObservers = [];
class AdapterMutationObserver {
  constructor(listener) { this.listener = listener; adapterObservers.push(this); }
  observe() { this.active = true; }
  disconnect() { this.active = false; }
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
const initialAdapterObservers = adapterObservers.length;
const incomingIslandAttributes = new Map([
  ["client", "load"],
  ["opts", JSON.stringify({ name: "PageHeaderIsland", value: true })],
]);
const incomingIsland = {
  innerHTML: "<astro-slot>Localized article content</astro-slot>",
  getAttribute: (name) => incomingIslandAttributes.get(name),
  setAttribute: (name, value) => incomingIslandAttributes.set(name, value),
};
function prepareIncomingLocale(from, to) {
  adapterDocumentListeners["astro:before-swap"]?.({
    from: new URL(from, adapterWindow.location.origin),
    to: new URL(to, adapterWindow.location.origin),
    newDocument: { querySelectorAll: () => [incomingIsland] },
  });
}
for (const strategy of ['load', 'idle', 'visible', 'lazy', 'only']) {
  incomingIslandAttributes.set('client', strategy);
  const before = [...incomingIslandAttributes];
  for (const [from, to] of [
    ['/zh-CN/sdk/overview', '/zh-CN/trading/overview'],
    ['/sdk/overview', '/zh-CN/sdk/overview'],
    ['/zh-CN/sdk/overview', '/ja/sdk/overview'],
  ]) {
    prepareIncomingLocale(from, to);
    assert.deepEqual([...incomingIslandAttributes], before, 'Navigation must preserve Fern SSR hydration options');
    assert.equal(incomingIsland.innerHTML, '<astro-slot>Localized article content</astro-slot>', 'Navigation must preserve incoming content');
  }
}
assert.equal(
  adapterRoot.dataset.sixmmDocsLocale,
  "en",
  "The pathname locale must be set before DOMContentLoaded to prevent tab flashes",
);
assert.match(
  languageScript,
  /\.language-dropdown-trigger \.truncate/,
  "Locale routes must synchronize the Fern trigger label",
);
const oldAdapterArticle = adapterArticle;
replaceAdapterArticle = true;
assert.equal(
  await adapterWindow.__sixmmNavigateDocsLocale("fr"),
  true,
  "Locale navigation readiness must accept a replaced article with identical text",
);
replaceAdapterArticle = false;
assert.notEqual(adapterArticle, oldAdapterArticle);
assert.equal(adapterArticle.textContent, oldAdapterArticle.textContent);
assert.equal(adapterWindow.location.pathname, "/fr/home");
assert.equal(nativeLinkNavigations.at(-1), "/fr/home");
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
assert.equal(nativeLinkNavigations.at(-1), "/de/home?from=widget#example");

adapterWindow.location.pathname = "/zh-CN/prediction/overview";
adapterWindow.location.hash = "#" + encodeURIComponent("基本参与流程");
assert.equal(await adapterWindow.__sixmmNavigateDocsLocale(""), true);
assert.equal(nativeLinkNavigations.at(-1), "/prediction/overview?from=widget#the-participation-journey",
  "An old localized section link must switch languages using its canonical anchor");

adapterWindow.location.pathname = "/";
adapterWindow.location.search = "";
adapterWindow.location.hash = "";
assert.equal(
  await adapterWindow.__sixmmNavigateDocsLocale("ja"),
  true,
);
assert.equal(adapterWindow.location.pathname, "/ja");
assert.equal(nativeLinkNavigations.at(-1), "/ja");
assert.equal(
  await adapterWindow.__sixmmNavigateDocsLocale(""),
  true,
);
assert.equal(adapterWindow.location.pathname, "/");
assert.equal(nativeLinkNavigations.at(-1), "/");

const previousNavigationCount = nativeLinkNavigations.length;
assert.equal(await adapterWindow.__sixmmNavigateDocsLocale(""), true);
assert.equal(await adapterWindow.__sixmmNavigateDocsLocale("unsupported"), false);
assert.equal(nativeLinkNavigations.length, previousNavigationCount,
  "Current and unsupported locales must not start a navigation");
assert.doesNotMatch(languageScript, /__reactFiber|memoizedValue/,
  "Locale switching must work without a private Next router");

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

assert.equal(adapterObservers.length, initialAdapterObservers, 'Completed switches must not create temporary observers');
assert.equal(adapterTimerId, 0, 'Completed switches must not create timeout timers');
const originalDispatch = adapterWindow.dispatchEvent;
adapterWindow.dispatchEvent = () => true;
const delayedTheme = adapterWindow.__sixmmNavigateDocsTheme('light');
assert.equal(adapterTimers.size, 1, 'An unfinished switch still needs a deadline');
const pendingObserver = adapterObservers.at(-1);
adapterRootClasses.clear();
adapterRootClasses.add('light');
pendingObserver.listener();
assert.equal(await delayedTheme, true);
assert.equal(pendingObserver.active, false);
assert.equal(adapterTimers.size, 0);
const timedOutTheme = adapterWindow.__sixmmNavigateDocsTheme('dark');
const [deadline] = adapterTimers.values();
assert.equal(deadline.delay, 2500, 'Preserve the existing theme timeout');
deadline.listener();
assert.equal(await timedOutTheme, false);
assert.equal(adapterObservers.at(-1).active, false);
assert.equal(adapterTimers.size, 0);
adapterWindow.dispatchEvent = originalDispatch;
const originalCreateElement = adapterDocument.createElement;
adapterDocument.createElement = function (tag) {
  const node = originalCreateElement.call(this, tag);
  if (tag === 'a') {
    const click = node.click;
    node.click = function () {
      const previousText = adapterArticle.textContent;
      click.call(this);
      adapterArticle.textContent = previousText;
    };
  }
  return node;
};
const delayedLocale = adapterWindow.__sixmmNavigateDocsLocale('fr');
assert.equal(adapterTimers.size, 1);
assert.equal([...adapterTimers.values()][0].delay, 15000);
const localeObserver = adapterObservers.at(-1);
localeObserver.listener();
assert.equal(adapterTimers.size, 1, 'A new URL alone must not count as loaded page content');
adapterArticle.textContent = 'French page loaded';
localeObserver.listener();
assert.equal(await delayedLocale, true);
assert.equal(localeObserver.active, false);
assert.equal(adapterTimers.size, 0);
const timedOutLocale = adapterWindow.__sixmmNavigateDocsLocale('de');
[...adapterTimers.values()][0].listener();
assert.equal(await timedOutLocale, false);
assert.equal(adapterObservers.at(-1).active, false);
assert.equal(adapterTimers.size, 0);
adapterDocument.createElement = originalCreateElement;

console.log("Widget sync checks passed: language and theme are bidirectional without echo.");
