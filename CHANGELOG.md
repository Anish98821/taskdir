# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org/).

## 0.4.1 — 2026-07-04

### Changed

- Running `taskdir` with no subcommand now enters MCP stdio mode when stdin is not a TTY (Claude Code and other MCP clients spawning the binary). Interactive shells continue to see the help output. This lets `claude mcp add taskdir -- npx -y taskdir` register the server without needing an explicit `mcp` argument.

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
