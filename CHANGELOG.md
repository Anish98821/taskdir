# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org/).

## 0.8.1 — 2026-07-20

### Changed

- **New brand mark.** The app icon/favicon (sidebar, browser tab, docs site) and the README/GitHub banner now use the new logo.

## 0.8.0 — 2026-07-16

### Removed

- **Status-triggered UI behaviors.** No status id is special anymore — statuses are labels with colors. Gone: the approve/request-changes banner on `awaiting_approval` tasks, the clarification answer box on `blocked` tasks, the notifications drawer (bell) that surfaced both, and the sort boost that floated `blocked`/`awaiting_approval` tasks to the top. The blocked workflow still works as a convention — agents write questions to `clarification.md` and the user answers in the file editor and flips the status back — but the UI no longer hard-codes it. The skill files and docs no longer instruct agents to park plans in `awaiting_approval`; projects that still configure these statuses keep them as plain statuses.

### Fixed

- **`taskdir web` no longer collides with a dev server on the same port (Windows).** The free-port scan trusted a successful bind, but on Windows binding a port another process already listens on can silently succeed, so `taskdir web` would "start" on the dev server's port, the readiness ping would be answered by the dev server, and the browser opened the wrong instance. The scan now also probes the port with a TCP connect (both loopback families for loopback/wildcard binds) and skips ports that accept connections, and the readiness ping targets the exact bind address instead of `localhost`.

### Changed

- **CLI is now the default agent interface.** `taskdir init` defaults `--interface` to `cli` (previously `mcp`), both interactively and with `-y`: skill files now describe the `taskdir <tool>` shell commands by default, and **no MCP server configs are written unless you pick MCP** (`--interface mcp`). This changes `init -y` behavior — pass `--interface mcp` (or `--mcp claude,cursor`) to keep the old result. When CLI is chosen and `taskdir` isn't found on PATH, init prints an install hint. README, `AGENTS.md`, and the brand site now present the CLI as the primary surface, with MCP as the mirror.

## 0.7.0 — 2026-07-14

### Added

- **Full CLI mirror of the MCP surface.** Every MCP tool is now a plain `taskdir` subcommand — `taskdir create_task`, `taskdir list_tasks`, `taskdir update_status`, `taskdir register_agent`, `taskdir unregister_agent`, and the rest. Run `taskdir tools` for the list and `taskdir <tool> --help` for a tool's options. The commands are derived from the same schema the MCP server exposes, so the two can't drift. Options are `--key value`/`--key=value`; required fields may be passed positionally (e.g. `taskdir update_status 0001 done`).
- **Inline hook scripts.** A command hook can now carry inline code (a `script` block) instead of only a command/file path. Settings → hooks offers a dedicated code editor for it. The engine writes the script to a temp file and runs it, honoring a shebang (`#!/usr/bin/env node`, `#!/bin/bash`, …) cross-platform, or falling back to the platform shell.
- **`taskdir init --interface <mcp|cli>`** (with `--cli` shorthand) chooses how agents talk to taskdir and tailors the installed skill files accordingly. Asked interactively when not passed.

### Changed

- Default modes are now `plan` / `bugfix` / `research` (with `plan` the default), each with its own icon.

### Removed

- The `report.md` generation feature (`generate_report` / `report_seen_at` fields and the report notification). Agents can still create a `report.md` like any other markdown file. Old `generate_report` / `report_seen_at` keys in existing `meta.toml` files are ignored on read.

## 0.6.1 — 2026-07-12

(0.6.0 was tagged but its release run failed on a CI-only test issue; it was never published. 0.6.1 is the same feature set plus the CI fix.)

### Added

- **Configurable modes with strategies.** Modes live in `.taskdir/modes.toml` — rename the built-ins, change icons, or add your own. Each mode can carry a **strategy** (markdown at `.taskdir/strategies/<id>.md`) that `get_task` appends for agents, so per-class guidance travels with the work. New `list_modes` MCP tool.
- **Hooks.** Run a shell command or POST a webhook on task events (`task.created`, `task.status_changed`, `task.updated`, `task.deleted`, `agent.registered`, `agent.unregistered`), configured in `.taskdir/hooks.toml`. Commands get the event JSON on stdin plus `TASKDIR_*` env vars; webhooks get a JSON body.
- **Configurable statuses.** Statuses live in `.taskdir/statuses.toml` with a label and color each — relabel, recolor, remove, or add your own; the config is the single source of truth. `taskdir init` seeds `pending`/`in_progress`/`done`. `update_status` validates against the configured set; tasks whose on-disk status is no longer configured stay visible (rendered neutral). `awaiting_approval` and `blocked` keep their approval/clarification banners when configured.
- **Settings redesign.** New shared section layout across five tabs (agents / modes / statuses / hooks / project): all add/edit flows are dialog-based, deletes go through confirm dialogs, changes persist per action (no bulk "save changes"), and empty states have a clear call to action. File add/rename in the task pane are dialogs too.
- **Resizable detail pane.** Drag the left edge of the task detail / new-task pane; width persists, double-click resets, arrow keys work on the focused handle.
- **Responsive tasks page.** On small screens the task detail opens as a full-screen overlay (it was previously hidden entirely), list rows wrap to two lines, the search bar flexes, and sort/filter collapse to icons.

### Changed

- Tasks page restyled to match the design system: rounded chips with tinted backgrounds for status/priority/mode/tags, design-system toolbar buttons. `med` priority is deliberately neutral so `high`/`low` stand out.
- Sidebar collapsed state now persists across the tasks and settings pages.
- UI copy trimmed throughout.
- New app icon.

### Removed

- The report toggle in the new-task draft. `generate_report` still defaults to `true`; set it in `meta.toml` if you need to opt out.

### Fixed

- Tests now isolate `TASKDIR_PROJECT_ROOT`, so they no longer read the developer's real `.taskdir/`, and the test glob is quoted so CI runs the full suite on Linux.

## 0.5.0 — 2026-07-05

### Added

- `taskdir init` now prompts for a **project name** (defaults to the folder name) and stores it as `name` in `.taskdir/config.toml` — surfaced in the web UI sidebar.
- `taskdir init` now installs cross-agent **skill files** (Anthropic's `SKILL.md` format) so any AI coding agent working in the project loads the taskdir contract on session start. Interactive multi-select, both on by default:
  - `.claude/skills/taskdir/SKILL.md` — Claude Code
  - `.agents/skills/taskdir/SKILL.md` — Codex, Gemini CLI, Cursor (interop path)
- `taskdir init` now registers taskdir as an **MCP server**, project-scoped, in the project's local config (`.mcp.json` for Claude Code, `.cursor/mcp.json` for Cursor). Merges into existing config without clobbering other servers.
- `taskdir mcp` now writes a one-line `listening on stdio` banner to **stderr** at startup so humans running it manually can tell it's alive. Invisible to MCP clients (they parse stdout only).
- ASCII-art banner at the top of `taskdir init` in TTY sessions.

### Flags

- `taskdir init --name <name>`, `--skills claude,codex|none`, `--mcp claude,cursor|none` for scripting.

## 0.4.3 — 2026-07-04

### Added

- First release cut through the GitHub Actions release workflow: publishes to npm with provenance, builds `taskdir.exe` on Windows CI, and attaches it to the GitHub Release.

### Fixed

- Sync `pnpm-lock.yaml` with `package.json` after removing `better-sqlite3` earlier in this cycle. CI's `pnpm install --frozen-lockfile` was going to fail against the stale lockfile.

## 0.4.2 — 2026-07-04

### Fixed

- README banner image now uses an absolute GitHub raw URL so it renders on npmjs.com (relative paths aren't reliably resolved by the registry's README viewer).

## 0.4.1 — 2026-07-04

### Changed

- Running `taskdir` with no subcommand now enters MCP stdio mode when stdin is not a TTY (Claude Code and other MCP clients spawning the binary). Interactive shells continue to see the help output. This lets `claude mcp add taskdir -- npx -y @anish98821/taskdir` register the server without needing an explicit `mcp` argument.

## 0.4.0 — 2026-07-04

Initial release.

### Features

- **Filesystem-backed task store.** Tasks live as folders under a configurable tasks directory: `<zero-padded-id>-<slug>/` with `status`, `meta.toml`, `context.md`, `clarification.md`, `report.md`. `git diff`, `cp -r`, `grep -r` all work.
- **MCP surface.** Stdio server (`taskdir mcp`) and HTTP route (`src/app/mcp/route.ts`) exposing `list_tasks`, `get_task`, `create_task`, `update_status`, `update_meta`, `append_to_file`, `create_file`, `rename_file`, `delete_file`, and `register_agent`.
- **Web UI.** Next.js 16 App Router + Tailwind v4. Task list with search/sort/status filter, right-side detail pane, optimistic metadata editing, markdown edit/preview with mtime-based conflict detection, notifications drawer (blocked / awaiting approval / unread reports), and a settings page with an `agents` tab and a `project` tab.
- **Live updates.** Chokidar watcher invalidates the in-memory task index and streams change events to the browser via server-sent events.
- **Agent routing.** Tasks carry an optional `agent` field in `meta.toml` scoping them to a specific registered agent id; unset means any agent may pick them up. Agents self-register through the `register_agent` MCP tool.
- **CLI.** Single `taskdir` executable exposing four subcommands:
  - `taskdir init` initialises `.taskdir/config.toml`, the tasks directory, and updates `.gitignore` when appropriate.
  - `taskdir mcp` runs the stdio MCP server for the current project.
  - `taskdir web` launches the web UI: probes the port and auto-increments if busy, shows a spinner while starting, suppresses the underlying Next.js output, and opens the default browser once ready.
  - `taskdir web --stop` stops the instance registered for the current directory; `--stop-all` stops every running instance across all projects. Instance records live under `%LOCALAPPDATA%\taskdir\instances\` (Windows) or `$XDG_STATE_HOME/taskdir/instances/` (POSIX) and stale records are cleaned automatically.
  - `taskdir install` (Windows) copies the executable into `%LOCALAPPDATA%\Programs\taskdir\` and adds it to the user PATH.
- **Single-executable distribution.** Node SEA build (`npm run build:exe`) produces a self-contained `taskdir.exe` with the web bundle, Next runtime, and MCP server embedded.
