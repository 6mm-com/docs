import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { runInNewContext } from "node:vm";
import {
  expectedLocales,
  generatedLocaleSpecs,
  generatorVersion,
  nativeLocaleCodes,
  widgetLocaleAliases,
} from "./locale-config.mjs";
import { findTranslationQualityIssues } from "./polish-core-translations.mjs";
import { frontmatter, internalDestinations } from "./documentation-text.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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
const nativeLocales = nativeLocaleCodes;
const args = [...new Set(process.argv.slice(2))];
if (args.some((argument) => !argument.startsWith("--locales="))) {
  throw new Error("Unknown argument; use --locales=ja,fr or omit it for the full check");
}
if (args.length > 1) {
  throw new Error("Specify --locales once with comma-separated codes");
}
const requestedLocaleArg = args[0];
const requestedLocales = requestedLocaleArg
  ? new Set(requestedLocaleArg.slice("--locales=".length).split(",").filter(Boolean))
  : null;
if (requestedLocales?.size === 0) {
  throw new Error("At least one locale is required in --locales; omit the option for the full check");
}
if (requestedLocales && [...requestedLocales].some((locale) => !expectedLocales.includes(locale))) {
  throw new Error("Unknown locale in --locales; use the configured Docs locale codes");
}
const translatedLocales = expectedLocales.filter(
  (locale) => locale !== "en" && (!requestedLocales || requestedLocales.has(locale)),
);
const generatedLocales = generatedLocaleSpecs.map((locale) => locale.code);
const errors = [];

function localizedRoot(locale) {
  return path.join(translationsRoot, locale);
}

function loadYamlAsJson(filePath) {
  return parseYaml(readFileSync(filePath, "utf8"));
}

function splitCodeBlocks(content) {
  const blocks = [];
  const prose = content.replace(/```[^\n]*\n[\s\S]*?```/g, block => {
    blocks.push(block);
    return "";
  });
  return { blocks, prose };
}

function inlineCode(prose) {
  const tokens = [];
  for (const match of prose.matchAll(/`([^`\n]+)`/g)) tokens.push(match[1]);
  return tokens.sort();
}

function imageSources(content) {
  if (!content.includes("![") && !content.includes("src=")) return [];
  const sources = [];
  for (const match of content.matchAll(/!\[[^\]]*\]\(([^)\s]+)[^)]*\)/g)) sources.push(match[1]);
  for (const match of content.matchAll(/\bsrc=["']([^"']+)["']/g)) sources.push(match[1]);
  return sources.sort();
}

function tableSignatures(content) {
  if (!content.includes("|")) return [];
  const signatures = [];
  for (const [line] of content.matchAll(/(?:^|\n)[^\S\n]*\|[^\n]*/g)) {
    signatures.push((line.match(/(?<!\\)\|/g) ?? []).length);
  }
  return signatures;
}

function blockquoteSignatures(prose) {
  const signatures = [];
  for (const [prefix] of prose.matchAll(/(?:^|\n)[^\S\n]*(?:>[^\S\n]*)+/g)) {
    signatures.push(prefix.replace(/\s/g, ""));
  }
  return signatures;
}

function sameArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

const repositoryAssets = new Map();
async function validateRepositoryAssetUrls(content, context) {
  const rawAssetPattern =
    /https:\/\/raw\.githubusercontent\.com\/6mm-com\/docs\/main\/(fern\/[^)\s"']+)/g;
  for (const match of content.matchAll(rawAssetPattern)) {
    const asset = match[1];
    if (!repositoryAssets.has(asset)) {
      try {
        await stat(path.join(projectRoot, asset));
        repositoryAssets.set(asset, true);
      } catch {
        repositoryAssets.set(asset, false);
      }
    }
    if (!repositoryAssets.get(asset)) {
      pushError(`[${context}] missing repository asset ${match[1]}`);
    }
  }
}

function localizedDestination(destination, locale) {
  if (destination.startsWith("/docs/") || destination.startsWith("/assets/")) {
    return destination;
  }
  return `/${locale}${destination}`;
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
        (section.contents ?? [])
          .map((content) => content.path)
          .filter((contentPath) => contentPath?.startsWith("docs/pages/")),
      ),
    ),
  ),
];
if (activePages.length !== 158) {
  pushError(`Expected 158 active pages, found ${activePages.length}`);
}

if (config.title !== "6MM Docs") {
  pushError(`Site title must remain "6MM Docs"; found ${config.title ?? "missing"}`);
}
if (config.metadata?.["canonical-host"] !== "docs.6mm.com") {
  pushError("Canonical host must remain docs.6mm.com");
}
if (config.metadata?.["og:site_name"] !== "6MM Docs") {
  pushError(`Open Graph site name must remain "6MM Docs"`);
}
if (
  config.metadata?.["og:logo"] !==
  "https://docs.6mm.com/api/fern-docs/favicon.ico"
) {
  pushError("Open Graph logo must use the stable Docs favicon URL");
}
if (config.metadata?.["og:dynamic:show-logo"] !== false) {
  pushError("Dynamic OG images must hide the unsupported font-backed wordmark");
}
for (const dynamicSetting of [
  "og:dynamic:show-section",
  "og:dynamic:show-description",
  "og:dynamic:show-url",
]) {
  if (config.metadata?.[dynamicSetting] !== true) {
    pushError(`${dynamicSetting} must remain enabled`);
  }
}
if (config.logo?.href !== "/") {
  pushError("The Docs logo must link to the canonical root homepage");
}

// Reuse English input across SEO, manifest and per-locale comparisons.
// This cache belongs only to this read-only validation run.
const sourceDocuments = new Map();
async function readSource(relativePagePath) {
  if (!sourceDocuments.has(relativePagePath)) {
    const content = await readFile(path.join(fernRoot, relativePagePath), "utf8");
    sourceDocuments.set(relativePagePath, { content, metadata: frontmatter(content) });
  }
  return sourceDocuments.get(relativePagePath).content;
}
const sourceTitles = new Map();
const sourceDescriptions = new Map();
const sourceSlugs = new Map();
for (const relativePagePath of activePages) {
  const source = await readSource(relativePagePath);
  const meta = sourceDocuments.get(relativePagePath).metadata;
  const description = meta.description || meta.subtitle;
  if (!meta.title || !description || !meta.slug) {
    pushError(`[en] incomplete SEO frontmatter in ${relativePagePath}`);
    continue;
  }
  if (/(?:^|\n)(?:noindex|nofollow):\s*true\b/i.test(source)) {
    pushError(`[en] indexing disabled in ${relativePagePath}`);
  }
  for (const [field, value, collection] of [
    ["title", meta.title, sourceTitles],
    ["description", description, sourceDescriptions],
    ["slug", meta.slug, sourceSlugs],
  ]) {
    const existing = collection.get(value);
    if (existing && existing !== relativePagePath) {
      pushError(`[en] duplicate ${field} in ${existing} and ${relativePagePath}`);
    } else {
      collection.set(value, relativePagePath);
    }
  }
}

const sitelinkTargets = [
  ["Trading Solutions", "docs/pages/solutions/overview.mdx", "/solutions/overview"],
  ["Developer API", "docs/pages/developer-api/overview.mdx", "/developer-api/overview"],
  ["Trading Widget SDK", "docs/pages/sdk/trading-widget/overview.mdx", "/sdk/trading-widget/overview"],
  ["Partner Backend SDK", "docs/pages/sdk/agent-sdk/overview.mdx", "/sdk/agent-sdk/overview"],
  ["Security & Compliance", "docs/pages/security-compliance/overview.mdx", "/security-compliance/overview"],
  ["Integration & Support", "docs/pages/resources/overview.mdx", "/resources/overview"],
];
const sourceHome = await readSource("docs/pages/home.mdx");
// Homepage architecture: product, solution, integration, and launch groups.
for (const locale of ["en", ...translatedLocales]) {
  const homePath = locale === "en" ? path.join(fernRoot, "docs/pages/home.mdx") : path.join(translationsRoot, locale, "docs/pages/home.mdx");
  const home = await readFile(homePath, "utf8");
  const groups = [...home.matchAll(/<CardGroup cols=\{(\d+)\}>([\s\S]*?)<\/CardGroup>/g)];
  const counts = groups.map(group => (group[2].match(/<Card\s/g) ?? []).length);
  if (counts.join(",") !== "2,2,4,6" || groups.map(group => group[1]).join(",") !== "2,2,2,3") pushError(`[${locale}] unexpected homepage group layout`);
  const prefix = locale === "en" ? "" : `/${locale}`;
  for (const route of ["/trading/overview", "/prediction/overview"]) {
    if (!groups[0]?.[2].includes(`href="${prefix}${route}"`)) pushError(`[${locale}] trading products must appear together first`);
  }
  if (!home.includes("sixmm-stat-grid") || (home.match(/<div><strong>/g) ?? []).length !== 4) pushError(`[${locale}] homepage must include four guidance blocks`);
}

for (const [label, relativePagePath, href] of sitelinkTargets) {
  if (
    (label !== "Trading Solutions" && !sourceHome.includes(`title="${label}"`)) ||
    !sourceHome.includes(`href="${href}"`)
  ) {
    pushError(`[en] homepage is missing the ${label} sitelink to ${href}`);
  }
  await readSource(relativePagePath);
  const meta = sourceDocuments.get(relativePagePath).metadata;
  if (!meta.headline || meta.headline.length < 45 || meta.headline.length > 60) {
    pushError(
      `[en] ${relativePagePath} headline should be 45-60 characters; found ${meta.headline?.length ?? 0}`,
    );
  }
  const description = meta.description || "";
  if (description.length < 140 || description.length > 165) {
    pushError(
      `[en] ${relativePagePath} description should be 140-165 characters; found ${description.length}`,
    );
  }
}
const homeMeta = sourceDocuments.get("docs/pages/home.mdx").metadata;
if (
  !homeMeta.headline ||
  homeMeta.headline.length < 45 ||
  homeMeta.headline.length > 60
) {
  pushError("[en] homepage headline should be 45-60 characters");
}
if (
  !homeMeta.description ||
  homeMeta.description.length < 140 ||
  homeMeta.description.length > 165
) {
  pushError("[en] homepage description should be 140-165 characters");
}
const robotsText = await readFile(path.join(fernRoot, "robots.txt"), "utf8");
if (
  !/User-Agent:\s*\*/i.test(robotsText) ||
  !/Allow:\s*\/\s*$/im.test(robotsText) ||
  !/Sitemap:\s*https:\/\/docs\.6mm\.com\/sitemap\.xml/i.test(robotsText)
) {
  pushError("robots.txt must allow public crawling and declare the canonical sitemap");
}
const simplifiedChineseHome = await readFile(
  path.join(translationsRoot, "zh-CN/docs/pages/home.mdx"),
  "utf8",
);
for (const [label, href] of [
  ["交易解决方案", "/zh-CN/solutions/overview"],
  ["开发者 API", "/zh-CN/developer-api/overview"],
  ["交易组件 SDK", "/zh-CN/sdk/trading-widget/overview"],
  ["合作方后端 SDK", "/zh-CN/sdk/agent-sdk/overview"],
  ["安全与合规", "/zh-CN/security-compliance/overview"],
  ["集成与支持", "/zh-CN/resources/overview"],
]) {
  if (
    (label !== "交易解决方案" && !simplifiedChineseHome.includes(`title="${label}"`)) ||
    !simplifiedChineseHome.includes(`href="${href}"`)
  ) {
    pushError(`[zh-CN] homepage is missing the ${label} core entry`);
  }
}
for (const relativePagePath of sitelinkTargets.map((target) => target[1])) {
  const content = await readFile(
    path.join(translationsRoot, "zh-CN", relativePagePath),
    "utf8",
  );
  const meta = frontmatter(content);
  if (!meta.headline || !meta.description) {
    pushError(`[zh-CN] approved SEO metadata missing in ${relativePagePath}`);
  }
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
const manifestLocales = Object.keys(manifest.locales ?? {}).sort();
const expectedManifestLocales = [...generatedLocales].sort();
if (!sameArray(manifestLocales, expectedManifestLocales)) {
  pushError(
    `Translation manifest locales do not match generated locales.\nExpected: ${expectedManifestLocales.join(", ")}\nActual: ${manifestLocales.join(", ")}`,
  );
}

for (const locale of generatedLocales.filter((locale) => !requestedLocales || requestedLocales.has(locale))) {
  const pages = manifest.locales?.[locale]?.pages ?? {};
  if (Object.keys(pages).length !== activePages.length) {
    pushError(
      `[${locale}] manifest contains ${Object.keys(pages).length} pages; expected ${activePages.length}`,
    );
  }
  for (const relativePagePath of activePages) {
    const source = await readSource(relativePagePath);
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
    (await readdir(translationsRoot, { withFileTypes: true })).map(async (entry) => {
      const directory = entry.isDirectory() ||
        (entry.isSymbolicLink() && (await stat(path.join(translationsRoot, entry.name))).isDirectory());
      return directory ? entry.name : null;
    }),
  )
)
  .filter(Boolean)
  .sort();
const expectedDirectories = expectedLocales
  .filter((locale) => locale !== "en")
  .sort();
if (!sameArray(translationDirectories, expectedDirectories)) {
  pushError(
    `Translation directories do not match configured locales.\nExpected: ${expectedDirectories.join(", ")}\nActual: ${translationDirectories.join(", ")}`,
  );
}

const baseTabCount = Object.keys(config.tabs ?? {}).length;
const baseNavigationCount = (config.navigation ?? []).length;
for (const locale of translatedLocales) {
  const overlayPath = path.join(localizedRoot(locale), "docs.yml");
  const overlayContent = await readFile(overlayPath, "utf8");
  const overlay = parseYaml(overlayContent);
  if (Object.keys(overlay.tabs ?? {}).length !== baseTabCount) {
    pushError(`[${locale}] navigation tab count does not match the English source`);
  }
  if ((overlay.navigation ?? []).length !== baseNavigationCount) {
    pushError(`[${locale}] navigation group count does not match the English source`);
  }
  for (const issue of findTranslationQualityIssues(
    overlayContent,
    locale,
    "docs.yml",
  )) {
    pushError(`[${locale}] translation quality issue /${issue}/ in docs.yml`);
  }
}

const translatedMetadata = new Map(translatedLocales.map(locale => [locale, new Map()]));
for (const relativePagePath of activePages) {
  const source = await readSource(relativePagePath);
  const sourceMeta = sourceDocuments.get(relativePagePath).metadata;
  const sourceCode = splitCodeBlocks(source);
  const sourceInlineCode = inlineCode(sourceCode.prose);
  const sourceImages = imageSources(source);
  const sourceTables = tableSignatures(source);
  const sourceBlockquotes = blockquoteSignatures(sourceCode.prose);
  const sourceDestinations = internalDestinations(source);
  await validateRepositoryAssetUrls(source, `en:${relativePagePath}`);

  // Limit concurrent reads to one page's locales; diagnostics retain locale order.
  const translatedContents = await Promise.all(translatedLocales.map(async (locale) => {
    try {
      return await readFile(path.join(localizedRoot(locale), relativePagePath), "utf8");
    } catch {
      return null;
    }
  }));
  for (const [localeIndex, locale] of translatedLocales.entries()) {
    const translated = translatedContents[localeIndex];
    if (translated === null) {
      pushError(`[${locale}] missing ${relativePagePath}`);
      continue;
    }
    await validateRepositoryAssetUrls(translated, `${locale}:${relativePagePath}`);

    const meta = frontmatter(translated);
    translatedMetadata.get(locale).set(relativePagePath, meta);
    const translatedDestinations = internalDestinations(translated);
    if (!meta.title || !(meta.description || meta.subtitle) || !meta.slug) {
      pushError(`[${locale}] incomplete SEO frontmatter in ${relativePagePath}`);
    }
    if (meta.slug !== sourceMeta.slug) {
      pushError(`[${locale}] slug mismatch in ${relativePagePath}: ${meta.slug ?? "missing"}`);
    }
    const expectedCanonical = `https://docs.6mm.com/${locale}${
      sourceMeta.slug === "/" ? "" : `/${sourceMeta.slug}`
    }`;
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
    for (const issue of findTranslationQualityIssues(
      translated,
      locale,
      relativePagePath,
    )) {
      pushError(
        `[${locale}] translation quality issue /${issue}/ in ${relativePagePath}`,
      );
    }

    if (generatedLocales.includes(locale)) {
      const translatedCode = splitCodeBlocks(translated);
      if (!sameArray(blockquoteSignatures(translatedCode.prose), sourceBlockquotes)) {
        pushError(`[${locale}] Markdown blockquote structure changed in ${relativePagePath}`);
      }
      if (!sameArray(translatedCode.blocks, sourceCode.blocks)) {
        pushError(`[${locale}] fenced code changed in ${relativePagePath}`);
      }
      if (!sameArray(inlineCode(translatedCode.prose), sourceInlineCode)) {
        pushError(`[${locale}] inline code changed in ${relativePagePath}`);
      }
      if (!sameArray(imageSources(translated), sourceImages)) {
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
      const actualDestinations = [...new Set(translatedDestinations)].sort();
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

    for (const destination of translatedDestinations) {
      if (
        !destination.startsWith(`/${locale}/`) &&
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
    const meta = translatedMetadata.get(locale).get(relativePagePath);
    if (!meta) continue; // The completeness pass above already reports a missing page.
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
if (!directionScript.includes("lastLocaleSignature")) {
  pushError("Locale direction sync must handle the browser locale map loading after the script");
}

const styles = await readFile(path.join(fernRoot, "styles.css"), "utf8");
if (
  /data-sixmm-docs-locale[^}]*a\[role=["']tab["']\]|a\[role=["']tab["']\][^{]*href\^=["']\/(?:ko|tr|el)\//s.test(
    styles,
  )
) {
  pushError("Native locale tabs must not be hidden with locale-specific CSS");
}
if (
  !styles.includes(".fern-header-tabs [role=\"tablist\"]") ||
  !styles.includes("margin-inline: auto")
) {
  pushError("Fern header tabs must remain centered for every locale");
}
if (
  !/body:has\(\.sixmm-language-menu-enhanced\[data-state="open"\]\)::before\s*\{[^}]*pointer-events:\s*none\s*;/s.test(
    styles,
  )
) {
  pushError(
    "The language modal backdrop must not intercept the opening mobile touch gesture",
  );
}
if (
  !/\[data-radix-popper-content-wrapper\]:has\([\s\S]*?\.sixmm-language-menu-enhanced[\s\S]*?\)\s*\{[^}]*top:\s*50%\s*!important;[^}]*left:\s*50%\s*!important;[^}]*animation:\s*none\s*!important;/s.test(
    styles,
  ) ||
  !/\.sixmm-language-menu-enhanced\s*\{[^}]*animation:\s*none\s*!important;[^}]*transition:\s*none\s*!important;/s.test(
    styles,
  )
) {
  pushError(
    "The language selector must open directly as a centered modal without a mobile slide animation",
  );
}
if (
  !/@media\s*\(max-width:\s*560px\)\s*\{[\s\S]*?\[data-radix-popper-content-wrapper\]:has\([\s\S]*?\.sixmm-language-menu-enhanced[\s\S]*?\)\s*\{[^}]*top:\s*50%\s*!important;[^}]*bottom:\s*auto\s*!important;[^}]*left:\s*50%\s*!important;[^}]*transform:\s*translate\(-50%,\s*-50%\)\s*!important;/s.test(
    styles,
  )
) {
  pushError(
    "The phone language selector must remain centered instead of reverting to a bottom sheet",
  );
}

const configuredScripts = (config.js ?? []).map((script) => script.path);
if (configuredScripts[0] !== "./language-modal.js") {
  pushError("The shared browser locale mapping must load before other custom scripts");
}

const languageScript = await readFile(path.join(fernRoot, "language-modal.js"), "utf8");
if (
  !languageScript.includes('button[aria-label="Open menu"]') ||
  !languageScript.includes('button[aria-label="Close menu"]') ||
  !languageScript.includes('classList.add("sixmm-mobile-menu-trigger")')
) {
  pushError(
    "The native mobile navigation trigger must receive the stable mobile control class",
  );
}
for (const mobileDialogContract of [
  "guardMobileLocaleTrigger",
  "openMobileLocaleDialog",
  "sixmm-mobile-language-dialog",
  'window.matchMedia("(max-width: 1023px)")',
  "event.stopImmediatePropagation()",
  "sixmm-mobile-language-dialog-open",
  "document.activeElement === last",
  'window.addEventListener("resize"',
]) {
  if (!languageScript.includes(mobileDialogContract)) {
    pushError(
      `The stable mobile language dialog is missing ${mobileDialogContract}`,
    );
  }
}
for (const localizedControlLabel of [
  "选择语言",
  "選擇語言",
  "言語を選択",
  "언어 선택",
  "Επιλογή γλώσσας",
  "اختيار اللغة",
]) {
  if (!languageScript.includes(localizedControlLabel)) {
    pushError(
      `The language dialog is missing localized control text: ${localizedControlLabel}`,
    );
  }
}
if (
  !/\.sixmm-mobile-language-dialog\s*\{[^}]*position:\s*fixed;[^}]*place-items:\s*center;/s.test(
    styles,
  ) ||
  !/\.sixmm-mobile-language-dialog-panel\s*\{[^}]*width:\s*min\(32rem,\s*calc\(100vw\s*-\s*2rem\)\);[^}]*max-height:\s*min\(80dvh,\s*40rem\);/s.test(
    styles,
  )
) {
  pushError(
    "The independent mobile language dialog must remain centered within the viewport",
  );
}
if (
  !/html\.sixmm-mobile-language-dialog-open,\s*html\.sixmm-mobile-language-dialog-open body\s*\{[^}]*overflow:\s*hidden\s*!important;[^}]*overscroll-behavior:\s*none;/s.test(
    styles,
  ) ||
  !/\.sixmm-mobile-language-dialog-options\s*\{[^}]*direction:\s*ltr;[^}]*-webkit-overflow-scrolling:\s*touch;/s.test(
    styles,
  ) ||
  /(?:^|\n)div:has\(>\s*\.fern-language-selector\s*\+\s*button\)/.test(styles)
) {
  pushError(
    "The mobile language dialog must lock background scrolling and mobile settings styles must not leak into desktop containers",
  );
}
if (
  !/\.sixmm-mobile-menu-trigger\s*\{[^}]*width:\s*2\.75rem\s*!important;[^}]*height:\s*2\.75rem\s*!important;[^}]*touch-action:\s*manipulation;/s.test(
    styles,
  ) ||
  !styles.includes(":not(.sixmm-mobile-menu-trigger)")
) {
  pushError(
    "The mobile navigation trigger must keep a 44px touch target and stay outside generic header hover rules",
  );
}
if (
  /#fern-sidebar|\[role=["']tab|sixmm-(?:standalone|hidden-sidebar)|navigate(?:ToBasePage|StandaloneLocale)/.test(
    languageScript,
  )
) {
  pushError("Language switching must not alter the Fern sidebar, tabs, or page layout");
}
const browserSandbox = {
  window: {
    addEventListener() {},
    requestAnimationFrame() {},
    location: {
      hash: "",
      origin: "https://docs.6mm.com",
      pathname: "/",
      search: "",
    },
  },
  document: {
    readyState: "loading",
    addEventListener() {},
    documentElement: { dataset: {} },
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

for (const [widgetLocale, docsLocale] of Object.entries(widgetLocaleAliases)) {
  const browserLocale = browserLocales.find(
    (locale) => (locale.code || "en") === docsLocale,
  );
  const aliases = (browserLocale?.aliases ?? []).map((alias) =>
    String(alias).toLowerCase(),
  );
  if (!aliases.includes(widgetLocale.toLowerCase())) {
    pushError(
      `Widget locale ${widgetLocale} must map to Docs locale ${docsLocale}`,
    );
  }
}

const supportScript = await readFile(path.join(fernRoot, "support-widget.js"), "utf8");
if (/window\.location\.(?:assign|replace|reload)|window\.location\s*=/.test(
  `${languageScript}\n${supportScript}`,
)) {
  pushError("Locale navigation must use standard links rather than assigning window.location");
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

if (/__reactFiber|memoizedValue|dependencies\.firstContext/.test(languageScript)) {
  pushError("Locale navigation must not depend on private React router internals");
}
if (!styles.includes('.fern-header-tabs > astro-island > div:has(> [role="tablist"])')) {
  pushError("Header tab centering must support Fern's Astro island wrapper");
}

const seoScript = await readFile(
  path.join(fernRoot, "seo-structured-data.js"),
  "utf8",
);
for (const requiredSeoSignal of [
  '"@type": "WebSite"',
  '"@type": "WebPage"',
  '"@type": "BreadcrumbList"',
  'url: siteUrl + "/"',
  '"docs.6mm.com"',
]) {
  if (!seoScript.includes(requiredSeoSignal)) {
    pushError(`SEO script is missing required signal: ${requiredSeoSignal}`);
  }
}
if (
  seoScript.includes("data-sixmm-seo") ||
  seoScript.includes("syncAlternates")
) {
  pushError(
    "Fern must remain the single owner of server-rendered hreflang alternates",
  );
}

if (errors.length > 0) {
  console.error(`Translation checks failed with ${errors.length} issue(s):`);
  errors.slice(0, 200).forEach((error) => console.error(`- ${error}`));
  if (errors.length > 200) console.error(`- ... ${errors.length - 200} additional issue(s)`);
  process.exit(1);
}

console.log(
  `Translation structure and terminology checks passed: ${requestedLocales ? `English source + ${translatedLocales.join(", ")} (scoped preview; full release check still required)` : `${expectedLocales.length} locales`}, ${activePages.length} active pages each, code and SEO preserved.`,
);
