"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  FileCheck2,
  MessageCircleQuestion,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { markAllReportsRead, markReportRead } from "@/app/actions";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { InProgressDots } from "@/features/tasks/components/InProgressDots";
import type { TaskSummary } from "@/lib/task-types";
import { cn } from "@/lib/utils";

type NotifKind = "report" | "approval" | "blocked";

interface NotifItem {
  task: TaskSummary;
  kind: NotifKind;
}

const KIND_LABEL: Record<NotifKind, string> = {
  report: "unread report",
  approval: "awaiting approval",
  blocked: "needs an answer",
};

const KIND_TONE: Record<NotifKind, string> = {
  report: "text-emerald-500 border-emerald-500/30 bg-emerald-500/10",
  approval: "text-violet-400 border-violet-400/30 bg-violet-400/10",
  blocked: "text-amber-400 border-amber-400/30 bg-amber-400/10",
};

const KIND_ICON: Record<NotifKind, LucideIcon> = {
  report: FileCheck2,
  approval: MessageCircleQuestion,
  blocked: AlertTriangle,
};

const KIND_RANK: Record<NotifKind, number> = {
  blocked: 0,
  approval: 1,
  report: 2,
};

function buildItems(tasks: TaskSummary[]): NotifItem[] {
  const out: NotifItem[] = [];
  for (const t of tasks) {
    if (t.status === "blocked") out.push({ task: t, kind: "blocked" });
    if (t.status === "awaiting_approval") out.push({ task: t, kind: "approval" });
    if (t.hasReport) out.push({ task: t, kind: "report" });
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
  const [clearingId, setClearingId] = useState<string | null>(null);
  const [marking, startMarkAll] = useTransition();
  const [clearing, startClear] = useTransition();
  const items = useMemo(() => buildItems(tasks), [tasks]);
  const count = items.length;
  const reportTaskIds = useMemo(
    () =>
      items
        .filter((i) => i.kind === "report")
        .map((i) => i.task.id),
    [items],
  );

  const hrefFor = (id: string) => {
    const sp = new URLSearchParams(params.toString());
    sp.set("task", id);
    sp.delete("file");
    return `/?${sp.toString()}`;
  };

  const markAll = () => {
    if (marking || reportTaskIds.length === 0) return;
    startMarkAll(async () => {
      await markAllReportsRead(reportTaskIds);
    });
  };

  const clearReport = (id: string) => {
    if (clearing) return;
    setClearingId(id);
    startClear(async () => {
      await markReportRead(id);
      setClearingId(null);
    });
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
          {reportTaskIds.length > 0 && (
            <button
              type="button"
              onClick={markAll}
              disabled={marking}
              className="inline-flex w-fit items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-muted-foreground/50 hover:text-foreground disabled:opacity-60"
            >
              {marking ? (
                <>
                  marking<InProgressDots />
                </>
              ) : (
                <>
                  <CheckCheck className="size-3" aria-hidden />
                  mark all reports read ({reportTaskIds.length})
                </>
              )}
            </button>
          )}
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
                const isClearing =
                  item.kind === "report" &&
                  clearing &&
                  clearingId === item.task.id;
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
                      {item.kind === "report" && (
                        <button
                          type="button"
                          onClick={() => clearReport(item.task.id)}
                          disabled={clearing}
                          aria-label={`clear unread report for task ${item.task.id}`}
                          title="clear"
                          className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md border border-border px-1.5 text-[10px] text-muted-foreground transition-colors hover:border-muted-foreground/50 hover:bg-muted/30 hover:text-foreground disabled:opacity-60"
                        >
                          {isClearing ? (
                            <InProgressDots />
                          ) : (
                            <>
                              <X className="size-3" aria-hidden />
                              clear
                            </>
                          )}
                        </button>
                      )}
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
