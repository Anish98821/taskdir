# Taskdir — Agent Skill

You're an AI coding agent working in a project that uses **taskdir** to track work. Taskdir is a local-first task tracker that stores tasks as folders of markdown on disk and exposes them over MCP. Follow this skill every time you connect.

## 1. Reuse or register an agent on first connect

Before doing any work, make sure you're represented in the project's agent registry. This makes the user aware of you and lets task routing target you. **Prefer reusing an existing agent over registering a new one.**

First, list who's already registered:

```jsonc
// MCP tool call
{ "name": "list_agents", "arguments": {} }
```

- If a **generic agent of your provider/model already exists** (e.g. a `Claude Code` entry when you're Claude Code), just adopt it — use its `id` for task routing and skip registration. Don't create a near-duplicate.
- Only `register_agent` when there's no suitable match, **or** the user explicitly wants a distinct identity for this session (a named persona, a second parallel worker, etc.).

```jsonc
// MCP tool call — only when no reusable agent exists
{
  "name": "register_agent",
  "arguments": {
    "name": "<your display name>",     // e.g. "Claude Code", "Codex"
    "provider": "<provider id>"        // anthropic | openai | google | meta | mistral | xai | cohere | deepseek | custom
  }
}
```

Rules:
- Use a **stable, generic display name** for your provider/model class (e.g. "Claude Code") so registration is idempotent and naturally reuses one record across sessions.
- The `id` is auto-generated from `name`. You can pass an explicit `id` to update an existing record (idempotent).
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
pending  in_progress  awaiting_approval  blocked  done
```

`update_status` rejects ids that aren't configured — stick to statuses the
project actually defines.

When you start a task, immediately set its status to `in_progress` via `update_status`. Don't read code or do anything else first.

**Modes are project-defined.** Call `list_modes` to see them (id, label). A task's mode is stored in `meta.toml`. If the mode has a **strategy**, `get_task` appends it under `## strategy for mode: <id>` — treat that as instructions for how to approach this class of task and follow it.

When you finish, set status to `done`. The "finish line" is:
- For `mode = plan_and_execute` or `fast_execute`: code changes shipped and verified.
- For `mode = plan_only`: a plan written to `plan.md`, then `awaiting_approval`.
- For `mode = report_only`: a `report.md` written.

If `meta.generate_report = true`, write `report.md` before flipping to `done`. The report belongs in the task folder, not in the response.

## 5. Awaiting approval

Use `awaiting_approval` when you've written a plan and want the user to OK it before executing. Set the status, mention "ready for approval" in your response, and **stop**. Do not execute until the user signals approval (they will flip status to `in_progress` or tell you to proceed in the next turn).

## 6. Blocking

Use `blocked` when you genuinely can't proceed without user input:
- An ambiguous requirement that has more than one reasonable interpretation.
- A secret/credential you don't have.
- A destructive choice you shouldn't make alone (deleting production data, force-pushing, schema-changing migrations).

Write your blocking question into `clarification.md` (create the file if missing — see `append_to_file`). When the user replies, they'll add the answer and flip status back to `in_progress`.

## 7. Use the tool whenever it would help

Don't go heads-down on your own todo list — the user has a task tracker for a reason. Concrete cases where you should write to taskdir:
- You discovered follow-up work that the current task doesn't cover → `create_task`.
- You filed a question for the user → set the parent `blocked` and write to `clarification.md`.
- You finished a sub-step → don't update status partially; finish the *task*, then update.
- Status changes are not "free" — only emit them at real boundaries.

## 8. Reports

When `meta.generate_report = true`, write a `report.md` in the task folder. A good report has:
- One-sentence summary of what changed (or didn't).
- Files touched.
- Verification: tests run, build passed, browser tested.
- Anything the user should follow up on (filed as new tasks if it's actionable).

Don't paste large code blocks. Don't recap the conversation. Don't write marketing copy.

## 9. File layout

```
tasks/
  <NNNN>-<slug>/
    meta.toml        # title, priority, mode, tags, generate_report, agent
    status           # a configured status id, single line
    context.md       # optional, written at creation time
    plan.md          # optional, your plan for plan-modes
    clarification.md # optional, questions for the user
    report.md        # required if generate_report = true
    <anything>.md    # extra notes/scratch
```

Folder name is `<padded-id>-<slug>` — you don't pick this, `create_task` does.

## 10. Don't fight the user

If the user manually edits a task, status, or meta — assume they meant it. Don't re-flip status. Don't "correct" their title. Re-read before reacting.

## MCP surface

These are the only taskdir MCP tools. Resist asking for more.

```
list_tasks(filter)            # status, tag, priority — optional
get_task(id)                  # concatenated markdown + meta
create_task({title, ...})     # spawn a child
update_status(id, status)
update_meta(id, patch)        # title/priority/mode/tags/generate_report/agent
append_to_file(id, filename, content)
create_file(id, filename)
rename_file(id, old, new)
delete_file(id, filename)
list_modes()
list_agents()
register_agent({name, provider, id?})
unregister_agent(id)
```

That's the whole protocol. If you find yourself reaching for filesystem access to do what one of these would do, use the MCP call instead — it keeps the watcher and the UI in sync.
