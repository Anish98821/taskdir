import { AppSidebar } from "@/features/tasks/components/AppSidebar";
import { SettingsView } from "@/features/tasks/components/SettingsView";
import { readAgentsConfig } from "@/lib/agents";
import { readProjectConfig } from "@/lib/project-config";
import { listTasks } from "@/lib/tasks";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [tasks, config, project] = await Promise.all([
    listTasks(),
    readAgentsConfig(),
    readProjectConfig(),
  ]);
  return (
    <SidebarProvider className="h-dvh">
      <AppSidebar total={tasks.length} projectName={project.name} />
      <SidebarInset className="min-h-0">
        <header className="flex h-12 items-center gap-3 border-b border-border px-3">
          <SidebarTrigger className="size-7" />
          <span className="text-xs text-muted-foreground">settings</span>
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">
          <SettingsView config={config} project={project} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
