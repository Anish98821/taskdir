"use client";

import { useTransition } from "react";
import { Check } from "lucide-react";
import { markReportRead } from "@/app/actions";
import { InProgressDots } from "@/features/tasks/components/InProgressDots";

interface Props {
  taskId: string;
}

export function MarkReportReadButton({ taskId }: Props) {
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    if (pending) return;
    startTransition(async () => {
      await markReportRead(taskId);
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-label="mark report as read"
      title="mark report as read"
      className="inline-flex items-center gap-1 border border-emerald-500/40 px-1.5 py-0.5 text-xs leading-none text-emerald-500 hover:border-emerald-500 disabled:opacity-60"
    >
      {pending ? (
        <>
          marking<InProgressDots />
        </>
      ) : (
        <>
          <Check className="size-3" aria-hidden />
          mark read
        </>
      )}
    </button>
  );
}
