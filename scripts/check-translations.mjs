import { execFileSync } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const fernRoot = path.join(projectRoot, "fern");
const configPath = path.join(fernRoot, "docs.yml");
const sourceRoot = path.join(fernRoot, "docs");
const translationsRoot = path.join(fernRoot, "translations");
const expectedLocales = [
  "en",
  "en-Asia",
  "ja",
  "ru",
  "es-419",
  "it",
  "fr",
  "de",
  "zh-CN",
  "zh-TW",
  "pt-BR",
  "id",
  "pl",
  "vi",
  "uk",
  "pt",
  "es",
  "es-AR",
  "uz",
  "ar",
  "fil",
  "az",
];
const standaloneLocaleCodes = new Set(["en-Asia", "es-419", "pt-BR", "pt", "es", "es-AR", "uz", "fil", "az"]);
const aliasLocaleCodes = new Set();
const standaloneRoutes = {
  "en-Asia": "en-Asia",
  "es-419": "es-419",
  "pt-BR": "pt-BR",
  pt: "pt",
  es: "es",
  "es-AR": "es-AR",
  uz: "uz",
  fil: "fil",
  az: "az",
};
const nativeLocales = expectedLocales.filter(
  (locale) => !standaloneLocaleCodes.has(locale) && !aliasLocaleCodes.has(locale),
);
const translatedLocales = expectedLocales.filter(
  (locale) => locale !== "en" && !aliasLocaleCodes.has(locale),
);
const generatedLocales = expectedLocales.filter(
  (locale) => !["en", "zh-CN"].includes(locale),
);
const errors = [];

function localizedRoot(locale) {
  return standaloneLocaleCodes.has(locale)
    ? path.join(sourceRoot, "locales", locale)
    : path.join(translationsRoot, locale);
}

function localeRoute(locale) {
  return standaloneRoutes[locale] ?? locale;
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
  return imageSources(content)
    .map((source) => {
      if (!standaloneLocaleCodes.has(locale)) return source;
      if (source.startsWith("../../../../../assets/")) {
        return source.replace("../../../../../assets/", "../../assets/");
      }
      if (source.startsWith("../../../../../pages/design-and-assets/")) {
        return source.replace("../../../../../pages/design-and-assets/", "./");
      }
      return source;
    })
    .sort();
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

    const meta = frontmatter(translated);
    if (!meta.title || !(meta.description || meta.subtitle) || !meta.slug) {
      pushError(`[${locale}] incomplete SEO frontmatter in ${relativePagePath}`);
    }
    const expectedSlug = standaloneLocaleCodes.has(locale)
      ? `${route}/${sourceMeta.slug}`
      : sourceMeta.slug;
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

if (errors.length > 0) {
  console.error(`Translation checks failed with ${errors.length} issue(s):`);
  errors.slice(0, 200).forEach((error) => console.error(`- ${error}`));
  if (errors.length > 200) console.error(`- ... ${errors.length - 200} additional issue(s)`);
  process.exit(1);
}

console.log(
  `Translation checks passed: ${expectedLocales.length} locales, ${activePages.length} active pages each, code and SEO preserved.`,
);
