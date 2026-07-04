#!/usr/bin/env node
// Unified taskdir entrypoint — the single binary shipped as taskdir.exe.
//
// Dispatches `taskdir init|mcp|web` to the shared implementations in cli.ts.
// When run inside the SEA (.exe) build, also handles the `--internal-launch-next`
// arg used to spawn the bundled Next.js server as a child of the same .exe.

import { promises as fs, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { runInit, runMcp, runWeb } from "./cli.ts";

const VERSION = "0.4.3";

function printHelp(): void {
  process.stdout.write(
    [
      `taskdir ${VERSION}`,
      "",
      "Usage: taskdir <command> [options]",
      "",
      "Commands:",
      "  init           initialise taskdir in the current directory",
      "  mcp            run the stdio MCP server for the current directory",
      "  web            launch the taskdir web UI",
      "  install        copy this exe into the user PATH",
      "  help           show this help",
      "  version        print version",
      "",
      "Run `taskdir <command> --help` for command-specific options.",
      "",
    ].join("\n"),
  );
}

// ---------------------------------------------------------------------------
// install (copy exe to user PATH)
// ---------------------------------------------------------------------------

async function runInstall(): Promise<void> {
  if (process.platform !== "win32") {
    process.stderr.write(
      "taskdir install: only Windows is implemented today. " +
        "On Linux/macOS, copy this binary into a directory already on $PATH.\n",
    );
    process.exit(1);
  }
  const targetDir = path.join(
    process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
    "Programs",
    "taskdir",
  );
  const targetExe = path.join(targetDir, "taskdir.exe");
  const sourceExe = process.execPath;

  await fs.mkdir(targetDir, { recursive: true });

  if (path.resolve(sourceExe).toLowerCase() === path.resolve(targetExe).toLowerCase()) {
    process.stdout.write(`taskdir is already installed at ${targetExe}\n`);
  } else {
    await fs.copyFile(sourceExe, targetExe);
    process.stdout.write(`installed: ${targetExe}\n`);
  }

  // Ensure targetDir is on the user PATH. We use PowerShell's
  // [Environment]::SetEnvironmentVariable for the User scope so the
  // change persists across sessions and survives logout. Avoid setx,
  // which truncates PATH to 1024 chars. The path is embedded as a
  // PowerShell single-quoted literal (apostrophes doubled) to dodge
  // JSON-style backslash escaping that would land in the registry.
  const psLiteral = "'" + targetDir.replace(/'/g, "''") + "'";
  const psScript = `
$dir = ${psLiteral};
$cur = [Environment]::GetEnvironmentVariable('Path', 'User');
if (-not $cur) { $cur = '' }
$parts = $cur.Split(';') | Where-Object { $_ -ne '' }
if ($parts -icontains $dir) {
  Write-Host "$dir already on user PATH";
} else {
  $newPath = (($parts + $dir) -join ';');
  [Environment]::SetEnvironmentVariable('Path', $newPath, 'User');
  Write-Host "user PATH updated — open a new shell to use 'taskdir'";
}
`.trim();
  const { spawnSync } = await import("node:child_process");
  const result = spawnSync(
    "powershell",
    ["-NoProfile", "-NonInteractive", "-Command", psScript],
    { stdio: "inherit" },
  );
  if (result.status !== 0) {
    process.stderr.write("taskdir install: failed to update PATH\n");
    process.exit(result.status ?? 1);
  }
}

interface WebBundleResolver {
  resolveWebDir(): Promise<string>;
  internalLaunchArgs: string[];
  skipDepInstall: boolean;
}

// Set at startup by main(): either the SEA-aware resolver (extracts the
// embedded zip on first run) or the dev/npm resolver (looks for ../web).
let bundleResolver: WebBundleResolver;

async function dispatch(argv: string[]): Promise<void> {
  const command = argv[0];
  const rest = argv.slice(1);

  if (!command) {
    // No subcommand: if stdin isn't a TTY, we're being spawned over stdio
    // (Claude Code MCP add, other MCP clients) — enter MCP mode. Interactive
    // shells get the help output.
    if (!process.stdin.isTTY) return runMcp();
    printHelp();
    return;
  }
  if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }
  if (command === "version" || command === "--version" || command === "-v") {
    process.stdout.write(`taskdir ${VERSION}\n`);
    return;
  }

  if (command === "init") return runInit(rest);
  if (command === "mcp") return runMcp();
  if (command === "install") return runInstall();
  if (command === "web") {
    const webDir = await bundleResolver.resolveWebDir();
    await runWeb(rest, {
      webDir,
      skipDepInstall: bundleResolver.skipDepInstall,
      internalLaunchArgs: bundleResolver.internalLaunchArgs,
    });
    return;
  }

  process.stderr.write(`taskdir: unknown command '${command}'\n`);
  printHelp();
  process.exit(1);
}

// ---------------------------------------------------------------------------
// SEA detection + bundle extraction
// ---------------------------------------------------------------------------

interface SeaApi {
  isSea(): boolean;
  getAsset(key: string): ArrayBuffer;
}

// In the CJS SEA bundle, `require` is the module-local require provided by
// esbuild's CJS wrapper. In a real ESM environment (running this file via
// --experimental-strip-types) it doesn't exist — but that path isn't shipped:
// taskdir.ts is the single entry for both the SEA .exe build and the npm bin.
declare const require: ((id: string) => unknown) | undefined;

function loadSea(): SeaApi | null {
  try {
    if (typeof require !== "function") return null;
    const mod = require("node:sea") as SeaApi | undefined;
    if (mod && typeof mod.isSea === "function" && mod.isSea()) return mod;
  } catch {
    /* not in SEA */
  }
  return null;
}

function extractedBundleDir(): string {
  const base =
    process.platform === "win32"
      ? process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local")
      : process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share");
  return path.join(base, "taskdir", "web", VERSION);
}

async function extractSeaWebBundle(sea: SeaApi): Promise<string> {
  const target = extractedBundleDir();
  const marker = path.join(target, ".taskdir-extracted");
  if (existsSync(marker) && existsSync(path.join(target, "server.js"))) {
    return target;
  }
  process.stdout.write(`taskdir: extracting web bundle to ${target} (first run)\n`);
  await fs.mkdir(target, { recursive: true });
  const zipBytes = Buffer.from(sea.getAsset("web.zip"));
  if (typeof require !== "function") {
    throw new Error("SEA web bundle extraction requires CJS runtime");
  }
  // adm-zip is bundled into the SEA binary by esbuild.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const AdmZip = require("adm-zip") as new (b: Buffer) => {
    extractAllTo: (target: string, overwrite: boolean) => void;
  };
  const zip = new AdmZip(zipBytes);
  zip.extractAllTo(target, /* overwrite */ true);
  await fs.writeFile(marker, new Date().toISOString(), "utf8");
  return target;
}

// ---------------------------------------------------------------------------
// entry
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // In a SEA build, Node sets process.argv[1] to the exe path (same as argv[0]),
  // so the first user-supplied arg is argv[2]. Matches the convention used
  // when launching node with a script: [node, scriptPath, ...userArgs].
  const userArgv = process.argv.slice(2);

  // Internal mode: the .exe is being used as the Node runtime to launch
  // the bundled Next.js server. Just dynamic-import the given script.
  if (userArgv[0] === "--internal-launch-next") {
    const serverPath = userArgv[1];
    if (!serverPath) {
      process.stderr.write("taskdir: --internal-launch-next requires a script path\n");
      process.exit(1);
    }
    // Dynamic ESM import on Windows needs a file:// URL, not a bare path.
    await import(pathToFileURL(serverPath).href);
    return;
  }

  const sea = loadSea();
  if (sea) {
    bundleResolver = {
      resolveWebDir: () => extractSeaWebBundle(sea),
      internalLaunchArgs: ["--internal-launch-next"],
      skipDepInstall: true,
    };
  } else {
    // Dev / npm path: web bundle lives next to the script directory.
    const { fileURLToPath } = await import("node:url");
    const here = path.dirname(fileURLToPath(import.meta.url));
    const webDir = path.resolve(here, "..", "web");
    bundleResolver = {
      resolveWebDir: async () => webDir,
      internalLaunchArgs: [],
      skipDepInstall: false,
    };
  }

  await dispatch(userArgv);
}

main().catch((e) => {
  process.stderr.write(`fatal: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
