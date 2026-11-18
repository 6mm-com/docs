import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { generatedLocaleSpecs } from "./locale-config.mjs";
import { frontmatter, internalDestinations } from "./documentation-text.mjs";
import { writeGeneratedFile } from "./write-generated-file.mjs";
import { orderedBatches } from "./ordered-batches.mjs";

if (process.argv.length > 2) {
  throw new Error("Unknown argument; link repair accepts no options and processes all generated locales");
}
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fernRoot = path.join(projectRoot, "fern");
const translationsRoot = path.join(fernRoot, "translations");
const generatedLocales = generatedLocaleSpecs.map((locale) => locale.code);
const relatedPageLabels = {
  ja: "関連ページ",
  ru: "Связанные страницы",
  "es-419": "Páginas relacionadas",
  it: "Pagine correlate",
  fr: "Pages associées",
  de: "Verwandte Seiten",
  "zh-TW": "相關頁面",
  "pt-BR": "Páginas relacionadas",
  id: "Halaman terkait",
  pl: "Powiązane strony",
  vi: "Trang liên quan",
  uk: "Пов’язані сторінки",
  "pt-PT": "Páginas relacionadas",
  "es-ES": "Páginas relacionadas",
  tr: "İlgili sayfalar",
  ko: "관련 페이지",
  el: "Σχετικές σελίδες",
  ar: "صفحات ذات صلة",
};
const repairStart = "{/* sixmm-localized-link-repair:start */}";
const repairEnd = "{/* sixmm-localized-link-repair:end */}";
const repairSectionPattern = new RegExp(
  `\\n*${repairStart.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${repairEnd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n*`,
  "g",
);

function localeRoot(locale) {
  return path.join(translationsRoot, locale);
}

function loadYamlAsJson(filePath) {
  return parseYaml(readFileSync(filePath, "utf8"));
}

function stripRepairSection(content) {
  return content.replace(repairSectionPattern, "\n").trimEnd();
}

const config = loadYamlAsJson(path.join(fernRoot, "docs.yml"));
const activePages = [
  ...new Set(
    config.navigation.flatMap((navigationItem) =>
      navigationItem.layout.flatMap((section) =>
        section.contents.map((content) => content.path).filter(Boolean),
      ),
    ),
  ),
];

let repairSectionPages = 0;
let repairSectionLinks = 0;
const sourceDestinations = new Map();
const updates = new Map();

for (const locale of generatedLocales) {
  const route = locale;
  const routePrefixPattern = new RegExp(`^/${route}/?`);
  let titlesBySlug;
  const translatedContents = new Map();
  for await (const [relativePagePath, translated] of orderedBatches(activePages, relativePagePath =>
    readFile(path.join(localeRoot(locale), relativePagePath), "utf8"),
  )) {
    translatedContents.set(relativePagePath, translated);
  }

  for (const relativePagePath of activePages) {
    if (!sourceDestinations.has(relativePagePath)) {
      const source = await readFile(path.join(fernRoot, relativePagePath), "utf8");
      sourceDestinations.set(relativePagePath, internalDestinations(source));
    }
    const outputPath = path.join(localeRoot(locale), relativePagePath);
    const original = translatedContents.get(relativePagePath);
    const current = stripRepairSection(original);
    const actual = new Set(internalDestinations(current));
    const expected = new Set(
      sourceDestinations.get(relativePagePath).map((destination) => `/${route}${destination}`),
    );
    const missing = [...expected].filter((destination) => !actual.has(destination));
    if (missing.length === 0) {
      if (current !== original.trimEnd()) {
        updates.set(outputPath, `${current}\n`);
      }
      continue;
    }

    // Keep reviewed labels and formatting when the existing repair already covers
    // exactly the missing destinations. Page titles may have been polished separately.
    const existingSections = original.match(repairSectionPattern);
    if (existingSections?.length === 1) {
      const existingLinks = internalDestinations(existingSections[0]);
      if (existingLinks.length === missing.length && missing.every((destination) => existingLinks.includes(destination))) {
        repairSectionPages += 1;
        repairSectionLinks += missing.length;
        continue;
      }
    }

    // Titles are only needed for new repair links; valid existing sections stay intact.
    if (!titlesBySlug) {
      titlesBySlug = new Map();
      for (const translated of translatedContents.values()) {
        const pageMetadata = frontmatter(translated);
        titlesBySlug.set(pageMetadata.slug, pageMetadata.title);
      }
    }
    const links = missing.map((destination) => {
      const slug = destination.replace(routePrefixPattern, "");
      const fallback = slug
        .split("/")
        .filter(Boolean)
        .at(-1)
        ?.replace(/-/g, " ");
      return `- [${titlesBySlug.get(slug) ?? fallback ?? destination}](${destination})`;
    });
    const section = [
      "",
      repairStart,
      '<span id="localized-page-links" data-sixmm-canonical-anchor="localized-page-links" aria-hidden="true"></span>',
      "",
      `## ${relatedPageLabels[locale]}`,
      "",
      ...links,
      repairEnd,
      "",
    ].join("\n");
    const output = `${current}${section}`;
    if (output !== original) updates.set(outputPath, output);
    repairSectionPages += 1;
    repairSectionLinks += missing.length;
  }
}

// Prepare all locales before writes so a missing input cannot leave a partial repair.
for (const [outputPath, output] of updates) await writeGeneratedFile(outputPath, output);

console.log(
  `Localized link repair sections: ${repairSectionPages} pages, ${repairSectionLinks} links. Updated files: ${updates.size}.`,
);
