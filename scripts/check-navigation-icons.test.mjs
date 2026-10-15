import assert from "node:assert/strict";
import test from "node:test";
import { inspectNavigationIcons, mergeNavigationOverlay } from "./check-navigation-icons.mjs";

const page = (name, glyph, family = "fa-duotone") => ({ page: name, icon: `${family} ${glyph}` });
const section = (name, contents) => ({ section: name, contents });
const tab = (name, layout) => ({ tab: name, layout });

test("rejects repeated glyphs across sections in the same tab", () => {
  const result = inspectNavigationIcons([tab("security", [
    section("Overview", [page("Overview", "fa-shield-check")]),
    section("Architecture", [page("Policies", "fa-shield-check")]),
  ])]);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /security \/ Architecture \/ Policies: duplicate fa-shield-check/);
  assert.match(result.errors[0], /Overview \/ Overview/);
});

test("allows reuse across different top-level tabs", () => {
  const result = inspectNavigationIcons([
    tab("security", [section("Overview", [page("Security", "fa-shield-check")])]),
    tab("solutions", [section("Overview", [page("Solutions", "fa-shield-check")])]),
  ]);
  assert.deepEqual(result.errors, []);
  assert.equal(result.tabCount, 2);
});

test("family changes and extra whitespace do not conceal the same glyph", () => {
  const result = inspectNavigationIcons([tab("resources", [section("Brand", [
    page("Guidelines", "fa-palette"),
    { page: "Downloads", icon: "  fa-solid   fa-palette  " },
  ])])]);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /duplicate fa-palette/);
});

test("shares the uniqueness scope across blocks of the same tab and nested sections", () => {
  const result = inspectNavigationIcons([
    tab("sdk", [section("Widget", [page("Quick start", "fa-play")])]),
    tab("sdk", [section("Agent", [section("Java", [page("Quick start", "fa-play")])])]),
  ]);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /sdk \/ Agent \/ Java/);
});

test("rejects missing icons and ambiguous icon classes", () => {
  const result = inspectNavigationIcons([tab("home", [section("Home", [
    { page: "Missing" },
    { page: "Ambiguous", icon: "fa-duotone fa-house fa-star" },
  ])])]);
  assert.equal(result.errors.length, 2);
  assert.ok(result.errors.every((message) => message.includes("missing or invalid")));
});

test("label-only locale overlays inherit the source icons", () => {
  const base = [tab("resources", [section("Brand", [page("Guidelines", "fa-palette"), page("Downloads", "fa-download")])])];
  const overlay = [tab("resources", [section("品牌", [{ page: "使用指南" }, { page: "资源下载" }])])];
  const merged = mergeNavigationOverlay(base, overlay);
  assert.deepEqual(inspectNavigationIcons(merged).errors, []);
  assert.equal(merged[0].layout[0].contents[1].icon, "fa-duotone fa-download");
  assert.equal(base[0].layout[0].section, "Brand");
});

test("detects duplicate icons introduced by a locale override", () => {
  const base = [tab("resources", [section("Brand", [page("Guidelines", "fa-palette"), page("Downloads", "fa-download")])])];
  const overlay = [tab("resources", [section("品牌", [{ page: "使用指南" }, page("资源下载", "fa-palette")])])];
  assert.match(inspectNavigationIcons(mergeNavigationOverlay(base, overlay)).errors[0], /duplicate fa-palette/);
});

test("rejects a misaligned locale overlay instead of skipping source pages", () => {
  assert.throws(() => mergeNavigationOverlay([tab("home", [])], []), /shape differs/);
});
