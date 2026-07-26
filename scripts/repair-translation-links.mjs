import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const fernRoot = path.join(projectRoot, "fern");
const translationsRoot = path.join(fernRoot, "translations");
const generatedLocales = [
  "en-142",
  "ja",
  "ru",
  "es-419",
  "it",
  "fr",
  "de",
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
const relatedPageLabels = {
  "en-142": "Related pages",
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
  pt: "Páginas relacionadas",
  es: "Páginas relacionadas",
  "es-AR": "Páginas relacionadas",
  uz: "Tegishli sahifalar",
  ar: "صفحات ذات صلة",
  fil: "Mga kaugnay na pahina",
  az: "Əlaqəli səhifələr",
};
const repairStart = "<!-- sixmm-localized-link-repair:start -->";
const repairEnd = "<!-- sixmm-localized-link-repair:end -->";

function loadYamlAsJson(filePath) {
  const ruby = [
    "require 'yaml'",
    "require 'json'",
    "puts JSON.generate(YAML.load_file(ARGV.fetch(0)))",
  ].join("; ");
  return JSON.parse(execFileSync("ruby", ["-e", ruby, filePath], { encoding: "utf8" }));
}

function metadata(content) {
  const block = content.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  const result = {};
  for (const line of block.split("\n")) {
    const match = line.match(/^([a-z][\w-]*):\s*(.*)$/i);
    if (match) result[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return result;
}

function internalDestinations(content) {
  return [
    ...[...content.matchAll(/\bhref=["'](\/[^"']+)["']/g)].map((match) => match[1]),
    ...[...content.matchAll(/\]\((\/[^)\s]+)[^)]*\)/g)].map((match) => match[1]),
  ];
}

function stripRepairSection(content) {
  const expression = new RegExp(
    `\\n*${repairStart.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${repairEnd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n*`,
    "g",
  );
  return content.replace(expression, "\n").trimEnd();
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

let repairedPages = 0;
let insertedLinks = 0;

for (const locale of generatedLocales) {
  const titlesBySlug = new Map();
  for (const relativePagePath of activePages) {
    const translated = await readFile(
      path.join(translationsRoot, locale, relativePagePath),
      "utf8",
    );
    const pageMetadata = metadata(translated);
    titlesBySlug.set(pageMetadata.slug, pageMetadata.title);
  }

  for (const relativePagePath of activePages) {
    const source = await readFile(path.join(fernRoot, relativePagePath), "utf8");
    const outputPath = path.join(translationsRoot, locale, relativePagePath);
    const current = stripRepairSection(await readFile(outputPath, "utf8"));
    const actual = new Set(internalDestinations(current));
    const expected = new Set(
      internalDestinations(source).map((destination) => `/${locale}${destination}`),
    );
    const missing = [...expected].filter((destination) => !actual.has(destination));
    if (missing.length === 0) {
      if (current !== (await readFile(outputPath, "utf8")).trimEnd()) {
        await writeFile(outputPath, `${current}\n`, "utf8");
      }
      continue;
    }

    const links = missing.map((destination) => {
      const slug = destination.replace(new RegExp(`^/${locale}/?`), "");
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
      `<h2 id="localized-page-links">${relatedPageLabels[locale]}</h2>`,
      "",
      ...links,
      repairEnd,
      "",
    ].join("\n");
    await writeFile(outputPath, `${current}${section}`, "utf8");
    repairedPages += 1;
    insertedLinks += missing.length;
  }
}

console.log(
  `Repaired localized link coverage on ${repairedPages} pages by adding ${insertedLinks} verified internal links.`,
);
