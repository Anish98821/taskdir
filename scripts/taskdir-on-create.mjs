#!/usr/bin/env node
// Launched by the taskdir `task.created` hook (see .taskdir/hooks.toml).
//
// Starts a Claude Code CLI in the background and asks it to work the task that
// was just created. Design constraints this satisfies:
//
//   * The hook engine kills its child after ~10s (best-effort, non-blocking),
//     so Claude MUST be launched detached and this script must return fast.
//     We spawn detached + unref + exit immediately; Claude outlives us.
//   * Auto-running Claude on every task creation would recurse: Claude creating
//     a subtask would fire the hook again. We stamp TASKDIR_AUTORUN=1 into the
//     Claude env and bail here whenever that flag is already set.
//
// Everything is best-effort: if Claude isn't installed or anything throws, we
// exit 0 so task creation is never affected.
//
// Env knobs:
//   TASKDIR_AUTORUN_DISABLE=1   turn the launcher off without editing hooks.toml
//   TASKDIR_CLAUDE_BIN=claude   which binary to launch
//   TASKDIR_CLAUDE_ARGS=...     extra args (default: --permission-mode acceptEdits)
//                               set to "--dangerously-skip-permissions" for a
//                               fully autonomous background run.

import { spawn } from "node:child_process";
import { mkdirSync, openSync } from "node:fs";
import path from "node:path";

function main() {
  if (process.env.TASKDIR_AUTORUN_DISABLE === "1") return;
  // Recursion guard: this creation originated inside an already-running
  // autorun Claude session (it inherited the flag). Don't launch another.
  if (process.env.TASKDIR_AUTORUN === "1") return;

  const root = process.env.TASKDIR_PROJECT_ROOT || process.cwd();
  const id = (process.env.TASKDIR_ID || "").trim();
  if (!id) return;

  // Sanitize the title so it survives being embedded in a single-line,
  // double-quoted shell argument on both cmd.exe and /bin/sh.
  const title = (process.env.TASKDIR_TITLE || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/["`$%]/g, "'")
    .trim();

  const prompt =
    `A new task was just created in this taskdir project. ` +
    `Work it end to end. Task ${id}: ${title}. ` +
    `Read it with 'taskdir get_task ${id}', then 'taskdir update_status ${id} in_progress', ` +
    `do the work following AGENTS.md and the task's mode strategy, and finish with ` +
    `'taskdir update_status ${id} done'. If you get stuck and need the user, set the ` +
    `status to blocked and write the question into clarification.md instead of guessing.`;

  const bin = process.env.TASKDIR_CLAUDE_BIN || "claude";
  const extraArgs = (process.env.TASKDIR_CLAUDE_ARGS ?? "--permission-mode acceptEdits")
    .split(" ")
    .map((s) => s.trim())
    .filter(Boolean);

  // Log Claude's output so a background run isn't invisible.
  const logDir = path.join(root, ".taskdir", "logs");
  mkdirSync(logDir, { recursive: true });
  const out = openSync(path.join(logDir, `task-${id}.log`), "a");

  // Build one command string and let the shell resolve `claude` (on Windows it
  // is usually a claude.cmd shim that a shell-less spawn can't find). A single
  // double-quoted arg is portable across cmd.exe and /bin/sh.
  const q = (s) => `"${s.replace(/"/g, "'")}"`;
  const command = [bin, "-p", q(prompt), ...extraArgs].join(" ");

  const child = spawn(command, {
    cwd: root,
    detached: true,
    shell: true,
    stdio: ["ignore", out, out],
    env: { ...process.env, TASKDIR_AUTORUN: "1" },
  });
  // If the binary is missing, don't crash — just no-op.
  child.on("error", () => {});
  child.unref();
}

try {
  main();
} catch {
  /* best-effort: never let the hook fail */
}
// Return promptly so the hook's timeout is never in play; the detached child
// keeps running on its own.
process.exit(0);
