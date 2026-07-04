import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { readAgentsConfig } from "@/lib/agents";
import { readProjectConfig } from "@/lib/project-config";
import { getTask, listTasks } from "@/lib/tasks";
import { STATUSES, type Status } from "@/lib/task-types";
import { AppSidebar } from "./AppSidebar";
import { Hotkeys } from "./Hotkeys";
import { NewTaskButton } from "./NewTaskButton";
import { NewTaskDraft } from "./NewTaskDraft";
import { NotificationsDrawer } from "./NotificationsDrawer";
import { SearchBar } from "./SearchBar";
import { SortDropdown } from "./SortDropdown";
import { StatusFilter } from "./StatusFilter";
import { TaskDetail } from "./TaskDetail";
import { TaskList } from "./TaskList";

export interface TasksPageSearchParams {
  q?: string;
  task?: string;
  file?: string;
  new?: string;
  status?: string;
  sort?: string;
}

export async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<TasksPageSearchParams>;
}) {
  const sp = await searchParams;
  const [all, agentsConfig, project] = await Promise.all([
    listTasks(),
    readAgentsConfig(),
    readProjectConfig(),
  ]);

  const statusFilter: Status | null = (STATUSES as string[]).includes(
    sp.status ?? "",
  )
    ? (sp.status as Status)
    : null;
  const filtered = statusFilter
    ? all.filter((t) => t.status === statusFilter)
    : all;

  const selected = sp.task ? await getTask(sp.task) : null;
  const drafting = sp.new === "1" && !selected;

  const baseParams = new URLSearchParams();
  if (sp.q) baseParams.set("q", sp.q);
  if (sp.status) baseParams.set("status", sp.status);
  if (sp.sort) baseParams.set("sort", sp.sort);

  const closeNewHref = (() => {
    const close = new URLSearchParams(baseParams.toString());
    const qs = close.toString();
    return qs ? `/?${qs}` : "/";
  })();

  return (
    <SidebarProvider className="h-dvh">
      <Hotkeys />
      <AppSidebar total={all.length} projectName={project.name} />
      <SidebarInset className="min-h-0">
        <header className="flex h-12 items-center gap-3 border-b border-border px-3">
          <SidebarTrigger className="size-7" />
          <div className="ml-auto">
            <NotificationsDrawer tasks={all} />
          </div>
        </header>
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <div className="flex h-12 items-center gap-3 border-b border-border px-3">
              <SearchBar />
              <div className="ml-auto flex items-center gap-3">
                <SortDropdown />
                <StatusFilter />
                <NewTaskButton />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <TaskList tasks={filtered} />
            </div>
          </div>
          {selected && (
            <div className="hidden w-[44%] min-w-[420px] max-w-[640px] flex-shrink-0 md:block">
              <TaskDetail
                task={selected}
                baseParams={baseParams}
                selectedFile={sp.file ?? ""}
                agentsConfig={agentsConfig}
              />
            </div>
          )}
          {drafting && (
            <div className="hidden w-[44%] min-w-[420px] max-w-[640px] flex-shrink-0 md:block">
              <NewTaskDraft
                closeHref={closeNewHref}
                agentsConfig={agentsConfig}
              />
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
