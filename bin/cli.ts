// Shared command implementations invoked from the unified `taskdir` dispatcher
// (bin/taskdir.ts) — used by both the npm bin and the SEA `taskdir.exe`.

import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import { promises as fs, existsSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import readline from "node:readline/promises";
import { createInterface } from "node:readline";

// ---------------------------------------------------------------------------
// init
// ---------------------------------------------------------------------------

const DEFAULT_TASKS_DIR = ".taskdir/tasks";

interface InitArgs {
  tasksDir?: string;
  yes: boolean;
  help: boolean;
}

function parseInitArgs(argv: string[]): InitArgs {
  const out: InitArgs = { yes: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--yes" || a === "-y") out.yes = true;
    else if (a === "--tasks-dir") out.tasksDir = argv[++i];
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function promptTasksDir(defaultValue: string): Promise<string> {
  if (!process.stdin.isTTY) return defaultValue;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (
      await rl.question(`where should tasks be stored? [${defaultValue}]: `)
    ).trim();
    return answer || defaultValue;
  } finally {
    rl.close();
  }
}

async function ensureGitignoreEntry(
  root: string,
  ignoreLine: string,
): Promise<"added" | "already-present" | "no-git" | "outside-root"> {
  if (!ignoreLine) return "outside-root";
  if (!(await pathExists(path.join(root, ".git")))) return "no-git";
  const gitignorePath = path.join(root, ".gitignore");
  let current = "";
  try {
    current = await fs.readFile(gitignorePath, "utf8");
  } catch {
    current = "";
  }
  const lines = current.split(/\r?\n/);
  const has = lines.some((line) => line.trim() === ignoreLine);
  if (has) return "already-present";
  const needsLeadingNewline = current.length > 0 && !current.endsWith("\n");
  const appended = `${current}${needsLeadingNewline ? "\n" : ""}${ignoreLine}\n`;
  await fs.writeFile(gitignorePath, appended, "utf8");
  return "added";
}

function gitignoreLineFor(root: string, tasksDirAbs: string): string {
  const rel = path.relative(root, tasksDirAbs).split(path.sep).join("/");
  if (!rel || rel.startsWith("..")) return "";
  return `${rel}/`;
}

async function readExistingTasksDir(configPath: string): Promise<string | null> {
  let raw: string;
  try {
    raw = await fs.readFile(configPath, "utf8");
  } catch {
    return null;
  }
  for (const line of raw.split(/\r?\n/)) {
    const m = line.trim().match(/^tasks_dir\s*=\s*"([^"]+)"\s*$/);
    if (m) return m[1];
  }
  return null;
}

function printInitHelp(): void {
  process.stdout.write(
    [
      "Usage: taskdir init [options]",
      "",
      "Options:",
      "  --tasks-dir <path>   directory to store tasks (default: .taskdir/tasks)",
      "  -y, --yes            accept defaults; do not prompt",
      "  -h, --help           show this help",
      "",
    ].join("\n"),
  );
}

export async function runInit(argv: string[]): Promise<void> {
  const args = parseInitArgs(argv);
  if (args.help) {
    printInitHelp();
    return;
  }

  const root = process.cwd();
  const dotTaskdir = path.join(root, ".taskdir");
  const configPath = path.join(dotTaskdir, "config.toml");
  const existingTasksDir = await readExistingTasksDir(configPath);
  const alreadyInitialised = existingTasksDir !== null;

  let tasksDirInput: string;
  if (args.tasksDir) {
    tasksDirInput = args.tasksDir;
  } else if (existingTasksDir) {
    tasksDirInput = existingTasksDir;
  } else if (args.yes) {
    tasksDirInput = DEFAULT_TASKS_DIR;
  } else {
    tasksDirInput = await promptTasksDir(DEFAULT_TASKS_DIR);
  }

  const tasksDirAbs = path.isAbsolute(tasksDirInput)
    ? tasksDirInput
    : path.resolve(root, tasksDirInput);
  const tasksDirForConfig = path.isAbsolute(tasksDirInput)
    ? tasksDirInput
    : path.relative(root, tasksDirAbs).split(path.sep).join("/") || ".";

  await fs.mkdir(tasksDirAbs, { recursive: true });
  await fs.mkdir(dotTaskdir, { recursive: true });

  const config = [
    "# taskdir project config",
    `tasks_dir = "${tasksDirForConfig}"`,
    "",
  ].join("\n");
  await fs.writeFile(configPath, config, "utf8");

  const readmePath = path.join(dotTaskdir, "README.md");
  if (!(await pathExists(readmePath))) {
    await fs.writeFile(
      readmePath,
      [
        "# taskdir",
        "",
        `Task substrate for this project. Tasks live in \`${tasksDirForConfig}/<id>-<slug>/\`.`,
        "Read by both the taskdir web UI and the stdio MCP server when launched from this directory.",
        "",
      ].join("\n"),
      "utf8",
    );
  }

  const ignoreLine = gitignoreLineFor(root, tasksDirAbs);
  const gitignoreResult = await ensureGitignoreEntry(root, ignoreLine);

  const shownDir = path.relative(root, tasksDirAbs).split(path.sep).join("/") || tasksDirAbs;
  process.stdout.write(
    `${alreadyInitialised ? "taskdir already initialised" : "initialised taskdir"} — tasks: ${shownDir}\n`,
  );
  if (gitignoreResult === "added") {
    process.stdout.write(`added ${ignoreLine} to .gitignore\n`);
  } else if (gitignoreResult === "already-present") {
    process.stdout.write(`.gitignore already ignores ${ignoreLine}\n`);
  } else if (gitignoreResult === "outside-root") {
    process.stdout.write(`tasks dir is outside project root — skipping .gitignore\n`);
  }
}

// ---------------------------------------------------------------------------
// mcp (stdio JSON-RPC)
// ---------------------------------------------------------------------------

function writeMcp(obj: unknown): void {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

export async function runMcp(): Promise<void> {
  const { handleRpc } = await import("../src/lib/mcp-handler.ts");
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let req: { jsonrpc?: string; method?: string; id?: unknown };
    try {
      req = JSON.parse(trimmed);
    } catch {
      writeMcp({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "parse error" },
      });
      continue;
    }
    if (!req || req.jsonrpc !== "2.0" || typeof req.method !== "string") {
      writeMcp({
        jsonrpc: "2.0",
        id: req?.id ?? null,
        error: { code: -32600, message: "invalid request" },
      });
      continue;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resp = await handleRpc(req as any);
    if (resp !== null) writeMcp(resp);
  }
}

// ---------------------------------------------------------------------------
// run (web UI)
// ---------------------------------------------------------------------------

interface RunArgs {
  port: string;
  host: string;
  help: boolean;
  stop: boolean;
  stopAll: boolean;
}

function parseRunArgs(argv: string[]): RunArgs {
  const out: RunArgs = {
    port: process.env.PORT || "3000",
    host: process.env.HOSTNAME || "127.0.0.1",
    help: false,
    stop: false,
    stopAll: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--port" || a === "-p") out.port = argv[++i];
    else if (a === "--host") out.host = argv[++i];
    else if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--stop") out.stop = true;
    else if (a === "--stop-all") out.stopAll = true;
  }
  return out;
}

function printRunHelp(): void {
  process.stdout.write(
    [
      "Usage: taskdir web [options]",
      "",
      "Launches the taskdir web UI for the current project directory.",
      "",
      "Options:",
      "  -p, --port <n>     port to listen on (default: 3000, auto-increments if busy)",
      "      --host <addr>  bind address (default: 127.0.0.1)",
      "      --stop         stop the taskdir web instance for the current project",
      "      --stop-all     stop every running taskdir web instance",
      "  -h, --help         show this help",
      "",
    ].join("\n"),
  );
}

interface InstanceRecord {
  pid: number;
  port: number;
  host: string;
  projectRoot: string;
  startedAt: string;
}

function instancesDir(): string {
  const base =
    process.platform === "win32"
      ? process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local")
      : process.env.XDG_STATE_HOME || path.join(os.homedir(), ".local", "state");
  return path.join(base, "taskdir", "instances");
}

function instanceFileFor(projectRoot: string): string {
  const hash = crypto
    .createHash("sha1")
    .update(path.resolve(projectRoot))
    .digest("hex")
    .slice(0, 16);
  return path.join(instancesDir(), `${hash}.json`);
}

async function writeInstance(rec: InstanceRecord): Promise<void> {
  await fs.mkdir(instancesDir(), { recursive: true });
  await fs.writeFile(
    instanceFileFor(rec.projectRoot),
    JSON.stringify(rec, null, 2) + "\n",
    "utf8",
  );
}

async function removeInstance(projectRoot: string): Promise<void> {
  try {
    await fs.unlink(instanceFileFor(projectRoot));
  } catch {
    /* already gone */
  }
}

async function readInstances(): Promise<Array<{ file: string; rec: InstanceRecord }>> {
  let entries: string[];
  try {
    entries = await fs.readdir(instancesDir());
  } catch {
    return [];
  }
  const out: Array<{ file: string; rec: InstanceRecord }> = [];
  for (const name of entries) {
    if (!name.endsWith(".json")) continue;
    const file = path.join(instancesDir(), name);
    try {
      const rec = JSON.parse(await fs.readFile(file, "utf8")) as InstanceRecord;
      if (typeof rec.pid === "number" && typeof rec.projectRoot === "string") {
        out.push({ file, rec });
      }
    } catch {
      /* malformed — skip */
    }
  }
  return out;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

function killProcessTree(pid: number): void {
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/T", "/F", "/PID", String(pid)], { stdio: "ignore" });
    return;
  }
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    /* already gone */
  }
}

async function stopInstance(
  rec: InstanceRecord,
  file: string,
): Promise<"stopped" | "stale"> {
  if (!isProcessAlive(rec.pid)) {
    try {
      await fs.unlink(file);
    } catch {
      /* ignore */
    }
    return "stale";
  }
  killProcessTree(rec.pid);
  try {
    await fs.unlink(file);
  } catch {
    /* ignore */
  }
  return "stopped";
}

async function stopWebForCwd(): Promise<void> {
  const projectRoot = path.resolve(process.cwd());
  const file = instanceFileFor(projectRoot);
  let rec: InstanceRecord;
  try {
    rec = JSON.parse(await fs.readFile(file, "utf8")) as InstanceRecord;
  } catch {
    process.stdout.write(`taskdir web: no running instance for ${projectRoot}\n`);
    return;
  }
  const result = await stopInstance(rec, file);
  if (result === "stopped") {
    process.stdout.write(
      `taskdir web: stopped pid ${rec.pid} on ${rec.host}:${rec.port} (${rec.projectRoot})\n`,
    );
  } else {
    process.stdout.write(
      `taskdir web: no running instance for ${projectRoot} (stale record cleared)\n`,
    );
  }
}

async function stopAllWeb(): Promise<void> {
  const instances = await readInstances();
  if (instances.length === 0) {
    process.stdout.write("taskdir web: no running instances\n");
    return;
  }
  let stopped = 0;
  let stale = 0;
  for (const { file, rec } of instances) {
    const result = await stopInstance(rec, file);
    if (result === "stopped") {
      process.stdout.write(
        `  stopped pid ${rec.pid} on ${rec.host}:${rec.port}  (${rec.projectRoot})\n`,
      );
      stopped++;
    } else {
      stale++;
    }
  }
  process.stdout.write(
    `taskdir web: stopped ${stopped} instance(s)` +
      (stale ? ` (cleaned ${stale} stale record(s))` : "") +
      "\n",
  );
}

function ensureWebDeps(webDir: string): void {
  // The npm tarball ships package.json + .next/ + server.js but not
  // node_modules. On first run we install the runtime deps in place so
  // subsequent launches are instant. The .exe build skips this entirely
  // by shipping a pre-installed node_modules embedded in the asset.
  const marker = path.join(webDir, "node_modules", "next", "package.json");
  if (existsSync(marker)) return;

  process.stdout.write(
    "taskdir: first-time setup — installing web runtime (~1 min)\n",
  );
  const result = spawnSync(
    "npm",
    ["install", "--omit=dev", "--no-package-lock", "--no-audit", "--no-fund"],
    { cwd: webDir, stdio: "inherit", shell: process.platform === "win32" },
  );
  if (result.status !== 0) {
    process.stderr.write(
      `taskdir: web runtime install failed (exit ${result.status}).\n` +
        `cd ${webDir} && npm install --omit=dev  # to retry manually\n`,
    );
    process.exit(result.status ?? 1);
  }
}

export interface RunOpts {
  // Absolute path to the directory containing server.js and the .next/
  // build output. For the npm bin this is <package>/dist/web/. For the
  // unified taskdir.exe it's the extracted bundle in %LOCALAPPDATA%.
  webDir: string;
  // If true, skip the first-time `npm install` step (used by the .exe
  // build which embeds a pre-installed node_modules).
  skipDepInstall?: boolean;
  // Extra args to prepend before the server.js path when spawning the
  // child process. Empty for the npm bin (process.execPath is node).
  // For the SEA .exe this is ["--internal-launch-next"] so the child
  // taskdir.exe knows to act as raw Node executing the server entry.
  internalLaunchArgs?: string[];
}

async function findFreePort(
  host: string,
  startPort: number,
  maxAttempts = 20,
): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    const free = await new Promise<boolean>((resolve) => {
      const s = net.createServer();
      s.once("error", () => resolve(false));
      s.once("listening", () => s.close(() => resolve(true)));
      s.listen(port, host);
    });
    if (free) return port;
  }
  throw new Error(
    `no free port in range ${startPort}-${startPort + maxAttempts - 1}`,
  );
}

function displayHost(host: string): string {
  if (host === "0.0.0.0" || host === "127.0.0.1") return "localhost";
  return host;
}

function pingUrl(url: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request(url, { method: "HEAD", timeout: timeoutMs }, (res) => {
      res.resume();
      resolve(true);
    });
    req.once("error", () => resolve(false));
    req.once("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

async function waitForServer(
  url: string,
  totalTimeoutMs: number,
  isDead: () => boolean,
): Promise<void> {
  const deadline = Date.now() + totalTimeoutMs;
  while (Date.now() < deadline) {
    if (isDead()) throw new Error("server process exited before it became ready");
    if (await pingUrl(url, 500)) return;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`server did not respond within ${Math.round(totalTimeoutMs / 1000)}s`);
}

function openInBrowser(url: string): void {
  const opts = { detached: true, stdio: "ignore" as const };
  try {
    if (process.platform === "win32") {
      spawn("cmd", ["/c", "start", "", url], opts).unref();
    } else if (process.platform === "darwin") {
      spawn("open", [url], opts).unref();
    } else {
      spawn("xdg-open", [url], opts).unref();
    }
  } catch {
    /* browser open is best-effort */
  }
}

class Spinner {
  private frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  private i = 0;
  private timer: NodeJS.Timeout | null = null;
  private label = "";
  private active = false;
  private readonly tty = Boolean(process.stdout.isTTY);

  start(label: string): void {
    this.label = label;
    if (!this.tty) {
      process.stdout.write(`${label}\n`);
      return;
    }
    this.active = true;
    process.stdout.write("\x1B[?25l");
    this.render();
    this.timer = setInterval(() => this.render(), 80);
  }

  setLabel(label: string): void {
    this.label = label;
    if (this.active) this.render();
  }

  private render(): void {
    const frame = this.frames[this.i % this.frames.length];
    this.i++;
    process.stdout.write(`\r\x1B[2K${frame} ${this.label}`);
  }

  stop(finalLine?: string): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.tty && this.active) {
      process.stdout.write("\r\x1B[2K\x1B[?25h");
    }
    this.active = false;
    if (finalLine) process.stdout.write(`${finalLine}\n`);
  }
}

export async function runWeb(argv: string[], opts: RunOpts): Promise<void> {
  const args = parseRunArgs(argv);
  if (args.help) {
    printRunHelp();
    return;
  }
  if (args.stopAll) {
    await stopAllWeb();
    return;
  }
  if (args.stop) {
    await stopWebForCwd();
    return;
  }

  const serverPath = path.join(opts.webDir, "server.js");
  if (!existsSync(serverPath)) {
    process.stderr.write(
      `taskdir web: web bundle not found at ${serverPath}\n` +
        `(this build is missing the standalone Next.js server)\n`,
    );
    process.exit(1);
  }

  if (!opts.skipDepInstall) ensureWebDeps(opts.webDir);

  const projectRoot = process.cwd();
  const host = args.host;
  const startPort = Number.parseInt(args.port, 10) || 3000;

  let port: number;
  try {
    port = await findFreePort(host, startPort);
  } catch (e) {
    process.stderr.write(
      `taskdir web: ${e instanceof Error ? e.message : String(e)}\n`,
    );
    process.exit(1);
    return;
  }

  const url = `http://${displayHost(host)}:${port}`;
  const spinner = new Spinner();
  spinner.start(
    port === startPort
      ? `starting taskdir web on ${url} ...`
      : `port ${startPort} busy — starting taskdir web on ${url} ...`,
  );

  const stderrChunks: Buffer[] = [];
  const child = spawn(
    process.execPath,
    [...(opts.internalLaunchArgs ?? []), serverPath],
    {
      cwd: opts.webDir,
      stdio: ["ignore", "ignore", "pipe"],
      env: {
        ...process.env,
        TASKDIR_PROJECT_ROOT: projectRoot,
        PORT: String(port),
        HOSTNAME: host,
        NODE_ENV: "production",
      },
    },
  );
  child.stderr?.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

  let childExited = false;
  let childExit: { code: number | null; signal: NodeJS.Signals | null } = {
    code: null,
    signal: null,
  };
  child.on("exit", (code, signal) => {
    childExited = true;
    childExit = { code, signal };
  });

  const forward = (sig: NodeJS.Signals) => () => child.kill(sig);
  process.on("SIGINT", forward("SIGINT"));
  process.on("SIGTERM", forward("SIGTERM"));

  try {
    await waitForServer(url, 60_000, () => childExited);
  } catch (e) {
    spinner.stop();
    if (!childExited) child.kill();
    process.stderr.write(
      `taskdir web: ${e instanceof Error ? e.message : String(e)}\n`,
    );
    const err = Buffer.concat(stderrChunks).toString().trim();
    if (err) process.stderr.write(err + "\n");
    process.exit(1);
    return;
  }

  spinner.stop(`taskdir web: ${url}  (project: ${projectRoot})`);
  openInBrowser(url);
  process.stdout.write(
    "opened in default browser — press Ctrl+C, or run `taskdir web --stop`, to stop\n",
  );

  await writeInstance({
    pid: process.pid,
    port,
    host,
    projectRoot,
    startedAt: new Date().toISOString(),
  }).catch(() => {
    /* instance tracking is best-effort */
  });

  try {
    await new Promise<void>((resolve) => {
      if (childExited) return resolve();
      child.once("exit", () => resolve());
    });
  } finally {
    await removeInstance(projectRoot).catch(() => {});
  }

  if (childExit.signal) {
    process.kill(process.pid, childExit.signal);
    return;
  }
  const code = childExit.code ?? 0;
  if (code !== 0) {
    const err = Buffer.concat(stderrChunks).toString().trim();
    if (err) process.stderr.write(err + "\n");
  }
  process.exit(code);
}
