import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { runInNewContext } from "node:vm";
import {
  expectedLocales,
  generatedLocaleSpecs,
  generatorVersion,
} from "./locale-config.mjs";

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const fernRoot = path.join(projectRoot, "fern");
const configPath = path.join(fernRoot, "docs.yml");
const sourceRoot = path.join(fernRoot, "docs");
const translationsRoot = path.join(fernRoot, "translations");
const manifestPath = path.join(translationsRoot, ".translation-manifest.json");
const generatedLocaleTargetLanguages = Object.fromEntries(
  generatedLocaleSpecs.map((locale) => [
    locale.code,
    locale.targetLanguage ?? "copy",
  ]),
);
const nativeLocales = expectedLocales;
const translatedLocales = expectedLocales.filter((locale) => locale !== "en");
const generatedLocales = generatedLocaleSpecs.map((locale) => locale.code);
const errors = [];

function localizedRoot(locale) {
  return path.join(translationsRoot, locale);
}

function localeRoute(locale) {
  return locale;
}

function loadYamlAsJson(filePath) {
  const ruby = [
    "require 'yaml'",
    "require 'json'",
    "puts JSON.generate(YAML.load_file(ARGV.fetch(0)))",
  ].join("; ");
  return JSON.parse(execFileSync("ruby", ["-e", ruby, filePath], { encoding: "utf8" }));
}

function frontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result = {};
  for (const line of match[1].split("\n")) {
    const field = line.match(/^([a-z][\w-]*):\s*(.*)$/i);
    if (field) result[field[1]] = field[2].replace(/^["']|["']$/g, "");
  }
  return result;
}

function codeBlocks(content) {
  return [...content.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((match) => match[0]);
}

function inlineCode(content) {
  const withoutBlocks = content.replace(/```[^\n]*\n[\s\S]*?```/g, "");
  return [...withoutBlocks.matchAll(/`([^`\n]+)`/g)].map((match) => match[1]).sort();
}

function imageSources(content) {
  return [
    ...[...content.matchAll(/!\[[^\]]*\]\(([^)\s]+)[^)]*\)/g)].map((match) => match[1]),
    ...[...content.matchAll(/\bsrc=["']([^"']+)["']/g)].map((match) => match[1]),
  ].sort();
}

function comparableImageSources(content, locale) {
  return imageSources(content);
}

function internalDestinations(content) {
  return [
    ...[...content.matchAll(/\bhref=["'](\/[^"']+)["']/g)].map((match) => match[1]),
    ...[...content.matchAll(/\]\((\/[^)\s]+)[^)]*\)/g)].map((match) => match[1]),
  ];
}

function tableSignatures(content) {
  return content
    .split("\n")
    .filter((line) => line.trim().startsWith("|"))
    .map((line) => (line.match(/(?<!\\)\|/g) ?? []).length);
}

function sameArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function collectFolderPaths(value, result = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectFolderPaths(item, result));
  } else if (value && typeof value === "object") {
    if (typeof value.folder === "string") result.push(value.folder);
    Object.values(value).forEach((item) => collectFolderPaths(item, result));
  }
  return result;
}

async function validateRepositoryAssetUrls(content, context) {
  const rawAssetPattern =
    /https:\/\/raw\.githubusercontent\.com\/6mm-com\/docs\/main\/(fern\/[^)\s"']+)/g;
  for (const match of content.matchAll(rawAssetPattern)) {
    try {
      await stat(path.join(projectRoot, match[1]));
    } catch {
      pushError(`[${context}] missing repository asset ${match[1]}`);
    }
  }
}

function localizedDestination(destination, locale) {
  if (destination.startsWith("/docs/") || destination.startsWith("/assets/")) {
    return destination;
  }
  return `/${localeRoute(locale)}${destination}`;
}

function pushError(message) {
  errors.push(message);
}

const config = loadYamlAsJson(configPath);
const configuredLocales = (config.translations ?? []).map((translation) => translation.lang);
if (!sameArray(configuredLocales, nativeLocales)) {
  pushError(
    `Configured native locales do not match expected order.\nExpected: ${nativeLocales.join(", ")}\nActual: ${configuredLocales.join(", ")}`,
  );
}

const activePages = [
  ...new Set(
    (config.navigation ?? []).flatMap((navigationItem) =>
      (navigationItem.layout ?? []).flatMap((section) =>
        (section.contents ?? []).map((content) => content.path).filter(Boolean),
      ),
    ),
  ),
];
if (activePages.length !== 87) {
  pushError(`Expected 87 active pages, found ${activePages.length}`);
}

const configuredStandaloneDirectories = collectFolderPaths(config)
  .map((folder) => folder.match(/^docs\/locales\/([^/]+)\/docs\/pages$/)?.[1])
  .filter(Boolean)
  .sort();
const expectedStandaloneDirectories = [];
if (!sameArray(configuredStandaloneDirectories, expectedStandaloneDirectories)) {
  pushError(
    `Configured standalone locale folders do not match expected locales.\nExpected: ${expectedStandaloneDirectories.join(", ")}\nActual: ${configuredStandaloneDirectories.join(", ")}`,
  );
}

let manifest;
try {
  manifest = JSON.parse(await readFile(manifestPath, "utf8"));
} catch (error) {
  pushError(`Translation manifest cannot be read: ${error.message}`);
  manifest = { locales: {} };
}
if (manifest.version !== generatorVersion) {
  pushError(
    `Translation manifest version is ${manifest.version ?? "missing"}; expected ${generatorVersion}`,
  );
}

for (const locale of generatedLocales) {
  const pages = manifest.locales?.[locale]?.pages ?? {};
  if (Object.keys(pages).length !== activePages.length) {
    pushError(
      `[${locale}] manifest contains ${Object.keys(pages).length} pages; expected ${activePages.length}`,
    );
  }
  for (const relativePagePath of activePages) {
    const source = await readFile(path.join(fernRoot, relativePagePath), "utf8");
    const expectedHash = sha256(
      `${generatorVersion}\0${locale}\0${generatedLocaleTargetLanguages[locale]}\0${source}`,
    );
    if (pages[relativePagePath] !== expectedHash) {
      pushError(`[${locale}] stale manifest entry for ${relativePagePath}`);
    }
  }
}

const translationDirectories = (
  await Promise.all(
    (await readdir(translationsRoot)).map(async (entry) => {
      const entryPath = path.join(translationsRoot, entry);
      return (await stat(entryPath)).isDirectory() ? entry : null;
    }),
  )
)
  .filter(Boolean)
  .sort();
const expectedDirectories = nativeLocales.filter((locale) => locale !== "en").sort();
if (!sameArray(translationDirectories, expectedDirectories)) {
  pushError(
    `Translation directories do not match configured locales.\nExpected: ${expectedDirectories.join(", ")}\nActual: ${translationDirectories.join(", ")}`,
  );
}

for (const locale of expectedDirectories) {
  const overlayPath = path.join(translationsRoot, locale, "docs.yml");
  const overlay = loadYamlAsJson(overlayPath);
  if (Object.keys(overlay.tabs ?? {}).length !== Object.keys(config.tabs ?? {}).length) {
    pushError(`[${locale}] navigation tab count does not match the English source`);
  }
  if ((overlay.navigation ?? []).length !== (config.navigation ?? []).length) {
    pushError(`[${locale}] navigation group count does not match the English source`);
  }
}

for (const relativePagePath of activePages) {
  const sourcePath = path.join(fernRoot, relativePagePath);
  const source = await readFile(sourcePath, "utf8");
  const sourceMeta = frontmatter(source);
  const sourceBlocks = codeBlocks(source);
  const sourceInlineCode = inlineCode(source);
  const sourceImages = imageSources(source);
  const sourceTables = tableSignatures(source);
  const sourceDestinations = internalDestinations(source);
  await validateRepositoryAssetUrls(source, `en:${relativePagePath}`);

  for (const locale of translatedLocales) {
    const route = localeRoute(locale);
    const translatedPath = path.join(localizedRoot(locale), relativePagePath);
    let translated;
    try {
      translated = await readFile(translatedPath, "utf8");
    } catch {
      pushError(`[${locale}] missing ${relativePagePath}`);
      continue;
    }
    await validateRepositoryAssetUrls(translated, `${locale}:${relativePagePath}`);

    const meta = frontmatter(translated);
    if (!meta.title || !(meta.description || meta.subtitle) || !meta.slug) {
      pushError(`[${locale}] incomplete SEO frontmatter in ${relativePagePath}`);
    }
    const expectedSlug = sourceMeta.slug;
    if (meta.slug !== expectedSlug) {
      pushError(`[${locale}] slug mismatch in ${relativePagePath}: ${meta.slug ?? "missing"}`);
    }
    const expectedCanonical = `https://docs.6mm.com/${route}/${sourceMeta.slug}`;
    if (meta["canonical-url"] !== expectedCanonical) {
      pushError(
        `[${locale}] canonical mismatch in ${relativePagePath}: ${meta["canonical-url"] ?? "missing"}`,
      );
    }
    if (/(?:noindex|nofollow|ZXQ|XXQ|ZZQ|\[\[\[(?:ph|attr|seg)|class="notranslate")/i.test(translated)) {
      pushError(`[${locale}] indexing directive or translation placeholder in ${relativePagePath}`);
    }
    if (/<!--|-->/.test(translated)) {
      pushError(`[${locale}] unsupported HTML comment syntax in ${relativePagePath}`);
    }

    if (generatedLocales.includes(locale)) {
      if (!sameArray(codeBlocks(translated), sourceBlocks)) {
        pushError(`[${locale}] fenced code changed in ${relativePagePath}`);
      }
      if (!sameArray(inlineCode(translated), sourceInlineCode)) {
        pushError(`[${locale}] inline code changed in ${relativePagePath}`);
      }
      if (!sameArray(comparableImageSources(translated, locale), sourceImages)) {
        pushError(`[${locale}] image source changed in ${relativePagePath}`);
      }
      if (!sameArray(tableSignatures(translated), sourceTables)) {
        pushError(`[${locale}] Markdown table structure changed in ${relativePagePath}`);
      }
      const expectedDestinations = [
        ...new Set(
          sourceDestinations.map((destination) => localizedDestination(destination, locale)),
        ),
      ].sort();
      const actualDestinations = [...new Set(internalDestinations(translated))].sort();
      if (!sameArray(actualDestinations, expectedDestinations)) {
        const missing = expectedDestinations.filter(
          (destination) => !actualDestinations.includes(destination),
        );
        const extra = actualDestinations.filter(
          (destination) => !expectedDestinations.includes(destination),
        );
        pushError(
          `[${locale}] internal link set changed in ${relativePagePath}; missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"}`,
        );
      }
    }

    for (const destination of internalDestinations(translated)) {
      if (
        !destination.startsWith(`/${route}/`) &&
        !destination.startsWith("/docs/") &&
        !destination.startsWith("/assets/")
      ) {
        pushError(`[${locale}] unlocalized internal link ${destination} in ${relativePagePath}`);
      }
    }
  }
}

for (const locale of translatedLocales) {
  const titles = new Map();
  const descriptions = new Map();
  for (const relativePagePath of activePages) {
    const content = await readFile(path.join(localizedRoot(locale), relativePagePath), "utf8");
    const meta = frontmatter(content);
    for (const [field, value, collection] of [
      ["title", meta.title, titles],
      ["description", meta.description || meta.subtitle, descriptions],
    ]) {
      if (!value) continue;
      const existing = collection.get(value);
      if (existing && existing !== relativePagePath) {
        pushError(`[${locale}] duplicate ${field} in ${existing} and ${relativePagePath}`);
      } else {
        collection.set(value, relativePagePath);
      }
    }
  }
}

const arabicHome = await readFile(
  path.join(translationsRoot, "ar", "docs/pages/home.mdx"),
  "utf8",
);
if (!/[\u0600-\u06ff]/.test(arabicHome)) {
  pushError("[ar] Arabic page does not contain Arabic text");
}
const directionScript = await readFile(path.join(fernRoot, "locale-direction.js"), "utf8");
if (!/locale === "ar" \? "rtl" : "ltr"/.test(directionScript)) {
  pushError("Arabic RTL direction rule is missing");
}

const configuredScripts = (config.js ?? []).map((script) => script.path);
if (configuredScripts[0] !== "./language-modal.js") {
  pushError("The shared browser locale mapping must load before other custom scripts");
}

const languageScript = await readFile(path.join(fernRoot, "language-modal.js"), "utf8");
const browserSandbox = {
  window: {
    addEventListener() {},
    requestAnimationFrame() {},
  },
  document: {
    readyState: "loading",
    addEventListener() {},
    documentElement: {},
  },
  MutationObserver: class {
    observe() {}
  },
  URL,
};
runInNewContext(languageScript, browserSandbox);
const browserLocales = browserSandbox.window.__sixmmDocsLocales ?? [];
const browserLocaleCodes = browserLocales.map((locale) => locale.code || "en");
if (!sameArray(browserLocaleCodes, expectedLocales)) {
  pushError(
    `Browser locale mapping does not match the translation config.\nExpected: ${expectedLocales.join(", ")}\nActual: ${browserLocaleCodes.join(", ")}`,
  );
}

const supportScript = await readFile(path.join(fernRoot, "support-widget.js"), "utf8");
if (/window\.location\.(?:assign|replace|reload)|window\.location\s*=/.test(
  `${languageScript}\n${supportScript}`,
)) {
  pushError("Language switching must not trigger a full-page navigation");
}
for (const contract of [
  "CSWidget",
  "setLang",
  "setTheme",
  "cs-widget-lang-change",
  "cs-widget-theme-change",
  "__sixmmNavigateDocsLocale",
]) {
  if (!supportScript.includes(contract)) {
    pushError(`Support widget integration is missing ${contract}`);
  }
}

if (errors.length > 0) {
  console.error(`Translation checks failed with ${errors.length} issue(s):`);
  errors.slice(0, 200).forEach((error) => console.error(`- ${error}`));
  if (errors.length > 200) console.error(`- ... ${errors.length - 200} additional issue(s)`);
  process.exit(1);
}

console.log(
  `Translation checks passed: ${expectedLocales.length} locales, ${activePages.length} active pages each, code and SEO preserved.`,
);
