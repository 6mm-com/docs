import { spawn } from "node:child_process";
import { constants } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = [...new Set(process.argv.slice(2))];
if (args.some((argument) => !/^--(?:port|backend-port)=/.test(argument))) {
  throw new Error("Unknown argument; use --port=3010 and --backend-port=3011");
}
function portArgument(name, fallback) {
  const prefix = `--${name}=`;
  const matches = args.filter((value) => value.startsWith(prefix));
  if (matches.length > 1) throw new Error(`Specify --${name} once`);
  const value = matches.length ? Number(matches[0].slice(prefix.length)) : fallback;
  if (!Number.isInteger(value) || value < 1024 || value > 65535) throw new Error(`Invalid ${name}`);
  return value;
}
const port = portArgument("port", 3010);
const backendPort = portArgument("backend-port", 3011);
if (port === backendPort) throw new Error("Preview and backend ports must differ");
console.log(`Local prediction review: http://127.0.0.1:${port}/zh-CN/prediction/overview`);
console.log("Uses all configured languages and Fern's normal renderer. This command does not publish.");
const executable = path.join(root, "node_modules/fern-api/cli.cjs");
const child = spawn(process.execPath, [executable, "docs", "dev", "--port", String(port), "--backend-port", String(backendPort)], {
  cwd: root,
  stdio: "inherit",
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 128 + (constants.signals[signal] ?? 0) : 1);
});
