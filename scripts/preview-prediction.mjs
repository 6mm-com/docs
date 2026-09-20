import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
function portArgument(name, fallback) {
  const arg = args.find((value) => value.startsWith(`--${name}=`));
  const value = arg ? Number(arg.split("=")[1]) : fallback;
  if (!Number.isInteger(value) || value < 1024 || value > 65535) throw new Error(`Invalid ${name}`);
  return value;
}
const port = portArgument("port", 3010);
const backendPort = portArgument("backend-port", 3011);
if (port === backendPort) throw new Error("Preview and backend ports must differ");
console.log(`Local prediction review: http://127.0.0.1:${port}/zh-CN/prediction/overview`);
console.log("Uses all configured languages and Fern's normal renderer. This command does not publish.");
const executable = path.join(root, "node_modules/.bin", process.platform === "win32" ? "fern.cmd" : "fern");
const child = spawn(executable, ["docs", "dev", "--port", String(port), "--backend-port", String(backendPort)], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
child.on("exit", (code) => { process.exitCode = code ?? 0; });
