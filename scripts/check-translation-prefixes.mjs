import assert from "node:assert/strict";
import { extractDocumentRecords, protectText } from "./translation-text.mjs";

// Exercise the shared implementation without a provider or file writes.
const input = ["---", "title: Example", "---", "> Read [the guide](/sdk/overview).",
  "> > Keep nested quotes.", "## Read [the guide](/sdk/overview)",
  "- Read [the guide](/sdk/overview)", "1. Read [the guide](/sdk/overview)",
  "```js", "const comparison = a > b;", "```"].join("\n");
const { lines, records } = extractDocumentRecords(input);
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
for (const text of ["SDK API WebSocket", "`API` and <b>SDK</b>", "Plain text", "SDK API WebSocket",
  '<b data-label="{API}">SDK</b>', 'Visit https://example.com/API or mail sdk@example.com | `SDK`']) {
  const protectedText = protectText(text);
  assert.equal(protectedText.restore(protectedText.text), text);
  assert.equal(protectedText.restore(`${protectedText.text} / ${protectedText.text}`), `${text} / ${text}`);
}
for (const source of ["SDK", "Plain text"]) {
  assert.throws(() => protectText(source).restore("[[[ph999999]]]"), /Unrestored placeholder/);
}
for (const text of ['`$$`', '`$&`', "`$'`", '<b data-value="$`">API</b>', 'https://example.com/$$']) {
  const protectedText = protectText(text);
  assert.equal(protectedText.restore(`before ${protectedText.text} after`), `before ${text} after`);
  assert.equal(protectedText.restore(`${protectedText.text} / ${protectedText.text}`), `${text} / ${text}`);
}
console.log("Translation prefix checks passed: linked quotes, nested quotes, headings, lists and fenced code.");
