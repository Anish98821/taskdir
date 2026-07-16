<p align="center">
  <img src="https://raw.githubusercontent.com/Anish98821/taskdir/main/banner.png" alt="taskdir" width="600" />
</p>

# Taskdir

Filesystem-backed task tracker for AI agents. Agents drive it from the shell with the `taskdir` CLI (the same surface is also exposed over MCP); a small web UI keeps the human in the loop.

## Layout

```
tasks/
  0042-add-auth/
    status              # pending | in_progress | blocked | done
    meta.toml           # title, created_at, priority, mode, tags, agent
    context.md          # optional
    clarification.md    # present when status=blocked
```

Tasks live as folders on disk. `git diff`, `cp -r`, `grep -r` all work. Agents can use the CLI, MCP, or edit files directly.

## Task tools

Agents talk to taskdir by running shell commands — no client wiring required:

```bash
taskdir tools                              # list the commands
taskdir create_task --title "Fix login" --mode bugfix --tags auth,frontend
taskdir list_tasks --status in_progress
taskdir update_status 0001 done            # required fields can be positional
taskdir get_task 0001
```

The full surface:

- `list_tasks [--status <s>] [--tag <t>] [--priority <p>]`
- `get_task <id>` — returns all files concatenated
- `create_task --title "..." [--context ...] [--priority ...] [--mode ...] [--tags a,b] [--agent ...]`
- `update_status <id> <status>`
- `update_meta <id> [--title ...] [--priority ...] [--mode ...] [--tags a,b] [--agent ...]`
- `append_to_file <id> <filename> <content>`
- `create_file <id> <filename>`
- `rename_file <id> <old_name> <new_name>`
- `delete_file <id> <filename>`
- `list_modes` — project-defined task modes
- `list_agents`
- `register_agent --name "..." --provider <provider> [--id ...]`
- `unregister_agent <id>`

Run `taskdir <tool> --help` for any one.

### Also available over MCP

Every command above is also an MCP tool with the same name and fields, served
by the stdio server (`taskdir mcp`) for clients that prefer it (Claude Code,
Cursor, custom). Both surfaces are derived from the same schema, so they never
drift.

## Web UI

- List view with status/priority/tags.
- Detail view edits markdown files with basic conflict detection.
- Live updates via chokidar → SSE.
- Settings → agents / modes / statuses / hooks / project. Edit/preview,
  sidebar, pane width, and new-task defaults persist across refreshes.

## Modes & strategies

Every task has a **mode** describing its class of work. The three built-ins
(`plan`, `bugfix`, `research`) are just defaults — rename them, swap icons, or
add your own in the web UI (Settings → modes) or `.taskdir/modes.toml`:

```toml
[[mode]]
id = "triage"
label = "Triage"
icon = "bug"
```

Each mode can carry a **strategy** — markdown for how to approach that class of
task — stored at `.taskdir/strategies/<mode_id>.md`. When an agent calls
`get_task`, the strategy for the task's mode is appended to the output, so the
guidance travels with the work. Edit strategies in Settings → modes.

## Statuses

Statuses are yours too. `taskdir init` seeds `pending`, `in_progress`, and
`done`; relabel, recolor, remove, or add your own in the web UI (Settings →
statuses) or `.taskdir/statuses.toml`:

```toml
[[status]]
id = "in_review"
label = "in review"
color = "cyan"
```

Tasks whose on-disk status is no longer configured stay visible (rendered
neutral) — the files are the source of truth.

## Hooks

Run a shell command or POST a webhook when things happen. Configure in the web
UI (Settings → hooks) or edit `.taskdir/hooks.toml` directly:

```toml
[[hook]]
event = "task.status_changed"   # or "*" for every event
type = "command"
command = "notify-send \"$TASKDIR_EVENT\""

[[hook]]
event = "*"
type = "webhook"
url = "https://example.com/taskdir"
```

Events: `task.created`, `task.status_changed`, `task.updated`, `task.deleted`,
`agent.registered`, `agent.unregistered`.

- **command** hooks get the event JSON on stdin, plus `TASKDIR_EVENT` and
  `TASKDIR_*` env vars for each scalar payload field (e.g. `TASKDIR_ID`).
- **webhook** hooks receive a JSON body `{ event, timestamp, data }`.

A command hook can point at a command/file to run, or carry **inline code**
directly. In the web UI (Settings → hooks) toggle "inline code" for a proper
code editor; on disk it's a `script` block. The engine writes the script to a
temp file and runs it, honoring a shebang (`#!/usr/bin/env node`, `#!/bin/bash`,
…) cross-platform, or falling back to the platform shell:

```toml
[[hook]]
event = "task.created"
type = "command"
script = '''
#!/usr/bin/env node
console.log(`new task: ${process.env.TASKDIR_ID}`)
'''
```

Toggle a hook off without deleting it via the power button in Settings → hooks,
or add `enabled = false` to its table. Hooks fire unless explicitly disabled:

```toml
[[hook]]
event = "*"
type = "webhook"
url = "https://example.com/taskdir"
enabled = false                  # keeps the config, stops it firing
```

Firing is best-effort and non-blocking — a slow or failing hook never blocks the
operation that triggered it (10s timeout).

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind v4 + shadcn/ui
- chokidar + SSE
- MCP server hosted in-process alongside the Next.js app

## Install into a project

Install globally (agents invoke `taskdir` from the shell, so it needs to be on
PATH), then initialise `.taskdir/` in the project:

```bash
npm install -g @anish98821/taskdir
taskdir init
```

Creates `.taskdir/config.toml`, a tasks directory (default `.taskdir/tasks`), and `.taskdir/README.md`. Adds the tasks directory to `.gitignore` if a `.git` exists. Installs skill files that tell agents to drive taskdir through the CLI. Drop `AGENTS.md` into the repo so agents know the protocol.

Launch the web UI (auto-picks a free port, auto-opens the browser):

```bash
taskdir web
```

Prefer MCP? Pick it during `taskdir init` (or pass `--interface mcp`) to have
init register the server config for you, or register it manually with Claude
Code:

```bash
claude mcp add taskdir -- npx -y @anish98821/taskdir
```

## CLI

A single `taskdir` executable is installed by the npm package (and by the SEA build's `taskdir install`). Each subcommand operates on the current working directory.

```
taskdir init [options]         initialise .taskdir/ in the current directory
  --tasks-dir <path>           tasks folder (default: .taskdir/tasks)
  --interface <cli|mcp>        how agents talk to taskdir (default: cli; asked interactively)
  --cli                        shorthand for --interface cli
  -y, --yes                    skip prompts
  -h, --help

taskdir mcp                    run the stdio MCP server for the current project

taskdir tools                  list the task tools runnable from the shell
taskdir <tool> [options]       run any MCP tool directly (see `taskdir tools`)

taskdir web [options]          launch the web UI (auto-opens the browser)
  -p, --port <n>               default 3000, auto-increments if busy
      --host <addr>            default 127.0.0.1
      --stop                   stop the instance registered for the current dir
      --stop-all               stop every running instance
  -h, --help

taskdir install                copy the exe into %LOCALAPPDATA% and add to user PATH (Windows)
taskdir version
taskdir help
```

## Development

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000>. Tasks live in `./tasks/` (or the `tasks_dir` from `.taskdir/config.toml`).

Checks:

```bash
npm test
npm run lint
npm run build
```

MCP stdio smoke test:

```bash
'{"jsonrpc":"2.0","id":1,"method":"initialize"}' | node --experimental-strip-types --no-warnings bin/taskdir.ts mcp
'{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | node --experimental-strip-types --no-warnings bin/taskdir.ts mcp
```

See `ARCHITECTURE.md` and `USER_MANUAL.md` for details.

## License

MIT
