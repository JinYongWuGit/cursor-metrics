import { execFileSync } from "node:child_process";

const repoRoot = new URL("..", import.meta.url);

const pkg = JSON.parse(execFileSync(process.execPath, ["-p", "JSON.stringify(require('./package.json'))"], {
  cwd: repoRoot,
}).toString());

const version = pkg.version;
const name = pkg.name;

if (!process.env.OPEN_VSX_TOKEN) {
  console.error("OPEN_VSX_TOKEN is not set in env");
  process.exit(2);
}

execFileSync(
  "npx",
  ["--yes", "ovsx", "publish", `build/${name}-${version}.vsix`, "-p", process.env.OPEN_VSX_TOKEN],
  { cwd: repoRoot, stdio: "inherit", shell: true },
);

