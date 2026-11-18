import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  generatedLocaleSpecs as localeSpecs,
  generatorVersion,
} from "./locale-config.mjs";
import { polishMachineTranslation } from "./polish-core-translations.mjs";
import { protectText, extractDocumentRecords } from "./translation-text.mjs";
import { writeGeneratedFile } from "./write-generated-file.mjs";
import { orderedBatches } from "./ordered-batches.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fernRoot = path.join(projectRoot, "fern");
const translationsRoot = path.join(fernRoot, "translations");
const docsConfigPath = path.join(fernRoot, "docs.yml");
const manifestPath = path.join(translationsRoot, ".translation-manifest.json");

const args = new Set(process.argv.slice(2));
const supportedFlags = new Set(["--force", "--labels-only", "--refresh-manifest"]);
const unknownArguments = [...args].filter(
  (argument) => !supportedFlags.has(argument) && !argument.startsWith("--locales="),
);
if (unknownArguments.length) {
  throw new Error(`Unknown argument(s): ${unknownArguments.join(", ")}. Supported options: --force, --labels-only, --refresh-manifest, --locales=ja,fr`);
}
const force = args.has("--force");
const labelsOnly = args.has("--labels-only");
const refreshManifestOnly = args.has("--refresh-manifest");
const requestedLocaleArguments = [...args].filter((argument) => argument.startsWith("--locales="));
if (requestedLocaleArguments.length > 1) {
  throw new Error("Specify --locales once with comma-separated codes, for example --locales=ja,fr");
}
const requestedLocaleArgument = requestedLocaleArguments[0];
const requestedLocales = requestedLocaleArgument
  ? new Set(requestedLocaleArgument.slice("--locales=".length).split(",").filter(Boolean))
  : null;
if (requestedLocales?.size === 0) {
  throw new Error("At least one locale is required in --locales; omit the option to generate all locales");
}
const selectedLocales = localeSpecs.filter(
  (locale) => requestedLocales == null || requestedLocales.has(locale.code),
);

if (requestedLocales != null && selectedLocales.length !== requestedLocales.size) {
  const known = new Set(localeSpecs.map((locale) => locale.code));
  const unknown = [...requestedLocales].filter((locale) => !known.has(locale));
  throw new Error(`Unknown locale(s): ${unknown.join(", ")}`);
}

if (refreshManifestOnly && (force || labelsOnly)) {
  throw new Error("--refresh-manifest cannot be combined with --force or --labels-only");
}

function loadYamlAsJson(filePath) {
  return parseYaml(readFileSync(filePath, "utf8"));
}

// Every locale in this run uses the same source text; no cache survives the run.
const sourceDocuments = new Map();
async function readSource(relativePagePath) {
  if (!sourceDocuments.has(relativePagePath)) {
    sourceDocuments.set(relativePagePath, await readFile(path.join(fernRoot, relativePagePath), "utf8"));
  }
  return sourceDocuments.get(relativePagePath);
}

function yamlQuote(value) {
  return JSON.stringify(String(value));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

const configuredLocalePrefixes = ["zh-CN", ...localeSpecs.map((item) => item.code)];
function localizedPath(value, locale) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return value;
  }
  if (
    value === `/${locale}` ||
    value.startsWith(`/${locale}/`) ||
    value.startsWith("/docs/") ||
    value.startsWith("/assets/") ||
    value.startsWith("/_next/")
  ) {
    return value;
  }
  if (configuredLocalePrefixes.some((prefix) => value === `/${prefix}` || value.startsWith(`/${prefix}/`))) {
    return value;
  }
  return `/${locale}${value}`;
}

function localeOutputRoot(locale) {
  return path.join(translationsRoot, locale.code);
}

function localizeInternalLinks(content, locale) {
  let result = content.replace(
    /(\b(?:href|src)=["'])(\/(?!\/)[^"'#?]*[^"']*)(["'])/g,
    (match, prefix, url, suffix) => `${prefix}${localizedPath(url, locale)}${suffix}`,
  );
  result = result.replace(
    /(\]\()(\/(?!\/)[^)\s#?]*[^)\s]*)(\))/g,
    (match, prefix, url, suffix) => `${prefix}${localizedPath(url, locale)}${suffix}`,
  );
  result = result.replace(
    /https:\/\/docs\.6mm\.com(\/(?!\/)[^\s)"']*)/g,
    (match, url) => `https://docs.6mm.com${localizedPath(url, locale)}`,
  );
  return result;
}

function canonicalForLocale(content, locale) {
  const slugMatch = content.match(/^slug:\s*["']?([^"'\n]+)["']?\s*$/m);
  if (!slugMatch) {
    throw new Error("Page is missing a slug in frontmatter");
  }
  const normalizedSlug = slugMatch[1].replace(/^\/+|\/+$/g, "");
  const canonical = `https://docs.6mm.com/${locale}${normalizedSlug ? `/${normalizedSlug}` : ""}`;
  if (/^canonical-url:/m.test(content)) {
    return content.replace(/^canonical-url:.*$/m, `canonical-url: ${canonical}`);
  }
  return content.replace(
    /^slug:.*$/m,
    (line) => `${line}\ncanonical-url: ${canonical}`,
  );
}

let edgeToken;
let lastTranslationRequestAt = 0;

async function getEdgeToken() {
  if (edgeToken) return edgeToken;
  const response = await fetch("https://edge.microsoft.com/translate/auth", {
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const error = new Error(`Translation authorization returned HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  edgeToken = await response.text();
  return edgeToken;
}

// Source batches are immutable; locale and authorization live outside the body.
const edgeBodiesByTexts = new WeakMap();
function edgeRequestBody(texts) {
  let body = edgeBodiesByTexts.get(texts);
  if (body === undefined) {
    body = JSON.stringify(
      texts.map((text) => ({
        Text: text.replace(
          /\[\[\[(ph\d+)\]\]\]/g,
          '<span class="notranslate">$1</span>',
        ),
      })),
    );
    edgeBodiesByTexts.set(texts, body);
  }
  return body;
}

async function requestEdgeTranslations(texts, sourceLanguage, targetLanguage, attempt = 1) {
  const url = new URL("https://api-edge.cognitive.microsofttranslator.com/translate");
  url.search = new URLSearchParams({
    "api-version": "3.0",
    from: sourceLanguage,
    to: targetLanguage,
    textType: "html",
  });
  try {
    const token = await getEdgeToken();
    const waitForInterval = Math.max(0, 350 - (Date.now() - lastTranslationRequestAt));
    if (waitForInterval > 0) await sleep(waitForInterval);
    lastTranslationRequestAt = Date.now();
    const response = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json;charset=UTF-8",
        "user-agent": "6MM-Docs-Localization/1.0",
      },
      body: edgeRequestBody(texts),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      const error = new Error(`Translation service returned HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    const data = await response.json();
    if (!Array.isArray(data) || data.length !== texts.length) {
      throw new Error(
        `Translation response mismatch: expected ${texts.length}, got ${data?.length ?? 0}`,
      );
    }
    return data.map((item, index) => {
      const translated = item?.translations?.[0]?.text;
      if (typeof translated !== "string" || (texts[index].trim() && !translated.trim())) {
        throw new Error("Translation response contains missing, invalid or empty text");
      }
      const normalized = translated.replace(
        /<span class=["']notranslate["']>(ph\d+)<\/span>/g,
        "[[[$1]]]",
      );
      const expected = (texts[index].match(/\[\[\[ph\d+\]\]\]/g) ?? []).sort().join("|");
      const received = (normalized.match(/\[\[\[ph\d+\]\]\]/g) ?? []).sort().join("|");
      if (expected !== received) {
        throw new Error("Translation service lost or introduced a placeholder");
      }
      return normalized;
    });
  } catch (error) {
    const maximumAttempts = error.status === 429 ? 20 : 8;
    if (attempt >= maximumAttempts ||
        (error.status && ![401, 408, 429, 500, 502, 503, 504].includes(error.status))) throw error;
    // Refresh inside the next attempt so authorization shares the retry budget.
    if (error.status === 401) edgeToken = undefined;
    const delay =
      error.status === 429
        ? Math.min(120_000, 15_000 * attempt)
        : Math.min(30_000, 500 * 2 ** (attempt - 1));
    if (error.status === 429) {
      console.warn(`Translation service throttled; retrying in ${Math.round(delay / 1000)}s.`);
    }
    await sleep(delay);
    return requestEdgeTranslations(texts, sourceLanguage, targetLanguage, attempt + 1);
  }
}

// Public Google dictionary translation endpoint; keep Edge available for existing environments.
// This is a machine-translation aid, not a guarantee of editorial review.
const translationProvider = process.env.DOCS_TRANSLATION_PROVIDER ?? "google";
if (!["google", "edge"].includes(translationProvider)) throw new Error("Unknown translation provider");
const googleTargetLanguages = { "es-MX": "es", "es-ES": "es", "pt-BR": "pt", "pt-PT": "pt-PT" };
async function requestTranslations(texts, sourceLanguage, targetLanguage, attempt = 1) {
  if (translationProvider === "edge") return requestEdgeTranslations(texts, sourceLanguage, targetLanguage, attempt);
  const url = new URL("https://clients5.google.com/translate_a/t");
  const target = googleTargetLanguages[targetLanguage] ?? targetLanguage;
  url.search = new URLSearchParams({ client: "dict-chrome-ex", sl: sourceLanguage, tl: target });
  texts.forEach(text => url.searchParams.append("q", text));
  try {
    await sleep(Math.max(0, 650 - (Date.now() - lastTranslationRequestAt)));
    lastTranslationRequestAt = Date.now();
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) {
      const error = new Error(`Translation service returned HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    const output = await response.json();
    if (!Array.isArray(output) || output.length !== texts.length ||
        output.some((text, index) => typeof text !== "string" || (texts[index].trim() && !text.trim()))) {
      throw new Error("Translation response shape mismatch");
    }
    const translated = [];
    // Keep repair requests sequential so they respect the shared request interval.
    for (const [index, text] of output.entries()) {
      const normalized = text.replace(/(?:\[\s*)+p\s*h\s*((?:\d\s*)+)(?:\s*\])+/gi, (_, digits) => `[[[ph${digits.replace(/\s/g, "")}]]]`);
      const tokens = texts[index].match(/\[\[\[ph\d+\]\]\]/g) ?? [];
      const received = normalized.match(/\[\[\[ph\d+\]\]\]/g) ?? [];
      if (tokens.sort().join("|") !== received.sort().join("|")) {
        // Splitting plain text would recurse with the same input forever.
        // Let the existing retry budget handle a fabricated placeholder.
        if (tokens.length === 0) throw new Error("Translation service introduced an unexpected placeholder");
        // Some providers omit placeholders inside natural sentences. Translate
        // only the surrounding prose and retain every protected token verbatim.
        const parts = texts[index].split(/(\[\[\[ph\d+\]\]\])/g);
        const indices = parts.map((part, i) => ({part, i})).filter(({part}) => part.trim() && !/^\[\[\[ph\d+\]\]\]$/.test(part));
        const prose = indices.length ? await requestTranslations(indices.map(({part}) => part.trim()), sourceLanguage, targetLanguage) : [];
        indices.forEach(({part, i}, j) => {
          parts[i] = (part.match(/^\s*/)?.[0] ?? "") + prose[j].trim() + (part.match(/\s*$/)?.[0] ?? "");
        });
        translated.push(parts.join(""));
      } else {
        translated.push(normalized);
      }
    }
    return translated;
  } catch (error) {
    if (attempt >= 4 || (error.status && ![429, 500, 502, 503, 504].includes(error.status))) throw error;
    await sleep(error.status === 429 ? 30_000 : 2_000 * attempt);
    return requestTranslations(texts, sourceLanguage, targetLanguage, attempt + 1);
  }
}

function createBatches(records, maximumCharacters = 1_800, maximumItems = 30) {
  const batches = [];
  let current = [];
  let currentLength = 0;

  records.forEach((record, index) => {
    const size = record.text.length + 1;
    if (
      current.length > 0 &&
      (currentLength + size > maximumCharacters || current.length >= maximumItems)
    ) {
      batches.push(current);
      current = [];
      currentLength = 0;
    }
    current.push({ index, record });
    currentLength += size;
  });
  if (current.length > 0) batches.push(current);
  return batches;
}

// Prepared document and navigation records are immutable across target locales.
const batchesByRecords = new WeakMap();
async function translateRecords(records, sourceLanguage, targetLanguage) {
  if (!targetLanguage || records.length === 0) {
    return records.map((record) => record.restore(record.text));
  }
  let batches = batchesByRecords.get(records);
  if (!batches) {
    batches = createBatches(records).map((items) => ({
      items,
      texts: items.map((item) => item.record.text),
    }));
    batchesByRecords.set(records, batches);
  }
  const translated = new Array(records.length);
  for (const { items, texts } of batches) {
    const output = await requestTranslations(
      texts,
      sourceLanguage,
      targetLanguage,
    );
    items.forEach((item, itemIndex) => {
      translated[item.index] = records[item.index].restore(output[itemIndex].trimEnd());
    });
  }
  return translated;
}

const brazilianPortugueseReplacements = [
  [/\bficheiros\b/gi, "arquivos"],
  [/\bficheiro\b/gi, "arquivo"],
  [/\butilizadores\b/gi, "usuários"],
  [/\butilizador\b/gi, "usuário"],
  [/\becrãs\b/gi, "telas"],
  [/\becrã\b/gi, "tela"],
  [/\baplicações\b/gi, "aplicativos"],
  [/\baplicação\b/gi, "aplicativo"],
  [/\bequipas\b/gi, "equipes"],
  [/\bequipa\b/gi, "equipe"],
];

function regionalize(value, locale) {
  let output = value;
  if (locale === "es-419") {
    output = output
      .replace(/\bordenador(?:es)?\b/gi, (match) => (match.toLowerCase().endsWith("es") ? "computadoras" : "computadora"))
      .replace(/\bfichero(?:s)?\b/gi, (match) => (match.toLowerCase().endsWith("s") ? "archivos" : "archivo"))
      .replace(/\bvosotros\b/gi, "ustedes");
  }
  if (locale === "pt-BR") {
    brazilianPortugueseReplacements.forEach(([pattern, replacement]) => {
      output = output.replace(pattern, replacement);
    });
  }
  return output;
}

// Source text is fixed for this run. Keep parsed records shared, but never
// share the mutable output lines between locales.
const preparedDocuments = new Map();
function prepareDocument(content, relativePagePath) {
  if (preparedDocuments.has(relativePagePath)) return preparedDocuments.get(relativePagePath);
  const document = extractDocumentRecords(content);
  if (relativePagePath.startsWith("docs/pages/prediction/")) {
    for (const record of document.records) {
      record.text = { Custom: "Custom Prediction", Grid: "Prediction Grid", "Up/Down": "Up/Down Prediction" }[record.text] ?? record.text;
      record.text = record.text
        .replace(/\bnet PnL\b/gi, "net profit and loss")
        .replace(/\bquoted odds\b/gi, "offered payout multiplier")
        .replace(/\brecorded odds\b/gi, "recorded payout multiplier");
    }
  }
  preparedDocuments.set(relativePagePath, document);
  return document;
}

async function translateDocument(content, locale, relativePagePath) {
  const route = locale.route ?? locale.code;
  if (!locale.targetLanguage) {
    return canonicalForLocale(localizeInternalLinks(content, route), route);
  }
  const document = prepareDocument(content, relativePagePath);
  const lines = [...document.lines];
  const translated = await translateRecords(
    document.records,
    locale.sourceLanguage,
    locale.targetLanguage,
  );
  document.records.forEach((record, index) => {
    if (record.kind !== "attribute") {
      lines[record.index] = `${record.prefix}${regionalize(translated[index], locale.code)}${record.suffix}`;
    }
  });
  document.records.forEach((record, index) => {
    if (record.kind === "attribute") {
      lines[record.index] = lines[record.index].replace(
        record.token,
        () => regionalize(translated[index], locale.code),
      );
    }
  });
  let output = lines.join("\n");
  output = localizeInternalLinks(output, route);
  output = canonicalForLocale(output, route);
  if (locale.code === "vi" && /^slug:\s*legal\/privacy-policy\s*$/m.test(output)) {
    output = output.replace(/^title:.*$/m, 'title: "Chính sách quyền riêng tư"');
  }
  return polishMachineTranslation(output, locale.code, relativePagePath);
}

function collectNavigationLabels(config) {
  const values = [];
  Object.values(config.tabs ?? {}).forEach((tab) => {
    values.push(tab["display-name"]);
  });
  for (const navigationItem of config.navigation ?? []) {
    for (const section of navigationItem.layout ?? []) {
      values.push(section.section);
      for (const content of section.contents ?? []) {
        if (content.page) values.push(content.page);
      }
    }
  }
  return values;
}

// Navigation comes from the same configuration for every locale in this run.
let navigationLabels;
let navigationRecords;
async function translatedLabelMap(locale) {
  const labels = navigationLabels ??= [...new Set(collectNavigationLabels(config))];
  if (!locale.targetLanguage) {
    return new Map(labels.map((label) => [label, label]));
  }
  const records = navigationRecords ??= labels.map((label) => protectText(label));
  const translated = await translateRecords(records, locale.sourceLanguage, locale.targetLanguage);
  return new Map(
    labels.map((label, index) => [
      label,
      polishMachineTranslation(
        regionalize(translated[index], locale.code),
        locale.code,
        "docs.yml",
      ),
    ]),
  );
}

function renderNavigationOverlay(config, translations) {
  const lines = ["tabs:"];
  for (const [key, tab] of Object.entries(config.tabs ?? {})) {
    lines.push(`  ${key}:`);
    lines.push(`    display-name: ${yamlQuote(translations.get(tab["display-name"]))}`);
    if (tab.icon) lines.push(`    icon: ${tab.icon}`);
    if (tab["skip-slug"] != null) lines.push(`    skip-slug: ${tab["skip-slug"]}`);
  }
  lines.push("", "navigation:");
  for (const navigationItem of config.navigation ?? []) {
    lines.push(`  - tab: ${navigationItem.tab}`);
    lines.push("    layout:");
    for (const section of navigationItem.layout ?? []) {
      lines.push(`      - section: ${yamlQuote(translations.get(section.section))}`);
      lines.push("        contents:");
      for (const content of section.contents ?? []) {
        if (content.page) {
          lines.push(`          - page: ${yamlQuote(translations.get(content.page))}`);
        }
      }
    }
  }
  return `${lines.join("\n")}\n`;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function loadManifest() {
  try {
    return JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return { version: generatorVersion, locales: {} };
  }
}

async function saveTextFile(destination, content) {
  try {
    if (await readFile(destination, "utf8") === content) return;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await writeGeneratedFile(destination, content);
}

async function saveManifest(manifest) {
  await saveTextFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

const config = loadYamlAsJson(docsConfigPath);
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
  throw new Error(`Expected 158 active pages, found ${activePages.length}`);
}

const manifest = await loadManifest();
if (!isRecord(manifest)) throw new Error("Invalid translation manifest: root must be an object");
if (manifest.locales !== undefined && !isRecord(manifest.locales)) {
  throw new Error("Invalid translation manifest: locales must be an object");
}
manifest.version = generatorVersion;
manifest.locales ??= {};
const generatedLocaleCodes = new Set(localeSpecs.map((locale) => locale.code));
Object.keys(manifest.locales).forEach((locale) => {
  if (!generatedLocaleCodes.has(locale)) {
    delete manifest.locales[locale];
  } else if (!isRecord(manifest.locales[locale]) || !isRecord(manifest.locales[locale].pages)) {
    throw new Error(`Invalid translation manifest: ${locale} must contain a pages object`);
  } else if (Object.values(manifest.locales[locale].pages).some(hash => typeof hash !== "string")) {
    throw new Error(`Invalid translation manifest: ${locale} page hashes must be strings`);
  }
});

// Load the source snapshot before requesting translations or replacing files.
// Later page generation reuses these reads through the per-run source cache.
if (!labelsOnly && !refreshManifestOnly && selectedLocales.length) {
  for (const relativePagePath of activePages) await readSource(relativePagePath);
}

console.log(`Generating ${activePages.length} active pages for ${selectedLocales.length} locale(s).`);

for (const locale of selectedLocales) {
  const localeRoot = localeOutputRoot(locale);
  const localeManifest = (manifest.locales[locale.code] ??= { pages: {} });
  await mkdir(localeRoot, { recursive: true });

  if (refreshManifestOnly) {
    localeManifest.pages = {};
    for await (const [relativePagePath, hash] of orderedBatches(activePages, async relativePagePath => {
      const source = await readSource(relativePagePath);
      await readFile(path.join(localeRoot, relativePagePath), "utf8");
      return sha256(
        `${generatorVersion}\0${locale.code}\0${locale.targetLanguage ?? "copy"}\0${source}`,
      );
    })) {
      localeManifest.pages[relativePagePath] = hash;
    }
    localeManifest.manifestRefreshedAt = new Date().toISOString();
    localeManifest.label = locale.label;
    await saveManifest(manifest);
    console.log(`[${locale.code}] ${locale.label}: manifest refreshed`);
    continue;
  }

  const labels = await translatedLabelMap(locale);
  await saveTextFile(
    path.join(localeRoot, "docs.yml"),
    renderNavigationOverlay(config, labels),
  );
  if (labelsOnly) {
    console.log(`[${locale.code}] ${locale.label}: navigation labels generated`);
    continue;
  }

  let generatedCount = 0;
  let skippedCount = 0;
  const preparedDirectories = new Set();
  for (const relativePagePath of activePages) {
    const outputPath = path.join(localeRoot, relativePagePath);
    const source = await readSource(relativePagePath);
    const sourceHash = sha256(
      `${generatorVersion}\0${locale.code}\0${locale.targetLanguage ?? "copy"}\0${source}`,
    );
    if (!force && localeManifest.pages[relativePagePath] === sourceHash) {
      try {
        if (!(await stat(outputPath)).isFile()) {
          throw new Error(`Translation output is not a file: ${outputPath}`);
        }
        skippedCount += 1;
        continue;
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        // The manifest is only a cache: a missing output still needs generation.
      }
    }
    const translated = await translateDocument(
      source,
      locale,
      relativePagePath,
    );
    const outputDirectory = path.dirname(outputPath);
    if (!preparedDirectories.has(outputDirectory)) {
      await mkdir(outputDirectory, { recursive: true });
      preparedDirectories.add(outputDirectory);
    }
    await saveTextFile(outputPath, translated);
    localeManifest.pages[relativePagePath] = sourceHash;
    generatedCount += 1;
  }

  localeManifest.generatedAt = new Date().toISOString();
  localeManifest.label = locale.label;
  await saveManifest(manifest);
  console.log(
    `[${locale.code}] ${locale.label}: ${generatedCount} generated, ${skippedCount} unchanged`,
  );
}

console.log("Translation generation complete.");
