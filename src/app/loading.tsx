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
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
      <SidebarInset className="min-h-0">
        <header className="flex h-12 items-center gap-3 border-b border-border px-3">
          <SidebarTrigger className="size-7" />
        </header>
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <div className="flex h-12 items-center gap-3 border-b border-border px-3">
              <Skeleton className="h-8 w-full max-w-xl" />
              <div className="ml-auto flex items-center gap-3">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-16" />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              {Array.from({ length: 14 }, (_, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[4rem_8rem_auto_1fr_auto] items-center gap-4 border-b border-border px-4 py-2"
                >
                  <Skeleton className="h-4 w-10" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-12" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))}
            </div>
          </div>
          <div className="hidden w-[44%] min-w-[420px] max-w-[640px] flex-shrink-0 border-l border-border md:block">
            <div className="space-y-3 border-b border-border p-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="size-4" />
              </div>
              <Skeleton className="h-6 w-4/5" />
              <Skeleton className="h-4 w-2/5" />
            </div>
            <div className="flex border-b border-border">
              <Skeleton className="m-2 h-7 w-24" />
              <Skeleton className="m-2 h-7 w-32" />
              <Skeleton className="m-2 h-7 w-24" />
            </div>
            <div className="space-y-2 p-4">
              {Array.from({ length: 12 }, (_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
