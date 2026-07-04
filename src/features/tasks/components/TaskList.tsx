"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { createTaskAction } from "@/app/actions";
import { InProgressDots } from "@/features/tasks/components/InProgressDots";
import { PriorityBadge } from "@/features/tasks/components/PriorityBadge";
import { getTaskSort } from "@/features/tasks/components/SortDropdown";
import { cn } from "@/lib/utils";
import type { Status, TaskSummary } from "@/lib/task-types";

const STATUS_RANK: Record<Status, number> = {
  blocked: 0,
  awaiting_approval: 1,
  in_progress: 2,
  pending: 3,
  done: 4,
};
const PRIORITY_RANK = { high: 0, med: 1, low: 2 } as const;

const STATUS_LABEL: Record<Status, string> = {
  blocked: "blocked",
  awaiting_approval: "awaiting approval",
  in_progress: "in progress",
  pending: "pending",
  done: "done",
};
const STATUS_COLOR: Record<Status, string> = {
  blocked: "text-amber-400",
  awaiting_approval: "text-violet-400",
  in_progress: "text-sky-400",
  pending: "text-muted-foreground",
  done: "text-emerald-500",
};

interface Props {
  tasks: TaskSummary[];
}

interface PendingTask {
  id: string;
  title: string;
}

export function TaskList({ tasks }: Props) {
  const params = useSearchParams();
  const q = (params.get("q") ?? "").toLowerCase().trim();
  const selectedId = params.get("task");
  const sort = getTaskSort(params.get("sort"));
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);

  const addPendingTask = (title: string): string => {
    const id = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setPendingTasks((current) => [...current, { id, title }]);
    return id;
  };

  const removePendingTask = (id: string) => {
    setPendingTasks((current) => current.filter((task) => task.id !== id));
  };

  const visible = useMemo(() => {
    const filtered = q
      ? tasks.filter(
          (t) =>
            t.id.includes(q) ||
            t.meta.title.toLowerCase().includes(q) ||
            t.meta.tags.some((tag) => tag.toLowerCase().includes(q)),
        )
      : tasks;
    return [...filtered].sort((a, b) => {
      const latest =
        Date.parse(b.meta.created_at) - Date.parse(a.meta.created_at) ||
        b.id.localeCompare(a.id);
      if (sort === "latest") return latest;

      const p =
        PRIORITY_RANK[a.meta.priority] - PRIORITY_RANK[b.meta.priority];
      if (sort === "priority") return p || latest;

      const s = STATUS_RANK[a.status] - STATUS_RANK[b.status];
      return s || p || latest;
    });
  }, [tasks, q, sort]);

  const buildHref = (id: string) => {
    const sp = new URLSearchParams(params.toString());
    sp.set("task", id);
    sp.delete("file");
    return `/?${sp.toString()}`;
  };

  const showInlineAdd = !q;

  if (visible.length === 0) {
    return (
      <div>
        {showInlineAdd && (
          <ul className="divide-y divide-border">
            <InlineNewTask
              onCreatePending={addPendingTask}
              onSettlePending={removePendingTask}
            />
            {pendingTasks.map((task) => (
              <PendingTaskRow key={task.id} title={task.title} />
            ))}
          </ul>
        )}
        <div className="p-6 text-muted-foreground">
          {q ? "no matches." : "no tasks yet."}
        </div>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {showInlineAdd && (
        <>
          <InlineNewTask
            onCreatePending={addPendingTask}
            onSettlePending={removePendingTask}
          />
          {pendingTasks.map((task) => (
            <PendingTaskRow key={task.id} title={task.title} />
          ))}
        </>
      )}
      {visible.map((t) => {
        const isActive = selectedId === t.id;
        return (
          <li key={t.id}>
            <Link
              data-task-row
              href={buildHref(t.id)}
              scroll={false}
              className={cn(
                "grid grid-cols-[4rem_8rem_auto_1fr_auto] items-center gap-4 px-4 py-2 hover:bg-muted/40 focus:bg-muted/60 focus:outline-none",
                isActive && "bg-muted/60",
              )}
            >
              <span className="text-muted-foreground">{t.id}</span>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5",
                  STATUS_COLOR[t.status],
                )}
              >
                {STATUS_LABEL[t.status]}
                {t.status === "in_progress" && <InProgressDots />}
              </span>
              <PriorityBadge priority={t.meta.priority} className="w-fit justify-self-start" />
              <span className="flex min-w-0 items-center gap-2 truncate text-foreground">
                {t.hasReport && (
                  <span
                    title="unread report"
                    aria-label="unread report"
                    className="inline-flex size-2 shrink-0 rounded-full bg-emerald-500"
                  >
                  </span>
                )}
                <span className="truncate">{t.meta.title}</span>
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {t.meta.tags.join(" ")}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function PendingTaskRow({ title }: { title: string }) {
  return (
    <li>
      <div className="grid grid-cols-[4rem_8rem_auto_1fr_auto] items-center gap-4 px-4 py-2 opacity-70">
        <span className="text-muted-foreground">new</span>
        <span className="inline-flex items-center gap-1.5 text-sky-400">
          creating
          <InProgressDots />
        </span>
        <PriorityBadge priority="med" className="w-fit justify-self-start" />
        <span className="min-w-0 truncate text-foreground">{title}</span>
        <span />
      </div>
    </li>
  );
}

function InlineNewTask({
  onCreatePending,
  onSettlePending,
}: {
  onCreatePending: (title: string) => string;
  onSettlePending: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [, startTransition] = useTransition();
  const taRef = useRef<HTMLTextAreaElement>(null);

  const autoSize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  const reset = () => {
    setTitle("");
    if (taRef.current) taRef.current.style.height = "auto";
  };

  const submit = () => {
    const t = title.trim();
    if (!t) return;
    const fd = new FormData();
    fd.set("title", t);
    const pendingId = onCreatePending(t);
    reset();
    startTransition(async () => {
      try {
        await createTaskAction(fd);
      } finally {
        onSettlePending(pendingId);
      }
    });
  };

  return (
    <li>
      <div className="flex items-start gap-2 px-4 py-2">
        <Plus
          className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <textarea
          ref={taRef}
          value={title}
          rows={1}
          onChange={(e) => {
            setTitle(e.target.value);
            autoSize(e.currentTarget);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              reset();
            }
          }}
          placeholder="new task..."
          aria-label="quick add task"
          className="flex-1 resize-none overflow-hidden border-0 bg-transparent leading-snug text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
        />
      </div>
    </li>
  );
}
