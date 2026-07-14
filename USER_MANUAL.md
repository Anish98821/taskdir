# User Manual

This manual explains how to run Taskdir locally and how to initialize it for another project.

## Requirements

- Node.js with support for `--experimental-strip-types`
- npm
- Git, if you want task changes tracked or ignored through `.gitignore`

Install dependencies in the Taskdir repo:

```bash
npm install
```

## Run Taskdir For This Repo

From the Taskdir repo:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

By default in this repo, tasks are read from `./tasks/` unless `TASKDIR_TASKS_DIR` or `.taskdir/config.toml` points elsewhere.

## Initialize Taskdir In A New Project

From the project you want to track:

```bash
node --experimental-strip-types --no-warnings C:\Projects\taskdir\bin\taskdir.ts init --yes
```

By default this creates:

```text
.taskdir/
  config.toml
  README.md
  tasks/
```

The generated `.taskdir/config.toml` contains:

```toml
tasks_dir = ".taskdir/tasks"
```

To choose a different task location:

```bash
node --experimental-strip-types --no-warnings C:\Projects\taskdir\bin\taskdir.ts init --tasks-dir tasks
```

If the target project is a Git repo and the tasks directory is inside the project, `taskdir init` adds that directory to `.gitignore`. This keeps local agent task state out of the project repo by default.

## Point Taskdir At Another Project

Run the Taskdir web app with `TASKDIR_TASKS_DIR` set:

```powershell
$env:TASKDIR_TASKS_DIR = "C:\Path\To\Project\.taskdir\tasks"
npm run dev
```

Or launch Taskdir from a directory that has `.taskdir/config.toml`; the task service resolves that config automatically.

## Configure An Agent Through MCP

Use the stdio MCP server:

```bash
node --experimental-strip-types --no-warnings C:\Projects\taskdir\bin\taskdir.ts mcp
```

Set `TASKDIR_TASKS_DIR` in the agent's MCP environment if the agent should operate on a specific project:

```text
TASKDIR_TASKS_DIR=C:\Path\To\Project\.taskdir\tasks
```

The MCP server exposes task listing, creation, status updates, metadata updates, and markdown file operations.

## Create A Task

In the web UI:

1. Click the new task control.
2. Enter a title.
3. Pick priority and workflow mode.
4. Add optional context in `context.md`.
5. Save.

Quick-add in the task list creates a task with defaults.

Through MCP, call `create_task` with:

```json
{
  "title": "Fix login redirect",
  "context": "Steps and expectations here",
  "priority": "med",
  "mode": "bugfix",
  "tags": ["frontend"]
}
```

## Task Statuses

- `pending`: ready for an agent to pick up
- `in_progress`: currently being worked
- `awaiting_approval`: plan or action needs approval
- `blocked`: agent needs human input
- `done`: finished

## Human-In-The-Loop Flow

When a task is blocked, open it in the UI, read the clarification prompt, answer in the provided box, and submit. Taskdir appends your answer to `clarification.md` and returns the task to `in_progress`.

## Task Files

Common files:

- `context.md`: initial task context
- `clarification.md`: questions and answers when blocked

You can create additional markdown files (notes, a `report.md`, …) from the file tab menu.

The file editor supports edit and preview modes. Saves use mtime conflict detection; if a file changed on disk, Taskdir asks whether to reload or overwrite.

## Sorting, Filtering, And Notifications

The task list supports:

- search by id, title, or tag
- status filter
- sort by latest, priority, or status

The notification drawer shows:

- blocked tasks
- tasks awaiting approval

## Maintenance

Before calling code work done:

```bash
npm test
npm run lint
```

For production-readiness checks:

```bash
npm run build
```

For MCP changes:

```bash
'{"jsonrpc":"2.0","id":1,"method":"initialize"}' | node --experimental-strip-types --no-warnings bin/taskdir.ts mcp
'{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | node --experimental-strip-types --no-warnings bin/taskdir.ts mcp
```
