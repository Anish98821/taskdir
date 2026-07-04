"use client";

import { useOptimistic, useState, useTransition } from "react";
import { saveProjectConfig } from "@/app/actions";
import type { ProjectConfig } from "@/lib/project-config";

interface Props {
  project: ProjectConfig;
}

export function ProjectConfigEditor({ project }: Props) {
  const [pending, startTransition] = useTransition();
  const [optimistic, applyOptimistic] = useOptimistic(
    project,
    (_current, next: ProjectConfig) => next,
  );
  const [tasksDirDraft, setTasksDirDraft] = useState(project.tasks_dir);
  const [nameDraft, setNameDraft] = useState(project.name);

  const saveTasksDir = () => {
    const trimmed = tasksDirDraft.trim();
    if (!trimmed || trimmed === optimistic.tasks_dir) return;
    const next: ProjectConfig = { ...optimistic, tasks_dir: trimmed };
    startTransition(async () => {
      applyOptimistic(next);
      await saveProjectConfig({ tasks_dir: trimmed });
    });
  };

  const saveName = () => {
    const trimmed = nameDraft.trim();
    if (trimmed === optimistic.name) return;
    const next: ProjectConfig = { ...optimistic, name: trimmed };
    startTransition(async () => {
      applyOptimistic(next);
      await saveProjectConfig({ name: trimmed });
    });
  };

  const tasksDirDirty = tasksDirDraft.trim() !== optimistic.tasks_dir;
  const nameDirty = nameDraft.trim() !== optimistic.name;

  return (
    <div className="flex flex-col gap-6 px-6 py-6">
      <p className="text-xs text-muted-foreground">
        edit <code>.taskdir/config.toml</code>. these settings apply to the entire
        project for this checkout.
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs uppercase tracking-wide text-muted-foreground">
          project name
        </h2>
        <p className="text-xs text-muted-foreground/70">
          shown in the sidebar header. defaults to the folder name if empty.
        </p>
        <div className="flex items-center gap-2">
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.currentTarget.value)}
            disabled={pending}
            placeholder="my project"
            className="flex-1 max-w-md border border-border bg-background px-2 py-0.5 text-sm text-foreground focus:border-foreground focus:outline-none disabled:opacity-60"
          />
          <button
            type="button"
            onClick={saveName}
            disabled={pending || !nameDirty}
            className="border border-border px-2 py-0.5 text-xs hover:border-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            save
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs uppercase tracking-wide text-muted-foreground">
          tasks directory
        </h2>
        <p className="text-xs text-muted-foreground/70">
          relative to the project root, or absolute. defaults to{" "}
          <code>tasks</code>. changes take effect on next server restart.
        </p>
        <div className="flex items-center gap-2">
          <input
            value={tasksDirDraft}
            onChange={(e) => setTasksDirDraft(e.currentTarget.value)}
            disabled={pending}
            placeholder="tasks"
            className="flex-1 max-w-md border border-border bg-background px-2 py-0.5 text-sm text-foreground focus:border-foreground focus:outline-none disabled:opacity-60"
          />
          <button
            type="button"
            onClick={saveTasksDir}
            disabled={pending || !tasksDirDirty}
            className="border border-border px-2 py-0.5 text-xs hover:border-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            save
          </button>
        </div>
      </section>
    </div>
  );
}
