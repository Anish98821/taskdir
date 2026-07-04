import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SidebarProvider className="h-dvh">
      <div className="flex h-full w-64 flex-col border-r border-border bg-sidebar">
        <div className="flex h-12 items-center gap-2 border-b border-sidebar-border px-3">
          <Skeleton className="size-6 rounded-sm" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="space-y-2 p-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
      <SidebarInset className="min-h-0">
        <header className="flex h-12 items-center gap-3 border-b border-border px-3">
          <SidebarTrigger className="size-7" />
          <Skeleton className="h-4 w-16" />
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex items-center gap-3 border-b border-border px-4 py-2">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-16" />
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-6">
            {Array.from({ length: 3 }, (_, section) => (
              <section key={section} className="flex flex-col gap-2">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-2/3" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 flex-1 max-w-md" />
                  <Skeleton className="h-6 w-14" />
                </div>
              </section>
            ))}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
