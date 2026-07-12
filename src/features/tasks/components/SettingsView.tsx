"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { AgentsSettings } from "@/features/tasks/components/settings/AgentsSettings";
import { HooksSettings } from "@/features/tasks/components/settings/HooksSettings";
import { ModesSettings } from "@/features/tasks/components/settings/ModesSettings";
import { ProjectSettings } from "@/features/tasks/components/settings/ProjectSettings";
import { StatusesSettings } from "@/features/tasks/components/settings/StatusesSettings";
import type { AgentsConfig } from "@/lib/agents";
import type { HooksConfig } from "@/lib/hooks-types";
import type { ModeDef } from "@/lib/modes-types";
import type { ProjectConfig } from "@/lib/project-config";
import type { StatusDef } from "@/lib/statuses-types";

interface Props {
  config: AgentsConfig;
  project: ProjectConfig;
  hooks: HooksConfig;
  modes: ModeDef[];
  strategies: Record<string, string>;
  statuses: StatusDef[];
}

export function SettingsView({
  config,
  project,
  hooks,
  modes,
  strategies,
  statuses,
}: Props) {
  return (
    <Tabs defaultValue="agents" className="flex h-full flex-col gap-0">
      <div className="border-b border-border px-4 py-2">
        <div className="mx-auto w-full max-w-3xl px-2">
          <TabsList variant="line">
            <TabsTrigger value="agents">agents</TabsTrigger>
            <TabsTrigger value="modes">modes</TabsTrigger>
            <TabsTrigger value="statuses">statuses</TabsTrigger>
            <TabsTrigger value="hooks">hooks</TabsTrigger>
            <TabsTrigger value="project">project</TabsTrigger>
          </TabsList>
        </div>
      </div>
      <TabsContent value="agents" className="min-h-0 overflow-y-auto">
        <AgentsSettings config={config} />
      </TabsContent>
      <TabsContent value="modes" className="min-h-0 overflow-y-auto">
        <ModesSettings modes={modes} strategies={strategies} />
      </TabsContent>
      <TabsContent value="statuses" className="min-h-0 overflow-y-auto">
        <StatusesSettings statuses={statuses} />
      </TabsContent>
      <TabsContent value="hooks" className="min-h-0 overflow-y-auto">
        <HooksSettings config={hooks} />
      </TabsContent>
      <TabsContent value="project" className="min-h-0 overflow-y-auto">
        <ProjectSettings project={project} />
      </TabsContent>
    </Tabs>
  );
}
