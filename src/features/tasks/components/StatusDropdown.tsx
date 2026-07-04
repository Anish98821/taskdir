"use client";

import { useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { setStatus } from "@/app/actions";
import { PickerDropdown } from "@/components/ui/picker-dropdown";
import { InProgressDots } from "@/features/tasks/components/InProgressDots";
import { STATUSES, type Status } from "@/lib/task-types";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<Status, string> = {
  pending: "pending",
  in_progress: "in progress",
  awaiting_approval: "awaiting approval",
  blocked: "blocked",
  done: "done",
};

const STATUS_TONE: Record<Status, string> = {
  blocked: "text-amber-400 border-amber-400/40 hover:border-amber-400",
  awaiting_approval:
    "text-violet-400 border-violet-400/40 hover:border-violet-400",
  in_progress: "text-sky-400 border-sky-400/40 hover:border-sky-400",
  pending: "text-muted-foreground border-border hover:border-foreground",
  done: "text-emerald-500 border-emerald-500/40 hover:border-emerald-500",
};

interface Props {
  taskId: string;
  status: Status;
}

export function StatusDropdown({ taskId, status }: Props) {
  const [pending, startTransition] = useTransition();

  const choose = (next: Status) => {
    if (pending) return;
    startTransition(async () => {
      await setStatus(taskId, next);
    });
  };

  return (
    <PickerDropdown
      value={status}
      options={STATUSES}
      onChange={choose}
      disabled={pending}
      triggerAriaLabel="change status"
      triggerClassName={cn(
        "inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-xs leading-none transition-colors",
        STATUS_TONE[status],
        pending && "cursor-wait opacity-70",
      )}
      renderTrigger={(s) => (
        <>
          {STATUS_LABEL[s]}
          {pending ? (
            <InProgressDots />
          ) : (
            s === "in_progress" && <InProgressDots />
          )}
          <ChevronDown className="size-3 opacity-70" aria-hidden />
        </>
      )}
      renderOption={(s, selected) => (
        <span className={cn(selected ? "text-foreground" : undefined)}>
          {STATUS_LABEL[s]}
        </span>
      )}
    />
  );
}
