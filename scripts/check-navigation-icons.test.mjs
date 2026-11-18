import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, copyFile, symlink, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
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

test("CLI path aliases execute validation while imports remain side-effect free", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "sixmm-navigation-entry-"));
  try {
    await mkdir(path.join(root, "scripts"));
    await mkdir(path.join(root, "fern"));
    await copyFile(new URL("./check-navigation-icons.mjs", import.meta.url), path.join(root, "scripts/check.mjs"));
    await symlink("check.mjs", path.join(root, "scripts/linked-check.mjs"));
    await symlink("scripts/check.mjs", path.join(root, "linked-check.mjs"));
    await symlink(fileURLToPath(new URL("../node_modules", import.meta.url)), path.join(root, "node_modules"), "dir");
    const entries = [
      ["scripts/check.mjs"], [path.join(root, "scripts/check.mjs")],
      ["scripts/linked-check.mjs"], ["--preserve-symlinks-main", "scripts/linked-check.mjs"],
      ["linked-check.mjs"], ["--preserve-symlinks-main", "linked-check.mjs"],
    ];
    for (const valid of [true, false]) {
      await writeFile(path.join(root, "fern/docs.yml"), JSON.stringify({
        translations: [{ lang: "en", default: true }],
        navigation: [tab("home", [page("One", "fa-house"), page("Two", valid ? "fa-book" : "fa-house")])],
      }));
      let reference;
      for (const args of entries) {
        const result = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8", timeout: 10_000 });
        assert.equal(result.status, valid ? 0 : 1, `${args.join(" ")}: ${result.stderr}`);
        assert.match(result.stdout + result.stderr, valid ? /Navigation icons verified/ : /duplicate fa-house/);
        const output = { stdout: result.stdout, stderr: result.stderr };
        reference ??= output;
        assert.deepEqual(output, reference);
      }
    }
    // Missing config makes any accidental CLI execution during import fail.
    await rm(path.join(root, "fern"), { recursive: true });
    const consumer = 'import { inspectNavigationIcons } from "./scripts/check.mjs"; console.log(typeof inspectNavigationIcons);';
    await writeFile(path.join(root, "consumer.mjs"), consumer);
    for (const args of [["consumer.mjs"], ["--input-type=module", "--eval", consumer], ["--input-type=module", "-"]]) {
      const result = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8", input: consumer, timeout: 10_000 });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout, "function\n");
      assert.equal(result.stderr, "");
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
