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
    report.md
```

`status` contains one value:

```text
pending | in_progress | awaiting_approval | blocked | done
```

`meta.toml` currently stores:

```toml
title = "Example"
created_at = "2026-06-12T00:00:00.000Z"
priority = "med"
mode = "plan_and_execute"
tags = []
generate_report = true
agent = "codex"
report_seen_at = "2026-06-12T00:00:00.000Z"
```

`agent` and `report_seen_at` are optional. `agent` scopes a task to a specific registered agent id; when absent, any agent may pick it up. `report_seen_at` only appears after reports are marked read. `generate_report` defaults to true when absent, so older tasks remain valid.

Canonical markdown files are ordered as `context.md`, `clarification.md`, `report.md`, then custom markdown files alphabetically. Agents can still create other `*.md` files in a task folder.

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
- `NotificationsDrawer.tsx`: blocked, approval, and unread-report notifications
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

There are two MCP entrypoints:

- `bin/taskdir-mcp.ts`: stdio MCP server for agents
- `src/app/mcp/route.ts`: HTTP route using the same handler

Both delegate to `src/lib/mcp-handler.ts`, which delegates tool schemas and dispatch to `src/lib/mcp/tools.ts`.

Current tools:

- `list_tasks(status?, tag?, priority?)`
- `get_task(id)`
- `create_task(title, context?, priority?, mode?, tags?, generate_report?, agent?)`
- `update_status(id, status)`
- `update_meta(id, title?, priority?, mode?, tags?, generate_report?, agent?)`
- `append_to_file(id, filename, content)`
- `create_file(id, filename)`
- `rename_file(id, old_name, new_name)`
- `delete_file(id, filename)`
- `register_agent(name, provider, id?)`

Tool output is plain text JSON or short acknowledgements so it stays easy for agents to consume.

## Initialization

`bin/taskdir-init.ts` initializes Taskdir inside any project:

- creates `.taskdir/config.toml`
- creates the configured task directory
- creates `.taskdir/README.md` if missing
- optionally appends the tasks directory to `.gitignore`

The default task directory is `.taskdir/tasks`, but `--tasks-dir` can point elsewhere.

## Notifications

Notifications are derived, not stored:

- `blocked`: task status is `blocked`
- `approval`: task status is `awaiting_approval`
- `report`: `report.md` exists with content and is newer than `meta.report_seen_at`

Clearing report notifications writes `report_seen_at`. Blocked and approval notifications clear only when the underlying status changes.

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
'{"jsonrpc":"2.0","id":1,"method":"initialize"}' | node --experimental-strip-types --no-warnings bin/taskdir-mcp.ts
'{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | node --experimental-strip-types --no-warnings bin/taskdir-mcp.ts
```

For initialization changes:

```bash
node --experimental-strip-types --no-warnings bin/taskdir-init.ts --help
node --experimental-strip-types --no-warnings bin/taskdir-init.ts --yes
```

## Refactor Rules

- Preserve the filesystem as the source of truth.
- Keep task persistence out of React components.
- Keep route handlers and server actions thin.
- Add shared UI only when it is genuinely cross-feature.
