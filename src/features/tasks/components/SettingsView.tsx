"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { AgentsEditor } from "@/features/tasks/components/AgentsEditor";
import { ProjectConfigEditor } from "@/features/tasks/components/ProjectConfigEditor";
import type { AgentsConfig } from "@/lib/agents";
import type { ProjectConfig } from "@/lib/project-config";

interface Props {
  config: AgentsConfig;
  project: ProjectConfig;
}

export function SettingsView({ config, project }: Props) {
  return (
    <Tabs defaultValue="agents" className="flex h-full flex-col gap-0">
      <div className="border-b border-border px-4 py-2">
        <TabsList variant="line">
          <TabsTrigger value="agents">agents</TabsTrigger>
          <TabsTrigger value="project">project</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="agents" className="min-h-0 overflow-y-auto">
        <AgentsEditor config={config} />
      </TabsContent>
      <TabsContent value="project" className="min-h-0 overflow-y-auto">
        <ProjectConfigEditor project={project} />
      </TabsContent>
    </Tabs>
  );
}
