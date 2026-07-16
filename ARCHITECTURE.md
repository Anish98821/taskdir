# Architecture

Taskdir is a local, filesystem-backed task substrate for AI agents. The filesystem is the source of truth; the web UI, MCP server, CLI tools, and hooks are all views or adapters over the same task folders.

## Product Loop

The core workflow is as described:

1. A task is created with a title, metadata, and optional `context.md`.
2. An agent picks it up and moves `status` to `in_progress`.
3. If the agent needs input, it writes to `clarification.md` and moves `status` to `blocked`.
4. The human answers in the UI, which appends the answer and moves the task back to `in_progress`.
5. The agent finishes, optionally writes `report.md`, and moves `status` to `done`.


## Filesystem Model

Tasks live under the active tasks directory. Resolution order is:

1. `TASKDIR_TASKS_DIR`
2. `.taskdir/config.toml` with `tasks_dir = "..."`
3. `./.taskdir/tasks` when `.taskdir/` exists
4. `./tasks`

Each task is a folder named `<zero-padded-id>-<slug>`:

```text
tasks/
  0127-example-task/
    status
    meta.toml
    context.md
    clarification.md
```

`status` contains one value:

```text
pending | in_progress | blocked | done
```

`meta.toml` currently stores:

```toml
title = "Example"
created_at = "2026-06-12T00:00:00.000Z"
priority = "med"
mode = "plan"
tags = []
agent = "codex"
```

`agent` is optional: it scopes a task to a specific registered agent id; when absent, any agent may pick it up. Unknown keys left over from older tasks (e.g. `generate_report`, `report_seen_at`) are simply ignored on read.

Canonical markdown files are ordered as `context.md`, `clarification.md`, then custom markdown files alphabetically. Agents can still create any other `*.md` files (including a `report.md`) in a task folder.

## Server-Side Task API

`src/lib/tasks-core.ts` is the server-side task service. It owns:

- task creation
- list/read operations
- status changes
- metadata changes
- markdown file lifecycle
- stale-write conflict checks
- in-memory task index invalidation

Callers should import it through `@/lib/tasks` unless they are inside the task service itself.

Supporting modules live under `src/lib/tasks/`:

- `identity.ts`: folder id/slug parsing and slug creation
- `paths.ts`: tasks directory resolution
- `meta-toml.ts`: metadata parse/stringify
- `validation.ts`: status, priority, mode, and filename validation

The task index is an in-memory cache. It is invalidated after known mutations and by the filesystem watcher.

## Web App

The app uses Next.js App Router. `src/app/page.tsx` is intentionally thin and delegates to the task feature:

- `src/features/tasks/components/TasksPage.tsx`: page composition, loading task data, filters, selected task, draft task panel
- `TaskList.tsx`: searchable/sortable task list, quick add
- `TaskDetail.tsx`: right-side detail pane
- `MetaEditor.tsx`: optimistic metadata editing
- `FileTabs.tsx`: file tab controls and file operations
- `FileEditor.tsx`: markdown edit/preview and conflict-aware save
- `NewTaskDraft.tsx`: full task creation panel

Server actions in `src/app/actions.ts` bridge client components to server-side mutations. They call the task service and then `refresh()` or `redirect()` as needed.

The UI is dense, monospace, and local-first. It uses shadcn-style primitives in `src/components/ui/` and task-specific components in `src/features/tasks/components/`.

## Live Updates

`src/lib/watcher.ts` creates a singleton chokidar watcher over `tasksDir()`. It invalidates the task index and notifies subscribers on file and directory changes.

`src/app/api/events/route.ts` exposes those updates as server-sent events:

- sends `hello` when connected
- sends `change` when task files change
- sends keepalive comments every 25 seconds

This lets the UI update when an agent edits task files outside the browser.

## MCP Surface

There are three entrypoints over the same tool surface:

- `bin/taskdir.ts mcp`: stdio MCP server for agents
- `src/app/mcp/route.ts`: HTTP route using the same handler
- `bin/taskdir.ts <tool>`: the same tools as plain CLI commands (see below)

The first two delegate to `src/lib/mcp-handler.ts`, which delegates tool schemas and dispatch to `src/lib/mcp/tools.ts`.

Current tools:

- `list_tasks(status?, tag?, priority?)`
- `get_task(id)`
- `create_task(title, context?, priority?, mode?, tags?, agent?)`
- `update_status(id, status)`
- `update_meta(id, title?, priority?, mode?, tags?, agent?)`
- `append_to_file(id, filename, content)`
- `create_file(id, filename)`
- `rename_file(id, old_name, new_name)`
- `delete_file(id, filename)`
- `register_agent(name, provider, id?)`

Tool output is plain text JSON or short acknowledgements so it stays easy for agents to consume.

### CLI mirror

`runTaskCli` in `bin/cli.ts` exposes every tool as a shell command: `taskdir <tool> [options]` (run `taskdir tools` for the list). It is a thin adapter — it derives its command surface, option names, types, and required fields directly from the same `TOOLS` schema, then calls `callTool(name, args)`. So the CLI and MCP never drift: adding an MCP tool adds a CLI command for free. Options are `--key value`/`--key=value`; array options take a comma list or repeat; required fields may be passed positionally in declared order (e.g. `taskdir update_status 0001 done`). The MCP server itself is unchanged by this.

## Initialization

`taskdir init` initializes Taskdir inside any project:

- creates `.taskdir/config.toml`
- creates the configured task directory
- creates `.taskdir/README.md` if missing
- optionally appends the tasks directory to `.gitignore`
- asks whether agents should talk to taskdir via the **CLI** (the default) or over **MCP** (`--interface`), then tailors the installed skill accordingly and, for MCP, registers the server in the selected client configs

The default task directory is `.taskdir/tasks`, but `--tasks-dir` can point elsewhere.

## Import Boundaries

- `src/app/`: Next.js entrypoints, route handlers, and server actions only
- `src/features/tasks/`: task-specific UI, feature mappers, and browser-facing task services
- `src/components/ui/`: reusable UI primitives with no task-domain behavior
- `src/lib/`: server-capable shared logic and task persistence
- `src/lib/mcp/`: MCP tool schemas and dispatch
- `bin/`: CLI entrypoints that call the same library APIs as the web app

React components should not perform filesystem persistence directly. They should call server actions or feature services.

## Verification

Standard checks:

```bash
npm test
npm run lint
npm run build
```

For MCP changes, also smoke test stdio:

```bash
'{"jsonrpc":"2.0","id":1,"method":"initialize"}' | node --experimental-strip-types --no-warnings bin/taskdir.ts mcp
'{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | node --experimental-strip-types --no-warnings bin/taskdir.ts mcp
```

For initialization changes:

```bash
node --experimental-strip-types --no-warnings bin/taskdir.ts init --help
node --experimental-strip-types --no-warnings bin/taskdir.ts init --yes
```

## Refactor Rules

- Preserve the filesystem as the source of truth.
- Keep task persistence out of React components.
- Keep route handlers and server actions thin.
- Add shared UI only when it is genuinely cross-feature.
