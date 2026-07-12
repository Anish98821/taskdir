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
import { createInterface, emitKeypressEvents } from "node:readline";

// ---------------------------------------------------------------------------
// init
// ---------------------------------------------------------------------------

const DEFAULT_TASKS_DIR = ".taskdir/tasks";

type SkillTarget = "claude" | "codex";

interface SkillOption {
  id: SkillTarget;
  label: string;
  relPath: string; // path relative to project root
}

const SKILL_OPTIONS: SkillOption[] = [
  { id: "claude", label: "Claude Code             — .claude/skills/taskdir/SKILL.md", relPath: ".claude/skills/taskdir/SKILL.md" },
  { id: "codex",  label: "Codex / Gemini / Cursor — .agents/skills/taskdir/SKILL.md", relPath: ".agents/skills/taskdir/SKILL.md" },
];

type McpTarget = "claude" | "cursor";

interface McpOption {
  id: McpTarget;
  label: string;
  relPath: string; // config file relative to project root
}

const MCP_OPTIONS: McpOption[] = [
  { id: "claude", label: "Claude Code — .mcp.json",         relPath: ".mcp.json" },
  { id: "cursor", label: "Cursor      — .cursor/mcp.json",  relPath: ".cursor/mcp.json" },
];

interface InitArgs {
  tasksDir?: string;
  projectName?: string;
  skills?: Set<SkillTarget>;
  mcp?: Set<McpTarget>;
  yes: boolean;
  help: boolean;
}

function parseInitArgs(argv: string[]): InitArgs {
  const out: InitArgs = { yes: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--yes" || a === "-y") out.yes = true;
    else if (a === "--tasks-dir") out.tasksDir = argv[++i];
    else if (a === "--name") out.projectName = argv[++i];
    else if (a === "--skills") {
      const raw = argv[++i] ?? "";
      const parsed = new Set<SkillTarget>();
      if (raw !== "none") {
        for (const tok of raw.split(",").map((s) => s.trim()).filter(Boolean)) {
          if (tok === "claude" || tok === "codex") parsed.add(tok);
        }
      }
      out.skills = parsed;
    } else if (a === "--mcp") {
      const raw = argv[++i] ?? "";
      const parsed = new Set<McpTarget>();
      if (raw !== "none") {
        for (const tok of raw.split(",").map((s) => s.trim()).filter(Boolean)) {
          if (tok === "claude" || tok === "cursor") parsed.add(tok);
        }
      }
      out.mcp = parsed;
    } else if (a === "--help" || a === "-h") out.help = true;
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

async function promptLine(question: string, defaultValue: string): Promise<string> {
  if (!process.stdin.isTTY) return defaultValue;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(question)).trim();
    return answer || defaultValue;
  } finally {
    rl.close();
  }
}

async function promptMultiSelect<T extends string>(
  header: string,
  items: ReadonlyArray<{ id: T; label: string }>,
  defaults: Set<T>,
): Promise<Set<T>> {
  if (!process.stdin.isTTY) return new Set(defaults);
  const selected = new Set<T>(defaults);
  let cursor = 0;

  const out = process.stdout;
  const stdin = process.stdin;
  emitKeypressEvents(stdin);
  const wasRaw = stdin.isRaw;
  stdin.setRawMode(true);
  stdin.resume();

  out.write(`${header}\n`);
  out.write("\x1B[?25l");

  const render = (first: boolean) => {
    if (!first) out.write(`\x1B[${items.length}A`);
    for (let i = 0; i < items.length; i++) {
      const isCursor = i === cursor;
      const isChecked = selected.has(items[i].id);
      const marker = isChecked ? "[x]" : "[ ]";
      const pointer = isCursor ? ">" : " ";
      out.write(`\r\x1B[2K${pointer} ${marker} ${items[i].label}\n`);
    }
  };

  render(true);

  return new Promise<Set<T>>((resolve) => {
    const cleanup = () => {
      stdin.removeListener("keypress", onKey);
      out.write("\x1B[?25h");
      stdin.setRawMode(wasRaw);
      stdin.pause();
    };
    const onKey = (
      _str: string | undefined,
      key: { name?: string; ctrl?: boolean; sequence?: string } | undefined,
    ) => {
      if (!key) return;
      if (key.ctrl && key.name === "c") {
        cleanup();
        process.exit(130);
      }
      if (key.name === "up" || key.name === "k") {
        cursor = (cursor - 1 + items.length) % items.length;
        render(false);
      } else if (key.name === "down" || key.name === "j") {
        cursor = (cursor + 1) % items.length;
        render(false);
      } else if (key.name === "space") {
        const id = items[cursor].id;
        if (selected.has(id)) selected.delete(id);
        else selected.add(id);
        render(false);
      } else if (key.name === "return") {
        cleanup();
        resolve(selected);
      }
    };
    stdin.on("keypress", onKey);
  });
}

function buildSkillContent(projectName: string): string {
  const displayName = projectName || "this project";
  return `---
name: taskdir
description: Use whenever coordinating work in a project that has a .taskdir/ folder. Register as an agent, pick up tasks assigned to you (or unassigned), keep status current, and split large tasks into smaller ones. Applies to ${displayName}.
---

# Taskdir — Agent Skill

You're an AI coding agent working in **${displayName}**, a project that uses **taskdir** to track work. Taskdir is a local-first task tracker that stores tasks as folders of markdown on disk and exposes them over MCP. Follow this skill every time you connect.

## 1. Reuse or register an agent on first connect

Before doing any work, make sure you're represented in the project's agent registry. This makes the user aware of you and lets task routing target you. **Prefer reusing an existing agent over registering a new one.**

First, list who's already registered:

\`\`\`jsonc
// MCP tool call
{ "name": "list_agents", "arguments": {} }
\`\`\`

- If a **generic agent of your provider/model already exists** (e.g. a \`Claude Code\` entry when you're Claude Code), just adopt it — use its \`id\` for task routing and skip registration. Don't create a near-duplicate.
- Only \`register_agent\` when there's no suitable match, **or** the user explicitly wants a distinct identity for this session.

\`\`\`jsonc
// MCP tool call — only when no reusable agent exists
{
  "name": "register_agent",
  "arguments": {
    "name": "<your display name>",     // e.g. "Claude Code", "Codex"
    "provider": "<provider id>"        // anthropic | openai | google | meta | mistral | xai | cohere | deepseek | custom
  }
}
\`\`\`

Rules:
- Use a **stable, generic display name** for your provider/model class (e.g. "Claude Code") so registration is idempotent and reuses one record across sessions.
- The \`id\` is auto-generated from \`name\`. You can pass an explicit \`id\` to update an existing record (idempotent).
- If your provider isn't in the enum, use \`custom\`.
- Do **not** delete other agents the user has registered. Use \`unregister_agent\` only for your own, or when the user asks.

## 2. Only pick up tasks meant for you

Every task has a \`meta.toml\` with an optional \`agent\` field.

| \`meta.agent\` value | Who picks it up |
|---|---|
| unset | any agent |
| your agent id | only you |
| another agent's id | not you — skip |

Use \`list_tasks\` (filtered by status) and walk the candidates. Skip any task whose \`agent\` doesn't match your registered id. Don't change another agent's tasks.

## 3. Break big tasks into smaller tasks

If a task is more than a few hours of work, **don't try to do it in one shot.** Create smaller child tasks via \`create_task\` and link them in the parent's report. Each child should have one clear deliverable.

Use the parent's status as a coordinator:
- Leave parent in \`in_progress\` while children run.
- Mark parent \`done\` only when all children are \`done\` and you've written the parent's report.

## 4. Status discipline

Statuses: \`pending\`, \`in_progress\`, \`awaiting_approval\`, \`blocked\`, \`done\`.

Modes are project-defined — call \`list_modes\` to see them. A task's mode is in \`meta.toml\`; if that mode has a **strategy**, \`get_task\` appends it under \`## strategy for mode: <id>\` — follow it as instructions for that class of task.

Set \`in_progress\` immediately when you start. Finish line depends on \`mode\`:
- \`plan_and_execute\` / \`fast_execute\`: code shipped and verified.
- \`plan_only\`: \`plan.md\` written, then \`awaiting_approval\`.
- \`report_only\`: \`report.md\` written.

If \`meta.generate_report = true\`, write \`report.md\` before flipping to \`done\`.

## 5. Awaiting approval

Use \`awaiting_approval\` when you've written a plan and want the user to OK it. Set the status, say "ready for approval", and **stop**. Do not execute until the user proceeds.

## 6. Blocking

Use \`blocked\` when you can't proceed without user input (ambiguous requirement, missing secret, destructive choice). Write the question into \`clarification.md\` via \`append_to_file\`.

## 7. Use the tool whenever it would help

Concrete cases:
- Discovered follow-up work → \`create_task\`.
- Filed a question for the user → set parent \`blocked\` and write \`clarification.md\`.
- Finished a sub-step → don't update partially; finish the *task*, then update.

## 8. Reports

When \`meta.generate_report = true\`, write \`report.md\` with:
- One-sentence summary of what changed (or didn't).
- Files touched.
- Verification: tests run, build passed, browser tested.
- Follow-ups (filed as new tasks if actionable).

Don't paste large code blocks. Don't recap the conversation.

## 9. File layout

\`\`\`
tasks/
  <NNNN>-<slug>/
    meta.toml
    status
    context.md
    plan.md
    clarification.md
    report.md
    <anything>.md
\`\`\`

## 10. Don't fight the user

If the user manually edits a task, status, or meta — assume they meant it. Don't re-flip. Re-read before reacting.

## MCP surface

\`\`\`
list_tasks(filter)
get_task(id)
create_task({title, ...})
update_status(id, status)
update_meta(id, patch)
append_to_file(id, filename, content)
create_file(id, filename)
rename_file(id, old, new)
delete_file(id, filename)
list_modes()
list_agents()
register_agent({name, provider, id?})
unregister_agent(id)
\`\`\`
`;
}

async function writeSkillFile(
  root: string,
  relPath: string,
  content: string,
): Promise<"written" | "existed"> {
  const abs = path.join(root, relPath);
  if (await pathExists(abs)) return "existed";
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, "utf8");
  return "written";
}

interface McpEntry {
  command: string;
  args?: string[];
}

async function registerMcp(
  root: string,
  relPath: string,
  name: string,
  entry: McpEntry,
): Promise<"added" | "updated" | "unchanged"> {
  const abs = path.join(root, relPath);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  let json: { mcpServers?: Record<string, McpEntry> } = {};
  try {
    const raw = await fs.readFile(abs, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") {
      json = parsed as { mcpServers?: Record<string, McpEntry> };
    }
  } catch {
    /* file missing or invalid — start fresh */
  }
  if (!json.mcpServers || typeof json.mcpServers !== "object") {
    json.mcpServers = {};
  }
  const existing = json.mcpServers[name];
  const same =
    existing &&
    existing.command === entry.command &&
    JSON.stringify(existing.args ?? []) === JSON.stringify(entry.args ?? []);
  if (same) return "unchanged";
  const wasPresent = Boolean(existing);
  json.mcpServers[name] = entry;
  await fs.writeFile(abs, JSON.stringify(json, null, 2) + "\n", "utf8");
  return wasPresent ? "updated" : "added";
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

interface ExistingConfig {
  tasksDir: string | null;
  name: string | null;
}

async function readExistingConfig(configPath: string): Promise<ExistingConfig> {
  const out: ExistingConfig = { tasksDir: null, name: null };
  let raw: string;
  try {
    raw = await fs.readFile(configPath, "utf8");
  } catch {
    return out;
  }
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    const td = t.match(/^tasks_dir\s*=\s*"([^"]+)"\s*$/);
    if (td) out.tasksDir = td[1];
    const nm = t.match(/^name\s*=\s*"([^"]+)"\s*$/);
    if (nm) out.name = nm[1];
  }
  return out;
}

function printInitHelp(): void {
  process.stdout.write(
    [
      "Usage: taskdir init [options]",
      "",
      "Options:",
      "  --name <name>        project name (shown in the sidebar; default: folder name)",
      "  --tasks-dir <path>   directory to store tasks (default: .taskdir/tasks)",
      "  --skills <list>      comma-separated skills to install: claude,codex (or 'none')",
      "  --mcp <list>         comma-separated MCP registrations: claude,cursor (or 'none')",
      "  -y, --yes            accept defaults; do not prompt",
      "  -h, --help           show this help",
      "",
    ].join("\n"),
  );
}

function tomlEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function printInitBanner(): void {
  if (!process.stdout.isTTY) return;
  const cyan = "\x1B[36m";
  const dim = "\x1B[2m";
  const reset = "\x1B[0m";
  const banner = [
    "  _            _       _ _      ",
    " | |_ __ _ ___| | ____| (_)_ __ ",
    " | __/ _` / __| |/ / _` | | '__|",
    " | || (_| \\__ \\   < (_| | | |   ",
    "  \\__\\__,_|___/_|\\_\\__,_|_|_|   ",
  ];
  process.stdout.write("\n");
  for (const line of banner) {
    process.stdout.write(`${cyan}${line}${reset}\n`);
  }
  process.stdout.write(
    `${dim}   local task substrate for AI coding agents${reset}\n\n`,
  );
}

export async function runInit(argv: string[]): Promise<void> {
  const args = parseInitArgs(argv);
  if (args.help) {
    printInitHelp();
    return;
  }

  printInitBanner();

  const root = process.cwd();
  const dotTaskdir = path.join(root, ".taskdir");
  const configPath = path.join(dotTaskdir, "config.toml");
  const existing = await readExistingConfig(configPath);
  const alreadyInitialised = existing.tasksDir !== null;

  const folderName = path.basename(root) || "taskdir";

  // 1. project name
  let projectName: string;
  if (args.projectName) {
    projectName = args.projectName.trim();
  } else if (existing.name) {
    projectName = existing.name;
  } else if (args.yes) {
    projectName = folderName;
  } else {
    projectName = await promptLine(`project name [${folderName}]: `, folderName);
  }

  // 2. tasks dir
  let tasksDirInput: string;
  if (args.tasksDir) {
    tasksDirInput = args.tasksDir;
  } else if (existing.tasksDir) {
    tasksDirInput = existing.tasksDir;
  } else if (args.yes) {
    tasksDirInput = DEFAULT_TASKS_DIR;
  } else {
    tasksDirInput = await promptLine(
      `where should tasks be stored? [${DEFAULT_TASKS_DIR}]: `,
      DEFAULT_TASKS_DIR,
    );
  }

  const tasksDirAbs = path.isAbsolute(tasksDirInput)
    ? tasksDirInput
    : path.resolve(root, tasksDirInput);
  const tasksDirForConfig = path.isAbsolute(tasksDirInput)
    ? tasksDirInput
    : path.relative(root, tasksDirAbs).split(path.sep).join("/") || ".";

  // 3. skills selection (default: both on)
  const defaultSkills = new Set<SkillTarget>(["claude", "codex"]);
  let skills: Set<SkillTarget>;
  if (args.skills) {
    skills = args.skills;
  } else if (args.yes) {
    skills = defaultSkills;
  } else {
    skills = await promptMultiSelect(
      "install skill files (space to toggle, ↑/↓ to move, enter to confirm):",
      SKILL_OPTIONS,
      defaultSkills,
    );
  }

  // 4. MCP registration (project-scoped; default: both on)
  const defaultMcp = new Set<McpTarget>(["claude", "cursor"]);
  let mcpTargets: Set<McpTarget>;
  if (args.mcp) {
    mcpTargets = args.mcp;
  } else if (args.yes) {
    mcpTargets = defaultMcp;
  } else {
    mcpTargets = await promptMultiSelect(
      "register taskdir as an MCP server (project-scoped; space to toggle, enter to confirm):",
      MCP_OPTIONS,
      defaultMcp,
    );
  }

  await fs.mkdir(tasksDirAbs, { recursive: true });
  await fs.mkdir(dotTaskdir, { recursive: true });

  const configLines = ["# taskdir project config"];
  if (projectName) configLines.push(`name = "${tomlEscape(projectName)}"`);
  configLines.push(`tasks_dir = "${tomlEscape(tasksDirForConfig)}"`);
  configLines.push("");
  await fs.writeFile(configPath, configLines.join("\n"), "utf8");

  const statusesPath = path.join(dotTaskdir, "statuses.toml");
  if (!(await pathExists(statusesPath))) {
    const statusBlocks = [
      ["pending", "pending", "neutral"],
      ["in_progress", "in progress", "sky"],
      ["done", "done", "emerald"],
    ].map(
      ([id, label, color]) =>
        `[[status]]\nid = "${id}"\nlabel = "${label}"\ncolor = "${color}"`,
    );
    await fs.writeFile(statusesPath, statusBlocks.join("\n\n") + "\n", "utf8");
  }

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

  // 5. write skill files for each selected agent
  const skillBody = buildSkillContent(projectName || folderName);
  const skillResults: Array<{ opt: SkillOption; result: "written" | "existed" }> = [];
  for (const opt of SKILL_OPTIONS) {
    if (!skills.has(opt.id)) continue;
    const result = await writeSkillFile(root, opt.relPath, skillBody);
    skillResults.push({ opt, result });
  }

  // 6. write MCP config entries
  const mcpEntry: McpEntry = { command: "taskdir", args: ["mcp"] };
  const mcpResults: Array<{
    opt: McpOption;
    result: "added" | "updated" | "unchanged";
  }> = [];
  for (const opt of MCP_OPTIONS) {
    if (!mcpTargets.has(opt.id)) continue;
    const result = await registerMcp(root, opt.relPath, "taskdir", mcpEntry);
    mcpResults.push({ opt, result });
  }

  const shownDir = path.relative(root, tasksDirAbs).split(path.sep).join("/") || tasksDirAbs;
  process.stdout.write(
    `${alreadyInitialised ? "taskdir already initialised" : "initialised taskdir"} — project: ${projectName || folderName}, tasks: ${shownDir}\n`,
  );
  if (gitignoreResult === "added") {
    process.stdout.write(`added ${ignoreLine} to .gitignore\n`);
  } else if (gitignoreResult === "already-present") {
    process.stdout.write(`.gitignore already ignores ${ignoreLine}\n`);
  } else if (gitignoreResult === "outside-root") {
    process.stdout.write(`tasks dir is outside project root — skipping .gitignore\n`);
  }
  for (const { opt, result } of skillResults) {
    process.stdout.write(
      `${result === "written" ? "installed skill" : "skill already present"}: ${opt.relPath}\n`,
    );
  }
  for (const { opt, result } of mcpResults) {
    const verb =
      result === "added"
        ? "registered MCP server"
        : result === "updated"
          ? "updated MCP server entry"
          : "MCP server already registered";
    process.stdout.write(`${verb}: ${opt.relPath}\n`);
  }
  if (mcpResults.length > 0) {
    process.stdout.write(
      "restart your agent (Claude Code, Cursor) to pick up the new MCP server\n",
    );
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
  process.stderr.write(
    `taskdir mcp: listening on stdio (project: ${process.cwd()})\n`,
  );
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
