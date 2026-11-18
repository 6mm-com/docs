import { readdir } from "node:fs/promises";
import path from "node:path";

export function activeDocumentationPages(config) {
  const pages = new Set();
  for (const navigationItem of config.navigation ?? []) {
    for (const section of navigationItem.layout ?? []) {
      for (const { path: page } of section.contents ?? []) {
        if (page?.startsWith("docs/pages/")) pages.add(page);
      }
    }
  }
  if (pages.size === 0) throw new Error("English navigation does not list any documentation pages");
  return [...pages];
}

export async function assertSourcePagesListed(fernRoot, activePages, directory = "docs/pages") {
  const listed = new Set(activePages);
  const unlisted = [];
  async function scan(directory) {
    for (const entry of await readdir(path.join(fernRoot, directory), { withFileTypes: true })) {
      const relative = `${directory}/${entry.name}`;
      if (entry.isDirectory()) {
        await scan(relative);
      } else if (/\.mdx?$/.test(entry.name) && !listed.has(relative)) {
        unlisted.push(relative);
      }
    }
  }
  await scan(directory);
  if (unlisted.length) {
    throw new Error(`English documentation pages missing from navigation:\n${unlisted.sort().join("\n")}`);
  }
}
