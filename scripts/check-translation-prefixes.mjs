import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

// Exercise extraction without invoking a translation provider or writing files.
const source = await readFile(new URL("./generate-translations.mjs", import.meta.url), "utf8");
const start = source.indexOf("function protectText(value)");
const end = source.indexOf("let edgeToken;", start);
const extract = runInNewContext(source.slice(start, end) + "\nextractDocumentRecords;");
const input = ["---", "title: Example", "---", "> Read [the guide](/sdk/overview).",
  "> > Keep nested quotes.", "## Read [the guide](/sdk/overview)",
  "- Read [the guide](/sdk/overview)", "1. Read [the guide](/sdk/overview)",
  "```js", "const comparison = a > b;", "```"].join("\n");
const { lines, records } = extract(input);
assert.equal(lines[3].startsWith("> "), true);
for (const record of records) {
  if (record.kind === "line") lines[record.index] = record.prefix + "TRANSLATED" + record.suffix;
  else lines[record.index] = lines[record.index].replace(record.token, "TRANSLATED");
  assert.doesNotMatch(record.text, /^(?:>\s*|#{1,6}\s+|[-*]\s+|\d+\.\s+)/,
    "Markdown prefixes must never reach the translation provider");
}
assert.equal(lines[3], "> TRANSLATED [TRANSLATED](/sdk/overview).");
assert.equal(lines[4], "> > TRANSLATED");
assert.match(lines[5], /^## /);
assert.match(lines[6], /^- /);
assert.match(lines[7], /^1\. /);
assert.equal(lines[9], "const comparison = a > b;", "Fenced code stays untouched");
console.log("Translation prefix checks passed: linked quotes, nested quotes, headings, lists and fenced code.");
