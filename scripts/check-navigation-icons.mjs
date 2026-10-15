import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Translation overlays inherit icons by position, just as they inherit paths.
// Reject shape changes rather than silently dropping or misaligning pages.
export function mergeNavigationOverlay(base, overlay, location = "navigation") {
  if (overlay === undefined) return base;
  if (Array.isArray(base)) {
    if (!Array.isArray(overlay) || base.length !== overlay.length) {
      throw new Error(`${location}: translation navigation shape differs from the source`);
    }
    return base.map((item, index) => mergeNavigationOverlay(item, overlay[index], `${location}[${index}]`));
  }
  if (base && typeof base === "object") {
    if (!overlay || typeof overlay !== "object" || Array.isArray(overlay)) {
      throw new Error(`${location}: expected a translation navigation object`);
    }
    const merged = { ...base };
    for (const [key, value] of Object.entries(overlay)) {
      merged[key] = mergeNavigationOverlay(base[key], value, `${location}.${key}`);
    }
    return merged;
  }
  return overlay;
}

export function inspectNavigationIcons(navigation) {
  const errors = [];
  const tabs = new Map();
  let pageCount = 0;
  for (const item of navigation ?? []) {
    // A tab may be split into multiple navigation blocks. Share its icon set.
    const tab = item.tab;
    if (!tab) {
      errors.push("Navigation block has no tab; cannot determine icon uniqueness scope");
      continue;
    }
    if (!tabs.has(tab)) tabs.set(tab, new Map());
    const seen = tabs.get(tab);
    function visit(nodes, sections = []) {
      for (const node of nodes ?? []) {
        const sectionPath = node.section ? [...sections, node.section] : sections;
        if (node.page) {
          pageCount++;
          const label = [tab, ...sectionPath, node.page].join(" / ");
          const classes = typeof node.icon === "string" ? node.icon.trim().split(/\s+/) : [];
          const families = new Set(["fa-duotone", "fa-brands", "fa-solid", "fa-regular", "fa-light", "fa-thin"]);
          if (classes.length !== 2 || !families.has(classes[0]) || !/^fa-[a-z0-9-]+$/.test(classes[1])) {
            errors.push(`${label}: missing or invalid Font Awesome icon; use a family and one glyph, e.g. fa-duotone fa-book-open`);
          } else {
            // Compare the glyph, not the complete CSS class string: a different
            // Font Awesome weight/family does not make the same glyph unique.
            const glyph = classes[1];
            if (seen.has(glyph)) {
              errors.push(`${label}: duplicate ${glyph}; already used by ${seen.get(glyph)}`);
            } else {
              seen.set(glyph, label);
            }
          }
        }
        visit(node.contents, sectionPath);
        visit(node.layout, sectionPath);
      }
    }
    visit(item.layout);
  }
  return { errors, tabCount: tabs.size, pageCount };
}

async function main() {
  const fernRoot = path.join(projectRoot, "fern");
  const config = parse(await readFile(path.join(fernRoot, "docs.yml"), "utf8"));
  const allErrors = [];
  let checked = 0;
  let summary;
  for (const locale of config.translations ?? []) {
    const code = locale.lang;
    try {
      const overlay = locale.default ? null : parse(await readFile(path.join(fernRoot, "translations", code, "docs.yml"), "utf8"));
      const navigation = overlay ? mergeNavigationOverlay(config.navigation, overlay.navigation) : config.navigation;
      const result = inspectNavigationIcons(navigation);
      summary ??= result;
      allErrors.push(...result.errors.map((message) => `[${code}] ${message}`));
      checked++;
    } catch (error) {
      allErrors.push(`[${code}] ${error.message}`);
    }
  }
  if (!checked) allErrors.push("No configured navigation locales were checked");
  if (allErrors.length) {
    console.error(`Navigation icon checks failed with ${allErrors.length} issue(s):\n${allErrors.map((message) => `- ${message}`).join("\n")}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Navigation icons verified: ${summary.tabCount} top-level tabs, ${summary.pageCount} sidebar entries per locale, ${checked} locales. Glyphs are unique within each tab across all sections; reuse across different tabs is allowed.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
