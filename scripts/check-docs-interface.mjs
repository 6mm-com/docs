import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const script = await readFile(new URL("../fern/docs-interface.js", import.meta.url), "utf8");
const callbacks = [];
const listeners = {};
let observerCount = 0;
const link = { href: "https://github.com/6mm-com/docs/blob/main/fern/docs/pages/prediction/overview.mdx?plain=1" };
const heading = { tagName: "H2", id: "رحلة-المشاركة", dataset: {} };
const marker = { nextElementSibling: heading, getAttribute: () => "the-participation-journey" };
let sectionHref = "#" + encodeURIComponent(heading.id);
const sectionLink = { getAttribute: () => sectionHref, setAttribute: (_, value) => { sectionHref = value; } };
const nodes = [
  { nodeValue: "Search", parentElement: { closest: () => null } },
  { nodeValue: "Copy page", parentElement: { closest: () => null } },
  { nodeValue: "Search", parentElement: { closest: (selector) => selector === "main article" ? {} : null } },
  { nodeValue: "Copy to clipboard", parentElement: { closest: (selector) => selector === "main article" || selector === "button, .fern-page-actions" ? {} : null } },
];
const attributes = new Map([["aria-label", "Search"]]);
const input = {
  closest: () => null,
  getAttribute: (name) => attributes.get(name) ?? null,
  setAttribute: (name, value) => attributes.set(name, value),
};
let disabled = "true";
const window = {
  location: { pathname: "/ar/prediction/overview" },
  __sixmmDocsLocales: [{ code: "" }, { code: "ar" }, { code: "zh-CN" }, { code: "ja" }],
  requestAnimationFrame: (callback) => callbacks.push(callback),
  addEventListener: (name, callback) => { listeners[name] = callback; },
};
const document = {
  readyState: "complete", documentElement: {}, body: {},
  getElementById: () => ({ getAttribute: () => disabled }),
  querySelectorAll: (selector) => {
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
    constructor() { observerCount++; }
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
assert.equal(nodes[0].nodeValue, "بحث");
assert.equal(nodes[1].nodeValue, "نسخ الصفحة");
assert.equal(nodes[2].nodeValue, "Search", "Article, code and embedded applications must remain unchanged");
assert.equal(nodes[3].nodeValue, "نسخ إلى الحافظة", "Code toolbar controls inside articles must be localized");
assert.equal(attributes.get("aria-label"), "بحث");
assert.equal(heading.dataset.sixmmAnchorTarget, "the-participation-journey");
assert.equal(sectionHref, "#the-participation-journey", "Native TOC links must retain cross-language chapter positions");
assert.equal(link.href, "https://github.com/6mm-com/docs/blob/main/fern/translations/ar/docs/pages/prediction/overview.mdx?plain=1");
for (const [prefix, expected] of [["zh-CN", "translations/zh-CN/"], ["ja", "translations/ja/"], ["", ""]]) {
  window.location.pathname = "/" + (prefix ? prefix + "/" : "") + "prediction/overview";
  listeners["astro:page-load"]();
  flush();
  assert.equal(link.href, "https://github.com/6mm-com/docs/blob/main/fern/" + expected + "docs/pages/prediction/overview.mdx?plain=1");
}
runInNewContext(script, sandbox);
assert.equal(observerCount, 1);
console.log("Docs interface regression checks passed: locale edit links, Arabic labels, hydration guard and singleton lifecycle.");
