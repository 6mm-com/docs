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
const headingPattern = /^(#{2,6}) ([^\r\n]+)\r?$/gm;
const htmlPattern = /<h([2-6]) id="([^"]+)">([^<]*)<\/h[2-6]>/g;
function slug(text) {
  return text.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, "").replace(/ /g, "-");
}
function escape(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
let changed = 0;
for (const file of files) {
  const sourcePath = path.join(root, file);
  const source = await readFile(sourcePath, "utf8");
  const headings = [...source.matchAll(headingPattern)];
  const seen = new Set();
  const canonical = headings.length
    ? headings.map((heading) => {
        const base = slug(heading[2]);
        let id = base, suffix = 0;
        while (seen.has(id)) id = base + "-" + (++suffix);
        seen.add(id);
        return { level: heading[1].length, id };
      })
    : [...source.matchAll(htmlPattern)].map((heading) => ({ level: Number(heading[1]), id: heading[2] }));
  for (const locale of config.translations) {
    const targetPath = locale.default ? sourcePath : path.join(root, "translations", locale.lang, file);
    const content = await readFile(targetPath, "utf8");
    const raw = [...content.matchAll(headingPattern)];
    if (check) {
      const ids = [...content.matchAll(htmlPattern)].map((heading) => heading[2]);
      if (raw.length || canonical.some((heading) => !ids.includes(heading.id))) {
        throw new Error("Unstable prediction heading anchors: " + locale.lang + ":" + file);
      }
      if (!locale.default) {
        for (const heading of content.matchAll(htmlPattern)) {
          const previous = slug(heading[3].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"));
          if (previous !== heading[2] && !content.includes('id="' + previous + '" data-sixmm-anchor-target="' + heading[2] + '"')) {
            throw new Error("Missing localized anchor alias: " + locale.lang + ":" + file);
          }
        }
      }
      continue;
    }
    if (!raw.length) {
      if (locale.default) continue;
      const ids = new Set([...content.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
      const output = content.replace(htmlPattern, (heading, level, id, text) => {
        const previous = slug(text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"));
        if (previous === id || ids.has(previous)) return heading;
        ids.add(previous);
        return '<span id="' + previous + '" data-sixmm-anchor-target="' + id + '" aria-hidden="true"></span>\n' + heading;
      });
      if (output !== content) { await writeFile(targetPath, output); changed++; }
      continue;
    }
    if (raw.length !== canonical.length) throw new Error("Heading count mismatch: " + locale.lang + ":" + file);
    let index = 0;
    const output = content.replace(headingPattern, (_, marks, text) => {
      const heading = canonical[index++];
      if (marks.length !== heading.level) throw new Error("Heading level mismatch: " + locale.lang + ":" + file);
      const previous = slug(text);
      // Preserve existing localized shared links, while all new TOC links use
      // the same canonical section ID in every locale.
      const alias = previous !== heading.id
        ? '<span id="' + previous + '" data-sixmm-anchor-target="' + heading.id + '" aria-hidden="true"></span>\n'
        : "";
      return alias + "<h" + heading.level + ' id="' + heading.id + '">' + escape(text) + "</h" + heading.level + ">";
    });
    await writeFile(targetPath, output);
    changed++;
  }
}
console.log(check ? "Stable heading anchors verified for " + files.size + " prediction pages in 20 locales." : "Updated " + changed + " prediction documents.");
