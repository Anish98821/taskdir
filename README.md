<p align="center">
  <img src="https://raw.githubusercontent.com/Anish98821/taskdir/main/banner.png" alt="taskdir" width="600" />
</p>

# Taskdir

Filesystem-backed task tracker for AI agents. Agents drive it from the shell with the `taskdir` CLI (the same surface is also exposed over MCP); a small web UI keeps the human in the loop.

Tasks live as plain folders on disk — `git diff`, `cp -r`, `grep -r` all work:

```
tasks/
  0042-add-auth/
    status              # pending | in_progress | blocked | done
    meta.toml           # title, created_at, priority, mode, tags, agent
    context.md          # optional
    clarification.md    # present when status=blocked
```

**Full docs — CLI/MCP tool reference, hooks, modes, statuses:** [anish98821.github.io/taskdir/reference.html](https://anish98821.github.io/taskdir/reference.html)

## Quick start

```bash
npm install -g @anish98821/taskdir
taskdir init
taskdir web
```

`taskdir init` creates `.taskdir/config.toml`, a tasks directory, and installs skill files so agents drive taskdir through the CLI (or MCP — pick it interactively, or pass `--interface mcp`). `taskdir web` launches the web UI and opens it in your browser.

Agents talk to taskdir with plain shell commands, no client wiring:

```bash
taskdir tools                              # list the commands
taskdir create_task --title "Fix login" --mode bugfix --tags auth,frontend
taskdir list_tasks --status in_progress
taskdir update_status 0001 done
```

See the [reference](https://anish98821.github.io/taskdir/reference.html) for the full CLI/MCP surface, the web UI, modes & strategies, statuses, and hooks.

## Contributing

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000>. Tasks live in `./tasks/` (or the `tasks_dir` from `.taskdir/config.toml`).

Before opening a PR:

```bash
npm test
npm run lint
npm run build
```

See `ARCHITECTURE.md` for how the pieces fit together and `USER_MANUAL.md` for a deeper local-dev walkthrough.

## License

MIT
