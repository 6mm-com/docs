import { mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export async function writeGeneratedFile(destination, content) {
  // Write beside the destination so replacement stays on the same filesystem.
  // A partial write or failed rename must leave the previous file intact.
  const temporaryRoot = await mkdtemp(path.join(path.dirname(destination), ".translation-write-"));
  try {
    const temporaryPath = path.join(temporaryRoot, path.basename(destination));
    await writeFile(temporaryPath, content, "utf8");
    await rename(temporaryPath, destination);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}
