import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parse } from "yaml";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fern");
const config = parse(await readFile(path.join(root, "docs.yml"), "utf8"));
const files = new Set();
function collect(value) {
  if (!value || typeof value !== "object") return;
  if (value.path?.startsWith("docs/pages/prediction/")) files.add(value.path);
  Object.values(value).forEach(collect);
}
collect(config.navigation);
const check = process.argv.includes("--check");
const pattern = /^(?:<span[^\r\n]*data-sixmm-canonical-anchor="([^"]+)"[^\r\n]*><\/span>\r?\n(?:\r?\n)?)?(#{2,6}) ([^\r\n]+)\r?$|^<h([2-6]) id="([^"]+)">([^<]*)<\/h[2-6]>\r?$/gm;
function slug(text) {
  return text.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, "").replace(/ /g, "-");
}
function decode(text) {
  return text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}
function sections(content) {
  return [...content.matchAll(pattern)].map((match) => ({
    match, level: match[2]?.length || Number(match[4]),
    id: match[1] || match[5], text: match[3] || decode(match[6]),
    native: Boolean(match[2]), marked: Boolean(match[1]),
  }));
}
let changed = 0;
for (const file of files) {
  const sourcePath = path.join(root, file);
  const source = await readFile(sourcePath, "utf8");
  const seen = new Set();
  const canonical = sections(source).map((heading) => {
    const base = heading.id || slug(heading.text);
    let id = base, suffix = 0;
    while (seen.has(id)) id = base + "-" + (++suffix);
    seen.add(id);
    return { level: heading.level, id };
  });
  for (const locale of config.translations) {
    const targetPath = locale.default ? sourcePath : path.join(root, "translations", locale.lang, file);
    const content = await readFile(targetPath, "utf8");
    const headings = sections(content);
    if (headings.length !== canonical.length) throw new Error("Heading count mismatch: " + locale.lang + ":" + file);
    if (check) {
      headings.forEach((heading, index) => {
        const expected = canonical[index];
        if (!heading.native || !heading.marked || heading.id !== expected.id || heading.level !== expected.level) {
          throw new Error("Unstable native heading anchors: " + locale.lang + ":" + file);
        }
        if (!locale.default && slug(heading.text) !== expected.id && !heading.match[0].includes('id="' + expected.id + '"')) {
          throw new Error("Missing canonical alias: " + locale.lang + ":" + file);
        }
      });
      continue;
    }
    const withoutLegacyAliases = content.replace(/^<span[^\r\n]*data-sixmm-anchor-target="[^"]+"[^\r\n]*><\/span>\r?\n/gm, "");
    let index = 0;
    const output = withoutLegacyAliases.replace(pattern, (...args) => {
      const [original, markerId, marks, markdownText, htmlLevel, htmlId, htmlText] = args;
      const expected = canonical[index++];
      const level = marks?.length || Number(htmlLevel);
      const text = markdownText || decode(htmlText);
      if (level !== expected.level) throw new Error("Heading level mismatch: " + locale.lang + ":" + file);
      const alias = !locale.default && slug(text) !== expected.id ? ' id="' + expected.id + '"' : "";
      return "<span" + alias + ' data-sixmm-canonical-anchor="' + expected.id + '" aria-hidden="true"></span>\n\n'
        + "#".repeat(level) + " " + text;
    });
    if (output !== content) { await writeFile(targetPath, output); changed++; }
  }
}
console.log(check ? "Native TOC and stable anchors verified for " + files.size + " prediction pages in 20 locales." : "Updated " + changed + " prediction documents.");