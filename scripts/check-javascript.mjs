import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { orderedBatches } from "./ordered-batches.mjs";

if (Number(process.versions.node.split(".")[0]) < 20) {
  throw new Error("Documentation checks require Node.js 20 or newer. Use Node.js 22 to match the publishing workflow.");
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Include new source files, while respecting ignored local import generators.
const files = [...new Set(execFileSync("git", [
  "ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", "fern", "scripts", "tests/browser",
], { cwd: root, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 }).split("\0"))]
  .filter(file => /\.(?:c|m)?js$/.test(file) && existsSync(path.join(root, file)))
  .sort();

function checkSyntax(file) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--check", file], {
      cwd: root, stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", chunk => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", chunk => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", status => resolve({ status, stdout, stderr }));
  });
}

if (!files.length) throw new Error("No JavaScript source files found to validate");
// Parser processes are heavier than file reads; cap them at four and keep
// diagnostics in file order even when later processes finish first.
for await (const [, result] of orderedBatches(files, checkSyntax, 4)) {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    break;
  }
}
if (!process.exitCode) console.log(`JavaScript syntax verified: ${files.length} files.`);
