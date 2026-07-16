# Taskdir — Agent Skill

You're an AI coding agent working in a project that uses **taskdir** to track work. Taskdir is a local-first task tracker that stores tasks as folders of markdown on disk and exposes them as `taskdir` CLI commands you run from the shell (the same surface is also available over MCP). Follow this skill every time you work in this project.

## 1. Reuse or register an agent on first connect

Before doing any work, make sure you're represented in the project's agent registry. This makes the user aware of you and lets task routing target you. **Prefer reusing an existing agent over registering a new one.**

First, list who's already registered:

```bash
taskdir list_agents
```

- If a **generic agent of your provider/model already exists** (e.g. a `Claude Code` entry when you're Claude Code), just adopt it — use its `id` for task routing and skip registration. Don't create a near-duplicate.
- Only `register_agent` when there's no suitable match, **or** the user explicitly wants a distinct identity for this session (a named persona, a second parallel worker, etc.).

```bash
# only when no reusable agent exists
# provider: anthropic | openai | google | meta | mistral | xai | cohere | deepseek | custom
taskdir register_agent --name "Claude Code" --provider anthropic
```

Rules:
- Use a **stable, generic display name** for your provider/model class (e.g. "Claude Code") so registration is idempotent and naturally reuses one record across sessions.
- The `id` is auto-generated from `name`. You can pass an explicit `--id` to update an existing record (idempotent).
- If your provider isn't in the enum, use `custom`.
- Do **not** delete other agents the user has registered. Use `unregister_agent` only to remove your own, or when the user asks you to clean up.

## 2. Only pick up tasks meant for you

Every task has a `meta.toml` with an optional `agent` field. The matching rules:

| `meta.agent` value | Who picks it up |
|---|---|
| unset | any agent |
| your agent id | only you |
| another agent's id | not you — skip |

Use `list_tasks` (filtered by status) and walk the candidates. Skip any task whose `agent` doesn't match your registered id. Don't change another agent's tasks.

## 3. Break big tasks into smaller tasks

If a task is more than a few hours of work, **don't try to do it in one shot.** Create smaller child tasks via `create_task` and link them in the parent's report. Each child should have one clear deliverable.

When the parent task title contains multiple distinct asks (e.g. "rename X, add Y, also fix Z"), split it. Children should be small enough that each one's plan/execution fits in a single session.

Use the parent's status as a coordinator:
- Leave parent in `in_progress` while children run.
- Mark parent `done` only when all children are `done` and you've written the parent's report.

## 4. Status discipline

The status set is project-defined in `.taskdir/statuses.toml`. The common core:

```
pending  in_progress  blocked  done
```

`update_status` rejects ids that aren't configured — stick to statuses the
project actually defines.

When you start a task, immediately set its status to `in_progress` via `update_status`. Don't read code or do anything else first.

**Modes are project-defined.** Call `list_modes` to see them (id, label). A task's mode is stored in `meta.toml`. If the mode has a **strategy**, `get_task` appends it under `## strategy for mode: <id>` — treat that as instructions for how to approach this class of task and follow it.

When you finish, set status to `done`. The "finish line" depends on the task's mode and its strategy — e.g. a planning mode ends with a plan written to `plan.md`; an execution or bugfix mode ends with code changes shipped and verified. Follow the mode's strategy if it defines one.

## 5. Blocking

Use `blocked` when you genuinely can't proceed without user input:
- An ambiguous requirement that has more than one reasonable interpretation.
- A secret/credential you don't have.
- A destructive choice you shouldn't make alone (deleting production data, force-pushing, schema-changing migrations).

Write your blocking question into `clarification.md` via `taskdir append_to_file <id> clarification.md "<your question>"` (the file is created if missing). When the user replies, they'll add the answer and flip status back to `in_progress`.

## 6. Use the tool whenever it would help

Don't go heads-down on your own todo list — the user has a task tracker for a reason. Concrete cases where you should write to taskdir:
- You discovered follow-up work that the current task doesn't cover → `create_task`.
- You filed a question for the user → set the parent `blocked` and write to `clarification.md`.
- You finished a sub-step → don't update status partially; finish the *task*, then update.
- Status changes are not "free" — only emit them at real boundaries.

## 7. File layout

```
tasks/
  <NNNN>-<slug>/
    meta.toml        # title, priority, mode, tags, agent
    status           # a configured status id, single line
    context.md       # optional, written at creation time
    plan.md          # optional, your plan for plan-modes
    clarification.md # optional, questions for the user
    <anything>.md    # extra notes/scratch (e.g. a report.md if useful)
```

Folder name is `<padded-id>-<slug>` — you don't pick this, `create_task` does.

## 8. Don't fight the user

If the user manually edits a task, status, or meta — assume they meant it. Don't re-flip status. Don't "correct" their title. Re-read before reacting.

## CLI commands

Run any of these from the shell — see `taskdir tools` for the full list and `taskdir <tool> --help` for one tool's options. Required fields can be passed positionally, in order. These are the only taskdir tools; resist asking for more.

```bash
taskdir list_tasks [--status <s>] [--tag <t>] [--priority <p>]
taskdir get_task <id>                      # concatenated markdown + meta
taskdir create_task --title "..." [--context ...] [--mode ...] [--tags a,b] [--agent ...]
taskdir update_status <id> <status>
taskdir update_meta <id> [--title ...] [--priority ...] [--mode ...] [--tags a,b] [--agent ...]
taskdir append_to_file <id> <filename> <content>
taskdir create_file <id> <filename>
taskdir rename_file <id> <old_name> <new_name>
taskdir delete_file <id> <filename>
taskdir list_modes
taskdir list_agents
taskdir register_agent --name "..." --provider <provider>
taskdir unregister_agent <id>
```

The identical surface is exposed over MCP (`taskdir mcp`) for clients that prefer tool calls — same names, same fields.

That's the whole protocol. If you find yourself reaching for filesystem access to do what one of these would do, use the taskdir command instead — it keeps the watcher and the UI in sync.
