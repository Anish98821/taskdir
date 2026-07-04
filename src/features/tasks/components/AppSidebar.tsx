"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Inbox, Settings } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

interface Props {
  total: number;
  projectName?: string;
}

export function AppSidebar({ total, projectName }: Props) {
  const params = useSearchParams();
  const pathname = usePathname();

  const tasksHref = (() => {
    const sp = new URLSearchParams(params.toString());
    sp.delete("task");
    sp.delete("file");
    const qs = sp.toString();
    return qs ? `/?${qs}` : "/";
  })();

  const onTasks = pathname === "/" || pathname === "";
  const onSettings = pathname?.startsWith("/settings") ?? false;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex h-8 items-center gap-2 px-2 py-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <img
            src="/logo.svg"
            alt="taskdir"
            width={175}
            height={142}
            className="h-5 w-auto shrink-0 invert"
          />
          <span
            className="truncate text-sm font-semibold group-data-[collapsible=icon]:hidden"
            title={projectName || "taskdir"}
          >
            {projectName || "taskdir"}
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href={tasksHref} />}
                  isActive={onTasks}
                  tooltip="tasks"
                >
                  <Inbox />
                  <span>tasks</span>
                  <span className="ml-auto text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                    {total}
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/settings" />}
                  isActive={onSettings}
                  tooltip="settings"
                >
                  <Settings />
                  <span>settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
