import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  generatedLocaleSpecs as localeSpecs,
  generatorVersion,
} from "./locale-config.mjs";

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const fernRoot = path.join(projectRoot, "fern");
const sourceRoot = path.join(fernRoot, "docs");
const translationsRoot = path.join(fernRoot, "translations");
const docsConfigPath = path.join(fernRoot, "docs.yml");
const manifestPath = path.join(translationsRoot, ".translation-manifest.json");

const args = new Set(process.argv.slice(2));
const force = args.has("--force");
const labelsOnly = args.has("--labels-only");
const refreshManifestOnly = args.has("--refresh-manifest");
const requestedLocaleArgument = process.argv.find((argument) => argument.startsWith("--locales="));
const requestedLocales = requestedLocaleArgument
  ? new Set(requestedLocaleArgument.slice("--locales=".length).split(",").filter(Boolean))
  : null;
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
  const ruby = [
    "require 'yaml'",
    "require 'json'",
    "puts JSON.generate(YAML.load_file(ARGV.fetch(0)))",
  ].join("; ");
  return JSON.parse(
    execFileSync("ruby", ["-e", ruby, filePath], {
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    }),
  );
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
  const configuredLocalePrefixes = ["zh-CN", ...localeSpecs.map((item) => item.code)];
  if (configuredLocalePrefixes.some((prefix) => value === `/${prefix}` || value.startsWith(`/${prefix}/`))) {
    return value;
  }
  return `/${locale}${value}`;
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
  const canonical = `https://docs.6mm.com/${locale}/${slugMatch[1].replace(/^\/+|\/+$/g, "")}`;
  if (/^canonical-url:/m.test(content)) {
    return content.replace(/^canonical-url:.*$/m, `canonical-url: ${canonical}`);
  }
  return content.replace(
    /^slug:.*$/m,
    (line) => `${line}\ncanonical-url: ${canonical}`,
  );
}

function protectText(value) {
  const protectedValues = [];
  let text = value;
  const protect = (match) => {
    const token = `[[[ph${String(protectedValues.length).padStart(6, "0")}]]]`;
    protectedValues.push(match);
    return token;
  };

  text = text.replace(/`[^`\n]+`/g, protect);
  text = text.replace(/\{[^{}\n]*\}/g, protect);
  text = text.replace(/(?<=\]\()\/[^)\s]+(?=\))/g, protect);
  text = text.replace(/https?:\/\/[^\s)>"']+/g, protect);
  text = text.replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, protect);
  text = text.replace(/\|/g, protect);
  text = text.replace(/<[^>\n]+>/g, protect);

  const protectedTerms = [
    "Embedded API / SDK",
    "Trading Widget SDK",
    "Trading Widget",
    "6MM Docs",
    "Agent Java SDK",
    "Agent PHP SDK",
    "Agent SDKs",
    "Agent SDK",
    "6 Market Maker",
    "API Key",
    "REST API",
    "WebSocket",
    "Java",
    "PHP",
    "OAuth",
    "OpenAPI",
    "Postman",
    "JWT",
    "HMAC",
    "SHA-256",
    "SDKs",
    "SDK",
    "APIs",
    "API",
    "6MM",
    "USDT",
    "KYC",
    "AML",
    "IP",
    "JSON",
    "HTTP",
    "HTTPS",
    "GET",
    "POST",
    "PUT",
    "DELETE",
    "PATCH",
    "OPTIONS",
    "listenKey",
  ];
  const termPattern = new RegExp(
    `\\b(?:${protectedTerms
      .sort((left, right) => right.length - left.length)
      .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|")})\\b`,
    "g",
  );
  text = text.replace(termPattern, protect);
  text = text.replace(/\b[a-z]+[A-Z][A-Za-z0-9]*\b/g, protect);
  text = text.replace(/\b[A-Z][A-Z0-9_-]{2,}\b/g, protect);

  return {
    text,
    restore(translated) {
      let restored = translated;
      protectedValues
        .map((original, index) => ({ original, index }))
        .reverse()
        .forEach(({ original, index }) => {
          const token = `[[[ph${String(index).padStart(6, "0")}]]]`;
          const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const flexibleToken = new RegExp(escaped.replace(/\\ /g, "\\s*"), "g");
          restored = restored.replace(flexibleToken, original);
        });
      if (/\[\[\[ph\d+\]\]\]/.test(restored)) {
        throw new Error(`Unrestored placeholder in translated text: ${restored}`);
      }
      return restored;
    },
  };
}

function shouldTranslateLine(line) {
  if (!line.trim()) return false;
  if (/^\s*(?:---|\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?)\s*$/.test(line)) {
    return false;
  }
  if (/^\s*(?:slug|layout|icon|canonical-url|hide-[\w-]+):/.test(line)) {
    return false;
  }
  return /[A-Za-z]/.test(line);
}

function extractDocumentRecords(content) {
  const lines = content.split("\n");
  const records = [];
  let attributeSequence = 0;
  let inFence = false;
  let inFrontmatter = false;
  let frontmatterClosed = false;

  function translationToken(value, index) {
    const token = `[[[attr${String(attributeSequence).padStart(6, "0")}]]]`;
    attributeSequence += 1;
    records.push({
      kind: "attribute",
      index,
      token,
      ...protectText(value),
    });
    return token;
  }

  function tokenizeTextFragment(fragment, index) {
    if (!/[A-Za-z]/.test(fragment)) return fragment;
    const leading = fragment.match(/^\s*/)?.[0] ?? "";
    const trailing = fragment.match(/\s*$/)?.[0] ?? "";
    const core = fragment.slice(leading.length, fragment.length - trailing.length || undefined);
    if (!core) return fragment;
    return `${leading}${translationToken(core, index)}${trailing}`;
  }

  function tokenizeMarkdownLinks(value, index) {
    const linkPattern = /(!?)\[([^\]]+)\]\(([^)]+)\)/g;
    const matches = [...value.matchAll(linkPattern)];
    if (matches.length === 0) return null;
    let cursor = 0;
    let output = "";
    for (const match of matches) {
      output += tokenizeTextFragment(value.slice(cursor, match.index), index);
      output += `${match[1]}[${translationToken(match[2], index)}](${match[3]})`;
      cursor = match.index + match[0].length;
    }
    output += tokenizeTextFragment(value.slice(cursor), index);
    return output;
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (index === 0 && line.trim() === "---") {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter && line.trim() === "---") {
      inFrontmatter = false;
      frontmatterClosed = true;
      continue;
    }
    if (!inFrontmatter && /^```/.test(line.trim())) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    if (inFrontmatter) {
      const frontmatterMatch = line.match(
        /^(\s*(?:title|headline|subtitle|description):\s*)(["']?)(.*?)(\2)\s*$/,
      );
      if (frontmatterMatch && frontmatterMatch[3]) {
        const protectedRecord = protectText(frontmatterMatch[3]);
        records.push({
          kind: "line",
          index,
          prefix: `${frontmatterMatch[1]}${frontmatterMatch[2]}`,
          suffix: frontmatterMatch[4],
          ...protectedRecord,
        });
      }
      continue;
    }

    if (!frontmatterClosed || !shouldTranslateLine(line)) continue;

    const attributeRecords = [];
    const lineWithAttributeTokens = line.replace(
      /\b(title|alt|aria-label|label|placeholder)="([^"]+)"/g,
      (match, attribute, value) => {
        if (!/[A-Za-z]/.test(value)) return match;
        const token = `[[[attr${String(attributeSequence).padStart(6, "0")}]]]`;
        attributeSequence += 1;
        attributeRecords.push({ kind: "attribute", index, token, ...protectText(value) });
        return `${attribute}="${token}"`;
      },
    );
    lines[index] = lineWithAttributeTokens;
    records.push(...attributeRecords);

    if (/^\s*\|.*\|\s*$/.test(lineWithAttributeTokens)) {
      const cells = lineWithAttributeTokens.split("|");
      const rebuilt = cells.map((cell) => {
        if (!/[A-Za-z]/.test(cell)) return cell;
        const leading = cell.match(/^\s*/)?.[0] ?? "";
        const trailing = cell.match(/\s*$/)?.[0] ?? "";
        const core = cell.slice(leading.length, cell.length - trailing.length || undefined);
        if (!core || /^:?-+:?$/.test(core)) return cell;
        if (
          /^(?:string|bool|boolean|int32|int64|float|double|integer|number|object|array|null)$/i.test(
            core,
          )
        ) {
          return cell;
        }
        const linked = tokenizeMarkdownLinks(core, index);
        return `${leading}${linked ?? translationToken(core, index)}${trailing}`;
      });
      lines[index] = rebuilt.join("|");
      continue;
    }

    if (
      /^\s*<\/?(?:h[1-6]|div|span|p|Card|CardGroup|Button|Frame|Tabs|Tab|Accordion|AccordionGroup|Note|Warning|Tip|Info|img)\b/i.test(
        lineWithAttributeTokens,
      )
    ) {
      const parts = lineWithAttributeTokens.split(/(<[^>\n]+>)/g);
      const rebuilt = parts.map((part) => {
        if (!part || /^<[^>\n]+>$/.test(part) || !/[A-Za-z]/.test(part)) return part;
        return tokenizeTextFragment(part, index);
      });
      lines[index] = rebuilt.join("");
      continue;
    }

    const linkedLine = tokenizeMarkdownLinks(lineWithAttributeTokens, index);
    if (linkedLine != null) {
      lines[index] = linkedLine;
      continue;
    }

    const protectedRecord = protectText(lineWithAttributeTokens);
    if (
      !/[A-Za-z]/.test(
        protectedRecord.text.replace(/\[\[\[ph\d+\]\]\]/g, ""),
      )
    ) {
      continue;
    }
    records.push({ kind: "line", index, prefix: "", suffix: "", ...protectedRecord });
  }

  return { lines, records };
}

let edgeToken;
let lastTranslationRequestAt = 0;

async function getEdgeToken(forceRefresh = false) {
  if (edgeToken && !forceRefresh) return edgeToken;
  const response = await fetch("https://edge.microsoft.com/translate/auth", {
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Translation authorization returned HTTP ${response.status}`);
  }
  edgeToken = await response.text();
  return edgeToken;
}

async function requestTranslations(texts, sourceLanguage, targetLanguage, attempt = 1) {
  const url = new URL("https://api-edge.cognitive.microsofttranslator.com/translate");
  url.search = new URLSearchParams({
    "api-version": "3.0",
    from: sourceLanguage,
    to: targetLanguage,
    textType: "html",
  });
  try {
    const token = await getEdgeToken(false);
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
      body: JSON.stringify(
        texts.map((text) => ({
          Text: text.replace(
            /\[\[\[(ph\d+)\]\]\]/g,
            '<span class="notranslate">$1</span>',
          ),
        })),
      ),
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
    return data.map((item) =>
      (item.translations?.[0]?.text ?? "").replace(
        /<span class=["']notranslate["']>(ph\d+)<\/span>/g,
        "[[[$1]]]",
      ),
    );
  } catch (error) {
    if (error.status === 401) {
      await getEdgeToken(true);
    }
    const maximumAttempts = error.status === 429 ? 20 : 8;
    if (attempt >= maximumAttempts) throw error;
    const delay =
      error.status === 429
        ? Math.min(120_000, 15_000 * attempt)
        : Math.min(30_000, 500 * 2 ** (attempt - 1));
    if (error.status === 429) {
      console.warn(`Translation service throttled; retrying in ${Math.round(delay / 1000)}s.`);
    }
    await sleep(delay);
    return requestTranslations(texts, sourceLanguage, targetLanguage, attempt + 1);
  }
}

function createBatches(records, maximumCharacters = 40_000, maximumItems = 100) {
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

async function mapConcurrent(items, concurrency, mapper) {
  let nextIndex = 0;
  const results = new Array(items.length);
  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

async function translateRecords(records, sourceLanguage, targetLanguage) {
  if (!targetLanguage || records.length === 0) {
    return records.map((record) => record.restore(record.text));
  }
  const batches = createBatches(records);
  const translated = new Array(records.length);
  await mapConcurrent(batches, 1, async (batch) => {
    const output = await requestTranslations(
      batch.map((item) => item.record.text),
      sourceLanguage,
      targetLanguage,
    );
    batch.forEach((item, itemIndex) => {
      translated[item.index] = records[item.index].restore(output[itemIndex].trimEnd());
    });
  });
  return translated;
}

function regionalize(value, locale) {
  let output = value;
  if (locale === "es-419") {
    output = output
      .replace(/\bordenador(?:es)?\b/gi, (match) => (match.toLowerCase().endsWith("es") ? "computadoras" : "computadora"))
      .replace(/\bfichero(?:s)?\b/gi, (match) => (match.toLowerCase().endsWith("s") ? "archivos" : "archivo"))
      .replace(/\bvosotros\b/gi, "ustedes");
  }
  if (locale === "pt-BR") {
    const replacements = [
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
    replacements.forEach(([pattern, replacement]) => {
      output = output.replace(pattern, replacement);
    });
  }
  return output;
}

async function translateDocument(content, locale) {
  const route = locale.route ?? locale.code;
  if (!locale.targetLanguage) {
    return canonicalForLocale(localizeInternalLinks(content, route), route);
  }
  const document = extractDocumentRecords(content);
  const translated = await translateRecords(
    document.records,
    locale.sourceLanguage,
    locale.targetLanguage,
  );
  document.records.forEach((record, index) => {
    if (record.kind !== "attribute") {
      document.lines[record.index] = `${record.prefix}${regionalize(translated[index], locale.code)}${record.suffix}`;
    }
  });
  document.records.forEach((record, index) => {
    if (record.kind === "attribute") {
      document.lines[record.index] = document.lines[record.index].replace(
        record.token,
        regionalize(translated[index], locale.code),
      );
    }
  });
  let output = document.lines.join("\n");
  output = localizeInternalLinks(output, route);
  output = canonicalForLocale(output, route);
  if (locale.code === "vi" && /^slug:\s*legal\/privacy-policy\s*$/m.test(output)) {
    output = output.replace(/^title:.*$/m, 'title: "Chính sách quyền riêng tư"');
  }
  return output;
}

function collectNavigationLabels(config) {
  const values = [];
  Object.values(config.tabs ?? {}).forEach((tab) => values.push(tab["display-name"]));
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

async function translatedLabelMap(config, locale) {
  const labels = [...new Set(collectNavigationLabels(config))];
  if (!locale.targetLanguage) {
    return new Map(labels.map((label) => [label, label]));
  }
  const records = labels.map((label) => protectText(label));
  const translated = await translateRecords(records, locale.sourceLanguage, locale.targetLanguage);
  return new Map(
    labels.map((label, index) => [label, regionalize(translated[index], locale.code)]),
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

async function loadManifest() {
  try {
    return JSON.parse(await readFile(manifestPath, "utf8"));
  } catch {
    return { version: generatorVersion, locales: {} };
  }
}

const config = loadYamlAsJson(docsConfigPath);
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
  throw new Error(`Expected 87 active pages, found ${activePages.length}`);
}

const manifest = await loadManifest();
manifest.version = generatorVersion;
manifest.locales ??= {};

console.log(`Generating ${activePages.length} active pages for ${selectedLocales.length} locale(s).`);

for (const locale of selectedLocales) {
  const localeRoot = path.join(translationsRoot, locale.code);
  const localeManifest = (manifest.locales[locale.code] ??= { pages: {} });
  await mkdir(localeRoot, { recursive: true });

  if (refreshManifestOnly) {
    localeManifest.pages = {};
    for (const relativePagePath of activePages) {
      const source = await readFile(path.join(fernRoot, relativePagePath), "utf8");
      await readFile(path.join(localeRoot, relativePagePath), "utf8");
      localeManifest.pages[relativePagePath] = sha256(
        `${generatorVersion}\0${locale.code}\0${locale.targetLanguage ?? "copy"}\0${source}`,
      );
    }
    localeManifest.manifestRefreshedAt = new Date().toISOString();
    localeManifest.label = locale.label;
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    console.log(`[${locale.code}] ${locale.label}: manifest refreshed`);
    continue;
  }

  const labels = await translatedLabelMap(config, locale);
  await writeFile(
    path.join(localeRoot, "docs.yml"),
    renderNavigationOverlay(config, labels),
    "utf8",
  );
  if (labelsOnly) {
    console.log(`[${locale.code}] ${locale.label}: navigation labels generated`);
    continue;
  }

  let generatedCount = 0;
  let skippedCount = 0;
  await mapConcurrent(activePages, 1, async (relativePagePath) => {
    const sourcePath = path.join(fernRoot, relativePagePath);
    const outputPath = path.join(localeRoot, relativePagePath);
    const source = await readFile(sourcePath, "utf8");
    const sourceHash = sha256(
      `${generatorVersion}\0${locale.code}\0${locale.targetLanguage ?? "copy"}\0${source}`,
    );
    if (!force && localeManifest.pages[relativePagePath] === sourceHash) {
      skippedCount += 1;
      return;
    }
    const translated = await translateDocument(source, locale);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, translated, "utf8");
    localeManifest.pages[relativePagePath] = sourceHash;
    generatedCount += 1;
  });

  localeManifest.generatedAt = new Date().toISOString();
  localeManifest.label = locale.label;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(
    `[${locale.code}] ${locale.label}: ${generatedCount} generated, ${skippedCount} unchanged`,
  );
}

console.log("Translation generation complete.");
