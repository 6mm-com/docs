import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Script } from "node:vm";
import { browserLocales } from "./locale-config.mjs";
import { writeGeneratedFile } from "./write-generated-file.mjs";

const option = process.argv.slice(2);
if (option.length > 1 || (option.length && option[0] !== "--check")) {
  throw new Error("Usage: node scripts/build-frontend-assets.mjs [--check]");
}

const fern = new URL("../fern/", import.meta.url);
const cssRoot = new URL("asset-source/css/", fern);
const jsRoot = new URL("asset-source/js/", fern);
const cssFiles = (await readdir(cssRoot)).filter(name => name.endsWith(".css")).sort();
if (!cssFiles.length || cssFiles.some((name, index) =>
  !/^\d{2}-[a-z-]+\.css$/.test(name) || (index > 0 && name.slice(0, 2) === cssFiles[index - 1].slice(0, 2)))) {
  throw new Error("CSS sources must have unique two-digit cascade prefixes (for example, 01-theme.css)");
}

async function readSource(url) {
  // Keep generated assets stable even on checkouts using CRLF.
  return (await readFile(url, "utf8")).replace(/\r\n/g, "\n");
}

const css = (await Promise.all(cssFiles.map(name => readSource(new URL(name, cssRoot)))))
  .map(part => part.trimEnd()).join("\n\n") + "\n";
function bundle(name, guard, sourceFolder, parts) {
  const content = [
    `/* Generated from fern/asset-source/${sourceFolder} by npm run assets:build. */`,
    "(function () {",
    `  if (window.${guard}) return;`,
    `  window.${guard} = true;`,
    "",
    parts.map(part => part.trimEnd().replace(/^(?!$)/gm, "  ")).join("\n\n"),
    "})();",
    "",
  ].join("\n");
  new Script(content, { filename: `fern/${name}` });
  return [name, content];
}

const jsFiles = ["host-state.js", "host-navigation.js", "sidebar-prefetch.js", "language-menu.js"];
const jsParts = await Promise.all(jsFiles.map(name => readSource(new URL(name, jsRoot))));
const localeLiteral = `var locales = [\n${browserLocales.map(locale => `  ${JSON.stringify(locale)},`).join("\n")}\n];`;
jsParts.splice(-1, 0, localeLiteral);
const supportFiles = ["01-state.js", "02-status-and-accessibility.js", "03-navigation-persistence.js",
  "04-language-and-theme.js", "05-sdk-loader.js"];
const supportParts = await Promise.all(supportFiles.map(name => readSource(new URL(`asset-source/support/${name}`, fern))));
const assets = [
  ["styles.css", css],
  bundle("language-modal.js", "__sixmmLanguageModalInitialized", "js", jsParts),
  bundle("support-widget.js", "__sixmmSupportWidgetLoader", "support", supportParts),
];
const stale = [];
for (const [name, content] of assets) {
  const url = new URL(name, fern);
  const previous = await readSource(url).catch(error => {
    if (error.code !== "ENOENT") throw error;
    return null;
  });
  if (previous === content) continue;
  if (option.length) stale.push(`fern/${name}`);
  else await writeGeneratedFile(fileURLToPath(url), content);
}

if (stale.length) {
  console.error(`Regenerate stale front-end assets with npm run assets:build: ${stale.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log(`Front-end assets ${option.length ? "verified" : "built"}: ${cssFiles.length} CSS sections, ${jsFiles.length + supportFiles.length} JS sources, three existing assets.`);
}
