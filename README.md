<p align="center">
  <img src="./banner.png" alt="taskdir" width="600" />
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
- `register_agent(name, provider, id?)`

## Web UI

- List view with status/priority/tags; blocked tasks sort first.
- Detail view edits markdown files with basic conflict detection.
- Live updates via chokidar → SSE.

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind v4 + shadcn/ui
- chokidar + SSE
- MCP server hosted in-process alongside the Next.js app

## Install into a project

```bash
npx taskdir init
```

Creates `.taskdir/config.toml`, a tasks directory (default `.taskdir/tasks`), and `.taskdir/README.md`. Adds the tasks directory to `.gitignore` if a `.git` exists. Drop `AGENTS.md` into the repo so agents know the protocol.

The same package ships the UI/server — run it from the project root.

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
