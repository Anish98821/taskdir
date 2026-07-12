"use client";

import { useOptimistic, useState, useTransition } from "react";
import { saveProjectConfig } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InProgressDots } from "@/features/tasks/components/InProgressDots";
import type { ProjectConfig } from "@/lib/project-config";
import { FormField, SettingsSection } from "./shared";

interface Props {
  project: ProjectConfig;
}

export function ProjectSettings({ project }: Props) {
  const [pending, startTransition] = useTransition();
  const [optimistic, applyOptimistic] = useOptimistic(
    project,
    (_current, next: ProjectConfig) => next,
  );
  const [nameDraft, setNameDraft] = useState(project.name);
  const [tasksDirDraft, setTasksDirDraft] = useState(project.tasks_dir);

  const saveName = () => {
    const trimmed = nameDraft.trim();
    if (trimmed === optimistic.name) return;
    startTransition(async () => {
      applyOptimistic({ ...optimistic, name: trimmed });
      await saveProjectConfig({ name: trimmed });
    });
  };

  const saveTasksDir = () => {
    const trimmed = tasksDirDraft.trim();
    if (!trimmed || trimmed === optimistic.tasks_dir) return;
    startTransition(async () => {
      applyOptimistic({ ...optimistic, tasks_dir: trimmed });
      await saveProjectConfig({ tasks_dir: trimmed });
    });
  };

  const nameDirty = nameDraft.trim() !== optimistic.name;
  const tasksDirDirty =
    tasksDirDraft.trim() !== optimistic.tasks_dir &&
    tasksDirDraft.trim().length > 0;

  return (
    <SettingsSection
      title="project"
      description={
        <>
          settings for this checkout, stored in{" "}
          <code>.taskdir/config.toml</code>.
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <form
          className="flex flex-col gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            saveName();
          }}
        >
          <FormField
            label="project name"
            hint="shown in the sidebar header. defaults to the folder name if empty."
          >
            <div className="flex max-w-md items-center gap-2">
              <Input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.currentTarget.value)}
                disabled={pending}
                placeholder="my project"
              />
              <SaveButton dirty={nameDirty} pending={pending} />
            </div>
          </FormField>
        </form>

        <form
          className="flex flex-col gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            saveTasksDir();
          }}
        >
          <FormField
            label="tasks directory"
            hint={
              <>
                relative to the project root, or absolute. defaults to{" "}
                <code>tasks</code>. changes take effect on next server restart.
              </>
            }
          >
            <div className="flex max-w-md items-center gap-2">
              <Input
                value={tasksDirDraft}
                onChange={(e) => setTasksDirDraft(e.currentTarget.value)}
                disabled={pending}
                placeholder="tasks"
                className="font-mono"
              />
              <SaveButton dirty={tasksDirDirty} pending={pending} />
            </div>
          </FormField>
        </form>
      </div>
    </SettingsSection>
  );
}

function SaveButton({ dirty, pending }: { dirty: boolean; pending: boolean }) {
  return (
    <Button
      type="submit"
      variant="outline"
      size="sm"
      disabled={pending || !dirty}
      className="shrink-0"
    >
      {pending ? (
        <span className="inline-flex items-center gap-1.5">
          saving
          <InProgressDots />
        </span>
      ) : (
        "save"
      )}
    </Button>
  );
}
