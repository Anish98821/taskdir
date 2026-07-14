"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  MessageCircleQuestion,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { TaskSummary } from "@/lib/task-types";
import { cn } from "@/lib/utils";

type NotifKind = "approval" | "blocked";

interface NotifItem {
  task: TaskSummary;
  kind: NotifKind;
}

const KIND_LABEL: Record<NotifKind, string> = {
  approval: "awaiting approval",
  blocked: "needs an answer",
};

const KIND_TONE: Record<NotifKind, string> = {
  approval: "text-violet-400 border-violet-400/30 bg-violet-400/10",
  blocked: "text-amber-400 border-amber-400/30 bg-amber-400/10",
};

const KIND_ICON: Record<NotifKind, LucideIcon> = {
  approval: MessageCircleQuestion,
  blocked: AlertTriangle,
};

const KIND_RANK: Record<NotifKind, number> = {
  blocked: 0,
  approval: 1,
};

function buildItems(tasks: TaskSummary[]): NotifItem[] {
  const out: NotifItem[] = [];
  for (const t of tasks) {
    if (t.status === "blocked") out.push({ task: t, kind: "blocked" });
    if (t.status === "awaiting_approval") out.push({ task: t, kind: "approval" });
  }
  return out.sort((a, b) => {
    const k = KIND_RANK[a.kind] - KIND_RANK[b.kind];
    if (k) return k;
    return b.task.id.localeCompare(a.task.id);
  });
}

interface Props {
  tasks: TaskSummary[];
}

export function NotificationsDrawer({ tasks }: Props) {
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const items = useMemo(() => buildItems(tasks), [tasks]);
  const count = items.length;

  const hrefFor = (id: string) => {
    const sp = new URLSearchParams(params.toString());
    sp.set("task", id);
    sp.delete("file");
    return `/?${sp.toString()}`;
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="notifications"
        className="relative inline-flex size-7 items-center justify-center text-muted-foreground hover:text-foreground"
      >
        <Bell className="size-4" aria-hidden />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[14px] items-center justify-center rounded-full border border-background bg-foreground px-1 text-[9px] font-semibold leading-[14px] text-background">
            {count}
          </span>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="flex flex-col gap-0 p-0 font-mono">
        <SheetHeader className="gap-2 border-b border-border">
          <SheetTitle className="text-sm">
            notifications{" "}
            <span className="ml-1 text-muted-foreground">({count})</span>
          </SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="p-6 text-xs text-muted-foreground">
              nothing waiting.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => {
                const Icon = KIND_ICON[item.kind];
                return (
                  <li key={`${item.task.id}-${item.kind}`}>
                    <div className="flex items-start gap-2 px-4 py-3 text-xs hover:bg-muted/40">
                      <Link
                        href={hrefFor(item.task.id)}
                        onClick={() => setOpen(false)}
                        className="flex min-w-0 flex-1 flex-col gap-1.5 focus:outline-none"
                      >
                        <span
                          className={cn(
                            "inline-flex w-fit items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] leading-none",
                            KIND_TONE[item.kind],
                          )}
                        >
                          <Icon className="size-3" aria-hidden />
                          {KIND_LABEL[item.kind]}
                        </span>
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="text-muted-foreground">
                            {item.task.id}
                          </span>
                          <span className="truncate text-foreground">
                            {item.task.meta.title}
                          </span>
                        </div>
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
