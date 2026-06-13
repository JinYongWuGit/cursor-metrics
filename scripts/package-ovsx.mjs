import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";

function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { stdio: "inherit", ...opts });
}

const pkg = JSON.parse(execFileSync(process.execPath, ["-p", "JSON.stringify(require('./package.json'))"], {
  cwd: new URL("..", import.meta.url),
}).toString());

const repoRoot = new URL("..", import.meta.url);
const version = pkg.version;
const name = pkg.name;

const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot }).toString().trim();
const base = `https://raw.githubusercontent.com/JinYongWuGit/cursor-metrics/${sha}/`;

mkdirSync(new URL("../build", import.meta.url), { recursive: true });

// Build first (using Node, not Bun).
sh("npm", ["run", "-s", "build"], { cwd: repoRoot, shell: true });

// Package with rewritten links pinned to this exact commit, so Open VSX can render images,
// while the repo README stays clean with relative paths.
sh(
  "npx",
  [
    "--yes",
    "@vscode/vsce",
    "package",
    "--baseImagesUrl",
    base,
    "--baseContentUrl",
    base,
    "--out",
    `build/${name}-${version}.vsix`,
  ],
  { cwd: repoRoot, shell: true },
);

