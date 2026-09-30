import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parse } from "yaml";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fern");
const config = parse(await readFile(path.join(root, "docs.yml"), "utf8"));
const files = new Set();
function collect(value) {
  if (!value || typeof value !== "object") return;
  if (value.path?.startsWith("docs/pages/")) files.add(value.path);
  Object.values(value).forEach(collect);
}
collect(config.navigation);
const check = process.argv.includes("--check");
const pattern = /^(?:<span[^\r\n]*data-sixmm-canonical-anchor="([^"]+)"[^\r\n]*><\/span>\r?\n(?:\r?\n)?)?(#{2,6}) ([^\r\n]+)\r?$|^<h([2-6]) id="([^"]+)">([^\r\n]*)<\/h[2-6]>\r?$/gm;
function slug(text) {
  return text.replace(/<[^>]*>/g, "").trim().toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, "").replace(/ /g, "-");
}
function decode(text) {
  return text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}
function unique(base, seen) {
  let id = base, suffix = 0;
  while (seen.has(id)) id = base + "-" + (++suffix);
  seen.add(id);
  return id;
}
function sections(content) {
  const fences = [...content.matchAll(/^(?:\x60{3,}|~{3,})[^\n]*\n[\s\S]*?^(?:\x60{3,}|~{3,})[ \t]*\r?$/gm)]
    .map((match) => [match.index, match.index + match[0].length]);
  const nativeIds = new Set();
  return [...content.matchAll(pattern)]
    .filter((match) => !fences.some(([start, end]) => match.index >= start && match.index < end))
    .map((match) => {
      const text = (match[3] || decode(match[6])).replace(/\s*<a\b[^>]*><\/a>/g, "");
      return {
        match, level: match[2]?.length || Number(match[4]),
        id: match[1] || match[5], text,
        nativeId: unique(slug(text), nativeIds),
        native: Boolean(match[2]), marked: Boolean(match[1]),
      };
    });
}
const updates = [];
let checkedFiles = 0;
for (const file of files) {
  const sourcePath = path.join(root, file);
  const source = await readFile(sourcePath, "utf8");
  const seen = new Set();
  const canonical = sections(source).map((heading) => ({
    level: heading.level, id: unique(heading.id || heading.nativeId, seen),
  }));
  for (const locale of config.translations) {
    const targetPath = locale.default ? sourcePath : path.join(root, "translations", locale.lang, file);
    const content = await readFile(targetPath, "utf8");
    const clean = check ? content : content.replace(/^<span[^\r\n]*data-sixmm-anchor-target="[^"]+"[^\r\n]*><\/span>\r?\n/gm, "");
    const headings = sections(clean);
    const ids = new Set();
    const resolved = headings.map((heading, index) => {
      // Generated translations may add a related-pages section. Preserve its
      // existing explicit ID instead of pairing it with a source heading.
      const id = heading.id || canonical[index]?.id;
      if (!id || ids.has(id)) throw new Error("Missing or duplicate section ID: " + locale.lang + ":" + file);
      ids.add(id);
      return { heading, id };
    });
    // Native Chinese pages have independently edited section structures.
    // Preserve each document's existing IDs rather than adding missing content.
    checkedFiles++;
    if (check) {
      resolved.forEach(({ heading, id }) => {
        if (!heading.native || !heading.marked || heading.id !== id) throw new Error("Non-native or unstable heading: " + locale.lang + ":" + file);
        if (heading.nativeId !== id && !heading.match[0].includes('id="' + id + '"')) throw new Error("Missing canonical alias: " + locale.lang + ":" + file);
      });
      continue;
    }
    let output = clean;
    for (const { heading, id } of resolved.reverse()) {
      const alias = heading.nativeId !== id ? ' id="' + id + '"' : "";
      const replacement = "<span" + alias + ' data-sixmm-canonical-anchor="' + id + '" aria-hidden="true"></span>\n\n'
        + "#".repeat(heading.level) + " " + heading.text;
      const offset = heading.match.index;
      output = output.slice(0, offset) + replacement + output.slice(offset + heading.match[0].length);
    }
    if (output !== content) updates.push({ targetPath, output });
  }
}
// Validate all translations before writing any documents.
for (const update of updates) await writeFile(update.targetPath, update.output);
console.log(check
  ? "Native TOC and stable anchors verified for " + files.size + " pages, " + checkedFiles + " files in 20 locales."
  : "Updated " + updates.length + " documentation files.");
