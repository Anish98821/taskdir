<p align="center">
  <img src="https://raw.githubusercontent.com/Anish98821/taskdir/main/banner.png" alt="taskdir" width="600" />
</p>

# Taskdir

Filesystem-backed task tracker for AI agents. MCP tools + a small web UI for the human in the loop.

## Layout

```
tasks/
  0042-add-auth/
    status              # pending | in_progress | awaiting_approval | blocked | done
    meta.toml           # title, created_at, priority, mode, tags, generate_report, agent
    context.md          # optional
    report.md
    clarification.md    # present when status=blocked
```

Tasks live as folders on disk. `git diff`, `cp -r`, `grep -r` all work. Agents can use MCP or edit files directly.

## MCP tools

- `list_tasks(status?, tag?, priority?)`
- `get_task(id)` — returns all files concatenated
- `create_task(title, context?, priority?, mode?, tags?, generate_report?, agent?)`
- `update_status(id, status)`
- `update_meta(id, title?, priority?, mode?, tags?, generate_report?, agent?)`
- `append_to_file(id, filename, content)`
- `create_file(id, filename)`
- `rename_file(id, old_name, new_name)`
- `delete_file(id, filename)`
- `list_modes()` — project-defined task modes
- `list_agents()`
- `register_agent(name, provider, id?)`
- `unregister_agent(id)`

## Web UI

- List view with status/priority/tags; blocked tasks sort first.
- Detail view edits markdown files with basic conflict detection.
- Live updates via chokidar → SSE.
- Settings → agents / modes / statuses / hooks / project. Edit/preview,
  sidebar, pane width, and new-task defaults persist across refreshes.

## Modes & strategies

Every task has a **mode** describing its class of work. The four built-ins
(`plan_only`, `plan_and_execute`, `fast_execute`, `report_only`) are just
defaults — rename them, swap icons, or add your own in the web UI (Settings →
modes) or `.taskdir/modes.toml`:

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

Two ids carry extra UI behavior when configured: `awaiting_approval` shows the
approve-plan banner and `blocked` shows the clarification banner. Tasks whose
on-disk status is no longer configured stay visible (rendered neutral) — the
files are the source of truth.

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

Firing is best-effort and non-blocking — a slow or failing hook never blocks the
operation that triggered it (10s timeout).

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind v4 + shadcn/ui
- chokidar + SSE
- MCP server hosted in-process alongside the Next.js app

## Install into a project

Initialise `.taskdir/` in the current directory:

```bash
npx -y @anish98821/taskdir init
```

Creates `.taskdir/config.toml`, a tasks directory (default `.taskdir/tasks`), and `.taskdir/README.md`. Adds the tasks directory to `.gitignore` if a `.git` exists. Drop `AGENTS.md` into the repo so agents know the protocol.

Register the MCP server with Claude Code so it shows up as a tool source on the next session:

```bash
claude mcp add taskdir -- npx -y @anish98821/taskdir
```

Launch the web UI (auto-picks a free port, auto-opens the browser):

```bash
npx -y @anish98821/taskdir web
```

Global install if you'd rather type `taskdir` directly:

```bash
npm install -g @anish98821/taskdir
taskdir init
taskdir web
```

## CLI

A single `taskdir` executable is installed by the npm package (and by the SEA build's `taskdir install`). Each subcommand operates on the current working directory.

```
taskdir init [options]         initialise .taskdir/ in the current directory
  --tasks-dir <path>           tasks folder (default: .taskdir/tasks)
  -y, --yes                    skip prompts
  -h, --help

taskdir mcp                    run the stdio MCP server for the current project

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
