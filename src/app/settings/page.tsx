import { cookies } from "next/headers";
import { AppSidebar } from "@/features/tasks/components/AppSidebar";
import { SettingsView } from "@/features/tasks/components/SettingsView";
import { readAgentsConfig } from "@/lib/agents";
import { readHooksConfig } from "@/lib/hooks";
import { readModesWithStrategies } from "@/lib/modes";
import { readProjectConfig } from "@/lib/project-config";
import { readStatusesConfig } from "@/lib/statuses";
import { listTasks } from "@/lib/tasks";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [tasks, config, project, hooks, modes, statusesConfig, cookieStore] =
    await Promise.all([
      listTasks(),
      readAgentsConfig(),
      readProjectConfig(),
      readHooksConfig(),
      readModesWithStrategies(),
      readStatusesConfig(),
      cookies(),
    ]);
  // Same cookie the tasks page honors, so the collapsed state survives
  // navigation between pages.
  const sidebarDefaultOpen =
    cookieStore.get("sidebar_state")?.value !== "false";
  return (
    <SidebarProvider className="h-dvh" defaultOpen={sidebarDefaultOpen}>
      <AppSidebar total={tasks.length} projectName={project.name} />
      <SidebarInset className="min-h-0">
        <header className="flex h-12 items-center gap-3 border-b border-border px-3">
          <SidebarTrigger className="size-7" />
          <span className="text-xs text-muted-foreground">settings</span>
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">
          <SettingsView
            config={config}
            project={project}
            hooks={hooks}
            modes={modes.modes}
            strategies={modes.strategies}
            statuses={statusesConfig.statuses}
          />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
