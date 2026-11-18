import { symlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function linkDirectory(target, destination) {
  // Windows directory junctions do not require symbolic-link privileges.
  return symlink(target, destination, process.platform === "win32" ? "junction" : "dir");
}

export function linkFixtureDependencies(root) {
  return linkDirectory(
    fileURLToPath(new URL("../node_modules", import.meta.url)),
    path.join(root, "node_modules"),
  );
}
