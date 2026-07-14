import Link from "next/link";
import { X } from "lucide-react";
import { answerClarification } from "@/app/actions";
import { Textarea } from "@/components/ui/textarea";
import { ApprovePlanBanner } from "@/features/tasks/components/ApprovePlanBanner";
import { ClarificationSubmitButton } from "@/features/tasks/components/ClarificationSubmitButton";
import { DeleteTaskButton } from "@/features/tasks/components/DeleteTaskButton";
import { FileEditor } from "@/features/tasks/components/FileEditor";
import { FileTabs } from "@/features/tasks/components/FileTabs";
import { MetaEditor } from "@/features/tasks/components/MetaEditor";
import { StatusDropdown } from "@/features/tasks/components/StatusDropdown";
import type { AgentsConfig } from "@/lib/agents";
import type { ModeDef } from "@/lib/modes-types";
import type { StatusDef } from "@/lib/statuses-types";
import { type Task } from "@/lib/tasks";

interface Props {
  task: Task;
  baseParams: URLSearchParams;
  selectedFile: string;
  agentsConfig: AgentsConfig;
  modes: ModeDef[];
  statuses: StatusDef[];
}

export function TaskDetail({
  task,
  baseParams,
  selectedFile,
  agentsConfig,
  modes,
  statuses,
}: Props) {
  const answerBound = answerClarification.bind(null, task.id);

  const closeHref = (() => {
    const sp = new URLSearchParams(baseParams.toString());
    sp.delete("task");
    sp.delete("file");
    const qs = sp.toString();
    return qs ? `/?${qs}` : "/";
  })();

  const activeFile =
    task.files.find((f) => f.name === selectedFile) ?? task.files[0];

  return (
    <aside className="flex h-full w-full flex-col border-l border-border bg-background">
      <header className="border-b border-border px-4 py-3">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="flex flex-1 flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{task.id}</span>
            <StatusDropdown
              taskId={task.id}
              status={task.status}
              statuses={statuses}
            />
          </div>
          <div className="flex items-center gap-2">
            <DeleteTaskButton taskId={task.id} taskTitle={task.meta.title} />
            <Link
              href={closeHref}
              className="text-muted-foreground hover:text-foreground"
              aria-label="close"
            >
              <X className="size-4" />
            </Link>
          </div>
        </div>
        <MetaEditor
          taskId={task.id}
          meta={task.meta}
          agentsConfig={agentsConfig}
          modes={modes}
        />
      </header>

      {task.status === "awaiting_approval" && (
        <ApprovePlanBanner taskId={task.id} />
      )}

      {task.status === "blocked" && (
        <section className="border-b border-border bg-amber-400/5 px-4 py-3">
          <p className="mb-2 text-xs text-amber-400">answer the question</p>
          <form action={answerBound} className="flex flex-col gap-2">
            <Textarea
              name="answer"
              required
              rows={3}
              className="resize-y font-mono"
              placeholder="your answer…"
            />
            <ClarificationSubmitButton />
          </form>
        </section>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <FileTabs
          taskId={task.id}
          files={task.files}
          activeName={activeFile?.name ?? ""}
        />
        <div className="min-h-0 flex-1 overflow-hidden">
          {activeFile ? (
            <FileEditor
              key={`${task.id}/${activeFile.name}`}
              taskId={task.id}
              filename={activeFile.name}
              initialContent={activeFile.content}
              initialMtimeMs={activeFile.mtimeMs}
            />
          ) : (
            <div className="p-4 text-muted-foreground">no files in this task.</div>
          )}
        </div>
      </div>
    </aside>
  );
}
