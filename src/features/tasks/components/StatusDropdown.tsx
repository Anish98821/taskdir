"use client";

import { useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { setStatus } from "@/app/actions";
import { PickerDropdown } from "@/components/ui/picker-dropdown";
import { CHIP } from "@/features/tasks/components/chip";
import { InProgressDots } from "@/features/tasks/components/InProgressDots";
import {
  statusChipTone,
  statusLabel,
} from "@/features/tasks/components/statusDisplay";
import type { StatusDef } from "@/lib/statuses-types";
import type { Status } from "@/lib/task-types";
import { cn } from "@/lib/utils";

interface Props {
  taskId: string;
  status: Status;
  statuses: StatusDef[];
}

export function StatusDropdown({ taskId, status, statuses }: Props) {
  const [pending, startTransition] = useTransition();

  // Include the task's current status even if it's no longer configured, so
  // the picker can always represent what's on disk.
  const ids = statuses.map((s) => s.id);
  const options = ids.includes(status) ? ids : [status, ...ids];

  const choose = (next: Status) => {
    if (pending) return;
    startTransition(async () => {
      await setStatus(taskId, next);
    });
  };

  return (
    <PickerDropdown
      value={status}
      options={options}
      onChange={choose}
      disabled={pending}
      triggerAriaLabel="change status"
      triggerClassName={cn(
        CHIP,
        statusChipTone(statuses, status),
        pending && "cursor-wait opacity-70",
      )}
      renderTrigger={(s) => (
        <>
          {statusLabel(statuses, s)}
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
          {statusLabel(statuses, s)}
        </span>
      )}
    />
  );
}
