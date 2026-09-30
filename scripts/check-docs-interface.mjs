import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const script = await readFile(new URL("../fern/docs-interface.js", import.meta.url), "utf8");
const callbacks = [];
const listeners = {};
let observerCount = 0;
const observerCallbacks = [];
let fullWalks = 0;
let islandReady = false;
let layoutReady = false;
const layoutIsland = { hasAttribute: () => layoutReady };
const island = { hasAttribute: () => islandReady, parentElement: { closest: () => layoutIsland } };
const hydratedAncestor = (selector) => selector === "astro-island" ? island : null;
const link = { href: "https://github.com/6mm-com/docs/blob/main/fern/docs/pages/prediction/overview.mdx?plain=1" };
const heading = { tagName: "H2", id: "رحلة-المشاركة", dataset: {} };
const marker = { nextElementSibling: heading, getAttribute: () => "the-participation-journey" };
let sectionHref = "#" + encodeURIComponent(heading.id);
const sectionLink = { getAttribute: () => sectionHref, setAttribute: (_, value) => { sectionHref = value; } };
link.closest = heading.closest = sectionLink.closest = hydratedAncestor;
const nodes = [
  { nodeValue: "Search", parentElement: { closest: hydratedAncestor } },
  { nodeValue: "Copy page", parentElement: { closest: hydratedAncestor } },
  { nodeValue: "Search", parentElement: { closest: (selector) => selector === "main article" ? {} : null } },
  { nodeValue: "Copy to clipboard", parentElement: { closest: (selector) => selector === "main article" || selector === "button, .fern-page-actions" ? {} : null } },
  { nodeValue: "编辑此页面", parentElement: { closest: hydratedAncestor } },
];
const attributes = new Map([["aria-label", "Search"]]);
const input = {
  classList: { contains: () => false },
  closest: hydratedAncestor,
  getAttribute: (name) => attributes.get(name) ?? null,
  setAttribute: (name, value) => attributes.set(name, value),
};
const uiRoot = { isConnected: true, classList: { contains: () => false }, closest: hydratedAncestor, querySelectorAll: () => [input], getAttribute: () => null };
let disabled = "true";
const window = {
  location: { pathname: "/ar/prediction/overview" },
  __sixmmDocsLocales: [{ code: "" }, { code: "ar" }, { code: "zh-CN" }, { code: "ja" }],
  requestAnimationFrame: (callback) => callbacks.push(callback),
  addEventListener: (name, callback) => { listeners[name] = callback; },
};
const document = {
  readyState: "complete", documentElement: { lang:"ar" }, body: {},
  getElementById: () => ({ getAttribute: () => disabled }),
  querySelectorAll: (selector) => {
    if (selector.startsWith('#fern-header')) { fullWalks++; return [uiRoot]; }
    if (selector.startsWith('a[data-astro-prefetch')) return [];
    if (selector === "[data-sixmm-canonical-anchor]") return [marker];
    if (selector === 'a[href^="#"]') return [sectionLink];
    return selector.startsWith("a[") ? [link] : [input];
  },
  createTreeWalker() { let index = 0; return { nextNode: () => nodes[index++] ?? null }; },
  addEventListener: (name, callback) => { listeners[name] = callback; },
};
const sandbox = {
  window, document, URL, NodeFilter: { SHOW_TEXT: 4 },
  MutationObserver: class {
    constructor(callback) { observerCount++; observerCallbacks.push(callback); }
    observe() {} disconnect() {}
  },
};
function flush() { while (callbacks.length) callbacks.shift()(); }
runInNewContext(script, sandbox);
flush();
assert.equal(nodes[0].nodeValue, "Search", "Do not mutate text while React hydration is pending");
disabled = "false";
listeners.load();
flush();
assert.equal(nodes[0].nodeValue, "Search", "An incoming locale island must finish mounting before text changes");
assert.equal(attributes.get("aria-label"), "Search");
assert.equal(sectionHref, "#" + encodeURIComponent(heading.id), "TOC server markup must survive pending island hydration");
islandReady = true;
listeners["fern:island-hydrated"]();
flush();
assert.equal(nodes[0].nodeValue, "Search", "A child island cannot alter markup while its parent layout is still hydrating");
layoutReady = true;
listeners["fern:island-hydrated"]();
flush();
assert.equal(nodes[0].nodeValue, "بحث");
assert.equal(nodes[1].nodeValue, "نسخ الصفحة");
assert.equal(nodes[2].nodeValue, "Search", "Article, code and embedded applications must remain unchanged");
assert.equal(nodes[3].nodeValue, "نسخ إلى الحافظة", "Code toolbar controls inside articles must be localized");
assert.equal(attributes.get("aria-label"), "بحث");
assert.equal(heading.dataset.sixmmAnchorTarget, undefined);
assert.equal(sectionHref, "#" + encodeURIComponent(heading.id), "Keep Fern's native TOC markup and click handlers unchanged");
assert.equal(link.href, "https://github.com/6mm-com/docs/blob/main/fern/translations/ar/docs/pages/prediction/overview.mdx?plain=1");
for (const [prefix, expected] of [["zh-CN", "translations/zh-CN/"], ["ja", "translations/ja/"], ["", ""]]) {
  window.location.pathname = "/" + (prefix ? prefix + "/" : "") + "prediction/overview";
  listeners["astro:page-load"]();
  flush();
  assert.equal(link.href, "https://github.com/6mm-com/docs/blob/main/fern/" + expected + "docs/pages/prediction/overview.mdx?plain=1");
}
runInNewContext(script, sandbox);
assert.equal(observerCount, 2, 'Keep one scoped UI observer and one portal discovery observer');
window.location.pathname = '/zh-CN/sdk/overview';
listeners['astro:page-load'](); flush();
assert.equal(nodes[0].nodeValue, '搜索', 'Cross-locale navigation updates previously localized labels');
assert.equal(nodes[2].nodeValue, 'Search', 'Article text is never translated by the UI bridge');
window.location.pathname = '/sdk/overview';
listeners['astro:page-load'](); flush();
assert.equal(nodes[0].nodeValue, 'Search', 'Returning to English must restore labels');
window.__sixmmPrepareInterfaceSwap(document,'zh-CN');
assert.equal(nodes[0].nodeValue,'Search','Unsupported initial UI languages normalize to Fern native English before hydration');
assert.equal(nodes[4].nodeValue,'Edit this page','Normalize the GitHub edit label before lazy footer hydration');
nodes[4].nodeValue='在仪表板中编辑';
window.__sixmmPrepareInterfaceSwap(document,'zh-CN');
assert.equal(nodes[4].nodeValue,'Edit this page','Both native edit label variants share the English key');
nodes.push({ nodeValue: 'Light', parentElement: { closest: hydratedAncestor } });
window.__sixmmDocsLocales.push({ code: 'de' }, { code: 'id' }, { code: 'uk' }, { code: 'vi' });
window.location.pathname = '/de/sdk/overview'; listeners['astro:page-load'](); flush();
assert.equal(nodes.at(-1).nodeValue, 'Hell', 'Hydrated theme controls use the selected locale');
window.__sixmmPrepareInterfaceSwap(document, 'de');
assert.equal(nodes.at(-1).nodeValue, 'Light', 'Added theme translations must normalize back to native markup before hydration');
for (const [lang, expected] of [['id', 'Asisten'], ['uk', 'Помічник'], ['vi', 'Trợ lý']]) {
  nodes[1].nodeValue = 'Assistant';
  window.location.pathname = '/' + lang + '/sdk/overview'; listeners['astro:page-load'](); flush();
  assert.equal(nodes[1].nodeValue, expected);
}
const previousWalks = fullWalks;
nodes[0].nodeValue = 'Search';
observerCallbacks[0]([{ target: { nodeType: 1, closest: () => uiRoot } }]); flush();
assert.equal(fullWalks, previousWalks, 'A changed control must not trigger another whole-document lookup');
assert.equal(nodes[0].nodeValue, 'Tìm kiếm');
const beforeLocaleWalks = fullWalks;
window.location.pathname = '/zh-CN/sdk/overview';
listeners['astro:page-load']();
observerCallbacks[0]([{ target: { nodeType: 1, closest: () => uiRoot } }]);
flush();
assert.ok(fullWalks > beforeLocaleWalks, 'A control mutation cannot downgrade a pending full locale update');
assert.equal(nodes[0].nodeValue, '搜索');
console.log("Docs interface regression checks passed: locale edit links, reversible labels, hydration guard and scoped singleton lifecycle.");
